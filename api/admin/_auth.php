<?php
// VIDHYAA Jewellery Studio - Shared Server Authentication, Session, Locking & Privacy Helpers
// Access to _auth.php directly via HTTP is blocked by .htaccess and basename guard.

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === '_auth.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

define('VDH_FIREBASE_PROJECT_ID', 'gen-lang-client-0706507905');
define('VDH_ADMIN_TTL_SECONDS', 43200);   // 12 hours
define('VDH_PATRON_TTL_SECONDS', 2592000); // 30 days
define('VDH_RATE_LIMIT_MAX_ATTEMPTS', 5);
define('VDH_RATE_LIMIT_WINDOW_SECONDS', 900); // 15 minutes

function vdhRootDir(): string {
    return dirname(__DIR__, 2);
}

function vdhReadDotEnv(): array {
    static $cached = null;
    if ($cached !== null) return $cached;
    $vars = [];
    $root = vdhRootDir();
    $envCandidates = [
        dirname($root) . '/.env',
        dirname($root) . '/.env.production',
        dirname($root, 2) . '/.env',
        $root . '/.env',
    ];
    foreach ($envCandidates as $envPath) {
        if (!vdhIsPathPermittedByOpenBasedir($envPath)) continue;
        if (!@is_file($envPath) || !@is_readable($envPath)) continue;
        $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) continue;
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
    }
    $cached = $vars;
    return $cached;
}

function vdhEnv(string $key, string $default = ''): string {
    $candidates = [
        getenv($key),
        $_ENV[$key] ?? null,
        $_SERVER[$key] ?? null,
        $_SERVER['REDIRECT_' . $key] ?? null,
    ];
    foreach ($candidates as $val) {
        if ($val !== false && $val !== null && trim((string)$val) !== '') {
            return trim((string)$val);
        }
    }
    $dot = vdhReadDotEnv();
    if (isset($dot[$key]) && trim((string)$dot[$key]) !== '') return trim((string)$dot[$key]);
    return $default;
}

function vdhNormalizeFsPath(string $path): string {
    $norm = str_replace('\\', '/', trim($path));
    return rtrim($norm, '/') ?: '/';
}

function vdhIsPathPermittedByOpenBasedir(string $path): bool {
    $openBasedir = trim((string)@ini_get('open_basedir'));
    if ($openBasedir === '') return true;
    $target = vdhNormalizeFsPath($path);
    $roots = explode(PATH_SEPARATOR, $openBasedir);
    foreach ($roots as $root) {
        $rootTrim = trim($root);
        if ($rootTrim === '') continue;
        $real = @realpath($rootTrim);
        $base = vdhNormalizeFsPath($real !== false ? $real : $rootTrim);
        if ($base === '/') return true;
        if ($target === $base || str_starts_with($target, $base . '/')) {
            return true;
        }
    }
    return false;
}

function vdhOutsideSecretsDir(): ?string {
    $root = vdhRootDir();
    $candidates = [];
    $override = vdhEnv('VIDHYAA_SECRETS_DIR');
    if ($override !== '') {
        $candidates[] = rtrim($override, '/\\');
    }
    $candidates[] = dirname($root) . '/.admin-secrets';
    $candidates[] = dirname($root) . '/.vidhyaa-secrets';
    $candidates[] = dirname($root, 2) . '/.admin-secrets';

    foreach ($candidates as $dir) {
        if (!vdhIsPathPermittedByOpenBasedir($dir)) {
            continue;
        }
        if (@is_dir($dir) && @is_writable($dir)) {
            return $dir;
        }
    }

    // Try creating primary outside directory if permitted
    foreach (array_slice($candidates, 0, 2) as $dir) {
        if (!vdhIsPathPermittedByOpenBasedir($dir)) continue;
        $parent = dirname($dir);
        if (!vdhIsPathPermittedByOpenBasedir($parent)) continue;
        if (@mkdir($dir, 0700, true)) {
            @chmod($dir, 0700);
            if (@is_dir($dir) && @is_writable($dir)) {
                return $dir;
            }
        }
    }
    return null;
}

function vdhOutsideSecretsFilePath(string $filename): ?string {
    $dir = vdhOutsideSecretsDir();
    if ($dir !== null) {
        return $dir . '/' . ltrim($filename, '/\\');
    }
    $root = vdhRootDir();
    $override = vdhEnv('VIDHYAA_SECRETS_DIR');
    $fallbackDirs = [];
    if ($override !== '') $fallbackDirs[] = rtrim($override, '/\\');
    $fallbackDirs[] = dirname($root) . '/.admin-secrets';
    $fallbackDirs[] = dirname($root) . '/.vidhyaa-secrets';
    $fallbackDirs[] = dirname($root, 2) . '/.admin-secrets';
    foreach ($fallbackDirs as $candDir) {
        $candFile = $candDir . '/' . ltrim($filename, '/\\');
        if (vdhIsPathPermittedByOpenBasedir($candFile) && @is_file($candFile) && @is_readable($candFile)) {
            return $candFile;
        }
    }
    return null;
}

function vdhTempStateDir(): string {
    $base = rtrim(sys_get_temp_dir(), '/\\');
    $dir = $base . '/vidhyaa_state_' . substr(md5(vdhRootDir()), 0, 12);
    if (vdhIsPathPermittedByOpenBasedir($dir)) {
        if (!@is_dir($dir)) {
            @mkdir($dir, 0700, true);
            @chmod($dir, 0700);
        }
        if (@is_dir($dir) && @is_writable($dir)) {
            return $dir;
        }
    }
    $outside = vdhOutsideSecretsDir();
    if ($outside !== null) {
        $stateSub = $outside . '/state';
        if (!@is_dir($stateSub)) {
            @mkdir($stateSub, 0700, true);
            @chmod($stateSub, 0700);
        }
        if (@is_dir($stateSub) && @is_writable($stateSub)) {
            return $stateSub;
        }
    }
    return $dir;
}

function vdhRuntimeStateDir(): string {
    return vdhOutsideSecretsDir() ?? vdhTempStateDir();
}

function vdhBase64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function vdhBase64UrlDecode(string $data): string|false {
    $padded = strtr($data, '-_', '+/');
    $rem = strlen($padded) % 4;
    if ($rem > 0) {
        $padded .= str_repeat('=', 4 - $rem);
    }
    return base64_decode($padded, true);
}

