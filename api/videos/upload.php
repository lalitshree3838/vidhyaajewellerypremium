<?php
// VIDHYAA Jewellery Studio - Persistent Product Video Upload Endpoint (Hostinger Production)
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

function vdhDetectVideoMagic(string $bytes): ?array {
    if (strlen($bytes) < 12) return null;
    // WebM / Matroska EBML header: 1A 45 DF A3
    if (substr($bytes, 0, 4) === "\x1A\x45\xDF\xA3") {
        return ['ext' => 'webm', 'mime' => 'video/webm'];
    }
    // MP4 / MOV ISO BMFF box types at bytes 4..7
    $box = substr($bytes, 4, 4);
    if (in_array($box, ['ftyp', 'moov', 'mdat', 'wide', 'free'], true)) {
        $brand = strtolower(substr($bytes, 8, 4));
        if ($box === 'ftyp' && str_starts_with($brand, 'qt')) {
            return ['ext' => 'mov', 'mime' => 'video/quicktime'];
        }
        return ['ext' => 'mp4', 'mime' => 'video/mp4'];
    }
    return null;
}

function vdhBuildFinalVideoFileName(string $originalName, array $videoMagic, array $allowedExts): string {
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        $ext = $videoMagic['ext'];
    } elseif ($videoMagic['ext'] === 'webm') {
        $ext = 'webm';
    } elseif ($ext === 'webm' && $videoMagic['ext'] !== 'webm') {
        $ext = $videoMagic['ext'];
    }
    $baseName = strtolower(pathinfo($originalName, PATHINFO_FILENAME));
    $baseName = preg_replace('/[^a-z0-9]+/', '_', $baseName);
    $baseName = trim((string)$baseName, '_');
    $baseName = substr($baseName ?: 'vidhyaa_jewellery_video', 0, 60);
    return $baseName . '_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(2)) . '.' . $ext;
}

function vdhRemoveDirRecursive(string $dir): void {
    if (!is_dir($dir)) return;
    $items = @scandir($dir);
    if (is_array($items)) {
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                vdhRemoveDirRecursive($path);
            } else {
                @unlink($path);
            }
        }
    }
    @rmdir($dir);
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

