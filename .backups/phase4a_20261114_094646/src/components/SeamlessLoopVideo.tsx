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
import { Play, RotateCw } from 'lucide-react';

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
      className = '',
      style,
      'aria-hidden': ariaHidden,
      tabIndex
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isUserPausedRef = useRef<boolean>(false);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);
    const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(true);

    // Attempt video playback safely without unhandled rejections
    const attemptPlay = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        video.muted = isMuted;
        video.defaultMuted = isMuted;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          setHasError(false);
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          // If unmuted playback was denied, fallback to muted immediately
          if (!video.muted) {
            try {
              video.muted = true;
              video.defaultMuted = true;
              video.setAttribute('muted', '');
              await video.play();
              setIsPlaying(true);
              setIsAutoplayBlocked(false);
              setHasError(false);
              return;
            } catch {
              // Both unmuted and muted blocked by browser policy until gesture
            }
          }
          setIsAutoplayBlocked(true);
          setIsPlaying(false);
        } else if (err?.name !== 'AbortError') {
          console.warn('[Video Player] Playback attempt notice:', err?.message || err);
        }
      }
    }, [isMuted]);

    // Callback ref to guarantee muted and playsinline DOM properties and attributes are set synchronously
    const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
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
        if (autoPlay && !isUserPausedRef.current) {
          const p = node.play();
          if (p !== undefined) {
            p.then(() => {
              setIsPlaying(true);
              setIsAutoplayBlocked(false);
              setHasError(false);
            }).catch((err) => {
              if (err?.name === 'NotAllowedError') {
                if (!node.muted) {
                  node.muted = true;
                  node.defaultMuted = true;
                  node.setAttribute('muted', '');
                  node.play().then(() => {
                    setIsPlaying(true);
                    setIsAutoplayBlocked(false);
                  }).catch(() => {
                    setIsAutoplayBlocked(true);
                  });
                } else {
                  setIsAutoplayBlocked(true);
                }
              }
            });
          }
        }
      }
    }, [isMuted, autoPlay]);

    // Synchronize mute state
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
        videoRef.current.defaultMuted = isMuted;
        if (isMuted) {
          videoRef.current.setAttribute('muted', '');
        } else {
          videoRef.current.removeAttribute('muted');
        }
      }
    }, [isMuted]);

    // Handle imperative handle for external control
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          isUserPausedRef.current = false;
          if (videoRef.current) {
            setIsAutoplayBlocked(false);
            return videoRef.current.play();
          }
        },
        pause: () => {
          isUserPausedRef.current = true;
          if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
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
      []
    );

    // Viewport IntersectionObserver: plays when visible, pauses when off-screen
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
              if (autoPlay && video.paused && !isUserPausedRef.current) {
                attemptPlay();
              }
            } else {
              if (!video.paused) {
                video.pause();
                setIsPlaying(false);
              }
            }
          });
        },
        { threshold: [0, 0.05, 0.2], rootMargin: '100px 0px 100px 0px' }
      );

      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }, [enableObserver, autoPlay, attemptPlay]);

    // Global user interaction listener to unlock autoplay when browser restricts before touch
    useEffect(() => {
      if (!autoPlay || !isVisibleInViewport) return;

      const handleGlobalInteraction = () => {
        const video = videoRef.current;
        if (video && video.paused && !isUserPausedRef.current) {
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

    // Playback on src change
    useEffect(() => {
      setHasError(false);
      setIsAutoplayBlocked(false);

      const video = videoRef.current;
      if (!video) return;

      if (autoPlay && isVisibleInViewport && !isUserPausedRef.current) {
        attemptPlay();
      }
    }, [src, autoPlay, isVisibleInViewport, attemptPlay]);

    // Seamless Continuous Loop: Guarantee instant restart on end across all browsers
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

    // Continuous Loop Protection: detect if video reaches end frame and ensure seamless loop
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

    // Guard against browser pausing at end of video loop
    const handlePause = () => {
      setIsPlaying(false);
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
      if (autoPlay && isVisibleInViewport && !isUserPausedRef.current) {
        attemptPlay();
      }
      onCanPlay?.(e);
    };

    const handleVideoError = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
      console.warn('[Video Player] Video error event on src:', src);
      setHasError(true);
      setIsPlaying(false);
      onError?.(e);
    };

    const handleUserClickPlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      isUserPausedRef.current = false;
      setIsAutoplayBlocked(false);
      setHasError(false);
      const video = videoRef.current;
      if (video) {
        video.muted = isMuted;
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };

    const handleRetry = (e: React.MouseEvent) => {
      e.stopPropagation();
      isUserPausedRef.current = false;
      setHasError(false);
      setIsAutoplayBlocked(false);
      const video = videoRef.current;
      if (video) {
        video.load();
        video.play().then(() => setIsPlaying(true)).catch(() => {});
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
          src={src}
          poster={poster}
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
          onLoadedData={onLoadedData}
          onCanPlay={handleVideoCanPlay}
          onPlay={() => {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          }}
          onPause={handlePause}
          className={className}
          style={{ width: '100%', height: '100%', ...style }}
          aria-hidden={ariaHidden}
          tabIndex={tabIndex}
        />

        {/* Browser Autoplay Blocked Fallback: Clear Interactive Play Button */}
        {showPlayButtonFallback && isAutoplayBlocked && !isPlaying && !controls && (
          <div
            onClick={handleUserClickPlay}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-15 cursor-pointer transition-all duration-300 hover:bg-black/50"
            title="Click to play video"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#DFB982]/95 hover:bg-[#DFB982] text-[#241C1A] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 border-2 border-white/40">
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-[#241C1A] ml-1" />
            </div>
            <span className="absolute bottom-4 bg-black/75 text-[#DFB982] text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-white/20">
              Tap to Play
            </span>
          </div>
        )}

        {/* Genuine Product Image Fallback if Video is Unavailable or Errors */}
        {hasError && fallbackImage && (
          <img
            src={fallbackImage}
            alt={title || 'Product jewellery showcase'}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Playback Error Recovery Overlay if no fallback image */}
        {hasError && !fallbackImage && !controls && (
          <div
            onClick={handleRetry}
            className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-15 cursor-pointer p-4 text-center text-white"
            title="Click to retry video playback"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center mb-2 transition-transform hover:scale-105">
              <RotateCw className="w-6 h-6 text-[#DFB982]" />
            </div>
            <span className="text-xs font-semibold text-[#DFB982]">Replay Video</span>
            <span className="text-[10px] text-gray-300 mt-1">Click to reload</span>
          </div>
        )}
      </div>
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
