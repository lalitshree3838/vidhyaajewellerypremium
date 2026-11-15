<?php
// VIDHYAA Jewellery Studio - Persistent Product Catalog API (Hostinger Production)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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
$dataProductsFile = $rootDir . '/data/products.json';
$apiProductsFile = __DIR__ . '/products';

function readProductsCatalog($dataFile, $apiFile) {
    foreach ([$dataFile, $apiFile] as $file) {
        if (is_file($file) && is_readable($file)) {
            $raw = file_get_contents($file);
            if ($raw !== false) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }
    }
    return [];
}

function writeProductsCatalog($products, $dataFile, $apiFile) {
    $json = json_encode(array_values($products), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }

    $dataDir = dirname($dataFile);
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }

    $okData = file_put_contents($dataFile, $json, LOCK_EX) !== false;
    $okApi = file_put_contents($apiFile, $json, LOCK_EX) !== false;
    return $okData || $okApi;
}

function normalizeVideoUrl($url) {
    if (!is_string($url)) return null;
    $trimmed = trim($url);
    if ($trimmed === '') return null;
    if (preg_match('#^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?(/.*)$#i', $trimmed, $m)) {
        $trimmed = $m[1];
    }
    if (preg_match('#^(videos/uploads/.*)$#i', $trimmed)) {
        $trimmed = '/' . $trimmed;
    }
    return $trimmed;
}

function extractAdminToken() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $adminHeader = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if (!empty($adminHeader)) return trim($adminHeader);
    if (str_starts_with($authHeader, 'Bearer ')) {
        return trim(substr($authHeader, 7));
    }
    return '';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $products = readProductsCatalog($dataProductsFile, $apiProductsFile);
    $idParam = trim($_GET['id'] ?? '');
    if ($idParam !== '') {
        foreach ($products as $prod) {
            if (($prod['id'] ?? '') === $idParam) {
                echo json_encode($prod, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Product not found']);
        exit;
    }

    echo json_encode($products, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    $token = extractAdminToken();
    if ($token === '') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Administrator session token required.']);
        exit;
    }

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON product payload.']);
        exit;
    }

    $incoming = isset($payload['product']) && is_array($payload['product']) ? $payload['product'] : $payload;
    if (empty($incoming['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product payload requires an id.']);
        exit;
    }

    $vid = normalizeVideoUrl($incoming['videoUrl'] ?? ($incoming['video'] ?? ($incoming['videoURL'] ?? null)));
    if ($vid !== null) {
        $incoming['videoUrl'] = $vid;
        if (!isset($incoming['showInShoppingVideos'])) {
            $incoming['showInShoppingVideos'] = true;
        }
    }

    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $products = readProductsCatalog($dataProductsFile, $apiProductsFile);
    $found = false;
    foreach ($products as $idx => $existing) {
        if (($existing['id'] ?? '') === $incoming['id']) {
            $merged = array_merge($existing, $incoming);
            $merged['updatedAt'] = $now;
            if ($vid === null && !array_key_exists('videoUrl', $incoming) && !empty($existing['videoUrl'])) {
                $merged['videoUrl'] = $existing['videoUrl'];
            }
            $products[$idx] = $merged;
            $incoming = $merged;
            $found = true;
            break;
        }
    }

    if (!$found) {
        if (empty($incoming['createdAt'])) $incoming['createdAt'] = $now;
        if (empty($incoming['updatedAt'])) $incoming['updatedAt'] = $now;
        array_unshift($products, $incoming);
    }

    if (!writeProductsCatalog($products, $dataProductsFile, $apiProductsFile)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to persist product catalog on server.']);
        exit;
    }

    echo json_encode(['success' => true, 'product' => $incoming], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'DELETE') {
    $token = extractAdminToken();
    if ($token === '') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Administrator session token required.']);
        exit;
    }

    $idParam = trim($_GET['id'] ?? '');
    if ($idParam === '') {
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
        if (preg_match('#/api/products/([^/]+)$#', $uriPath, $m)) {
            $idParam = urldecode($m[1]);
        }
    }

    if ($idParam === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product id is required for deletion.']);
        exit;
    }

    $products = readProductsCatalog($dataProductsFile, $apiProductsFile);
    $filtered = array_values(array_filter($products, function ($p) use ($idParam) {
        return ($p['id'] ?? '') !== $idParam;
    }));

    if (!writeProductsCatalog($filtered, $dataProductsFile, $apiProductsFile)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update product catalog on server.']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
exit;
