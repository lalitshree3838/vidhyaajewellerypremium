<?php
// VIDHYAA Jewellery Studio - Authenticated Server-Side Video URL Verification (Hostinger Production)
require_once dirname(__DIR__) . '/admin/_auth.php';

vdhApplyCorsHeaders('POST, OPTIONS', 'Content-Type, Authorization, x-admin-token');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    vdhSendJson(405, ['success' => false, 'error' => 'Method not allowed. Use POST.']);
}

vdhRequireAdmin();

$rawBody = file_get_contents('php://input');
$payload = json_decode((string)$rawBody, true);
if (!is_array($payload)) {
    vdhSendJson(400, ['success' => false, 'valid' => false, 'error' => 'Invalid JSON request body.']);
}

$rawUrl = isset($payload['url']) && is_string($payload['url']) ? trim($payload['url']) : '';
if ($rawUrl === '' || preg_match('/\s/', $rawUrl)) {
    vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'Please enter a valid video URL without spaces.']);
}

function vdhDetectVideoSig(string $bytes): ?array {
    if (strlen($bytes) < 12) return null;
    if (substr($bytes, 0, 4) === "\x1A\x45\xDF\xA3") {
        return ['ext' => '.webm', 'mime' => 'video/webm'];
    }
    $box = substr($bytes, 4, 4);
    if (in_array($box, ['ftyp', 'moov', 'mdat', 'wide', 'free'], true)) {
        $brand = strtolower(substr($bytes, 8, 4));
        if ($box === 'ftyp' && strpos($brand, 'qt') === 0) {
            return ['ext' => '.mov', 'mime' => 'video/quicktime'];
        }
        return ['ext' => '.mp4', 'mime' => 'video/mp4'];
    }
    return null;
}

function vdhIsPreviewOrLocalHost(string $host): bool {
    $h = strtolower(trim($host));
    if ($h === '') return true;
    if (preg_match('/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)$/i', $h)) return true;
    return (bool)preg_match('/(?:^|\.)(?:ais-dev-[a-z0-9-]+\.run\.app|ais-pre-[a-z0-9-]+\.run\.app|run\.app|webcontainer\.io|stackblitz\.io|csb\.app|ngrok(?:-free)?\.app|trycloudflare\.com|loca\.lt)$/i', $h);
}

function vdhIsPublicIp(string $ip): bool {
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
}

function vdhAssertPublicHttpsUrl(string $url): array {
    $parts = parse_url($url);
    if (!is_array($parts)) {
        return ['ok' => false, 'error' => 'Malformed external video URL.'];
    }
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    if ($scheme !== 'https') {
        return ['ok' => false, 'error' => 'External video URLs must use HTTPS.'];
    }
    if (!empty($parts['user']) || !empty($parts['pass'])) {
        return ['ok' => false, 'error' => 'Video URLs with embedded credentials are not allowed.'];
    }
    $host = strtolower((string)($parts['host'] ?? ''));
    if ($host === '' || vdhIsPreviewOrLocalHost($host)) {
        return ['ok' => false, 'error' => 'Preview, private, or localhost URLs cannot be saved as production videos.'];
    }
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        if (!vdhIsPublicIp($host)) {
            return ['ok' => false, 'error' => 'Private or internal IP addresses are not allowed.'];
        }
        return ['ok' => true, 'parts' => $parts];
    }

    $ips = [];
    $aRecords = @dns_get_record($host, DNS_A);
    if (is_array($aRecords)) {
        foreach ($aRecords as $rec) {
            if (!empty($rec['ip'])) $ips[] = $rec['ip'];
        }
    }
    $aaaaRecords = @dns_get_record($host, DNS_AAAA);
    if (is_array($aaaaRecords)) {
        foreach ($aaaaRecords as $rec) {
            if (!empty($rec['ipv6'])) $ips[] = $rec['ipv6'];
        }
    }
    if (empty($ips)) {
        $fallbackIps = @gethostbynamel($host);
        if (is_array($fallbackIps)) {
            $ips = $fallbackIps;
        }
    }
    if (empty($ips)) {
        return ['ok' => false, 'error' => 'Could not resolve the video URL hostname.'];
    }
    foreach ($ips as $ip) {
        if (!vdhIsPublicIp($ip)) {
            return ['ok' => false, 'error' => 'Video host resolves to a restricted private network address.'];
        }
    }
    return ['ok' => true, 'parts' => $parts];
}

