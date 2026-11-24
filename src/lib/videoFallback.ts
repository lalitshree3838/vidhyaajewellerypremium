import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { INITIAL_PRODUCTS, isGenuineVideoUrl } from './sampleData';
import { getAdminAuthHeaders } from './adminSessionMemory';

const PRODUCTION_VIDEO_HOST_RE =
  /^https?:\/\/(?:www\.)?vidhyaajewellerystudio\.com(\/videos\/uploads\/[^\s?#]+(?:\?[^\s#]*)?)$/i;

const PREVIEW_ONLY_HOST_RE =
  /(?:^|\.)(?:ais-dev-[a-z0-9-]+\.run\.app|ais-pre-[a-z0-9-]+\.run\.app|run\.app|webcontainer\.io|stackblitz\.io|csb\.app|ngrok(?:-free)?\.app|trycloudflare\.com|loca\.lt)$/i;

const LOCAL_HOST_RE = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

const UNSUPPORTED_WEBPAGE_HOST_RE =
  /(?:^|\.)(?:drive\.google\.com|docs\.google\.com|photos\.google\.com|instagram\.com|instagr\.am|facebook\.com|fb\.watch|m\.facebook\.com|tiktok\.com|vm\.tiktok\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|postimg\.cc|imgur\.com|wa\.me|web\.whatsapp\.com|canva\.com|loom\.com|dailymotion\.com|streamable\.com)$/i;

const DIRECT_VIDEO_EXT_RE = /\.(?:mp4|webm|mov|m4v|ogv)$/i;
const HTML_OR_PAGE_EXT_RE = /\.(?:html?|php|aspx?|jsp|txt|json|xml|pdf|jpg|jpeg|png|webp|gif|svg)$/i;

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_RE = /^\d{4,15}$/;

export interface OfficialVideoEmbedInfo {
  provider: 'youtube' | 'vimeo';
  videoId: string;
  canonicalUrl: string;
  embedUrl: string;
}

export interface VideoUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  kind?: 'direct' | 'embed';
  embedUrl?: string;
  provider?: 'youtube' | 'vimeo';
  error?: string;
}

/**
 * Parses supported YouTube or Vimeo links and builds a strict, safe official embed URL
 * with muted autoplay, playsinline, and seamless loop parameters.
 * Returns null for non-embed URLs or malformed IDs.
 */
export function parseOfficialVideoEmbed(
  rawUrl?: string | null,
  options?: { muted?: boolean; controls?: boolean; autoplay?: boolean }
): OfficialVideoEmbedInfo | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const muted = options?.muted !== false;
  const controls = options?.controls === true;
  const autoplay = options?.autoplay !== false;

  // YouTube: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/, youtube-nocookie.com/embed/
  if (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'www.youtube-nocookie.com'
  ) {
    let videoId = '';
    if (host === 'youtu.be' && pathParts[0]) {
      videoId = pathParts[0];
    } else if (pathParts[0] === 'watch') {
      videoId = parsed.searchParams.get('v') || '';
    } else if ((pathParts[0] === 'shorts' || pathParts[0] === 'embed' || pathParts[0] === 'live') && pathParts[1]) {
      videoId = pathParts[1];
    }

    if (YOUTUBE_ID_RE.test(videoId)) {
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        mute: muted ? '1' : '0',
        loop: '1',
        playlist: videoId,
        playsinline: '1',
        rel: '0',
        modestbranding: '1',
        controls: controls ? '1' : '0'
      });
      return {
        provider: 'youtube',
        videoId,
        canonicalUrl,
        embedUrl: `https://www.youtube.com/embed/${videoId}?${params.toString()}`
      };
    }
    return null;
  }

  // Vimeo: vimeo.com/<id>, player.vimeo.com/video/<id>, vimeo.com/channels/<ch>/<id>
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    let videoId = '';
    if (host === 'player.vimeo.com' && pathParts[0] === 'video' && pathParts[1]) {
      videoId = pathParts[1];
    } else if (pathParts.length >= 1) {
      const lastSegment = pathParts[pathParts.length - 1];
      if (VIMEO_ID_RE.test(lastSegment)) {
        videoId = lastSegment;
      } else if (pathParts[0] === 'video' && pathParts[1] && VIMEO_ID_RE.test(pathParts[1])) {
        videoId = pathParts[1];
      }
    }

    if (VIMEO_ID_RE.test(videoId)) {
      const canonicalUrl = `https://vimeo.com/${videoId}`;
      const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        muted: muted ? '1' : '0',
        loop: '1',
        playsinline: '1',
        autopause: '0',
        dnt: '1',
        controls: controls ? '1' : '0',
        background: controls ? '0' : '1'
      });
      return {
        provider: 'vimeo',
        videoId,
        canonicalUrl,
        embedUrl: `https://player.vimeo.com/video/${videoId}?${params.toString()}`
      };
    }
    return null;
  }

  return null;
}

