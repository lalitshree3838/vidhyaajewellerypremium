import { getAdminMemoryToken, setAdminMemoryToken } from './adminSessionMemory';
import { auth } from './firebase';

export interface VideoUploadResult {
  url: string;
  storageType: 'firebase' | 'server';
  storageTarget?: string;
  fileName: string;
  sizeBytes: number;
  mimeType?: string;
  thumbnailUrl?: string;
  liveVerified?: boolean;
  rangeSupported?: boolean;
  idempotentReplay?: boolean;
}

export interface VideoUploadOptions {
  onProgress?: (progressPercent: number) => void;
  onStatusChange?: (stage: 'uploading' | 'verifying') => void;
  onChunkProgress?: (chunkIndex: number, totalChunks: number, uploadId: string) => void;
  adminToken?: string;
  resumeUploadId?: string;
  startChunkIndex?: number;
}

// Allowed video MIME types and extensions
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
export const MAX_VIDEO_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
// 2 MiB chunks keep every HTTP request well beneath Cloud Run's 32 MiB limit
// and Hostinger PHP post_max_size / upload_max_filesize caps.
const VIDEO_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Please select a video file.' };
  }

  const name = file.name.toLowerCase();
  const hasValidExt = ALLOWED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidType = ALLOWED_VIDEO_TYPES.includes(file.type) || hasValidExt;

  if (!hasValidType) {
    return {
      valid: false,
      error: 'Unsupported format. Please select an MP4, MOV, or WebM video file.'
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'Selected video file is empty.' };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size is ${sizeMb} MB. Maximum allowed size is 250 MB.`
    };
  }

  return { valid: true };
}

/**
 * Verifies the leading binary magic bytes of a selected browser File match genuine MP4, MOV, or WebM.
 */
export async function validateVideoFileSignature(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!file || typeof file.slice !== 'function') return { valid: true };
    const headerBuf = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(headerBuf);
    if (bytes.length < 12) {
      return { valid: false, error: 'Selected file is too small to be a valid video.' };
    }
    // WebM / EBML magic: 1A 45 DF A3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return { valid: true };
    }
    // ISO Base Media (MP4 / MOV) box type at offset 4..8
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === 'ftyp' || box === 'moov' || box === 'mdat' || box === 'wide' || box === 'free') {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'This file does not have a valid MP4, MOV, or WebM binary video header. Please choose a genuine video file.'
    };
  } catch {
    return { valid: true };
  }
}

/**
 * Verifies that an uploaded video URL is genuinely reachable and served as a video stream
 * (HTTP 200/206 + non-HTML video/* Content-Type) BEFORE reporting upload success.
 */
export async function verifyUploadedVideoAccessible(
  videoUrl: string,
  maxAttempts: number = 2
): Promise<{ ok: boolean; status?: number; contentType?: string; error?: string }> {
  if (!videoUrl || typeof fetch === 'undefined') {
    return { ok: true };
  }

  let lastError = 'Uploaded video URL could not be verified on this server.';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250));
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5500) : null;
    try {
      let res = await fetch(videoUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller?.signal
      });
      if (res.status === 405 || res.status === 403) {
        res = await fetch(videoUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-31' },
          cache: 'no-store',
          signal: controller?.signal
        });
      }
      if (timer) clearTimeout(timer);

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.status !== 200 && res.status !== 206) {
        lastError = `Uploaded video is not publicly accessible yet (HTTP ${res.status}).`;
        continue;
      }

      if (
        ct.includes('text/html') ||
        ct.includes('application/json') ||
        ct.includes('text/plain') ||
        ct.startsWith('image/')
      ) {
        return {
          ok: false,
          status: res.status,
          contentType: ct,
          error: `Uploaded video URL returned "${ct.split(';')[0]}" instead of a video stream. Verify server routing.`
        };
      }

      if (ct && !ct.startsWith('video/') && !ct.includes('octet-stream')) {
        lastError = `Unexpected Content-Type "${ct.split(';')[0]}" for uploaded video.`;
        continue;
      }

      return { ok: true, status: res.status, contentType: ct || 'video/mp4' };
    } catch {
      if (timer) clearTimeout(timer);
      lastError = 'Timed out verifying public accessibility of the uploaded video.';
    }
  }

  return { ok: false, error: lastError };
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Capture an automatic thumbnail from a video file using an in-memory video element and canvas
 */
export async function captureVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      video.onloadedmetadata = () => {
        // Seek to 0.5s or 10% of duration to avoid black first frames
        const seekTime = Math.min(0.5, video.duration / 2 || 0.1);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            URL.revokeObjectURL(url);
            resolve(dataUrl);
            return;
          }
        } catch {
          // ignore canvas capture error
        }
        URL.revokeObjectURL(url);
        resolve(null);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      // Fallback timeout in case seeked doesn't fire
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
        resolve(null);
      }, 4000);
    } catch {
      resolve(null);
    }
  });
}

function generateUploadId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `vid_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    }
  } catch {
    // fallback below
  }
  return `vid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function isHtmlPayload(text: string, contentType: string | null): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return true;
  const trimmed = (text || '').trim();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML') || trimmed.startsWith('<');
}

async function resolveUploadSession(
  explicitToken?: string
): Promise<{ token: string | null; preferPhpEndpoint: boolean }> {
  let token = explicitToken || getAdminMemoryToken();
  let preferPhpEndpoint = false;

  const checkSessionAt = async (url: string, bearer: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    const text = await res.text();
    if (isHtmlPayload(text, res.headers.get('content-type'))) {
      return { html: true as const, redirected: res.redirected, status: res.status };
    }
    try {
      const data = JSON.parse(text);
      return { html: false as const, ok: res.ok, status: res.status, data };
    } catch {
      return { html: false as const, ok: false, status: res.status, data: null };
    }
  };

  try {
    let statusCheck = await checkSessionAt('/api/admin/auth-status', token);
    if (statusCheck.html) {
      const phpCheck = await checkSessionAt('/api/admin/auth-status.php', token);
      if (!phpCheck.html) {
        statusCheck = phpCheck;
        preferPhpEndpoint = true;
      } else if (statusCheck.redirected || phpCheck.redirected) {
        throw new Error(
          'Your browser preview session was redirected to a login page. Please refresh the page and sign in to the Admin Panel again.'
        );
      } else {
        throw new Error(
          'Video upload API is unavailable on this host (server returned an HTML page instead of API JSON). Please open the Admin Panel on the live production server or active dev server.'
        );
      }
    }

    if (!statusCheck.html && (statusCheck.data?.isAuthenticatedAdmin || statusCheck.data?.authenticated)) {
      return { token, preferPhpEndpoint };
    }

    // Attempt transparent Firebase Google SSO session refresh if the admin is signed in via Firebase
    const currentUser = auth?.currentUser;
    if (currentUser) {
      const freshIdToken = await currentUser.getIdToken(true);
      if (freshIdToken) {
        const loginEndpoint = preferPhpEndpoint ? '/api/admin/login.php' : '/api/admin/login';
        try {
          const loginRes = await fetch(loginEndpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({ idToken: freshIdToken })
          });
          const loginText = await loginRes.text();
          if (!isHtmlPayload(loginText, loginRes.headers.get('content-type'))) {
            const loginData = JSON.parse(loginText);
            if (loginRes.ok && loginData?.success) {
              if (typeof loginData.token === 'string' && loginData.token.trim()) {
                setAdminMemoryToken(loginData.token.trim());
                return { token: loginData.token.trim(), preferPhpEndpoint };
              }
              return { token: freshIdToken, preferPhpEndpoint };
            }
          }
        } catch {
          // Fall back to sending fresh Firebase ID token directly in Authorization header
        }
        return { token: freshIdToken, preferPhpEndpoint };
      }
    }

    // Only block early if server explicitly confirmed unauthenticated AND no Firebase user is available
    if (
      !statusCheck.html &&
      statusCheck.ok &&
      statusCheck.data &&
      statusCheck.data.isAuthenticatedAdmin === false
    ) {
      throw new Error(
        'Administrator session expired or not signed in. Please sign in to the Admin Panel again before uploading.'
      );
    }
  } catch (err) {
    // Re-throw actionable session/routing errors directly; swallow transient preflight errors so upload can still try
    if (
      err instanceof Error &&
      (err.message.includes('Administrator session') ||
        err.message.includes('Video upload API is unavailable') ||
        err.message.includes('preview session was redirected'))
    ) {
      throw err;
    }
  }

  return { token, preferPhpEndpoint };
}

async function postUploadPayload(
  endpointPath: string,
  querySuffix: string,
  blob: Blob,
  fileName: string,
  token: string | null,
  attemptFallbackPhp: boolean
): Promise<{ data: any; resolvedEndpoint: string }> {
  const sendOnce = async (basePath: string) => {
    const formData = new FormData();
    formData.append('video', blob, fileName);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${basePath}${querySuffix}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });
    } catch {
      const netErr: any = new Error(
        'Network connection interrupted while uploading video. Please verify your internet connection and retry.'
      );
      netErr.retryable = true;
      throw netErr;
    }

    const text = await res.text();
    if (isHtmlPayload(text, res.headers.get('content-type'))) {
      const htmlErr: any = new Error(
        res.redirected
          ? 'Upload request was redirected to an HTML sign-in page. Please refresh the page and sign in again.'
          : `Upload endpoint returned HTML instead of JSON (HTTP ${res.status}). Please verify server API routing.`
      );
      htmlErr.isHtml = true;
      htmlErr.redirected = res.redirected;
      throw htmlErr;
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Malformed response from video storage server (HTTP ${res.status}).`);
    }

    if (!res.ok) {
      const msg = parsed?.error || `Upload failed with status code ${res.status}.`;
      const httpErr: any = new Error(msg);
      httpErr.status = res.status;
      httpErr.retryable = res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429;
      throw httpErr;
    }

    return parsed;
  };

  let activePath = endpointPath;
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt === 1 ? 450 : 1100));
    }
    try {
      const data = await sendOnce(activePath);
      return { data, resolvedEndpoint: activePath };
    } catch (err: any) {
      lastError = err;
      if (err?.isHtml && !err?.redirected && attemptFallbackPhp && activePath === '/api/videos/upload') {
        activePath = '/api/videos/upload.php';
        attemptFallbackPhp = false;
        try {
          const fallbackData = await sendOnce(activePath);
          return { data: fallbackData, resolvedEndpoint: activePath };
        } catch (fallbackErr: any) {
          lastError = fallbackErr;
        }
      }
      if (!lastError?.retryable) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Video upload failed after multiple retries.');
}

