<?php
// VIDHYAA Jewellery Studio - Persistent Product Image Upload Endpoint (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_gateway_auth.php';

vdhApplyCorsHeaders(
    'POST, OPTIONS',
    'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, X-Vidhyaa-Gateway-Auth'
);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed. Use POST.']);
}

$rawBody = empty($_FILES) ? (string)(file_get_contents('php://input') ?: '') : '';
$adminActor = vdhRequireAdminOrProductionGateway('media:upload', $rawBody, '/api/media/upload.php');

$rootDir = dirname(__DIR__, 2);
$uploadDir = $rootDir . '/products/uploads';
if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true)) {
    vdhSendJson(500, ['success' => false, 'error' => 'Failed to initialize product image upload directory.']);
}
$uploadDirReal = realpath($uploadDir);
if ($uploadDirReal === false || !is_writable($uploadDirReal)) {
    vdhSendJson(500, ['success' => false, 'error' => 'Product image upload directory is not writable on Hostinger.']);
}

$maxBytes = 10 * 1024 * 1024; // 10 MB per image

/**
 * Validates binary magic bytes AND actual image structure (JPG/JPEG, PNG, WebP only).
 */
function vdhValidateImagePayload(string $bytes): ?array {
    $len = strlen($bytes);
    if ($len < 12) return null;

    $detected = null;
    // JPEG: FF D8 FF
    if (ord($bytes[0]) === 0xFF && ord($bytes[1]) === 0xD8 && ord($bytes[2]) === 0xFF) {
        $detected = ['ext' => 'jpg', 'mime' => 'image/jpeg', 'type' => IMAGETYPE_JPEG];
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    elseif (substr($bytes, 0, 8) === "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A") {
        $detected = ['ext' => 'png', 'mime' => 'image/png', 'type' => IMAGETYPE_PNG];
    }
    // WebP: RIFF .... WEBP
    elseif (substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') {
        $detected = ['ext' => 'webp', 'mime' => 'image/webp', 'type' => IMAGETYPE_WEBP];
    }

    if ($detected === null) {
        return null;
    }

    // Verify real image structure and dimensions
    if (function_exists('getimagesizefromstring')) {
        $info = @getimagesizefromstring($bytes);
        if (!is_array($info)) {
            return null;
        }
        $width = (int)($info[0] ?? 0);
        $height = (int)($info[1] ?? 0);
        $imgType = (int)($info[2] ?? 0);
        if ($width <= 0 || $height <= 0 || $imgType !== $detected['type']) {
            return null;
        }
        $detected['width'] = $width;
        $detected['height'] = $height;
    }

    return $detected;
}

function vdhSanitizeImagePrefix(string $originalName): string {
    $base = strtolower((string)pathinfo($originalName, PATHINFO_FILENAME));
    $clean = preg_replace('/[^a-z0-9]+/', '_', $base);
    $clean = trim((string)$clean, '_');
    $clean = substr($clean !== '' ? $clean : 'jewellery_image', 0, 48);
    return str_starts_with($clean, 'prod_') ? $clean : ('prod_' . $clean);
}

function vdhStoreAndVerifyImage(
    string $uploadDirReal,
    string $bytes,
    string $originalName,
    array $validated
): array {
    $expectedSize = strlen($bytes);
    $fileName = vdhSanitizeImagePrefix($originalName)
        . '_' . round(microtime(true) * 1000)
        . '_' . bin2hex(random_bytes(4))
        . '.' . $validated['ext'];

    // Strict basename / path confinement check
    if ($fileName !== basename($fileName) || str_contains($fileName, '..')) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid sanitized filename.']);
    }

    $destPath = $uploadDirReal . DIRECTORY_SEPARATOR . $fileName;
    $tmpPath = $destPath . '.tmp_' . getmypid() . '_' . bin2hex(random_bytes(3));
    if (@file_put_contents($tmpPath, $bytes, LOCK_EX) === false) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to write uploaded image to Hostinger storage.']);
    }
    if (!@rename($tmpPath, $destPath)) {
        @unlink($tmpPath);
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to finalize uploaded image in Hostinger storage.']);
    }
    @chmod($destPath, 0644);

    // Physical post-write verification: existence, confinement, readability, exact byte size
    clearstatcache(true, $destPath);
    $destReal = realpath($destPath);
    $actualSize = $destReal !== false ? @filesize($destReal) : false;
    if (
        $destReal === false ||
        !str_starts_with($destReal, $uploadDirReal . DIRECTORY_SEPARATOR) ||
        !is_file($destReal) ||
        !is_readable($destReal) ||
        $actualSize !== $expectedSize
    ) {
        @unlink($destPath);
        vdhSendJson(500, [
            'success' => false,
            'error' => 'Uploaded image failed post-write physical verification on Hostinger.'
        ]);
    }

    $relativeUrl = '/products/uploads/' . $fileName;
    $canonicalUrl = vdhGatewayCanonicalPublicUrl($relativeUrl);

    return [
        'url' => $canonicalUrl,
        'relativeUrl' => $relativeUrl,
        'fileName' => $fileName,
        'originalName' => $originalName,
        'sizeBytes' => $actualSize,
        'mimeType' => $validated['mime'],
        'width' => $validated['width'] ?? null,
        'height' => $validated['height'] ?? null,
        'verifiedOnDisk' => true,
        'storageTarget' => 'hostinger-production',
    ];
}

$uploadedItems = [];

if (!empty($_FILES)) {
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
        $validated = vdhValidateImagePayload($bytes);
        if ($validated === null) {
            vdhSendJson(400, [
                'success' => false,
                'error' => 'Unsupported or invalid image file. Only genuine JPG, PNG, and WebP images are allowed.'
            ]);
        }
        $uploadedItems[] = vdhStoreAndVerifyImage($uploadDirReal, $bytes, $entry['name'], $validated);
    }
} else {
    if ($rawBody === '') {
        vdhSendJson(400, ['success' => false, 'error' => 'Empty image upload payload received.']);
    }
    $sizeBytes = strlen($rawBody);
    if ($sizeBytes > $maxBytes) {
        vdhSendJson(413, ['success' => false, 'error' => 'Image payload exceeds 10 MB limit.']);
    }
    $validated = vdhValidateImagePayload($rawBody);
    if ($validated === null) {
        vdhSendJson(400, [
            'success' => false,
            'error' => 'Unsupported or invalid image file. Only genuine JPG, PNG, and WebP images are allowed.'
        ]);
    }
    $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
    $originalName = $headerName !== '' ? urldecode($headerName) : ('jewellery_' . time() . '.' . $validated['ext']);
    $uploadedItems[] = vdhStoreAndVerifyImage($uploadDirReal, $rawBody, $originalName, $validated);
}

$first = $uploadedItems[0];
vdhSendJson(200, [
    'success' => true,
    'url' => $first['url'],
    'relativeUrl' => $first['relativeUrl'],
    'urls' => array_map(static fn ($it) => $it['url'], $uploadedItems),
    'files' => $uploadedItems,
    'fileName' => $first['fileName'],
    'originalName' => $first['originalName'],
    'sizeBytes' => $first['sizeBytes'],
    'mimeType' => $first['mimeType'],
    'verifiedOnDisk' => true,
    'storageType' => 'server',
    'storageTarget' => 'hostinger-production',
    'authMethod' => $adminActor['authMethod'] ?? 'session',
]);
