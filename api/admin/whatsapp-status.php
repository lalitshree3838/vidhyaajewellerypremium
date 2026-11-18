<?php
// VIDHYAA Jewellery Studio - Admin WhatsApp Click-to-Chat Status & Preview Endpoint (Hostinger Production)
require_once __DIR__ . '/_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-admin-token');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

vdhRequireAdmin();

$ownerWhatsapp = '917302187770';
$logsFile = vdhRootDir() . '/data/whatsapp_logs.json';
$action = trim((string)($_GET['action'] ?? ''));
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'test' && $method === 'POST') {
    $previewMessage = "VIDHYAA JEWELLERY STUDIO\n"
        . "🟢 NEW ORDER CONFIRMED ✓\n\n"
        . "Order ID: VDH-TEST-001\n"
        . "Customer Name: Demo Customer\n"
        . "Mobile: +91 9876543210\n"
        . "Product: Gold Rajwada Kada\n"
        . "Quantity: 1\n"
        . "Payment Status: SUCCESSFUL\n"
        . "Payment Method: Cashfree / UPI (Verified)\n"
        . "Total Amount: ₹1,500\n\n"
        . "Delivery Address:\n123 Test Street, Roorkee, Uttarakhand - 247667\n\n"
        . "Please prepare this order for delivery.";

    $directLink = 'https://wa.me/' . $ownerWhatsapp . '?text=' . rawurlencode($previewMessage);

    vdhSendJson(200, [
        'success' => true,
        'mode' => 'Click-to-Chat',
        'directLink' => $directLink,
        'result' => ['directLink' => $directLink],
        'previewMessage' => $previewMessage,
    ]);
}

if ($method === 'GET') {
    $logs = [];
    if (is_file($logsFile) && is_readable($logsFile)) {
        $decoded = json_decode((string)@file_get_contents($logsFile), true);
        if (is_array($decoded)) {
            $logs = $decoded;
        }
    }
    vdhSendJson(200, [
        'success' => true,
        'mode' => 'Customer Click-to-Chat (wa.me)',
        'ownerNumber' => '+' . $ownerWhatsapp,
        'cloudApiRequired' => false,
        'totalLogs' => count($logs),
        'recentLogs' => array_slice($logs, 0, 10),
    ]);
}

vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
