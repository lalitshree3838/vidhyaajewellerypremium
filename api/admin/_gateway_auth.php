<?php
// VIDHYAA Jewellery Studio - Standalone Production Upload Gateway Verifier
// Strictly isolated from existing Live Admin Login (_auth.php / login.php / verify-session.php).
// Direct HTTP access is blocked by .htaccess (`RewriteRule ^api/admin/_ - [F,L]`) and basename guard.

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === '_gateway_auth.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

require_once __DIR__ . '/_auth.php';

define('VDH_GATEWAY_HEADER', 'X-Vidhyaa-Gateway-Auth');
define('VDH_GATEWAY_MAX_TTL_SECONDS', 60);
define('VDH_GATEWAY_CLOCK_SKEW_SECONDS', 15);
define('VDH_GATEWAY_NONCE_GC_TTL_SECONDS', 180);
define('VDH_GATEWAY_ALLOWED_SCOPES', ['media:upload', 'video:upload', 'products:write']);

/**
 * Parse a KEY=VALUE env file strictly outside public_html.
 */
function vdhGatewayParseEnvFile(string $filePath): array {
    $vars = [];
    if (!vdhIsPathPermittedByOpenBasedir($filePath)) return $vars;
    if (!@is_file($filePath) || !@is_readable($filePath)) return $vars;

    $lines = @file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) return $vars;

    foreach ($lines as $line) {
        $t = trim($line);
        if ($t === '' || str_starts_with($t, '#')) continue;
        if (str_starts_with($t, 'export ')) {
            $t = trim(substr($t, 7));
        }
        $pos = strpos($t, '=');
        if ($pos === false) continue;
        $k = trim(substr($t, 0, $pos));
        if ($k === '') continue;
        $v = trim(substr($t, $pos + 1));
        $len = strlen($v);
        if ($len >= 2 && (($v[0] === '"' && $v[$len - 1] === '"') || ($v[0] === "'" && $v[$len - 1] === "'"))) {
            $v = substr($v, 1, -1);
        }
        if (!array_key_exists($k, $vars) || trim((string)$vars[$k]) === '') {
            $vars[$k] = $v;
        }
    }
    return $vars;
}

/**
 * Checks whether a filesystem path resides inside public_html (webroot).
 * Production gateway secrets must NEVER be loaded from inside public_html.
 */
function vdhGatewayIsInsidePublicHtml(string $candidatePath): bool {
    $root = vdhNormalizeFsPath((string)(@realpath(vdhRootDir()) ?: vdhRootDir()));
    $real = @realpath($candidatePath);
    $norm = vdhNormalizeFsPath($real !== false ? $real : $candidatePath);
    return $norm === $root || str_starts_with($norm, $root . '/');
}

/**
 * Reads a gateway-specific variable ONLY from server environment variables
 * (getenv / $_ENV / $_SERVER / REDIRECT_*) or env files strictly OUTSIDE public_html.
 */
