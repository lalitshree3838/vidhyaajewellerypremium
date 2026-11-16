<?php
// VIDHYAA Jewellery Studio - Cashfree PG API & Signed Webhook Endpoint (Hostinger Production)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-admin-token, x-webhook-signature, x-webhook-timestamp');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rootDir = dirname(__DIR__, 2);
$outsideSecretsFile = dirname($rootDir) . '/.admin-secrets/cashfree-config.json';
$localSecretsFile = $rootDir . '/.admin-secrets/cashfree-config.json';
$legacyConfigFile = $rootDir . '/cashfree-config.json';
$envFile = $rootDir . '/.env';
$dataOrdersFile = $rootDir . '/data/orders.json';
$apiOrdersFile = dirname(__DIR__) . '/orders';

function cfReadDotEnv($path) {
    $vars = [];
    if (!is_file($path) || !is_readable($path)) return $vars;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) return $vars;
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) continue;
        $pos = strpos($trimmed, '=');
        if ($pos === false) continue;
        $k = trim(substr($trimmed, 0, $pos));
        $v = trim(substr($trimmed, $pos + 1));
        $v = trim($v, "\"'");
        $vars[$k] = $v;
    }
    return $vars;
}

function cfGetCredentials($outsideSecretsFile, $localSecretsFile, $legacyConfigFile, $envFile) {
    $cfg = [];
    foreach ([$outsideSecretsFile, $localSecretsFile, $legacyConfigFile] as $cand) {
        if (is_file($cand) && is_readable($cand)) {
            $parsed = json_decode(file_get_contents($cand), true);
            if (is_array($parsed)) {
                $cfg = $parsed;
                break;
            }
        }
    }
    $dotEnv = cfReadDotEnv($envFile);
    $appId = trim((string)($cfg['appId'] ?? (getenv('CASHFREE_APP_ID') ?: ($dotEnv['CASHFREE_APP_ID'] ?? ''))));
    $secretKey = trim((string)($cfg['secretKey'] ?? (getenv('CASHFREE_SECRET_KEY') ?: ($dotEnv['CASHFREE_SECRET_KEY'] ?? ''))));
    $rawEnv = strtoupper(trim((string)($cfg['env'] ?? (getenv('CASHFREE_ENV') ?: ($dotEnv['CASHFREE_ENV'] ?? 'SANDBOX')))));
    $env = $rawEnv === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
    $apiVersion = trim((string)($cfg['apiVersion'] ?? (getenv('CASHFREE_API_VERSION') ?: ($dotEnv['CASHFREE_API_VERSION'] ?? '2023-08-01'))));
    $baseUrl = $env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    $isConfigured = ($appId !== '' && $secretKey !== '');

    return [
        'appId' => $appId,
        'secretKey' => $secretKey,
        'env' => $env,
        'apiVersion' => $apiVersion,
        'baseUrl' => $baseUrl,
        'isConfigured' => $isConfigured,
        'hasLiveCredentials' => ($isConfigured && $env === 'PRODUCTION')
    ];
}

function cfStatusSummary($creds) {
    $appId = $creds['appId'];
    $masked = $appId !== '' ? (strlen($appId) > 8 ? substr($appId, 0, 4) . '••••' . substr($appId, -4) : '••••Configured') : 'Not Configured';
    return [
        'success' => true,
        'configured' => $creds['isConfigured'],
        'isConfigured' => $creds['isConfigured'],
        'hasLiveCredentials' => $creds['hasLiveCredentials'],
        'env' => $creds['env'],
        'mode' => strtolower($creds['env']),
        'appIdMasked' => $masked,
        'hasSecretKey' => ($creds['secretKey'] !== ''),
        'apiVersion' => $creds['apiVersion']
    ];
}

function cfExtractAdminToken() {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $hdr = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if (!empty($hdr)) return trim($hdr);
    if (str_starts_with($auth, 'Bearer ')) return trim(substr($auth, 7));
    return '';
}

