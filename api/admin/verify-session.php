<?php
// VIDHYAA Jewellery Studio - Executive Admin Session Verification Endpoint
require_once __DIR__ . '/_auth.php';

vdhApplyCorsHeaders('POST, GET, OPTIONS', 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, x-customer-token, x-order-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode((string)$rawInput, true);
$bodyToken = is_array($data) ? trim((string)($data['token'] ?? '')) : '';

$admin = vdhAuthenticateAdmin();
if (!$admin && $bodyToken !== '') {
    $session = vdhVerifySignedSessionToken($bodyToken, 'admin');
    if ($session && in_array(strtolower((string)($session['email'] ?? '')), vdhAllowedAdminEmails(), true)) {
        $admin = [
            'email' => strtolower((string)$session['email']),
            'role' => 'admin',
            'name' => (string)($session['name'] ?? 'Executive Administrator')
        ];
    } else {
        $fb = vdhVerifyFirebaseIdToken($bodyToken);
        $fbEmail = strtolower(trim((string)($fb['email'] ?? '')));
        if ($fb && ($fb['email_verified'] ?? false) === true && in_array($fbEmail, vdhAllowedAdminEmails(), true)) {
            $admin = [
                'email' => $fbEmail,
                'role' => 'admin',
                'name' => (string)($fb['name'] ?? 'Executive Administrator')
            ];
        }
    }
}

if ($admin) {
    vdhSendJson(200, [
        'valid' => true,
        'email' => $admin['email'],
        'role' => 'admin',
        'name' => $admin['name']
    ]);
}

vdhSendJson(401, ['valid' => false]);
