import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  X,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Check,
  Star,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, ProductVariation } from '../types';
import { useCart } from '../context/CartContext';
import {
  isGenuineVideoUrl,
  INITIAL_PRODUCTS,
  BANNED_PRODUCT_IDS
} from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';
import {
  normalizeVideoUrl,
  getOfficialVideoEmbedUrl,
  getProductVideoCandidates,
  fetchAvailableVideoInventory,
  resolveCandidatesWithInventory,
  VideoInventoryState
} from '../lib/videoFallback';
import { SeamlessLoopVideo, SeamlessLoopVideoHandle } from './SeamlessLoopVideo';
import {
  JEWELLERY_PLACEHOLDER_IMAGE,
  getProductPrimaryImage,
  useAvailableMediaInventory
} from '../lib/storageService';

interface VideoReelItem {
  id: string;
  title: string;
  category: string;
  price: number;
  mrp: number;
  discount: number;
  videoUrl: string;
  fallbackUrls: string[];
  posterImage: string;
  duration: string;
  features: string;
  productId?: string;
  rawProduct?: Product;
}

interface ShopByVideoSectionProps {
  products: Product[];
  onSelectProduct: (product: Product, variation?: ProductVariation) => void;
}

function formatDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:15';
  const total = Math.max(1, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ReelCardVideoProps {
  videoUrl: string;
  fallbackUrls?: string[];
  fallbackImage?: string;
  title: string;
  isMuted?: boolean;
  carouselRootRef?: React.RefObject<HTMLDivElement | null>;
  onDurationReady?: (formatted: string) => void;
  onRequestInventoryRefresh?: () => void;
}

const ReelCardVideo: React.FC<ReelCardVideoProps> = ({
  videoUrl,
  fallbackUrls,
  fallbackImage,
  title,
  isMuted = true,
  carouselRootRef,
  onDurationReady,
  onRequestInventoryRefresh
}) => {
  const sourceCandidates = useMemo(() => {
    const list: string[] = [];
    const primary = normalizeVideoUrl(videoUrl);
    if (primary) list.push(primary);
    if (Array.isArray(fallbackUrls)) {
      for (const candidate of fallbackUrls) {
        const norm = normalizeVideoUrl(candidate);
        if (norm && !list.includes(norm)) list.push(norm);
      }
    }
    return list;
  }, [videoUrl, fallbackUrls]);

  const candidatesKey = sourceCandidates.join('|');
  const [sourceIdx, setSourceIdx] = useState<number>(0);
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const cleanSrc = sourceCandidates[sourceIdx] || '';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const prevSrcRef = useRef<string>(cleanSrc);
  const hasErrRef = useRef<boolean>(false);
  const userPausedRef = useRef<boolean>(false);
  const playInFlightRef = useRef<boolean>(false);
  const retryQueuedRef = useRef<boolean>(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkRetryCountRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(isMuted);
  const inViewRef = useRef<boolean>(true);
  const viewportVisibleRef = useRef<boolean>(true);
  const carouselVisibleRef = useRef<boolean>(true);

  const [hasErr, setHasErr] = useState(false);
  const [errorKind, setErrorKind] = useState<'network' | 'unavailable'>('unavailable');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const [inView, setInView] = useState(true);

  isMutedRef.current = isMuted;

  const clearRecoveryTimers = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (networkRetryTimerRef.current) {
      clearTimeout(networkRetryTimerRef.current);
      networkRetryTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearRecoveryTimers, [clearRecoveryTimers]);

  const officialEmbedUrl = useMemo(
    () =>
      getOfficialVideoEmbedUrl(cleanSrc, {
        muted: isMuted,
        controls: false,
        autoplay: inView
      }),
    [cleanSrc, isMuted, inView]
  );

  const validRasterPoster =
    fallbackImage &&
    typeof fallbackImage === 'string' &&
    fallbackImage.trim() &&
    !fallbackImage.startsWith('data:image/svg+xml')
      ? fallbackImage
      : '';
  // Always provide a branded jewellery poster fallback instead of a black screen
  const displayPoster = validRasterPoster || JEWELLERY_PLACEHOLDER_IMAGE;

  const syncMuteAttrs = useCallback((el: HTMLVideoElement, mutedState: boolean) => {
    el.muted = mutedState;
    el.defaultMuted = mutedState;
    if (mutedState) {
      el.setAttribute('muted', '');
    } else {
      el.removeAttribute('muted');
    }
    el.loop = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', 'true');
  }, []);

  // Synchronous callback ref ensures muted/defaultMuted/playsInline exist before browser autoplay evaluation
  const setVideoElRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el) {
        syncMuteAttrs(el, isMutedRef.current);
      }
    },
    [syncMuteAttrs]
  );

  const tryPlay = useCallback(async () => {
    const el = videoRef.current;
    if (!el || !cleanSrc || hasErrRef.current || userPausedRef.current || el.error) return;
    if (!el.paused) {
      setPlaying(true);
      setHasErr(false);
      setAutoplayBlocked(false);
      return;
    }
    if (playInFlightRef.current) {
      retryQueuedRef.current = true;
      return;
    }

    playInFlightRef.current = true;
    retryQueuedRef.current = false;
    try {
      syncMuteAttrs(el, isMutedRef.current);
      const p = el.play();
      if (p !== undefined) {
        await p;
      }
      if (!el.paused) {
        setPlaying(true);
        setHasErr(false);
        setAutoplayBlocked(false);
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        if (!el.muted) {
          try {
            syncMuteAttrs(el, true);
            await el.play();
            if (!el.paused) {
              setPlaying(true);
              setHasErr(false);
              setAutoplayBlocked(false);
              return;
            }
          } catch {
            // Muted autoplay blocked until interaction
          }
        }
        setPlaying(false);
        setAutoplayBlocked(true);
      } else if (err?.name === 'AbortError') {
        // Queue a clean retry once media settles instead of dropping silently
        retryQueuedRef.current = true;
      } else {
        console.warn('[ShopByVideoSection] Video autoplay attempt rejected:', {
          title,
          videoUrl: cleanSrc,
          name: err?.name,
          message: err?.message || err
        });
      }
    } finally {
      playInFlightRef.current = false;
      if (
        retryQueuedRef.current &&
        inViewRef.current &&
        !userPausedRef.current &&
        !hasErrRef.current &&
        videoRef.current &&
        videoRef.current.paused &&
        !videoRef.current.error &&
        videoRef.current.readyState >= 2
      ) {
        retryQueuedRef.current = false;
        setTimeout(() => {
          const cur = videoRef.current;
          if (cur && cur.paused && inViewRef.current && !userPausedRef.current && !hasErrRef.current) {
            tryPlay();
          }
        }, 60);
      }
    }
  }, [cleanSrc, title, syncMuteAttrs]);

  const handleTogglePlayPause = useCallback(
    async (ev: React.MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = videoRef.current;
      if (!el || !cleanSrc || hasErrRef.current) return;

      if (!el.paused) {
        userPausedRef.current = true;
        setUserPaused(true);
        try {
          el.pause();
        } catch {}
        setPlaying(false);
        return;
      }

      userPausedRef.current = false;
      setUserPaused(false);
      setAutoplayBlocked(false);

      if (el.error || el.networkState === 3) {
        try {
          el.load();
        } catch {}
      }

      syncMuteAttrs(el, isMutedRef.current);
      try {
        const playPromise = el.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        if (!el.paused) {
          setPlaying(true);
          setHasErr(false);
          setAutoplayBlocked(false);
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' && !el.muted) {
          try {
            syncMuteAttrs(el, true);
            await el.play();
            if (!el.paused) {
              setPlaying(true);
              setHasErr(false);
              setAutoplayBlocked(false);
              return;
            }
          } catch {
            setPlaying(false);
            setAutoplayBlocked(true);
          }
        } else if (err?.name !== 'AbortError') {
          setPlaying(false);
          setAutoplayBlocked(true);
        }
      }
    },
    [cleanSrc, syncMuteAttrs]
  );

  // Explicit user-gesture Tap to Retry control when a stream previously failed
  const handleRetryPlayback = useCallback(
    async (ev: React.MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (onRequestInventoryRefresh) {
        onRequestInventoryRefresh();
      }

      clearRecoveryTimers();
      hasErrRef.current = false;
      userPausedRef.current = false;
      playInFlightRef.current = false;
      retryQueuedRef.current = false;
      networkRetryCountRef.current = 0;
      setHasErr(false);
      setErrorKind('unavailable');
      setUserPaused(false);
      setAutoplayBlocked(false);
      setPlaying(false);
      setHasRenderedFrame(false);
      setSourceIdx(0);
      setRetryNonce((n) => n + 1);

      const el = videoRef.current;
      const firstSrc = sourceCandidates[0] || cleanSrc;
      if (!el || !firstSrc) return;

      try {
        syncMuteAttrs(el, isMutedRef.current);
        el.src = firstSrc;
        el.load();
        const p = el.play();
        if (p !== undefined) {
          await p;
        }
        if (!el.paused) {
          setPlaying(true);
          setHasRenderedFrame(true);
          setHasErr(false);
          setAutoplayBlocked(false);
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          try {
            syncMuteAttrs(el, true);
            await el.play();
            if (!el.paused) {
              setPlaying(true);
              setHasRenderedFrame(true);
              setHasErr(false);
              setAutoplayBlocked(false);
              return;
            }
          } catch {
            setAutoplayBlocked(true);
          }
        }
      }
    },
    [cleanSrc, sourceCandidates, syncMuteAttrs, onRequestInventoryRefresh, clearRecoveryTimers]
  );

  // Sync mute state cleanly without resetting or reloading playing media
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    syncMuteAttrs(el, isMuted);
    if (inView && el.paused && !userPausedRef.current && !hasErrRef.current && el.readyState >= 2) {
      tryPlay();
    }
  }, [isMuted, inView, syncMuteAttrs, tryPlay]);

  // Reset candidate index if product source list changes
  useEffect(() => {
    clearRecoveryTimers();
    setSourceIdx(0);
    userPausedRef.current = false;
    setUserPaused(false);
    hasErrRef.current = false;
    networkRetryCountRef.current = 0;
    setHasErr(false);
    setErrorKind('unavailable');
    setAutoplayBlocked(false);
    setPlaying(false);
    setHasRenderedFrame(false);
  }, [candidatesKey, clearRecoveryTimers]);

  // Load new active source only when source URL genuinely changes
  useEffect(() => {
    clearRecoveryTimers();
    hasErrRef.current = false;
    networkRetryCountRef.current = 0;
    setHasErr(false);
    setErrorKind('unavailable');
    setAutoplayBlocked(false);
    const el = videoRef.current;
    if (el && cleanSrc && !officialEmbedUrl) {
      if (prevSrcRef.current !== cleanSrc) {
        prevSrcRef.current = cleanSrc;
        setPlaying(false);
        setHasRenderedFrame(false);
        syncMuteAttrs(el, isMutedRef.current);
        try {
          el.load();
        } catch {}
      }
      if (inViewRef.current && !userPausedRef.current && el.readyState >= 2) {
        tryPlay();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanSrc, retryNonce, officialEmbedUrl]);

  // Observe visibility in BOTH browser viewport AND horizontal carousel track
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === 'undefined') {
      inViewRef.current = true;
      setInView(true);
      return;
    }

    const updateVisibility = () => {
      const visible = viewportVisibleRef.current && carouselVisibleRef.current;
      inViewRef.current = visible;
      setInView(visible);
      const el = videoRef.current;
      if (!el) return;
      if (visible) {
        if (el.paused && !userPausedRef.current && !hasErrRef.current) {
          tryPlay();
        }
      } else if (!el.paused) {
        try {
          el.pause();
        } catch {}
      }
    };

    const computeInitialVisibility = () => {
      const rect = box.getBoundingClientRect();
      viewportVisibleRef.current =
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth;

      const rootEl = carouselRootRef?.current;
      if (rootEl) {
        const trackRect = rootEl.getBoundingClientRect();
        carouselVisibleRef.current =
          rect.right > trackRect.left + 8 && rect.left < trackRect.right - 8;
      } else {
        carouselVisibleRef.current = rect.right > 0 && rect.left < window.innerWidth;
      }
      updateVisibility();
    };

    computeInitialVisibility();

    const viewportObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          viewportVisibleRef.current = entry.isIntersecting && entry.intersectionRatio > 0;
        }
        updateVisibility();
      },
      { root: null, threshold: [0, 0.1], rootMargin: '0px' }
    );
    viewportObserver.observe(box);

    let carouselObserver: IntersectionObserver | null = null;
    const trackEl = carouselRootRef?.current;
    if (trackEl) {
      carouselObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            carouselVisibleRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.1;
          }
          updateVisibility();
        },
        { root: trackEl, threshold: [0, 0.1], rootMargin: '0px' }
      );
      carouselObserver.observe(box);
    }

    return () => {
      viewportObserver.disconnect();
      carouselObserver?.disconnect();
    };
  }, [carouselRootRef, tryPlay]);

  useEffect(() => {
    if (!inView || !autoplayBlocked) return;
    const onGesture = () => {
      const el = videoRef.current;
      if (el && el.paused && !userPausedRef.current && !hasErrRef.current) {
        tryPlay();
      }
    };
    window.addEventListener('touchstart', onGesture, { passive: true, once: true });
    window.addEventListener('pointerdown', onGesture, { passive: true, once: true });
    return () => {
      window.removeEventListener('touchstart', onGesture);
      window.removeEventListener('pointerdown', onGesture);
    };
  }, [inView, autoplayBlocked, tryPlay]);

  const scheduleStallRecovery = useCallback(() => {
    if (!inViewRef.current || userPausedRef.current || hasErrRef.current) return;
    if (stallTimerRef.current) return;
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      const el = videoRef.current;
      if (!el || !inViewRef.current || userPausedRef.current || hasErrRef.current || el.error) return;
      if (el.paused || el.readyState < 3) {
        tryPlay();
      }
    }, 3500);
  }, [tryPlay]);

  // Official YouTube / Vimeo looping embed player for supported embed links
  if (officialEmbedUrl) {
    return (
      <div
        ref={boxRef}
        className="absolute inset-0 w-full h-full overflow-hidden bg-[#1A1311] select-none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#1A1311'
        }}
      >
        {displayPoster && (
          <img
            src={displayPoster}
            alt={title || 'VIDHYAA Jewellery'}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ zIndex: 1, pointerEvents: 'none' }}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallbackApplied === '1' || img.src.startsWith('data:image/svg+xml')) return;
              img.dataset.fallbackApplied = '1';
              img.src = JEWELLERY_PLACEHOLDER_IMAGE;
            }}
          />
        )}
        <iframe
          src={officialEmbedUrl}
          title={title || 'VIDHYAA Jewellery Video'}
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture"
          loading="lazy"
          tabIndex={-1}
        />
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 w-full h-full overflow-hidden bg-[#1A1311] select-none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#1A1311'
      }}
    >
      <video
        ref={setVideoElRef}
        src={cleanSrc || undefined}
        poster={validRasterPoster || undefined}
        autoPlay
        muted={isMuted}
        loop
        playsInline
        webkit-playsinline="true"
        preload={inView ? 'auto' : 'metadata'}
        title={title}
        onLoadedMetadata={(ev) => {
          const el = ev.currentTarget;
          syncMuteAttrs(el, isMutedRef.current);
          if (el.duration && onDurationReady) {
            onDurationReady(formatDurationLabel(el.duration));
          }
          if (inViewRef.current && !userPausedRef.current && !hasErrRef.current) {
            tryPlay();
          }
        }}
        onLoadedData={() => {
          setHasRenderedFrame(true);
          if (inViewRef.current && !userPausedRef.current && !hasErrRef.current) {
            tryPlay();
          }
        }}
        onCanPlay={(ev) => {
          hasErrRef.current = false;
          setHasErr(false);
          if (ev.currentTarget.readyState >= 2) {
            setHasRenderedFrame(true);
          }
          if (inViewRef.current && !userPausedRef.current) {
            tryPlay();
          }
        }}
        onPlaying={() => {
          clearRecoveryTimers();
          networkRetryCountRef.current = 0;
          const el = videoRef.current;
          if (!el || !el.paused) {
            setPlaying(true);
            setHasRenderedFrame(true);
            setHasErr(false);
            setAutoplayBlocked(false);
          }
        }}
        onTimeUpdate={(ev) => {
          if (ev.currentTarget.currentTime > 0 && !hasRenderedFrame) {
            setHasRenderedFrame(true);
          }
          if (stallTimerRef.current) {
            clearTimeout(stallTimerRef.current);
            stallTimerRef.current = null;
          }
        }}
        onWaiting={scheduleStallRecovery}
        onStalled={scheduleStallRecovery}
        onEnded={() => {
          const el = videoRef.current;
          if (!el || userPausedRef.current || hasErrRef.current) return;
          try {
            el.currentTime = 0;
            el.play().catch(() => {});
          } catch {}
        }}
        onPause={() => {
          setPlaying(false);
          const el = videoRef.current;
          if (el && el.ended && !userPausedRef.current && inViewRef.current && !hasErrRef.current) {
            try {
              el.currentTime = 0;
              el.play().catch(() => {});
            } catch {}
          }
        }}
        onError={() => {
          const el = videoRef.current;
          const errCode = el?.error?.code;
          const isNetworkInterruption =
            errCode === 2 || (typeof navigator !== 'undefined' && navigator.onLine === false);

          // Automatic single recovery attempt for transient network interruptions (MEDIA_ERR_NETWORK)
          if (isNetworkInterruption && networkRetryCountRef.current < 1 && el && cleanSrc) {
            networkRetryCountRef.current += 1;
            clearRecoveryTimers();
            networkRetryTimerRef.current = setTimeout(() => {
              networkRetryTimerRef.current = null;
              const cur = videoRef.current;
              if (!cur || !inViewRef.current || userPausedRef.current) return;
              try {
                syncMuteAttrs(cur, isMutedRef.current);
                cur.load();
                tryPlay();
              } catch {}
            }, 1200);
            return;
          }

          if (sourceIdx + 1 < sourceCandidates.length) {
            networkRetryCountRef.current = 0;
            setSourceIdx((prev) => prev + 1);
            return;
          }

          console.warn('[ReelCardVideo] Video failed to load across candidates:', {
            title,
            videoUrl: cleanSrc,
            errorCode: errCode,
            errorMessage: el?.error?.message
          });
          if (!el || el.readyState === 0 || el.error) {
            clearRecoveryTimers();
            hasErrRef.current = true;
            setErrorKind(isNetworkInterruption ? 'network' : 'unavailable');
            setHasErr(true);
            setPlaying(false);
            setHasRenderedFrame(false);
          }
        }}
        className="w-full h-full object-cover select-none block"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          position: 'relative',
          zIndex: 2,
          // Retain full opacity once first frame renders so native looping never flashes black
          opacity: hasErr || !hasRenderedFrame ? 0 : 1,
          transition: 'opacity 220ms ease'
        }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Jewellery poster shown smoothly before first frame plays AND as a proper fallback on error (never a black screen) */}
      {displayPoster && (!hasRenderedFrame || hasErr) && (
        <img
          src={displayPoster}
          alt={title || 'VIDHYAA Jewellery'}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
          style={{ zIndex: 1, pointerEvents: 'none' }}
          loading="eager"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallbackApplied === '1' || img.src.startsWith('data:image/svg+xml')) {
              return;
            }
            img.dataset.fallbackApplied = '1';
            img.src = JEWELLERY_PLACEHOLDER_IMAGE;
          }}
        />
      )}

      {/* Center Play overlay shown ONLY when paused by user or autoplay-blocked on a valid stream */}
      {!hasErr && !playing && (userPaused || autoplayBlocked) && (
        <button
          type="button"
          onClick={handleTogglePlayPause}
          className="flex flex-col items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            borderRadius: '9999px',
            zIndex: 25,
            pointerEvents: 'auto',
            cursor: 'pointer',
            backgroundColor: 'rgba(223,185,130,0.95)',
            border: '2px solid rgba(255,255,255,0.65)'
          }}
          title={autoplayBlocked ? 'Tap to play video' : `Play ${title || 'video'}`}
          aria-label="Play video"
        >
          <Play className="w-7 h-7 fill-[#241C1A] ml-0.5" />
        </button>
      )}

      {/* Honest fallback badge + working Tap to Retry control distinguishing network interruption vs unavailable URL */}
      {hasErr && (
        <div
          className="flex flex-col items-center gap-2"
          style={{
            position: 'absolute',
            left: '50%',
            top: '46%',
            transform: 'translate(-50%, -50%)',
            zIndex: 30,
            pointerEvents: 'auto'
          }}
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="px-3 py-1 rounded-full bg-black/75 text-[#DFB982] text-[10px] font-bold uppercase tracking-wider border border-white/20 whitespace-nowrap">
            {errorKind === 'network' ? 'Connection Interrupted' : 'Video Unavailable'}
          </div>
          <button
            type="button"
            onClick={handleRetryPlayback}
            className="px-3.5 py-1.5 rounded-full bg-[#DFB982] hover:bg-[#EBD0A4] text-[#241C1A] text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            title="Retry loading video"
            aria-label="Tap to retry video playback"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Tap to Retry</span>
          </button>
        </div>
      )}

      {/* Top-right inline Play/Pause control so users can directly pause/resume inline without blocking video */}
      {!hasErr && (
        <button
          type="button"
          onClick={handleTogglePlayPause}
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-md active:scale-90"
          style={{
            position: 'absolute',
            top: '14px',
            right: '52px',
            zIndex: 30,
            pointerEvents: 'auto',
            backgroundColor: 'rgba(0,0,0,0.6)'
          }}
          title={playing ? 'Pause video' : 'Play video'}
          aria-label={playing ? 'Pause video' : 'Play video'}
        >
          {playing ? (
            <Pause className="w-3.5 h-3.5 text-white" />
          ) : (
            <Play className="w-3.5 h-3.5 text-[#DFB982] fill-[#DFB982] ml-0.5" />
          )}
        </button>
      )}
    </div>
  );
};