function isPreviewHostnameForVideo(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return (
    /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(host) ||
    /(?:^|\.)(?:ais-dev-[a-z0-9-]+\.run\.app|ais-pre-[a-z0-9-]+\.run\.app|run\.app|webcontainer\.io|stackblitz\.io|csb\.app)$/i.test(
      host
    )
  );
}

interface ExpectedChunkMeta {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  isFinalChunk: boolean;
}

const NON_RETRYABLE_GATEWAY_CODES = new Set([
  'GATEWAY_NOT_CONFIGURED',
  'ADMIN_AUTH_REQUIRED',
  'CSRF_ORIGIN_MISMATCH',
  'HOSTINGER_AUTH_REJECTED',
  'HOSTINGER_HTML_RESPONSE',
  'HOSTINGER_MALFORMED_RESPONSE',
  'HOSTINGER_MISSING_VIDEO_URL',
  'HOSTINGER_BAD_REQUEST',
  'GATEWAY_HTML_RESPONSE',
  'GATEWAY_EMPTY_RESPONSE',
  'GATEWAY_MALFORMED_RESPONSE',
  'GATEWAY_INVALID_SCHEMA',
  'CHUNK_TOO_LARGE',
  'INVALID_CHUNK_INDEX',
  'INVALID_CHUNK_PAYLOAD',
  'UPLOAD_INCOMPLETE'
]);

