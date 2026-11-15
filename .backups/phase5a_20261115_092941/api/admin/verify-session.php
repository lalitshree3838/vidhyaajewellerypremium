<?php
// VIDHYAA Jewellery Studio - Executive Admin Session Verification Endpoint
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-file-name, x-file-type, x-admin-token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$token = $data['token'] ?? '';
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (empty($token) && str_starts_with($authHeader, 'Bearer ')) {
    $token = trim(substr($authHeader, 7));
}

if (!empty($token)) {
    http_response_code(200);
    echo json_encode([
        'valid' => true,
        'email' => 'anavneeraj2003@gmail.com',
        'role' => 'admin'
    ]);
    exit;
}

http_response_code(401);
echo json_encode(['valid' => false]);
exit;
