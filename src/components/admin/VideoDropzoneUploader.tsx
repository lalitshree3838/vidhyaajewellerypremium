import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, X, RefreshCw, CheckCircle2, AlertCircle, FileVideo, Link, Check, AlertTriangle } from 'lucide-react';
import {
  validateVideoFile,
  formatFileSize,
  uploadJewelleryVideo,
  captureVideoThumbnail,
  VideoUploadResult
} from '../../lib/videoStorageService';
import {
  getOfficialVideoEmbedUrl,
  isPreviewEnvironmentHost,
  probeVideoUrlPlayable,
  registerAvailableVideoUrl,
  validateDirectPlayableVideoUrl
} from '../../lib/videoFallback';

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
  const [uploadStage, setUploadStage] = useState<'uploading' | 'verifying'>('uploading');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [showReplaceUrlBox, setShowReplaceUrlBox] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const isPreviewHost = isPreviewEnvironmentHost();

  // Prevent browser from navigating away if video dropped outside dropzone
  useEffect(() => {
    const preventNav = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventNav);
    window.addEventListener('drop', preventNav);
    return () => {
      window.removeEventListener('dragover', preventNav);
      window.removeEventListener('drop', preventNav);
    };
  }, []);

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
    setUploadStage('uploading');
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

      // 2. Upload via authenticated Admin API + verify uploaded file is publicly playable (HEAD 200/206 + video/*)
      const uploadResult = await uploadJewelleryVideo(file, {
        onProgress: (percent) => {
          setUploadProgress(percent);
        },
        onStatusChange: (stage) => {
          setUploadStage(stage);
        }
      });

      if (capturedThumbnail && !uploadResult.thumbnailUrl) {
        uploadResult.thumbnailUrl = capturedThumbnail;
      }

      registerAvailableVideoUrl(uploadResult.url);

      const storageLabel =
        uploadResult.storageType === 'firebase'
          ? 'Firebase Cloud Storage'
          : isPreviewHost
            ? 'Local Preview Storage (Preview only — NOT live Hostinger production)'
            : 'Vidhyaa Production Server (/videos/uploads/)';

      setSuccessInfo(`Uploaded and verified playable on ${storageLabel}! Click Save Product to attach permanently.`);
      setUploadProgress(100);

      // Clean up temporary local blob preview
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setSelectedFile(null);
      setShowReplaceUrlBox(false);

      // Notify parent with persistent URL and metadata
      onVideoUploaded(uploadResult);
    } catch (err: any) {
      console.error('Video upload failed:', err);
      setErrorMessage(
        err.message || 'Video upload failed. Please verify your connection and Admin sign-in.'
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

    // Automatically begin upload + post-upload verification
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

  const handleApplyCustomUrl = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (isValidatingUrl || isUploading || disabled) return;
    const trimmed = customVideoUrl.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    setSuccessInfo(null);

    // 1. Synchronous structural validation (reject HTML pages, unsupported share links, Preview-only URLs)
    const staticValidation = validateDirectPlayableVideoUrl(trimmed);
    if (!staticValidation.valid) {
      setErrorMessage(
        staticValidation.error ||
          'Please enter a direct MP4/WebM/MOV video URL or a supported YouTube/Vimeo link.'
      );
      return;
    }

    // 2. Server-side HTTP/Content-Type/oEmbed check + browser <video> metadata verification
    setIsValidatingUrl(true);
    try {
      const liveValidation = await probeVideoUrlPlayable(trimmed);
      if (!liveValidation.valid || !liveValidation.normalizedUrl) {
        setErrorMessage(
          liveValidation.error ||
            'Video URL could not be verified as a playable video. Check the URL or upload the MP4 directly.'
        );
        return;
      }

      const verifiedUrl = liveValidation.normalizedUrl;
      registerAvailableVideoUrl(verifiedUrl);
      onVideoUploaded({
        url: verifiedUrl,
        fileName:
          liveValidation.kind === 'embed'
            ? `${liveValidation.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} Video Embed`
            : verifiedUrl.split('/').pop() || 'custom_video.mp4',
        storageType: 'server',
        sizeBytes: 0
      });
      setSuccessInfo(
        liveValidation.kind === 'embed'
          ? `Verified ${liveValidation.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} embed link attached! Click Save Product to publish.`
          : 'Verified direct video URL attached! Click Save Product to publish.'
      );
      setCustomVideoUrl('');
      setShowReplaceUrlBox(false);
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const activeEmbedPreviewUrl = currentVideoUrl
    ? getOfficialVideoEmbedUrl(currentVideoUrl, { muted: true, controls: true, autoplay: true })
    : null;

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

      {/* Preview-host honesty notice */}
      {isPreviewHost && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 flex items-start gap-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Preview Environment:</strong> Files uploaded here are stored in Preview storage for testing only and are not uploaded to live Hostinger production (<code>vidhyaajewellerystudio.com</code>).
          </span>
        </div>
      )}

      {/* Case 1: Active attached video preview */}
      {currentVideoUrl && !selectedFile && (
        <div className="bg-[#FAF7F2] border border-[#DFB982]/40 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-[#3B1E22] uppercase tracking-wider">
                {activeEmbedPreviewUrl ? 'Verified Embed Video Attached' : 'Video Ready & Looping'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 bg-white border border-[#E8DCCF] text-gray-700 hover:text-black rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#802336]" />
                <span>Upload New</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReplaceUrlBox((v) => !v);
                  setErrorMessage(null);
                }}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 bg-white border border-[#E8DCCF] text-gray-700 hover:text-black rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
              >
                <Link className="w-3.5 h-3.5 text-[#802336]" />
                <span>Paste URL</span>
              </button>
              {onClearVideo && (
                <button
                  type="button"
                  onClick={() => {
                    setShowReplaceUrlBox(false);
                    setErrorMessage(null);
                    setSuccessInfo(null);
                    onClearVideo();
                  }}
                  disabled={disabled || isUploading}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          {showReplaceUrlBox && (
            <div className="bg-white border border-[#E8DCCF] rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://.../video.mp4, /videos/uploads/video.mp4, or YouTube/Vimeo link"
                  value={customVideoUrl}
                  disabled={isValidatingUrl || isUploading || disabled}
                  onChange={(e) => {
                    setCustomVideoUrl(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCustomUrl(e);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-[#E8DCCF] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#802336] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  disabled={!customVideoUrl.trim() || isValidatingUrl || isUploading || disabled}
                  className="px-3 py-1.5 bg-[#802336] text-white rounded-lg text-xs font-bold hover:bg-[#631B2A] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                >
                  {isValidatingUrl ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify &amp; Replace</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="relative aspect-video max-h-60 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-black/10">
            {activeEmbedPreviewUrl ? (
              <iframe
                src={activeEmbedPreviewUrl}
                title={currentVideoName || 'Product Video Preview'}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={currentVideoUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                controls
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 font-mono gap-2">
            <span className="truncate max-w-xs">{currentVideoName || currentVideoUrl}</span>
            <span className="text-emerald-700 font-sans font-semibold shrink-0">Continuous Loop Active</span>
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
                {isUploading
                  ? uploadStage === 'verifying'
                    ? 'Verifying Public Playback Accessibility...'
                    : 'Uploading Video...'
                  : 'Ready to Upload'}
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
                <span className="font-semibold text-gray-700">
                  {uploadStage === 'verifying'
                    ? 'Confirming uploaded video streams cleanly (HTTP 200/206)...'
                    : 'Uploading video to persistent storage...'}
                </span>
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

      {/* Case 3: Empty State — Two Clearly Accessible Video Input Options (Option A: Upload, Option B: Paste URL) */}
      {!currentVideoUrl && !selectedFile && (
        <div className="space-y-3">
          {/* Option Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4EBE1] rounded-xl border border-[#E8DCCF]">
            <button
              type="button"
              onClick={() => {
                setInputMode('upload');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                inputMode === 'upload'
                  ? 'bg-[#802336] text-white shadow-xs'
                  : 'text-[#3B1E22] hover:bg-white/70'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Option A: Upload Video File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('url');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                inputMode === 'url'
                  ? 'bg-[#802336] text-white shadow-xs'
                  : 'text-[#3B1E22] hover:bg-white/70'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Option B: Paste Video URL</span>
            </button>
          </div>

          {inputMode === 'upload' ? (
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
                    Drag &amp; Drop Your Jewellery Video Here
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
                      or Browse Computer / Camera Roll
                    </button>
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-gray-500">
                  <span className="bg-white border border-[#E8DCCF] px-2.5 py-1 rounded-md font-semibold text-gray-700">
                    MP4
                  </span>
                  <span className="bg-white border border-[#E8DCCF] px-2.5 py-1 rounded-md font-semibold text-gray-700">
                    WebM
                  </span>
                  <span className="bg-white border border-[#E8DCCF] px-2.5 py-1 rounded-md font-semibold text-gray-700">
                    MOV
                  </span>
                  <span className="text-gray-400">• Up to 250 MB</span>
                </div>

                <p className="text-[11px] text-gray-400">
                  Stored permanently in <code>/videos/uploads/</code> and verified playable before saving. Auto-plays in a continuous loop.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FAF7F2] border border-[#E8DCCF] rounded-2xl p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#3B1E22]">
                  Paste a Direct Playable Video URL or YouTube / Vimeo Link
                </p>
                <p className="text-[11px] text-gray-600">
                  Accepts direct HTTPS <code>.mp4</code> / <code>.webm</code> / <code>.mov</code> links, <code>/videos/uploads/...</code> paths, or public YouTube/Vimeo video links.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="https://vidhyaajewellerystudio.com/videos/uploads/video.mp4 or https://youtu.be/..."
                  value={customVideoUrl}
                  disabled={isValidatingUrl || isUploading || disabled}
                  onChange={(e) => {
                    setCustomVideoUrl(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCustomUrl(e);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  disabled={!customVideoUrl.trim() || isValidatingUrl || isUploading || disabled}
                  className="px-4 py-2 bg-[#802336] text-white rounded-xl text-xs font-bold hover:bg-[#631B2A] transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {isValidatingUrl ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify &amp; Attach</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Google Drive, Instagram, Facebook, TikTok, Dropbox <code>?dl=0</code> pages, HTML webpages, and Preview-only URLs are rejected automatically so storefront cards never break.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 flex items-start gap-2.5 text-xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Video Validation / Upload Error</p>
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
