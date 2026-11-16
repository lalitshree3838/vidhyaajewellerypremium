<?php
// VIDHYAA Jewellery Studio - Persistent Orders API (Hostinger Production)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-admin-token');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rootDir = dirname(__DIR__);
$dataOrdersFile = $rootDir . '/data/orders.json';
$apiOrdersFile = __DIR__ . '/orders';

function vdhExtractAdminToken() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $adminHeader = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if (!empty($adminHeader)) return trim($adminHeader);
    if (str_starts_with($authHeader, 'Bearer ')) {
        return trim(substr($authHeader, 7));
    }
    return '';
}

function vdhToMoney($val, $fallback = 0) {
    if (is_int($val) || is_float($val)) return (float)$val;
    if (is_string($val)) {
        $cleaned = str_replace(['₹', ',', ' '], '', $val);
        if (is_numeric($cleaned)) return (float)$cleaned;
    }
    return (float)$fallback;
}

function vdhFormatIndianPhone($raw) {
    $str = trim((string)$raw);
    if ($str === '') return '';
    $digits = preg_replace('/\D+/', '', $str);
    if (strlen($digits) === 10) return '+91 ' . $digits;
    if (strlen($digits) === 12 && str_starts_with($digits, '91')) return '+91 ' . substr($digits, 2);
    if (strlen($digits) === 11 && str_starts_with($digits, '0')) return '+91 ' . substr($digits, 1);
    return $str;
}

function vdhSanitizeGatewayOrderId($raw) {
    $clean = preg_replace('/[^a-zA-Z0-9_-]/', '_', trim((string)$raw));
    return substr($clean, 0, 45);
}

