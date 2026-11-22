<?php
// VIDHYAA Jewellery Studio - Admin Authentication Capabilities & Setup Status
require_once __DIR__ . '/_auth.php';

vdhApplyCorsHeaders('GET, OPTIONS', 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, x-customer-token, x-order-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$creds = vdhLoadAdminCredentialsConfig();
$admin = vdhAuthenticateAdmin();
$liveProd = vdhIsLiveProductionHost();

vdhSendJson(200, [
    'passwordConfigured' => (bool)$creds['hasPasswordAuth'],
    'totpRequired' => ((string)$creds['totpSecret'] !== ''),
    'canFirstRunSetup' => (!$creds['hasPasswordAuth']) && (!$liveProd || $admin !== null),
    'isAuthenticatedAdmin' => ($admin !== null),
    'admin' => $admin ? [
        'email' => $admin['email'],
        'role' => 'admin',
        'name' => $admin['name']
    ] : null,
    'googleSsoEnabled' => true,
]);