function vdhProbeHttpsUrl(string $url, string $method = 'HEAD', string $rangeHeader = '', int $depth = 0): array {
    if ($depth > 3) {
        return ['ok' => false, 'error' => 'Too many redirects while verifying video URL.'];
    }
    $check = vdhAssertPublicHttpsUrl($url);
    if (!$check['ok']) {
        return $check;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $respHeaders = [];
        $sample = '';
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_USERAGENT => 'VidhyaaJewelleryVideoVerifier/1.0',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_NOBODY => ($method === 'HEAD'),
            CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$respHeaders) {
                $len = strlen($line);
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $respHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return $len;
            },
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$sample, $method) {
                if ($method === 'HEAD') return 0;
                $need = 64 - strlen($sample);
                if ($need > 0) {
                    $sample .= substr($chunk, 0, $need);
                }
                if (strlen($sample) >= 32) {
                    return 0; // Abort cleanly once we have 32 bytes for signature check
                }
                return strlen($chunk);
            },
        ]);
        if ($rangeHeader !== '') {
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Range: ' . $rangeHeader]);
        }
        @curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errNo = curl_errno($ch);
        curl_close($ch);

        // CURLE_WRITE_ERROR (23) is expected when we intentionally stop after reading 32 bytes
        if ($status === 0 && $errNo !== 23) {
            return ['ok' => false, 'error' => 'Could not reach external video host.'];
        }

        if (in_array($status, [301, 302, 303, 307, 308], true) && !empty($respHeaders['location'])) {
            $loc = $respHeaders['location'];
            if (!preg_match('#^https?://#i', $loc)) {
                $p = $check['parts'];
                $origin = 'https://' . $p['host'] . (!empty($p['port']) ? ':' . $p['port'] : '');
                $loc = (strpos($loc, '/') === 0) ? ($origin . $loc) : ($origin . '/' . $loc);
            }
            return vdhProbeHttpsUrl($loc, $method, $rangeHeader, $depth + 1);
        }

        return [
            'ok' => true,
            'status' => $status,
            'contentType' => strtolower((string)($respHeaders['content-type'] ?? '')),
            'sample' => $sample,
        ];
    }

    return ['ok' => false, 'error' => 'Server cURL extension unavailable for external URL verification.'];
}

// 1. Block Preview-only absolute URLs before normalization
if (preg_match('#^https?://#i', $rawUrl)) {
    $host = strtolower((string)parse_url($rawUrl, PHP_URL_HOST));
    if ($host === '' || vdhIsPreviewOrLocalHost($host)) {
        vdhSendJson(200, [
            'success' => true,
            'valid' => false,
            'error' => 'Preview or localhost URLs cannot be saved as production videos. Upload on the live website or enter a production video URL.',
        ]);
    }
}

// 2. Normalize same-domain production /videos/uploads/ or relative path
$normalizedLocal = $rawUrl;
if (preg_match('#^https?://(?:www\.)?vidhyaajewellerystudio\.com(/videos/uploads/[^\s?\#]+(?:\?[^\s\#]*)?)$#i', $normalizedLocal, $m)) {
    $normalizedLocal = $m[1];
} elseif (preg_match('#^(videos/uploads/.*)$#i', $normalizedLocal)) {
    $normalizedLocal = '/' . $normalizedLocal;
}

if (stripos($normalizedLocal, '/videos/uploads/') === 0) {
    $cleanPathOnly = preg_replace('/[?#].*$/', '', $normalizedLocal);
    $relFile = preg_replace('#^/videos/uploads/#i', '', (string)$cleanPathOnly);
    if ($relFile === '' || strpos($relFile, '/') !== false || strpos($relFile, '\\') !== false || strpos($relFile, '..') !== false) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'Invalid local video filename.']);
    }

    $uploadDir = realpath(dirname(__DIR__, 2) . '/videos/uploads');
    $targetFile = $uploadDir !== false ? realpath($uploadDir . DIRECTORY_SEPARATOR . $relFile) : false;
    if ($uploadDir === false || $targetFile === false || strpos($targetFile, $uploadDir . DIRECTORY_SEPARATOR) !== 0 || !is_file($targetFile)) {
        vdhSendJson(200, [
            'success' => true,
            'valid' => false,
            'error' => "Video file \"{$relFile}\" was not found in /videos/uploads/ on this server.",
        ]);
    }

    $size = filesize($targetFile);
    if ($size === false || $size < 16) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'Local video file is empty or corrupted.']);
    }

    $fp = @fopen($targetFile, 'rb');
    $header = $fp ? (string)fread($fp, 16) : '';
    if ($fp) fclose($fp);

    $sig = vdhDetectVideoSig($header);
    if ($sig === null) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'File exists on server but is not a valid MP4, MOV, or WebM video stream.']);
    }

    vdhSendJson(200, [
        'success' => true,
        'valid' => true,
        'kind' => 'direct',
        'normalizedUrl' => '/videos/uploads/' . $relFile,
        'mimeType' => $sig['mime'],
        'sizeBytes' => $size,
    ]);
}

if (!preg_match('#^https://#i', $rawUrl)) {
    vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'Video URL must start with https:// or /videos/uploads/.']);
}

// 3. Supported official YouTube / Vimeo embed verification via fixed oEmbed endpoints
$parsed = parse_url($rawUrl);
$extHost = strtolower((string)($parsed['host'] ?? ''));
$extPath = trim((string)($parsed['path'] ?? ''), '/');
$extParts = $extPath !== '' ? explode('/', $extPath) : [];
$queryArr = [];
if (!empty($parsed['query'])) {
    parse_str($parsed['query'], $queryArr);
}