function vdhGetSessionSecret(): string {
    static $secret = null;
    if ($secret !== null) return $secret;

    foreach (['VIDHYAA_SESSION_SECRET', 'ADMIN_SESSION_SECRET', 'SESSION_SECRET'] as $envKey) {
        $candidate = vdhEnv($envKey);
        if (strlen($candidate) >= 16) {
            $secret = $candidate;
            return $secret;
        }
    }

    $creds = vdhLoadAdminCredentialsConfig();
    if (strlen($creds['sessionSigningSecret'] ?? '') >= 32) {
        $secret = $creds['sessionSigningSecret'];
        return $secret;
    }

    $outside = vdhOutsideSecretsDir();
    $keyDir = $outside ?? vdhTempStateDir();
    $keyFile = $keyDir . '/session-secret.key';
    if (vdhIsPathPermittedByOpenBasedir($keyFile) && @is_file($keyFile) && @is_readable($keyFile)) {
        $existing = trim((string)@file_get_contents($keyFile));
        if (strlen($existing) >= 32) {
            $secret = $existing;
            return $secret;
        }
    }

    $generated = bin2hex(random_bytes(32));
    if (vdhIsPathPermittedByOpenBasedir($keyFile)) {
        @file_put_contents($keyFile, $generated, LOCK_EX);
        @chmod($keyFile, 0600);
    }
    $secret = $generated;
    return $secret;
}

function vdhAllowedCorsOrigin(): string {
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return '';

    if (preg_match('#^https://(?:www\.)?vidhyaajewellerystudio\.com$#i', $origin)) {
        return $origin;
    }
    if (preg_match('#^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?$#i', $origin)) {
        return $origin;
    }
    if (preg_match('#^https://[a-z0-9-]+\.run\.app$#i', $origin)) {
        return $origin;
    }

    $extraRaw = vdhEnv('ALLOWED_ORIGINS');
    if ($extraRaw !== '') {
        foreach (explode(',', $extraRaw) as $cand) {
            if (trim($cand) === $origin) {
                return $origin;
            }
        }
    }
    return '';
}

function vdhApplyCorsHeaders(string $methods = 'GET, POST, PUT, DELETE, OPTIONS', string $headers = 'Content-Type, Authorization, x-admin-token, x-customer-token, x-order-token'): void {
    header('Vary: Origin');
    $allowed = vdhAllowedCorsOrigin();
    if ($allowed !== '') {
        header('Access-Control-Allow-Origin: ' . $allowed);
    }
    header('Access-Control-Allow-Methods: ' . $methods);
    header('Access-Control-Allow-Headers: ' . $headers);
}

function vdhComputePromoDiscount(float $subtotal, string $rawPromo): float {
    $code = strtoupper(trim($rawPromo));
    if ($code === '' || $subtotal <= 0) return 0.0;
    $discount = 0.0;
    if ($code === 'VIDHYAA10' || $code === 'ROYAL10') {
        $discount = round($subtotal * 0.10);
    } elseif ($code === 'LIVESTUDIO15') {
        $discount = round($subtotal * 0.15);
    } elseif ($code === 'FESTIVE500') {
        $discount = $subtotal >= 2500 ? 500.0 : 0.0;
    } elseif ($code === 'BRIDALVIP') {
        $discount = $subtotal >= 5000 ? round($subtotal * 0.15) : 0.0;
    }
    return max(0.0, min($subtotal, $discount));
}

