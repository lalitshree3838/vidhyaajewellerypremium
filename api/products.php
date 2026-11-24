<?php
// VIDHYAA Jewellery Studio - Persistent Product Catalog API (Hostinger Production)
require_once __DIR__ . '/admin/_gateway_auth.php';

vdhApplyCorsHeaders(
    'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type, Authorization, x-admin-token, X-Vidhyaa-Gateway-Auth'
);
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

function isPreviewOnlyMediaUrl($url) {
    if (!is_string($url)) return false;
    $trimmed = trim($url);
    if (!preg_match('#^https?://#i', $trimmed)) return false;
    $host = strtolower((string)parse_url($trimmed, PHP_URL_HOST));
    if ($host === '') return false;
    if (preg_match('/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$/i', $host)) return true;
    return (bool)preg_match('/(?:^|\.)(?:ais-dev-[a-z0-9-]+\.run\.app|ais-pre-[a-z0-9-]+\.run\.app|run\.app|webcontainer\.io|stackblitz\.io|csb\.app)$/i', $host);
}

/**
 * Preserves canonical https://vidhyaajewellerystudio.com/videos/uploads/... URLs AND
 * existing relative /videos/uploads/... URLs without rewriting untouched legacy values.
 */
function normalizeVideoUrl($url) {
    if (!is_string($url)) return null;
    $trimmed = trim($url);
    if ($trimmed === '') return null;
    if (preg_match('#^https?://(?:www\.)?vidhyaajewellerystudio\.com(/videos/uploads/[^\s?\#]+(?:\?[^\s\#]*)?)$#i', $trimmed, $m)) {
        return 'https://vidhyaajewellerystudio.com' . $m[1];
    }
    if (preg_match('#^(videos/uploads/.*)$#i', $trimmed)) {
        return '/' . $trimmed;
    }
    return $trimmed;
}

/**
 * Collects all image strings already present on an existing product record so legacy Base64
 * and existing relative URLs remain 100% untouched during delta-only validation.
 */
function collectProductImageSet(?array $prod): array {
    $set = [];
    if (!is_array($prod)) return $set;
    if (isset($prod['images']) && is_array($prod['images'])) {
        foreach ($prod['images'] as $img) {
            if (is_string($img) && trim($img) !== '') {
                $set[trim($img)] = true;
            }
        }
    }
    if (isset($prod['variations']) && is_array($prod['variations'])) {
        foreach ($prod['variations'] as $v) {
            if (!is_array($v)) continue;
            if (is_string($v['image'] ?? null) && trim($v['image']) !== '') {
                $set[trim($v['image'])] = true;
            }
            if (isset($v['additionalImages']) && is_array($v['additionalImages'])) {
                foreach ($v['additionalImages'] as $ai) {
                    if (is_string($ai) && trim($ai) !== '') {
                        $set[trim($ai)] = true;
                    }
                }
            }
        }
    }
    return $set;
}

/**
 * Delta-only validation: preserves untouched legacy Base64 & existing URLs verbatim,
 * while blocking newly introduced Preview/localhost URLs or newly introduced Base64 strings.
 */
