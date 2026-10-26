import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';

export interface SeamlessLoopVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'autoPlay' | 'loop' | 'muted' | 'playsInline' | 'preload'> {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  enableObserver?: boolean; // defaults to true: plays when visible, pauses when out of view
  observerThreshold?: number; // defaults to 0.05
  isMuted?: boolean; // defaults to true
  autoPlay?: boolean; // defaults to true
  controls?: boolean; // defaults to false
  showSoundToggle?: boolean; // optional user-controlled sound button overlay
  soundTogglePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  soundToggleClassName?: string;
  showPlayButtonFallback?: boolean; // shows subtle play icon when browser blocks initial autoplay
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
      observerThreshold = 0.05,
      isMuted = true,
      autoPlay = true,
      controls = false,
      showSoundToggle = false,
      soundTogglePosition = 'bottom-right',
      soundToggleClassName = '',
      showPlayButtonFallback = true,
      onEndedCallback,
      onError,
      ...restProps
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isInternalMuted, setIsInternalMuted] = useState<boolean>(isMuted);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
    const interactionArmedRef = useRef<boolean>(false);

    // Apply strict synchronous audio properties immediately when DOM node mounts or updates
    const applyMutedState = useCallback((node: HTMLVideoElement | null, muted: boolean) => {
      if (!node) return;
      node.muted = muted;
      node.defaultMuted = muted;
      if (muted) {
        node.setAttribute('muted', '');
      } else {
        node.removeAttribute('muted');
      }
    }, []);

    // Sync external isMuted prop
    useEffect(() => {
      setIsInternalMuted(isMuted);
      applyMutedState(videoRef.current, isMuted);
    }, [isMuted, applyMutedState]);

    const handleToggleMute = useCallback(() => {
      if (videoRef.current) {
        const next = !videoRef.current.muted;
        applyMutedState(videoRef.current, next);
        setIsInternalMuted(next);
        return next;
      }
      return true;
    }, [applyMutedState]);

    // Reliable play helper with multi-stage fallback handling
    const playSafe = useCallback(() => {
      const video = videoRef.current;
      if (!video || !autoPlay) return;

      // Ensure proper DOM attributes before play attempt
      video.muted = isInternalMuted;
      video.defaultMuted = isInternalMuted;
      video.playsInline = true;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          })
          .catch((err: any) => {
            // If browser autoplay policy blocked playback:
            // Stage 1: If it was trying to play with audio, mute immediately and retry
            if (!video.muted) {
              applyMutedState(video, true);
              setIsInternalMuted(true);
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setIsAutoplayBlocked(false);
                })
                .catch(() => {
                  setIsPlaying(false);
                  setIsAutoplayBlocked(true);
                  armInteractionRetry();
                });
            } else {
              // Stage 2: Muted playback was also restricted (e.g., initial iFrame load before user gesture)
              setIsPlaying(false);
              setIsAutoplayBlocked(true);
              armInteractionRetry();
            }
          });
      }
    }, [autoPlay, isInternalMuted, applyMutedState]);

    // Global interaction listener: on user's first click, scroll, touch, or keydown, resume playback
    const armInteractionRetry = useCallback(() => {
      if (interactionArmedRef.current) return;
      interactionArmedRef.current = true;

      const resumeOnGesture = () => {
        interactionArmedRef.current = false;
        cleanupGestureListeners();
        const v = videoRef.current;
        if (v && v.paused) {
          applyMutedState(v, true);
          v.play()
            .then(() => {
              setIsPlaying(true);
              setIsAutoplayBlocked(false);
            })
            .catch(() => {});
        }
      };

      const cleanupGestureListeners = () => {
        window.removeEventListener('pointerdown', resumeOnGesture);
        window.removeEventListener('touchstart', resumeOnGesture);
        window.removeEventListener('click', resumeOnGesture);
        window.removeEventListener('scroll', resumeOnGesture, true);
        window.removeEventListener('keydown', resumeOnGesture);
      };

      window.addEventListener('pointerdown', resumeOnGesture, { once: true, passive: true });
      window.addEventListener('touchstart', resumeOnGesture, { once: true, passive: true });
      window.addEventListener('click', resumeOnGesture, { once: true, passive: true });
      window.addEventListener('scroll', resumeOnGesture, { once: true, passive: true, capture: true });
      window.addEventListener('keydown', resumeOnGesture, { once: true, passive: true });
    }, [applyMutedState]);

    // Imperative handle for parent control (lightboxes, external controls)
    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          } catch {
            // Gracefully handled
          }
        }
      },
      pause: () => {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      restart: () => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          playSafe();
        }
      },
      toggleMute: handleToggleMute,
      getVideoElement: () => videoRef.current
    }));

    // Setup video DOM properties, loop handlers, and IntersectionObserver
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // 1. Enforce strict DOM properties required for mobile & desktop autoplay
      applyMutedState(video, isInternalMuted);
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      // 2. Seamless continuous loop restart handlers:
      // Guarantee immediate rewind and restart when reaching end, preventing any freeze
      const handleEnded = () => {
        video.currentTime = 0;
        playSafe();
        if (onEndedCallback) {
          onEndedCallback();
        }
      };

      // Seamless buffer anticipator: rewinds 50ms before true file EOF to avoid native decoder pause
      const handleTimeUpdate = () => {
        if (video.duration && video.currentTime >= video.duration - 0.05) {
          video.currentTime = 0;
          playSafe();
        }
      };

      const handlePlayingEvent = () => {
        setIsPlaying(true);
        setIsAutoplayBlocked(false);
      };

      const handlePauseEvent = () => {
        setIsPlaying(false);
      };

      const handleCanPlay = () => {
        if (autoPlay && video.paused) {
          playSafe();
        }
      };

      video.addEventListener('ended', handleEnded);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('playing', handlePlayingEvent);
      video.addEventListener('pause', handlePauseEvent);
      video.addEventListener('canplay', handleCanPlay);

      // 3. Viewport IntersectionObserver
      let observer: IntersectionObserver | null = null;
      if (enableObserver && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting || entry.intersectionRatio > 0) {
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
      }

      // Initial autoplay trigger on mount / src change
      playSafe();

      // 4. Tab visibility awareness: pause when tab hidden, resume when tab active
      const handleVisibilityChange = () => {
        if (document.hidden) {
          if (!video.paused) video.pause();
        } else {
          const rect = video.getBoundingClientRect();
          const inView = rect.top < window.innerHeight && rect.bottom > 0;
          if (inView) {
            playSafe();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('playing', handlePlayingEvent);
        video.removeEventListener('pause', handlePauseEvent);
        video.removeEventListener('canplay', handleCanPlay);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (observer) {
          observer.disconnect();
        }
      };
    }, [src, isInternalMuted, autoPlay, enableObserver, observerThreshold, onEndedCallback, playSafe, applyMutedState]);

    const soundPositions: Record<string, string> = {
      'top-left': 'top-2.5 left-2.5',
      'top-right': 'top-2.5 right-2.5',
      'bottom-left': 'bottom-2.5 left-2.5',
      'bottom-right': 'bottom-2.5 right-2.5'
    };
    const soundPosClass = soundPositions[soundTogglePosition] || 'bottom-2.5 right-2.5';

    // Direct click handler on the container to resume if autoplay was blocked by policy
    const handleContainerClick = () => {
      if (isAutoplayBlocked && videoRef.current) {
        applyMutedState(videoRef.current, true);
        videoRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          })
          .catch(() => {});
      }
    };

    return (
      <div
        className="relative w-full h-full"
        onClick={isAutoplayBlocked ? handleContainerClick : undefined}
      >
        <video
          ref={(node) => {
            videoRef.current = node;
            if (node) {
              applyMutedState(node, isInternalMuted);
              node.playsInline = true;
              node.setAttribute('playsinline', '');
              node.setAttribute('webkit-playsinline', '');
            }
          }}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          loop={true}
          muted={isInternalMuted}
          playsInline={true}
          disablePictureInPicture={true}
          controlsList="nodownload nofullscreen noremoteplayback"
          preload="metadata"
          controls={controls}
          title={title}
          className={className}
          style={style}
          onError={onError}
          onCanPlay={() => {
            if (autoPlay && videoRef.current?.paused) {
              playSafe();
            }
          }}
          onLoadedData={() => {
            if (autoPlay && videoRef.current?.paused) {
              playSafe();
            }
          }}
          onEnded={(e) => {
            e.currentTarget.currentTime = 0;
            const p = e.currentTarget.play();
            if (p !== undefined) p.catch(() => {});
            if (onEndedCallback) onEndedCallback();
          }}
          {...restProps}
        />

        {/* Subtle Play Overlay when Autoplay was blocked by browser before user interaction */}
        {isAutoplayBlocked && !controls && showPlayButtonFallback && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleContainerClick();
            }}
            className="absolute inset-0 m-auto z-20 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-[#DFB982] border border-[#DFB982]/50 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            title="Click to play video"
            aria-label="Play video"
          >
            <Play className="w-5 h-5 fill-[#DFB982] ml-0.5" />
          </button>
        )}

        {/* Optional User-controlled Sound Toggle Button */}
        {showSoundToggle && (
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
        )}
      </div>
    );
  }
);

SeamlessLoopVideo.displayName = 'SeamlessLoopVideo';
