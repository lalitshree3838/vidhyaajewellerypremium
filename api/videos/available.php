<?php
require_once dirname(__DIR__) . '/admin/_auth.php';
vdhApplyCorsHeaders('GET, OPTIONS', 'Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$rootDir = dirname(__DIR__, 2);
$dirs = [
    $rootDir . '/videos/uploads',
    $rootDir . '/dist/videos/uploads'
];

$urls = [];
foreach ($dirs as $dir) {
    if (!is_dir($dir)) continue;
    $entries = @scandir($dir);
    if (!is_array($entries)) continue;
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (!is_file($dir . '/' . $entry)) continue;
        if (preg_match('/\.(mp4|mov|webm|m4v)$/i', $entry)) {
            $url = '/videos/uploads/' . $entry;
            $urls[$url] = true;
        }
    }
}

$list = array_keys($urls);
sort($list);

echo json_encode([
    'success' => true,
    'urls' => $list
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
exit;
