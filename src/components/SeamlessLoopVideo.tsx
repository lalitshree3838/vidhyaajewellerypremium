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
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);
    const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(!enableObserver);

    // Synchronize mute state
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
        videoRef.current.defaultMuted = isMuted;
      }
    }, [isMuted]);

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
          // Browser requires user interaction before playing audio or video
          setIsAutoplayBlocked(true);
          setIsPlaying(false);
        } else if (err?.name !== 'AbortError') {
          console.warn('[Video Player] Playback attempt notice:', err?.message || err);
        }
      }
    }, [isMuted]);

    // Handle imperative handle for external control
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          if (videoRef.current) {
            setIsAutoplayBlocked(false);
            return videoRef.current.play();
          }
        },
        pause: () => {
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
            const inView = entry.isIntersecting;
            setIsVisibleInViewport(inView);
            const video = videoRef.current;
            if (!video) return;

            if (inView) {
              if (autoPlay && video.paused) {
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
        { threshold: observerThreshold }
      );

      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }, [enableObserver, observerThreshold, autoPlay, attemptPlay]);

    // Playback on src change
    useEffect(() => {
      setHasError(false);
      setIsAutoplayBlocked(false);

      const video = videoRef.current;
      if (!video) return;

      if (autoPlay && isVisibleInViewport) {
        attemptPlay();
      }
    }, [src, autoPlay, isVisibleInViewport, attemptPlay]);

    // Seamless Continuous Loop: Guarantee restart on end
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

    const handleVideoCanPlay = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
      if (autoPlay && isVisibleInViewport) {
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
          ref={videoRef}
          src={src}
          poster={poster}
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
          onLoadedData={onLoadedData}
          onCanPlay={handleVideoCanPlay}
          onPlay={() => {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          }}
          onPause={() => setIsPlaying(false)}
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

        {/* Playback Error Recovery Overlay */}
        {hasError && !controls && (
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