function vdhGatewayEnv(string $key, string $default = ''): string {
    foreach ([
        getenv($key),
        $_ENV[$key] ?? null,
        $_SERVER[$key] ?? null,
        $_SERVER['REDIRECT_' . $key] ?? null,
    ] as $val) {
        if ($val !== false && $val !== null && trim((string)$val) !== '') {
            return trim((string)$val);
        }
    }

    static $outsideVars = null;
    if ($outsideVars === null) {
        $outsideVars = [];
        $root = vdhRootDir();
        $candidates = [];

        foreach ([
            getenv('VIDHYAA_SECRETS_DIR'),
            $_ENV['VIDHYAA_SECRETS_DIR'] ?? null,
            $_SERVER['VIDHYAA_SECRETS_DIR'] ?? null,
        ] as $overrideRaw) {
            if (is_string($overrideRaw) && trim($overrideRaw) !== '') {
                $dir = rtrim(trim($overrideRaw), '/\\');
                $candidates[] = $dir . '/gateway.env';
                $candidates[] = $dir . '/.env';
            }
        }

        $candidates[] = dirname($root) . '/.env';
        $candidates[] = dirname($root) . '/.env.production';
        $candidates[] = dirname($root) . '/.vidhyaa-secrets/gateway.env';
        $candidates[] = dirname($root) . '/.admin-secrets/gateway.env';
        $candidates[] = dirname($root, 2) . '/.env';
        $candidates[] = dirname($root, 2) . '/.vidhyaa-secrets/gateway.env';
        $candidates[] = dirname($root, 2) . '/.admin-secrets/gateway.env';

        foreach ($candidates as $path) {
            if (vdhGatewayIsInsidePublicHtml($path)) {
                continue;
            }
            $parsed = vdhGatewayParseEnvFile($path);
            foreach ($parsed as $k => $v) {
                if (!array_key_exists($k, $outsideVars) || trim((string)$outsideVars[$k]) === '') {
                    $outsideVars[$k] = $v;
                }
            }
        }
    }

    if (isset($outsideVars[$key]) && trim((string)$outsideVars[$key]) !== '') {
        return trim((string)$outsideVars[$key]);
    }

    return $default;
}

function vdhGatewayCanonicalOrigin(): string {
    $raw = vdhGatewayEnv('VIDHYAA_PRODUCTION_ORIGIN', 'https://vidhyaajewellerystudio.com');
    $parsed = @parse_url($raw);
    $scheme = strtolower((string)($parsed['scheme'] ?? ''));
    $host = strtolower((string)($parsed['host'] ?? ''));
    if ($scheme === 'https' && preg_match('/^(?:www\.)?vidhyaajewellerystudio\.com$/', $host)) {
        return 'https://' . $host;
    }
    return 'https://vidhyaajewellerystudio.com';
}

function vdhGatewayCanonicalPublicUrl(string $relativePath): string {
    $clean = '/' . ltrim(str_replace('\\', '/', trim($relativePath)), '/');
    return vdhGatewayCanonicalOrigin() . $clean;
}

function vdhGatewayLoadConfig(): array {
    $disabledRaw = strtolower(vdhGatewayEnv('VIDHYAA_PROD_GATEWAY_DISABLED', ''));
    $disabled = in_array($disabledRaw, ['1', 'true', 'yes', 'on'], true);

    $activeSecret = vdhGatewayEnv('VIDHYAA_PROD_UPLOAD_SECRET', '');
    $activeKid = vdhGatewayEnv('VIDHYAA_PROD_UPLOAD_KEY_ID', 'k1');
    if ($activeKid === '') $activeKid = 'k1';

    $prevSecret = vdhGatewayEnv('VIDHYAA_PROD_UPLOAD_SECRET_PREV', '');
    $prevKid = vdhGatewayEnv('VIDHYAA_PROD_UPLOAD_SECRET_PREV_ID', '');

    $keys = [];
    if (strlen($activeSecret) >= 32) {
        $keys[$activeKid] = $activeSecret;
    }
    if (strlen($prevSecret) >= 32) {
        $effectivePrevKid = $prevKid !== '' ? $prevKid : ($activeKid . '_prev');
        if (!isset($keys[$effectivePrevKid])) {
            $keys[$effectivePrevKid] = $prevSecret;
        }
    }

    return [
        'disabled' => $disabled,
        'configured' => strlen($activeSecret) >= 32,
        'activeKid' => $activeKid,
        'keys' => $keys,
        'prevSecret' => strlen($prevSecret) >= 32 ? $prevSecret : '',
    ];
}

function vdhGatewayExtractHeader(): string {
    $candidates = [
        $_SERVER['HTTP_X_VIDHYAA_GATEWAY_AUTH'] ?? '',
        $_SERVER['REDIRECT_HTTP_X_VIDHYAA_GATEWAY_AUTH'] ?? '',
    ];
    foreach ($candidates as $val) {
        $clean = trim((string)$val);
        if ($clean !== '') return $clean;
    }
    if (function_exists('getallheaders')) {
        $hdrs = @getallheaders();
        if (is_array($hdrs)) {
            foreach ($hdrs as $k => $v) {
                if (strtolower((string)$k) === 'x-vidhyaa-gateway-auth') {
                    $clean = trim((string)$v);
                    if ($clean !== '') return $clean;
                }
            }
        }
    }
    return '';
}