$fetchOembedStatus = function (string $oembedUrl): int {
    if (!function_exists('curl_init')) return 0;
    $ch = curl_init($oembedUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_USERAGENT => 'VidhyaaJewelleryVideoVerifier/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    @curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $status;
};

if (in_array($extHost, ['youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'], true)) {
    $ytId = '';
    if ($extHost === 'youtu.be' && isset($extParts[0])) {
        $ytId = $extParts[0];
    } elseif (($extParts[0] ?? '') === 'watch') {
        $ytId = (string)($queryArr['v'] ?? '');
    } elseif (in_array($extParts[0] ?? '', ['shorts', 'embed', 'live'], true) && isset($extParts[1])) {
        $ytId = $extParts[1];
    }

    if (!preg_match('/^[A-Za-z0-9_-]{11}$/', $ytId)) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'Invalid YouTube video URL. Please paste a direct video link (e.g. https://youtu.be/VIDEO_ID).']);
    }

    $canonicalYt = 'https://www.youtube.com/watch?v=' . $ytId;
    $st = $fetchOembedStatus('https://www.youtube.com/oembed?format=json&url=' . rawurlencode($canonicalYt));
    if ($st >= 400) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => "YouTube video is unavailable, private, or embedding is disabled (HTTP {$st})."]);
    }

    vdhSendJson(200, [
        'success' => true,
        'valid' => true,
        'kind' => 'embed',
        'provider' => 'youtube',
        'normalizedUrl' => $canonicalYt,
    ]);
}

if (in_array($extHost, ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'], true)) {
    $vimeoId = '';
    if ($extHost === 'player.vimeo.com' && ($extParts[0] ?? '') === 'video' && isset($extParts[1])) {
        $vimeoId = $extParts[1];
    } elseif (count($extParts) >= 1) {
        $last = $extParts[count($extParts) - 1];
        if (preg_match('/^\d{4,15}$/', $last)) {
            $vimeoId = $last;
        } elseif (($extParts[0] ?? '') === 'video' && isset($extParts[1]) && preg_match('/^\d{4,15}$/', $extParts[1])) {
            $vimeoId = $extParts[1];
        }
    }

    if (!preg_match('/^\d{4,15}$/', $vimeoId)) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => 'Invalid Vimeo video URL. Please paste a direct Vimeo video link (e.g. https://vimeo.com/123456789).']);
    }

    $canonicalVimeo = 'https://vimeo.com/' . $vimeoId;
    $st = $fetchOembedStatus('https://vimeo.com/api/oembed.json?url=' . rawurlencode($canonicalVimeo));
    if ($st >= 400) {
        vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => "Vimeo video is unavailable, private, or embedding is disabled (HTTP {$st})."]);
    }

    vdhSendJson(200, [
        'success' => true,
        'valid' => true,
        'kind' => 'embed',
        'provider' => 'vimeo',
        'normalizedUrl' => $canonicalVimeo,
    ]);
}

// 4. External direct HTTPS video probe
$probe = vdhProbeHttpsUrl($rawUrl, 'HEAD');
if (!$probe['ok']) {
    vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => $probe['error']]);
}

$ct = (string)($probe['contentType'] ?? '');
$needsPartialGet = in_array($probe['status'], [403, 405], true)
    || $ct === ''
    || strpos($ct, 'application/octet-stream') !== false
    || strpos($ct, 'binary/octet-stream') !== false;

if ($needsPartialGet) {
    $getProbe = vdhProbeHttpsUrl($rawUrl, 'GET', 'bytes=0-31');
    if ($getProbe['ok']) {
        $probe = $getProbe;
        $ct = (string)($probe['contentType'] ?? '');
    }
}

if (!in_array($probe['status'], [200, 206], true)) {
    vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => "Video URL returned HTTP {$probe['status']}. Ensure the link is publicly accessible."]);
}

if (
    strpos($ct, 'text/html') !== false
    || strpos($ct, 'application/xhtml') !== false
    || strpos($ct, 'application/json') !== false
    || strpos($ct, 'text/plain') !== false
    || strpos($ct, 'image/') === 0
) {
    $shortCt = explode(';', $ct)[0];
    vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => "URL returned \"{$shortCt}\" instead of a video stream. Paste a direct .mp4/.webm/.mov link or upload the video directly."]);
}

$isVideoMime = strpos($ct, 'video/') === 0;
$sigFromSample = !empty($probe['sample']) ? vdhDetectVideoSig($probe['sample']) : null;

if (!$isVideoMime && $sigFromSample === null) {
    $shortCt = $ct !== '' ? explode(';', $ct)[0] : 'unknown';
    vdhSendJson(200, ['success' => true, 'valid' => false, 'error' => "URL did not return a playable video Content-Type (received \"{$shortCt}\")."]);
}

vdhSendJson(200, [
    'success' => true,
    'valid' => true,
    'kind' => 'direct',
    'normalizedUrl' => $rawUrl,
    'mimeType' => $isVideoMime ? explode(';', $ct)[0] : ($sigFromSample['mime'] ?? 'video/mp4'),
]);
