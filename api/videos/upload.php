<?php
// VIDHYAA Jewellery Studio - Persistent Product Video Upload Endpoint (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-file-name, x-file-type, x-admin-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed. Use POST.']);
}

vdhRequireAdmin();

$uploadDir = dirname(__DIR__, 2) . '/videos/uploads';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    vdhSendJson(500, ['success' => false, 'error' => 'Failed to initialize video storage directory.']);
}

$allowedExts = ['mp4', 'mov', 'webm'];
$maxBytes = 250 * 1024 * 1024; // 250 MB

$originalName = '';
$mimeType = 'video/mp4';
$sizeBytes = 0;
$rawData = null;

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    if (!$fileField || ($fileField['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        vdhSendJson(400, ['success' => false, 'error' => 'Video file upload failed or exceeded server upload limit.']);
    }
    $originalName = $fileField['name'] ?: ('vidhyaa_video_' . time() . '.mp4');
    $mimeType = $fileField['type'] ?: 'video/mp4';
    $sizeBytes = (int)($fileField['size'] ?? 0);
} else {
    $rawData = file_get_contents('php://input');
    if ($rawData === false || strlen($rawData) === 0) {
        vdhSendJson(400, ['success' => false, 'error' => 'Empty video file received. Please select a valid MP4, MOV, or WebM video.']);
    }
    $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
    $originalName = $headerName ? urldecode($headerName) : ('vidhyaa_video_' . time() . '.mp4');
    $mimeType = $_SERVER['HTTP_X_FILE_TYPE'] ?? ($_SERVER['CONTENT_TYPE'] ?? 'video/mp4');
    $sizeBytes = strlen($rawData);
}

if ($sizeBytes <= 0 || $sizeBytes > $maxBytes) {
    vdhSendJson(413, ['success' => false, 'error' => 'Video size must be between 1 byte and 250 MB.']);
}

$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExts, true)) {
    if (str_contains(strtolower($mimeType), 'quicktime')) $ext = 'mov';
    elseif (str_contains(strtolower($mimeType), 'webm')) $ext = 'webm';
    else $ext = 'mp4';
}

$baseName = strtolower(pathinfo($originalName, PATHINFO_FILENAME));
$baseName = preg_replace('/[^a-z0-9]+/', '_', $baseName);
$baseName = trim((string)$baseName, '_');
$baseName = substr($baseName ?: 'vidhyaa_jewellery_video', 0, 60);

$finalFileName = $baseName . '_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(2)) . '.' . $ext;
$destPath = $uploadDir . '/' . $finalFileName;

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    if (!move_uploaded_file($fileField['tmp_name'], $destPath)) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to save uploaded video to persistent storage.']);
    }
} else {
    if (file_put_contents($destPath, $rawData) === false) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to write uploaded video to persistent storage.']);
    }
}

$publicUrl = '/videos/uploads/' . $finalFileName;
vdhSendJson(200, [
    'success' => true,
    'url' => $publicUrl,
    'videoUrl' => $publicUrl,
    'fileName' => $finalFileName,
    'originalName' => $originalName,
    'sizeBytes' => $sizeBytes,
    'mimeType' => $mimeType,
    'storageType' => 'server'
]);