function cfSanitizeOrderId($raw) {
    return substr(preg_replace('/[^a-zA-Z0-9_-]/', '_', trim((string)$raw)), 0, 45);
}

function cfHttpRequest($method, $url, $headers, $bodyJson = null) {
    if (!function_exists('curl_init')) {
        return [0, null, 'PHP cURL extension is required for Cashfree API calls.'];
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if ($bodyJson !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyJson);
    }
    $resp = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    $decoded = $resp !== false ? json_decode($resp, true) : null;
    return [$status, $decoded, $err];
}

function cfReadOrders($dataFile, $apiFile) {
    $map = [];
    foreach ([$apiFile, $dataFile] as $file) {
        if (is_file($file) && is_readable($file)) {
            $decoded = json_decode(file_get_contents($file), true);
            if (is_array($decoded)) {
                foreach ($decoded as $o) {
                    if (!is_array($o)) continue;
                    $k = (string)($o['id'] ?? ($o['orderNumber'] ?? ''));
                    if ($k !== '') $map[$k] = array_merge($map[$k] ?? [], $o);
                }
            }
        }
    }
    $list = array_values($map);
    usort($list, fn($a, $b) => strtotime($b['createdAt'] ?? '1970-01-01') <=> strtotime($a['createdAt'] ?? '1970-01-01'));
    return $list;
}

function cfWriteOrders($orders, $dataFile, $apiFile) {
    $json = json_encode(array_values($orders), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    $dir = dirname($dataFile);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    file_put_contents($dataFile, $json, LOCK_EX);
    file_put_contents($apiFile, $json, LOCK_EX);
    return true;
}

function cfFindOrder($orders, $needle) {
    $needle = trim((string)$needle);
    $safe = cfSanitizeOrderId($needle);
    foreach ($orders as $idx => $o) {
        if (($o['id'] ?? '') === $needle || ($o['orderNumber'] ?? '') === $needle || ($o['gatewayOrderId'] ?? '') === $needle || (string)($o['cfOrderId'] ?? '') === $needle || cfSanitizeOrderId($o['orderNumber'] ?? '') === $safe) {
            return [$o, $idx];
        }
    }
    return [null, -1];
}

$action = trim($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$creds = cfGetCredentials($outsideSecretsFile, $localSecretsFile, $legacyConfigFile, $envFile);

if ($action === 'status' && $method === 'GET') {
    echo json_encode(cfStatusSummary($creds));
    exit;
}

if ($action === 'admin-config') {
    if (cfExtractAdminToken() === '') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Admin session token required.']);
        exit;
    }
    if ($method === 'GET') {
        echo json_encode(cfStatusSummary($creds));
        exit;
    }
    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid configuration payload.']);
            exit;
        }
        $updated = [
            'appId' => isset($body['appId']) ? trim((string)$body['appId']) : $creds['appId'],
            'secretKey' => isset($body['secretKey']) ? trim((string)$body['secretKey']) : $creds['secretKey'],
            'env' => strtoupper(trim((string)($body['env'] ?? $creds['env']))) === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
            'apiVersion' => $creds['apiVersion'],
            'updatedAt' => gmdate('Y-m-d\TH:i:s.000\Z')
        ];
        $targetFile = is_dir(dirname($outsideSecretsFile)) || @mkdir(dirname($outsideSecretsFile), 0700, true) ? $outsideSecretsFile : $localSecretsFile;
        if (!is_dir(dirname($targetFile))) @mkdir(dirname($targetFile), 0700, true);
        file_put_contents($targetFile, json_encode($updated, JSON_PRETTY_PRINT), LOCK_EX);
        @chmod($targetFile, 0600);
        $nextCreds = cfGetCredentials($outsideSecretsFile, $localSecretsFile, $legacyConfigFile, $envFile);
        echo json_encode(array_merge(cfStatusSummary($nextCreds), ['message' => 'Cashfree configuration saved securely.']));
        exit;
    }
}

