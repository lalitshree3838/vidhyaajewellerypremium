<?php
// VIDHYAA Jewellery Studio - Cashfree PG API & Signed Webhook Endpoint (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-admin-token, x-customer-token, x-order-token, x-webhook-signature, x-webhook-timestamp');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rootDir = dirname(__DIR__, 2);
$outsideSecretsFile = dirname($rootDir) . '/.admin-secrets/cashfree-config.json';
$envFile = $rootDir . '/.env';
$dataOrdersFile = $rootDir . '/data/orders.json';
$apiOrdersFile = dirname(__DIR__) . '/orders';

function cfGetCredentials($outsideSecretsFile, $envFile) {
    $cfg = [];
    if (is_file($outsideSecretsFile) && is_readable($outsideSecretsFile)) {
        $parsed = json_decode((string)@file_get_contents($outsideSecretsFile), true);
        if (is_array($parsed)) {
            $cfg = $parsed;
        }
    }
    $dotEnv = vdhReadDotEnv();
    $appId = trim((string)($cfg['appId'] ?? (getenv('CASHFREE_APP_ID') ?: ($dotEnv['CASHFREE_APP_ID'] ?? ''))));
    $secretKey = trim((string)($cfg['secretKey'] ?? (getenv('CASHFREE_SECRET_KEY') ?: ($dotEnv['CASHFREE_SECRET_KEY'] ?? ''))));
    $rawEnv = strtoupper(trim((string)($cfg['env'] ?? (getenv('CASHFREE_ENV') ?: ($dotEnv['CASHFREE_ENV'] ?? 'SANDBOX')))));
    $env = $rawEnv === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
    $apiVersion = trim((string)($cfg['apiVersion'] ?? (getenv('CASHFREE_API_VERSION') ?: ($dotEnv['CASHFREE_API_VERSION'] ?? '2023-08-01'))));
    $notifyUrl = trim((string)($cfg['notifyUrl'] ?? (getenv('CASHFREE_NOTIFY_URL') ?: ($dotEnv['CASHFREE_NOTIFY_URL'] ?? ''))));
    $baseUrl = $env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    $isConfigured = ($appId !== '' && $secretKey !== '');

    return [
        'appId' => $appId,
        'secretKey' => $secretKey,
        'env' => $env,
        'apiVersion' => $apiVersion,
        'notifyUrl' => $notifyUrl,
        'baseUrl' => $baseUrl,
        'isConfigured' => $isConfigured,
        'hasLiveCredentials' => ($isConfigured && $env === 'PRODUCTION'),
        'storedOutsideWebroot' => is_file($outsideSecretsFile)
    ];
}

function cfStatusSummary($creds) {
    $appId = $creds['appId'];
    $masked = $appId !== '' ? (strlen($appId) > 8 ? substr($appId, 0, 4) . '••••' . substr($appId, -4) : '••••Configured') : 'Not Configured';
    $isLiveHost = vdhIsLiveProductionHost();
    return [
        'success' => true,
        'configured' => $creds['isConfigured'],
        'isConfigured' => $creds['isConfigured'],
        'hasLiveCredentials' => $creds['hasLiveCredentials'],
        'isLiveDomain' => $isLiveHost,
        'blockedOnLiveDomain' => ($isLiveHost && $creds['env'] === 'SANDBOX'),
        'storedOutsideWebroot' => $creds['storedOutsideWebroot'],
        'env' => $creds['env'],
        'mode' => strtolower($creds['env']),
        'appIdMasked' => $masked,
        'hasSecretKey' => ($creds['secretKey'] !== ''),
        'apiVersion' => $creds['apiVersion']
    ];
}

function cfSanitizeOrderId($raw) {
    return substr(preg_replace('/[^a-zA-Z0-9_-]/', '_', trim((string)$raw)), 0, 45);
}

