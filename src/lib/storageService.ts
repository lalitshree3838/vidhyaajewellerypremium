import { useEffect, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { isGenuineImageUrl } from './sampleData';
import type { Product, ProductVariation } from '../types';
import { getAdminAuthHeaders } from './adminSessionMemory';

export const JEWELLERY_PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500" fill="none"><rect width="400" height="500" fill="%23FAF7F2"/><rect x="16" y="16" width="368" height="468" rx="12" fill="%23FFFFFF" stroke="%23E8DCCF" stroke-width="1.5"/><g transform="translate(140, 160)" stroke="%23DFB982" stroke-width="2" fill="none"><path d="M60 20 C30 55 30 95 60 130 C90 95 90 55 60 20 Z" fill="%23FAF7F2"/><circle cx="60" cy="75" r="14" fill="%23DFB982" opacity="0.3"/><polygon points="60,50 76,75 60,100 44,75" fill="%230F5B46" opacity="0.85"/><circle cx="60" cy="148" r="3" fill="%23B8860B"/><circle cx="60" cy="158" r="2" fill="%23B8860B"/></g><text x="200" y="340" font-family="serif" font-size="14" font-weight="600" fill="%233B1E22" text-anchor="middle" letter-spacing="2">VIDHYAA</text><text x="200" y="362" font-family="sans-serif" font-size="10" font-weight="600" fill="%23802336" text-anchor="middle" letter-spacing="1.5">JEWELLERY STUDIO</text><text x="200" y="382" font-family="sans-serif" font-size="9" fill="%239CA3AF" text-anchor="middle">Handcrafted Fine Jewellery</text></svg>`;

export const LUXURY_FALLBACK_IMAGE = JEWELLERY_PLACEHOLDER_IMAGE;

export interface MediaInventory {
  ready: boolean;
  checked?: boolean;
  productImages: Set<string>;
  categoryImages: Set<string>;
}

let cachedMediaInventory: MediaInventory | null = null;
let inflightMediaPromise: Promise<MediaInventory> | null = null;
const sessionUploadedProductImages = new Set<string>();

export function normalizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let s = url.trim();
  if (!s) return '';
  if (s.startsWith('data:image/') || s.startsWith('blob:')) {
    return s;
  }
  s = s.replace(/\\/g, '/');
  s = s.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i, '$1');
  if (/^(?:products|categories|assets|uploads)\//i.test(s)) {
    s = '/' + s;
  }
  return s;
}