if ($action === 'create-order' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid payload.']);
        exit;
    }
    if (!$creds['isConfigured']) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'configured' => false,
            'mode' => strtolower($creds['env']),
            'error' => 'Cashfree credentials are not configured yet.'
        ]);
        exit;
    }

    $rawOrderId = trim((string)($body['orderNumber'] ?? ($body['orderId'] ?? 'VDH-' . substr((string)time(), -6))));
    $safeOrderId = cfSanitizeOrderId($rawOrderId);
    $amount = round((float)($body['orderAmount'] ?? ($body['totalAmount'] ?? 0)), 2);
    if ($amount <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'configured' => true, 'error' => 'Order amount must exceed ₹0.']);
        exit;
    }

    $rawPhone = preg_replace('/\D+/', '', (string)($body['customerPhone'] ?? ''));
    $cleanPhone = strlen($rawPhone) >= 10 ? substr($rawPhone, -10) : '9758350524';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'vidhyaajewellerystudio.com';
    $returnUrl = $body['returnUrl'] ?? ($scheme . '://' . $host . '/?view=checkout&cf_order_id={order_id}');

    $payload = [
        'order_id' => $safeOrderId,
        'order_amount' => $amount,
        'order_currency' => 'INR',
        'customer_details' => [
            'customer_id' => 'cust_' . substr(preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)($body['customerEmail'] ?? $cleanPhone)), 0, 40),
            'customer_name' => substr(trim((string)($body['customerName'] ?? 'Valued Patron')), 0, 80),
            'customer_email' => trim((string)($body['customerEmail'] ?? 'patron@vidhyaajewellery.com')),
            'customer_phone' => $cleanPhone
        ],
        'order_meta' => [
            'return_url' => $returnUrl,
            'payment_methods' => $body['paymentMethods'] ?? 'upi,cc,dc,nb'
        ],
        'order_note' => substr((string)($body['orderNote'] ?? "VIDHYAA Order $rawOrderId"), 0, 200)
    ];

    $headers = [
        'x-client-id: ' . $creds['appId'],
        'x-client-secret: ' . $creds['secretKey'],
        'x-api-version: ' . $creds['apiVersion'],
        'Content-Type: application/json',
        'Accept: application/json'
    ];
    [$status, $respData, $curlErr] = cfHttpRequest('POST', $creds['baseUrl'] . '/orders', $headers, json_encode($payload));

    if ($status < 200 || $status >= 300 || empty($respData['payment_session_id'])) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'configured' => true,
            'mode' => strtolower($creds['env']),
            'error' => $respData['message'] ?? ($curlErr ?: "Cashfree API HTTP $status")
        ]);
        exit;
    }

    $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
    [$existing, $existingIdx] = cfFindOrder($orders, $rawOrderId);
    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $pendingOrder = array_merge($existing ?? [], [
        'id' => $existing['id'] ?? 'order_' . $safeOrderId,
        'orderNumber' => $existing['orderNumber'] ?? $rawOrderId,
        'gatewayOrderId' => $respData['order_id'] ?? $safeOrderId,
        'cfOrderId' => $respData['cf_order_id'] ?? ($existing['cfOrderId'] ?? null),
        'userId' => $body['userId'] ?? ($existing['userId'] ?? null),
        'customerName' => $body['customerName'] ?? ($existing['customerName'] ?? ''),
        'customerEmail' => $body['customerEmail'] ?? ($existing['customerEmail'] ?? ''),
        'customerPhone' => $body['customerPhone'] ?? ($existing['customerPhone'] ?? ''),
        'shippingAddress' => $body['shippingAddress'] ?? ($existing['shippingAddress'] ?? []),
        'items' => !empty($body['items']) ? $body['items'] : ($existing['items'] ?? []),
        'subtotal' => $body['subtotal'] ?? ($existing['subtotal'] ?? $amount),
        'discount' => $body['discount'] ?? ($existing['discount'] ?? 0),
        'deliveryCharge' => $body['deliveryCharge'] ?? ($existing['deliveryCharge'] ?? 0),
        'totalAmount' => $amount,
        'total' => $amount,
        'paymentMethod' => $body['paymentMethod'] ?? ($existing['paymentMethod'] ?? 'Cashfree Online Payment'),
        'paymentStatus' => (($existing['paymentStatus'] ?? '') === 'paid') ? 'paid' : 'pending',
        'orderStatus' => (($existing['paymentStatus'] ?? '') === 'paid') ? ($existing['orderStatus'] ?? 'Confirmed') : 'Pending',
        'currency' => 'INR',
        'createdAt' => $existing['createdAt'] ?? $now,
        'updatedAt' => $now
    ]);
    if ($existingIdx >= 0) $orders[$existingIdx] = $pendingOrder;
    else array_unshift($orders, $pendingOrder);
    cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);

    echo json_encode([
        'success' => true,
        'configured' => true,
        'orderId' => $respData['order_id'] ?? $safeOrderId,
        'order_id' => $respData['order_id'] ?? $safeOrderId,
        'cfOrderId' => $respData['cf_order_id'] ?? null,
        'paymentSessionId' => $respData['payment_session_id'],
        'payment_session_id' => $respData['payment_session_id'],
        'orderStatus' => $respData['order_status'] ?? 'ACTIVE',
        'mode' => strtolower($creds['env']),
        'order' => $pendingOrder
    ]);
    exit;
}