function vdhValidateAndComputeOrderPricing(array $body, string $productsFile, bool $allowAdminBypass = false): array {
    $toMoney = static function ($val, float $fallback = 0.0): float {
        if (is_int($val) || is_float($val)) return (float)$val;
        if (is_string($val)) {
            $cleaned = str_replace(['₹', ',', ' '], '', $val);
            if (is_numeric($cleaned)) return (float)$cleaned;
        }
        return $fallback;
    };

    $rawItems = is_array($body['items'] ?? null) ? $body['items'] : [];
    if (empty($rawItems)) {
        if ($allowAdminBypass) {
            $amt = max(0.0, $toMoney($body['orderAmount'] ?? ($body['totalAmount'] ?? ($body['total'] ?? 0)), 0.0));
            return [
                'valid' => true,
                'subtotal' => max(0.0, $toMoney($body['subtotal'] ?? $amt, $amt)),
                'discount' => max(0.0, $toMoney($body['discount'] ?? 0, 0.0)),
                'deliveryCharge' => max(0.0, $toMoney($body['deliveryCharge'] ?? 0, 0.0)),
                'totalAmount' => $amt,
                'appliedPromo' => strtoupper(trim((string)($body['appliedPromo'] ?? ($body['promoCode'] ?? '')))),
            ];
        }
        return [
            'valid' => false,
            'code' => 'EMPTY_ITEMS',
            'error' => 'Order must contain at least one catalog item for price verification.',
        ];
    }

    $products = [];
    if (is_file($productsFile) && is_readable($productsFile)) {
        $decoded = json_decode((string)@file_get_contents($productsFile), true);
        if (is_array($decoded)) {
            foreach ($decoded as $p) {
                if (is_array($p) && !empty($p['id'])) {
                    $products[(string)$p['id']] = $p;
                }
            }
        }
    }

    $computedSubtotal = 0.0;
    foreach ($rawItems as $it) {
        if (!is_array($it)) continue;
        $qty = (int)round($toMoney($it['quantity'] ?? 0, 0.0));
        if ($qty < 1 || $qty > 50) {
            return [
                'valid' => false,
                'code' => 'INVALID_QUANTITY',
                'error' => 'Each item quantity must be between 1 and 50.',
            ];
        }
        $prodId = trim((string)($it['productId'] ?? ''));
        $prod = $products[$prodId] ?? null;
        if (!$prod) {
            if ($allowAdminBypass) {
                $computedSubtotal += max(0.0, $toMoney($it['price'] ?? 0, 0.0)) * $qty;
                continue;
            }
            return [
                'valid' => false,
                'code' => 'UNKNOWN_PRODUCT',
                'error' => "Catalog item '{$prodId}' could not be verified.",
            ];
        }

        $catalogPrice = max(0.0, $toMoney($prod['price'] ?? 0, 0.0));
        if ($catalogPrice <= 0 && !$allowAdminBypass) {
            return [
                'valid' => false,
                'code' => 'INVALID_CATALOG_PRICE',
                'error' => 'Catalog pricing unavailable for product.',
            ];
        }
        if (isset($it['price'])) {
            $clientUnit = $toMoney($it['price'], -1.0);
            if (!$allowAdminBypass && abs($clientUnit - $catalogPrice) > 1.0) {
                return [
                    'valid' => false,
                    'code' => 'PRICE_TAMPER_DETECTED',
                    'error' => "Unit price mismatch for '{$prodId}'. Please refresh your bag and retry.",
                ];
            }
        }
        $computedSubtotal += $catalogPrice * $qty;
    }

    $promoCode = strtoupper(trim((string)($body['appliedPromo'] ?? ($body['promoCode'] ?? ''))));
    $clientDiscount = max(0.0, $toMoney($body['discount'] ?? 0, 0.0));
    $expectedDiscount = $promoCode !== '' ? vdhComputePromoDiscount($computedSubtotal, $promoCode) : 0.0;

    if (!$allowAdminBypass) {
        if ($promoCode !== '' && $expectedDiscount == 0.0 && $clientDiscount > 0.0) {
            return [
                'valid' => false,
                'code' => 'INVALID_PROMO_DISCOUNT',
                'error' => "Promo code '{$promoCode}' is invalid or minimum cart value is not met.",
            ];
        }
        if ($promoCode === '' && $clientDiscount > 0.0) {
            return [
                'valid' => false,
                'code' => 'PRICE_OR_DISCOUNT_MISMATCH',
                'error' => 'Unrecognized discount applied without a valid promotional code.',
            ];
        }
        if (abs($clientDiscount - $expectedDiscount) > 2.0) {
            return [
                'valid' => false,
                'code' => 'PRICE_OR_DISCOUNT_MISMATCH',
                'error' => 'Promotional discount amount does not match server calculation.',
            ];
        }
    }

    $finalDiscount = $allowAdminBypass ? $clientDiscount : $expectedDiscount;
    $expectedDelivery = $computedSubtotal > 0.0 ? 100.0 : 0.0;
    $deliveryCharge = ($allowAdminBypass && array_key_exists('deliveryCharge', $body))
        ? max(0.0, $toMoney($body['deliveryCharge'], $expectedDelivery))
        : $expectedDelivery;

    if (!$allowAdminBypass && array_key_exists('deliveryCharge', $body)) {
        $clientDelivery = $toMoney($body['deliveryCharge'], -1.0);
        if (abs($clientDelivery - $expectedDelivery) > 2.0) {
            return [
                'valid' => false,
                'code' => 'DELIVERY_CHARGE_MISMATCH',
                'error' => 'Shipping charge does not match standard ₹100 flat delivery.',
            ];
        }
    }

    $expectedTotal = max(1.0, round($computedSubtotal - $finalDiscount + $deliveryCharge, 2));
    $clientTotal = $toMoney($body['orderAmount'] ?? ($body['totalAmount'] ?? ($body['total'] ?? 0)), 0.0);

    if (!$allowAdminBypass && $clientTotal > 0.0 && abs($clientTotal - $expectedTotal) > 2.0) {
        return [
            'valid' => false,
            'code' => 'TOTAL_AMOUNT_MISMATCH',
            'error' => "Submitted order total (₹{$clientTotal}) does not match verified server total (₹{$expectedTotal}).",
        ];
    }

    return [
        'valid' => true,
        'subtotal' => $computedSubtotal,
        'discount' => $finalDiscount,
        'deliveryCharge' => $deliveryCharge,
        'totalAmount' => ($allowAdminBypass && $clientTotal > 0.0) ? $clientTotal : $expectedTotal,
        'appliedPromo' => $promoCode,
    ];
}

function vdhSendJson(int $status, array $payload): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function vdhGetAllHeadersLower(): array {
    $headers = [];
    if (function_exists('getallheaders')) {
        $raw = @getallheaders();
        if (is_array($raw)) {
            foreach ($raw as $k => $v) {
                $headers[strtolower((string)$k)] = trim((string)$v);
            }
        }
    } elseif (function_exists('apache_request_headers')) {
        $raw = @apache_request_headers();
        if (is_array($raw)) {
            foreach ($raw as $k => $v) {
                $headers[strtolower((string)$k)] = trim((string)$v);
            }
        }
    }
    return $headers;
}

function vdhExtractBearerOrHeader(string $customHeaderKey): string {
    $headers = vdhGetAllHeadersLower();
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $customHeaderKey));

    $custom = trim((string)($_SERVER[$serverKey] ?? ($headers[strtolower($customHeaderKey)] ?? '')));
    if ($custom !== '') return $custom;

    $auth = trim((string)(
        $_SERVER['HTTP_AUTHORIZATION']
        ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? ($headers['authorization'] ?? ''))
    ));
    if ($auth !== '' && stripos($auth, 'Bearer ') === 0) {
        return trim(substr($auth, 7));
    }
    return '';
}

function vdhExtractAdminToken(): string {
    return vdhExtractBearerOrHeader('x-admin-token');
}

function vdhExtractCustomerToken(): string {
    $hdr = vdhExtractBearerOrHeader('x-customer-token');
    if ($hdr !== '') return $hdr;
    return vdhExtractBearerOrHeader('x-admin-token');
}

function vdhExtractOrderReceiptToken(): string {
    $headers = vdhGetAllHeadersLower();
    $hdr = trim((string)($_SERVER['HTTP_X_ORDER_TOKEN'] ?? ($headers['x-order-token'] ?? '')));
    if ($hdr !== '') return $hdr;
    return trim((string)($_GET['token'] ?? ''));
}

function vdhAllowedAdminEmails(): array {
    $emails = ['anavneeraj2003@gmail.com'];
    $envEmail = strtolower(vdhEnv('ADMIN_EMAIL'));
    if ($envEmail !== '' && !in_array($envEmail, $emails, true)) {
        $emails[] = $envEmail;
    }
    return $emails;
}

