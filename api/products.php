<?php
// VIDHYAA Jewellery Studio - Persistent Product Catalog API (Hostinger Production)
require_once __DIR__ . '/admin/_auth.php';

vdhApplyCorsHeaders('GET, POST, PUT, DELETE, OPTIONS', 'Content-Type, Authorization, x-admin-token');
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

    $okData = vdhAtomicWriteFile($dataFile, $json);
    $okApi = vdhAtomicWriteFile($apiFile, $json);
    return $okData || $okApi;
}

function isPreviewOnlyVideoUrl($url) {
    if (!is_string($url)) return false;
    $trimmed = trim($url);
    if (!preg_match('#^https?://#i', $trimmed)) return false;
    $host = strtolower((string)parse_url($trimmed, PHP_URL_HOST));
    if ($host === '') return false;
    if (preg_match('/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$/i', $host)) return true;
    return (bool)preg_match('/(?:^|\.)(?:ais-dev-[a-z0-9-]+\.run\.app|ais-pre-[a-z0-9-]+\.run\.app|run\.app|webcontainer\.io|stackblitz\.io|csb\.app)$/i', $host);
}

function normalizeVideoUrl($url) {
    if (!is_string($url)) return null;
    $trimmed = trim($url);
    if ($trimmed === '') return null;
    if (preg_match('#^https?://(?:www\.)?vidhyaajewellerystudio\.com(/videos/uploads/[^\s?\#]+(?:\?[^\s\#]*)?)$#i', $trimmed, $m)) {
        $trimmed = $m[1];
    }
    if (preg_match('#^(videos/uploads/.*)$#i', $trimmed)) {
        $trimmed = '/' . $trimmed;
    }
    return $trimmed;
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
        vdhSendJson(404, ['success' => false, 'error' => 'Product not found']);
    }

    echo json_encode($products, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    vdhRequireAdmin();

    $rawInput = file_get_contents('php://input');
    $payload = json_decode((string)$rawInput, true);
    if (!is_array($payload)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid JSON product payload.']);
    }

    $incoming = isset($payload['product']) && is_array($payload['product']) ? $payload['product'] : $payload;
    if (empty($incoming['id'])) {
        vdhSendJson(400, ['success' => false, 'error' => 'Product payload requires an id.']);
    }

    $rawVidInput = $incoming['videoUrl'] ?? ($incoming['video'] ?? ($incoming['videoURL'] ?? null));
    if (is_string($rawVidInput) && trim($rawVidInput) !== '' && isPreviewOnlyVideoUrl($rawVidInput)) {
        vdhSendJson(400, [
            'success' => false,
            'error' => 'Preview or localhost video URLs cannot be saved as production video URLs.'
        ]);
    }
    $vid = normalizeVideoUrl($rawVidInput);
    $videoCleared = !empty($incoming['_videoCleared']) && $vid === null;
    if ($vid !== null) {
        $incoming['videoUrl'] = $vid;
        unset($incoming['_videoCleared']);
        if (!isset($incoming['showInShoppingVideos'])) {
            $incoming['showInShoppingVideos'] = true;
        }
    } elseif ($videoCleared) {
        unset($incoming['videoUrl'], $incoming['video'], $incoming['videoURL'], $incoming['_videoCleared']);
        $incoming['showInShoppingVideos'] = false;
    }

    $saved = vdhWithFileLock('products', function () use ($dataProductsFile, $apiProductsFile, $incoming, $vid, $videoCleared) {
        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $products = readProductsCatalog($dataProductsFile, $apiProductsFile);
        $found = false;
        foreach ($products as $idx => $existing) {
            if (($existing['id'] ?? '') === $incoming['id']) {
                $merged = array_merge($existing, $incoming);
                $merged['updatedAt'] = $now;
                if ($videoCleared) {
                    unset($merged['videoUrl'], $merged['video'], $merged['videoURL'], $merged['_videoCleared']);
                } elseif ($vid === null && !array_key_exists('videoUrl', $incoming) && !empty($existing['videoUrl'])) {
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
            return null;
        }
        return $incoming;
    });

    if ($saved === null) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to persist product catalog on server.']);
    }

    vdhSendJson(200, ['success' => true, 'product' => $saved]);
}

if ($method === 'DELETE') {
    vdhRequireAdmin();

    $idParam = trim($_GET['id'] ?? '');
    if ($idParam === '') {
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
        if (preg_match('#/api/products/([^/]+)$#', $uriPath, $m)) {
            $idParam = urldecode($m[1]);
        }
    }

    if ($idParam === '') {
        vdhSendJson(400, ['success' => false, 'error' => 'Product id is required for deletion.']);
    }

    $ok = vdhWithFileLock('products', function () use ($dataProductsFile, $apiProductsFile, $idParam) {
        $products = readProductsCatalog($dataProductsFile, $apiProductsFile);
        $filtered = array_values(array_filter($products, function ($p) use ($idParam) {
            return ($p['id'] ?? '') !== $idParam;
        }));
        return writeProductsCatalog($filtered, $dataProductsFile, $apiProductsFile);
    });

    if (!$ok) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to update product catalog on server.']);
    }

    vdhSendJson(200, ['success' => true]);
}

vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed.']);
