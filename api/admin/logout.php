<?php
// VIDHYAA Jewellery Studio - Executive Admin Logout & Token Revocation Endpoint
require_once __DIR__ . '/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-admin-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode((string)$rawInput, true);
$token = vdhExtractAdminToken();
if ($token === '' && is_array($data) && !empty($data['token'])) {
    $token = trim((string)$data['token']);
}

if ($token !== '') {
    vdhRevokeSessionToken($token);
}

vdhSendJson(200, ['success' => true]);
