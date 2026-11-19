<?php
// VIDHYAA Jewellery Studio - Persistent Orders API (Hostinger Production)
require_once __DIR__ . '/admin/_auth.php';

vdhApplyCorsHeaders('GET, POST, PUT, OPTIONS', 'Content-Type, Authorization, x-admin-token, x-customer-token, x-order-token');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

$rootDir = dirname(__DIR__);
$dataProductsFile = $rootDir . '/data/products.json';
$dataOrdersFile = $rootDir . '/data/orders.json';
$apiOrdersFile = __DIR__ . '/orders';
$whatsappLogsFile = $rootDir . '/data/whatsapp_logs.json';
define('VDH_OWNER_WHATSAPP', '917302187770');

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

function vdhOwnerWhatsAppUrl(array $order): string {
    $orderId = (string)($order['orderNumber'] ?? ($order['id'] ?? 'N/A'));
    $customerName = (string)($order['customerName'] ?? ($order['shippingAddress']['name'] ?? 'Valued Patron'));
    $customerMobile = (string)($order['customerPhone'] ?? ($order['shippingAddress']['phone'] ?? 'N/A'));
    $items = is_array($order['items'] ?? null) ? $order['items'] : [];
    $productName = 'Handcrafted Jewellery';
    $quantity = 1;
    if (!empty($items)) {
        $names = array_map(fn($it) => (string)($it['productName'] ?? 'Piece'), $items);
        $productName = implode(', ', $names);
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

    return 'https://wa.me/' . VDH_OWNER_WHATSAPP . '?text=' . rawurlencode($msg);
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
    if (!empty($src['appliedPromo'])) {
        $src['appliedPromo'] = strtoupper(trim((string)$src['appliedPromo']));
    }
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
    $ok1 = vdhAtomicWriteFile($dataFile, $json);
    $ok2 = vdhAtomicWriteFile($apiFile, $json);
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

function vdhSaveWhatsAppLog($logFile, array $entry): void {
    $logs = [];
    if (is_file($logFile) && is_readable($logFile)) {
        $parsed = json_decode((string)@file_get_contents($logFile), true);
        if (is_array($parsed)) $logs = $parsed;
    }
    array_unshift($logs, $entry);
    if (count($logs) > 100) $logs = array_slice($logs, 0, 100);
    $encoded = json_encode($logs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($encoded !== false) {
        vdhAtomicWriteFile($logFile, $encoded);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$action = trim((string)($_GET['action'] ?? ''));
$idParam = trim((string)($_GET['id'] ?? ''));
if ($idParam === '' && preg_match('#/api/orders/([^/]+)$#', $uriPath, $m)) {
    $idParam = urldecode($m[1]);
}

if ($method === 'GET') {
    $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);

    if ($idParam !== '') {
        [$order] = vdhFindOrder($orders, $idParam);
        if (!$order) {
            vdhSendJson(404, ['success' => false, 'error' => 'Order not found']);
        }

        $admin = vdhAuthenticateAdmin();
        if ($admin) {
            vdhSendJson(200, $order);
        }

        $customer = vdhAuthenticateCustomer();
        if ($customer && vdhCustomerOwnsOrder($customer, $order)) {
            vdhSendJson(200, $order);
        }

        $receiptTok = vdhExtractOrderReceiptToken();
        if (vdhHasValidOrderReceiptToken($order, $receiptTok)) {
            vdhSendJson(200, $order);
        }

        // Public tracking lookup strips all PII
        vdhSendJson(200, vdhSanitizePublicOrderTracking($order));
    }

    $userId = trim((string)($_GET['userId'] ?? ''));
    $email = strtolower(trim((string)($_GET['email'] ?? '')));
    $phoneDigits = vdhNormalizePhone10((string)($_GET['phone'] ?? ''));

    if ($userId !== '' || $email !== '' || $phoneDigits !== '') {
        $customer = vdhAuthenticateCustomer();
        if (!$customer) {
            vdhSendJson(401, [
                'success' => false,
                'error' => 'Unauthorized: Customer sign-in is required to view account orders.'
            ]);
        }

        if (empty($customer['isAdmin'])) {
            $cUid = trim((string)($customer['uid'] ?? ''));
            $cEmail = strtolower(trim((string)($customer['email'] ?? '')));
            $cPhone = vdhNormalizePhone10((string)($customer['phone10'] ?? ''));

            if ($userId !== '' && ($cUid === '' || !hash_equals($cUid, $userId))) {
                vdhSendJson(403, ['success' => false, 'error' => 'Forbidden: Cannot access orders of another userId.']);
            }
            if ($email !== '' && !str_ends_with($email, '@phone.vidhyaajewellery.com') && ($cEmail === '' || !hash_equals($cEmail, $email))) {
                vdhSendJson(403, ['success' => false, 'error' => 'Forbidden: Cannot access orders of another email address.']);
            }
            if ($phoneDigits !== '' && ($cPhone === '' || !hash_equals($cPhone, $phoneDigits))) {
                vdhSendJson(403, ['success' => false, 'error' => 'Forbidden: Cannot access orders of another phone number.']);
            }

            $matched = array_values(array_filter($orders, fn($o) => vdhCustomerOwnsOrder($customer, $o)));
            echo json_encode($matched, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            exit;
        }

        $filtered = array_values(array_filter($orders, function ($o) use ($userId, $email, $phoneDigits) {
            if ($userId !== '' && ($o['userId'] ?? '') === $userId) return true;
            if ($email !== '' && strtolower($o['customerEmail'] ?? '') === $email) return true;
            if ($phoneDigits !== '') {
                $ordDigits = vdhNormalizePhone10((string)($o['customerPhone'] ?? ($o['shippingAddress']['phone'] ?? '')));
                if ($ordDigits !== '' && $ordDigits === $phoneDigits) return true;
            }
            return false;
        }));
        echo json_encode($filtered, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Full un-filtered orders list requires verified admin session
    vdhRequireAdmin();
    echo json_encode($orders, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode((string)$rawInput, true);

    if (str_contains($uriPath, '/confirm-payment') || $action === 'confirm-payment') {
        vdhRequireAdmin();
        if ($idParam === '' && preg_match('#/api/orders/([^/]+)/confirm-payment#', $uriPath, $m)) {
            $idParam = urldecode($m[1]);
        }

        $res = vdhWithFileLock('orders', function () use ($dataOrdersFile, $apiOrdersFile, $idParam) {
            $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
            [$target, $idx] = vdhFindOrder($orders, $idParam);
            if (!$target) {
                return ['status' => 404, 'body' => ['success' => false, 'error' => 'Order not found']];
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
            $sanitized = vdhSanitizeOrder($target, $target);
            $sanitized['whatsappClickToChatUrl'] = vdhOwnerWhatsAppUrl($sanitized);
            $orders[$idx] = $sanitized;
            if (!vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile)) {
                return ['status' => 500, 'body' => ['success' => false, 'error' => 'Failed to persist confirmation.']];
            }
            return ['status' => 200, 'body' => ['success' => true, 'order' => $sanitized]];
        });

        vdhSendJson($res['status'], $res['body']);
    }

    if (
        str_contains($uriPath, '/customer-whatsapp-confirm') ||
        str_contains($uriPath, '/whatsapp-confirm') ||
        $action === 'customer-whatsapp-confirm' ||
        $action === 'whatsapp-confirm'
    ) {
        if ($idParam === '' && preg_match('#/api/orders/([^/]+)/(?:customer-)?whatsapp-confirm#', $uriPath, $m)) {
            $idParam = urldecode($m[1]);
        }

        $res = vdhWithFileLock('orders', function () use ($dataOrdersFile, $apiOrdersFile, $whatsappLogsFile, $idParam) {
            $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
            [$target, $idx] = vdhFindOrder($orders, $idParam);
            if (!$target) {
                return ['status' => 404, 'body' => ['success' => false, 'error' => 'Order not found']];
            }

            $admin = vdhAuthenticateAdmin();
            $customer = vdhAuthenticateCustomer();
            $receiptTok = vdhExtractOrderReceiptToken();
            $authorized = (bool)$admin
                || ($customer && vdhCustomerOwnsOrder($customer, $target))
                || vdhHasValidOrderReceiptToken($target, $receiptTok);

            if (!$authorized) {
                return ['status' => 403, 'body' => ['success' => false, 'error' => 'Forbidden: Valid order token or owner authentication required.']];
            }

            if (!empty($target['whatsappCustomerConfirmed'])) {
                return ['status' => 200, 'body' => ['success' => true, 'alreadyConfirmed' => true, 'order' => $target]];
            }

            $now = gmdate('Y-m-d\TH:i:s.000\Z');
            $target['whatsappCustomerConfirmed'] = true;
            $target['whatsappCustomerConfirmedAt'] = $now;
            $target['updatedAt'] = $now;
            $orders[$idx] = $target;

            vdhSaveWhatsAppLog($whatsappLogsFile, [
                'orderId' => $target['orderNumber'] ?? $target['id'],
                'recipient' => '+' . VDH_OWNER_WHATSAPP,
                'timestamp' => $now,
                'type' => 'CUSTOMER_WHATSAPP_CONFIRMATION',
                'status' => 'CONFIRMED_BY_CUSTOMER',
                'customerName' => $target['customerName'] ?? '',
                'customerPhone' => $target['customerPhone'] ?? ''
            ]);
            vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile);

            return ['status' => 200, 'body' => ['success' => true, 'order' => $target]];
        });

        vdhSendJson($res['status'], $res['body']);
    }

    if (!is_array($payload) || (empty($payload['id']) && empty($payload['orderNumber']))) {
        vdhSendJson(400, ['success' => false, 'error' => 'Order payload requires an id or orderNumber.']);
    }

    $admin = vdhAuthenticateAdmin();
    $customer = vdhAuthenticateCustomer();
    $receiptTok = vdhExtractOrderReceiptToken();
    $lookupKey = (string)($payload['id'] ?? $payload['orderNumber']);

    $res = vdhWithFileLock('orders', function () use ($dataOrdersFile, $apiOrdersFile, $dataProductsFile, $payload, $lookupKey, $admin, $customer, $receiptTok) {
        $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
        [$existing, $existingIdx] = vdhFindOrder($orders, $lookupKey);

        if ($existing && !$admin) {
            $canUpdateExisting = ($customer && vdhCustomerOwnsOrder($customer, $existing)) || vdhHasValidOrderReceiptToken($existing, $receiptTok);
            if (!$canUpdateExisting) {
                return ['status' => 403, 'body' => ['success' => false, 'error' => 'Order ID already exists. Cannot overwrite existing order without authorization.']];
            }
        }

        if (!$existing || (!empty($payload['items']) && is_array($payload['items']))) {
            $pricing = vdhValidateAndComputeOrderPricing($payload, $dataProductsFile, (bool)$admin);
            if (empty($pricing['valid'])) {
                return ['status' => 400, 'body' => [
                    'success' => false,
                    'code' => $pricing['code'] ?? 'INVALID_ORDER_PRICING',
                    'error' => $pricing['error'] ?? 'Order pricing verification failed.'
                ]];
            }
            $payload['subtotal'] = $pricing['subtotal'];
            $payload['discount'] = $pricing['discount'];
            $payload['deliveryCharge'] = $pricing['deliveryCharge'];
            $payload['total'] = $pricing['totalAmount'];
            $payload['totalAmount'] = $pricing['totalAmount'];
            if (!empty($pricing['appliedPromo'])) {
                $payload['appliedPromo'] = $pricing['appliedPromo'];
            }
        }

        if (!$admin) {
            unset(
                $payload['verifiedVia'],
                $payload['paidAt'],
                $payload['paymentVerifiedAt'],
                $payload['verifiedAmount'],
                $payload['paymentId'],
                $payload['cfOrderId'],
                $payload['webhookEventIds'],
                $payload['whatsappClickToChatUrl'],
                $payload['paymentEnv'],
                $payload['isTestOrder']
            );
            if ($customer && !empty($customer['uid'])) {
                $payload['userId'] = (string)$customer['uid'];
            } elseif (!empty($existing['userId'])) {
                $payload['userId'] = (string)$existing['userId'];
            } else {
                unset($payload['userId']);
            }
            if (($existing['paymentStatus'] ?? '') === 'paid') {
                $payload['paymentStatus'] = 'paid';
                $payload['isPaid'] = true;
                $payload['orderStatus'] = $existing['orderStatus'];
            } else {
                $payload['paymentStatus'] = $existing['paymentStatus'] ?? 'pending';
                $payload['isPaid'] = false;
                if (($payload['orderStatus'] ?? '') === 'Confirmed') {
                    $payload['orderStatus'] = $existing['orderStatus'] ?? 'Pending';
                }
            }
        }

        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $payload['createdAt'] = $existing['createdAt'] ?? ($payload['createdAt'] ?? $now);
        $payload['updatedAt'] = $now;
        $saved = vdhSanitizeOrder($payload, $existing);

        if (($saved['paymentStatus'] ?? '') === 'paid') {
            $saved['whatsappClickToChatUrl'] = vdhOwnerWhatsAppUrl($saved);
        }

        if ($existingIdx >= 0) {
            $orders[$existingIdx] = $saved;
        } else {
            array_unshift($orders, $saved);
        }

        if (!vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile)) {
            return ['status' => 500, 'body' => ['success' => false, 'error' => 'Failed to save order on server.']];
        }

        return ['status' => 200, 'body' => [
            'success' => true,
            'order' => $saved,
            'receiptToken' => vdhOrderReceiptToken($saved)
        ]];
    });

    vdhSendJson($res['status'], $res['body']);
}

if ($method === 'PUT') {
    vdhRequireAdmin();

    $rawInput = file_get_contents('php://input');
    $updates = json_decode((string)$rawInput, true);
    if (!is_array($updates) || $idParam === '') {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid update payload or order id.']);
    }

    $res = vdhWithFileLock('orders', function () use ($dataOrdersFile, $apiOrdersFile, $updates, $idParam) {
        $orders = vdhReadOrders($dataOrdersFile, $apiOrdersFile);
        [$target, $idx] = vdhFindOrder($orders, $idParam);
        if (!$target) {
            return ['status' => 404, 'body' => ['success' => false, 'error' => 'Order not found']];
        }

        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $updates['updatedAt'] = $now;
        if (($updates['paymentStatus'] ?? '') === 'paid' && empty($target['paidAt'])) {
            $updates['paidAt'] = $now;
            $updates['paymentVerifiedAt'] = $now;
            $updates['verifiedVia'] = $target['verifiedVia'] ?? 'admin_manual';
        }

        $next = vdhSanitizeOrder($updates, $target);
        if (($next['paymentStatus'] ?? '') === 'paid') {
            $next['whatsappClickToChatUrl'] = vdhOwnerWhatsAppUrl($next);
        }
        $orders[$idx] = $next;
        if (!vdhWriteOrders($orders, $dataOrdersFile, $apiOrdersFile)) {
            return ['status' => 500, 'body' => ['success' => false, 'error' => 'Failed to save order update.']];
        }
        return ['status' => 200, 'body' => ['success' => true, 'order' => $next]];
    });

    vdhSendJson($res['status'], $res['body']);
}

vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed']);