function vdhSignSessionToken(array $claims, int $ttlSeconds): string {
    $now = time();
    $payload = array_merge($claims, [
        'jti' => bin2hex(random_bytes(16)),
        'iat' => $now,
        'exp' => $now + $ttlSeconds,
    ]);
    $encoded = vdhBase64UrlEncode((string)json_encode($payload, JSON_UNESCAPED_SLASHES));
    $sig = vdhBase64UrlEncode(hash_hmac('sha256', "v1.$encoded", vdhGetSessionSecret(), true));
    return "v1.$encoded.$sig";
}

function vdhRevokedTokensFile(): string {
    return vdhRuntimeStateDir() . '/revoked-tokens.json';
}

function vdhIsTokenRevoked(string $jti): bool {
    if ($jti === '') return false;
    $file = vdhRevokedTokensFile();
    if (!is_file($file)) return false;
    $raw = @file_get_contents($file);
    $map = $raw ? json_decode($raw, true) : null;
    if (!is_array($map) || !isset($map[$jti])) return false;
    return ((int)$map[$jti]) >= time();
}

function vdhRevokeSessionToken(string $token): void {
    $verified = vdhVerifySignedSessionToken($token);
    if (!$verified) return;
    $jti = (string)($verified['jti'] ?? '');
    $exp = (int)($verified['exp'] ?? (time() + VDH_ADMIN_TTL_SECONDS));
    if ($jti === '') return;

    $file = vdhRevokedTokensFile();
    $lockFile = vdhTempStateDir() . '/revoked.lock';
    $fp = @fopen($lockFile, 'c+');
    if ($fp) @flock($fp, LOCK_EX);
    $now = time();
    $map = [];
    if (is_file($file)) {
        $decoded = json_decode((string)@file_get_contents($file), true);
        if (is_array($decoded)) {
            foreach ($decoded as $k => $v) {
                if ((int)$v > $now) $map[$k] = (int)$v;
            }
        }
    }
    $map[$jti] = $exp;
    @file_put_contents($file, json_encode($map), LOCK_EX);
    @chmod($file, 0600);
    if ($fp) {
        @flock($fp, LOCK_UN);
        @fclose($fp);
    }
}

function vdhVerifySignedSessionToken(string $token, ?string $expectedType = null): ?array {
    $token = trim($token);
    if ($token === '') return null;
    $parts = explode('.', $token);
    if (count($parts) !== 3 || $parts[0] !== 'v1') return null;

    $expectedSig = vdhBase64UrlEncode(hash_hmac('sha256', "v1.{$parts[1]}", vdhGetSessionSecret(), true));
    if (!hash_equals($expectedSig, $parts[2])) return null;

    $json = vdhBase64UrlDecode($parts[1]);
    if ($json === false) return null;
    $payload = json_decode($json, true);
    if (!is_array($payload)) return null;

    $now = time();
    if (empty($payload['exp']) || (int)$payload['exp'] < $now) return null;
    if ($expectedType !== null && ($payload['type'] ?? '') !== $expectedType) return null;
    if (!empty($payload['jti']) && vdhIsTokenRevoked((string)$payload['jti'])) return null;

    return $payload;
}

function vdhFetchGoogleCerts(): array {
    $cacheFile = vdhTempStateDir() . '/firebase_google_certs.json';
    if (is_file($cacheFile)) {
        $cached = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($cached) && ($cached['expiresAt'] ?? 0) > time() && !empty($cached['certs'])) {
            return $cached['certs'];
        }
    }

    $url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    $body = false;
    $maxAge = 3600;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $resp = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $hdrSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        if ($resp !== false && $status >= 200 && $status < 300) {
            $hdrs = substr($resp, 0, $hdrSize);
            $body = substr($resp, $hdrSize);
            if (preg_match('/cache-control:[^\r\n]*max-age=(\d+)/i', $hdrs, $m)) {
                $maxAge = max(60, (int)$m[1]);
            }
        }
    }

    $certs = is_string($body) ? json_decode($body, true) : null;
    if (is_array($certs) && !empty($certs)) {
        @file_put_contents($cacheFile, json_encode(['expiresAt' => time() + $maxAge, 'certs' => $certs]), LOCK_EX);
        return $certs;
    }

    if (is_file($cacheFile)) {
        $cached = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($cached) && !empty($cached['certs'])) return $cached['certs'];
    }
    return [];
}

function vdhVerifyFirebaseIdToken(string $idToken): ?array {
    $idToken = trim($idToken);
    $parts = explode('.', $idToken);
    if (count($parts) !== 3 || !function_exists('openssl_verify')) return null;

    $headerJson = vdhBase64UrlDecode($parts[0]);
    $payloadJson = vdhBase64UrlDecode($parts[1]);
    $sig = vdhBase64UrlDecode($parts[2]);
    if ($headerJson === false || $payloadJson === false || $sig === false) return null;

    $header = json_decode($headerJson, true);
    $payload = json_decode($payloadJson, true);
    if (!is_array($header) || !is_array($payload)) return null;
    if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) return null;

    $now = time();
    $aud = (string)($payload['aud'] ?? '');
    $iss = (string)($payload['iss'] ?? '');
    $sub = (string)($payload['sub'] ?? '');
    $exp = (int)($payload['exp'] ?? 0);
    $iat = (int)($payload['iat'] ?? 0);

    if ($aud !== VDH_FIREBASE_PROJECT_ID) return null;
    if ($iss !== 'https://securetoken.google.com/' . VDH_FIREBASE_PROJECT_ID) return null;
    if ($sub === '' || $exp <= $now || $iat > ($now + 300)) return null;

    $certs = vdhFetchGoogleCerts();
    $certPem = $certs[$header['kid']] ?? null;
    if (!is_string($certPem) || $certPem === '') return null;

    $pubKey = @openssl_pkey_get_public($certPem);
    if (!$pubKey) return null;

    $ok = @openssl_verify("{$parts[0]}.{$parts[1]}", $sig, $pubKey, OPENSSL_ALGO_SHA256);
    if ($ok !== 1) return null;

    return $payload;
}

