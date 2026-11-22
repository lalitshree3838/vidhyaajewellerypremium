<?php
// VIDHYAA Jewellery Studio - Executive Admin Authentication Endpoint
require_once __DIR__ . '/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, x-customer-token, x-order-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$rawInput = file_get_contents('php://input');
$data = json_decode((string)$rawInput, true);

if (!is_array($data)) {
    vdhSendJson(400, ['success' => false, 'error' => 'Invalid JSON request payload.']);
}

$clientIp = trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
$idToken = trim((string)($data['idToken'] ?? ''));

// Path 1: Google / Firebase ID Token verification for authorized admin account
if ($idToken !== '') {
    $rlKey = "admin_fb:{$clientIp}";
    $rl = vdhCheckRateLimit($rlKey);
    if (!$rl['allowed']) {
        vdhSendJson(429, [
            'success' => false,
            'error' => "Too many failed login attempts. Retry in {$rl['remainingSeconds']} seconds."
        ]);
    }

    $fb = vdhVerifyFirebaseIdToken($idToken);
    $fbEmail = strtolower(trim((string)($fb['email'] ?? '')));
    if (!$fb || ($fb['email_verified'] ?? false) !== true || !in_array($fbEmail, vdhAllowedAdminEmails(), true)) {
        vdhRecordRateLimitFailure($rlKey);
        vdhSendJson(401, [
            'success' => false,
            'error' => 'Unauthorized: Firebase account is not verified as an executive administrator.'
        ]);
    }

    vdhClearRateLimit($rlKey);
    $adminInfo = [
        'email' => $fbEmail,
        'role' => 'admin',
        'name' => (string)($fb['name'] ?? 'Neeraj Chauhan (Owner)')
    ];
    $token = vdhSignSessionToken([
        'type' => 'admin',
        'sub' => $fbEmail,
        'email' => $fbEmail,
        'name' => $adminInfo['name'],
        'role' => 'admin',
        'authMethod' => 'firebase'
    ], VDH_ADMIN_TTL_SECONDS);

    vdhSetAdminSessionCookie($token, VDH_ADMIN_TTL_SECONDS);
    vdhSendJson(200, [
        'success' => true,
        'authenticated' => true,
        'expiresIn' => VDH_ADMIN_TTL_SECONDS,
        'admin' => $adminInfo
    ]);
}

// Path 2: Server-verified Administrator Email + Password (+ optional 2FA TOTP)
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');
$totpCode = trim((string)($data['totpCode'] ?? ($data['otpCode'] ?? '')));

if ($email === '' || trim($password) === '') {
    vdhSendJson(400, [
        'success' => false,
        'error' => 'Both administrator email and password are required.'
    ]);
}

$rlKey = "admin_pw:{$clientIp}:{$email}";
$rl = vdhCheckRateLimit($rlKey);
if (!$rl['allowed']) {
    vdhSendJson(429, [
        'success' => false,
        'error' => "Security lockout active due to repeated failures. Retry in {$rl['remainingSeconds']} seconds."
    ]);
}

if (!in_array($email, vdhAllowedAdminEmails(), true)) {
    vdhRecordRateLimitFailure($rlKey);
    vdhSendJson(401, [
        'success' => false,
        'error' => 'Invalid administrator credentials. Access restricted to authorized personnel.'
    ]);
}

$creds = vdhLoadAdminCredentialsConfig();
if (!$creds['hasPasswordAuth']) {
    vdhSendJson(401, [
        'success' => false,
        'error' => 'Server password login is not configured. Sign in with Google Workspace Admin or configure ADMIN_PASSWORD_HASH outside public_html.'
    ]);
}

$passwordOk = false;
if ($creds['passwordHash'] !== '') {
    $passwordOk = vdhVerifyPasswordHash($password, $creds['passwordHash']);
} elseif ($creds['plainPassword'] !== '') {
    $passwordOk = hash_equals($creds['plainPassword'], $password);
}

if (!$passwordOk) {
    $fail = vdhRecordRateLimitFailure($rlKey);
    if ($fail['locked']) {
        vdhSendJson(429, [
            'success' => false,
            'error' => "Too many failed attempts. Access suspended for {$fail['remainingSeconds']} seconds."
        ]);
    }
    vdhSendJson(401, [
        'success' => false,
        'error' => 'Invalid administrator credentials. Access restricted to authorized personnel.'
    ]);
}

// Enforce TOTP / Backup Code if server 2FA secret is configured
if ($creds['totpSecret'] !== '') {
    if ($totpCode === '') {
        vdhSendJson(200, [
            'success' => false,
            'requires2FA' => true,
            'message' => 'Enter your 6-digit authenticator verification code.'
        ]);
    }

    $totpOk = vdhVerifyTotp($creds['totpSecret'], $totpCode);
    if (!$totpOk) {
        $totpOk = vdhVerifyAdminBackupCode($creds, $totpCode);
    }

    if (!$totpOk) {
        $fail = vdhRecordRateLimitFailure($rlKey);
        vdhSendJson(401, [
            'success' => false,
            'requires2FA' => true,
            'error' => $fail['locked']
                ? "Too many invalid verification codes. Retry in {$fail['remainingSeconds']} seconds."
                : 'Invalid two-factor authentication code.'
        ]);
    }
}

vdhClearRateLimit($rlKey);

$adminInfo = [
    'email' => $email,
    'role' => 'admin',
    'name' => 'Neeraj Chauhan (Owner)'
];
$token = vdhSignSessionToken([
    'type' => 'admin',
    'sub' => $email,
    'email' => $email,
    'name' => $adminInfo['name'],
    'role' => 'admin',
    'authMethod' => 'password'
], VDH_ADMIN_TTL_SECONDS);

vdhSetAdminSessionCookie($token, VDH_ADMIN_TTL_SECONDS);
vdhSendJson(200, [
    'success' => true,
    'authenticated' => true,
    'expiresIn' => VDH_ADMIN_TTL_SECONDS,
    'admin' => $adminInfo
]);
