import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  CSSProperties,
  SyntheticEvent,
  useCallback
} from 'react';
import { Play } from 'lucide-react';

export interface SeamlessLoopVideoHandle {
  play: () => Promise<void>;
  pause: () => void;
  toggleMute: () => boolean;
  videoElement: HTMLVideoElement | null;
}

export interface SeamlessLoopVideoProps {
  src: string;
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
      poster,
      fallbackImage,
      title,
      autoPlay = true,
      isMuted = true,
      controls = false,
      enableObserver = true,
      observerThreshold = 0.05,
      showPlayButtonFallback = true,
      onError,
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
    const cleanSrc =
      typeof src === 'string'
        ? src
            .trim()
            .replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i, '$1')
            .replace(/^(videos\/uploads\/)/i, '/$1')
        : '';

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isUserPausedRef = useRef<boolean>(false);
    const hasErrorRef = useRef<boolean>(false);
    const prevSrcRef = useRef<string>(cleanSrc);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);
    const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(true);

    const validPoster =
      poster && typeof poster === 'string' && poster.trim() && !poster.startsWith('data:image/svg+xml')
        ? poster
        : fallbackImage &&
          typeof fallbackImage === 'string' &&
          fallbackImage.trim() &&
          !fallbackImage.startsWith('data:image/svg+xml')
        ? fallbackImage
        : undefined;

    const attemptPlay = useCallback(async () => {
      const video = videoRef.current;
      if (!video || !cleanSrc || hasErrorRef.current || video.error) return;

      try {
        video.muted = isMuted;
        video.defaultMuted = isMuted;
        if (isMuted) {
          video.setAttribute('muted', '');
        } else {
          video.removeAttribute('muted');
        }
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', 'true');

        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
          if (!video.paused) {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
            setHasError(false);
            onPlayStateChange?.(true);
          }
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          if (!video.muted) {
            try {
              video.muted = true;
              video.defaultMuted = true;
              video.setAttribute('muted', '');
              await video.play();
              if (!video.paused) {
                setIsPlaying(true);
                setIsAutoplayBlocked(false);
                setHasError(false);
                onPlayStateChange?.(true);
                return;
              }
            } catch {
              // Both unmuted and muted blocked until gesture
            }
          }
          setIsAutoplayBlocked(true);
          setIsPlaying(false);
          onPlayStateChange?.(false);
        } else if (err?.name !== 'AbortError') {
          console.warn('[SeamlessLoopVideo] Autoplay attempt rejected:', {
            title,
            videoUrl: cleanSrc,
            name: err?.name,
            message: err?.message || err
          });
        }
      }
    }, [isMuted, cleanSrc, title, onPlayStateChange]);

    const setVideoRef = useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (node) {
          node.muted = isMuted;
          node.defaultMuted = isMuted;
          node.playsInline = true;
          node.setAttribute('playsinline', '');
          node.setAttribute('webkit-playsinline', 'true');
          if (isMuted) {
            node.setAttribute('muted', '');
          } else {
            node.removeAttribute('muted');
          }
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = isMuted;
      el.defaultMuted = isMuted;
      if (isMuted) {
        el.setAttribute('muted', '');
      } else {
        el.removeAttribute('muted');
      }
      if (autoPlay && isVisibleInViewport && !isUserPausedRef.current && !hasErrorRef.current && el.paused) {
        attemptPlay();
      }
    }, [isMuted, autoPlay, isVisibleInViewport, attemptPlay]);

    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          isUserPausedRef.current = false;
          hasErrorRef.current = false;
          setHasError(false);
          const el = videoRef.current;
          if (!el) return;
          if (el.error || el.networkState === 3) {
            try {
              el.load();
            } catch {}
          }
          setIsAutoplayBlocked(false);
          return el.play();
        },
        pause: () => {
          isUserPausedRef.current = true;
          if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
            onPlayStateChange?.(false);
          }
        },
        toggleMute: () => {
          if (videoRef.current) {
            const nextMuted = !videoRef.current.muted;
            videoRef.current.muted = nextMuted;
            videoRef.current.defaultMuted = nextMuted;
            if (nextMuted) {
              videoRef.current.setAttribute('muted', '');
            } else {
              videoRef.current.removeAttribute('muted');
            }
            return nextMuted;
          }
          return true;
        },
        get videoElement() {
          return videoRef.current;
        }
      }),
      [title, cleanSrc, onPlayStateChange]
    );

    useEffect(() => {
      if (!enableObserver) {
        setIsVisibleInViewport(true);
        return;
      }

      const target = containerRef.current || videoRef.current;
      if (!target || typeof IntersectionObserver === 'undefined') {
        setIsVisibleInViewport(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const inView = entry.isIntersecting || entry.intersectionRatio > 0;
            setIsVisibleInViewport(inView);
            const video = videoRef.current;
            if (!video) return;

            if (inView) {
              if (autoPlay && video.paused && !isUserPausedRef.current && !hasErrorRef.current) {
                attemptPlay();
              }
            } else if (!video.paused) {
              try {
                video.pause();
                setIsPlaying(false);
                onPlayStateChange?.(false);
              } catch {}
            }
          });
        },
        { threshold: [0, observerThreshold || 0.05, 0.2], rootMargin: '150px 150px 150px 150px' }
      );

      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }, [enableObserver, observerThreshold, autoPlay, attemptPlay, onPlayStateChange]);

    useEffect(() => {
      if (!autoPlay || !isVisibleInViewport) return;

      const handleGlobalInteraction = () => {
        const video = videoRef.current;
        if (video && video.paused && !isUserPausedRef.current && !hasErrorRef.current) {
          attemptPlay();
        }
      };

      window.addEventListener('touchstart', handleGlobalInteraction, { passive: true, once: true });
      window.addEventListener('click', handleGlobalInteraction, { passive: true, once: true });
      window.addEventListener('scroll', handleGlobalInteraction, { passive: true, once: true });

      return () => {
        window.removeEventListener('touchstart', handleGlobalInteraction);
        window.removeEventListener('click', handleGlobalInteraction);
        window.removeEventListener('scroll', handleGlobalInteraction);
      };
    }, [autoPlay, isVisibleInViewport, attemptPlay]);

    useEffect(() => {
      hasErrorRef.current = false;
      setHasError(false);
      setIsAutoplayBlocked(false);
      setIsPlaying(false);
      onPlayStateChange?.(false);

      const video = videoRef.current;
      if (video && cleanSrc) {
        if (prevSrcRef.current !== cleanSrc) {
          prevSrcRef.current = cleanSrc;
          try {
            video.load();
          } catch {}
        }
        if (autoPlay && isVisibleInViewport && !isUserPausedRef.current) {
          attemptPlay();
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cleanSrc]);

    const handleEnded = () => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    };

    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.duration > 0.5 && (video.ended || video.currentTime >= video.duration - 0.08)) {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
      const video = videoRef.current;
      if (!video) return;
      if (!isUserPausedRef.current && isVisibleInViewport && autoPlay) {
        if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.2)) {
          video.currentTime = 0;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        }
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
      const el = videoRef.current;
      console.warn('[SeamlessLoopVideo] Video stream unavailable; using image fallback:', {
        title,
        videoUrl: cleanSrc,
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
      hasErrorRef.current = false;
      setHasError(false);
      const el = videoRef.current;
      if (!el) return;
      if (!cleanSrc) {
        hasErrorRef.current = true;
        setHasError(true);
        return;
      }
      if (!el.getAttribute('src')) {
        el.setAttribute('src', cleanSrc);
      }
      if (el.error || el.networkState === 3) {
        try {
          el.load();
        } catch {}
      }
      el.muted = isMuted;
      el.defaultMuted = isMuted;
      if (isMuted) {
        el.setAttribute('muted', '');
      } else {
        el.removeAttribute('muted');
      }
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', 'true');

      try {
        const pr = el.play();
        if (pr !== undefined) {
          pr.then(() => {
            if (!el.paused) {
              setIsPlaying(true);
              setIsAutoplayBlocked(false);
              setHasError(false);
              onPlayStateChange?.(true);
            }
          }).catch(() => {
            if (!el.muted) {
              el.muted = true;
              el.defaultMuted = true;
              el.setAttribute('muted', '');
              const retryP = el.play();
              if (retryP !== undefined) {
                retryP
                  .then(() => {
                    if (!el.paused) {
                      setIsPlaying(true);
                      setIsAutoplayBlocked(false);
                      setHasError(false);
                      onPlayStateChange?.(true);
                    }
                  })
                  .catch(() => {
                    setIsPlaying(false);
                    setIsAutoplayBlocked(true);
                    onPlayStateChange?.(false);
                  });
              }
            } else {
              setIsPlaying(false);
              setHasError(true);
              onPlayStateChange?.(false);
            }
          });
        } else if (!el.paused) {
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          setHasError(false);
          onPlayStateChange?.(true);
        }
      } catch {
        setIsPlaying(false);
        setHasError(true);
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
          src={cleanSrc || undefined}
          poster={validPoster}
          title={title}
          autoPlay={autoPlay}
          muted={isMuted}
          controls={controls}
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
          onLoadedMetadata={(ev) => {
            if (autoPlay && isVisibleInViewport && !isUserPausedRef.current && !hasErrorRef.current) {
              attemptPlay();
            }
            onLoadedData?.(ev);
          }}
          onLoadedData={(ev) => onLoadedData?.(ev)}
          onCanPlay={handleVideoCanPlay}
          onPlaying={(ev) => {
            hasErrorRef.current = false;
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
            setHasError(false);
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
            opacity: hasError && validPoster && !isPlaying ? 0 : 1
          }}
          aria-hidden={ariaHidden}
          tabIndex={tabIndex}
        />

        {showPlayButtonFallback && (isAutoplayBlocked || !isPlaying) && !hasError && !controls && (
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
            title="Click to play video"
            aria-label="Play video"
          >
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-[#241C1A] ml-1" />
          </button>
        )}

        {validPoster && !isPlaying && (
          <img
            src={validPoster}
            alt={title || 'Product jewellery showcase'}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 transition-opacity duration-500"
            style={{ zIndex: 1, pointerEvents: 'none' }}
            loading="eager"
          />
        )}

        {hasError && !isPlaying && !controls && !validPoster && (
          <button
            type="button"
            onClick={handleManualPlay}
            className="flex flex-col items-center justify-center p-4 rounded-2xl text-center text-white cursor-pointer"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              pointerEvents: 'auto',
              cursor: 'pointer',
              backgroundColor: 'rgba(0,0,0,0.72)'
            }}
            title="Click to retry video playback"
            aria-label="Retry video playback"
          >
            <div className="w-12 h-12 rounded-full bg-[#DFB982]/95 text-[#241C1A] flex items-center justify-center mb-2 transition-transform hover:scale-105 border border-white/30">
              <Play className="w-5 h-5 fill-[#241C1A] ml-0.5" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-[#DFB982]">
              Tap to Retry Video
            </span>
            <span className="text-[10px] text-white/75 mt-1" style={{ fontSize: '10px' }}>
              Tap to play MP4
            </span>
          </button>
        )}
      </div>
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
