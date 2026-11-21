<?php
// VIDHYAA Jewellery Studio - Secure One-Time / Authenticated Admin Password Setup
require_once __DIR__ . '/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, x-customer-token, x-order-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$clientIp = trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
$rlKey = "admin_setup:{$clientIp}";
$rl = vdhCheckRateLimit($rlKey);
if (!$rl['allowed']) {
    vdhSendJson(429, [
        'success' => false,
        'error' => "Too many setup attempts. Retry in {$rl['remainingSeconds']} seconds."
    ]);
}

$rawInput = file_get_contents('php://input');
$data = json_decode((string)$rawInput, true);
if (!is_array($data)) {
    vdhSendJson(400, ['success' => false, 'error' => 'Invalid JSON request payload.']);
}

$result = vdhWithFileLock('admin_creds', function () use ($data, $rlKey) {
    $creds = vdhLoadAdminCredentialsConfig();
    $admin = vdhAuthenticateAdmin();
    $liveProd = vdhIsLiveProductionHost();

    if ($liveProd && $admin === null) {
        return [403, [
            'success' => false,
            'error' => 'Sign in with Google Workspace Admin first before configuring server password login on production.'
        ]];
    }

    if ($creds['hasPasswordAuth'] && $admin === null) {
        return [409, [
            'success' => false,
            'error' => 'Administrator password is already configured. Please sign in with your password or Google Workspace Admin.'
        ]];
    }

    if (!empty($creds['hasEnvPasswordOverride'])) {
        return [409, [
            'success' => false,
            'error' => 'ADMIN_PASSWORD_HASH is managed by server environment variables.'
        ]];
    }

    $email = strtolower(trim((string)($data['email'] ?? ($admin['email'] ?? ''))));
    $password = (string)($data['password'] ?? '');
    $confirmPassword = (string)($data['confirmPassword'] ?? $password);

    if ($email === '' || !in_array($email, vdhAllowedAdminEmails(), true)) {
        vdhRecordRateLimitFailure($rlKey);
        return [401, [
            'success' => false,
            'error' => 'Only the authorized administrator email can be configured.'
        ]];
    }

    if ($admin !== null && $email !== strtolower((string)$admin['email'])) {
        return [403, [
            'success' => false,
            'error' => 'Email must match your authenticated administrator account.'
        ]];
    }

    if ($password !== $confirmPassword) {
        return [400, [
            'success' => false,
            'error' => 'Password and confirmation password do not match.'
        ]];
    }

    $compromised = [
        'password', 'password123', 'admin123', 'admin1234', 'admin12345', 'admin123456',
        '12345678', '123456789', '1234567890', 'qwerty123456', 'welcome123', 'welcome@123',
        'vidhyaa123', 'vidhyaa@123', 'jewellery123', 'jewellery2026', 'superadmin123',
        'letmein123', 'pass@1234', 'india@123', 'jaipur123', 'royal12345'
    ];
    if (strlen($password) < 12) {
        return [400, ['success' => false, 'error' => 'Password must be at least 12 characters long.']];
    }
    if (in_array(strtolower(trim($password)), $compromised, true)) {
        return [400, ['success' => false, 'error' => 'Please choose a unique password not in common breach lists.']];
    }
    if (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
        return [400, ['success' => false, 'error' => 'Password must include uppercase, lowercase, a digit, and a special character.']];
    }

    $targetFile = vdhOutsideSecretsFilePath('admin-credentials.json');
    if ($targetFile === null) {
        return [500, [
            'success' => false,
            'error' => 'Outside secrets directory is restricted by hosting open_basedir. Please set ADMIN_PASSWORD_HASH outside public_html.'
        ]];
    }

    $existing = [];
    if (@is_file($targetFile) && @is_readable($targetFile)) {
        $parsed = json_decode((string)@file_get_contents($targetFile), true);
        if (is_array($parsed)) $existing = $parsed;
    }

    $signingSecret = (string)($existing['sessionSigningSecret'] ?? '');
    if (strlen($signingSecret) < 32) {
        $signingSecret = vdhGetSessionSecret();
    }

    $next = array_merge($existing, [
        'version' => 1,
        'algorithm' => 'pbkdf2-sha256',
        'email' => $email,
        'passwordHash' => vdhHashPassword($password),
        'sessionSigningSecret' => $signingSecret,
        'updatedAt' => gmdate('c'),
    ]);

    if (!vdhAtomicWriteFile($targetFile, (string)json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))) {
        return [500, [
            'success' => false,
            'error' => 'Unable to persist administrator credentials outside public_html.'
        ]];
    }
    @chmod($targetFile, 0600);
    vdhClearRateLimit($rlKey);

    $adminInfo = [
        'email' => $email,
        'role' => 'admin',
        'name' => (string)($admin['name'] ?? 'Neeraj Chauhan (Owner)')
    ];
    $token = vdhSignSessionToken([
        'type' => 'admin',
        'sub' => $email,
        'email' => $email,
        'name' => $adminInfo['name'],
        'role' => 'admin',
        'authMethod' => 'password_setup'
    ], VDH_ADMIN_TTL_SECONDS);

    return [200, [
        'success' => true,
        'token' => $token,
        'expiresIn' => VDH_ADMIN_TTL_SECONDS,
        'admin' => $adminInfo
    ]];
});

vdhSendJson($result[0], $result[1]);