export const ShopByVideoSection: React.FC<ShopByVideoSectionProps> = ({
  products,
  onSelectProduct
}) => {
  const { addToCart, openCart } = useCart();
  const mediaInventory = useAvailableMediaInventory();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [inventory, setInventory] = useState<VideoInventoryState>({
    checked: false,
    supported: false,
    availableSet: new Set()
  });
  const [durationByReelId, setDurationByReelId] = useState<Record<string, string>>({});

  const refreshVideoInventory = useCallback((force = false) => {
    fetchAvailableVideoInventory(force).then((inv) => {
      setInventory(inv);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    // Never hide valid Shopping Videos due to temporary inventory API delay
    const releaseTimer = setTimeout(() => {
      if (mounted) {
        setInventory((prev) => (prev.checked ? prev : { ...prev, checked: true }));
      }
    }, 1500);
    fetchAvailableVideoInventory().then((inv) => {
      if (mounted) {
        clearTimeout(releaseTimer);
        setInventory(inv);
      }
    });
    return () => {
      mounted = false;
      clearTimeout(releaseTimer);
    };
  }, []);

  const videoReels: VideoReelItem[] = useMemo(() => {
    if (!inventory.checked) return [];

    const allSourceProducts: Product[] = [];
    const seenProductIds = new Set<string>();

    const pushProduct = (p: Product) => {
      if (!p || !p.id || BANNED_PRODUCT_IDS.has(p.id)) return;
      if (seenProductIds.has(p.id)) return;
      // Record seen ID BEFORE visibility checks so INITIAL_PRODUCTS never re-inserts
      // a product whose "Show in Homepage Shopping Videos" toggle was unchecked or drafted.
      seenProductIds.add(p.id);
      if (p.showInShoppingVideos === false || p.active === false || (p as any)._videoCleared === true) {
        return;
      }
      allSourceProducts.push(p);
    };

    (Array.isArray(products) ? products : []).forEach(pushProduct);
    INITIAL_PRODUCTS.forEach(pushProduct);

    const reels: VideoReelItem[] = [];
    const seenCanonicalReels = new Set<string>();

    for (const p of allSourceProducts) {
      const candidates = getProductVideoCandidates(p);
      if (candidates.length === 0) continue;

      const { resolvedUrl, fallbackUrls, isKnownMissingLocal } = resolveCandidatesWithInventory(
        candidates,
        inventory
      );

      // Skip entries whose local file is missing with no catalog fallback on this host
      if (isKnownMissingLocal || !resolvedUrl || !isGenuineVideoUrl(resolvedUrl)) {
        continue;
      }

      // Deduplicate identical duplicate Firestore/seed products referencing the same reel
      const titleKey = (p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const dedupeKey = `${titleKey}::${resolvedUrl}`;
      if (seenCanonicalReels.has(dedupeKey)) continue;
      seenCanonicalReels.add(dedupeKey);

      const rawThumb = getProductPrimaryImage(p, mediaInventory);
      const thumb =
        rawThumb.startsWith('/products/') && !mediaInventory?.ready && !mediaInventory?.checked
          ? JEWELLERY_PLACEHOLDER_IMAGE
          : rawThumb;

      reels.push({
        id: `reel-${p.id}`,
        title: p.name,
        category: p.categoryName || 'Fine Jewellery',
        price: p.price,
        mrp: p.mrp,
        discount: p.discountPercent,
        videoUrl: resolvedUrl,
        fallbackUrls,
        posterImage: thumb,
        duration: '0:15',
        features:
          p.shortDescription || p.description?.slice(0, 70) || `₹${p.price.toLocaleString('en-IN')}`,
        productId: p.id,
        rawProduct: p
      });
    }

    return reels;
  }, [products, inventory, mediaInventory]);

  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [unmutedReelId, setUnmutedReelId] = useState<string | null>(null);
  const [modalIdx, setModalIdx] = useState<number | null>(null);
  const [modalPlaying, setModalPlaying] = useState<boolean>(false);
  const [modalMuted, setModalMuted] = useState<boolean>(true);
  const [addedReelId, setAddedReelId] = useState<string | null>(null);
  const modalVideoRef = useRef<SeamlessLoopVideoHandle | null>(null);

  useEffect(() => {
    if (videoReels.length > 0 && activeSlide >= videoReels.length) {
      setActiveSlide(0);
    }
    if (modalIdx !== null && (videoReels.length === 0 || modalIdx >= videoReels.length)) {
      setModalIdx(null);
    }
  }, [videoReels.length, activeSlide, modalIdx]);

  const findMatchingProduct = (reel: VideoReelItem): Product => {
    if (reel.rawProduct) return reel.rawProduct;
    if (reel.productId) {
      const match = products.find((p) => p.id === reel.productId);
      if (match) return match;
    }
    const cleanReelId = reel.id.replace(/^reel-/, '');
    return products.find((p) => p.id === cleanReelId) || products[0];
  };

  const handleShopNow = (reel: VideoReelItem) => {
    const prod = findMatchingProduct(reel);
    setModalIdx(null);
    onSelectProduct(prod);
  };

  const handleAddToCart = (reel: VideoReelItem) => {
    const prod = findMatchingProduct(reel);
    const variation: ProductVariation = prod.variations?.[0] || {
      id: `${prod.id}-var-1`,
      name: 'Standard Finish',
      colorFinish: 'Gold',
      hexCode: '#D4AF37',
      sku: `VDH-${prod.id}`,
      price: prod.price,
      mrp: prod.mrp,
      stock: 10,
      image: reel.posterImage,
      active: true
    };
    addToCart(prod, variation, 1);
    setAddedReelId(reel.id);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setAddedReelId(null), 2500);
    openCart();
  };

  const scrollToSlide = (idx: number) => {
    if (videoReels.length === 0) return;
    const clamped = (idx + videoReels.length) % videoReels.length;
    setActiveSlide(clamped);
    const track = trackRef.current;
    if (track && track.children && track.children[clamped]) {
      (track.children[clamped] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  };

  const scrollDir = (dir: 'left' | 'right') => {
    if (videoReels.length === 0) return;
    const nextIdx =
      dir === 'left'
        ? (activeSlide - 1 + videoReels.length) % videoReels.length
        : (activeSlide + 1) % videoReels.length;
    scrollToSlide(nextIdx);
  };

  const onTrackScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.children || el.children.length === 0) return;
    const trackRect = el.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let k = 0; k < el.children.length; k++) {
      const r = el.children[k].getBoundingClientRect();
      const center = r.left + r.width / 2;
      const dist = Math.abs(trackCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = k;
      }
    }
    if (closestIdx !== activeSlide) setActiveSlide(closestIdx);
  }, [activeSlide]);

  useEffect(() => {
    const onKey = (evt: KeyboardEvent) => {
      if (modalIdx !== null && videoReels.length !== 0) {
        if (evt.key === 'Escape') setModalIdx(null);
        if (evt.key === 'ArrowRight') setModalIdx((modalIdx + 1) % videoReels.length);
        if (evt.key === 'ArrowLeft')
          setModalIdx((modalIdx - 1 + videoReels.length) % videoReels.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalIdx, videoReels.length]);

  if (!inventory.checked) {
    return (
      <section
        id="shopping-video"
        className="relative overflow-hidden py-16 sm:py-20 bg-[#FAF7F2] border-y border-[#E8DCCF]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#DFB982] border-t-[#802336] animate-spin" />
        </div>
      </section>
    );
  }

  if (videoReels.length === 0) {
    return (
      <section
        id="shopping-video"
        className="relative overflow-hidden py-14 bg-[#FAF7F2] border-y border-[#E8DCCF]"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#E8DCCF]/60 text-[#802336] text-[11px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-[#DFB982]/40">
            <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
            <span>Studio Video Demonstrations</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
            Craftsmanship in Motion
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
            High-definition 360° video showcases and reel demonstrations will appear here once videos are uploaded.
          </p>
        </div>
      </section>
    );
  }

  const activeModalReel = modalIdx === null ? null : videoReels[modalIdx];

  return (
    <section
      id="shopping-video"
      className="relative overflow-hidden py-16 sm:py-20 bg-[#FAF7F2] border-y border-[#E8DCCF]"
    >
      <style>
        {`#shopping-video .vidhyaa-reel-card{width:78vw;min-width:245px;max-width:310px;aspect-ratio:9 / 16}@media (min-width:640px){#shopping-video .vidhyaa-reel-card{width:290px}}@media (min-width:1024px){#shopping-video .vidhyaa-reel-card{width:310px}}`}
      </style>
      <div className="absolute inset-0 bg-radial from-white/80 via-[#FAF7F2]/95 to-[#FAF7F2] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#DFB982]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#FAF7F2] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-left">
          <div className="space-y-2 max-w-2xl mx-auto md:mx-0">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DFB982]/20 border border-[#DFB982]/40 text-[#802336] text-[11px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3 text-[#B8860B]" />
              <span>Discover Our Jewellery in Motion</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#241C1A] tracking-tight">
              SHOPPING VIDEO
            </h2>

            <p className="text-xs sm:text-sm text-[#5C4D4A] leading-relaxed font-normal">
              Experience the unmatched brilliance, movement, and intricate hand-carved detailing of our regal Indian jewellery in dynamic portrait reels.
            </p>
          </div>

          <div className="hidden sm:flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => scrollDir('left')}
              className="w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer"
              title="Previous video"
              aria-label="Previous video"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => scrollDir('right')}
              className="w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer"
              title="Next video"
              aria-label="Next video"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Cards Showcase Slider */}
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex gap-5 sm:gap-6 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {videoReels.map((reel, idx) => {
            const isCurrent = idx === activeSlide;
            const isSoundOn = unmutedReelId === reel.id;
            const displayDuration = durationByReelId[reel.id] || reel.duration;
            return (
              <div
                key={reel.id}
                onClick={() => {
                  scrollToSlide(idx);
                  setModalPlaying(false);
                  setModalIdx(idx);
                }}
                className={`vidhyaa-reel-card group relative flex-none w-[78vw] sm:w-[280px] lg:w-[285px] aspect-[9/16] snap-center rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ${
                  isCurrent
                    ? 'ring-2 ring-[#DFB982] shadow-2xl scale-[1.01]'
                    : 'ring-1 ring-[#E8DCCF]/80 shadow-md opacity-90 hover:opacity-100 hover:ring-[#DFB982]/60'
                }`}
                style={{ aspectRatio: '9 / 16', minHeight: '420px', backgroundColor: '#120C0B' }}
              >
                <ReelCardVideo
                  videoUrl={reel.videoUrl}
                  fallbackUrls={reel.fallbackUrls}
                  fallbackImage={reel.posterImage}
                  title={reel.title}
                  isMuted={!isSoundOn}
                  carouselRootRef={trackRef}
                  onRequestInventoryRefresh={() => {
                    if (!inventory.supported) {
                      refreshVideoInventory(true);
                    }
                  }}
                  onDurationReady={(dur) => {
                    setDurationByReelId((prev) =>
                      prev[reel.id] === dur ? prev : { ...prev, [reel.id]: dur }
                    );
                  }}
                />

                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent pointer-events-none z-10"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.12) 48%, rgba(0,0,0,0.35) 100%)',
                    pointerEvents: 'none'
                  }}
                />

                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20 pointer-events-none">
                  <div className="flex items-center gap-1.5 pointer-events-none">
                    <span
                      className="bg-white/90 backdrop-blur-md text-[#802336] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs border border-[#E8DCCF]"
                      style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
                    >
                      {reel.category}
                    </span>

                    <span
                      className="bg-black/50 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20"
                      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      <span>{displayDuration}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      setUnmutedReelId(isSoundOn ? null : reel.id);
                    }}
                    className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-md active:scale-90 pointer-events-auto"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30, pointerEvents: 'auto' }}
                    title={isSoundOn ? 'Click to Mute' : 'Click to Unmute Sound'}
                    aria-label={isSoundOn ? 'Mute video sound' : 'Unmute video sound'}
                  >
                    {isSoundOn ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-white/90" />
                    )}
                  </button>
                </div>

                {/* Floating Product Overlay Card at Bottom */}
                <div
                  onClick={(evt) => {
                    evt.stopPropagation();
                    handleShopNow(reel);
                  }}
                  className="absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-[#DFB982]/50 z-20 flex items-center gap-2.5 transition-all duration-300 hover:bg-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
                >
                  {reel.posterImage && (
                    <img
                      src={reel.posterImage}
                      alt={reel.title}
                      className="w-12 h-12 rounded-xl object-cover border border-[#E8DCCF] flex-shrink-0 bg-white"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === '1' || img.src.startsWith('data:image/svg+xml')) return;
                        img.dataset.fallbackApplied = '1';
                        img.src = JEWELLERY_PLACEHOLDER_IMAGE;
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0 pr-1">
                    <h4 className="font-serif text-xs sm:text-sm font-bold text-[#241C1A] truncate leading-tight group-hover:text-[#802336] transition-colors">
                      {reel.title}
                    </h4>
                    <div className="flex items-baseline gap-1.5 pt-0.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-[#802336]">
                        {formatPrice(reel.price)}
                      </span>
                      {reel.mrp > reel.price && (
                        <>
                          <span className="text-[10px] text-gray-400 line-through">
                            {formatPrice(reel.mrp)}
                          </span>
                          <span
                            className="text-[9px] bg-[#802336] text-white px-1 py-0.5 rounded font-bold"
                            style={{ paddingTop: '1px', paddingBottom: '1px' }}
                          >
                            {calculateDiscountPercent(reel.mrp, reel.price)}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      handleShopNow(reel);
                    }}
                    className="btn-teak-green py-2 px-3 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-xs hover:shadow flex-shrink-0"
                  >
                    <span>SHOP NOW</span>
                    <ArrowRight className="w-3 h-3 text-white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {videoReels.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {videoReels.map((reel, dotIdx) => (
              <button
                key={`dot-${reel.id}`}
                type="button"
                onClick={() => scrollToSlide(dotIdx)}
                className={`transition-all duration-300 cursor-pointer rounded-full ${
                  dotIdx === activeSlide ? 'w-7 h-2 bg-[#802336]' : 'w-2 h-2 bg-[#E8DCCF] hover:bg-[#DFB982]'
                }`}
                title={`Go to slide ${dotIdx + 1}`}
                aria-label={`Go to slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}

        <div className="sm:hidden text-center text-[11px] text-[#802336] font-semibold flex items-center justify-center gap-1.5">
          <span>← Swipe to explore more jewellery reels →</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* INTERACTIVE VIDEO LIGHTBOX MODAL                         */}
      {/* ======================================================== */}
      {activeModalReel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setModalIdx(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#FAF7F2] rounded-3xl overflow-hidden shadow-2xl border border-[#DFB982]/50 flex flex-col md:flex-row max-h-[92vh]"
            onClick={(evt) => evt.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalIdx(null)}
              className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close video viewer (Esc)"
              aria-label="Close video viewer"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="relative md:w-3/5 bg-black flex items-center justify-center overflow-hidden select-none"
              style={{ minHeight: '360px' }}
            >
              {(() => {
                const modalEmbedUrl = getOfficialVideoEmbedUrl(activeModalReel.videoUrl, {
                  muted: modalMuted,
                  controls: true,
                  autoplay: true
                });
                if (modalEmbedUrl) {
                  return (
                    <div
                      className="relative w-full h-full max-h-[550px] md:max-h-[640px] flex items-center justify-center"
                      style={{ minHeight: '360px' }}
                    >
                      <iframe
                        key={activeModalReel.id}
                        src={modalEmbedUrl}
                        title={activeModalReel.title}
                        className="w-full h-full min-h-[360px] md:min-h-[520px] border-0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }
                return (
                  <div
                    className="relative w-full h-full max-h-[550px] md:max-h-[640px] flex items-center justify-center cursor-pointer"
                    style={{ minHeight: '360px' }}
                    onClick={() => {
                      const handle = modalVideoRef.current;
                      const vEl = handle?.videoElement;
                      if (!handle) return;
                      if (vEl && !vEl.paused) {
                        handle.pause();
                        setModalPlaying(false);
                      } else {
                        const pr = handle.play();
                        if (pr && typeof pr.then === 'function') {
                          pr.then(() => setModalPlaying(true)).catch(() => setModalPlaying(false));
                        }
                      }
                    }}
                  >
                    <SeamlessLoopVideo
                      ref={modalVideoRef}
                      key={activeModalReel.id}
                      src={activeModalReel.videoUrl}
                      fallbackUrls={activeModalReel.fallbackUrls}
                      fallbackImage={activeModalReel.posterImage}
                      title={activeModalReel.title}
                      autoPlay={true}
                      isMuted={modalMuted}
                      enableObserver={false}
                      showPlayButtonFallback={false}
                      onPlayStateChange={(isP) => setModalPlaying(Boolean(isP))}
                      className="w-full h-full max-h-[550px] md:max-h-[640px] object-contain select-none"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />

                    {!modalPlaying && (
                      <button
                        type="button"
                        onClick={(evt) => {
                          evt.preventDefault();
                          evt.stopPropagation();
                          const handle = modalVideoRef.current;
                          const vEl = handle?.videoElement;
                          if (!handle) return;
                          const pr = handle.play();
                          if (pr && typeof pr.then === 'function') {
                            pr.then(() => {
                              if (!vEl || !vEl.paused) setModalPlaying(true);
                            }).catch(() => setModalPlaying(false));
                          }
                        }}
                        className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/30 text-[#DFB982] shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 30,
                          pointerEvents: 'auto',
                          cursor: 'pointer',
                          backgroundColor: 'rgba(0,0,0,0.75)'
                        }}
                        title="Play video"
                        aria-label="Play video"
                      >
                        <Play className="w-8 h-8 fill-[#DFB982] ml-1" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        if (modalVideoRef.current) {
                          const isM = modalVideoRef.current.toggleMute();
                          setModalMuted(isM);
                        } else {
                          setModalMuted(!modalMuted);
                        }
                      }}
                      className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                      style={{ zIndex: 30, pointerEvents: 'auto' }}
                      title={modalMuted ? 'Click to Unmute' : 'Click to Mute'}
                      aria-label={modalMuted ? 'Unmute video audio' : 'Mute video audio'}
                    >
                      {modalMuted ? (
                        <VolumeX className="w-4 h-4 text-red-300" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>
                  </div>
                );
              })()}

              <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/20 text-[#DFB982]">
                  {modalIdx! + 1} / {videoReels.length}
                </div>
              </div>

              <button
                type="button"
                onClick={(evt) => {
                  evt.stopPropagation();
                  setModalPlaying(false);
                  setModalIdx((modalIdx! - 1 + videoReels.length) % videoReels.length);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20"
                style={{ zIndex: 30, pointerEvents: 'auto' }}
                title="Previous jewellery reel"
                aria-label="Previous jewellery reel"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={(evt) => {
                  evt.stopPropagation();
                  setModalPlaying(false);
                  setModalIdx((modalIdx! + 1) % videoReels.length);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20"
                style={{ zIndex: 30, pointerEvents: 'auto' }}
                title="Next jewellery reel"
                aria-label="Next jewellery reel"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="md:w-2/5 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-white overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="bg-[#DFB982]/20 text-[#802336] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {activeModalReel.category}
                  </span>
                  <div className="flex items-center gap-1 text-[#B8860B] text-xs font-semibold">
                    <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                    <span>4.9 / 5.0 Rating</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#241C1A]">
                    {activeModalReel.title}
                  </h3>
                  <p className="text-xs text-[#5C4D4A] mt-1.5 leading-relaxed">
                    {activeModalReel.features}
                  </p>
                </div>

                <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF] space-y-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-serif font-bold text-[#802336]">
                      {formatPrice(activeModalReel.price)}
                    </span>
                    {activeModalReel.mrp > activeModalReel.price && (
                      <>
                        <span className="text-sm text-gray-400 line-through">
                          {formatPrice(activeModalReel.mrp)}
                        </span>
                        <span className="text-xs bg-[#D4AF37] text-[#3B1E22] font-bold px-2 py-0.5 rounded shadow-xs uppercase tracking-wider">
                          {calculateDiscountPercent(activeModalReel.mrp, activeModalReel.price)}% OFF
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium block">
                    ✓ In Stock • Insured Express Dispatch from Atelier
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1 pt-1">
                  <p>• Handcrafted in Roorkee, District Haridwar atelier with certified purity</p>
                  <p>• Packed in signature velvet presentation jewellery box</p>
                  <p>• 7-Day easy returns & instant UPI payment support</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-[#E8DCCF]">
                <button
                  type="button"
                  onClick={() => handleShopNow(activeModalReel)}
                  className="w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span>SHOP NOW</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => handleAddToCart(activeModalReel)}
                  className="w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {addedReelId === activeModalReel.id ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>ADDED TO BAG!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4 text-white" />
                      <span>ADD TO SHOPPING BAG</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