function vdhAuthenticateAdmin(): ?array {
    $token = vdhExtractAdminToken();
    if ($token === '') return null;

    $session = vdhVerifySignedSessionToken($token, 'admin');
    if ($session && in_array(strtolower((string)($session['email'] ?? '')), vdhAllowedAdminEmails(), true)) {
        return [
            'email' => strtolower((string)$session['email']),
            'role' => 'admin',
            'name' => (string)($session['name'] ?? 'Executive Administrator'),
            'authMethod' => (string)($session['authMethod'] ?? 'session')
        ];
    }

    $fb = vdhVerifyFirebaseIdToken($token);
    if ($fb) {
        $fbEmail = strtolower(trim((string)($fb['email'] ?? '')));
        if (($fb['email_verified'] ?? false) === true && in_array($fbEmail, vdhAllowedAdminEmails(), true)) {
            return [
                'email' => $fbEmail,
                'role' => 'admin',
                'uid' => (string)$fb['sub'],
                'name' => (string)($fb['name'] ?? 'Executive Administrator'),
                'authMethod' => 'firebase'
            ];
        }
    }

    return null;
}

function vdhRequireAdmin(): array {
    $admin = vdhAuthenticateAdmin();
    if (!$admin) {
        vdhSendJson(401, [
            'success' => false,
            'error' => 'Unauthorized: Valid verified administrator session is required.'
        ]);
    }
    return $admin;
}

function vdhNormalizePhone10(string $raw): string {
    $digits = preg_replace('/\D+/', '', $raw);
    if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
        return substr($digits, 2);
    }
    if (strlen($digits) === 11 && str_starts_with($digits, '0')) {
        return substr($digits, 1);
    }
    return strlen($digits) >= 10 ? substr($digits, -10) : $digits;
}

function vdhAuthenticateCustomer(): ?array {
    $admin = vdhAuthenticateAdmin();
    if ($admin) {
        return array_merge($admin, ['isAdmin' => true]);
    }

    $token = vdhExtractCustomerToken();
    if ($token === '') return null;

    $patron = vdhVerifySignedSessionToken($token, 'patron');
    if ($patron) {
        return [
            'isAdmin' => false,
            'uid' => (string)($patron['uid'] ?? ($patron['sub'] ?? '')),
            'email' => strtolower(trim((string)($patron['email'] ?? ''))),
            'phone10' => vdhNormalizePhone10((string)($patron['mobile'] ?? ($patron['phone'] ?? ''))),
            'role' => 'customer'
        ];
    }

    $fb = vdhVerifyFirebaseIdToken($token);
    if ($fb) {
        return [
            'isAdmin' => false,
            'uid' => (string)($fb['sub'] ?? ''),
            'email' => strtolower(trim((string)($fb['email'] ?? ''))),
            'phone10' => vdhNormalizePhone10((string)($fb['phone_number'] ?? '')),
            'role' => 'customer'
        ];
    }

    return null;
}

function vdhOrderReceiptToken(array $order): string {
    $keyData = implode('|', [
        (string)($order['id'] ?? ''),
        (string)($order['orderNumber'] ?? ''),
        (string)($order['createdAt'] ?? '')
    ]);
    return vdhBase64UrlEncode(hash_hmac('sha256', "receipt:$keyData", vdhGetSessionSecret(), true));
}

function vdhHasValidOrderReceiptToken(array $order, string $providedToken): bool {
    if ($providedToken === '') return false;
    $expected = vdhOrderReceiptToken($order);
    return hash_equals($expected, trim($providedToken));
}

function vdhCustomerOwnsOrder(array $customer, array $order): bool {
    if (!empty($customer['isAdmin'])) return true;
    $cUid = trim((string)($customer['uid'] ?? ''));
    $cEmail = strtolower(trim((string)($customer['email'] ?? '')));
    $cPhone = vdhNormalizePhone10((string)($customer['phone10'] ?? ''));

    $oUid = trim((string)($order['userId'] ?? ''));
    $oEmail = strtolower(trim((string)($order['customerEmail'] ?? '')));
    $oPhone = vdhNormalizePhone10((string)($order['customerPhone'] ?? ($order['shippingAddress']['phone'] ?? '')));

    if ($cUid !== '' && $oUid !== '' && hash_equals($cUid, $oUid)) return true;
    if ($cEmail !== '' && $oEmail !== '' && !str_ends_with($cEmail, '@phone.vidhyaajewellery.com') && hash_equals($cEmail, $oEmail)) return true;
    if ($cPhone !== '' && $oPhone !== '' && hash_equals($cPhone, $oPhone)) return true;
    return false;
}

function vdhSanitizePublicOrderTracking(array $order): array {
    $addr = is_array($order['shippingAddress'] ?? null) ? $order['shippingAddress'] : [];
    return [
        'id' => (string)($order['id'] ?? ''),
        'orderNumber' => (string)($order['orderNumber'] ?? ''),
        'orderStatus' => (string)($order['orderStatus'] ?? 'Pending'),
        'paymentStatus' => (string)($order['paymentStatus'] ?? 'pending'),
        'isPaid' => (bool)($order['isPaid'] ?? false),
        'paymentMethod' => (string)($order['paymentMethod'] ?? 'Online Payment'),
        'subtotal' => (float)($order['subtotal'] ?? ($order['totalAmount'] ?? 0)),
        'discount' => (float)($order['discount'] ?? 0),
        'deliveryCharge' => (float)($order['deliveryCharge'] ?? 0),
        'total' => (float)($order['total'] ?? ($order['totalAmount'] ?? 0)),
        'totalAmount' => (float)($order['totalAmount'] ?? 0),
        'currency' => (string)($order['currency'] ?? 'INR'),
        'courierName' => (string)($order['courierName'] ?? ''),
        'trackingNumber' => (string)($order['trackingNumber'] ?? ''),
        'giftItem' => $order['giftItem'] ?? null,
        'paymentEnv' => $order['paymentEnv'] ?? null,
        'isTestOrder' => (bool)($order['isTestOrder'] ?? false),
        'items' => array_values(array_map(function ($it) {
            return [
                'productId' => (string)($it['productId'] ?? ''),
                'productName' => (string)($it['productName'] ?? 'Jewellery Item'),
                'variationId' => (string)($it['variationId'] ?? ''),
                'variationName' => (string)($it['variationName'] ?? ''),
                'quantity' => (int)($it['quantity'] ?? 1),
                'price' => (float)($it['price'] ?? 0),
                'image' => (string)($it['image'] ?? ''),
            ];
        }, is_array($order['items'] ?? null) ? $order['items'] : [])),
        'shippingAddress' => [
            'id' => 'redacted',
            'name' => '',
            'phone' => '',
            'street' => '',
            'landmark' => '',
            'city' => (string)($addr['city'] ?? ''),
            'state' => (string)($addr['state'] ?? ''),
            'pincode' => (string)($addr['pincode'] ?? ''),
        ],
        'customerName' => '',
        'customerEmail' => '',
        'customerPhone' => '',
        'upiReference' => '',
        'createdAt' => (string)($order['createdAt'] ?? ''),
        'updatedAt' => (string)($order['updatedAt'] ?? ''),
        'redactedPii' => true
    ];
}

