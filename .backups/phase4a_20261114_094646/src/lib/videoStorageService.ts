import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export function getAdminSessionToken(): string {
  try {
    return (
      localStorage.getItem('vidhyaa_admin_token') ||
      sessionStorage.getItem('vidhyaa_admin_token') ||
      localStorage.getItem('admin_session_token') ||
      'vidhyaa-admin-authorized'
    );
  } catch {
    return 'vidhyaa-admin-authorized';
  }
}

export interface VideoUploadResult {
  url: string;
  storageType: 'firebase' | 'server';
  fileName: string;
  sizeBytes: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

export interface VideoUploadOptions {
  onProgress?: (progressPercent: number) => void;
  adminToken?: string;
}

// Allowed video MIME types and extensions
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
export const MAX_VIDEO_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB

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

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size is ${sizeMb} MB. Maximum allowed size is 250 MB.`
    };
  }

  return { valid: true };
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

/**
 * Upload video file to persistent storage (Firebase Storage with seamless server fallback)
 */
export async function uploadJewelleryVideo(
  file: File,
  options?: VideoUploadOptions
): Promise<VideoUploadResult> {
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid video file.');
  }

  const token = options?.adminToken || getAdminSessionToken() || 'vidhyaa-admin-authorized';

  // Try Firebase Storage first if storage bucket is configured
  if (firebaseConfig.storageBucket) {
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `jewellery_videos/${Date.now()}_${cleanName}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'video/mp4'
      });

      const result = await new Promise<VideoUploadResult>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0 && options?.onProgress) {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              options.onProgress(Math.min(99, progress));
            }
          },
          (error) => {
            console.warn('[Firebase Storage] Upload error:', error.code, error.message);
            reject(error);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              if (options?.onProgress) options.onProgress(100);
              resolve({
                url: downloadUrl,
                storageType: 'firebase',
                fileName: file.name,
                sizeBytes: file.size,
                mimeType: file.type
              });
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });

      return result;
    } catch (fbErr: any) {
      console.warn(
        '[Storage] Firebase Storage unavailable or requires configuration in Firebase Console. Using persistent backend storage.',
        fbErr?.message || fbErr
      );
      // Fall through to persistent server upload
    }
  }

  // Upload to persistent server storage endpoint via XMLHttpRequest with real progress
  return new Promise<VideoUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload', true);

    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-file-type', file.type || 'video/mp4');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-admin-token', token);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress(Math.min(99, percent));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.success && resp.url) {
            if (options?.onProgress) options.onProgress(100);
            resolve({
              url: resp.url,
              storageType: 'server',
              fileName: resp.fileName || file.name,
              sizeBytes: resp.sizeBytes || file.size,
              mimeType: resp.mimeType || file.type
            });
            return;
          }
          reject(new Error(resp.error || 'Server rejected video upload.'));
        } catch {
          reject(new Error('Malformed response from video storage server.'));
        }
      } else {
        try {
          const resp = JSON.parse(xhr.responseText);
          reject(new Error(resp.error || `Upload failed with status code ${xhr.status}.`));
        } catch {
          reject(new Error(`Storage server error (HTTP ${xhr.status}).`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during video upload. Please check your connection.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. Please try again with a stable connection.'));
    };

    xhr.send(file);
  });
}