export function getOfficialVideoEmbedUrl(
  rawUrl?: string | null,
  options?: { muted?: boolean; controls?: boolean; autoplay?: boolean }
): string | null {
  const info = parseOfficialVideoEmbed(rawUrl, options);
  return info ? info.embedUrl : null;
}

export function isPreviewEnvironmentHost(hostname?: string): boolean {
  const host = (
    hostname !== undefined
      ? hostname
      : typeof window !== 'undefined'
        ? window.location.hostname
        : ''
  )
    .trim()
    .toLowerCase();
  if (!host) return false;
  return LOCAL_HOST_RE.test(host) || PREVIEW_ONLY_HOST_RE.test(host);
}

export function isPreviewOnlyVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return PREVIEW_ONLY_HOST_RE.test(host) || LOCAL_HOST_RE.test(host);
  } catch {
    return false;
  }
}

export function normalizeVideoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  if (!cleaned) return '';

  // Normalize same-domain production video URLs to canonical relative /videos/uploads/...
  const prodMatch = cleaned.match(PRODUCTION_VIDEO_HOST_RE);
  if (prodMatch && prodMatch[1]) {
    cleaned = prodMatch[1];
  }

  // Normalize localhost/127.0.0.1 paths strictly for local /videos/uploads/ assets
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/videos\/uploads\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i, '$1');
  }

  // Normalize relative videos/uploads/... without leading slash
  if (/^videos\/uploads\//i.test(cleaned)) {
    cleaned = `/${cleaned}`;
  }

  return cleaned;
}

/**
 * Validates that a video URL is either:
 *  (a) a direct playable MP4/WebM/MOV media URL safe for storefront <video> playback, OR
 *  (b) a supported YouTube / Vimeo link that renders via its official embed player.
 * Rejects HTML webpages, unsupported share links (Google Drive, Instagram, Facebook, TikTok, Dropbox ?dl=0),
 * Preview-only host URLs, and malformed URLs.
 */
