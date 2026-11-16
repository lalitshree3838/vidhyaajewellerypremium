import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useMemo,
  CSSProperties,
  SyntheticEvent,
  useCallback
} from 'react';
import { Play } from 'lucide-react';
import { normalizeVideoUrl } from '../lib/videoFallback';

export interface SeamlessLoopVideoHandle {
  play: () => Promise<void>;
  pause: () => void;
  toggleMute: () => boolean;
  videoElement: HTMLVideoElement | null;
}

export interface SeamlessLoopVideoProps {
  src: string;
  fallbackUrls?: string[];
  poster?: string;
  fallbackImage?: string;
  title?: string;
  autoPlay?: boolean;
  isMuted?: boolean;
  controls?: boolean;
  enableObserver?: boolean;
  observerThreshold?: number;
  showPlayButtonFallback?: boolean;
  onError?: (e?: SyntheticEvent<HTMLVideoElement, Event>) => void;
  onLoadedMetadata?: (e: SyntheticEvent<HTMLVideoElement, Event>) => void;
  onLoadedData?: (e: SyntheticEvent<HTMLVideoElement, Event>) => void;
  onCanPlay?: (e: SyntheticEvent<HTMLVideoElement, Event>) => void;
  onPlayStateChange?: (playing: boolean) => void;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
  tabIndex?: number;
}

