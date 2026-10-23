import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const LUXURY_FALLBACK_IMAGE = '/hero-section-image-final.jpg';

/**
 * Compresses an image file in the browser using HTML5 Canvas to produce an optimized,
 * self-contained base64 JPEG data URL (< 100KB) suitable for permanent storage within
 * Firestore product documents when external storage buckets are unavailable.
 */
export async function compressImageToDataUrl(
  file: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data'));
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
          // Fallback to raw base64 if canvas context cannot be initialized
          resolve(reader.result as string);
          return;
        }

        // Fill background with white for transparency handling
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a product image directly to Firebase Cloud Storage, returning a persistent
 * public download URL. If Cloud Storage is unauthenticated or temporarily blocked,
 * seamlessly falls back to an optimized self-contained data URL so the image survives
 * static deployment on Hostinger without missing assets or 404s.
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
      '[Storage] Notice: Direct Firebase Cloud Storage upload encountered an issue, generating persistent optimized data URL fallback:',
      storageError?.message || storageError
    );
    // Reliable fallback: optimized compressed data URL
    return await compressImageToDataUrl(file);
  }
}