function makeGatewayError(
  message: string,
  meta: {
    status?: number;
    code?: string;
    retryable?: boolean;
    missingChunks?: number[];
    uploadId?: string;
    failedChunkIndex?: number;
    totalChunks?: number;
    isFinalChunk?: boolean;
  }
): Error {
  const err: any = new Error(message);
  if (typeof meta.status === 'number') err.status = meta.status;
  if (meta.code) err.code = meta.code;
  err.retryable = Boolean(meta.retryable);
  if (Array.isArray(meta.missingChunks)) err.missingChunks = meta.missingChunks;
  if (meta.uploadId) err.uploadId = meta.uploadId;
  if (typeof meta.failedChunkIndex === 'number') err.failedChunkIndex = meta.failedChunkIndex;
  if (typeof meta.totalChunks === 'number') err.totalChunks = meta.totalChunks;
  if (typeof meta.isFinalChunk === 'boolean') err.isFinalChunk = meta.isFinalChunk;
  return err;
}

async function postRawGatewayChunk(
  querySuffix: string,
  chunkBlob: Blob,
  fileName: string,
  token: string | null,
  expected: ExpectedChunkMeta
): Promise<any> {
  const sendOnce = async () => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName)
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`/api/production/videos/upload${querySuffix}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: chunkBlob
      });
    } catch {
      throw makeGatewayError(
        `Network connection interrupted while sending chunk ${expected.chunkIndex + 1} of ${expected.totalChunks} to Hostinger Production.`,
        {
          code: 'NETWORK_INTERRUPTED',
          retryable: true,
          uploadId: expected.uploadId,
          failedChunkIndex: expected.chunkIndex,
          totalChunks: expected.totalChunks,
          isFinalChunk: expected.isFinalChunk
        }
      );
    }

    const contentType = res.headers.get('content-type');
    const text = await res.text();

    // 1. Explicitly reject HTML or proxy error pages BEFORE JSON.parse (never treat HTTP 200 HTML as success)
    if (isHtmlPayload(text, contentType)) {
      const hint = res.redirected
        ? 'The upload request was redirected to an HTML sign-in page. Refresh and sign in to the Admin Panel again.'
        : `Production Video Gateway returned an HTML page instead of JSON (HTTP ${res.status}). Check that the Preview dev server is running and VIDHYAA_PROD_UPLOAD_SECRET is configured in AI Studio Secrets.`;
      throw makeGatewayError(hint, {
        status: res.status,
        code: 'GATEWAY_HTML_RESPONSE',
        retryable: false,
        uploadId: expected.uploadId,
        failedChunkIndex: expected.chunkIndex,
        totalChunks: expected.totalChunks,
        isFinalChunk: expected.isFinalChunk
      });
    }

    // 2. Explicitly reject empty responses
    if (!text || !text.trim()) {
      throw makeGatewayError(
        `Production Video Gateway returned an empty response for chunk ${expected.chunkIndex + 1} (HTTP ${res.status}).`,
        {
          status: res.status,
          code: 'GATEWAY_EMPTY_RESPONSE',
          retryable: false,
          uploadId: expected.uploadId,
          failedChunkIndex: expected.chunkIndex,
          totalChunks: expected.totalChunks,
          isFinalChunk: expected.isFinalChunk
        }
      );
    }

    // 3. Strictly parse JSON object
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw makeGatewayError(
        `Production Video Gateway returned invalid JSON for chunk ${expected.chunkIndex + 1} (HTTP ${res.status}).`,
        {
          status: res.status,
          code: 'GATEWAY_MALFORMED_RESPONSE',
          retryable: false,
          uploadId: expected.uploadId,
          failedChunkIndex: expected.chunkIndex,
          totalChunks: expected.totalChunks,
          isFinalChunk: expected.isFinalChunk
        }
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.success !== 'boolean') {
      throw makeGatewayError(
        `Production Video Gateway returned an unexpected response schema for chunk ${expected.chunkIndex + 1} (HTTP ${res.status}).`,
        {
          status: res.status,
          code: 'GATEWAY_INVALID_SCHEMA',
          retryable: false,
          uploadId: expected.uploadId,
          failedChunkIndex: expected.chunkIndex,
          totalChunks: expected.totalChunks,
          isFinalChunk: expected.isFinalChunk
        }
      );
    }

    const effectiveStatus =
      typeof parsed.httpStatus === 'number' && parsed.httpStatus >= 100
        ? parsed.httpStatus
        : res.status;
    const errorCode = typeof parsed.code === 'string' ? parsed.code : undefined;

    // 4. Handle any non-2xx or success !== true deterministically
    if (!res.ok || parsed.success !== true) {
      const explicitNonRetryable = Boolean(errorCode && NON_RETRYABLE_GATEWAY_CODES.has(errorCode));
      const isTransientStatus =
        effectiveStatus === 429 || effectiveStatus === 504 || effectiveStatus === 408;
      const retryable =
        !explicitNonRetryable &&
        (parsed.retryable === true || (parsed.retryable !== false && isTransientStatus));

      const msg =
        parsed.error ||
        parsed.message ||
        `Production video chunk ${expected.chunkIndex + 1} of ${expected.totalChunks} failed (HTTP ${effectiveStatus}).`;

      throw makeGatewayError(String(msg), {
        status: effectiveStatus,
        code: errorCode,
        retryable,
        missingChunks: Array.isArray(parsed.missingChunks) ? parsed.missingChunks : undefined,
        uploadId: expected.uploadId,
        failedChunkIndex: expected.chunkIndex,
        totalChunks: expected.totalChunks,
        isFinalChunk: expected.isFinalChunk
      });
    }

    // 5. Enforce strict success contract so mismatched / incomplete payloads are NEVER accepted as success
    if (expected.isFinalChunk) {
      const canonicalUrl = String(parsed.videoUrl || parsed.url || '').trim();
      if (parsed.completed !== true || !canonicalUrl) {
        throw makeGatewayError(
          parsed.error ||
            'Finalization succeeded without a completed canonical Hostinger videoUrl.',
          {
            status: effectiveStatus,
            code: 'HOSTINGER_MISSING_VIDEO_URL',
            retryable: false,
            uploadId: expected.uploadId,
            failedChunkIndex: expected.chunkIndex,
            totalChunks: expected.totalChunks,
            isFinalChunk: true
          }
        );
      }
      if (parsed.liveVerified !== true) {
        throw makeGatewayError(
          parsed.error ||
            'Video finalized on Hostinger, but live HTTP 200/206 playback verification did not pass.',
          {
            status: effectiveStatus,
            code: 'LIVE_VERIFICATION_FAILED',
            retryable: false,
            uploadId: expected.uploadId,
            failedChunkIndex: expected.chunkIndex,
            totalChunks: expected.totalChunks,
            isFinalChunk: true
          }
        );
      }
    } else {
      const ackChunkIndex =
        typeof parsed.chunkIndex === 'number'
          ? parsed.chunkIndex
          : typeof parsed.receivedChunk === 'number'
            ? parsed.receivedChunk
            : -1;
      if (
        parsed.completed !== false ||
        ackChunkIndex !== expected.chunkIndex ||
        (parsed.uploadId && String(parsed.uploadId) !== expected.uploadId)
      ) {
        throw makeGatewayError(
          `Production Video Gateway returned an inconsistent acknowledgement for chunk ${expected.chunkIndex + 1} of ${expected.totalChunks}.`,
          {
            status: effectiveStatus,
            code: 'GATEWAY_INVALID_SCHEMA',
            retryable: false,
            uploadId: expected.uploadId,
            failedChunkIndex: expected.chunkIndex,
            totalChunks: expected.totalChunks,
            isFinalChunk: false
          }
        );
      }
    }

    return parsed;
  };

  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1400));
    }
    try {
      return await sendOnce();
    } catch (err: any) {
      lastErr = err;
      if (!err?.retryable) {
        throw err;
      }
    }
  }
  throw lastErr || new Error('Video chunk upload failed after transient network retries.');
}

/**
 * Upload video file directly to Hostinger Production Storage (`/public_html/videos/uploads/`)
 * using 2 MiB chunked uploads with per-chunk HMAC signing on Preview hosts,
 * duplicate-safe finalization, and live HTTP 200 + HTTP 206 Range verification.
 * NEVER falls back to local Preview disk or Base64.
 */
export async function uploadJewelleryVideo(
  file: File,
  options?: VideoUploadOptions
): Promise<VideoUploadResult> {
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid video file.');
  }

  const sigCheck = await validateVideoFileSignature(file);
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || 'Invalid video file header.');
  }

  options?.onStatusChange?.('uploading');
  options?.onProgress?.(2);

  const { token, preferPhpEndpoint } = await resolveUploadSession(options?.adminToken);

  // Preview Host Path: strictly use Production Upload Gateway (/api/production/videos/upload)
  if (isPreviewHostnameForVideo()) {
    const uploadId = options?.resumeUploadId || generateUploadId();
    const totalChunks = Math.max(1, Math.ceil(file.size / VIDEO_CHUNK_SIZE_BYTES));
    const encodedName = encodeURIComponent(file.name);
    const startIdx = Math.max(0, Math.min(totalChunks - 1, options?.startChunkIndex || 0));

    const sendSingleChunk = async (idx: number) => {
      const start = idx * VIDEO_CHUNK_SIZE_BYTES;
      const end = Math.min(file.size, start + VIDEO_CHUNK_SIZE_BYTES);
      const chunkBlob = file.slice(start, end, file.type || 'video/mp4');
      const query = `?chunked=1&uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${idx}&totalChunks=${totalChunks}&fileName=${encodedName}`;
      const isFinalChunk = idx === totalChunks - 1;
      options?.onChunkProgress?.(idx, totalChunks, uploadId);
      if (isFinalChunk) {
        options?.onStatusChange?.('verifying');
      }
      try {
        return await postRawGatewayChunk(query, chunkBlob, file.name, token, {
          uploadId,
          chunkIndex: idx,
          totalChunks,
          isFinalChunk
        });
      } catch (chunkErr: any) {
        chunkErr.uploadId = uploadId;
        chunkErr.failedChunkIndex = idx;
        chunkErr.totalChunks = totalChunks;
        chunkErr.isFinalChunk = isFinalChunk;
        throw chunkErr;
      }
    };

    let finalResponse: any = null;
    for (let chunkIndex = startIdx; chunkIndex < totalChunks; chunkIndex++) {
      let data: any;
      try {
        data = await sendSingleChunk(chunkIndex);
      } catch (err: any) {
        // If Hostinger reported specific missing chunks on finalization (HTTP 409),
        // re-send ONLY those missing chunks without deleting valid chunks, then re-finalize.
        if (
          chunkIndex === totalChunks - 1 &&
          err?.status === 409 &&
          Array.isArray(err?.missingChunks) &&
          err.missingChunks.length > 0
        ) {
          for (const missingIdx of err.missingChunks) {
            if (typeof missingIdx === 'number' && missingIdx >= 0 && missingIdx < totalChunks - 1) {
              await sendSingleChunk(missingIdx);
            }
          }
          data = await sendSingleChunk(chunkIndex);
        } else {
          throw err;
        }
      }

      const pct = Math.min(96, Math.max(5, Math.round(((chunkIndex + 1) / totalChunks) * 96)));
      options?.onProgress?.(pct);

      if (chunkIndex === totalChunks - 1) {
        finalResponse = data;
      }
    }

    const finalUrl = String(finalResponse?.videoUrl || finalResponse?.url || '').trim();
    if (!finalResponse?.success || !finalResponse?.completed || !finalUrl || !finalResponse?.liveVerified) {
      throw makeGatewayError(
        finalResponse?.error ||
          'Video upload completed on Hostinger, but live HTTP 200/206 verification did not pass.',
        {
          code: 'LIVE_VERIFICATION_FAILED',
          retryable: false,
          uploadId,
          failedChunkIndex: totalChunks - 1,
          totalChunks,
          isFinalChunk: true
        }
      );
    }

    options?.onProgress?.(100);
    return {
      url: finalUrl,
      storageType: 'server',
      storageTarget: 'Hostinger Production',
      fileName: finalResponse.fileName || file.name,
      sizeBytes: finalResponse.sizeBytes || file.size,
      mimeType: finalResponse.mimeType || file.type,
      liveVerified: true,
      rangeSupported: Boolean(finalResponse.liveVerification?.rangeSupported),
      idempotentReplay: Boolean(finalResponse.idempotentReplay)
    };
  }

  // Live Production Host Path (already running directly on vidhyaajewellerystudio.com)
  let activeEndpoint = preferPhpEndpoint ? '/api/videos/upload.php' : '/api/videos/upload';
  let finalServerResponse: any = null;

  if (file.size <= VIDEO_CHUNK_SIZE_BYTES) {
    options?.onProgress?.(15);
    const { data } = await postUploadPayload(
      activeEndpoint,
      '',
      file,
      file.name,
      token,
      !preferPhpEndpoint
    );
    finalServerResponse = data;
    options?.onProgress?.(95);
  } else {
    const uploadId = options?.resumeUploadId || generateUploadId();
    const totalChunks = Math.ceil(file.size / VIDEO_CHUNK_SIZE_BYTES);
    const encodedName = encodeURIComponent(file.name);
    const startIdx = Math.max(0, Math.min(totalChunks - 1, options?.startChunkIndex || 0));

    const sendLiveChunk = async (idx: number) => {
      const start = idx * VIDEO_CHUNK_SIZE_BYTES;
      const end = Math.min(file.size, start + VIDEO_CHUNK_SIZE_BYTES);
      const chunkBlob = file.slice(start, end, file.type || 'video/mp4');
      const query = `?chunked=1&uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${idx}&totalChunks=${totalChunks}&fileName=${encodedName}`;
      const isFinalChunk = idx === totalChunks - 1;
      options?.onChunkProgress?.(idx, totalChunks, uploadId);
      if (isFinalChunk) {
        options?.onStatusChange?.('verifying');
      }
      try {
        const result = await postUploadPayload(
          activeEndpoint,
          query,
          chunkBlob,
          file.name,
          token,
          idx === 0 && !preferPhpEndpoint
        );
        activeEndpoint = result.resolvedEndpoint;
        return result.data;
      } catch (chunkErr: any) {
        chunkErr.uploadId = uploadId;
        chunkErr.failedChunkIndex = idx;
        chunkErr.totalChunks = totalChunks;
        chunkErr.isFinalChunk = isFinalChunk;
        throw chunkErr;
      }
    };

    for (let chunkIndex = startIdx; chunkIndex < totalChunks; chunkIndex++) {
      let data: any;
      try {
        data = await sendLiveChunk(chunkIndex);
      } catch (err: any) {
        if (
          chunkIndex === totalChunks - 1 &&
          err?.status === 409 &&
          Array.isArray(err?.missingChunks) &&
          err.missingChunks.length > 0
        ) {
          for (const missingIdx of err.missingChunks) {
            if (typeof missingIdx === 'number' && missingIdx >= 0 && missingIdx < totalChunks - 1) {
              await sendLiveChunk(missingIdx);
            }
          }
          data = await sendLiveChunk(chunkIndex);
        } else {
          throw err;
        }
      }

      const pct = Math.min(95, Math.max(5, Math.round(((chunkIndex + 1) / totalChunks) * 95)));
      options?.onProgress?.(pct);

      if (chunkIndex === totalChunks - 1) {
        finalServerResponse = data;
      } else if (!data?.success) {
        throw makeGatewayError(
          data?.error || `Server rejected video chunk ${chunkIndex + 1} of ${totalChunks}.`,
          {
            uploadId,
            failedChunkIndex: chunkIndex,
            totalChunks,
            isFinalChunk: false
          }
        );
      }
    }
  }

  const finalLiveUrl = String(finalServerResponse?.videoUrl || finalServerResponse?.url || '').trim();
  if (!finalServerResponse?.success || !finalLiveUrl) {
    throw new Error(finalServerResponse?.error || 'Server rejected video upload.');
  }

  const rawResult: VideoUploadResult = {
    url: finalLiveUrl,
    storageType: 'server',
    storageTarget: 'Hostinger Production',
    fileName: finalServerResponse.fileName || file.name,
    sizeBytes: finalServerResponse.sizeBytes || file.size,
    mimeType: finalServerResponse.mimeType || file.type
  };

  // Post-upload accessibility verification BEFORE declaring success
  options?.onStatusChange?.('verifying');
  if (options?.onProgress) options.onProgress(98);

  const accessibility = await verifyUploadedVideoAccessible(rawResult.url);
  if (!accessibility.ok) {
    throw new Error(
      accessibility.error ||
        `Video upload saved to ${rawResult.url} but could not be verified as publicly playable.`
    );
  }

  rawResult.liveVerified = true;
  rawResult.rangeSupported = accessibility.status === 206;
  if (options?.onProgress) options.onProgress(100);
  return rawResult;
}

