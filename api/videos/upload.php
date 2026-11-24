<?php
// VIDHYAA Jewellery Studio - Persistent Product Video Upload Endpoint (Hostinger Production)
@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
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
    vdhSendJson(405, [
        'success' => false,
        'uploadId' => '',
        'chunkIndex' => 0,
        'totalChunks' => 0,
        'completed' => false,
        'videoUrl' => null,
        'error' => 'Method not allowed. Use POST.',
        'message' => 'Method not allowed. Use POST.'
    ]);
}

function vdhVideoErrorResponse(
    int $status,
    string $message,
    string $uploadId = '',
    int $chunkIndex = 0,
    int $totalChunks = 0,
    array $extra = []
): array {
    return array_merge([
        'success' => false,
        'uploadId' => $uploadId,
        'chunkIndex' => $chunkIndex,
        'totalChunks' => $totalChunks,
        'completed' => false,
        'videoUrl' => null,
        'error' => $message,
        'message' => $message,
    ], $extra);
}

$rawBody = empty($_FILES) ? (string)(file_get_contents('php://input') ?: '') : '';
$adminActor = vdhRequireAdminOrProductionGateway('video:upload', $rawBody, '/api/videos/upload.php');
$actorEmail = strtolower(trim((string)($adminActor['email'] ?? 'admin')));