function vdhSalsa20_8(array &$b): void {
    $x = $b;
    for ($i = 0; $i < 8; $i += 2) {
        $s = ($x[0] + $x[12]) & 0xFFFFFFFF;  $x[4]  ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[4] + $x[0])  & 0xFFFFFFFF;  $x[8]  ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[8] + $x[4])  & 0xFFFFFFFF;  $x[12] ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[12] + $x[8]) & 0xFFFFFFFF;  $x[0]  ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[5] + $x[1])  & 0xFFFFFFFF;  $x[9]  ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[9] + $x[5])  & 0xFFFFFFFF;  $x[13] ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[13] + $x[9]) & 0xFFFFFFFF;  $x[1]  ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[1] + $x[13]) & 0xFFFFFFFF;  $x[5]  ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[10] + $x[6])  & 0xFFFFFFFF; $x[14] ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[14] + $x[10]) & 0xFFFFFFFF; $x[2]  ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[2] + $x[14])  & 0xFFFFFFFF; $x[6]  ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[6] + $x[2])   & 0xFFFFFFFF; $x[10] ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[15] + $x[11]) & 0xFFFFFFFF; $x[3]  ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[3] + $x[15])  & 0xFFFFFFFF; $x[7]  ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[7] + $x[3])   & 0xFFFFFFFF; $x[11] ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[11] + $x[7])  & 0xFFFFFFFF; $x[15] ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[0] + $x[3]) & 0xFFFFFFFF;   $x[1] ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[1] + $x[0]) & 0xFFFFFFFF;   $x[2] ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[2] + $x[1]) & 0xFFFFFFFF;   $x[3] ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[3] + $x[2]) & 0xFFFFFFFF;   $x[0] ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[5] + $x[4]) & 0xFFFFFFFF;   $x[6] ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[6] + $x[5]) & 0xFFFFFFFF;   $x[7] ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[7] + $x[6]) & 0xFFFFFFFF;   $x[4] ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[4] + $x[7]) & 0xFFFFFFFF;   $x[5] ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[10] + $x[9])  & 0xFFFFFFFF; $x[11] ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[11] + $x[10]) & 0xFFFFFFFF; $x[8]  ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[8] + $x[11])  & 0xFFFFFFFF; $x[9]  ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[9] + $x[8])   & 0xFFFFFFFF; $x[10] ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));

        $s = ($x[15] + $x[14]) & 0xFFFFFFFF; $x[12] ^= ((($s << 7) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 25) & 0x7F));
        $s = ($x[12] + $x[15]) & 0xFFFFFFFF; $x[13] ^= ((($s << 9) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 23) & 0x1FF));
        $s = ($x[13] + $x[12]) & 0xFFFFFFFF; $x[14] ^= ((($s << 13) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 19) & 0x1FFF));
        $s = ($x[14] + $x[13]) & 0xFFFFFFFF; $x[15] ^= ((($s << 18) & 0xFFFFFFFF) | ((($s & 0xFFFFFFFF) >> 14) & 0x3FFFF));
    }
    for ($i = 0; $i < 16; $i++) {
        $b[$i] = ($b[$i] + $x[$i]) & 0xFFFFFFFF;
    }
}

function vdhScryptBlockMix(array $bWords, int $r): array {
    $blocks = 2 * $r;
    $lastStart = ($blocks - 1) * 16;
    $x = array_slice($bWords, $lastStart, 16);
    $y = array_fill(0, $blocks * 16, 0);

    for ($i = 0; $i < $blocks; $i++) {
        $offset = $i * 16;
        for ($k = 0; $k < 16; $k++) {
            $x[$k] ^= $bWords[$offset + $k];
        }
        vdhSalsa20_8($x);
        $outBlock = (($i & 1) === 0) ? ($i >> 1) : ($r + ($i >> 1));
        $outOffset = $outBlock * 16;
        for ($k = 0; $k < 16; $k++) {
            $y[$outOffset + $k] = $x[$k];
        }
    }
    return $y;
}

function vdhScrypt(string $password, string $salt, int $n = 16384, int $r = 8, int $p = 1, int $dkLen = 64): string {
    $blockBytes = 128 * $r;
    $wordsPerBlock = 32 * $r;
    $packFmt = 'V' . $wordsPerBlock;
    $b = hash_pbkdf2('sha256', $password, $salt, 1, $p * $blockBytes, true);
    $mixed = '';
    $nMask = $n - 1;
    $intIdx = (2 * $r - 1) * 16;

    for ($bi = 0; $bi < $p; $bi++) {
        $chunk = substr($b, $bi * $blockBytes, $blockBytes);
        $x = array_values(unpack($packFmt, $chunk));
        $v = new \SplFixedArray($n);
        for ($i = 0; $i < $n; $i++) {
            $v[$i] = pack($packFmt, ...$x);
            $x = vdhScryptBlockMix($x, $r);
        }
        for ($i = 0; $i < $n; $i++) {
            $j = $x[$intIdx] & $nMask;
            $vj = array_values(unpack($packFmt, $v[$j]));
            for ($k = 0; $k < $wordsPerBlock; $k++) {
                $x[$k] ^= $vj[$k];
            }
            $x = vdhScryptBlockMix($x, $r);
        }
        $mixed .= pack($packFmt, ...$x);
    }

    return hash_pbkdf2('sha256', $password, $mixed, 1, $dkLen, true);
}

