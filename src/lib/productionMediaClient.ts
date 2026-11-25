import { clearAdminMemoryToken, resolveAdminAuthHeaders } from './adminSessionMemory';
import { isPreviewEnvironmentHost } from './videoFallback';

export const PRODUCTION_ORIGIN = 'https://vidhyaajewellerystudio.com';

export type PipelineStageStatus = 'idle' | 'active' | 'done' | 'error';

export type PipelineStageKey =
  | 'gateway_ready'
  | 'video_validation'
  | 'chunk_upload'
  | 'file_verified'
  | 'product_save'
  | 'product_readback'
  | 'homepage_verified';

export interface PipelineStageItem {
  key: PipelineStageKey;
  stepNumber: number;
  label: string;
  status: PipelineStageStatus;
  detail?: string;
}

export interface ProductionGatewayStatus {
  configured: boolean;
  keyIdConfigured: boolean;
  keyId: string;
  targetOrigin: string;
  storageTarget: string;
  secretSource: 'process.env' | 'dotenv' | 'none';
  liveHostReachable: boolean;
  liveCatalogCount: number | null;
  hostingerGatewayEndpointReachable?: boolean;
  hostingerGatewayDeployed?: boolean;
  error?: string;
}

export interface LiveMediaVerificationResult {
  ok: boolean;
  status?: number;
  rangeStatus?: number;
  rangeSupported?: boolean;
  contentType?: string;
  contentLength?: number;
  error?: string;
}

export const PIPELINE_STAGE_DEFINITIONS: Array<{
  key: PipelineStageKey;
  stepNumber: number;
  label: string;
}> = [
  { key: 'gateway_ready', stepNumber: 1, label: 'Production Gateway Ready' },
  { key: 'video_validation', stepNumber: 2, label: 'Video Validation' },
  { key: 'chunk_upload', stepNumber: 3, label: 'Chunk Upload' },
  { key: 'file_verified', stepNumber: 4, label: 'Production File Verification' },
  { key: 'product_save', stepNumber: 5, label: 'Product Save' },
  { key: 'product_readback', stepNumber: 6, label: 'Product Read-back' },
  { key: 'homepage_verified', stepNumber: 7, label: 'Homepage Publish Verification' }
];

export function createInitialPipelineStages(): PipelineStageItem[] {
  return PIPELINE_STAGE_DEFINITIONS.map((def) => ({
    ...def,
    status: 'idle'
  }));
}

export function isPreviewGatewayMode(): boolean {
  return isPreviewEnvironmentHost();
}

export function isCanonicalProductionMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/(?:www\.)?vidhyaajewellerystudio\.com\/(?:products|videos)\/uploads\/[^\s?#]+/i.test(
    url.trim()
  );
}

function parseSafeGatewayJson(
  text: string,
  contentType: string | null
): { isHtml: boolean; data: any | null } {
  const ct = (contentType || '').toLowerCase();
  const trimmed = (text || '').trim();
  if (
    ct.includes('text/html') ||
    ct.includes('application/xhtml') ||
    trimmed.startsWith('<!') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML') ||
    trimmed.startsWith('<')
  ) {
    return { isHtml: true, data: null };
  }
  if (!trimmed) {
    return { isHtml: false, data: null };
  }
  try {
    return { isHtml: false, data: JSON.parse(trimmed) };
  } catch {
    return { isHtml: false, data: null };
  }
}

function isPreviewMiddlewareAdminUnauthorized(
  res: Response,
  isHtml: boolean,
  data: any
): boolean {
  return (
    isPreviewGatewayMode() &&
    !isHtml &&
    res.status === 401 &&
    res.headers.get('x-vidhyaa-gateway-status') === '401' &&
    data?.code === 'ADMIN_UNAUTHORIZED' &&
    data?.upstreamStatus === undefined
  );
}

