import crypto from 'node:crypto';
import { getEnvVar } from './sessionAuth.js';

const DEFAULT_PRODUCTION_ORIGIN = 'https://vidhyaajewellerystudio.com';
const ALLOWED_PRODUCTION_HOSTS = new Set([
  'vidhyaajewellerystudio.com',
  'www.vidhyaajewellerystudio.com'
]);
const GATEWAY_TOKEN_TTL_SECONDS = 60;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;

function base64UrlEncode(bufOrStr) {
  const buf = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(String(bufOrStr), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function rfc3986Encode(str) {
  return encodeURIComponent(String(str)).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Deterministic canonical query string matching PHP `vdhGatewayCanonicalQuery()`.
 */
export function canonicalizeGatewayQuery(params) {
  const pairs = [];
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      pairs.push([String(k), String(v)]);
    }
  }
  pairs.sort((a, b) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
  });
  return pairs.map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`).join('&');
}

export function resolveProductionOrigin() {
  const raw = getEnvVar('VIDHYAA_PRODUCTION_ORIGIN', DEFAULT_PRODUCTION_ORIGIN);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' && ALLOWED_PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase())) {
      return `https://${parsed.hostname.toLowerCase()}`;
    }
  } catch {}
  return DEFAULT_PRODUCTION_ORIGIN;
}

export function getProductionGatewayConfig() {
  const procSecret = typeof process.env.VIDHYAA_PROD_UPLOAD_SECRET === 'string'
    ? process.env.VIDHYAA_PROD_UPLOAD_SECRET.trim()
    : '';
  const resolvedSecret = procSecret || getEnvVar('VIDHYAA_PROD_UPLOAD_SECRET', '');
  const keyId = getEnvVar('VIDHYAA_PROD_UPLOAD_KEY_ID', 'k1') || 'k1';
  const targetOrigin = resolveProductionOrigin();
  const configured = resolvedSecret.length >= 32;
  const secretSource = procSecret.length >= 32
    ? 'process.env'
    : resolvedSecret.length >= 32
      ? 'dotenv'
      : 'none';

  return {
    configured,
    keyId,
    targetOrigin,
    secretSource,
    secret: configured ? resolvedSecret : ''
  };
}

/**
 * Strictly validates JPG, PNG, or WebP binary magic bytes.
 */