$uploadDir = dirname(__DIR__, 2) . '/videos/uploads';
if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true)) {
    vdhSendJson(500, ['success' => false, 'error' => 'Failed to initialize video storage directory.']);
}
$uploadDirReal = realpath($uploadDir);
if ($uploadDirReal === false || !is_writable($uploadDirReal)) {
    vdhSendJson(500, ['success' => false, 'error' => 'Video storage directory is not writable on Hostinger.']);
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
    return $baseName . '_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
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
$appCapBytes = 250 * 1024 * 1024; // 250 MB application upper bound
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
        vdhSendJson(400, vdhVideoErrorResponse(400, 'Invalid chunk upload identifier.', $uploadId, 0, 0));
    }
    if (!is_numeric($chunkIndexRaw) || !is_numeric($totalChunksRaw)) {
        vdhSendJson(400, vdhVideoErrorResponse(400, 'Invalid chunk index or chunk count.', $uploadId, 0, 0));
    }
    $chunkIndex = (int)$chunkIndexRaw;
    $totalChunks = (int)$totalChunksRaw;
    if ($totalChunks < 1 || $totalChunks > 200 || $chunkIndex < 0 || $chunkIndex >= $totalChunks) {
        vdhSendJson(400, vdhVideoErrorResponse(400, 'Chunk index out of allowed bounds.', $uploadId, $chunkIndex, $totalChunks));
    }

    $primaryChunksRoot = rtrim(sys_get_temp_dir(), '/\\') . '/vdh_vid_chunks';
    $chunksRoot = $primaryChunksRoot;
    $chunksReady = false;
    if (vdhIsPathPermittedByOpenBasedir($primaryChunksRoot)) {
        if (is_dir($primaryChunksRoot) || @mkdir($primaryChunksRoot, 0700, true)) {
            if (@is_writable($primaryChunksRoot)) {
                $chunksReady = true;
            }
        }
    }
    if (!$chunksReady && function_exists('vdhTempStateDir')) {
        $fallbackChunksRoot = rtrim(vdhTempStateDir(), '/\\') . '/vdh_vid_chunks';
        if (is_dir($fallbackChunksRoot) || @mkdir($fallbackChunksRoot, 0700, true)) {
            if (@is_writable($fallbackChunksRoot)) {
                $chunksRoot = $fallbackChunksRoot;
                $chunksReady = true;
            }
        }
    }
    if (!$chunksReady) {
        vdhSendJson(500, vdhVideoErrorResponse(500, 'Failed to initialize temporary chunk storage.', $uploadId, $chunkIndex, $totalChunks));
    }
    $chunksRootReal = realpath($chunksRoot);
    if ($chunksRootReal === false) {
        vdhSendJson(500, vdhVideoErrorResponse(500, 'Failed to resolve temporary chunk directory.', $uploadId, $chunkIndex, $totalChunks));
    }

    // Duplicate-safe idempotency check: if this uploadId already finalized earlier (e.g. client retried final chunk
    // after a dropped response), return the exact previously verified production URL without creating a duplicate file.
    $doneMarkerPath = $chunksRootReal . '/done_' . $uploadId . '.json';
    if ($chunkIndex === $totalChunks - 1 && is_file($doneMarkerPath)) {
        $doneInfo = json_decode((string)@file_get_contents($doneMarkerPath), true);
        if (
            is_array($doneInfo) &&
            strtolower((string)($doneInfo['actor'] ?? '')) === $actorEmail &&
            !empty($doneInfo['fileName'])
        ) {
            $existingPath = $uploadDirReal . DIRECTORY_SEPARATOR . basename((string)$doneInfo['fileName']);
            if (is_file($existingPath) && is_readable($existingPath)) {
                $resp = $doneInfo['response'] ?? null;
                if (is_array($resp)) {
                    $resp['uploadId'] = $uploadId;
                    $resp['chunkIndex'] = $chunkIndex;
                    $resp['totalChunks'] = $totalChunks;
                    $resp['completed'] = true;
                    $resp['videoUrl'] = $resp['videoUrl'] ?? ($resp['url'] ?? null);
                    $resp['error'] = null;
                    $resp['message'] = 'Video already finalized on Hostinger Production (idempotent replay).';
                    $resp['idempotentReplay'] = true;
                    vdhSendJson(200, $resp);
                }
            }
        }
    }

    // Clean up stale chunk directories (> 45 min) and old completion markers (> 2 hours) on chunk 0
    if ($chunkIndex === 0) {
        $staleDirCutoff = time() - 2700;
        $staleDoneCutoff = time() - 7200;
        $entries = @scandir($chunksRootReal);
        if (is_array($entries)) {
            foreach ($entries as $entry) {
                if ($entry === '.' || $entry === '..') continue;
                $candidate = $chunksRootReal . '/' . $entry;
                if (is_dir($candidate) && (@filemtime($candidate) ?: 0) < $staleDirCutoff) {
                    vdhRemoveDirRecursive($candidate);
                } elseif (str_starts_with($entry, 'done_') && str_ends_with($entry, '.json') && (@filemtime($candidate) ?: 0) < $staleDoneCutoff) {
                    @unlink($candidate);
                }
            }
        }
    }

    $chunkDir = $chunksRootReal . '/' . $uploadId;
    if (!is_dir($chunkDir) && !@mkdir($chunkDir, 0700, true)) {
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to create upload session directory.']);
    }
    $chunkDirReal = realpath($chunkDir);
    if ($chunkDirReal === false || !str_starts_with($chunkDirReal, $chunksRootReal . DIRECTORY_SEPARATOR)) {
        vdhSendJson(400, ['success' => false, 'error' => 'Invalid chunk directory path.']);
    }

    $originalName = $queryFileName;
    if ($originalName === '') {
        if (!empty($_FILES)) {
            $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
            $originalName = (string)($fileField['name'] ?? '');
        } else {
            $headerName = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
            $originalName = $headerName ? urldecode($headerName) : '';
        }
    }
    if ($originalName === '') {
        $originalName = 'vidhyaa_video_' . time() . '.mp4';
    }

    // Bind uploadId session strictly to authenticated actor + totalChunks + originalName
    $metaCheck = vdhWithFileLock('vid_upload_' . $uploadId, function () use (
        $chunkDirReal,
        $actorEmail,
        $totalChunks,
        $originalName,
        $adminActor
    ) {
        $metaPath = $chunkDirReal . '/.meta.json';
        if (is_file($metaPath)) {
            $existingMeta = json_decode((string)@file_get_contents($metaPath), true);
            if (!is_array($existingMeta)) {
                return ['ok' => false, 'status' => 400, 'error' => 'Corrupted upload session metadata.'];
            }
            if (strtolower((string)($existingMeta['actor'] ?? '')) !== $actorEmail) {
                return ['ok' => false, 'status' => 403, 'error' => 'Upload session is bound to a different administrator.'];
            }
            if ((int)($existingMeta['totalChunks'] ?? 0) !== $totalChunks) {
                return ['ok' => false, 'status' => 400, 'error' => 'Chunk count does not match initialized upload session.'];
            }
            if (!empty($existingMeta['originalName']) && $existingMeta['originalName'] !== $originalName) {
                return ['ok' => false, 'status' => 400, 'error' => 'Filename does not match initialized upload session.'];
            }
            return ['ok' => true, 'meta' => $existingMeta];
        }

        $newMeta = [
            'actor' => $actorEmail,
            'authMethod' => (string)($adminActor['authMethod'] ?? 'session'),
            'totalChunks' => $totalChunks,
            'originalName' => $originalName,
            'createdAt' => time(),
        ];
        vdhAtomicWriteFile($metaPath, (string)json_encode($newMeta));
        @chmod($metaPath, 0600);
        return ['ok' => true, 'meta' => $newMeta];
    });

    if (!$metaCheck['ok']) {
        $errStatus = (int)($metaCheck['status'] ?? 403);
        vdhSendJson($errStatus, vdhVideoErrorResponse(
            $errStatus,
            (string)($metaCheck['error'] ?? 'Upload session mismatch.'),
            $uploadId,
            $chunkIndex,
            $totalChunks
        ));
    }

    $chunkFilePath = $chunkDirReal . '/chunk_' . str_pad((string)$chunkIndex, 5, '0', STR_PAD_LEFT) . '.part';
    $chunkTmpPath = $chunkFilePath . '.tmp_' . getmypid() . '_' . bin2hex(random_bytes(3));

    if (!empty($_FILES)) {
        $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
        $errCode = (int)($fileField['error'] ?? UPLOAD_ERR_NO_FILE);
        if (!$fileField || $errCode !== UPLOAD_ERR_OK) {
            vdhSendJson(400, vdhVideoErrorResponse(400, "Video chunk upload failed (PHP error code {$errCode}).", $uploadId, $chunkIndex, $totalChunks));
        }
        if ($chunkIndex === 0) {
            $headBytes = (string)@file_get_contents($fileField['tmp_name'], false, null, 0, 32);
            if (vdhDetectVideoMagic($headBytes) === null) {
                vdhRemoveDirRecursive($chunkDirReal);
                vdhSendJson(400, vdhVideoErrorResponse(
                    400,
                    'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.',
                    $uploadId,
                    $chunkIndex,
                    $totalChunks
                ));
            }
        }
        if (!move_uploaded_file($fileField['tmp_name'], $chunkTmpPath) || !@rename($chunkTmpPath, $chunkFilePath)) {
            @unlink($chunkTmpPath);
            vdhSendJson(500, vdhVideoErrorResponse(500, 'Failed to store uploaded video chunk.', $uploadId, $chunkIndex, $totalChunks));
        }
    } else {
        if ($rawBody === '') {
            vdhSendJson(400, vdhVideoErrorResponse(400, 'Empty video chunk received.', $uploadId, $chunkIndex, $totalChunks));
        }
        if ($chunkIndex === 0 && vdhDetectVideoMagic(substr($rawBody, 0, 32)) === null) {
            vdhRemoveDirRecursive($chunkDirReal);
            vdhSendJson(400, vdhVideoErrorResponse(
                400,
                'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.',
                $uploadId,
                $chunkIndex,
                $totalChunks
            ));
        }
        if (@file_put_contents($chunkTmpPath, $rawBody, LOCK_EX) === false || !@rename($chunkTmpPath, $chunkFilePath)) {
            @unlink($chunkTmpPath);
            vdhSendJson(500, vdhVideoErrorResponse(500, 'Failed to write uploaded video chunk.', $uploadId, $chunkIndex, $totalChunks));
        }
    }

    // Refresh directory mtime so long 250 MB uploads never get pruned mid-transfer
    @touch($chunkDirReal);

    if ($chunkIndex < $totalChunks - 1) {
        vdhSendJson(200, [
            'success' => true,
            'chunked' => true,
            'uploadId' => $uploadId,
            'chunkIndex' => $chunkIndex,
            'receivedChunk' => $chunkIndex,
            'totalChunks' => $totalChunks,
            'completed' => false,
            'videoUrl' => null,
            'error' => null,
            'message' => 'Chunk ' . ($chunkIndex + 1) . ' of ' . $totalChunks . ' stored on Hostinger Production.'
        ]);
    }

    // Final chunk received: lock finalization to guarantee duplicate-safe assembly
    $finalResult = vdhWithFileLock('vid_finalize_' . $uploadId, function () use (
        $uploadId,
        $chunkIndex,
        $doneMarkerPath,
        $actorEmail,
        $uploadDirReal,
        $chunkDirReal,
        $totalChunks,
        $appCapBytes,
        $originalName,
        $allowedExts,
        $adminActor
    ) {
        // Re-check idempotency marker inside exclusive lock
        if (is_file($doneMarkerPath)) {
            $doneInfo = json_decode((string)@file_get_contents($doneMarkerPath), true);
            if (
                is_array($doneInfo) &&
                strtolower((string)($doneInfo['actor'] ?? '')) === $actorEmail &&
                !empty($doneInfo['fileName'])
            ) {
                $existingPath = $uploadDirReal . DIRECTORY_SEPARATOR . basename((string)$doneInfo['fileName']);
                if (is_file($existingPath) && is_readable($existingPath) && is_array($doneInfo['response'] ?? null)) {
                    $resp = $doneInfo['response'];
                    $resp['uploadId'] = $uploadId;
                    $resp['chunkIndex'] = $chunkIndex;
                    $resp['totalChunks'] = $totalChunks;
                    $resp['completed'] = true;
                    $resp['videoUrl'] = $resp['videoUrl'] ?? ($resp['url'] ?? null);
                    $resp['error'] = null;
                    $resp['message'] = 'Video already finalized on Hostinger Production (idempotent replay).';
                    $resp['idempotentReplay'] = true;
                    return ['status' => 200, 'body' => $resp];
                }
            }
        }

        // Verify all chunks exist; if any are missing, preserve uploaded chunks and return HTTP 409 for targeted retry
        $orderedParts = [];
        $missingChunks = [];
        $totalBytes = 0;
        for ($i = 0; $i < $totalChunks; $i++) {
            $partPath = $chunkDirReal . '/chunk_' . str_pad((string)$i, 5, '0', STR_PAD_LEFT) . '.part';
            if (!is_file($partPath)) {
                $missingChunks[] = $i;
                continue;
            }
            $partSize = (int)(@filesize($partPath) ?: 0);
            $totalBytes += $partSize;
            $orderedParts[] = $partPath;
        }

        if (!empty($missingChunks)) {
            $msg = 'Missing video upload chunk(s): ' . implode(', ', array_map(static fn ($idx) => (string)($idx + 1), array_slice($missingChunks, 0, 10))) . '. Retry missing chunks.';
            return [
                'status' => 409,
                'body' => vdhVideoErrorResponse(409, $msg, $uploadId, $chunkIndex, $totalChunks, [
                    'missingChunks' => $missingChunks,
                ])
            ];
        }

        if ($totalBytes <= 0 || $totalBytes > $appCapBytes) {
            vdhRemoveDirRecursive($chunkDirReal);
            return [
                'status' => 413,
                'body' => vdhVideoErrorResponse(413, 'Video size exceeds maximum allowed limit of 250 MB.', $uploadId, $chunkIndex, $totalChunks)
            ];
        }

        $headBytes = (string)@file_get_contents($orderedParts[0], false, null, 0, 32);
        $finalMagic = vdhDetectVideoMagic($headBytes);
        if ($finalMagic === null) {
            vdhRemoveDirRecursive($chunkDirReal);
            return [
                'status' => 400,
                'body' => vdhVideoErrorResponse(400, 'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.', $uploadId, $chunkIndex, $totalChunks)
            ];
        }

        $finalFileName = vdhBuildFinalVideoFileName($originalName, $finalMagic, $allowedExts);
        $destPath = $uploadDirReal . DIRECTORY_SEPARATOR . $finalFileName;
        // Guarantee unique collision-resistant filename (never overwrite existing file)
        if (file_exists($destPath)) {
            $finalFileName = vdhBuildFinalVideoFileName($originalName, $finalMagic, $allowedExts);
            $destPath = $uploadDirReal . DIRECTORY_SEPARATOR . $finalFileName;
        }
        $destTmpPath = $destPath . '.assembling_' . getmypid() . '_' . bin2hex(random_bytes(3));
        $outHandle = @fopen($destTmpPath, 'wb');
        if ($outHandle === false) {
            return [
                'status' => 500,
                'body' => vdhVideoErrorResponse(500, 'Failed to create destination video file on Hostinger.', $uploadId, $chunkIndex, $totalChunks)
            ];
        }

        $writtenBytes = 0;
        foreach ($orderedParts as $partPath) {
            $inHandle = @fopen($partPath, 'rb');
            if ($inHandle === false) {
                fclose($outHandle);
                @unlink($destTmpPath);
                return [
                    'status' => 500,
                    'body' => vdhVideoErrorResponse(500, 'Failed to read chunk during video assembly.', $uploadId, $chunkIndex, $totalChunks)
                ];
            }
            $copied = stream_copy_to_stream($inHandle, $outHandle);
            fclose($inHandle);
            if ($copied === false) {
                fclose($outHandle);
                @unlink($destTmpPath);
                return [
                    'status' => 500,
                    'body' => vdhVideoErrorResponse(500, 'Failed to copy video chunk during assembly.', $uploadId, $chunkIndex, $totalChunks)
                ];
            }
            $writtenBytes += $copied;
        }
        fflush($outHandle);
        fclose($outHandle);

        if ($writtenBytes !== $totalBytes || !@rename($destTmpPath, $destPath)) {
            @unlink($destTmpPath);
            return [
                'status' => 500,
                'body' => vdhVideoErrorResponse(500, 'Assembled video failed integrity verification on Hostinger.', $uploadId, $chunkIndex, $totalChunks)
            ];
        }
        @chmod($destPath, 0644);

        // Final physical disk verification
        clearstatcache(true, $destPath);
        $destReal = realpath($destPath);
        $actualSize = $destReal !== false ? @filesize($destReal) : false;
        if (
            $destReal === false ||
            !str_starts_with($destReal, $uploadDirReal . DIRECTORY_SEPARATOR) ||
            !is_file($destReal) ||
            !is_readable($destReal) ||
            $actualSize !== $totalBytes
        ) {
            @unlink($destPath);
            return [
                'status' => 500,
                'body' => vdhVideoErrorResponse(500, 'Finalized video failed post-write physical check on Hostinger.', $uploadId, $chunkIndex, $totalChunks)
            ];
        }

        $relativeUrl = '/videos/uploads/' . $finalFileName;
        $canonicalUrl = vdhGatewayCanonicalPublicUrl($relativeUrl);
        $responseBody = [
            'success' => true,
            'uploadId' => $uploadId,
            'chunkIndex' => $chunkIndex,
            'receivedChunk' => $chunkIndex,
            'totalChunks' => $totalChunks,
            'completed' => true,
            'url' => $canonicalUrl,
            'videoUrl' => $canonicalUrl,
            'relativeUrl' => $relativeUrl,
            'fileName' => $finalFileName,
            'originalName' => $originalName,
            'sizeBytes' => $actualSize,
            'mimeType' => $finalMagic['mime'],
            'verifiedOnDisk' => true,
            'storageType' => 'server',
            'storageTarget' => 'hostinger-production',
            'authMethod' => $adminActor['authMethod'] ?? 'session',
            'error' => null,
            'message' => 'Video assembled and verified on Hostinger Production.'
        ];

        // Persist idempotent completion marker before removing chunk parts
        vdhAtomicWriteFile($doneMarkerPath, (string)json_encode([
            'actor' => $actorEmail,
            'fileName' => $finalFileName,
            'completedAt' => time(),
            'response' => $responseBody,
        ]));
        @chmod($doneMarkerPath, 0600);
        vdhRemoveDirRecursive($chunkDirReal);

        return ['status' => 200, 'body' => $responseBody];
    });

    vdhSendJson((int)$finalResult['status'], $finalResult['body']);
}

