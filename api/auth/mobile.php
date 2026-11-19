<?php
// VIDHYAA Jewellery Studio - India +91 Mobile Number + Password Auth Endpoint (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-customer-token, x-admin-token');

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
    vdhSendJson(400, ['success' => false, 'code' => 'INVALID_PAYLOAD', 'error' => 'Invalid JSON payload']);
}

$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$action = strtolower(trim((string)($_GET['action'] ?? '')));
if ($action === '') {
    if (str_contains($uriPath, 'mobile-register')) $action = 'register';
    elseif (str_contains($uriPath, 'mobile-login')) $action = 'login';
}

$rawPhone = (string)($data['phone'] ?? ($data['mobile'] ?? ''));
$mobile = vdhNormalizePhone10($rawPhone);

if (strlen($mobile) !== 10 || !preg_match('/^[6-9]\d{9}$/', $mobile)) {
    vdhSendJson(400, [
        'success' => false,
        'code' => 'INVALID_PHONE',
        'error' => 'Please enter a valid 10-digit Indian mobile number'
    ]);
}

$rootDir = dirname(__DIR__, 2);
$patronsFile = $rootDir . '/data/patrons.json';
$password = (string)($data['password'] ?? '');

if ($action === 'register') {
    if (strlen($password) < 6) {
        vdhSendJson(400, [
            'success' => false,
            'code' => 'INVALID_PASSWORD_LENGTH',
            'error' => 'Password must be at least 6 characters'
        ]);
    }
    if (array_key_exists('confirmPassword', $data) && $data['confirmPassword'] !== $password) {
        vdhSendJson(400, [
            'success' => false,
            'code' => 'PASSWORD_MISMATCH',
            'error' => 'Passwords do not match'
        ]);
    }

    $result = vdhWithFileLock('patrons', function () use ($patronsFile, $mobile, $password, $data) {
        $patrons = [];
        if (is_file($patronsFile) && is_readable($patronsFile)) {
            $decoded = json_decode((string)@file_get_contents($patronsFile), true);
            if (is_array($decoded)) $patrons = $decoded;
        }

        foreach ($patrons as $existing) {
            if (vdhNormalizePhone10((string)($existing['mobile'] ?? ($existing['phone'] ?? ''))) === $mobile) {
                return ['status' => 409, 'body' => [
                    'success' => false,
                    'code' => 'ACCOUNT_EXISTS',
                    'error' => 'An account with this mobile number already exists'
                ]];
            }
        }

        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $newPatron = [
            'uid' => 'patron_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(4)),
            'displayName' => trim((string)($data['name'] ?? '')) ?: 'Valued Patron',
            'phone' => '+91 ' . $mobile,
            'mobile' => $mobile,
            'email' => trim((string)($data['email'] ?? '')),
            'passwordHash' => vdhHashPassword($password),
            'role' => 'customer',
            'createdAt' => $now,
            'updatedAt' => $now
        ];
        $patrons[] = $newPatron;

        $encoded = json_encode($patrons, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($encoded === false || !vdhAtomicWriteFile($patronsFile, $encoded)) {
            return ['status' => 500, 'body' => [
                'success' => false,
                'error' => 'Failed to save patron account on server.'
            ]];
        }

        $userOut = [
            'uid' => $newPatron['uid'],
            'displayName' => $newPatron['displayName'],
            'phone' => $newPatron['phone'],
            'mobile' => $newPatron['mobile'],
            'email' => $newPatron['email'],
            'role' => $newPatron['role']
        ];
        $token = vdhSignSessionToken([
            'type' => 'patron',
            'sub' => $newPatron['uid'],
            'uid' => $newPatron['uid'],
            'mobile' => $newPatron['mobile'],
            'phone' => $newPatron['phone'],
            'email' => $newPatron['email'],
            'role' => 'customer'
        ], VDH_PATRON_TTL_SECONDS);

        return ['status' => 200, 'body' => [
            'success' => true,
            'user' => $userOut,
            'token' => $token
        ]];
    });

    vdhSendJson($result['status'], $result['body']);
}

if ($action === 'login') {
    $clientIp = trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $rlKey = "patron_login:{$clientIp}:{$mobile}";
    $rl = vdhCheckRateLimit($rlKey);
    if (!$rl['allowed']) {
        vdhSendJson(429, [
            'success' => false,
            'code' => 'RATE_LIMITED',
            'error' => "Too many login attempts. Please try again in {$rl['remainingSeconds']} seconds."
        ]);
    }

    $patrons = [];
    if (is_file($patronsFile) && is_readable($patronsFile)) {
        $decoded = json_decode((string)@file_get_contents($patronsFile), true);
        if (is_array($decoded)) $patrons = $decoded;
    }

    $matched = null;
    foreach ($patrons as $p) {
        if (vdhNormalizePhone10((string)($p['mobile'] ?? ($p['phone'] ?? ''))) === $mobile) {
            $matched = $p;
            break;
        }
    }

    if (!$matched || !vdhVerifyPasswordHash($password, (string)($matched['passwordHash'] ?? ''))) {
        vdhRecordRateLimitFailure($rlKey);
        vdhSendJson(401, [
            'success' => false,
            'code' => 'INVALID_CREDENTIALS',
            'error' => 'Invalid credentials'
        ]);
    }

    vdhClearRateLimit($rlKey);
    $userOut = [
        'uid' => (string)$matched['uid'],
        'displayName' => (string)($matched['displayName'] ?? 'Valued Patron'),
        'phone' => (string)($matched['phone'] ?? ('+91 ' . $mobile)),
        'mobile' => (string)($matched['mobile'] ?? $mobile),
        'email' => (string)($matched['email'] ?? ''),
        'role' => (string)($matched['role'] ?? 'customer')
    ];
    $token = vdhSignSessionToken([
        'type' => 'patron',
        'sub' => $userOut['uid'],
        'uid' => $userOut['uid'],
        'mobile' => $userOut['mobile'],
        'phone' => $userOut['phone'],
        'email' => $userOut['email'],
        'role' => 'customer'
    ], VDH_PATRON_TTL_SECONDS);

    vdhSendJson(200, [
        'success' => true,
        'user' => $userOut,
        'token' => $token
    ]);
}

vdhSendJson(404, ['success' => false, 'error' => 'Auth action not found.']);
