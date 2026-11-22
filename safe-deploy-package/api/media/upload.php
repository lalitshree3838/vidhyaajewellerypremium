<?php
// VIDHYAA Jewellery Studio - Persistent Product Image Upload Endpoint (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed. Use POST.']);
}

vdhRequireAdmin();

$rootDir = dirname(__DIR__, 2);
$uploadDir = $rootDir . '/products/uploads';
if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true)) {
    vdhSendJson(500, ['success' => false, 'error' => 'Failed to initialize product image upload directory.']);
}

$maxBytes = 10 * 1024 * 1024; // 10 MB per image

function vdhDetectImageMagic(string $bytes): ?array {
    $len = strlen($bytes);
    if ($len < 12) return null;

    // JPEG: FF D8 FF
    if (ord($bytes[0]) === 0xFF && ord($bytes[1]) === 0xD8 && ord($bytes[2]) === 0xFF) {
        return ['ext' => 'jpg', 'mime' => 'image/jpeg'];
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (substr($bytes, 0, 8) === "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A") {
        return ['ext' => 'png', 'mime' => 'image/png'];
    }
    // WebP: RIFF .... WEBP
    if (substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') {
        return ['ext' => 'webp', 'mime' => 'image/webp'];
    }
    // GIF: GIF87a or GIF89a
    $head6 = substr($bytes, 0, 6);
    if ($head6 === 'GIF87a' || $head6 === 'GIF89a') {
        return ['ext' => 'gif', 'mime' => 'image/gif'];
    }
    return null;
}

function vdhSanitizeImagePrefix(string $originalName): string {
    $base = strtolower((string)pathinfo($originalName, PATHINFO_FILENAME));
    $clean = preg_replace('/[^a-z0-9]+/', '_', $base);
    $clean = trim((string)$clean, '_');
    $clean = substr($clean !== '' ? $clean : 'jewellery_image', 0, 48);
    return str_starts_with($clean, 'prod_') ? $clean : ('prod_' . $clean);
}

$uploadedItems = [];

if (!empty($_FILES)) {
    // Support single file or multi-file array inputs (`images[]`, `files[]`, `image`, `file`)
    $rawEntries = [];
    foreach ($_FILES as $field) {
        if (!is_array($field) || !isset($field['name'])) continue;
        if (is_array($field['name'])) {
            $count = count($field['name']);
            for ($i = 0; $i < $count; $i++) {
                $rawEntries[] = [
                    'name' => (string)($field['name'][$i] ?? 'image.jpg'),
                    'tmp_name' => (string)($field['tmp_name'][$i] ?? ''),
                    'error' => (int)($field['error'][$i] ?? UPLOAD_ERR_NO_FILE),
                    'size' => (int)($field['size'][$i] ?? 0),
                ];
            }
        } else {
            $rawEntries[] = [
                'name' => (string)($field['name'] ?? 'image.jpg'),
                'tmp_name' => (string)($field['tmp_name'] ?? ''),
                'error' => (int)($field['error'] ?? UPLOAD_ERR_NO_FILE),
                'size' => (int)($field['size'] ?? 0),
            ];
        }
    }

    if (empty($rawEntries)) {
        vdhSendJson(400, ['success' => false, 'error' => 'No uploaded image files were found.']);
    }

    foreach ($rawEntries as $entry) {
        if ($entry['error'] !== UPLOAD_ERR_OK) {
            if ($entry['error'] === UPLOAD_ERR_INI_SIZE || $entry['error'] === UPLOAD_ERR_FORM_SIZE) {
                vdhSendJson(413, ['success' => false, 'error' => 'Uploaded image exceeds the server size limit (max 10 MB per image).']);
            }
            vdhSendJson(400, ['success' => false, 'error' => "Image upload failed (PHP upload error {$entry['error']})."]);
        }
        if ($entry['size'] <= 0 || $entry['size'] > $maxBytes) {
            vdhSendJson(413, ['success' => false, 'error' => 'Each image must be between 1 byte and 10 MB.']);
        }
        $bytes = @file_get_contents($entry['tmp_name']);
        if ($bytes === false || strlen($bytes) === 0) {
            vdhSendJson(400, ['success' => false, 'error' => 'Unable to read uploaded image data.']);
        }
        $magic = vdhDetectImageMagic($bytes);
        if ($magic === null) {
            vdhSendJson(400, [
                'success' => false,
                'error' => 'Unsupported or invalid image file. Only genuine JPG, PNG, WebP, and GIF images are allowed.'
            ]);
        }
        $fileName = vdhSanitizeImagePrefix($entry['name']) . '_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(3)) . '.' . $magic['ext'];
        $destPath = $uploadDir . '/' . $fileName;
        if (!@move_uploaded_file($entry['tmp_name'], $destPath) && @file_put_contents($destPath, $bytes, LOCK_EX) === false) {
            vdhSendJson(500, ['success' => false, 'error' => 'Failed to save uploaded image to server storage.']);
        }
        @chmod($destPath, 0644);
        $uploadedItems[] = [
            'url' => '/products/uploads/' . $fileName,
            'fileName' => $fileName,
            'originalName' => $entry['name'],
            'sizeBytes' => strlen($bytes),
            'mimeType' => $magic['mime']
        ];
    }
} else {
    $rawData = file_get_contents('php://input');
    if ($rawData === false || strlen($rawData) === 0) {
        vdhSendJson(400, ['success' => false, 'error' => 'Empty image upload payload received.']);
    }
    $sizeBytes = strlen($rawData);
    if ($sizeBytes > $maxBytes) {
        vdhSendJson(413, ['success' => false, 'error' => 'Image payload exceeds 10 MB limit.']);
    }
    $magic = vdhDetectImageMagic($rawData);
    if ($magic === null) {
        vdhSendJson(400, [
            'success' => false,
            'error' => 'Unsupported or invalid image file. Only genuine JPG, PNG, WebP, and GIF images are allowed.'
        ]);
    }
    $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
    $originalName = $headerName !== '' ? urldecode($headerName) : ('jewellery_' . time() . '.' . $magic['ext']);
    $fileName = vdhSanitizeImagePrefix($originalName) . '_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(3)) . '.' . $magic['ext'];
    $destPath = $uploadDir . '/' . $fileName;
    if (@file_put_contents($destPath, $rawData, LOCK_EX) === false) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to write uploaded image to server storage.']);
    }
    @chmod($destPath, 0644);
    $uploadedItems[] = [
        'url' => '/products/uploads/' . $fileName,
        'fileName' => $fileName,
        'originalName' => $originalName,
        'sizeBytes' => $sizeBytes,
        'mimeType' => $magic['mime']
    ];
}

$first = $uploadedItems[0];
vdhSendJson(200, [
    'success' => true,
    'url' => $first['url'],
    'urls' => array_map(static fn ($it) => $it['url'], $uploadedItems),
    'files' => $uploadedItems,
    'fileName' => $first['fileName'],
    'originalName' => $first['originalName'],
    'sizeBytes' => $first['sizeBytes'],
    'mimeType' => $first['mimeType'],
    'storageType' => 'server'
]);
