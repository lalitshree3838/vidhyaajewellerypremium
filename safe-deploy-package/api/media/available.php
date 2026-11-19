<?php
// VIDHYAA Jewellery Studio - Available Image Media Inventory Endpoint (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_auth.php';

vdhApplyCorsHeaders('GET, OPTIONS', 'Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed']);
}

$rootDir = dirname(__DIR__, 2);
$imgExtRegex = '/\.(jpg|jpeg|png|webp|gif|avif|svg)$/i';

$scanDirImages = static function (string $dir, string $urlPrefix) use ($imgExtRegex): array {
    $found = [];
    if (!is_dir($dir)) return $found;
    $entries = @scandir($dir);
    if (!is_array($entries)) return $found;
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $full = $dir . '/' . $entry;
        if (!is_file($full)) continue;
        if (preg_match($imgExtRegex, $entry)) {
            $found[$urlPrefix . $entry] = true;
        }
    }
    return $found;
};

$productImagesMap = array_merge(
    $scanDirImages($rootDir . '/products', '/products/'),
    $scanDirImages($rootDir . '/dist/products', '/products/'),
    $scanDirImages($rootDir . '/products/uploads', '/products/uploads/')
);

$categoryImagesMap = array_merge(
    $scanDirImages($rootDir . '/categories', '/categories/'),
    $scanDirImages($rootDir . '/dist/categories', '/categories/')
);

$productImages = array_keys($productImagesMap);
$categoryImages = array_keys($categoryImagesMap);
sort($productImages);
sort($categoryImages);

echo json_encode([
    'success' => true,
    'productImages' => $productImages,
    'categoryImages' => $categoryImages
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
exit;