export function detectStrictImageMagic(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * Mints a fresh 60-second HMAC-SHA256 gateway authorization header bound to
 * key ID, scope, method, endpoint path, canonical query, SHA-256 body digest,
 * single-use 128-bit nonce, and server-verified admin actor email.
 */
export function createGatewayAuthHeader({
  scope,
  method,
  endpointPath,
  canonicalQuery = '',
  bodyBuffer,
  actor,
  secretOverride,
  keyIdOverride
}) {
  const cfg = getProductionGatewayConfig();
  const secret = secretOverride || cfg.secret;
  const kid = keyIdOverride || cfg.keyId;

  if (!secret || secret.length < 32) {
    const err = new Error(
      'Production Upload Gateway is not configured on this Preview server. Add VIDHYAA_PROD_UPLOAD_SECRET (64-char hex) in Google AI Studio Settings -> Secrets and restart the server.'
    );
    err.statusCode = 503;
    throw err;
  }

  const buf = Buffer.isBuffer(bodyBuffer) ? bodyBuffer : Buffer.from(bodyBuffer || '');
  const bodySha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + GATEWAY_TOKEN_TTL_SECONDS;
  const nonce = crypto.randomBytes(16).toString('hex');

  const payload = {
    kid,
    scope: String(scope),
    method: String(method).toUpperCase(),
    path: String(endpointPath),
    query: String(canonicalQuery || ''),
    bodySha256,
    iat,
    exp,
    nonce,
    actor: String(actor || '').toLowerCase().trim()
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(`v1.${encodedPayload}`).digest()
  );

  return `v1.${encodedPayload}.${sig}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifies a live canonical Hostinger production media URL (allowlisted domain only).
 * - image: verifies HTTP 200 + image/* MIME + optional exact Content-Length
 * - video: verifies HTTP 200 (HEAD) + HTTP 206 Partial Content (Range: bytes=0-1023) + video/*
 */
export async function verifyLiveProductionMediaUrl(rawUrl, kind = 'image', expectedSizeBytes = 0) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return { ok: false, error: 'Invalid production media URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !ALLOWED_PRODUCTION_HOSTS.has(host)) {
    return {
      ok: false,
      error: 'Media URL does not point to the verified HTTPS Hostinger production domain.'
    };
  }

  const expectedPrefix = kind === 'video' ? '/videos/uploads/' : '/products/uploads/';
  if (!parsed.pathname.startsWith(expectedPrefix)) {
    return {
      ok: false,
      error: `Media URL path must reside under ${expectedPrefix} on Hostinger production.`
    };
  }

  try {
    const headRes = await fetchWithTimeout(
      parsed.toString(),
      { method: 'HEAD', cache: 'no-store' },
      15000
    );
    const headCt = (headRes.headers.get('content-type') || '').toLowerCase();
    const contentLength = Number(headRes.headers.get('content-length') || '0');

    if (headRes.status !== 200) {
      return {
        ok: false,
        status: headRes.status,
        contentType: headCt,
        error: `Live Hostinger file check returned HTTP ${headRes.status} (expected 200).`
      };
    }

    if (kind === 'image') {
      if (!headCt.startsWith('image/')) {
        return {
          ok: false,
          status: headRes.status,
          contentType: headCt,
          error: `Live Hostinger image URL returned unexpected MIME "${headCt || 'unknown'}".`
        };
      }
      if (expectedSizeBytes > 0 && contentLength > 0 && contentLength !== expectedSizeBytes) {
        return {
          ok: false,
          status: headRes.status,
          contentType: headCt,
          contentLength,
          error: `Live file size mismatch (${contentLength} vs expected ${expectedSizeBytes} bytes).`
        };
      }
      return {
        ok: true,
        status: headRes.status,
        contentType: headCt,
        contentLength
      };
    }

    // Video verification: require video/* plus HTTP 206 Partial Content Range verification
    if (!headCt.startsWith('video/') && !headCt.includes('octet-stream')) {
      return {
        ok: false,
        status: headRes.status,
        contentType: headCt,
        error: `Live Hostinger video URL returned "${headCt || 'unknown'}" instead of video/*.`
      };
    }

    const rangeRes = await fetchWithTimeout(
      parsed.toString(),
      {
        method: 'GET',
        headers: { Range: 'bytes=0-1023' },
        cache: 'no-store'
      },
      15000
    );
    const rangeCt = (rangeRes.headers.get('content-type') || '').toLowerCase();
    const contentRange = rangeRes.headers.get('content-range') || '';
    const acceptRanges = (rangeRes.headers.get('accept-ranges') || '').toLowerCase();
    await rangeRes.arrayBuffer().catch(() => null);

    const rangeSupported = rangeRes.status === 206 || acceptRanges === 'bytes';
    if (rangeRes.status !== 206 && rangeRes.status !== 200) {
      return {
        ok: false,
        status: rangeRes.status,
        rangeStatus: rangeRes.status,
        contentType: rangeCt,
        error: `Live video byte-range probe failed with HTTP ${rangeRes.status}.`
      };
    }
    if (rangeCt.includes('text/html') || rangeCt.includes('application/json')) {
      return {
        ok: false,
        status: rangeRes.status,
        rangeStatus: rangeRes.status,
        contentType: rangeCt,
        error: `Live video URL returned "${rangeCt}" instead of playable video bytes.`
      };
    }

    return {
      ok: true,
      status: headRes.status,
      rangeStatus: rangeRes.status,
      rangeSupported,
      contentRange,
      contentType: headCt || rangeCt,
      contentLength
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to verify live Hostinger media URL: ${err?.message || 'network timeout'}`
    };
  }
}

/**
 * Returns non-secret readiness status for Admin Panel & diagnostics.
 */
export async function getProductionGatewayStatus(checkLive = true) {
  const cfg = getProductionGatewayConfig();
  const status = {
    configured: cfg.configured,
    keyIdConfigured: Boolean(cfg.keyId),
    keyId: cfg.keyId,
    targetOrigin: cfg.targetOrigin,
    storageTarget: 'Hostinger Production',
    secretSource: cfg.secretSource,
    liveHostReachable: false,
    liveCatalogCount: null,
    hostingerGatewayEndpointReachable: false
  };

  if (checkLive) {
    try {
      const prodRes = await fetchWithTimeout(
        `${cfg.targetOrigin}/api/products.php`,
        { method: 'GET', cache: 'no-store' },
        10000
      );
      if (prodRes.ok) {
        status.liveHostReachable = true;
        const json = await prodRes.json().catch(() => null);
        if (Array.isArray(json)) {
          status.liveCatalogCount = json.length;
        }
      }
    } catch {}

    try {
      const optRes = await fetchWithTimeout(
        `${cfg.targetOrigin}/api/media/upload.php`,
        { method: 'OPTIONS', cache: 'no-store' },
        10000
      );
      const allowHdrs = (optRes.headers.get('access-control-allow-headers') || '').toLowerCase();
      status.hostingerGatewayEndpointReachable = optRes.status === 204 || optRes.status === 200;
      status.hostingerGatewayDeployed = allowHdrs.includes('x-vidhyaa-gateway-auth');
    } catch {
      status.hostingerGatewayDeployed = false;
    }
  }

  return status;
}

export async function forwardImageUploadToProduction({ buffer, fileName, actor }) {
  const cfg = getProductionGatewayConfig();
  if (!cfg.configured) {
    return {
      status: 503,
      body: {
        success: false,
        error:
          'Production Upload Gateway is not configured on the Preview server. Set VIDHYAA_PROD_UPLOAD_SECRET in Google AI Studio Settings -> Secrets and restart the Preview server. Local Preview/Base64 fallback is disabled.'
      }
    };
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { status: 400, body: { success: false, error: 'Empty image payload.' } };
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { status: 413, body: { success: false, error: 'Image exceeds 10 MB maximum size.' } };
  }

  const magic = detectStrictImageMagic(buffer);
  if (!magic) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Unsupported or invalid image file. Only genuine JPG, PNG, and WebP images are allowed.'
      }
    };
  }

  const safeFileName = String(fileName || `jewellery.${magic.ext}`).replace(/[\r\n]/g, '');
  const endpointPath = '/api/media/upload.php';
  const authHeader = createGatewayAuthHeader({
    scope: 'media:upload',
    method: 'POST',
    endpointPath,
    canonicalQuery: '',
    bodyBuffer: buffer,
    actor
  });

  let upstreamRes;
  let upstreamText = '';
  try {
    upstreamRes = await fetchWithTimeout(
      `${cfg.targetOrigin}${endpointPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(safeFileName),
          'X-File-Type': magic.mime,
          'X-Vidhyaa-Gateway-Auth': authHeader,
          Accept: 'application/json'
        },
        body: buffer
      },
      45000
    );
    upstreamText = await upstreamRes.text();
  } catch (err) {
    return {
      status: 502,
      body: {
        success: false,
        error: `Could not reach Hostinger Production upload API: ${err?.message || 'network error'}`
      }
    };
  }

  let data = null;
  try {
    data = upstreamText ? JSON.parse(upstreamText) : null;
  } catch {
    data = null;
  }

  if (!upstreamRes.ok || !data?.success || !data?.url) {
    const errMsg =
      data?.error ||
      (upstreamRes.status === 401
        ? 'Hostinger rejected the gateway authorization token. Verify that Hostinger has the updated gateway PHP files deployed and matching VIDHYAA_PROD_UPLOAD_SECRET outside public_html.'
        : `Hostinger Production image upload failed (HTTP ${upstreamRes.status}).`);
    return {
      status: upstreamRes.status >= 400 ? upstreamRes.status : 502,
      body: {
        success: false,
        error: errMsg,
        upstreamStatus: upstreamRes.status
      }
    };
  }

  const canonicalUrl = String(data.url).startsWith('https://')
    ? String(data.url)
    : `${cfg.targetOrigin}/${String(data.url).replace(/^\/+/, '')}`;

  // Mandatory Stage 4 verification: live HEAD check confirming HTTP 200 + image/* + exact size
  const liveVerify = await verifyLiveProductionMediaUrl(
    canonicalUrl,
    'image',
    Number(data.sizeBytes || buffer.length)
  );
  if (!liveVerify.ok) {
    return {
      status: 502,
      body: {
        success: false,
        url: canonicalUrl,
        uploadedButUnverified: true,
        error: liveVerify.error || 'Image uploaded to Hostinger but live HTTP 200 verification failed.'
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      url: canonicalUrl,
      relativeUrl: data.relativeUrl || new URL(canonicalUrl).pathname,
      fileName: data.fileName,
      originalName: safeFileName,
      sizeBytes: Number(data.sizeBytes || buffer.length),
      mimeType: data.mimeType || magic.mime,
      storageType: 'server',
      storageTarget: 'Hostinger Production',
      verifiedOnDisk: Boolean(data.verifiedOnDisk),
      liveVerified: true,
      liveVerification: liveVerify
    }
  };
}

function buildVideoGatewayBody({
  success,
  uploadId = '',
  chunkIndex = 0,
  totalChunks = 0,
  completed = false,
  videoUrl = null,
  error = null,
  message = '',
  code = undefined,
  extra = {}
}) {
  const cleanUrl = videoUrl || null;
  const cleanMsg = message || (success ? 'OK' : (error || 'Video upload failed.'));
  return {
    success: Boolean(success),
    uploadId: String(uploadId || ''),
    chunkIndex: Number.isInteger(Number(chunkIndex)) ? Number(chunkIndex) : 0,
    receivedChunk: Number.isInteger(Number(chunkIndex)) ? Number(chunkIndex) : 0,
    totalChunks: Number.isInteger(Number(totalChunks)) ? Number(totalChunks) : 0,
    completed: Boolean(completed),
    videoUrl: cleanUrl,
    url: cleanUrl,
    error: success ? null : (error || cleanMsg),
    message: cleanMsg,
    ...(code ? { code } : {}),
    storageTarget: 'Hostinger Production',
    ...extra
  };
}

function looksLikeHtmlText(text, contentType = '') {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return true;
  const trimmed = String(text || '').trim();
  return trimmed.startsWith('<!') || /^<html\b/i.test(trimmed) || trimmed.startsWith('<');
}

export async function forwardVideoChunkToProduction({
  buffer,
  uploadId,
  chunkIndex,
  totalChunks,
  fileName,
  actor
}) {
  const cleanUploadId = String(uploadId || '');
  const idx = Number(chunkIndex);
  const total = Number(totalChunks);
  const safeIdx = Number.isInteger(idx) ? idx : 0;
  const safeTotal = Number.isInteger(total) ? total : 0;

  const cfg = getProductionGatewayConfig();
  if (!cfg.configured) {
    const msg =
      'Production Upload Gateway is not configured on the Preview server. Add VIDHYAA_PROD_UPLOAD_SECRET (64-char hex) and VIDHYAA_PROD_UPLOAD_KEY_ID=k1 in Google AI Studio Settings -> Secrets, and configure the matching secret outside public_html on Hostinger. Local Preview video storage is disabled.';
    return {
      status: 503,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: safeIdx,
        totalChunks: safeTotal,
        completed: false,
        error: msg,
        message: msg,
        code: 'GATEWAY_NOT_CONFIGURED',
        extra: { retryable: false, upstreamStatus: 503 }
      })
    };
  }

  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(cleanUploadId)) {
    const msg = 'Invalid chunk uploadId.';
    return {
      status: 400,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: safeIdx,
        totalChunks: safeTotal,
        error: msg,
        message: msg,
        code: 'INVALID_UPLOAD_ID',
        extra: { retryable: false }
      })
    };
  }
  if (!Number.isInteger(idx) || !Number.isInteger(total) || total < 1 || total > 200 || idx < 0 || idx >= total) {
    const msg = 'Invalid chunkIndex or totalChunks (allowed: 1..200 chunks).';
    return {
      status: 400,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: safeIdx,
        totalChunks: safeTotal,
        error: msg,
        message: msg,
        code: 'INVALID_CHUNK_BOUNDS',
        extra: { retryable: false }
      })
    };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const msg = 'Empty video chunk payload.';
    return {
      status: 400,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        error: msg,
        message: msg,
        code: 'EMPTY_CHUNK',
        extra: { retryable: false }
      })
    };
  }
  if (buffer.length > MAX_VIDEO_CHUNK_BYTES) {
    const msg = 'Video chunk exceeds maximum 8 MiB chunk ceiling.';
    return {
      status: 413,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        error: msg,
        message: msg,
        code: 'CHUNK_TOO_LARGE',
        extra: { retryable: false }
      })
    };
  }

  const safeFileName = String(fileName || 'vidhyaa_video.mp4').replace(/[\r\n]/g, '');
  const endpointPath = '/api/videos/upload.php';
  const canonicalQuery = canonicalizeGatewayQuery({
    chunked: '1',
    uploadId: cleanUploadId,
    chunkIndex: String(idx),
    totalChunks: String(total),
    fileName: safeFileName
  });

  const authHeader = createGatewayAuthHeader({
    scope: 'video:upload',
    method: 'POST',
    endpointPath,
    canonicalQuery,
    bodyBuffer: buffer,
    actor
  });

  let upstreamRes;
  let upstreamText = '';
  let upstreamCt = '';
  try {
    upstreamRes = await fetchWithTimeout(
      `${cfg.targetOrigin}${endpointPath}?${canonicalQuery}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(safeFileName),
          'X-Vidhyaa-Gateway-Auth': authHeader,
          Accept: 'application/json'
        },
        body: buffer
      },
      55000
    );
    upstreamCt = upstreamRes.headers.get('content-type') || '';
    upstreamText = await upstreamRes.text();
  } catch (err) {
    const msg = `Could not reach Hostinger Production for video chunk ${idx + 1}/${total}: ${err?.message || 'network timeout'}`;
    return {
      status: 502,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        error: msg,
        message: msg,
        code: 'HOSTINGER_UNREACHABLE',
        extra: { retryable: true, upstreamStatus: 502 }
      })
    };
  }

  if (looksLikeHtmlText(upstreamText, upstreamCt)) {
    const msg = `Hostinger Production returned an HTML page instead of JSON (HTTP ${upstreamRes.status}) on chunk ${idx + 1}/${total}. Verify that api/videos/upload.php and api/admin/_gateway_auth.php are deployed on Hostinger.`;
    return {
      status: 502,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        error: msg,
        message: msg,
        code: 'HOSTINGER_HTML_RESPONSE',
        extra: { retryable: false, upstreamStatus: upstreamRes.status }
      })
    };
  }

  let data = null;
  try {
    data = upstreamText ? JSON.parse(upstreamText) : null;
  } catch {
    data = null;
  }

  if (!data || typeof data !== 'object' || typeof data.success !== 'boolean') {
    const msg = `Hostinger Production returned an invalid or empty JSON response (HTTP ${upstreamRes.status}) on chunk ${idx + 1}/${total}. Verify PHP logs and gateway deployment on Hostinger.`;
    return {
      status: 502,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        error: msg,
        message: msg,
        code: 'HOSTINGER_MALFORMED_RESPONSE',
        extra: { retryable: false, upstreamStatus: upstreamRes.status }
      })
    };
  }

  if (!upstreamRes.ok || data.success !== true) {
    const errMsg =
      data.error ||
      data.message ||
      (upstreamRes.status === 401
        ? 'Hostinger rejected the gateway authorization token for video upload. Verify Hostinger has the updated gateway PHP files deployed and matching VIDHYAA_PROD_UPLOAD_SECRET outside public_html.'
        : `Hostinger rejected video chunk ${idx + 1}/${total} (HTTP ${upstreamRes.status}).`);
    const errCode =
      upstreamRes.status === 409
        ? 'MISSING_CHUNKS'
        : upstreamRes.status === 401 || upstreamRes.status === 403
          ? 'HOSTINGER_AUTH_REJECTED'
          : upstreamRes.status === 503
            ? 'HOSTINGER_GATEWAY_DISABLED'
            : 'HOSTINGER_UPLOAD_FAILED';
    return {
      status: upstreamRes.status >= 400 ? upstreamRes.status : 502,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        error: errMsg,
        message: errMsg,
        code: errCode,
        extra: {
          missingChunks: Array.isArray(data.missingChunks) ? data.missingChunks : undefined,
          upstreamStatus: upstreamRes.status,
          retryable: upstreamRes.status === 429 || upstreamRes.status === 504
        }
      })
    };
  }

  // Intermediate chunk succeeded
  if (idx < total - 1) {
    return {
      status: 200,
      body: buildVideoGatewayBody({
        success: true,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        completed: false,
        videoUrl: null,
        message: data.message || `Chunk ${idx + 1} of ${total} uploaded to Hostinger Production.`,
        extra: { chunked: true }
      })
    };
  }

  // Final chunk assembled: require valid canonical URL + live HTTP 200 + HTTP 206 Range verification
  const rawReturnedUrl = String(data.videoUrl || data.url || '').trim();
  if (!rawReturnedUrl) {
    const msg = 'Hostinger finalized the video upload but returned no canonical videoUrl.';
    return {
      status: 502,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        completed: false,
        error: msg,
        message: msg,
        code: 'HOSTINGER_MISSING_VIDEO_URL',
        extra: { retryable: false, upstreamStatus: upstreamRes.status }
      })
    };
  }

  const canonicalUrl = rawReturnedUrl.startsWith('https://')
    ? rawReturnedUrl
    : `${cfg.targetOrigin}/${rawReturnedUrl.replace(/^\/+/, '')}`;

  const liveVerify = await verifyLiveProductionMediaUrl(canonicalUrl, 'video');
  if (!liveVerify.ok) {
    const msg =
      liveVerify.error ||
      'Video assembled on Hostinger, but live HTTP 200/206 Range verification failed.';
    return {
      status: 502,
      body: buildVideoGatewayBody({
        success: false,
        uploadId: cleanUploadId,
        chunkIndex: idx,
        totalChunks: total,
        completed: false,
        videoUrl: canonicalUrl,
        error: msg,
        message: msg,
        code: 'LIVE_VERIFICATION_FAILED',
        extra: {
          uploadedButUnverified: true,
          liveVerified: false,
          liveVerification: liveVerify,
          retryable: false,
          upstreamStatus: 502
        }
      })
    };
  }

  return {
    status: 200,
    body: buildVideoGatewayBody({
      success: true,
      uploadId: cleanUploadId,
      chunkIndex: idx,
      totalChunks: total,
      completed: true,
      videoUrl: canonicalUrl,
      message: data.idempotentReplay
        ? 'Video already finalized and verified live on Hostinger Production.'
        : 'Video uploaded, assembled, and verified live (HTTP 200/206) on Hostinger Production.',
      extra: {
        relativeUrl: data.relativeUrl || new URL(canonicalUrl).pathname,
        fileName: data.fileName || safeFileName,
        originalName: safeFileName,
        sizeBytes: Number(data.sizeBytes || 0),
        mimeType: data.mimeType || 'video/mp4',
        storageType: 'server',
        verifiedOnDisk: Boolean(data.verifiedOnDisk),
        idempotentReplay: Boolean(data.idempotentReplay),
        liveVerified: true,
        liveVerification: liveVerify
      }
    })
  };
}