function cfOwnerWhatsAppUrl(array $order): string {
    $orderId = (string)($order['orderNumber'] ?? ($order['id'] ?? 'N/A'));
    $customerName = (string)($order['customerName'] ?? ($order['shippingAddress']['name'] ?? 'Valued Patron'));
    $customerMobile = (string)($order['customerPhone'] ?? ($order['shippingAddress']['phone'] ?? 'N/A'));
    $items = is_array($order['items'] ?? null) ? $order['items'] : [];
    $productName = 'Handcrafted Jewellery';
    $quantity = 1;
    if (!empty($items)) {
        $productName = implode(', ', array_map(fn($it) => (string)($it['productName'] ?? 'Piece'), $items));
        $quantity = array_sum(array_map(fn($it) => (int)($it['quantity'] ?? 1), $items));
    }
    $addr = is_array($order['shippingAddress'] ?? null) ? $order['shippingAddress'] : [];
    $addrParts = array_filter([
        $addr['street'] ?? '',
        $addr['landmark'] ?? '',
        $addr['city'] ?? '',
        !empty($addr['state']) ? $addr['state'] . (!empty($addr['pincode']) ? ' - ' . $addr['pincode'] : '') : ($addr['pincode'] ?? '')
    ]);
    $addressStr = !empty($addrParts) ? implode(', ', $addrParts) : 'Address provided at checkout';
    $total = number_format((float)($order['totalAmount'] ?? 0), 0, '.', ',');
    $method = (string)($order['paymentMethod'] ?? 'Online Payment');

    $msg = "VIDHYAA JEWELLERY STUDIO\n"
        . "🟢 NEW ORDER CONFIRMED ✓\n\n"
        . "Order ID: {$orderId}\n"
        . "Customer Name: {$customerName}\n"
        . "Mobile: {$customerMobile}\n"
        . "Product: {$productName}\n"
        . "Quantity: {$quantity}\n"
        . "Payment Status: SUCCESSFUL\n"
        . "Payment Method: {$method}\n"
        . "Total Amount: ₹{$total}\n\n"
        . "Delivery Address:\n{$addressStr}\n\n"
        . "Please prepare this order for delivery.";

    return 'https://wa.me/917302187770?text=' . rawurlencode($msg);
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
            $decoded = json_decode((string)@file_get_contents($file), true);
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
    $ok1 = vdhAtomicWriteFile($dataFile, $json);
    $ok2 = vdhAtomicWriteFile($apiFile, $json);
    return $ok1 || $ok2;
}

function cfFindOrder($orders, $needle) {
    $needle = trim((string)$needle);
    if ($needle === '') return [null, -1];
    $safe = cfSanitizeOrderId($needle);
    foreach ($orders as $idx => $o) {
        if (($o['id'] ?? '') === $needle || ($o['orderNumber'] ?? '') === $needle || ($o['gatewayOrderId'] ?? '') === $needle || (string)($o['cfOrderId'] ?? '') === $needle || cfSanitizeOrderId($o['orderNumber'] ?? '') === $safe) {
            return [$o, $idx];
        }
    }
    return [null, -1];
}

$action = trim((string)($_GET['action'] ?? ''));
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$creds = cfGetCredentials($outsideSecretsFile, $envFile);

if ($action === 'status' && $method === 'GET') {
    vdhSendJson(200, cfStatusSummary($creds));
}