/**
 * Deterministic canonical query string sorted by key (matches Node URLSearchParams sort).
 */
function vdhGatewayCanonicalQuery(string $rawQuery = ''): string {
    $queryStr = $rawQuery !== '' ? $rawQuery : (string)($_SERVER['QUERY_STRING'] ?? '');
    if ($queryStr === '') return '';

    $pairs = [];
    foreach (explode('&', $queryStr) as $segment) {
        if ($segment === '') continue;
        $eq = strpos($segment, '=');
        if ($eq === false) {
            $k = rawurldecode(str_replace('+', ' ', $segment));
            $v = '';
        } else {
            $k = rawurldecode(str_replace('+', ' ', substr($segment, 0, $eq)));
            $v = rawurldecode(str_replace('+', ' ', substr($segment, $eq + 1)));
        }
        $pairs[] = [$k, $v];
    }

    usort($pairs, static function (array $a, array $b): int {
        $cmp = strcmp($a[0], $b[0]);
        return $cmp !== 0 ? $cmp : strcmp($a[1], $b[1]);
    });

    $encoded = [];
    foreach ($pairs as [$k, $v]) {
        $encoded[] = rawurlencode($k) . '=' . rawurlencode($v);
    }
    return implode('&', $encoded);
}

/**
 * Resolves a persistent, non-web-accessible directory for atomic single-use nonce files.
 */
function vdhGatewayNonceDir(): ?string {
    $candidates = [];
    $outside = vdhOutsideSecretsDir();
    if ($outside !== null && !vdhGatewayIsInsidePublicHtml($outside)) {
        $candidates[] = rtrim($outside, '/\\') . '/gateway-nonces';
    }
    $tempState = vdhTempStateDir();
    if ($tempState !== '' && !vdhGatewayIsInsidePublicHtml($tempState)) {
        $candidates[] = rtrim($tempState, '/\\') . '/gateway-nonces';
    }

    foreach ($candidates as $dir) {
        if (!vdhIsPathPermittedByOpenBasedir($dir)) continue;
        if (!@is_dir($dir)) {
            @mkdir($dir, 0700, true);
            @chmod($dir, 0700);
        }
        if (@is_dir($dir) && @is_writable($dir)) {
            return $dir;
        }
    }
    return null;
}

/**
 * Opportunistic non-blocking garbage collection for expired nonce marker files.
 * Only deletes files older than 180 seconds (3x the 60-second max token TTL).
 */
function vdhGatewayCleanupExpiredNonces(string $nonceDir): void {
    $lockPath = $nonceDir . '/cleanup.lock';
    $fp = @fopen($lockPath, 'c+');
    if (!$fp) return;
    if (!@flock($fp, LOCK_EX | LOCK_NB)) {
        @fclose($fp);
        return;
    }

    try {
        $now = time();
        $lastRun = (int)trim((string)@stream_get_contents($fp));
        if ($lastRun > 0 && ($now - $lastRun) < 60) {
            return;
        }

        $cutoff = $now - VDH_GATEWAY_NONCE_GC_TTL_SECONDS;
        $entries = @scandir($nonceDir);
        if (is_array($entries)) {
            foreach ($entries as $entry) {
                if (!str_starts_with($entry, 'n_') || !str_ends_with($entry, '.used')) continue;
                $full = $nonceDir . '/' . $entry;
                if (!@is_file($full)) continue;
                $mtime = @filemtime($full);
                if ($mtime !== false && $mtime < $cutoff) {
                    @unlink($full);
                }
            }
        }

        @ftruncate($fp, 0);
        @rewind($fp);
        @fwrite($fp, (string)$now);
        @fflush($fp);
    } finally {
        @flock($fp, LOCK_UN);
        @fclose($fp);
    }
}