if ($action === 'verify-order' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $orderId = trim((string)($body['orderId'] ?? ($body['order_id'] ?? '')));
    if ($orderId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'isPaid' => false, 'error' => 'orderId is required.']);
        exit;
    }

    $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
    [$target, $idx] = cfFindOrder($orders, $orderId);
    if ($target && ($target['paymentStatus'] ?? '') === 'paid' && in_array($target['verifiedVia'] ?? '', ['cashfree_api', 'cashfree_webhook'], true)) {
        echo json_encode(['success' => true, 'isPaid' => true, 'alreadyVerified' => true, 'orderId' => $target['orderNumber'], 'orderStatus' => 'PAID', 'order' => $target]);
        exit;
    }

    if (!$creds['isConfigured']) {
        http_response_code(503);
        echo json_encode(['success' => false, 'isPaid' => false, 'configured' => false, 'orderId' => $orderId, 'orderStatus' => 'UNCONFIGURED', 'error' => 'Cashfree credentials not configured.']);
        exit;
    }

    $safeOrderId = cfSanitizeOrderId($orderId);
    $headers = [
        'x-client-id: ' . $creds['appId'],
        'x-client-secret: ' . $creds['secretKey'],
        'x-api-version: ' . $creds['apiVersion'],
        'Accept: application/json'
    ];
    [$ordStatus, $ordData, $curlErr] = cfHttpRequest('GET', $creds['baseUrl'] . '/orders/' . rawurlencode($safeOrderId), $headers);
    if ($ordStatus < 200 || $ordStatus >= 300 || !is_array($ordData)) {
        http_response_code(502);
        echo json_encode(['success' => false, 'isPaid' => false, 'orderId' => $safeOrderId, 'orderStatus' => 'ERROR', 'error' => $ordData['message'] ?? ($curlErr ?: 'Order lookup failed')]);
        exit;
    }

    $rawStatus = strtoupper((string)($ordData['order_status'] ?? 'UNKNOWN'));
    $orderCurrency = strtoupper((string)($ordData['order_currency'] ?? 'INR'));
    $gatewayAmount = (float)($ordData['order_amount'] ?? 0);

    [$payStatus, $payArr] = cfHttpRequest('GET', $creds['baseUrl'] . '/orders/' . rawurlencode($safeOrderId) . '/payments', $headers);
    $payments = (is_array($payArr) && $payStatus >= 200 && $payStatus < 300) ? $payArr : [];
    $successPay = null;
    foreach ($payments as $p) {
        if (strtoupper((string)($p['payment_status'] ?? '')) === 'SUCCESS') {
            $successPay = $p;
            break;
        }
    }
    $latestPay = $successPay ?? ($payments[0] ?? null);
    $latestPayStatus = $latestPay ? strtoupper((string)($latestPay['payment_status'] ?? '')) : '';
    $paidAmount = (float)($latestPay['payment_amount'] ?? $gatewayAmount);
    $paidCurrency = strtoupper((string)($latestPay['payment_currency'] ?? $orderCurrency));
    $expectedAmount = $target ? (float)($target['totalAmount'] ?? 0) : (float)($body['expectedAmount'] ?? 0);

    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $hasPaidStatus = ($rawStatus === 'PAID' && (empty($payments) || $successPay !== null));

    if ($hasPaidStatus && $paidCurrency === 'INR' && ($expectedAmount <= 0 || $paidAmount + 0.01 >= $expectedAmount)) {
        $base = $target ?? ['id' => 'order_' . $safeOrderId, 'orderNumber' => $orderId, 'totalAmount' => $paidAmount, 'subtotal' => $paidAmount, 'createdAt' => $now];
        $paidOrder = array_merge($base, [
            'paymentStatus' => 'paid',
            'isPaid' => true,
            'orderStatus' => in_array($base['orderStatus'] ?? '', ['Processing', 'Shipped', 'Delivered'], true) ? $base['orderStatus'] : 'Confirmed',
            'paymentId' => (string)($latestPay['cf_payment_id'] ?? ($ordData['cf_order_id'] ?? $safeOrderId)),
            'cfOrderId' => $ordData['cf_order_id'] ?? ($base['cfOrderId'] ?? null),
            'verifiedAmount' => $paidAmount,
            'currency' => $paidCurrency,
            'paidAt' => $latestPay['payment_completion_time'] ?? ($base['paidAt'] ?? $now),
            'paymentVerifiedAt' => $now,
            'confirmedAt' => $base['confirmedAt'] ?? $now,
            'verifiedVia' => 'cashfree_api',
            'failureReason' => '',
            'updatedAt' => $now
        ]);
        if ($idx >= 0) $orders[$idx] = $paidOrder;
        else array_unshift($orders, $paidOrder);
        cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);

        echo json_encode([
            'success' => true,
            'isPaid' => true,
            'orderId' => $safeOrderId,
            'orderStatus' => $rawStatus,
            'orderAmount' => $paidAmount,
            'cfOrderId' => $ordData['cf_order_id'] ?? null,
            'order' => $paidOrder
        ]);
        exit;
    }

    $isFailed = $hasPaidStatus || in_array($rawStatus, ['FAILED', 'CANCELLED', 'TERMINATED', 'EXPIRED', 'VOID'], true) || in_array($latestPayStatus, ['FAILED', 'CANCELLED', 'VOID'], true);
    if ($target && $isFailed) {
        $target['paymentStatus'] = 'failed';
        $target['isPaid'] = false;
        $target['orderStatus'] = 'Pending';
        $target['failureReason'] = $hasPaidStatus ? 'Amount or currency mismatch.' : "Gateway status: $rawStatus";
        $target['updatedAt'] = $now;
        $orders[$idx] = $target;
        cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
    }

    echo json_encode([
        'success' => true,
        'isPaid' => false,
        'isFailed' => $isFailed,
        'orderId' => $safeOrderId,
        'orderStatus' => $hasPaidStatus ? 'AMOUNT_OR_CURRENCY_MISMATCH' : ($latestPayStatus ?: $rawStatus),
        'order' => $target
    ]);
    exit;
}