function hasInMediaSet(set: Set<string>, url: string): boolean {
  if (set.has(url) || sessionUploadedProductImages.has(url)) return true;
  const noQuery = url.split(/[?#]/)[0];
  if (set.has(noQuery) || sessionUploadedProductImages.has(noQuery)) return true;
  try {
    const decoded = decodeURIComponent(noQuery);
    if (set.has(decoded) || sessionUploadedProductImages.has(decoded)) return true;
  } catch {}
  return false;
}

export function addUploadedProductImageToCache(url?: string | null): void {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return;
  sessionUploadedProductImages.add(normalized);
  if (cachedMediaInventory) {
    cachedMediaInventory.productImages.add(normalized);
  }
}

export function invalidateMediaInventoryCache(): void {
  cachedMediaInventory = null;
  inflightMediaPromise = null;
}

export async function fetchAvailableMediaInventory(): Promise<MediaInventory> {
  if (cachedMediaInventory?.ready) {
    return cachedMediaInventory;
  }
  if (inflightMediaPromise) {
    return inflightMediaPromise;
  }
  const promise = (async (): Promise<MediaInventory> => {
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (typeof fetch !== 'undefined') {
        controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        if (controller) {
          timer = setTimeout(() => controller?.abort(), 2500);
        }
        const res = await fetch('/api/media/available', {
          cache: 'no-store',
          signal: controller?.signal
        });
        if (res.ok) {
          const data = await res.json();
          const inv: MediaInventory = {
            ready: true,
            checked: true,
            productImages: new Set(
              Array.isArray(data?.productImages)
                ? data.productImages.map((u: string) => normalizeImageUrl(u)).filter(Boolean)
                : []
            ),
            categoryImages: new Set(
              Array.isArray(data?.categoryImages)
                ? data.categoryImages.map((u: string) => normalizeImageUrl(u)).filter(Boolean)
                : []
            )
          };
          cachedMediaInventory = inv;
          return inv;
        }
      }
    } catch {} finally {
      if (timer) clearTimeout(timer);
    }
    const fallbackInv: MediaInventory = {
      ready: false,
      checked: true,
      productImages: new Set<string>(),
      categoryImages: new Set<string>()
    };
    cachedMediaInventory = fallbackInv;
    return fallbackInv;
  })().finally(() => {
    if (inflightMediaPromise === promise) {
      inflightMediaPromise = null;
    }
  });
  inflightMediaPromise = promise;
  return promise;
}

if (typeof window !== 'undefined') {
  fetchAvailableMediaInventory().catch(() => {});
}

export function useAvailableMediaInventory(): MediaInventory | null {
  const [inv, setInv] = useState<MediaInventory | null>(cachedMediaInventory);
  useEffect(() => {
    if (cachedMediaInventory?.ready || cachedMediaInventory?.checked) {
      setInv(cachedMediaInventory);
      return;
    }
    let mounted = true;
    fetchAvailableMediaInventory().then((res) => {
      if (mounted && (res.ready || res.checked)) setInv(res);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return inv;
}

export function shouldDeferLocalMediaUrl(
  url?: string | null,
  inventory: MediaInventory | null = cachedMediaInventory
): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized || !normalized.startsWith('/products/')) return false;
  return !inventory?.checked && !inventory?.ready;
}

export function isKnownMissingMediaUrl(
  url?: string | null,
  inventory: MediaInventory | null = cachedMediaInventory
): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized || !inventory?.ready) return false;
  if (normalized.startsWith('/products/')) {
    return !hasInMediaSet(inventory.productImages, normalized);
  }
  if (normalized.startsWith('/categories/')) {
    return inventory.categoryImages.size > 0 && !hasInMediaSet(inventory.categoryImages, normalized);
  }
  return false;
}

export function resolveSafeProductImageUrl(
  url?: string | null,
  inventory: MediaInventory | null = cachedMediaInventory
): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized || normalized.startsWith('data:image/svg+xml') || !isGenuineImageUrl(normalized)) {
    return JEWELLERY_PLACEHOLDER_IMAGE;
  }

  if (normalized.startsWith('data:image/') || normalized.startsWith('blob:')) {
    return normalized;
  }

  if (normalized.startsWith('/products/')) {
    if (sessionUploadedProductImages.has(normalized)) {
      return normalized;
    }
    if (!normalized.startsWith('/products/uploads/') && inventory?.checked && !inventory?.ready) {
      return JEWELLERY_PLACEHOLDER_IMAGE;
    }
    if (inventory?.ready && !hasInMediaSet(inventory.productImages, normalized)) {
      return JEWELLERY_PLACEHOLDER_IMAGE;
    }
    return normalized;
  }

  if (normalized.startsWith('/categories/')) {
    if (inventory?.ready && inventory.categoryImages.size > 0 && !hasInMediaSet(inventory.categoryImages, normalized)) {
      return JEWELLERY_PLACEHOLDER_IMAGE;
    }
    return normalized;
  }

  return normalized;
}

export function getProductImageCandidates(
  product?: Partial<Product> | null,
  variation?: Partial<ProductVariation> | null,
  inventory: MediaInventory | null = cachedMediaInventory
): string[] {
  if (!product) return [];
  const raw: string[] = [];

  if (variation?.image && typeof variation.image === 'string') {
    raw.push(variation.image);
  }
  if (Array.isArray(variation?.additionalImages)) {
    variation.additionalImages.forEach((img) => {
      if (typeof img === 'string') raw.push(img);
    });
  }
  if (Array.isArray(product.images)) {
    product.images.forEach((img) => {
      if (typeof img === 'string') raw.push(img);
    });
  }
  if (Array.isArray(product.variations)) {
    product.variations.forEach((v) => {
      if (v?.image && typeof v.image === 'string') raw.push(v.image);
      if (Array.isArray(v?.additionalImages)) {
        v.additionalImages.forEach((img) => {
          if (typeof img === 'string') raw.push(img);
        });
      }
    });
  }

  const seen = new Set<string>();
  const valid: string[] = [];
  raw.forEach((u) => {
    const safeUrl = resolveSafeProductImageUrl(u, inventory);
    if (!safeUrl || safeUrl === JEWELLERY_PLACEHOLDER_IMAGE || seen.has(safeUrl)) return;
    seen.add(safeUrl);
    if (isGenuineImageUrl(safeUrl)) {
      valid.push(safeUrl);
    }
  });
  return valid;
}