/**
 * Atomically claims a single-use nonce on the Linux filesystem using O_CREAT | O_EXCL (`xb`).
 * Returns ['ok' => true] on first use, or ['ok' => false, 'status' => 401|503, 'error' => ...].
 */
function vdhGatewayConsumeNonce(string $nonce, int $exp, string $scope): array {
    if (!preg_match('/^[0-9a-f]{32}$/', $nonce)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Invalid gateway nonce format.'];
    }

    $nonceDir = vdhGatewayNonceDir();
    if ($nonceDir === null) {
        return [
            'ok' => false,
            'status' => 503,
            'error' => 'Production gateway replay protection storage is unavailable on server.'
        ];
    }

    $nonceFile = $nonceDir . '/n_' . $nonce . '.used';
    $fp = @fopen($nonceFile, 'xb');
    if ($fp === false) {
        if (@file_exists($nonceFile)) {
            return [
                'ok' => false,
                'status' => 401,
                'error' => 'Gateway authorization replay rejected. Retry with a fresh signed request.'
            ];
        }
        return [
            'ok' => false,
            'status' => 503,
            'error' => 'Unable to persist gateway nonce state on server.'
        ];
    }

    $meta = json_encode(['exp' => $exp, 'scope' => $scope, 'ts' => time()]);
    @fwrite($fp, is_string($meta) ? $meta : '{}');
    @fflush($fp);
    @fclose($fp);
    @chmod($nonceFile, 0600);

    vdhGatewayCleanupExpiredNonces($nonceDir);
    return ['ok' => true];
}

/**
 * Verifies a short-lived HMAC-SHA256 Production Upload Gateway token.
 * Never logs secrets, tokens, or signatures.
 */
