import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, X, RefreshCw, CheckCircle2, AlertCircle, Play, FileVideo, Link, Check } from 'lucide-react';
import {
  validateVideoFile,
  formatFileSize,
  uploadJewelleryVideo,
  captureVideoThumbnail,
  VideoUploadResult
} from '../../lib/videoStorageService';

interface VideoDropzoneUploaderProps {
  onVideoUploaded: (result: VideoUploadResult) => void;
  currentVideoUrl?: string;
  currentVideoName?: string;
  onClearVideo?: () => void;
  disabled?: boolean;
}

export const VideoDropzoneUploader: React.FC<VideoDropzoneUploaderProps> = ({
  onVideoUploaded,
  currentVideoUrl,
  currentVideoName,
  onClearVideo,
  disabled = false
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const performUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      // 1. Generate thumbnail snapshot in browser if possible
      let capturedThumbnail: string | null = null;
      try {
        capturedThumbnail = await captureVideoThumbnail(file);
      } catch {
        // Thumbnail generation is optional
      }

      // 2. Perform actual upload to persistent storage (Firebase Storage with server fallback)
      const uploadResult = await uploadJewelleryVideo(file, {
        onProgress: (percent) => {
          setUploadProgress(percent);
        }
      });

      if (capturedThumbnail && !uploadResult.thumbnailUrl) {
        uploadResult.thumbnailUrl = capturedThumbnail;
      }

      const storageLabel = uploadResult.storageType === 'firebase'
        ? 'Firebase Cloud Storage'
        : 'Vidhyaa Persistent Storage';

      setSuccessInfo(`Uploaded successfully to ${storageLabel}!`);
      setUploadProgress(100);

      // Clean up temporary local blob preview
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setSelectedFile(null);

      // Notify parent with persistent URL and metadata
      onVideoUploaded(uploadResult);
    } catch (err: any) {
      console.error('Video upload failed:', err);
      setErrorMessage(
        err.message || 'Video upload failed. Please verify your connection and permissions.'
      );
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelection = (file: File) => {
    setErrorMessage(null);
    setSuccessInfo(null);

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid video file format.');
      return;
    }

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setLocalPreviewUrl(objectUrl);
    setUploadProgress(0);

    // Automatically begin upload so the admin doesn't need to manually click twice
    performUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelection(file);
    }
  };

  const handleBrowseClick = () => {
    if (disabled || isUploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleRemoveSelectedFile = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setSelectedFile(null);
    setLocalPreviewUrl(null);
    setUploadProgress(0);
    setErrorMessage(null);
    setSuccessInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customVideoUrl.trim();
    if (!trimmed) return;
    onVideoUploaded({
      url: trimmed,
      fileName: trimmed.split('/').pop() || 'custom_video.mp4',
      storageType: 'server',
      sizeBytes: 0
    });
    setSuccessInfo('Direct video link attached successfully!');
    setCustomVideoUrl('');
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-3">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || isUploading}
      />

      {/* Case 1: Active uploaded video preview */}
      {currentVideoUrl && !selectedFile && (
        <div className="bg-[#FAF7F2] border border-[#DFB982]/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-[#3B1E22] uppercase tracking-wider">
                Video Uploaded & Looping
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 bg-white border border-[#E8DCCF] text-gray-700 hover:text-black rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#802336]" />
                <span>Replace Video</span>
              </button>
              {onClearVideo && (
                <button
                  type="button"
                  onClick={onClearVideo}
                  disabled={disabled || isUploading}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative aspect-video max-h-60 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-black/10">
            <video
              src={currentVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              controls
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 font-mono">
            <span className="truncate max-w-xs">{currentVideoName || currentVideoUrl}</span>
            <span className="text-emerald-700 font-sans font-semibold">Continuous Loop Active</span>
          </div>
        </div>
      )}

      {/* Case 2: Selected File & Upload in Progress */}
      {selectedFile && (
        <div className="bg-[#FAF7F2] border-2 border-[#802336]/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-[#802336]" />
              <span className="text-xs font-bold text-[#3B1E22]">
                {isUploading ? 'Uploading & Processing...' : 'Ready to Upload'}
              </span>
            </div>
            {!isUploading && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="px-3 py-1 bg-white border border-[#E8DCCF] text-gray-700 hover:text-black rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-gray-50 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-[#802336]" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveSelectedFile}
                  className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          {/* Local Video Preview */}
          {localPreviewUrl && (
            <div className="relative aspect-video max-h-56 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-black/10">
              <video
                ref={videoPreviewRef}
                src={localPreviewUrl}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* File details card */}
          <div className="bg-white border border-[#E8DCCF] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="font-bold text-gray-800 truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Size: <span className="font-semibold text-gray-700">{formatFileSize(selectedFile.size)}</span> • Format: <span className="font-mono text-gray-700">{selectedFile.type || 'video'}</span>
              </p>
            </div>

            {/* Manual Retry/Upload Button if upload didn't start or errored */}
            {!isUploading && (
              <button
                type="button"
                onClick={() => performUpload(selectedFile)}
                className="px-5 py-2.5 bg-[#802336] hover:bg-[#631B2A] text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-98"
              >
                <Upload className="w-4 h-4 text-[#DFB982]" />
                <span>Upload Video</span>
              </button>
            )}
          </div>

          {/* Real Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">Uploading video to persistent storage...</span>
                <span className="font-bold text-[#802336]">{uploadProgress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#802336] via-[#B8324F] to-[#DFB982] rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.max(5, uploadProgress)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Case 3: Empty State - Large Drag & Drop Dropzone */}
      {!currentVideoUrl && !selectedFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-all cursor-pointer select-none ${
            isDragging
              ? 'border-[#802336] bg-[#802336]/10 scale-[1.01]'
              : 'border-[#E8DCCF] hover:border-[#802336]/60 bg-[#FAF7F2]/60 hover:bg-[#FAF7F2]'
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8DCCF] shadow-xs flex items-center justify-center mx-auto text-[#802336]">
              <Film className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="font-serif text-base sm:text-lg font-bold text-[#3B1E22]">
                Drag & Drop Your Jewellery Video Here
              </h4>
              <p className="text-xs sm:text-sm text-gray-500">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBrowseClick();
                  }}
                  className="font-bold text-[#802336] hover:underline cursor-pointer"
                >
                  or Browse Files
                </button>
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-gray-500">
              <span className="bg-white border border-[#E8DCCF] px-2.5 py-1 rounded-md font-semibold text-gray-700">
                MP4
              </span>
              <span className="bg-white border border-[#E8DCCF] px-2.5 py-1 rounded-md font-semibold text-gray-700">
                MOV
              </span>
              <span className="bg-white border border-[#E8DCCF] px-2.5 py-1 rounded-md font-semibold text-gray-700">
                WebM
              </span>
              <span className="text-gray-400">• Up to 250 MB</span>
            </div>

            <p className="text-[11px] text-gray-400">
              Select directly from computer or smartphone camera roll. Plays and loops automatically.
            </p>
          </div>
        </div>
      )}

      {/* Direct Video URL Input Option */}
      {!currentVideoUrl && !selectedFile && (
        <div className="text-center pt-1">
          {!showUrlInput ? (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="text-xs text-[#802336] hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Or enter a direct video URL</span>
            </button>
          ) : (
            <form onSubmit={handleApplyCustomUrl} className="bg-white border border-[#E8DCCF] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">Direct Video URL</span>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="text-gray-400 hover:text-gray-600 text-[11px]"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://.../video.mp4 or /videos/uploads/..."
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-[#E8DCCF] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
                <button
                  type="submit"
                  disabled={!customVideoUrl.trim()}
                  className="px-3 py-1.5 bg-[#802336] text-white rounded-lg text-xs font-bold hover:bg-[#631B2A] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Attach</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 flex items-start gap-2.5 text-xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Upload Error</p>
            <p className="text-[11px] mt-0.5 text-red-600">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {successInfo && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-center gap-2 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successInfo}</span>
        </div>
      )}
    </div>
  );
};
