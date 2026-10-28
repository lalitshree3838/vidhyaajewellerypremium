import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  CSSProperties,
  SyntheticEvent
} from 'react';

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
      showPlayButtonFallback = false,
      onError,
      onLoadedData,
      onCanPlay,
      className,
      style,
      'aria-hidden': ariaHidden,
      tabIndex
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [, setInternalMuted] = useState(isMuted);

    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          if (videoRef.current) {
            return videoRef.current.play();
          }
        },
        pause: () => {
          if (videoRef.current) {
            videoRef.current.pause();
          }
        },
        toggleMute: () => {
          if (videoRef.current) {
            const nextMuted = !videoRef.current.muted;
            videoRef.current.muted = nextMuted;
            setInternalMuted(nextMuted);
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

    // Keep muted attribute synced
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
        setInternalMuted(isMuted);
      }
    }, [isMuted]);

    // Autoplay when source loads
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (autoPlay) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Browser autoplay policy might require mute or user interaction
          });
        }
      }
    }, [src, autoPlay]);

    // IntersectionObserver to pause when off-screen and resume when in-view
    useEffect(() => {
      if (!enableObserver) return;
      const video = videoRef.current;
      if (!video || typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          });
        },
        {
          threshold: observerThreshold
        }
      );

      observer.observe(video);
      return () => {
        observer.disconnect();
      };
    }, [enableObserver, observerThreshold]);

    const handleEnded = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    };

    return (
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
        preload="auto"
        onEnded={handleEnded}
        onError={onError}
        onLoadedData={onLoadedData}
        onCanPlay={onCanPlay}
        className={className}
        style={style}
        aria-hidden={ariaHidden}
        tabIndex={tabIndex}
      />
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