export function getProductPrimaryImage(
  product?: Partial<Product> | null,
  inventory: MediaInventory | null = cachedMediaInventory,
  variation?: Partial<ProductVariation> | null
): string {
  const candidates = getProductImageCandidates(product, variation, inventory);
  return candidates[0] || JEWELLERY_PLACEHOLDER_IMAGE;
}

export function hasRenderableProductImage(
  product?: Partial<Product> | null,
  inventory: MediaInventory | null = cachedMediaInventory
): boolean {
  return getProductImageCandidates(product, null, inventory).length > 0;
}

export function isDataUrl(url?: string | null): boolean {
  return typeof url === 'string' && url.startsWith('data:image/');
}

export function isStorageUrl(url?: string | null): boolean {
  if (typeof url !== 'string') return false;
  return url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app');
}

/**
 * Compresses an image file in the browser using HTML5 Canvas to produce an optimized,
 * self-contained base64 JPEG/WebP data URL (< 50KB) suitable for permanent storage within
 * Firestore product documents when external storage buckets are unavailable or returning 404.
 */
export async function compressImageToDataUrl(
  file: File | Blob,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file from disk'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data into HTMLImageElement'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Fill background with white for transparency handling
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer WebP for optimal compression ratio, fall back to JPEG
        let compressedDataUrl = '';
        try {
          compressedDataUrl = canvas.toDataURL('image/webp', quality);
          if (!compressedDataUrl.startsWith('data:image/webp')) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a product image persistently to server storage (/api/media/upload -> /products/uploads/...)
 * using HttpOnly admin session cookies. Falls back to Firebase Storage or compressed data URL
 * ONLY when running purely client-side without a server media endpoint.
 */
export async function uploadProductImageToStorage(
  file: File,
  productTitle?: string
): Promise<string> {
  if (!file) {
    throw new Error('Please choose an image file to upload.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`Image "${file.name}" exceeds the 10 MB maximum file size.`);
  }

  // 1. Primary path: persistent server media endpoint (/products/uploads/...)
  try {
    const formData = new FormData();
    formData.append('image', file, file.name);
    if (productTitle) {
      formData.append('productTitle', productTitle);
    }

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      credentials: 'include',
      headers: getAdminAuthHeaders(),
      body: formData
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(data?.error || 'Administrator session expired or unauthorized. Please sign in again before uploading images.');
    }
    if (res.status === 400 || res.status === 413 || res.status === 415) {
      throw new Error(data?.error || `Image upload rejected (${res.status}). Only valid JPG, PNG, WebP, or GIF images up to 10 MB are accepted.`);
    }

    if (res.ok && data?.success && data?.url) {
      const normalizedUrl = normalizeImageUrl(String(data.url));
      addUploadedProductImageToCache(normalizedUrl);
      return normalizedUrl;
    }

    if (res.status !== 404) {
      throw new Error(data?.error || `Failed to save uploaded image (HTTP ${res.status}).`);
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/unauthorized|session expired|rejected|unsupported|exceeds|10 mb|invalid image|forbidden/i.test(msg)) {
      throw err;
    }
  }

  // 2. Secondary fallback (Firebase Storage or compressed Data URL only if server route unavailable)
  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `products/${timestamp}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        product: productTitle || 'Vidhyaa Jewellery Piece',
        uploadedAt: new Date().toISOString()
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    addUploadedProductImageToCache(downloadUrl);
    return downloadUrl;
  } catch {
    return await compressImageToDataUrl(file);
  }
}

export async function uploadMultipleProductImages(
  files: File[],
  productTitle?: string
): Promise<string[]> {
  const uploaded: string[] = [];
  for (const file of files) {
    const url = await uploadProductImageToStorage(file, productTitle);
    if (url) uploaded.push(url);
  }
  return uploaded;
}