// Non-chunked single-request upload path (videos <= PHP server upload cap)
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
    if ($rawBody === '') {
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
    $sizeBytes = strlen($rawBody);
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
    $videoMagic = vdhDetectVideoMagic(substr($rawBody, 0, 32));
}

if ($videoMagic === null) {
    vdhSendJson(400, [
        'success' => false,
        'error' => 'Unsupported or invalid video file. Only genuine MP4, MOV, and WebM videos are allowed.'
    ]);
}

$mimeType = $videoMagic['mime'];
$finalFileName = vdhBuildFinalVideoFileName($originalName, $videoMagic, $allowedExts);
$destPath = $uploadDirReal . DIRECTORY_SEPARATOR . $finalFileName;
$destTmpPath = $destPath . '.tmp_' . getmypid() . '_' . bin2hex(random_bytes(3));

if (!empty($_FILES)) {
    $fileField = $_FILES['video'] ?? $_FILES['file'] ?? reset($_FILES);
    if (!move_uploaded_file($fileField['tmp_name'], $destTmpPath) || !@rename($destTmpPath, $destPath)) {
        @unlink($destTmpPath);
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to save uploaded video to persistent storage.']);
    }
} else {
    if (@file_put_contents($destTmpPath, $rawBody, LOCK_EX) === false || !@rename($destTmpPath, $destPath)) {
        @unlink($destTmpPath);
        vdhSendJson(500, ['success' => false, 'error' => 'Failed to write uploaded video to persistent storage.']);
    }
}
@chmod($destPath, 0644);

