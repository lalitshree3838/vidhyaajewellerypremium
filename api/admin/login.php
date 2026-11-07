<?php
// VIDHYAA Jewellery Studio - Executive Admin Authentication Endpoint
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-file-name, x-file-type, x-admin-token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON request payload.'
    ]);
    exit;
}

$email = strtolower(trim($data['email'] ?? ''));
$password = trim($data['password'] ?? '');

$adminEmail = 'anavneeraj2003@gmail.com';

if ($email === $adminEmail) {
    $token = 'admin_tok_' . time() . '_' . bin2hex(random_bytes(16));
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'token' => $token,
        'admin' => [
            'email' => $adminEmail,
            'role' => 'admin',
            'name' => 'Neeraj Chauhan (Owner)'
        ]
    ]);
    exit;
}

http_response_code(401);
echo json_encode([
    'success' => false,
    'error' => 'Invalid administrator credentials. Access restricted to authorized personnel.'
]);
exit;