function validateIncomingProductMediaDelta(array $incoming, ?array $existing): ?string {
    $existingImages = collectProductImageSet($existing);

    $candidateImages = [];
    if (isset($incoming['images']) && is_array($incoming['images'])) {
        foreach ($incoming['images'] as $img) {
            if (is_string($img) && trim($img) !== '') {
                $candidateImages[] = trim($img);
            }
        }
    }
    if (isset($incoming['variations']) && is_array($incoming['variations'])) {
        foreach ($incoming['variations'] as $v) {
            if (!is_array($v)) continue;
            if (is_string($v['image'] ?? null) && trim($v['image']) !== '') {
                $candidateImages[] = trim($v['image']);
            }
            if (isset($v['additionalImages']) && is_array($v['additionalImages'])) {
                foreach ($v['additionalImages'] as $ai) {
                    if (is_string($ai) && trim($ai) !== '') {
                        $candidateImages[] = trim($ai);
                    }
                }
            }
        }
    }

    foreach ($candidateImages as $imgUrl) {
        // Untouched legacy value already stored on this product — preserve without modification
        if (isset($existingImages[$imgUrl])) {
            continue;
        }
        if (isPreviewOnlyMediaUrl($imgUrl)) {
            return 'Preview or localhost image URLs cannot be saved as production product images.';
        }
        if (str_starts_with(strtolower($imgUrl), 'data:image/')) {
            return 'New product images cannot be saved as inline Base64 data. Upload images to Hostinger production storage first.';
        }
        if (str_starts_with(strtolower($imgUrl), 'blob:')) {
            return 'Temporary browser blob image URLs cannot be saved as production product images.';
        }
    }

    $rawVid = $incoming['videoUrl'] ?? ($incoming['video'] ?? ($incoming['videoURL'] ?? null));
    if (is_string($rawVid) && trim($rawVid) !== '') {
        $existingVid = is_array($existing) ? trim((string)($existing['videoUrl'] ?? '')) : '';
        if (trim($rawVid) !== $existingVid && isPreviewOnlyMediaUrl($rawVid)) {
            return 'Preview or localhost video URLs cannot be saved as production video URLs.';
        }
    }

    return null;
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
    $rawInput = (string)(file_get_contents('php://input') ?: '');
    $adminActor = vdhRequireAdminOrProductionGateway('products:write', $rawInput, '/api/products.php');

    $payload = json_decode($rawInput, true);
    if (!is_array($payload)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid JSON product payload.']);
    }

    $incoming = isset($payload['product']) && is_array($payload['product']) ? $payload['product'] : $payload;
    if (empty($incoming['id'])) {
        vdhSendJson(400, ['success' => false, 'error' => 'Product payload requires an id.']);
    }

    $rawVidInput = $incoming['videoUrl'] ?? ($incoming['video'] ?? ($incoming['videoURL'] ?? null));
    if (is_string($rawVidInput) && trim($rawVidInput) !== '' && isPreviewOnlyMediaUrl($rawVidInput)) {
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

    $saveResult = vdhWithFileLock('products', function () use ($dataProductsFile, $apiProductsFile, $incoming, $vid, $videoCleared) {
        $now = gmdate('Y-m-d\TH:i:s.000\Z');
        $products = readProductsCatalog($dataProductsFile, $apiProductsFile);
        $existingMatch = null;
        $existingIdx = null;
        foreach ($products as $idx => $existing) {
            if (($existing['id'] ?? '') === $incoming['id']) {
                $existingMatch = $existing;
                $existingIdx = $idx;
                break;
            }
        }

        // Delta-only validation preserves all untouched legacy Base64 & existing URLs verbatim
        $deltaError = validateIncomingProductMediaDelta($incoming, $existingMatch);
        if ($deltaError !== null) {
            return ['status' => 400, 'error' => $deltaError];
        }

        if ($existingMatch !== null && $existingIdx !== null) {
            $merged = array_merge($existingMatch, $incoming);
            $merged['id'] = $existingMatch['id'];
            $merged['updatedAt'] = $now;
            if ($videoCleared) {
                unset($merged['videoUrl'], $merged['video'], $merged['videoURL'], $merged['_videoCleared']);
            } elseif ($vid === null && !array_key_exists('videoUrl', $incoming) && !empty($existingMatch['videoUrl'])) {
                $merged['videoUrl'] = $existingMatch['videoUrl'];
            }
            $products[$existingIdx] = $merged;
            $savedTarget = $merged;
        } else {
            if (empty($incoming['createdAt'])) $incoming['createdAt'] = $now;
            $incoming['updatedAt'] = $now;
            array_unshift($products, $incoming);
            $savedTarget = $incoming;
        }

        if (!writeProductsCatalog($products, $dataProductsFile, $apiProductsFile)) {
            return ['status' => 500, 'error' => 'Failed to persist product catalog on Hostinger server.'];
        }

        // Read-back verification from disk before declaring success
        $reloaded = readProductsCatalog($dataProductsFile, $apiProductsFile);
        $verifiedRecord = null;
        foreach ($reloaded as $item) {
            if (($item['id'] ?? '') === $savedTarget['id']) {
                $verifiedRecord = $item;
                break;
            }
        }
        if ($verifiedRecord === null || ($verifiedRecord['updatedAt'] ?? '') !== $savedTarget['updatedAt']) {
            return ['status' => 500, 'error' => 'Product save failed post-write read-back verification on Hostinger.'];
        }

        return ['status' => 200, 'product' => $verifiedRecord];
    });

    if (($saveResult['status'] ?? 500) !== 200) {
        vdhSendJson((int)($saveResult['status'] ?? 500), [
            'success' => false,
            'error' => (string)($saveResult['error'] ?? 'Failed to persist product catalog on server.')
        ]);
    }

    vdhSendJson(200, [
        'success' => true,
        'product' => $saveResult['product'],
        'verifiedReadBack' => true,
        'storageTarget' => 'hostinger-production',
        'authMethod' => $adminActor['authMethod'] ?? 'session',
    ]);
}

if ($method === 'DELETE') {
    // DELETE remains strictly on existing Admin session auth — Production Upload Gateway cannot delete products.
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