export const SeamlessLoopVideo = forwardRef<SeamlessLoopVideoHandle, SeamlessLoopVideoProps>(
  (
    {
      src,
      fallbackUrls,
      poster,
      fallbackImage,
      title,
      autoPlay = true,
      isMuted = true,
      controls = false,
      enableObserver = true,
      observerThreshold = 0.1,
      showPlayButtonFallback = true,
      onError,
      onLoadedMetadata,
      onLoadedData,
      onCanPlay,
      onPlayStateChange,
      className = '',
      style,
      'aria-hidden': ariaHidden,
      tabIndex
    },
    ref
  ) => {
    const sourceCandidates = useMemo(() => {
      const list: string[] = [];
      const primary = normalizeVideoUrl(src);
      if (primary) list.push(primary);
      if (Array.isArray(fallbackUrls)) {
        for (const candidate of fallbackUrls) {
          const norm = normalizeVideoUrl(candidate);
          if (norm && !list.includes(norm)) {
            list.push(norm);
          }
        }
      }
      return list;
    }, [src, fallbackUrls]);

    const candidatesKey = sourceCandidates.join('|');
    const [sourceIdx, setSourceIdx] = useState<number>(0);
    const activeSrc = sourceCandidates[sourceIdx] || '';

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isUserPausedRef = useRef<boolean>(false);
    const hasErrorRef = useRef<boolean>(false);
    const prevSrcRef = useRef<string>(activeSrc);
    const prevCandidatesKeyRef = useRef<string>(candidatesKey);
    const playInFlightRef = useRef<boolean>(false);
    const onPlayStateChangeRef = useRef(onPlayStateChange);
    onPlayStateChangeRef.current = onPlayStateChange;

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isUserPaused, setIsUserPaused] = useState<boolean>(false);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);
    const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(!enableObserver);

    const validPoster =
      poster && typeof poster === 'string' && poster.trim() && !poster.startsWith('data:image/svg+xml')
        ? poster
        : fallbackImage &&
          typeof fallbackImage === 'string' &&
          fallbackImage.trim() &&
          !fallbackImage.startsWith('data:image/svg+xml')
        ? fallbackImage
        : undefined;

    const syncVideoAttributes = useCallback(
      (video: HTMLVideoElement, forceMute?: boolean) => {
        const shouldMute = forceMute !== undefined ? forceMute : isMuted;
        video.muted = shouldMute;
        video.defaultMuted = shouldMute;
        if (shouldMute) {
          video.setAttribute('muted', '');
        } else {
          video.removeAttribute('muted');
        }
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', 'true');
      },
      [isMuted]
    );

    const attemptPlay = useCallback(async () => {
      const video = videoRef.current;
      if (!video || !activeSrc || hasErrorRef.current || video.error) return;
      if (!video.paused || playInFlightRef.current) return;

      playInFlightRef.current = true;
      try {
        syncVideoAttributes(video);
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        if (!video.paused) {
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          setHasError(false);
          onPlayStateChangeRef.current?.(true);
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          if (!video.muted) {
            try {
              syncVideoAttributes(video, true);
              await video.play();
              if (!video.paused) {
                setIsPlaying(true);
                setIsAutoplayBlocked(false);
                setHasError(false);
                onPlayStateChangeRef.current?.(true);
                return;
              }
            } catch {
              // Muted autoplay also blocked until user interaction
            }
          }
          setIsAutoplayBlocked(true);
          setIsPlaying(false);
          onPlayStateChangeRef.current?.(false);
        } else if (err?.name !== 'AbortError') {
          console.warn('[SeamlessLoopVideo] Playback attempt rejected:', {
            title,
            videoUrl: activeSrc,
            name: err?.name,
            message: err?.message || err
          });
        }
      } finally {
        playInFlightRef.current = false;
      }
    }, [activeSrc, syncVideoAttributes, title]);

    const setVideoRef = useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (node) {
          syncVideoAttributes(node);
        }
      },
      [syncVideoAttributes]
    );

    // Sync mute property smoothly when toggled by parent
    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      syncVideoAttributes(el);
      if (autoPlay && isVisibleInViewport && !isUserPausedRef.current && !hasErrorRef.current && el.paused) {
        attemptPlay();
      }
    }, [isMuted, autoPlay, isVisibleInViewport, syncVideoAttributes, attemptPlay]);

    // Reset candidate index ONLY when source list actually changes
    useEffect(() => {
      if (prevCandidatesKeyRef.current === candidatesKey) return;
      prevCandidatesKeyRef.current = candidatesKey;
      setSourceIdx(0);
      isUserPausedRef.current = false;
      setIsUserPaused(false);
      hasErrorRef.current = false;
      setHasError(false);
      setIsAutoplayBlocked(false);
      setIsPlaying(false);
      onPlayStateChangeRef.current?.(false);
    }, [candidatesKey]);

    // Handle active source change
    useEffect(() => {
      hasErrorRef.current = false;
      setHasError(false);
      setIsAutoplayBlocked(false);

      const video = videoRef.current;
      if (!video || !activeSrc) return;

      if (prevSrcRef.current !== activeSrc) {
        prevSrcRef.current = activeSrc;
        try {
          video.load();
        } catch {}
      }

      if (autoPlay && isVisibleInViewport && !isUserPausedRef.current) {
        attemptPlay();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSrc]);

    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          isUserPausedRef.current = false;
          setIsUserPaused(false);
          hasErrorRef.current = false;
          setHasError(false);
          setIsAutoplayBlocked(false);
          const el = videoRef.current;
          if (!el || !activeSrc) return;
          if (el.error || el.networkState === 3) {
            try {
              el.load();
            } catch {}
          }
          syncVideoAttributes(el);
          try {
            const p = el.play();
            if (p !== undefined) await p;
            if (!el.paused) {
              setIsPlaying(true);
              onPlayStateChange?.(true);
            }
          } catch (err: any) {
            if (err?.name === 'NotAllowedError' && !el.muted) {
              syncVideoAttributes(el, true);
              await el.play();
              if (!el.paused) {
                setIsPlaying(true);
                onPlayStateChange?.(true);
              }
              return;
            }
            if (err?.name !== 'AbortError') {
              setIsPlaying(false);
              onPlayStateChange?.(false);
            }
          }
        },
        pause: () => {
          isUserPausedRef.current = true;
          setIsUserPaused(true);
          const el = videoRef.current;
          if (el) {
            el.pause();
            setIsPlaying(false);
            onPlayStateChange?.(false);
          }
        },
        toggleMute: () => {
          const el = videoRef.current;
          if (el) {
            const nextMuted = !el.muted;
            syncVideoAttributes(el, nextMuted);
            return nextMuted;
          }
          return true;
        },
        get videoElement() {
          return videoRef.current;
        }
      }),
      [activeSrc, syncVideoAttributes, onPlayStateChange]
    );

    // IntersectionObserver: autoplay when visible, pause when offscreen
    useEffect(() => {
      if (!enableObserver) {
        setIsVisibleInViewport(true);
        const el = videoRef.current;
        if (el && autoPlay && !isUserPausedRef.current && !hasErrorRef.current && el.paused) {
          attemptPlay();
        }
        return;
      }

      const target = containerRef.current || videoRef.current;
      if (!target || typeof IntersectionObserver === 'undefined') {
        setIsVisibleInViewport(true);
        return;
      }

      const checkImmediateRect = () => {
        const rect = target.getBoundingClientRect();
        const inVp =
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth;
        setIsVisibleInViewport(inVp);
        const video = videoRef.current;
        if (!video) return;
        if (inVp && autoPlay && video.paused && !isUserPausedRef.current && !hasErrorRef.current) {
          attemptPlay();
        }
      };
      checkImmediateRect();

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const inView = entry.isIntersecting && entry.intersectionRatio > 0;
            setIsVisibleInViewport(inView);
            const video = videoRef.current;
            if (!video) continue;

            if (inView) {
              if (autoPlay && video.paused && !isUserPausedRef.current && !hasErrorRef.current) {
                attemptPlay();
              }
            } else if (!video.paused) {
              try {
                video.pause();
              } catch {}
            }
          }
        },
        { threshold: [0, observerThreshold ?? 0.1], rootMargin: '0px' }
      );

      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }, [enableObserver, observerThreshold, autoPlay, attemptPlay]);

    // Retry muted autoplay once on first user gesture if browser initially blocked it
    useEffect(() => {
      if (!autoPlay || !isVisibleInViewport || !isAutoplayBlocked) return;

      const handleGlobalInteraction = () => {
        const video = videoRef.current;
        if (video && video.paused && !isUserPausedRef.current && !hasErrorRef.current) {
          attemptPlay();
        }
      };

      window.addEventListener('touchstart', handleGlobalInteraction, { passive: true, once: true });
      window.addEventListener('pointerdown', handleGlobalInteraction, { passive: true, once: true });
      return () => {
        window.removeEventListener('touchstart', handleGlobalInteraction);
        window.removeEventListener('pointerdown', handleGlobalInteraction);
      };
    }, [autoPlay, isVisibleInViewport, isAutoplayBlocked, attemptPlay]);

    const handleEnded = () => {
      const video = videoRef.current;
      if (!video || isUserPausedRef.current || hasErrorRef.current) return;
      try {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } catch {}
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
      const video = videoRef.current;
      if (!video) return;
      if (!isUserPausedRef.current && isVisibleInViewport && autoPlay && video.ended && !hasErrorRef.current) {
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch {}
      }
    };

    const handleVideoCanPlay = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
      hasErrorRef.current = false;
      setHasError(false);
      if (autoPlay && isVisibleInViewport && !isUserPausedRef.current) {
        attemptPlay();
      }
      onCanPlay?.(e);
    };

    const handleVideoError = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
      if (sourceIdx + 1 < sourceCandidates.length) {
        setSourceIdx((prev) => prev + 1);
        return;
      }
      const el = videoRef.current;
      console.warn('[SeamlessLoopVideo] Video unavailable across candidates; showing image fallback:', {
        title,
        videoUrl: activeSrc,
        errorCode: el?.error?.code,
        errorMessage: el?.error?.message,
        readyState: el?.readyState,
        networkState: el?.networkState
      });
      if (!el || el.readyState === 0 || el.error) {
        hasErrorRef.current = true;
        setHasError(true);
        setIsPlaying(false);
        onPlayStateChange?.(false);
      }
      onError?.(e);
    };

    const handleManualPlay = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      isUserPausedRef.current = false;
      setIsUserPaused(false);
      if (!activeSrc || hasError) return;
      const el = videoRef.current;
      if (!el) return;
      setIsAutoplayBlocked(false);
      syncVideoAttributes(el);
      try {
        const pr = el.play();
        if (pr !== undefined) {
          pr.then(() => {
            if (!el.paused) {
              setIsPlaying(true);
              setIsAutoplayBlocked(false);
              onPlayStateChange?.(true);
            }
          }).catch((err: any) => {
            if (!el.muted) {
              syncVideoAttributes(el, true);
              el.play()
                .then(() => {
                  if (!el.paused) {
                    setIsPlaying(true);
                    setIsAutoplayBlocked(false);
                    onPlayStateChange?.(true);
                  }
                })
                .catch(() => {
                  setIsPlaying(false);
                  setIsAutoplayBlocked(true);
                  onPlayStateChange?.(false);
                });
            } else if (err?.name !== 'AbortError') {
              setIsPlaying(false);
              setIsAutoplayBlocked(true);
              onPlayStateChange?.(false);
            }
          });
        }
      } catch {
        setIsPlaying(false);
        onPlayStateChange?.(false);
      }
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={style}
      >
        <video
          ref={setVideoRef}
          src={activeSrc || undefined}
          poster={validPoster}
          title={title}
          autoPlay={autoPlay}
          muted={isMuted}
          controls={controls}
          loop
          playsInline
          webkit-playsinline="true"
          preload="metadata"
          onEnded={handleEnded}
          onError={handleVideoError}
          onLoadedMetadata={(ev) => {
            if (autoPlay && isVisibleInViewport && !isUserPausedRef.current && !hasErrorRef.current) {
              attemptPlay();
            }
            onLoadedMetadata?.(ev);
          }}
          onLoadedData={(ev) => onLoadedData?.(ev)}
          onCanPlay={handleVideoCanPlay}
          onPlaying={(ev) => {
            hasErrorRef.current = false;
            setHasError(false);
            setIsAutoplayBlocked(false);
            setIsPlaying(true);
            onPlayStateChange?.(true);
            onLoadedData?.(ev);
          }}
          onPause={handlePause}
          className={`${className} relative`}
          style={{
            width: '100%',
            height: '100%',
            ...style,
            position: 'relative',
            zIndex: 2,
            opacity: hasError && !isPlaying ? 0 : 1
          }}
          aria-hidden={ariaHidden}
          tabIndex={tabIndex}
        />

        {validPoster && (!isPlaying || hasError) && (
          <img
            src={validPoster}
            alt={title || 'Product jewellery showcase'}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300"
            style={{ zIndex: 1, pointerEvents: 'none' }}
            loading="eager"
          />
        )}

        {showPlayButtonFallback && !controls && !hasError && !isPlaying && (isUserPaused || isAutoplayBlocked || !autoPlay) && (
          <button
            type="button"
            onClick={handleManualPlay}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#DFB982]/95 hover:bg-[#DFB982] text-[#241C1A] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 border-2 border-white/40 cursor-pointer"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              pointerEvents: 'auto',
              cursor: 'pointer',
              backgroundColor: 'rgba(223,185,130,0.95)'
            }}
            title="Play video"
            aria-label="Play video"
          >
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-[#241C1A] ml-1" />
          </button>
        )}

        {hasError && !isPlaying && !validPoster && (
          <div
            className="flex flex-col items-center justify-center p-4 rounded-2xl text-center text-white pointer-events-none"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              backgroundColor: 'rgba(0,0,0,0.72)'
            }}
          >
            <span className="text-xs font-semibold tracking-wider uppercase text-[#DFB982]">
              Video Unavailable
            </span>
          </div>
        )}
      </div>
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