$isChunked = (($_GET['chunked'] ?? '') === '1');
if ($isChunked) {
    $uploadId = trim((string)($_GET['uploadId'] ?? ''));
    $chunkIndexRaw = $_GET['chunkIndex'] ?? null;
    $totalChunksRaw = $_GET['totalChunks'] ?? null;
    $queryFileName = trim((string)($_GET['fileName'] ?? ''));

    if (!preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $uploadId)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid chunk upload identifier.']);
    }
    if (!is_numeric($chunkIndexRaw) || !is_numeric($totalChunksRaw)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid chunk index or chunk count.']);
    }
    $chunkIndex = (int)$chunkIndexRaw;
    $totalChunks = (int)$totalChunksRaw;
    if ($totalChunks < 1 || $totalChunks > 200 || $chunkIndex < 0 || $chunkIndex >= $totalChunks) {
        vdhSendJson(400, ['success' => false, 'error' => 'Chunk index out of allowed bounds.']);
    }

    $primaryChunksRoot = rtrim(sys_get_temp_dir(), '/\\') . '/vdh_vid_chunks';
    $chunksRoot = $primaryChunksRoot;
    $chunksReady = false;
    if (vdhIsPathPermittedByOpenBasedir($primaryChunksRoot)) {
        if (is_dir($primaryChunksRoot) || @mkdir($primaryChunksRoot, 0750, true)) {
            if (@is_writable($primaryChunksRoot)) {
                $chunksReady = true;
            }
        }
    }
    if (!$chunksReady && function_exists('vdhTempStateDir')) {
        $fallbackChunksRoot = rtrim(vdhTempStateDir(), '/\\') . '/vdh_vid_chunks';
        if (is_dir($fallbackChunksRoot) || @mkdir($fallbackChunksRoot, 0750, true)) {
            if (@is_writable($fallbackChunksRoot)) {
                $chunksRoot = $fallbackChunksRoot;
                $chunksReady = true;
            }
        }
    }
    if (!$chunksReady) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to initialize temporary chunk storage.']);
    }
    $chunksRootReal = realpath($chunksRoot);
    if ($chunksRootReal === false) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to resolve temporary chunk directory.']);
    }

    // Clean up stale chunk directories older than 30 minutes on chunk 0
    if ($chunkIndex === 0) {
        $cutoff = time() - 1800;
        $entries = @scandir($chunksRootReal);
        if (is_array($entries)) {
            foreach ($entries as $entry) {
                if ($entry === '.' || $entry === '..') continue;
                $candidate = $chunksRootReal . '/' . $entry;
                if (is_dir($candidate) && (@filemtime($candidate) ?: 0) < $cutoff) {
                    vdhRemoveDirRecursive($candidate);
                }
            }
        }
    }

    $chunkDir = $chunksRootReal . '/' . $uploadId;
    if (!is_dir($chunkDir) && !@mkdir($chunkDir, 0750, true)) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to create upload session directory.']);
    }
    $chunkDirReal = realpath($chunkDir);
    if ($chunkDirReal === false || !str_starts_with($chunkDirReal, $chunksRootReal . DIRECTORY_SEPARATOR)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid chunk directory path.']);
    }

    $chunkFilePath = $chunkDirReal . '/chunk_' . str_pad((string)$chunkIndex, 5, '0', STR_PAD_LEFT) . '.part';
    $originalName = $queryFileName;

    if (!empty($_FILES)) {
        $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
        $errCode = (int)($fileField['error'] ?? UPLOAD_ERR_NO_FILE);
        if (!$fileField || $errCode !== UPLOAD_ERR_OK) {
            vdhSendJson(400, ['success' => false, 'error' => "Video chunk upload failed (PHP error code {$errCode})."]);
        }
        if ($originalName === '') {
            $originalName = (string)($fileField['name'] ?: ('vidhyaa_video_' . time() . '.mp4'));
        }
        if ($chunkIndex === 0) {
            $headBytes = (string)@file_get_contents($fileField['tmp_name'], false, null, 0, 32);
            if (vdhDetectVideoMagic($headBytes) === null) {
                vdhRemoveDirRecursive($chunkDirReal);
                vdhSendJson(400, [
                    'success' => false,
                    'error' => 'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.'
                ]);
            }
        }
        if (!move_uploaded_file($fileField['tmp_name'], $chunkFilePath)) {
            vdhSendJson(500, ['success' => false, 'error' => 'Failed to store uploaded video chunk.']);
        }
    } else {
        $chunkRaw = file_get_contents('php://input');
        if ($chunkRaw === false || strlen($chunkRaw) === 0) {
            vdhSendJson(400, ['success' => false, 'error' => 'Empty video chunk received.']);
        }
        if ($originalName === '') {
            $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
            $originalName = $headerName ? urldecode($headerName) : ('vidhyaa_video_' . time() . '.mp4');
        }
        if ($chunkIndex === 0 && vdhDetectVideoMagic(substr($chunkRaw, 0, 32)) === null) {
            vdhRemoveDirRecursive($chunkDirReal);
            vdhSendJson(400, [
                'success' => false,
                'error' => 'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.'
            ]);
        }
        if (file_put_contents($chunkFilePath, $chunkRaw, LOCK_EX) === false) {
            vdhSendJson(500, ['success' => false, 'error' => 'Failed to write uploaded video chunk.']);
        }
    }

    if ($chunkIndex < $totalChunks - 1) {
        vdhSendJson(200, [
            'success' => true,
            'chunked' => true,
            'uploadId' => $uploadId,
            'receivedChunk' => $chunkIndex,
            'totalChunks' => $totalChunks
        ]);
    }

    // Final chunk received: verify all chunks, re-check magic bytes, assemble into persistent storage
    $orderedParts = [];
    $totalBytes = 0;
    for ($i = 0; $i < $totalChunks; $i++) {
        $partPath = $chunkDirReal . '/chunk_' . str_pad((string)$i, 5, '0', STR_PAD_LEFT) . '.part';
        if (!is_file($partPath)) {
            vdhRemoveDirRecursive($chunkDirReal);
            vdhSendJson(400, ['success' => false, 'error' => 'Missing video upload chunk ' . ($i + 1) . " of {$totalChunks}. Please retry upload."]);
        }
        $partSize = (int)(@filesize($partPath) ?: 0);
        $totalBytes += $partSize;
        if ($totalBytes > $appCapBytes) {
            vdhRemoveDirRecursive($chunkDirReal);
            vdhSendJson(413, ['success' => false, 'error' => 'Video size exceeds maximum allowed limit of 250 MB.']);
        }
        $orderedParts[] = $partPath;
    }

    $headBytes = (string)@file_get_contents($orderedParts[0], false, null, 0, 32);
    $finalMagic = vdhDetectVideoMagic($headBytes);
    if ($finalMagic === null) {
        vdhRemoveDirRecursive($chunkDirReal);
        vdhSendJson(400, [
            'success' => false,
            'error' => 'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.'
        ]);
    }

    $finalFileName = vdhBuildFinalVideoFileName($originalName, $finalMagic, $allowedExts);
    $destPath = $uploadDir . '/' . $finalFileName;
    $outHandle = @fopen($destPath, 'wb');
    if ($outHandle === false) {
        vdhRemoveDirRecursive($chunkDirReal);
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to create destination video file.']);
    }

    foreach ($orderedParts as $partPath) {
        $inHandle = @fopen($partPath, 'rb');
        if ($inHandle === false) {
            fclose($outHandle);
            @unlink($destPath);
            vdhRemoveDirRecursive($chunkDirReal);
            vdhSendJson(500, ['success' => false, 'error' => 'Failed to read chunk during video assembly.']);
        }
        stream_copy_to_stream($inHandle, $outHandle);
        fclose($inHandle);
    }
    fclose($outHandle);
    @chmod($destPath, 0644);
    vdhRemoveDirRecursive($chunkDirReal);

    $publicUrl = '/videos/uploads/' . $finalFileName;
    vdhSendJson(200, [
        'success' => true,
        'url' => $publicUrl,
        'videoUrl' => $publicUrl,
        'fileName' => $finalFileName,
        'originalName' => $originalName,
        'sizeBytes' => $totalBytes,
        'mimeType' => $finalMagic['mime'],
        'storageType' => 'server'
    ]);
}

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

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    $headBytes = (string)@file_get_contents($fileField['tmp_name'], false, null, 0, 32);
    $videoMagic = vdhDetectVideoMagic($headBytes);
} else {
    $videoMagic = vdhDetectVideoMagic(substr((string)$rawData, 0, 32));
}

if ($videoMagic === null) {
    vdhSendJson(400, [
        'success' => false,
        'error' => 'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.'
    ]);
}

$mimeType = $videoMagic['mime'];
$finalFileName = vdhBuildFinalVideoFileName($originalName, $videoMagic, $allowedExts);
$destPath = $uploadDir . '/' . $finalFileName;

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    if (!move_uploaded_file($fileField['tmp_name'], $destPath)) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to save uploaded video to persistent storage.']);
    }
} else {
    if (file_put_contents($destPath, $rawData, LOCK_EX) === false) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to write uploaded video to persistent storage.']);
    }
}
@chmod($destPath, 0644);

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