export async function fetchProductionGatewayStatus(
  checkLive: boolean = true
): Promise<ProductionGatewayStatus> {
  const url = `/api/production/gateway-status?checkLive=${checkLive ? '1' : '0'}`;
  try {
    const runAttempt = async (forceRefresh: boolean) => {
      const resolvedAuth = await resolveAdminAuthHeaders(
        { Accept: 'application/json' },
        { forceRefresh }
      );
      if (forceRefresh && !resolvedAuth.authenticated) {
        return { abortedAuth: true as const };
      }
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: resolvedAuth.headers
      });
      const rawText = await res.text();
      const { isHtml, data } = parseSafeGatewayJson(rawText, res.headers.get('content-type'));
      return { abortedAuth: false as const, res, isHtml, data };
    };

    let attempt = await runAttempt(false);
    if (!attempt.abortedAuth && isPreviewMiddlewareAdminUnauthorized(attempt.res, attempt.isHtml, attempt.data)) {
      clearAdminMemoryToken();
      const retryAttempt = await runAttempt(true);
      if (!retryAttempt.abortedAuth) {
        attempt = retryAttempt;
      }
    }

    if (attempt.abortedAuth) {
      return {
        configured: false,
        keyIdConfigured: false,
        keyId: 'k1',
        targetOrigin: PRODUCTION_ORIGIN,
        storageTarget: 'Hostinger Production',
        secretSource: 'none',
        liveHostReachable: false,
        liveCatalogCount: null,
        error: 'Administrator session expired or not signed in. Please sign in to the Admin Panel again.'
      };
    }

    const { res, isHtml, data } = attempt;
    if (isHtml || !res.ok || !data) {
      return {
        configured: false,
        keyIdConfigured: false,
        keyId: 'k1',
        targetOrigin: PRODUCTION_ORIGIN,
        storageTarget: 'Hostinger Production',
        secretSource: 'none',
        liveHostReachable: false,
        liveCatalogCount: null,
        error: isHtml
          ? `Gateway status endpoint returned HTML instead of JSON (HTTP ${res.status}).`
          : data?.error || `Gateway status check returned HTTP ${res.status}.`
      };
    }
    return {
      configured: Boolean(data.configured),
      keyIdConfigured: Boolean(data.keyIdConfigured),
      keyId: String(data.keyId || 'k1'),
      targetOrigin: String(data.targetOrigin || PRODUCTION_ORIGIN),
      storageTarget: String(data.storageTarget || 'Hostinger Production'),
      secretSource: data.secretSource || 'none',
      liveHostReachable: Boolean(data.liveHostReachable),
      liveCatalogCount: typeof data.liveCatalogCount === 'number' ? data.liveCatalogCount : null,
      hostingerGatewayEndpointReachable: Boolean(data.hostingerGatewayEndpointReachable),
      hostingerGatewayDeployed: Boolean(data.hostingerGatewayDeployed)
    };
  } catch (err: any) {
    return {
      configured: false,
      keyIdConfigured: false,
      keyId: 'k1',
      targetOrigin: PRODUCTION_ORIGIN,
      storageTarget: 'Hostinger Production',
      secretSource: 'none',
      liveHostReachable: false,
      liveCatalogCount: null,
      error: err?.message || 'Unable to query Production Gateway status.'
    };
  }
}