function vdhSanitizeOrder($raw, $existing = null) {
    $src = array_merge(is_array($existing) ? $existing : [], is_array($raw) ? $raw : []);
    $existingAddr = (is_array($existing['shippingAddress'] ?? null)) ? $existing['shippingAddress'] : [];
    $rawAddr = (is_array($raw['shippingAddress'] ?? null)) ? array_merge($existingAddr, $raw['shippingAddress']) : $existingAddr;

    $itemsSource = (!empty($raw['items']) && is_array($raw['items'])) ? $raw['items'] : (($existing['items'] ?? []) ?: []);
    $items = [];
    $itemsSubtotal = 0.0;
    foreach ($itemsSource as $it) {
        if (!is_array($it)) continue;
        $qty = max(1, (int)round(vdhToMoney($it['quantity'] ?? 1, 1)));
        $price = max(0, vdhToMoney($it['price'] ?? 0, 0));
        $mrp = max(0, vdhToMoney($it['mrp'] ?? $price, $price));
        $itemsSubtotal += $price * $qty;
        $items[] = [
            'productId' => (string)($it['productId'] ?? 'prod-custom'),
            'productName' => (string)($it['productName'] ?? ($it['title'] ?? 'Jewellery Item')),
            'variationId' => (string)($it['variationId'] ?? 'default'),
            'variationName' => (string)($it['variationName'] ?? ''),
            'quantity' => $qty,
            'price' => $price,
            'mrp' => $mrp,
            'image' => (string)($it['image'] ?? ''),
            'sku' => (string)($it['sku'] ?? '')
        ];
    }

    $parsedSub = vdhToMoney($src['subtotal'] ?? 0, 0);
    $subtotal = $parsedSub > 0 ? $parsedSub : $itemsSubtotal;
    $discount = max(0, vdhToMoney($src['discount'] ?? 0, 0));
    $deliveryCharge = max(0, vdhToMoney($src['deliveryCharge'] ?? 0, 0));
    $computedTotal = max(0, $subtotal - $discount + $deliveryCharge);

    $rawTotal = vdhToMoney($src['totalAmount'] ?? 0, 0);
    if ($rawTotal <= 0) $rawTotal = vdhToMoney($src['total'] ?? 0, 0);
    if ($rawTotal <= 0) $rawTotal = vdhToMoney($src['orderAmount'] ?? 0, 0);
    $totalAmount = $rawTotal > 0 ? $rawTotal : $computedTotal;

    $customerName = trim((string)($src['customerName'] ?? ($rawAddr['name'] ?? ($rawAddr['fullName'] ?? 'Customer'))));
    $customerEmail = trim((string)($src['customerEmail'] ?? ''));
    $customerPhone = vdhFormatIndianPhone($src['customerPhone'] ?? ($rawAddr['phone'] ?? ''));

    $houseNo = trim((string)($rawAddr['houseNo'] ?? ($rawAddr['houseNumber'] ?? ($rawAddr['flatNo'] ?? ''))));
    $area = trim((string)($rawAddr['area'] ?? ($rawAddr['addressLine2'] ?? '')));
    $combinedStreet = trim((string)($rawAddr['street'] ?? implode(', ', array_filter([$houseNo, $area]))));

    $shipping = [
        'id' => (string)($rawAddr['id'] ?? 'ship_addr'),
        'name' => (string)($rawAddr['name'] ?? ($rawAddr['fullName'] ?? $customerName)),
        'phone' => vdhFormatIndianPhone($rawAddr['phone'] ?? $customerPhone),
        'street' => $combinedStreet,
        'landmark' => trim((string)($rawAddr['landmark'] ?? '')),
        'city' => trim((string)($rawAddr['city'] ?? '')),
        'state' => trim((string)($rawAddr['state'] ?? '')),
        'pincode' => trim((string)($rawAddr['pincode'] ?? ''))
    ];
    if ($houseNo !== '') $shipping['houseNo'] = $houseNo;
    if ($area !== '') $shipping['area'] = $area;

    $rawPay = strtolower(trim((string)($src['paymentStatus'] ?? 'pending')));
    if (($src['isPaid'] ?? false) === true || in_array($rawPay, ['paid', 'success', 'captured', 'completed'], true)) {
        $paymentStatus = 'paid';
    } elseif (in_array($rawPay, ['failed', 'cancelled', 'canceled', 'terminated'], true)) {
        $paymentStatus = 'failed';
    } else {
        $paymentStatus = 'pending';
    }

    $validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    $orderStatus = in_array($src['orderStatus'] ?? '', $validStatuses, true) ? $src['orderStatus'] : 'Pending';
    if ($paymentStatus === 'paid' && $orderStatus === 'Pending') {
        $orderStatus = 'Confirmed';
    }
    if ($paymentStatus === 'failed' && $orderStatus === 'Confirmed') {
        $orderStatus = 'Pending';
    }

    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $orderNumber = (string)($src['orderNumber'] ?? ($src['id'] ?? 'VDH-' . substr((string)time(), -6)));
    $id = (string)($src['id'] ?? 'order_' . vdhSanitizeGatewayOrderId($orderNumber));

    $src['id'] = $id;
    $src['orderNumber'] = $orderNumber;
    $src['gatewayOrderId'] = (string)($src['gatewayOrderId'] ?? vdhSanitizeGatewayOrderId($orderNumber));
    $src['customerName'] = $customerName;
    $src['customerEmail'] = $customerEmail;
    $src['customerPhone'] = $customerPhone;
    $src['shippingAddress'] = $shipping;
    $src['items'] = $items;
    $src['subtotal'] = $subtotal > 0 ? $subtotal : $totalAmount;
    $src['discount'] = $discount;
    $src['deliveryCharge'] = $deliveryCharge;
    $src['total'] = $totalAmount;
    $src['totalAmount'] = $totalAmount;
    $src['paymentMethod'] = (string)($src['paymentMethod'] ?? 'Online Payment');
    $src['paymentStatus'] = $paymentStatus;
    $src['isPaid'] = ($paymentStatus === 'paid');
    $src['currency'] = strtoupper((string)($src['currency'] ?? 'INR'));
    $src['orderStatus'] = $orderStatus;
    $src['upiReference'] = (string)($src['upiReference'] ?? '');
    $src['trackingNumber'] = (string)($src['trackingNumber'] ?? '');
    $src['courierName'] = (string)($src['courierName'] ?? '');
    $src['createdAt'] = (string)($src['createdAt'] ?? $now);
    $src['updatedAt'] = (string)($src['updatedAt'] ?? $now);

    return $src;
}