if ($action === 'admin-config') {
    vdhRequireAdmin();

    if ($method === 'GET') {
        vdhSendJson(200, cfStatusSummary($creds));
    }
    if ($method === 'POST') {
        $body = json_decode((string)file_get_contents('php://input'), true);
        if (!is_array($body)) {
            vdhSendJson(400, ['success' => false, 'error' => 'Invalid configuration payload.']);
        }
        $updated = [
            'appId' => isset($body['appId']) ? trim((string)$body['appId']) : $creds['appId'],
            'secretKey' => isset($body['secretKey']) ? trim((string)$body['secretKey']) : $creds['secretKey'],
            'env' => strtoupper(trim((string)($body['env'] ?? $creds['env']))) === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
            'apiVersion' => $creds['apiVersion'],
            'notifyUrl' => isset($body['notifyUrl']) ? trim((string)$body['notifyUrl']) : $creds['notifyUrl'],
            'updatedAt' => gmdate('Y-m-d\TH:i:s.000\Z')
        ];

        $outsideDir = dirname($outsideSecretsFile);
        if (!is_dir($outsideDir) && !@mkdir($outsideDir, 0700, true)) {
            vdhSendJson(500, [
                'success' => false,
                'error' => 'Cannot create outside-webroot .admin-secrets directory (open_basedir or permissions restriction). Refusing to write Cashfree secrets inside public_html. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in environment or create ../.admin-secrets/ manually.'
            ]);
        }
        @chmod($outsideDir, 0700);
        if (!is_writable($outsideDir) || @file_put_contents($outsideSecretsFile, json_encode($updated, JSON_PRETTY_PRINT), LOCK_EX) === false) {
            vdhSendJson(500, [
                'success' => false,
                'error' => 'Failed to write Cashfree credentials outside public_html. Refusing insecure webroot fallback.'
            ]);
        }
        @chmod($outsideSecretsFile, 0600);
        $nextCreds = cfGetCredentials($outsideSecretsFile, $envFile);
        vdhSendJson(200, array_merge(cfStatusSummary($nextCreds), ['message' => 'Cashfree configuration saved securely outside public_html.']));
    }
}

if ($action === 'create-order' && $method === 'POST') {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid payload.']);
    }
    if (!$creds['isConfigured']) {
        vdhSendJson(503, [
            'success' => false,
            'configured' => false,
            'mode' => strtolower($creds['env']),
            'error' => 'Cashfree credentials are not configured yet.'
        ]);
    }
    if (vdhIsLiveProductionHost() && $creds['env'] === 'SANDBOX') {
        vdhSendJson(403, [
            'success' => false,
            'configured' => true,
            'mode' => 'sandbox',
            'error' => 'Cashfree Gateway is currently set to SANDBOX test mode and is disabled on live production domain vidhyaajewellerystudio.com. Switch to PRODUCTION credentials in Admin Settings.'
        ]);
    }

    $rawOrderId = trim((string)($body['orderNumber'] ?? ($body['orderId'] ?? 'VDH-' . substr((string)time(), -6))));
    $safeOrderId = cfSanitizeOrderId($rawOrderId);
    $amount = round((float)($body['orderAmount'] ?? ($body['totalAmount'] ?? 0)), 2);
    if ($amount <= 0) {
        vdhSendJson(400, ['success' => false, 'configured' => true, 'error' => 'Order amount must exceed ₹0.']);
    }

    $rawPhone = preg_replace('/\D+/', '', (string)($body['customerPhone'] ?? ''));
    $cleanPhone = strlen($rawPhone) >= 10 ? substr($rawPhone, -10) : '9758350524';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'vidhyaajewellerystudio.com';
    $returnUrl = $body['returnUrl'] ?? ($scheme . '://' . $host . '/?view=checkout&cf_order_id={order_id}');

    $orderMeta = [
        'return_url' => $returnUrl,
        'payment_methods' => $body['paymentMethods'] ?? 'upi,cc,dc,nb'
    ];
    $candidateNotify = trim((string)($body['notifyUrl'] ?? $creds['notifyUrl']));
    if ($candidateNotify === '' && $scheme === 'https' && !str_contains($host, 'localhost')) {
        $candidateNotify = 'https://' . $host . '/api/payments/cashfree/webhook';
    }
    if ($candidateNotify !== '' && preg_match('#^https://#i', $candidateNotify)) {
        $orderMeta['notify_url'] = $candidateNotify;
    }

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
        'order_meta' => $orderMeta,
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
        vdhSendJson(502, [
            'success' => false,
            'configured' => true,
            'mode' => strtolower($creds['env']),
            'error' => $respData['message'] ?? ($curlErr ?: "Cashfree API HTTP $status")
        ]);
    }

    $isSandbox = ($creds['env'] === 'SANDBOX');
    $pendingOrder = vdhWithFileLock('orders', function () use ($dataOrdersFile, $apiOrdersFile, $body, $respData, $rawOrderId, $safeOrderId, $amount, $creds, $isSandbox) {
        $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
        [$existing, $existingIdx] = cfFindOrder($orders, $rawOrderId);
        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $orderRecord = array_merge($existing ?? [], [
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
            'giftItem' => $body['giftItem'] ?? ($existing['giftItem'] ?? null),
            'paymentMethod' => $body['paymentMethod'] ?? ($existing['paymentMethod'] ?? 'Cashfree Online Payment'),
            'paymentStatus' => (($existing['paymentStatus'] ?? '') === 'paid') ? 'paid' : 'pending',
            'isPaid' => (($existing['paymentStatus'] ?? '') === 'paid'),
            'orderStatus' => (($existing['paymentStatus'] ?? '') === 'paid') ? ($existing['orderStatus'] ?? 'Confirmed') : 'Pending',
            'paymentEnv' => $creds['env'],
            'isTestOrder' => $isSandbox,
            'currency' => 'INR',
            'createdAt' => $existing['createdAt'] ?? $now,
            'updatedAt' => $now
        ]);
        if ($existingIdx >= 0) $orders[$existingIdx] = $orderRecord;
        else array_unshift($orders, $orderRecord);
        cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
        return $orderRecord;
    });

    vdhSendJson(200, [
        'success' => true,
        'configured' => true,
        'orderId' => $respData['order_id'] ?? $safeOrderId,
        'order_id' => $respData['order_id'] ?? $safeOrderId,
        'cfOrderId' => $respData['cf_order_id'] ?? null,
        'paymentSessionId' => $respData['payment_session_id'],
        'payment_session_id' => $respData['payment_session_id'],
        'orderStatus' => $respData['order_status'] ?? 'ACTIVE',
        'mode' => strtolower($creds['env']),
        'receiptToken' => vdhOrderReceiptToken($pendingOrder),
        'order' => $pendingOrder
    ]);
}

