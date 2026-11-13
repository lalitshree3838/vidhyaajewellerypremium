<?php
// VIDHYAA Jewellery Studio - Persistent Product Video Upload Endpoint (Hostinger Production)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-file-name, x-file-type, x-admin-token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed. Use POST.'
    ]);
    exit;
}

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$adminHeader = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
$token = trim($adminHeader ?: (str_starts_with($authHeader, 'Bearer ') ? substr($authHeader, 7) : ''));

if (empty($token)) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized: Administrator session token required for video uploads.'
    ]);
    exit;
}

$uploadDir = dirname(__DIR__, 2) . '/videos/uploads';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to initialize video storage directory.'
    ]);
    exit;
}

$allowedExts = ['mp4', 'mov', 'webm'];
$maxBytes = 250 * 1024 * 1024; // 250 MB

$originalName = '';
$mimeType = 'video/mp4';
$sizeBytes = 0;

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    if (!$fileField || ($fileField['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Video file upload failed or exceeded server upload limit.'
        ]);
        exit;
    }
    $originalName = $fileField['name'] ?: ('vidhyaa_video_' . time() . '.mp4');
    $mimeType = $fileField['type'] ?: 'video/mp4';
    $sizeBytes = (int)($fileField['size'] ?? 0);
} else {
    $rawData = file_get_contents('php://input');
    if ($rawData === false || strlen($rawData) === 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Empty video file received. Please select a valid MP4, MOV, or WebM video.'
        ]);
        exit;
    }
    $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
    $originalName = $headerName ? urldecode($headerName) : ('vidhyaa_video_' . time() . '.mp4');
    $mimeType = $_SERVER['HTTP_X_FILE_TYPE'] ?? ($_SERVER['CONTENT_TYPE'] ?? 'video/mp4');
    $sizeBytes = strlen($rawData);
}

if ($sizeBytes <= 0 || $sizeBytes > $maxBytes) {
    http_response_code(413);
    echo json_encode([
        'success' => false,
        'error' => 'Video size must be between 1 byte and 250 MB.'
    ]);
    exit;
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
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to save uploaded video to persistent storage.'
        ]);
        exit;
    }
} else {
    if (file_put_contents($destPath, $rawData) === false) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to write uploaded video to persistent storage.'
        ]);
        exit;
    }
}

$publicUrl = '/videos/uploads/' . $finalFileName;
http_response_code(200);
echo json_encode([
    'success' => true,
    'url' => $publicUrl,
    'videoUrl' => $publicUrl,
    'fileName' => $finalFileName,
    'originalName' => $originalName,
    'sizeBytes' => $sizeBytes,
    'mimeType' => $mimeType,
    'storageType' => 'server'
]);
exit;
