<?php
// VIDHYAA Jewellery Studio - Executive Admin Logout & Token Revocation Endpoint
require_once __DIR__ . '/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-admin-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
}

vdhRequireCsrfSameOrigin();

$rawInput = file_get_contents('php://input');
$data = json_decode((string)$rawInput, true);
$token = vdhExtractAdminToken();
if ($token === '' && is_array($data) && !empty($data['token'])) {
    $token = trim((string)$data['token']);
}

if ($token !== '') {
    vdhRevokeSessionToken($token);
}

vdhClearAdminSessionCookie();
vdhSendJson(200, ['success' => true]);