function vdhReadOrders($dataFile, $apiFile) {
    $map = [];
    foreach ([$apiFile, $dataFile] as $file) {
        if (is_file($file) && is_readable($file)) {
            $raw = file_get_contents($file);
            $decoded = $raw !== false ? json_decode($raw, true) : null;
            if (is_array($decoded)) {
                foreach ($decoded as $item) {
                    if (!is_array($item)) continue;
                    $key = (string)($item['id'] ?? ($item['orderNumber'] ?? ''));
                    if ($key === '') continue;
                    $map[$key] = vdhSanitizeOrder($item, $map[$key] ?? null);
                }
            }
        }
    }
    $list = array_values($map);
    usort($list, function ($a, $b) {
        return strtotime($b['createdAt'] ?? '1970-01-01') <=> strtotime($a['createdAt'] ?? '1970-01-01');
    });
    return $list;
}

function vdhWriteOrders($orders, $dataFile, $apiFile) {
    $json = json_encode(array_values($orders), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    $dir = dirname($dataFile);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $ok1 = file_put_contents($dataFile, $json, LOCK_EX) !== false;
    $ok2 = file_put_contents($apiFile, $json, LOCK_EX) !== false;
    return $ok1 || $ok2;
}

function vdhFindOrder($orders, $needle) {
    $needle = trim((string)$needle);
    if ($needle === '') return [null, -1];
    $safe = vdhSanitizeGatewayOrderId($needle);
    foreach ($orders as $idx => $o) {
        if (
            ($o['id'] ?? '') === $needle ||
            ($o['orderNumber'] ?? '') === $needle ||
            ($o['gatewayOrderId'] ?? '') === $needle ||
            (string)($o['cfOrderId'] ?? '') === $needle ||
            vdhSanitizeGatewayOrderId($o['orderNumber'] ?? '') === $safe
        ) {
            return [$o, $idx];
        }
    }
    return [null, -1];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$action = trim($_GET['action'] ?? '');
$idParam = trim($_GET['id'] ?? '');
if ($idParam === '' && preg_match('#/api/orders/([^/]+)$#', $uriPath, $m)) {
    $idParam = urldecode($m[1]);
}

if ($method === 'GET') {
    $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
    if ($idParam !== '') {
        [$order] = vdhFindOrder($orders, $idParam);
        if ($order) {
            echo json_encode($order, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            exit;
        }
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Order not found']);
        exit;
    }

    $userId = trim($_GET['userId'] ?? '');
    $email = strtolower(trim($_GET['email'] ?? ''));
    $phoneDigits = substr(preg_replace('/\D+/', '', trim($_GET['phone'] ?? '')), -10);
    if ($userId !== '' || $email !== '' || $phoneDigits !== '') {
        $filtered = array_values(array_filter($orders, function ($o) use ($userId, $email, $phoneDigits) {
            if ($userId !== '' && ($o['userId'] ?? '') === $userId) return true;
            if ($email !== '' && strtolower($o['customerEmail'] ?? '') === $email) return true;
            if ($phoneDigits !== '') {
                $ordDigits = substr(preg_replace('/\D+/', '', (string)($o['customerPhone'] ?? ($o['shippingAddress']['phone'] ?? ''))), -10);
                if ($ordDigits !== '' && $ordDigits === $phoneDigits) return true;
            }
            return false;
        }));
        echo json_encode($filtered, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode($orders, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
    $hasAdmin = vdhExtractAdminToken() !== '';

    if (str_contains($uriPath, '/confirm-payment') || $action === 'confirm-payment') {
        if (!$hasAdmin) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Unauthorized: Admin session required.']);
            exit;
        }
        [$target, $idx] = vdhFindOrder($orders, $idParam);
        if (!$target) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            exit;
        }
        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $target['paymentStatus'] = 'paid';
        $target['isPaid'] = true;
        if (!in_array($target['orderStatus'] ?? '', ['Processing', 'Shipped', 'Delivered'], true)) {
            $target['orderStatus'] = 'Confirmed';
        }
        $target['confirmedAt'] = $target['confirmedAt'] ?? $now;
        $target['paidAt'] = $target['paidAt'] ?? $now;
        $target['paymentVerifiedAt'] = $now;
        $target['verifiedVia'] = 'admin_manual';
        $target['updatedAt'] = $now;
        $orders[$idx] = vdhSanitizeOrder($target, $target);
        vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
        echo json_encode(['success' => true, 'order' => $orders[$idx]], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (str_contains($uriPath, '/customer-whatsapp-confirm') || str_contains($uriPath, '/whatsapp-confirm')) {
        [$target, $idx] = vdhFindOrder($orders, $idParam);
        if (!$target) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            exit;
        }
        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $target['whatsappCustomerConfirmed'] = true;
        $target['whatsappCustomerConfirmedAt'] = $now;
        $target['updatedAt'] = $now;
        $orders[$idx] = $target;
        vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
        echo json_encode(['success' => true, 'order' => $target], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!is_array($payload) || (empty($payload['id']) && empty($payload['orderNumber']))) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order payload requires an id or orderNumber.']);
        exit;
    }

    $lookupKey = (string)($payload['id'] ?? $payload['orderNumber']);
    [$existing, $existingIdx] = vdhFindOrder($orders, $lookupKey);

    if (!$hasAdmin) {
        if (($existing['paymentStatus'] ?? '') === 'paid') {
            $payload['paymentStatus'] = 'paid';
            $payload['isPaid'] = true;
            $payload['orderStatus'] = $existing['orderStatus'];
            $payload['paidAt'] = $existing['paidAt'] ?? null;
            $payload['paymentVerifiedAt'] = $existing['paymentVerifiedAt'] ?? null;
            $payload['verifiedVia'] = $existing['verifiedVia'] ?? null;
        } else {
            if (($payload['paymentStatus'] ?? '') === 'paid' || ($payload['isPaid'] ?? false) === true) {
                $payload['paymentStatus'] = $existing['paymentStatus'] ?? 'pending';
                $payload['isPaid'] = false;
            }
            if (($payload['orderStatus'] ?? '') === 'Confirmed' && ($existing['paymentStatus'] ?? '') !== 'paid') {
                $payload['orderStatus'] = $existing['orderStatus'] ?? 'Pending';
            }
        }
    }

    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $payload['createdAt'] = $existing['createdAt'] ?? ($payload['createdAt'] ?? $now);
    $payload['updatedAt'] = $now;
    $saved = vdhSanitizeOrder($payload, $existing);

    if ($existingIdx >= 0) {
        $orders[$existingIdx] = $saved;
    } else {
        array_unshift($orders, $saved);
    }

    if (!vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save order on server.']);
        exit;
    }

    echo json_encode(['success' => true, 'order' => $saved], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'PUT') {
    $rawInput = file_get_contents('php://input');
    $updates = json_decode($rawInput, true);
    if (!is_array($updates) || $idParam === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid update payload or order id.']);
        exit;
    }
    $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
    [$target, $idx] = vdhFindOrder($orders, $idParam);
    if (!$target) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Order not found']);
        exit;
    }

    $hasAdmin = vdhExtractAdminToken() !== '';
    if (!$hasAdmin && ($updates['paymentStatus'] ?? '') === 'paid' && ($target['paymentStatus'] ?? '') !== 'paid') {
        unset($updates['paymentStatus'], $updates['isPaid']);
    }

    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $updates['updatedAt'] = $now;
    if (($updates['paymentStatus'] ?? '') === 'paid' && empty($target['paidAt'])) {
        $updates['paidAt'] = $now;
        $updates['paymentVerifiedAt'] = $now;
        $updates['verifiedVia'] = $target['verifiedVia'] ?? 'admin_manual';
    }

    $next = vdhSanitizeOrder($updates, $target);
    $orders[$idx] = $next;
    vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);
    echo json_encode(['success' => true, 'order' => $next], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
exit;