clearstatcache(true, $destPath);
$destReal = realpath($destPath);
$actualSize = $destReal !== false ? @filesize($destReal) : false;
if (
    $destReal === false ||
    !str_starts_with($destReal, $uploadDirReal . DIRECTORY_SEPARATOR) ||
    !is_file($destReal) ||
    !is_readable($destReal) ||
    $actualSize !== $sizeBytes
) {
    @unlink($destPath);
    vdhSendJson(500, ['success' => false, 'error' => 'Uploaded video failed post-write physical check on Hostinger.']);
}

$relativeUrl = '/videos/uploads/' . $finalFileName;
$canonicalUrl = vdhGatewayCanonicalPublicUrl($relativeUrl);
vdhSendJson(200, [
    'success' => true,
    'uploadId' => '',
    'chunkIndex' => 0,
    'receivedChunk' => 0,
    'totalChunks' => 1,
    'completed' => true,
    'url' => $canonicalUrl,
    'videoUrl' => $canonicalUrl,
    'relativeUrl' => $relativeUrl,
    'fileName' => $finalFileName,
    'originalName' => $originalName,
    'sizeBytes' => $actualSize,
    'mimeType' => $mimeType,
    'verifiedOnDisk' => true,
    'storageType' => 'server',
    'storageTarget' => 'hostinger-production',
    'authMethod' => $adminActor['authMethod'] ?? 'session',
    'error' => null,
    'message' => 'Video uploaded and verified on Hostinger Production.',
    'serverMaxUploadBytes' => $effectiveMaxBytes,
    'phpUploadMaxFilesize' => $iniUploadRaw,
    'phpPostMaxSize' => $iniPostRaw
]);
