import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, X, RefreshCw, CheckCircle2, AlertCircle, FileVideo, Link, Check } from 'lucide-react';
import {
  validateVideoFile,
  validateVideoFileSignature,
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

export interface VideoPipelineEvent {
  stage: 'validating' | 'validated' | 'chunk_uploading' | 'verifying' | 'file_verified' | 'error';
  errorStage?: 'gateway_ready' | 'video_validation' | 'chunk_upload' | 'file_verified';
  detail?: string;
  progress?: number;
  url?: string;
}

interface VideoDropzoneUploaderProps {
  onVideoUploaded: (result: VideoUploadResult) => void;
  currentVideoUrl?: string;
  currentVideoName?: string;
  onClearVideo?: () => void;
  disabled?: boolean;
  onPipelineEvent?: (event: VideoPipelineEvent) => void;
  gatewayConfigured?: boolean;
  hostingerGatewayDeployed?: boolean;
}

export const VideoDropzoneUploader: React.FC<VideoDropzoneUploaderProps> = ({
  onVideoUploaded,
  currentVideoUrl,
  currentVideoName,
  onClearVideo,
  disabled = false,
  onPipelineEvent,
  gatewayConfigured,
  hostingerGatewayDeployed
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<'uploading' | 'verifying'>('uploading');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number; uploadId: string } | null>(null);
  const [resumableState, setResumableState] = useState<{
    uploadId: string;
    startChunkIndex: number;
    totalChunks: number;
    isFinalChunk?: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [showReplaceUrlBox, setShowReplaceUrlBox] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const activeUploadMetaRef = useRef<{ uploadId: string; chunkIndex: number; totalChunks: number } | null>(null);
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

  const performUpload = async (
    file: File,
    resume?: { uploadId: string; startChunkIndex: number; totalChunks: number; isFinalChunk?: boolean } | null
  ) => {
    setIsUploading(true);
    setUploadStage('uploading');
    if (!resume) {
      setUploadProgress(0);
      setChunkProgress(null);
      activeUploadMetaRef.current = null;
    }
    setErrorMessage(null);
    setSuccessInfo(null);

    onPipelineEvent?.({
      stage: 'chunk_uploading',
      progress: resume ? uploadProgress : 5,
      detail: resume
        ? resume.isFinalChunk
          ? `Retrying finalization & verification on Hostinger Production (chunk ${resume.startChunkIndex + 1})...`
          : `Resuming chunk upload to Hostinger Production from chunk ${resume.startChunkIndex + 1}...`
        : `Uploading ${file.name} (${formatFileSize(file.size)}) in 2 MiB chunks to Hostinger Production...`
    });

    try {
      // 1. Generate thumbnail snapshot in browser if possible
      let capturedThumbnail: string | null = null;
      try {
        capturedThumbnail = await captureVideoThumbnail(file);
      } catch {
        // Thumbnail generation is optional
      }

      // 2. Upload via authenticated Hostinger Production Gateway + verify live HTTP 200/206 playback
      const uploadResult = await uploadJewelleryVideo(file, {
        resumeUploadId: resume?.uploadId,
        startChunkIndex: resume?.startChunkIndex,
        onProgress: (percent) => {
          setUploadProgress(percent);
          onPipelineEvent?.({
            stage: 'chunk_uploading',
            progress: percent,
            detail: activeUploadMetaRef.current
              ? `Chunk ${activeUploadMetaRef.current.chunkIndex + 1} / ${activeUploadMetaRef.current.totalChunks} (${percent}%)`
              : `Uploading to Hostinger Production (${percent}%)`
          });
        },
        onChunkProgress: (chunkIndex, totalChunks, uploadId) => {
          activeUploadMetaRef.current = { uploadId, chunkIndex, totalChunks };
          setChunkProgress({ current: chunkIndex + 1, total: totalChunks, uploadId });
        },
        onStatusChange: (stage) => {
          setUploadStage(stage);
          if (stage === 'verifying') {
            onPipelineEvent?.({
              stage: 'verifying',
              progress: 92,
              detail: 'Finalizing chunks on Hostinger Production & verifying live HTTP 200/206 playback...'
            });
          }
        }
      });

      if (capturedThumbnail && !uploadResult.thumbnailUrl) {
        uploadResult.thumbnailUrl = capturedThumbnail;
      }

      registerAvailableVideoUrl(uploadResult.url);
      setResumableState(null);
      setChunkProgress(null);
      activeUploadMetaRef.current = null;

      const storageLabel = uploadResult.storageTarget || 'Hostinger Production';
      setSuccessInfo(
        `Uploaded and verified live on ${storageLabel} (${uploadResult.url}). Click Save Product to publish.`
      );
      setUploadProgress(100);

      onPipelineEvent?.({
        stage: 'file_verified',
        progress: 100,
        url: uploadResult.url,
        detail: uploadResult.rangeSupported
          ? `Verified live on Hostinger Production (HTTP 206 Range ready): ${uploadResult.url}`
          : `Verified live on Hostinger Production: ${uploadResult.url}`
      });

      // Clean up temporary local blob preview
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setSelectedFile(null);
      setShowReplaceUrlBox(false);

      // Notify parent with persistent canonical Hostinger URL and metadata
      onVideoUploaded(uploadResult);
    } catch (err: any) {
      console.error('Video upload failed:', err);
      const msg =
        err?.message ||
        'Hostinger Production video upload failed. No Preview fallback was used. Check gateway configuration and retry.';
      setErrorMessage(msg);

      const errCode = typeof err?.code === 'string' ? err.code : '';
      const errorStage: VideoPipelineEvent['errorStage'] =
        errCode === 'GATEWAY_NOT_CONFIGURED' || errCode === 'HOSTINGER_AUTH_REJECTED'
          ? 'gateway_ready'
          : errCode === 'LIVE_VERIFICATION_FAILED' || errCode === 'HOSTINGER_MISSING_VIDEO_URL'
            ? 'file_verified'
            : 'chunk_upload';

      const isConfigFailure =
        errCode === 'GATEWAY_NOT_CONFIGURED' || errCode === 'HOSTINGER_AUTH_REJECTED';

      // Preserve uploadId + chunk index so user can retry cleanly from failed chunk or finalization
      // (skip chunk-resume state for server config errors where retrying chunk 1 cannot succeed until secret is set)
      if (isConfigFailure) {
        setResumableState(null);
      } else if (err?.uploadId && typeof err?.failedChunkIndex === 'number') {
        const total = Number(err.totalChunks || activeUploadMetaRef.current?.totalChunks || 0);
        const failedIdx = Number(err.failedChunkIndex);
        setResumableState({
          uploadId: String(err.uploadId),
          startChunkIndex: failedIdx,
          totalChunks: total,
          isFinalChunk: Boolean(err.isFinalChunk || (total > 0 && failedIdx === total - 1))
        });
      } else if (activeUploadMetaRef.current) {
        setResumableState({
          uploadId: activeUploadMetaRef.current.uploadId,
          startChunkIndex: activeUploadMetaRef.current.chunkIndex,
          totalChunks: activeUploadMetaRef.current.totalChunks,
          isFinalChunk:
            activeUploadMetaRef.current.totalChunks > 0 &&
            activeUploadMetaRef.current.chunkIndex === activeUploadMetaRef.current.totalChunks - 1
        });
      }

      onPipelineEvent?.({
        stage: 'error',
        errorStage,
        detail: msg
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelection = async (file: File) => {
    setErrorMessage(null);
    setSuccessInfo(null);
    setResumableState(null);
    setChunkProgress(null);

    onPipelineEvent?.({
      stage: 'validating',
      detail: `Validating ${file.name} (${formatFileSize(file.size)}) format & magic bytes...`
    });

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid video file format.');
      onPipelineEvent?.({
        stage: 'error',
        errorStage: 'video_validation',
        detail: validation.error || 'Invalid video file format.'
      });
      return;
    }

    const sigCheck = await validateVideoFileSignature(file);
    if (!sigCheck.valid) {
      setErrorMessage(sigCheck.error || 'Invalid video file binary signature.');
      onPipelineEvent?.({
        stage: 'error',
        errorStage: 'video_validation',
        detail: sigCheck.error || 'Invalid video file binary signature.'
      });
      return;
    }

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setLocalPreviewUrl(objectUrl);
    setUploadProgress(0);

    onPipelineEvent?.({
      stage: 'validated',
      detail: `Validated ${file.name} (${formatFileSize(file.size)}, ${file.type || 'video'})`
    });

    // Automatically begin upload + post-upload verification to Hostinger Production
    void performUpload(file, null);
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

      {/* Explicit Hostinger Production Storage Target & Readiness Banner */}
      {isPreviewHost && gatewayConfigured === false ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-3 py-2.5 flex items-start gap-2 text-[11px]">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">
              Direct File Upload from Preview Needs Gateway Secret Setup
            </p>
            <p>
              Set <code>VIDHYAA_PROD_UPLOAD_SECRET</code> in Google AI Studio Secrets and Hostinger private config (outside <code>public_html</code>), and deploy the gateway PHP files to Hostinger. Or use <strong>Option B: Paste Video URL</strong> for a video already hosted at <code>https://vidhyaajewellerystudio.com/videos/uploads/</code>.
            </p>
          </div>
        </div>
      ) : isPreviewHost && hostingerGatewayDeployed === false ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-3 py-2.5 flex items-start gap-2 text-[11px]">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Hostinger Gateway PHP Endpoints Not Deployed Yet</p>
            <p>
              Deploy <code>api/admin/_gateway_auth.php</code> and updated <code>api/videos/upload.php</code> to Hostinger Production to enable direct file uploads from Preview.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/90 border border-emerald-200 text-emerald-950 rounded-xl px-3 py-2 flex items-start justify-between gap-2 text-[11px]">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Storage Target: Hostinger Production</strong> (<code>https://vidhyaajewellerystudio.com/videos/uploads/</code>).
              {isPreviewHost
                ? ' Videos uploaded here are transmitted directly to Hostinger Production via the signed upload gateway and verified for live HTTP 206 streaming (never saved to Preview storage).'
                : ' Videos are stored directly on Hostinger Production and verified for live playback.'}
            </span>
          </div>
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-600 px-1 gap-1.5">
            <span className="font-mono truncate max-w-md" title={currentVideoUrl}>
              {currentVideoUrl}
            </span>
            <span className="text-emerald-700 font-sans font-semibold shrink-0">
              {/^https:\/\/(?:www\.)?vidhyaajewellerystudio\.com\/videos\/uploads\//i.test(currentVideoUrl)
                ? 'Hostinger Production URL Verified'
                : 'Continuous Loop Active'}
            </span>
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
              <div className="flex items-center gap-2">
                {resumableState && (
                  <button
                    type="button"
                    onClick={() => performUpload(selectedFile, resumableState)}
                    className="px-4 py-2.5 bg-[#0F5B46] hover:bg-[#0B4636] text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {resumableState.isFinalChunk
                        ? `Retry Finalization (Chunk ${resumableState.startChunkIndex + 1})`
                        : `Retry Chunk ${resumableState.startChunkIndex + 1}`}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => performUpload(selectedFile, null)}
                  className="px-4 py-2.5 bg-[#802336] hover:bg-[#631B2A] text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 text-[#DFB982]" />
                  <span>{resumableState ? 'Restart Full Upload' : 'Upload to Hostinger'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Real Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">
                  {uploadStage === 'verifying'
                    ? 'Verifying live Hostinger video playback (HTTP 200/206)...'
                    : chunkProgress
                      ? `Uploading chunk ${chunkProgress.current} of ${chunkProgress.total} to Hostinger Production...`
                      : 'Uploading video to Hostinger Production...'}
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