export async function verifyProductionMediaLive(
  url: string,
  kind: 'image' | 'video',
  expectedSizeBytes: number = 0
): Promise<LiveMediaVerificationResult> {
  const endpoint = isPreviewGatewayMode() ? '/api/production/verify-media' : '';
  if (endpoint) {
    const serializedBody = JSON.stringify({ url, kind, expectedSizeBytes });
    try {
      const runAttempt = async (forceRefresh: boolean) => {
        const resolvedAuth = await resolveAdminAuthHeaders(
          {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          { forceRefresh }
        );
        if (forceRefresh && !resolvedAuth.authenticated) {
          return { abortedAuth: true as const };
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: resolvedAuth.headers,
          body: serializedBody
        });
        const rawText = await res.text();
        const { isHtml, data } = parseSafeGatewayJson(rawText, res.headers.get('content-type'));
        return { abortedAuth: false as const, res, isHtml, data };
      };

      let attempt = await runAttempt(false);
      if (!attempt.abortedAuth && isPreviewMiddlewareAdminUnauthorized(attempt.res, attempt.isHtml, attempt.data)) {
        clearAdminMemoryToken();
        const retryAttempt = await runAttempt(true);
        if (!retryAttempt.abortedAuth) {
          attempt = retryAttempt;
        }
      }

      if (attempt.abortedAuth) {
        return {
          ok: false,
          status: 401,
          error: 'Administrator session expired or not signed in. Please sign in to the Admin Panel again.'
        };
      }

      const { res, isHtml, data } = attempt;
      if (isHtml) {
        return {
          ok: false,
          status: res.status,
          error: `Live verification endpoint returned HTML instead of JSON (HTTP ${res.status}).`
        };
      }
      if (res.ok && data?.success) {
        return {
          ok: true,
          status: data.status,
          rangeStatus: data.rangeStatus,
          rangeSupported: data.rangeSupported,
          contentType: data.contentType,
          contentLength: data.contentLength
        };
      }
      return {
        ok: false,
        status: data?.httpStatus || data?.status || res.status,
        error: data?.error || `Live verification failed (HTTP ${res.status}).`
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || 'Network error verifying live media URL.'
      };
    }
  }

  // On live Hostinger domain, perform direct same-origin HEAD (+ Range for video) check
  try {
    const headRes = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const ct = (headRes.headers.get('content-type') || '').toLowerCase();
    if (headRes.status !== 200) {
      return { ok: false, status: headRes.status, error: `HTTP ${headRes.status} on live URL.` };
    }
    if (kind === 'image' && !ct.startsWith('image/')) {
      return { ok: false, status: headRes.status, contentType: ct, error: `Unexpected MIME ${ct}` };
    }
    if (kind === 'video') {
      const rangeRes = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1023' },
        cache: 'no-store'
      });
      return {
        ok: rangeRes.status === 206 || rangeRes.status === 200,
        status: headRes.status,
        rangeStatus: rangeRes.status,
        rangeSupported: rangeRes.status === 206,
        contentType: ct
      };
    }
    return { ok: true, status: headRes.status, contentType: ct };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to verify live media.' };
  }
}

export async function readBackProductionProduct(
  productId: string
): Promise<{ ok: boolean; product?: any; error?: string }> {
  try {
    const isPreview = isPreviewGatewayMode();
    const url = isPreview
      ? `/api/production/products/${encodeURIComponent(productId)}`
      : `/api/products.php?id=${encodeURIComponent(productId)}&_t=${Date.now()}`;

    const runAttempt = async (forceRefresh: boolean) => {
      const resolvedAuth = await resolveAdminAuthHeaders(
        { Accept: 'application/json' },
        { forceRefresh }
      );
      if (forceRefresh && !resolvedAuth.authenticated) {
        return { abortedAuth: true as const };
      }
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: resolvedAuth.headers
      });
      const rawText = await res.text();
      const { isHtml, data } = parseSafeGatewayJson(rawText, res.headers.get('content-type'));
      return { abortedAuth: false as const, res, isHtml, data };
    };

    let attempt = await runAttempt(false);
    if (!attempt.abortedAuth && isPreviewMiddlewareAdminUnauthorized(attempt.res, attempt.isHtml, attempt.data)) {
      clearAdminMemoryToken();
      const retryAttempt = await runAttempt(true);
      if (!retryAttempt.abortedAuth) {
        attempt = retryAttempt;
      }
    }

    if (attempt.abortedAuth) {
      return {
        ok: false,
        error: 'Administrator session expired or not signed in. Please sign in to the Admin Panel again.'
      };
    }

    const { res, isHtml, data } = attempt;
    if (isHtml) {
      return {
        ok: false,
        error: `Live product read-back returned HTML instead of JSON (HTTP ${res.status}).`
      };
    }
    if (!res.ok || !data) {
      return {
        ok: false,
        error: data?.error || `Live product read-back failed (HTTP ${data?.httpStatus || res.status}).`
      };
    }
    const product = data.product || (data.id ? data : null);
    if (!product?.id) {
      return { ok: false, error: 'Live product read-back returned no product record.' };
    }
    return { ok: true, product };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to read back live product.' };
  }
}