function vdhVerifyPasswordHash(string $password, string $storedHash): bool {
    $storedHash = trim($storedHash);
    if ($storedHash === '' || $password === '') return false;

    if (str_starts_with($storedHash, '$2y$') || str_starts_with($storedHash, '$2a$') || str_starts_with($storedHash, '$2b$') || str_starts_with($storedHash, '$argon2')) {
        return password_verify($password, $storedHash);
    }

    if (str_starts_with($storedHash, 'pbkdf2_sha256:')) {
        $parts = explode(':', $storedHash);
        if (count($parts) === 4) {
            $iters = max(10000, (int)$parts[1]);
            $salt = $parts[2];
            $expected = strtolower(trim($parts[3]));
            $hexLen = strlen($expected);
            if ($hexLen < 32 || $hexLen > 256 || ($hexLen % 2) !== 0 || !preg_match('/^[0-9a-f]+$/', $expected)) {
                return false;
            }
            $actual = hash_pbkdf2('sha256', $password, $salt, $iters, $hexLen, false);
            return hash_equals($expected, $actual);
        }
        return false;
    }

    if (str_starts_with($storedHash, 'sha256:')) {
        $parts = explode(':', $storedHash, 3);
        if (count($parts) === 3) {
            $actual = hash('sha256', $parts[1] . ':' . $password);
            return hash_equals(strtolower($parts[2]), $actual);
        }
        return false;
    }

    // Legacy Node scrypt format from data/patrons.json (<saltHex>:<128-hex-hash>)
    if (preg_match('/^([0-9a-f]{16,64}):([0-9a-f]{128})$/i', $storedHash, $m)) {
        $salt = $m[1];
        $expected = strtolower($m[2]);
        $actual = bin2hex(vdhScrypt($password, $salt, 16384, 8, 1, 64));
        return hash_equals($expected, $actual);
    }

    return false;
}

function vdhHashPassword(string $password): string {
    $salt = bin2hex(random_bytes(16));
    $iters = 100000;
    $hash = hash_pbkdf2('sha256', $password, $salt, $iters, 64, false);
    return "pbkdf2_sha256:{$iters}:{$salt}:{$hash}";
}

function vdhBase32Decode(string $input): string {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $clean = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $input));
    $binary = '';
    $len = strlen($clean);
    for ($i = 0; $i < $len; $i++) {
        $pos = strpos($alphabet, $clean[$i]);
        if ($pos === false) continue;
        $binary .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
    }
    $bytes = '';
    $binLen = strlen($binary);
    for ($i = 0; $i + 8 <= $binLen; $i += 8) {
        $bytes .= chr(bindec(substr($binary, $i, 8)));
    }
    return $bytes;
}

function vdhVerifyTotp(string $secretBase32, string $code): bool {
    $clean = preg_replace('/\s+/', '', $code);
    if (!preg_match('/^\d{6}$/', $clean)) return false;
    $key = vdhBase32Decode($secretBase32);
    if ($key === '') return false;
    $timeStep = (int)floor(time() / 30);
    for ($offset = -1; $offset <= 1; $offset++) {
        $counter = pack('N*', 0, $timeStep + $offset);
        $hmac = hash_hmac('sha1', $counter, $key, true);
        $pos = ord(substr($hmac, -1)) & 0x0F;
        $binary = (
            ((ord($hmac[$pos]) & 0x7F) << 24) |
            ((ord($hmac[$pos + 1]) & 0xFF) << 16) |
            ((ord($hmac[$pos + 2]) & 0xFF) << 8) |
            (ord($hmac[$pos + 3]) & 0xFF)
        );
        $otp = str_pad((string)($binary % 1000000), 6, '0', STR_PAD_LEFT);
        if (hash_equals($otp, $clean)) return true;
    }
    return false;
}

function vdhLoadAdminCredentialsConfig(): array {
    $root = vdhRootDir();
    $dirs = [];
    $override = vdhEnv('VIDHYAA_SECRETS_DIR');
    if ($override !== '') {
        $dirs[] = rtrim($override, '/\\');
    }
    $dirs[] = dirname($root) . '/.admin-secrets';
    $dirs[] = dirname($root) . '/.vidhyaa-secrets';
    $dirs[] = dirname($root);
    $dirs[] = dirname($root, 2) . '/.admin-secrets';
    $dirs[] = $root . '/.admin-secrets';

    $candidates = [];
    foreach ($dirs as $dir) {
        $candidates[] = $dir . '/admin-credentials.json';
        $candidates[] = $dir . '/admin-auth.json';
    }

    $cfg = [];
    foreach ($candidates as $cand) {
        if (!vdhIsPathPermittedByOpenBasedir($cand)) {
            continue;
        }
        if (@is_file($cand) && @is_readable($cand)) {
            $parsed = json_decode((string)@file_get_contents($cand), true);
            if (is_array($parsed)) {
                $cfg = $parsed;
                break;
            }
        }
    }
    $envPasswordHash = vdhEnv('ADMIN_PASSWORD_HASH');
    $envPlainPassword = vdhEnv('ADMIN_PASSWORD');
    $envTotpSecret = vdhEnv('ADMIN_TOTP_SECRET');

    $passwordHash = $envPasswordHash !== '' ? $envPasswordHash : trim((string)($cfg['passwordHash'] ?? ($cfg['adminPasswordHash'] ?? '')));
    $plainPassword = $envPlainPassword !== '' ? $envPlainPassword : trim((string)($cfg['password'] ?? ''));
    $totpSecret = $envTotpSecret;
    if ($totpSecret === '') {
        $totpSecret = trim((string)($cfg['totpSecret'] ?? ''));
        if ($totpSecret === '' && is_array($cfg['totp'] ?? null)) {
            $totpSecret = trim((string)($cfg['totp']['secretBase32'] ?? ''));
        }
    }
    $backupCodes = is_array($cfg['backupCodes'] ?? null) ? $cfg['backupCodes'] : [];
    $backupPepper = trim((string)($cfg['backupPepper'] ?? ''));
    $backupCodeHashes = is_array($cfg['backupCodeHashes'] ?? null) ? $cfg['backupCodeHashes'] : [];
    $sessionSigningSecret = trim((string)($cfg['sessionSigningSecret'] ?? ''));
    return [
        'passwordHash' => $passwordHash,
        'plainPassword' => $plainPassword,
        'totpSecret' => $totpSecret,
        'backupCodes' => $backupCodes,
        'backupPepper' => $backupPepper,
        'backupCodeHashes' => $backupCodeHashes,
        'sessionSigningSecret' => $sessionSigningSecret,
        'hasEnvPasswordOverride' => ($envPasswordHash !== '' || $envPlainPassword !== ''),
        'hasPasswordAuth' => ($passwordHash !== '' || $plainPassword !== ''),
    ];
}

