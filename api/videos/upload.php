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

function vdhParseIniBytes(string $raw): int {
    $val = trim($raw);
    if ($val === '' || $val === '0' || $val === '-1') return 0;
    $unit = strtolower(substr($val, -1));
    $num = (float)$val;
    switch ($unit) {
        case 'g':
            $num *= 1024;
            // fall through
        case 'm':
            $num *= 1024;
            // fall through
        case 'k':
            $num *= 1024;
            break;
    }
    return max(0, (int)round($num));
}

$allowedExts = ['mp4', 'mov', 'webm'];
$appCapBytes = 250 * 1024 * 1024; // Application upper bound
$iniUploadRaw = (string)(@ini_get('upload_max_filesize') ?: '');
$iniPostRaw = (string)(@ini_get('post_max_size') ?: '');
$iniUploadBytes = vdhParseIniBytes($iniUploadRaw);
$iniPostBytes = vdhParseIniBytes($iniPostRaw);

$effectiveMaxBytes = $appCapBytes;
if ($iniUploadBytes > 0) $effectiveMaxBytes = min($effectiveMaxBytes, $iniUploadBytes);
if ($iniPostBytes > 0) $effectiveMaxBytes = min($effectiveMaxBytes, $iniPostBytes);
$effectiveMaxMb = max(1, (int)floor($effectiveMaxBytes / (1024 * 1024)));

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > $effectiveMaxBytes && empty($_FILES)) {
    vdhSendJson(413, [
        'success' => false,
        'error' => "Video payload ({$contentLength} bytes) exceeds current PHP server upload limit (~{$effectiveMaxMb} MB; upload_max_filesize={$iniUploadRaw}, post_max_size={$iniPostRaw}).",
        'serverMaxUploadBytes' => $effectiveMaxBytes,
        'phpUploadMaxFilesize' => $iniUploadRaw,
        'phpPostMaxSize' => $iniPostRaw
    ]);
}

$originalName = '';
$mimeType = 'video/mp4';
$sizeBytes = 0;
$rawData = null;

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    $errCode = (int)($fileField['error'] ?? UPLOAD_ERR_NO_FILE);
    if (!$fileField || $errCode !== UPLOAD_ERR_OK) {
        if ($errCode === UPLOAD_ERR_INI_SIZE || $errCode === UPLOAD_ERR_FORM_SIZE) {
            vdhSendJson(413, [
                'success' => false,
                'error' => "Uploaded video exceeds current PHP server limit (~{$effectiveMaxMb} MB; upload_max_filesize={$iniUploadRaw}, post_max_size={$iniPostRaw}).",
                'serverMaxUploadBytes' => $effectiveMaxBytes,
                'phpUploadMaxFilesize' => $iniUploadRaw,
                'phpPostMaxSize' => $iniPostRaw
            ]);
        }
        vdhSendJson(400, [
            'success' => false,
            'error' => "Video file upload failed (PHP upload error code {$errCode}). Current server cap: ~{$effectiveMaxMb} MB.",
            'serverMaxUploadBytes' => $effectiveMaxBytes
        ]);
    }
    $originalName = $fileField['name'] ?: ('vidhyaa_video_' . time() . '.mp4');
    $mimeType = $fileField['type'] ?: 'video/mp4';
    $sizeBytes = (int)($fileField['size'] ?? 0);
} else {
    $rawData = file_get_contents('php://input');
    if ($rawData === false || strlen($rawData) === 0) {
        vdhSendJson(400, [
            'success' => false,
            'error' => "Empty video file received (or request exceeded PHP post_max_size={$iniPostRaw}). Please select a valid MP4, MOV, or WebM video under {$effectiveMaxMb} MB.",
            'serverMaxUploadBytes' => $effectiveMaxBytes,
            'phpUploadMaxFilesize' => $iniUploadRaw,
            'phpPostMaxSize' => $iniPostRaw
        ]);
    }
    $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
    $originalName = $headerName ? urldecode($headerName) : ('vidhyaa_video_' . time() . '.mp4');
    $mimeType = $_SERVER['HTTP_X_FILE_TYPE'] ?? ($_SERVER['CONTENT_TYPE'] ?? 'video/mp4');
    $sizeBytes = strlen($rawData);
}

if ($sizeBytes <= 0 || $sizeBytes > $effectiveMaxBytes) {
    vdhSendJson(413, [
        'success' => false,
        'error' => "Video size must be between 1 byte and {$effectiveMaxMb} MB (upload_max_filesize={$iniUploadRaw}, post_max_size={$iniPostRaw}).",
        'serverMaxUploadBytes' => $effectiveMaxBytes,
        'phpUploadMaxFilesize' => $iniUploadRaw,
        'phpPostMaxSize' => $iniPostRaw
    ]);
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
    'storageType' => 'server',
    'serverMaxUploadBytes' => $effectiveMaxBytes,
    'phpUploadMaxFilesize' => $iniUploadRaw,
    'phpPostMaxSize' => $iniPostRaw
]);