function vdhVerifyProductionGatewayRequest(
    string $requiredScope,
    string $rawBody,
    string $expectedPath
): array {
    if (!in_array($requiredScope, VDH_GATEWAY_ALLOWED_SCOPES, true)) {
        return ['ok' => false, 'status' => 403, 'error' => 'Gateway authorization is not permitted for this operation.'];
    }

    $cfg = vdhGatewayLoadConfig();
    if ($cfg['disabled']) {
        return ['ok' => false, 'status' => 503, 'error' => 'Production upload gateway is disabled by server configuration.'];
    }
    if (!$cfg['configured']) {
        return [
            'ok' => false,
            'status' => 503,
            'error' => 'Production upload gateway secret is not configured outside public_html on Hostinger.'
        ];
    }

    $headerVal = vdhGatewayExtractHeader();
    if ($headerVal === '') {
        return ['ok' => false, 'status' => 401, 'error' => 'Missing gateway authorization header.'];
    }

    $parts = explode('.', $headerVal);
    if (count($parts) !== 3 || $parts[0] !== 'v1') {
        return ['ok' => false, 'status' => 401, 'error' => 'Malformed gateway authorization token.'];
    }

    $payloadJson = vdhBase64UrlDecode($parts[1]);
    if ($payloadJson === false) {
        return ['ok' => false, 'status' => 401, 'error' => 'Invalid gateway token encoding.'];
    }
    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Invalid gateway token payload.'];
    }

    $kid = trim((string)($payload['kid'] ?? ''));
    $candidateSecrets = [];
    if ($kid !== '' && isset($cfg['keys'][$kid])) {
        $candidateSecrets[] = $cfg['keys'][$kid];
    } else {
        // During rotation, allow checking configured active + prev secret without revealing which failed
        foreach ($cfg['keys'] as $sec) {
            $candidateSecrets[] = $sec;
        }
    }

    $sigValid = false;
    foreach ($candidateSecrets as $secret) {
        $expectedSig = vdhBase64UrlEncode(hash_hmac('sha256', "v1.{$parts[1]}", $secret, true));
        if (hash_equals($expectedSig, $parts[2])) {
            $sigValid = true;
            break;
        }
    }
    if (!$sigValid) {
        return ['ok' => false, 'status' => 401, 'error' => 'Invalid gateway authorization signature.'];
    }

    $now = time();
    $iat = (int)($payload['iat'] ?? 0);
    $exp = (int)($payload['exp'] ?? 0);
    if ($iat <= 0 || $exp <= 0 || $exp <= $iat || ($exp - $iat) > VDH_GATEWAY_MAX_TTL_SECONDS) {
        return ['ok' => false, 'status' => 401, 'error' => 'Gateway token validity window is invalid.'];
    }
    if ($now > ($exp + VDH_GATEWAY_CLOCK_SKEW_SECONDS)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Gateway authorization token has expired. Please retry.'];
    }
    if ($iat > ($now + VDH_GATEWAY_CLOCK_SKEW_SECONDS)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Gateway authorization timestamp is outside allowed clock skew.'];
    }

    $scope = trim((string)($payload['scope'] ?? ''));
    if ($scope !== $requiredScope) {
        return ['ok' => false, 'status' => 403, 'error' => 'Gateway token scope does not authorize this endpoint.'];
    }

    $reqMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $tokMethod = strtoupper(trim((string)($payload['method'] ?? '')));
    if ($tokMethod !== $reqMethod) {
        return ['ok' => false, 'status' => 403, 'error' => 'Gateway token HTTP method mismatch.'];
    }

    $tokPath = trim((string)($payload['path'] ?? ''));
    if ($tokPath !== $expectedPath) {
        return ['ok' => false, 'status' => 403, 'error' => 'Gateway token endpoint path mismatch.'];
    }

    $expectedQuery = vdhGatewayCanonicalQuery();
    $tokQuery = (string)($payload['query'] ?? '');
    if (!hash_equals($expectedQuery, $tokQuery)) {
        return ['ok' => false, 'status' => 403, 'error' => 'Gateway token query parameters mismatch.'];
    }

    $expectedBodySha = hash('sha256', $rawBody);
    $tokBodySha = strtolower(trim((string)($payload['bodySha256'] ?? '')));
    if ($tokBodySha === '' || !hash_equals($expectedBodySha, $tokBodySha)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Gateway request body integrity check failed.'];
    }

    $actor = strtolower(trim((string)($payload['actor'] ?? '')));
    if ($actor === '' || !in_array($actor, vdhAllowedAdminEmails(), true)) {
        return ['ok' => false, 'status' => 403, 'error' => 'Gateway actor is not an authorized administrator.'];
    }

    $nonce = strtolower(trim((string)($payload['nonce'] ?? '')));
    $nonceRes = vdhGatewayConsumeNonce($nonce, $exp, $scope);
    if (!$nonceRes['ok']) {
        return $nonceRes;
    }

    return [
        'ok' => true,
        'admin' => [
            'email' => $actor,
            'role' => 'admin',
            'name' => 'Production Upload Gateway (' . $actor . ')',
            'authMethod' => 'production_gateway',
            'kid' => $kid !== '' ? $kid : $cfg['activeKid'],
        ],
    ];
}

/**
 * Dual-path guard used ONLY on media/upload, videos/upload, and products POST/PUT:
 * - If `X-Vidhyaa-Gateway-Auth` header is present: strictly verifies gateway token (fail-closed, never falls through).
 * - Otherwise: delegates directly to existing untouched `vdhRequireAdmin()`.
 */
function vdhRequireAdminOrProductionGateway(
    string $requiredScope,
    string $rawBody,
    string $expectedPath
): array {
    $gatewayHeader = vdhGatewayExtractHeader();
    if ($gatewayHeader !== '') {
        $result = vdhVerifyProductionGatewayRequest($requiredScope, $rawBody, $expectedPath);
        if (!$result['ok']) {
            vdhSendJson((int)($result['status'] ?? 401), [
                'success' => false,
                'error' => (string)($result['error'] ?? 'Gateway authorization failed.'),
                'gatewayAuth' => false,
            ]);
        }
        return $result['admin'];
    }

    return vdhRequireAdmin();
}