if ($action === 'verify-order' && $method === 'POST') {
    $body = json_decode((string)file_get_contents('php://input'), true);
    $orderId = trim((string)($body['orderId'] ?? ($body['order_id'] ?? '')));
    if ($orderId === '') {
        vdhSendJson(400, ['success' => false, 'isPaid' => false, 'error' => 'orderId is required.']);
    }

    if (vdhIsLiveProductionHost() && $creds['env'] === 'SANDBOX') {
        vdhSendJson(403, [
            'success' => false,
            'isPaid' => false,
            'mode' => 'sandbox',
            'error' => 'Sandbox verification is disabled on live production domain vidhyaajewellerystudio.com.'
        ]);
    }

    $receiptTok = vdhExtractOrderReceiptToken();
    $admin = vdhAuthenticateAdmin();
    $customer = vdhAuthenticateCustomer();

    $initialTarget = vdhWithFileLock('orders', function () use ($dataOrdersFile, $apiOrdersFile, $orderId) {
        $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
        [$target] = cfFindOrder($orders, $orderId);
        return $target;
    });

    if ($initialTarget && ($initialTarget['paymentStatus'] ?? '') === 'paid' && in_array($initialTarget['verifiedVia'] ?? '', ['cashfree_api', 'cashfree_webhook'], true)) {
        $canViewFull = (bool)$admin
            || ($customer && vdhCustomerOwnsOrder($customer, $initialTarget))
            || vdhHasValidOrderReceiptToken($initialTarget, $receiptTok);

        vdhSendJson(200, array_merge([
            'success' => true,
            'isPaid' => true,
            'alreadyVerified' => true,
            'orderId' => $initialTarget['gatewayOrderId'] ?? $initialTarget['orderNumber'],
            'orderStatus' => 'PAID',
            'orderAmount' => $initialTarget['verifiedAmount'] ?? $initialTarget['totalAmount'],
            'order' => $canViewFull ? $initialTarget : vdhSanitizePublicOrderTracking($initialTarget)
        ], $canViewFull ? ['receiptToken' => vdhOrderReceiptToken($initialTarget)] : []));
    }

    if (!$creds['isConfigured']) {
        vdhSendJson(503, ['success' => false, 'isPaid' => false, 'configured' => false, 'orderId' => $orderId, 'orderStatus' => 'UNCONFIGURED', 'error' => 'Cashfree credentials not configured.']);
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
        vdhSendJson(502, ['success' => false, 'isPaid' => false, 'orderId' => $safeOrderId, 'orderStatus' => 'ERROR', 'error' => $ordData['message'] ?? ($curlErr ?: 'Order lookup failed')]);
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
    $hasPaidStatus = ($rawStatus === 'PAID' && (empty($payments) || $successPay !== null));
    $isSandbox = ($creds['env'] === 'SANDBOX');

    $outcome = vdhWithFileLock('orders', function () use (
        $dataOrdersFile, $apiOrdersFile, $orderId, $safeOrderId, $body, $ordData, $rawStatus,
        $latestPay, $latestPayStatus, $paidAmount, $paidCurrency, $hasPaidStatus, $creds, $isSandbox,
        $admin, $customer, $receiptTok
    ) {
        $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
        [$target, $idx] = cfFindOrder($orders, $orderId);

        if ($target && ($target['paymentStatus'] ?? '') === 'paid' && in_array($target['verifiedVia'] ?? '', ['cashfree_api', 'cashfree_webhook'], true)) {
            $canViewFull = (bool)$admin
                || ($customer && vdhCustomerOwnsOrder($customer, $target))
                || vdhHasValidOrderReceiptToken($target, $receiptTok);
            return [200, array_merge([
                'success' => true,
                'isPaid' => true,
                'alreadyVerified' => true,
                'orderId' => $target['gatewayOrderId'] ?? $target['orderNumber'],
                'orderStatus' => 'PAID',
                'orderAmount' => $target['verifiedAmount'] ?? $target['totalAmount'],
                'order' => $canViewFull ? $target : vdhSanitizePublicOrderTracking($target)
            ], $canViewFull ? ['receiptToken' => vdhOrderReceiptToken($target)] : [])];
        }

        $expectedAmount = $target ? (float)($target['totalAmount'] ?? 0) : (float)($body['expectedAmount'] ?? 0);
        $now = gmdate('Y-m-d\TH:i:s.000\Z');

        if ($hasPaidStatus && $paidCurrency === 'INR' && ($expectedAmount <= 0 || $paidAmount + 0.01 >= $expectedAmount)) {
            $safeClientMeta = [];
            if (!$target && is_array($body['orderData'] ?? null)) {
                foreach (['orderNumber', 'userId', 'customerName', 'customerEmail', 'customerPhone', 'shippingAddress', 'items', 'subtotal', 'discount', 'deliveryCharge', 'giftItem', 'notes'] as $k) {
                    if (isset($body['orderData'][$k])) $safeClientMeta[$k] = $body['orderData'][$k];
                }
            }
            $base = $target ?? array_merge($safeClientMeta, [
                'id' => 'order_' . $safeOrderId,
                'orderNumber' => $orderId,
                'totalAmount' => $paidAmount,
                'subtotal' => $paidAmount,
                'createdAt' => $now
            ]);
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
                'paymentEnv' => $creds['env'],
                'isTestOrder' => $isSandbox,
                'failureReason' => '',
                'updatedAt' => $now
            ]);
            $paidOrder['whatsappClickToChatUrl'] = cfOwnerWhatsAppUrl($paidOrder);

            if ($idx >= 0) $orders[$idx] = $paidOrder;
            else array_unshift($orders, $paidOrder);
            cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);

            return [200, [
                'success' => true,
                'isPaid' => true,
                'orderId' => $safeOrderId,
                'orderStatus' => $rawStatus,
                'orderAmount' => $paidAmount,
                'cfOrderId' => $ordData['cf_order_id'] ?? null,
                'receiptToken' => vdhOrderReceiptToken($paidOrder),
                'order' => $paidOrder
            ]];
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

        $canViewTarget = $target && (
            (bool)$admin
            || ($customer && vdhCustomerOwnsOrder($customer, $target))
            || vdhHasValidOrderReceiptToken($target, $receiptTok)
        );

        return [200, [
            'success' => true,
            'isPaid' => false,
            'isFailed' => $isFailed,
            'orderId' => $safeOrderId,
            'orderStatus' => $hasPaidStatus ? 'AMOUNT_OR_CURRENCY_MISMATCH' : ($latestPayStatus ?: $rawStatus),
            'order' => $target ? ($canViewTarget ? $target : vdhSanitizePublicOrderTracking($target)) : null
        ]];
    });

    vdhSendJson($outcome[0], $outcome[1]);
}

