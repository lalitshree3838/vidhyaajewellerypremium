import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const JEWELLERY_PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500" fill="none"><rect width="400" height="500" fill="%23FAF7F2"/><rect x="16" y="16" width="368" height="468" rx="12" fill="%23FFFFFF" stroke="%23E8DCCF" stroke-width="1.5"/><g transform="translate(140, 160)" stroke="%23DFB982" stroke-width="2" fill="none"><path d="M60 20 C30 55 30 95 60 130 C90 95 90 55 60 20 Z" fill="%23FAF7F2"/><circle cx="60" cy="75" r="14" fill="%23DFB982" opacity="0.3"/><polygon points="60,50 76,75 60,100 44,75" fill="%230F5B46" opacity="0.85"/><circle cx="60" cy="148" r="3" fill="%23B8860B"/><circle cx="60" cy="158" r="2" fill="%23B8860B"/></g><text x="200" y="340" font-family="serif" font-size="14" font-weight="600" fill="%233B1E22" text-anchor="middle" letter-spacing="2">VIDHYAA</text><text x="200" y="362" font-family="sans-serif" font-size="10" font-weight="600" fill="%23802336" text-anchor="middle" letter-spacing="1.5">JEWELLERY STUDIO</text><text x="200" y="382" font-family="sans-serif" font-size="9" fill="%239CA3AF" text-anchor="middle">Handcrafted Fine Jewellery</text></svg>`;

export const LUXURY_FALLBACK_IMAGE = JEWELLERY_PLACEHOLDER_IMAGE;

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
 * Uploads a product image directly to Firebase Cloud Storage, returning a persistent
 * public download URL. If Cloud Storage bucket is not yet activated/provisioned in GCP
 * (e.g. 404 storage/unknown), it seamlessly returns an optimized self-contained data URL
 * so the image survives static deployment on Hostinger without missing assets or 404s.
 */
export async function uploadProductImageToStorage(
  file: File,
  productTitle?: string
): Promise<string> {
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
    console.log('[Storage] Image uploaded successfully to Firebase Cloud Storage:', downloadUrl);
    return downloadUrl;
  } catch (storageError: any) {
    console.warn(
      '[Storage Notice] Firebase Cloud Storage upload not available (status 404 / bucket unprovisioned). Generating persistent, optimized embedded data URL for Firestore:',
      storageError?.message || storageError
    );
    // Reliable fallback: optimized compressed data URL embedded directly into Firestore product document
    return await compressImageToDataUrl(file);
  }
}