export function validateDirectPlayableVideoUrl(rawUrl?: string | null): VideoUrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Please enter a direct MP4/WebM/MOV video URL or a supported YouTube/Vimeo link.'
    };
  }

  const trimmed = rawUrl.trim();
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Video URL cannot contain spaces. Please copy a valid direct video URL.'
    };
  }

  // Explicitly block Preview-only URLs BEFORE normalization (except canonical /videos/uploads/ on production domain)
  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Invalid URL format. Please enter a complete HTTPS video URL or /videos/uploads/... path.'
      };
    }

    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname || '';

    // Reject AI Studio Preview / Cloud Run / localhost absolute URLs so they are never saved as production URLs
    if (PREVIEW_ONLY_HOST_RE.test(host) || LOCAL_HOST_RE.test(host)) {
      return {
        valid: false,
        normalizedUrl: '',
        error:
          'Preview or localhost URLs cannot be saved as production videos. Upload the MP4 on the live website or enter a production https://vidhyaajewellerystudio.com/videos/uploads/... URL.'
      };
    }

    // Check supported official embed providers (YouTube / Vimeo)
    const embedInfo = parseOfficialVideoEmbed(trimmed);
    if (embedInfo) {
      return {
        valid: true,
        normalizedUrl: embedInfo.canonicalUrl,
        kind: 'embed',
        embedUrl: embedInfo.embedUrl,
        provider: embedInfo.provider
      };
    }

    // If it's a YouTube/Vimeo host but didn't parse as a valid video URL (e.g. channel/homepage)
    if (
      /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com)$/i.test(host)
    ) {
      return {
        valid: false,
        normalizedUrl: '',
        error:
          'This YouTube/Vimeo link does not point to a specific video. Copy a direct video link (e.g., https://youtu.be/VIDEO_ID or https://vimeo.com/123456789) or upload the MP4 directly.'
      };
    }

    // Reject webpage / video-sharing platforms that return HTML instead of a playable stream
    if (UNSUPPORTED_WEBPAGE_HOST_RE.test(host)) {
      return {
        valid: false,
        normalizedUrl: '',
        error:
          'Share links from Google Drive, Instagram, Facebook, TikTok, or image hosts return HTML pages and cannot play in Shopping Videos. Please upload the MP4 directly or paste a direct .mp4 URL (or YouTube/Vimeo link).'
      };
    }

    // Reject Dropbox HTML preview pages (?dl=0 or missing raw=1/dl=1)
    if (/(?:^|\.)dropbox\.com$/i.test(host)) {
      const dl = parsed.searchParams.get('dl');
      const raw = parsed.searchParams.get('raw');
      if (dl !== '1' && raw !== '1') {
        return {
          valid: false,
          normalizedUrl: '',
          error:
            'Dropbox share pages (?dl=0) are HTML links and will not play. Change ?dl=0 to ?raw=1, upload the MP4 directly, or use a direct downloadable .mp4 URL.'
        };
      }
    }

    // Reject non-HTTPS external URLs (mixed-content blocked on HTTPS production)
    const isProdDomain = /(?:^|\.)vidhyaajewellerystudio\.com$/i.test(host);
    if (parsed.protocol !== 'https:' && !isProdDomain) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'External video URLs must use HTTPS so they can play securely on the storefront.'
      };
    }

    // Reject obvious HTML/image/non-video extensions
    if (HTML_OR_PAGE_EXT_RE.test(pathname)) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'This URL points to a webpage or non-video file, not a direct playable MP4/WebM/MOV video.'
      };
    }

    const isFirebaseMedia =
      host === 'firebasestorage.googleapis.com' && parsed.searchParams.get('alt') === 'media';
    const hasVideoExt = DIRECT_VIDEO_EXT_RE.test(pathname);

    if (!hasVideoExt && !isFirebaseMedia) {
      return {
        valid: false,
        normalizedUrl: '',
        error:
          'Please enter a direct video file URL ending in .mp4, .webm, or .mov — or a supported YouTube/Vimeo video link.'
      };
    }

    const normalized = normalizeVideoUrl(trimmed);
    if (!isGenuineVideoUrl(normalized)) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Sample/demo video URLs are not permitted. Please provide a genuine jewellery video URL.'
      };
    }

    return { valid: true, normalizedUrl: normalized, kind: 'direct' };
  }

  // Relative URL handling (must be a direct video file path, e.g. /videos/uploads/foo.mp4)
  const normalized = normalizeVideoUrl(trimmed);
  if (!normalized.startsWith('/')) {
    return {
      valid: false,
      normalizedUrl: '',
      error:
        'Video URL must start with https:// or /videos/uploads/ and point directly to an MP4, WebM, or MOV file (or a supported YouTube/Vimeo link).'
    };
  }

  const pathOnly = normalized.split(/[?#]/)[0];
  if (HTML_OR_PAGE_EXT_RE.test(pathOnly) || !DIRECT_VIDEO_EXT_RE.test(pathOnly)) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Local video path must point directly to a .mp4, .webm, or .mov file (e.g. /videos/uploads/video.mp4).'
    };
  }

  if (!isGenuineVideoUrl(normalized)) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Unsupported video URL.'
    };
  }

  return { valid: true, normalizedUrl: normalized, kind: 'direct' };
}

export const validateAndNormalizeVideoUrl = validateDirectPlayableVideoUrl;

/**
 * Full server-side + browser-side live playability probe used by Admin Panel before attaching a video URL.
 * 1. Calls authenticated POST /api/videos/verify-url for server-side HTTP status, Content-Type,
 *    binary signature (direct MP4/WebM/MOV), or oEmbed availability (YouTube/Vimeo).
 * 2. For direct media URLs, also verifies real HTML5 <video> metadata decoding in the browser.
 */
