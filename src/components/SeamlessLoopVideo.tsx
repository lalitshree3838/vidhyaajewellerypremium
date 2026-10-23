import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

export interface SeamlessLoopVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'autoPlay' | 'loop' | 'muted' | 'playsInline' | 'preload'> {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  enableObserver?: boolean; // defaults to true: plays when visible, pauses when out of view
  observerThreshold?: number; // defaults to 0.15
  isMuted?: boolean; // defaults to true
  autoPlay?: boolean; // defaults to true
  controls?: boolean; // defaults to false
  onEndedCallback?: () => void;
}

export interface SeamlessLoopVideoHandle {
  play: () => Promise<void>;
  pause: () => void;
  restart: () => void;
  toggleMute: () => boolean;
  getVideoElement: () => HTMLVideoElement | null;
}

export const SeamlessLoopVideo = forwardRef<SeamlessLoopVideoHandle, SeamlessLoopVideoProps>(
  (
    {
      src,
      poster,
      className = '',
      style,
      title,
      enableObserver = true,
      observerThreshold = 0.15,
      isMuted = true,
      autoPlay = true,
      controls = false,
      onEndedCallback,
      ...restProps
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isInternalMuted, setIsInternalMuted] = useState<boolean>(isMuted);

    // Sync external isMuted prop changes
    useEffect(() => {
      setIsInternalMuted(isMuted);
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

    // Imperative handle for parent control (e.g., lightbox toggles)
    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
          } catch {
            // Gracefully handled
          }
        }
      },
      pause: () => {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      },
      restart: () => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }
      },
      toggleMute: () => {
        if (videoRef.current) {
          const next = !videoRef.current.muted;
          videoRef.current.muted = next;
          videoRef.current.defaultMuted = next;
          if (next) {
            videoRef.current.setAttribute('muted', '');
          } else {
            videoRef.current.removeAttribute('muted');
          }
          setIsInternalMuted(next);
          return next;
        }
        return true;
      },
      getVideoElement: () => videoRef.current
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // 1. Enforce strict DOM properties required for seamless mobile autoplay across iOS Safari and Android
      video.muted = isInternalMuted;
      video.defaultMuted = isInternalMuted;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      if (isInternalMuted) {
        video.setAttribute('muted', '');
      }

      // Safe playback initiator
      const playSafe = () => {
        if (!autoPlay) return;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Fallback: If autoplay with sound failed, enforce muted and re-attempt
            if (!video.muted) {
              video.muted = true;
              video.defaultMuted = true;
              video.setAttribute('muted', '');
              setIsInternalMuted(true);
              video.play().catch(() => {
                // Browser restrictions will resume on visibility or user touch
              });
            }
          });
        }
      };

      // 2. Seamless continuous loop restart handler:
      // Guarantees immediate rewind and restart when reaching the end, even if native loop drops a frame
      const handleEnded = () => {
        video.currentTime = 0;
        playSafe();
        if (onEndedCallback) {
          onEndedCallback();
        }
      };

      video.addEventListener('ended', handleEnded);

      // 3. IntersectionObserver:
      // Start playback when entering screen, pause when leaving screen to preserve memory & battery
      let observer: IntersectionObserver | null = null;
      if (enableObserver && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                playSafe();
              } else {
                if (!video.paused) {
                  video.pause();
                }
              }
            });
          },
          { threshold: observerThreshold }
        );
        observer.observe(video);
      } else {
        // Fallback: start immediately
        playSafe();
      }

      // 4. Tab visibility awareness: pause when tab hidden, resume when tab active
      const handleVisibilityChange = () => {
        if (document.hidden) {
          if (!video.paused) video.pause();
        } else {
          // If in viewport, resume
          if (observer) {
            const rect = video.getBoundingClientRect();
            const inView = rect.top < window.innerHeight && rect.bottom > 0;
            if (inView) {
              playSafe();
            }
          } else {
            playSafe();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        video.removeEventListener('ended', handleEnded);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (observer) {
          observer.disconnect();
        }
      };
    }, [src, isInternalMuted, autoPlay, enableObserver, observerThreshold, onEndedCallback]);

    return (
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={true}
        muted={isInternalMuted}
        playsInline={true}
        preload="metadata"
        controls={controls}
        title={title}
        className={className}
        style={style}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          const p = e.currentTarget.play();
          if (p !== undefined) p.catch(() => {});
          if (onEndedCallback) onEndedCallback();
        }}
        {...restProps}
      />
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