if ($action === 'webhook' && $method === 'POST') {
    $rawBody = file_get_contents('php://input');
    $sig = trim((string)($_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? ''));
    $ts = trim((string)($_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? ''));

    if ($creds['secretKey'] === '' || $sig === '' || $ts === '') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Missing webhook signature headers.']);
        exit;
    }

    $expectedSig = base64_encode(hash_hmac('sha256', $ts . $rawBody, $creds['secretKey'], true));
    if (!hash_equals($expectedSig, $sig)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid Cashfree webhook signature.']);
        exit;
    }

    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid webhook JSON.']);
        exit;
    }

    $orderObj = $payload['data']['order'] ?? [];
    $payObj = $payload['data']['payment'] ?? [];
    $eventType = strtoupper((string)($payload['type'] ?? ''));
    $orderId = trim((string)($orderObj['order_id'] ?? ($payload['orderId'] ?? ($payload['order_id'] ?? ''))));
    $payStatus = strtoupper((string)($payObj['payment_status'] ?? ''));
    $ordStatus = strtoupper((string)($orderObj['order_status'] ?? ''));
    $cfPaymentId = $payObj['cf_payment_id'] ?? '';
    $paidAmount = (float)($payObj['payment_amount'] ?? ($orderObj['order_amount'] ?? 0));
    $currency = strtoupper((string)($payObj['payment_currency'] ?? ($orderObj['order_currency'] ?? 'INR')));

    $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
    [$target, $idx] = cfFindOrder($orders, $orderId);
    if (!$target) {
        echo json_encode(['success' => true, 'received' => true, 'orderFound' => false]);
        exit;
    }

    $eventKey = "$eventType:$cfPaymentId:" . ($payStatus ?: $ordStatus);
    $events = is_array($target['webhookEventIds'] ?? null) ? $target['webhookEventIds'] : [];
    if (in_array($eventKey, $events, true)) {
        echo json_encode(['success' => true, 'duplicate' => true, 'isPaid' => ($target['paymentStatus'] ?? '') === 'paid', 'order' => $target]);
        exit;
    }

    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $events[] = $eventKey;
    $target['webhookEventIds'] = array_slice($events, -20);

    if ($eventType === 'PAYMENT_SUCCESS_WEBHOOK' || $payStatus === 'SUCCESS' || $ordStatus === 'PAID') {
        if ($currency !== 'INR' || $paidAmount + 0.01 < (float)($target['totalAmount'] ?? 0)) {
            $target['paymentStatus'] = 'failed';
            $target['isPaid'] = false;
            $target['orderStatus'] = 'Pending';
            $target['failureReason'] = 'Webhook amount or currency mismatch.';
            $target['updatedAt'] = $now;
            $orders[$idx] = $target;
            cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
            echo json_encode(['success' => false, 'rejected' => true, 'isPaid' => false, 'order' => $target]);
            exit;
        }
        $target['paymentStatus'] = 'paid';
        $target['isPaid'] = true;
        if (!in_array($target['orderStatus'] ?? '', ['Processing', 'Shipped', 'Delivered'], true)) {
            $target['orderStatus'] = 'Confirmed';
        }
        $target['paymentId'] = (string)($cfPaymentId ?: ($target['paymentId'] ?? $orderId));
        $target['verifiedAmount'] = $paidAmount;
        $target['currency'] = $currency;
        $target['paidAt'] = $payObj['payment_time'] ?? ($target['paidAt'] ?? $now);
        $target['paymentVerifiedAt'] = $now;
        $target['confirmedAt'] = $target['confirmedAt'] ?? $now;
        $target['verifiedVia'] = 'cashfree_webhook';
        $target['failureReason'] = '';
        $target['updatedAt'] = $now;
        $orders[$idx] = $target;
        cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
        echo json_encode(['success' => true, 'isPaid' => true, 'order' => $target]);
        exit;
    }

    if (in_array($eventType, ['PAYMENT_FAILED_WEBHOOK'], true) || in_array($payStatus, ['FAILED', 'CANCELLED', 'VOID'], true)) {
        if (($target['paymentStatus'] ?? '') !== 'paid') {
            $target['paymentStatus'] = 'failed';
            $target['isPaid'] = false;
            $target['orderStatus'] = 'Pending';
            $target['failureReason'] = $payObj['payment_message'] ?? 'Payment failed.';
            $target['updatedAt'] = $now;
            $orders[$idx] = $target;
            cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
        }
    }

    echo json_encode(['success' => true, 'received' => true, 'isPaid' => ($target['paymentStatus'] ?? '') === 'paid', 'order' => $target]);
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'error' => 'Cashfree endpoint action not found.']);
exit;