export async function probeVideoUrlPlayable(
  rawUrl: string,
  timeoutMs: number = 8000
): Promise<VideoUrlValidationResult> {
  const staticCheck = validateDirectPlayableVideoUrl(rawUrl);
  if (!staticCheck.valid) return staticCheck;

  const url = staticCheck.normalizedUrl;

  // 1. Server-side media / oEmbed verification (checks HTTP status, Content-Type, magic bytes without CORS blindness)
  let serverVerified = false;
  if (typeof fetch !== 'undefined') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), Math.min(timeoutMs, 6500)) : null;
    try {
      const verifyRes = await fetch('/api/videos/verify-url', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: rawUrl.trim() }),
        signal: controller?.signal
      });
      if (timer) clearTimeout(timer);
      const ct = (verifyRes.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const data = await verifyRes.json().catch(() => null);
        if (verifyRes.ok && data) {
          if (data.valid === false) {
            return {
              valid: false,
              normalizedUrl: '',
              error: data.error || 'Server verification rejected this video URL.'
            };
          }
          if (data.valid === true) {
            serverVerified = true;
          }
        } else if (verifyRes.status === 400 && data?.error) {
          return {
            valid: false,
            normalizedUrl: '',
            error: data.error
          };
        }
      }
    } catch {
      if (timer) clearTimeout(timer);
      // Graceful fallback to direct client check if verify-url endpoint is unavailable
    }
  }

  // Supported YouTube / Vimeo embeds render via official iframe player (cannot load inside HTML5 <video>)
  if (staticCheck.kind === 'embed') {
    if (!serverVerified && typeof fetch !== 'undefined') {
      // Lightweight client-side fallback check for Vimeo oEmbed if server route was unavailable
      if (staticCheck.provider === 'vimeo') {
        try {
          const r = await fetch(
            `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
            { cache: 'no-store' }
          );
          if (!r.ok) {
            return {
              valid: false,
              normalizedUrl: '',
              error: `Vimeo video could not be verified (HTTP ${r.status}). Ensure the video is public and embeddable.`
            };
          }
        } catch {
          // CORS or offline fallback — static validation already confirmed valid Vimeo video ID
        }
      }
    }
    return staticCheck;
  }

  // 2. For same-origin relative URLs when server route didn't verify, check HEAD status + non-HTML Content-Type
  if (!serverVerified && url.startsWith('/') && typeof fetch !== 'undefined') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), Math.min(timeoutMs, 5000)) : null;
    try {
      const headRes = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller?.signal
      });
      if (timer) clearTimeout(timer);

      if (!headRes.ok) {
        return {
          valid: false,
          normalizedUrl: '',
          error: `Video file was not found on this server (HTTP ${headRes.status}). Make sure the MP4 file exists in /videos/uploads/ on production.`
        };
      }

      const ct = (headRes.headers.get('content-type') || '').toLowerCase();
      if (
        ct &&
        (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain'))
      ) {
        return {
          valid: false,
          normalizedUrl: '',
          error: `URL returned "${ct.split(';')[0]}" instead of a video stream. Please use a direct MP4 video URL.`
        };
      }
    } catch {
      if (timer) clearTimeout(timer);
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Could not reach the video URL on this server. Verify the file path and try again.'
      };
    }
  }

  // 3. Verify real browser <video> element can parse stream metadata
  if (typeof document === 'undefined') {
    return staticCheck;
  }

  return new Promise<VideoUrlValidationResult>((resolve) => {
    const video = document.createElement('video');
    let settled = false;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onerror = null;
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
    };

    const finish = (result: VideoUrlValidationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        valid: false,
        normalizedUrl: '',
        error:
          'Timed out verifying video stream. The URL may be unreachable, blocked by hotlink protection, or not a direct MP4 file.'
      });
    }, timeoutMs);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 || (Number.isFinite(video.duration) && video.duration > 0)) {
        finish({ valid: true, normalizedUrl: url, kind: 'direct' });
      } else {
        finish({
          valid: false,
          normalizedUrl: '',
          error: 'This URL did not contain a playable video track. Please provide a valid H.264 MP4/WebM video.'
        });
      }
    };

    video.onerror = () => {
      finish({
        valid: false,
        normalizedUrl: '',
        error:
          'Browser could not play this video URL (broken link, HTML page, CORS block, or unsupported codec). Please upload an MP4 or enter a verified direct .mp4 URL.'
      });
    };

    video.src = url;
    try {
      video.load();
    } catch {}
  });
}

function normalizeProductTitle(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Finds a verified fallback videoUrl strictly from existing local app catalog data (INITIAL_PRODUCTS),
 * matched first by product ID and second by exact normalized product title.
 * Never invents filenames or mutates existing product data.
 */
export function getCatalogFallbackVideoUrl(
  product?: Partial<Product> | null,
  excludeUrl?: string
): string {
  if (!product) return '';
  const normExclude = normalizeVideoUrl(excludeUrl);

  const byId = product.id ? INITIAL_PRODUCTS.find((p) => p.id === product.id) : undefined;
  const byIdUrl = normalizeVideoUrl(byId?.videoUrl);
  if (byIdUrl && byIdUrl !== normExclude && isGenuineVideoUrl(byIdUrl)) {
    return byIdUrl;
  }

  const targetTitle = normalizeProductTitle(product.name);
  if (targetTitle) {
    const byName = INITIAL_PRODUCTS.find(
      (p) => normalizeProductTitle(p.name) === targetTitle && Boolean(p.videoUrl)
    );
    const byNameUrl = normalizeVideoUrl(byName?.videoUrl);
    if (byNameUrl && byNameUrl !== normExclude && isGenuineVideoUrl(byNameUrl)) {
      return byNameUrl;
    }
  }

  return '';
}

/**
 * Returns deduplicated ordered candidate video URLs for a product:
 * [primary product.videoUrl, verified INITIAL_PRODUCTS fallback].
 * Filters out Preview-only host URLs and unsupported webpage share links.
 */
export function getProductVideoCandidates(product?: Partial<Product> | null): string[] {
  if (!product || (product as any)._videoCleared === true) return [];
  const rawInput =
    product.videoUrl || (product as any).video || (product as any).videoURL || '';
  const candidates: string[] = [];

  if (rawInput && typeof rawInput === 'string' && rawInput.trim()) {
    const check = validateDirectPlayableVideoUrl(rawInput);
    if (check.valid && check.normalizedUrl) {
      candidates.push(check.normalizedUrl);
    }
  }

  const fallback = getCatalogFallbackVideoUrl(product, candidates[0]);
  if (fallback && !candidates.includes(fallback)) {
    const fbCheck = validateDirectPlayableVideoUrl(fallback);
    if (fbCheck.valid && fbCheck.normalizedUrl && !candidates.includes(fbCheck.normalizedUrl)) {
      candidates.push(fbCheck.normalizedUrl);
    }
  }
  return candidates;
}

export interface VideoInventoryState {
  checked: boolean;
  supported: boolean;
  availableSet: Set<string>;
}

let cachedInventory: VideoInventoryState | null = null;
let inventoryPromise: Promise<VideoInventoryState> | null = null;
const sessionUploadedVideos = new Set<string>();

export function invalidateVideoInventoryCache(): void {
  cachedInventory = null;
  inventoryPromise = null;
}

export function registerAvailableVideoUrl(url?: string | null): void {
  const normalized = normalizeVideoUrl(url);
  if (!normalized || !normalized.startsWith('/videos/uploads/')) return;
  sessionUploadedVideos.add(normalized);
  if (cachedInventory && cachedInventory.supported) {
    cachedInventory.availableSet.add(normalized);
  }
}

async function fetchVideoInventoryOnce(timeoutMs: number): Promise<VideoInventoryState | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch('/api/videos/available', {
      cache: 'no-store',
      signal: controller?.signal
    });
    if (timeoutId) clearTimeout(timeoutId);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !ct.includes('application/json')) {
      return null;
    }
    const data = await res.json();
    if (data && data.success && Array.isArray(data.urls)) {
      const availableSet = new Set<string>(sessionUploadedVideos);
      for (const u of data.urls) {
        const norm = normalizeVideoUrl(u);
        if (norm) availableSet.add(norm);
      }
      return {
        checked: true,
        supported: true,
        availableSet
      };
    }
    return null;
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return null;
  }
}

export function fetchAvailableVideoInventory(forceRefresh = false): Promise<VideoInventoryState> {
  if (forceRefresh) {
    cachedInventory = null;
    inventoryPromise = null;
  }
  if (cachedInventory && cachedInventory.supported) {
    return Promise.resolve(cachedInventory);
  }
  if (inventoryPromise) return inventoryPromise;

  if (typeof fetch === 'undefined') {
    return Promise.resolve({
      checked: true,
      supported: false,
      availableSet: new Set(sessionUploadedVideos)
    });
  }

  let pending: Promise<VideoInventoryState> | null = null;
  pending = (async (): Promise<VideoInventoryState> => {
    try {
      const firstAttempt = await fetchVideoInventoryOnce(5000);
      if (firstAttempt) {
        cachedInventory = firstAttempt;
        return firstAttempt;
      }

      // Single automatic retry on transient failure before falling back (never permanently caching failures)
      await new Promise((r) => setTimeout(r, 800));
      const secondAttempt = await fetchVideoInventoryOnce(5000);
      if (secondAttempt) {
        cachedInventory = secondAttempt;
        return secondAttempt;
      }
    } finally {
      if (inventoryPromise === pending) {
        inventoryPromise = null;
      }
    }
    // Temporary timeout/network error: return supported:false fallback so valid videos are never hidden
    return {
      checked: true,
      supported: false,
      availableSet: new Set(sessionUploadedVideos)
    };
  })();

  inventoryPromise = pending;
  return pending;
}

/**
 * Resolves a single product's ordered video candidates against the local server inventory if supported.
 */
export function resolveCandidatesWithInventory(
  candidates: string[],
  inventory: VideoInventoryState | null
): { resolvedUrl: string; fallbackUrls: string[]; isKnownMissingLocal: boolean } {
  if (candidates.length === 0) {
    return { resolvedUrl: '', fallbackUrls: [], isKnownMissingLocal: false };
  }

  const normalizedCandidates = candidates
    .map((u) => normalizeVideoUrl(u))
    .filter((u) => Boolean(u) && !isPreviewOnlyVideoUrl(u));

  if (normalizedCandidates.length === 0) {
    return { resolvedUrl: '', fallbackUrls: [], isKnownMissingLocal: true };
  }

  if (!inventory || !inventory.checked || !inventory.supported) {
    return {
      resolvedUrl: normalizedCandidates[0],
      fallbackUrls: normalizedCandidates.slice(1),
      isKnownMissingLocal: false
    };
  }

  const playable = normalizedCandidates.filter((url) => {
    if (!url.startsWith('/videos/uploads/')) return true;
    return inventory.availableSet.has(url) || sessionUploadedVideos.has(url);
  });

  if (playable.length === 0) {
    return { resolvedUrl: '', fallbackUrls: [], isKnownMissingLocal: true };
  }

  return {
    resolvedUrl: playable[0],
    fallbackUrls: playable.slice(1),
    isKnownMissingLocal: false
  };
}

/**
 * Hook returning resolved primary + fallback video URLs for ProductCard / QuickViewModal / ProductDetailView.
 * While initial inventory check settles, holds off mounting local /videos/uploads/ URLs
 * known to have an alternative fallback or potential 404, preventing transient console errors.
 */
export function useResolvedProductVideo(product?: Partial<Product> | null): {
  ready: boolean;
  videoUrl: string;
  fallbackUrls: string[];
  hasPlayableVideo: boolean;
} {
  const candidates = useMemo(() => getProductVideoCandidates(product), [product]);
  const [inventory, setInventory] = useState<VideoInventoryState | null>(() => cachedInventory);

  useEffect(() => {
    if (cachedInventory && cachedInventory.supported) {
      setInventory(cachedInventory);
      return;
    }
    let mounted = true;
    fetchAvailableVideoInventory().then((inv) => {
      if (mounted) setInventory(inv);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(() => {
    if (candidates.length === 0) {
      return { ready: true, videoUrl: '', fallbackUrls: [], hasPlayableVideo: false };
    }
    const needsLocalCheck = candidates.some((c) => c.startsWith('/videos/uploads/'));
    if (needsLocalCheck && (!inventory || !inventory.checked)) {
      return { ready: false, videoUrl: '', fallbackUrls: [], hasPlayableVideo: false };
    }
    const { resolvedUrl, fallbackUrls } = resolveCandidatesWithInventory(candidates, inventory);
    return {
      ready: true,
      videoUrl: resolvedUrl,
      fallbackUrls,
      hasPlayableVideo: Boolean(resolvedUrl)
    };
  }, [candidates, inventory]);
}