if ($action === 'webhook' && $method === 'POST') {
    $rawBody = (string)file_get_contents('php://input');
    $sig = trim((string)($_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? ''));
    $ts = trim((string)($_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? ''));

    if ($creds['secretKey'] === '' || $sig === '' || $ts === '') {
        vdhSendJson(401, ['success' => false, 'error' => 'Missing webhook signature headers.']);
    }

    $expectedSig = base64_encode(hash_hmac('sha256', $ts . $rawBody, $creds['secretKey'], true));
    if (!hash_equals($expectedSig, $sig)) {
        vdhSendJson(401, ['success' => false, 'error' => 'Invalid Cashfree webhook signature.']);
    }

    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid webhook JSON.']);
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
    $isSandbox = ($creds['env'] === 'SANDBOX');

    $outcome = vdhWithFileLock('orders', function () use (
        $dataOrdersFile, $apiOrdersFile, $orderId, $eventType, $payStatus, $ordStatus,
        $cfPaymentId, $paidAmount, $currency, $payObj, $orderObj, $creds, $isSandbox
    ) {
        $orders = cfReadOrders($dataOrdersFile, $apiOrdersFile);
        [$target, $idx] = cfFindOrder($orders, $orderId);
        if (!$target) {
            return [200, ['success' => true, 'received' => true, 'orderFound' => false]];
        }

        $eventKey = "$eventType:$cfPaymentId:" . ($payStatus ?: $ordStatus);
        $events = is_array($target['webhookEventIds'] ?? null) ? $target['webhookEventIds'] : [];
        if (in_array($eventKey, $events, true)) {
            return [200, ['success' => true, 'duplicate' => true, 'isPaid' => ($target['paymentStatus'] ?? '') === 'paid', 'order' => $target]];
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
                return [200, ['success' => false, 'rejected' => true, 'isPaid' => false, 'order' => $target]];
            }
            $target['paymentStatus'] = 'paid';
            $target['isPaid'] = true;
            if (!in_array($target['orderStatus'] ?? '', ['Processing', 'Shipped', 'Delivered'], true)) {
                $target['orderStatus'] = 'Confirmed';
            }
            $target['paymentId'] = (string)($cfPaymentId ?: ($target['paymentId'] ?? $orderId));
            $target['cfOrderId'] = $orderObj['cf_order_id'] ?? ($target['cfOrderId'] ?? null);
            $target['verifiedAmount'] = $paidAmount;
            $target['currency'] = $currency;
            $target['paidAt'] = $payObj['payment_time'] ?? ($target['paidAt'] ?? $now);
            $target['paymentVerifiedAt'] = $now;
            $target['confirmedAt'] = $target['confirmedAt'] ?? $now;
            $target['verifiedVia'] = 'cashfree_webhook';
            $target['paymentEnv'] = $creds['env'];
            $target['isTestOrder'] = $isSandbox;
            $target['failureReason'] = '';
            $target['updatedAt'] = $now;
            $target['whatsappClickToChatUrl'] = cfOwnerWhatsAppUrl($target);
            $orders[$idx] = $target;
            cfWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
            return [200, ['success' => true, 'isPaid' => true, 'order' => $target]];
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

        return [200, ['success' => true, 'received' => true, 'isPaid' => ($target['paymentStatus'] ?? '') === 'paid', 'order' => $target]];
    });

    vdhSendJson($outcome[0], $outcome[1]);
}

vdhSendJson(404, ['success' => false, 'error' => 'Cashfree endpoint action not found.']);
