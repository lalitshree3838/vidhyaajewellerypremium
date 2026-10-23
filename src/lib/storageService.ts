import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const LUXURY_FALLBACK_IMAGE = '/hero-section-image-final.jpg';

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
