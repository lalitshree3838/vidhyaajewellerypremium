import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export interface SeamlessLoopVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'autoPlay' | 'loop' | 'muted' | 'playsInline' | 'preload'> {
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
  showSoundToggle?: boolean; // optional user-controlled sound button overlay
  soundTogglePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  soundToggleClassName?: string;
  onEndedCallback?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
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
      showSoundToggle = false,
      soundTogglePosition = 'bottom-right',
      soundToggleClassName = '',
      onEndedCallback,
      onError,
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

    const handleToggleMute = () => {
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
    };

    // Imperative handle for parent control (e.g., lightbox toggles, custom buttons)
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
      toggleMute: handleToggleMute,
      getVideoElement: () => videoRef.current
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // 1. Strict DOM attributes required for seamless mobile & desktop autoplay
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

      // Safe playback initiator with browser policy fallback
      const playSafe = () => {
        if (!autoPlay) return;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Fallback: If autoplay with sound was blocked by browser policy, enforce muted and re-attempt
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

      // 2. Seamless continuous loop restart handlers:
      // Guarantee immediate rewind and restart when reaching end, preventing any freeze
      const handleEnded = () => {
        video.currentTime = 0;
        playSafe();
        if (onEndedCallback) {
          onEndedCallback();
        }
      };

      // Seamless buffer anticipator: rewinds 60ms before true file EOF to avoid native decoder pause
      const handleTimeUpdate = () => {
        if (video.duration && video.currentTime >= video.duration - 0.06) {
          video.currentTime = 0;
          playSafe();
        }
      };

      video.addEventListener('ended', handleEnded);
      video.addEventListener('timeupdate', handleTimeUpdate);

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
        video.removeEventListener('timeupdate', handleTimeUpdate);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (observer) {
          observer.disconnect();
        }
      };
    }, [src, isInternalMuted, autoPlay, enableObserver, observerThreshold, onEndedCallback]);

    const videoElement = (
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
        onError={onError}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          const p = e.currentTarget.play();
          if (p !== undefined) p.catch(() => {});
          if (onEndedCallback) onEndedCallback();
        }}
        {...restProps}
      />
    );

    if (!showSoundToggle) {
      return videoElement;
    }

    const soundPositions: Record<string, string> = {
      'top-left': 'top-2.5 left-2.5',
      'top-right': 'top-2.5 right-2.5',
      'bottom-left': 'bottom-2.5 left-2.5',
      'bottom-right': 'bottom-2.5 right-2.5'
    };
    const soundPosClass = soundPositions[soundTogglePosition] || 'bottom-2.5 right-2.5';

    return (
      <div className="relative w-full h-full">
        {videoElement}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleToggleMute();
          }}
          className={`absolute ${soundPosClass} z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer shadow-md active:scale-90 ${soundToggleClassName}`}
          title={isInternalMuted ? 'Click to Unmute' : 'Click to Mute'}
          aria-label={isInternalMuted ? 'Unmute video audio' : 'Mute video audio'}
        >
          {isInternalMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-white/90" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
        </button>
      </div>
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