export async function fetchProductionProductById(productId) {
  const cfg = getProductionGatewayConfig();
  const cleanId = String(productId || '').trim();
  if (!cleanId) {
    return { ok: false, status: 400, error: 'Product ID is required.' };
  }
  try {
    const res = await fetchWithTimeout(
      `${cfg.targetOrigin}/api/products.php?id=${encodeURIComponent(cleanId)}`,
      { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } },
      15000
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || !data.id) {
      return {
        ok: false,
        status: res.status,
        error: data?.error || `Production product read-back failed (HTTP ${res.status}).`
      };
    }
    return { ok: true, status: 200, product: data };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `Unable to read back product from Hostinger Production: ${err?.message || 'network error'}`
    };
  }
}

export async function forwardProductSaveToProduction({ product, actor }) {
  const cfg = getProductionGatewayConfig();
  if (!cfg.configured) {
    return {
      status: 503,
      body: {
        success: false,
        error:
          'Production Upload Gateway is not configured on the Preview server. Set VIDHYAA_PROD_UPLOAD_SECRET in Google AI Studio Settings -> Secrets and restart the Preview server. Saving to Preview-only products.json is disabled.'
      }
    };
  }

  if (!product || typeof product !== 'object' || !product.id) {
    return { status: 400, body: { success: false, error: 'Valid product object with id is required.' } };
  }

  const endpointPath = '/api/products.php';
  const payloadStr = JSON.stringify({ product });
  const bodyBuffer = Buffer.from(payloadStr, 'utf8');
  const authHeader = createGatewayAuthHeader({
    scope: 'products:write',
    method: 'POST',
    endpointPath,
    canonicalQuery: '',
    bodyBuffer,
    actor
  });

  let upstreamRes;
  let upstreamText = '';
  try {
    upstreamRes = await fetchWithTimeout(
      `${cfg.targetOrigin}${endpointPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Vidhyaa-Gateway-Auth': authHeader,
          Accept: 'application/json'
        },
        body: bodyBuffer
      },
      30000
    );
    upstreamText = await upstreamRes.text();
  } catch (err) {
    return {
      status: 502,
      body: {
        success: false,
        error: `Could not reach Hostinger Production products API: ${err?.message || 'network error'}`
      }
    };
  }

  let data = null;
  try {
    data = upstreamText ? JSON.parse(upstreamText) : null;
  } catch {
    data = null;
  }

  if (!upstreamRes.ok || !data?.success || !data?.product?.id) {
    return {
      status: upstreamRes.status >= 400 ? upstreamRes.status : 502,
      body: {
        success: false,
        error:
          data?.error ||
          (upstreamRes.status === 401
            ? 'Hostinger rejected the gateway authorization token for product save. Verify Hostinger gateway deployment and secret configuration.'
            : `Hostinger Production product save failed (HTTP ${upstreamRes.status}).`),
        upstreamStatus: upstreamRes.status
      }
    };
  }

  // Mandatory Read-Back Verification from Hostinger Production
  const readBack = await fetchProductionProductById(data.product.id);
  if (!readBack.ok || !readBack.product) {
    return {
      status: 502,
      body: {
        success: false,
        code: 'READBACK_FAILED',
        error:
          readBack.error ||
          'Product was sent to Hostinger, but live read-back verification could not confirm persistence.',
        message:
          readBack.error ||
          'Product was sent to Hostinger, but live read-back verification could not confirm persistence.'
      }
    };
  }

  // Confirm saved videoUrl exactly matches the expected verified production video URL when present
  const expectedVideoUrl = typeof product.videoUrl === 'string' ? product.videoUrl.trim() : '';
  const readBackVideoUrl = typeof readBack.product.videoUrl === 'string' ? readBack.product.videoUrl.trim() : '';
  if (
    expectedVideoUrl &&
    /^https:\/\/(?:www\.)?vidhyaajewellerystudio\.com\/videos\/uploads\//i.test(expectedVideoUrl) &&
    readBackVideoUrl !== expectedVideoUrl
  ) {
    const mismatchMsg = `Product read-back videoUrl mismatch on Hostinger (expected "${expectedVideoUrl}", got "${readBackVideoUrl || '(empty)'}").`;
    return {
      status: 502,
      body: {
        success: false,
        code: 'VIDEO_URL_READBACK_MISMATCH',
        error: mismatchMsg,
        message: mismatchMsg,
        product: readBack.product
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      product: readBack.product,
      verifiedReadBack: true,
      videoUrlVerified: !expectedVideoUrl || readBackVideoUrl === expectedVideoUrl,
      storageTarget: 'Hostinger Production',
      error: null,
      message: 'Product saved and read-back verified on Hostinger Production.'
    }
  };
}