function vdhVerifyAdminBackupCode(array $creds, string $totpCode): bool {
    $normalized = strtoupper(trim($totpCode));
    if ($normalized === '') return false;
    foreach (($creds['backupCodes'] ?? []) as $code) {
        if (is_string($code) && hash_equals(strtoupper(trim($code)), $normalized)) {
            return true;
        }
    }
    $pepper = (string)($creds['backupPepper'] ?? '');
    $hashes = $creds['backupCodeHashes'] ?? [];
    if ($pepper !== '' && is_array($hashes) && !empty($hashes)) {
        $digest = hash_hmac('sha256', $normalized, $pepper);
        foreach ($hashes as $expectedHex) {
            if (is_string($expectedHex) && hash_equals(strtolower(trim($expectedHex)), $digest)) {
                return true;
            }
        }
    }
    return false;
}

function vdhCheckRateLimit(string $bucketKey): array {
    $file = vdhTempStateDir() . '/ratelimit_' . md5($bucketKey) . '.json';
    $now = time();
    if (!is_file($file)) {
        return ['allowed' => true, 'remainingSeconds' => 0];
    }
    $data = json_decode((string)@file_get_contents($file), true);
    if (!is_array($data)) {
        return ['allowed' => true, 'remainingSeconds' => 0];
    }
    $lockUntil = (int)($data['lockoutUntil'] ?? 0);
    if ($lockUntil > $now) {
        return ['allowed' => false, 'remainingSeconds' => $lockUntil - $now];
    }
    if (($data['lastAttempt'] ?? 0) < ($now - VDH_RATE_LIMIT_WINDOW_SECONDS)) {
        @unlink($file);
    }
    return ['allowed' => true, 'remainingSeconds' => 0];
}

function vdhRecordRateLimitFailure(string $bucketKey): array {
    $file = vdhTempStateDir() . '/ratelimit_' . md5($bucketKey) . '.json';
    $now = time();
    $data = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
    if (!is_array($data) || (($data['lastAttempt'] ?? 0) < ($now - VDH_RATE_LIMIT_WINDOW_SECONDS))) {
        $data = ['attempts' => 0, 'lockoutUntil' => 0, 'lastAttempt' => $now];
    }
    $data['attempts'] = ((int)($data['attempts'] ?? 0)) + 1;
    $data['lastAttempt'] = $now;
    if ($data['attempts'] >= VDH_RATE_LIMIT_MAX_ATTEMPTS) {
        $data['lockoutUntil'] = $now + VDH_RATE_LIMIT_WINDOW_SECONDS;
    }
    @file_put_contents($file, json_encode($data), LOCK_EX);
    return [
        'locked' => ($data['lockoutUntil'] ?? 0) > $now,
        'remainingSeconds' => max(0, (int)($data['lockoutUntil'] ?? 0) - $now),
    ];
}

function vdhClearRateLimit(string $bucketKey): void {
    $file = vdhTempStateDir() . '/ratelimit_' . md5($bucketKey) . '.json';
    if (is_file($file)) @unlink($file);
}

function vdhNormalizeHostname(string $raw): string {
    $parts = explode(',', $raw);
    $first = strtolower(trim((string)($parts[0] ?? '')));
    if ($first === '') return '';
    if (str_starts_with($first, '[')) {
        $end = strpos($first, ']');
        return $end !== false ? substr($first, 0, $end + 1) : $first;
    }
    return (string)preg_replace('/:\d+$/', '', $first);
}

function vdhIsTrustedProxyIp(string $addr): bool {
    $ip = strtolower(trim($addr));
    if ($ip === '') return false;
    if ($ip === '127.0.0.1' || $ip === '::1' || $ip === '::ffff:127.0.0.1') return true;
    $clean = str_starts_with($ip, '::ffff:') ? substr($ip, 7) : $ip;
    if (str_starts_with($clean, '10.') || str_starts_with($clean, '192.168.')) return true;
    if (preg_match('/^172\.(\d+)\./', $clean, $m)) {
        $second = (int)$m[1];
        if ($second >= 16 && $second <= 31) return true;
    }
    return false;
}

function vdhIsLiveProductionHost(): bool {
    $livePattern = '/^(?:www\.)?vidhyaajewellerystudio\.com$/i';
    $directHost = vdhNormalizeHostname((string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($directHost !== '' && preg_match($livePattern, $directHost)) {
        return true;
    }

    $serverName = vdhNormalizeHostname((string)($_SERVER['SERVER_NAME'] ?? ''));
    if ($directHost === '' && $serverName !== '' && preg_match($livePattern, $serverName)) {
        return true;
    }

    $remoteAddr = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $canTrustForwarded = vdhIsTrustedProxyIp($remoteAddr)
        || $directHost === ''
        || $directHost === 'localhost'
        || $directHost === '127.0.0.1';

    if ($canTrustForwarded) {
        $fwdHost = vdhNormalizeHostname((string)($_SERVER['HTTP_X_FORWARDED_HOST'] ?? ''));
        if ($fwdHost !== '' && preg_match($livePattern, $fwdHost)) {
            return true;
        }
    }

    return false;
}

function vdhWithFileLock(string $lockName, callable $callback) {
    $lockPath = vdhTempStateDir() . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $lockName) . '.lock';
    $fp = @fopen($lockPath, 'c+');
    if ($fp) {
        @flock($fp, LOCK_EX);
    }
    try {
        return $callback();
    } finally {
        if ($fp) {
            @flock($fp, LOCK_UN);
            @fclose($fp);
        }
    }
}

function vdhAtomicWriteFile(string $path, string $contents): bool {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $tmpPath = $path . '.tmp_' . getmypid() . '_' . bin2hex(random_bytes(3));
    if (@file_put_contents($tmpPath, $contents, LOCK_EX) !== false) {
        if (@rename($tmpPath, $path)) {
            return true;
        }
        @unlink($tmpPath);
    }
    return @file_put_contents($path, $contents, LOCK_EX) !== false;
}
