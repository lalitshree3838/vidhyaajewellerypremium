import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { INITIAL_PRODUCTS, isGenuineVideoUrl } from './sampleData';

export function normalizeVideoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const cleaned = url
    .trim()
    .replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i, '$1');
  if (!cleaned) return '';
  return /^videos\/uploads\//i.test(cleaned) ? `/${cleaned}` : cleaned;
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
 */
export function getProductVideoCandidates(product?: Partial<Product> | null): string[] {
  if (!product) return [];
  const rawPrimary = normalizeVideoUrl(
    product.videoUrl || (product as any).video || (product as any).videoURL || ''
  );
  const candidates: string[] = [];
  if (rawPrimary && isGenuineVideoUrl(rawPrimary)) {
    candidates.push(rawPrimary);
  }
  const fallback = getCatalogFallbackVideoUrl(product, rawPrimary);
  if (fallback && !candidates.includes(fallback)) {
    candidates.push(fallback);
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

export function fetchAvailableVideoInventory(): Promise<VideoInventoryState> {
  if (cachedInventory) return Promise.resolve(cachedInventory);
  if (inventoryPromise) return inventoryPromise;

  if (typeof fetch === 'undefined') {
    cachedInventory = { checked: true, supported: false, availableSet: new Set() };
    return Promise.resolve(cachedInventory);
  }

  inventoryPromise = (async (): Promise<VideoInventoryState> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1800) : null;
    try {
      const res = await fetch('/api/videos/available', {
        cache: 'no-store',
        signal: controller?.signal
      });
      if (timeoutId) clearTimeout(timeoutId);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok || !ct.includes('application/json')) {
        cachedInventory = { checked: true, supported: false, availableSet: new Set() };
        return cachedInventory;
      }
      const data = await res.json();
      if (data && data.success && Array.isArray(data.urls)) {
        const availableSet = new Set<string>(
          data.urls.map((u: string) => normalizeVideoUrl(u)).filter(Boolean)
        );
        cachedInventory = { checked: true, supported: true, availableSet };
        return cachedInventory;
      }
    } catch {
      if (timeoutId) clearTimeout(timeoutId);
    }
    cachedInventory = { checked: true, supported: false, availableSet: new Set() };
    return cachedInventory;
  })();

  return inventoryPromise;
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

  if (!inventory || !inventory.checked || !inventory.supported) {
    return {
      resolvedUrl: candidates[0],
      fallbackUrls: candidates.slice(1),
      isKnownMissingLocal: false
    };
  }

  const playable = candidates.filter((url) => {
    if (!url.startsWith('/videos/uploads/')) return true;
    return inventory.availableSet.has(url);
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
 * While initial inventory check (<5ms locally) settles, holds off mounting local /videos/uploads/ URLs
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
    if (cachedInventory) {
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
