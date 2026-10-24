import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Eye,
  Check,
  Star
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, ProductVariation } from '../types';
import { useCart } from '../context/CartContext';

import { isGenuineVideoUrl, isGenuineImageUrl, INITIAL_PRODUCTS } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';

import { SeamlessLoopVideo, SeamlessLoopVideoHandle } from './SeamlessLoopVideo';

interface VideoReelItem {
  id: string;
  title: string;
  category: string;
  price: number;
  mrp: number;
  discount: number;
  videoUrl: string;
  posterImage: string;
  duration: string;
  features: string;
  productId?: string;
}

interface ShopByVideoSectionProps {
  products: Product[];
  onSelectProduct: (product: Product, variation?: ProductVariation) => void;
}

interface AutoplayingReelVideoProps {
  videoUrl: string;
  posterImage?: string;
  title: string;
}

const AutoplayingReelVideo: React.FC<AutoplayingReelVideoProps> = ({
  videoUrl,
  posterImage,
  title
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-black select-none pointer-events-none">
        {posterImage && isGenuineImageUrl(posterImage) ? (
          <img
            src={posterImage}
            alt={title}
            className="w-full h-full object-cover select-none"
          />
        ) : (
          <div className="w-full h-full bg-[#181113] flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-[#DFB982]/50" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black select-none pointer-events-none">
      <SeamlessLoopVideo
        src={videoUrl}
        poster={posterImage && isGenuineImageUrl(posterImage) ? posterImage : undefined}
        title={title}
        isMuted={true}
        autoPlay={true}
        enableObserver={true}
        observerThreshold={0.05}
        showPlayButtonFallback={false}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover pointer-events-none select-none block"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none'
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

export const ShopByVideoSection: React.FC<ShopByVideoSectionProps> = ({
  products,
  onSelectProduct
}) => {
  const { addToCart, openCart } = useCart();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute video reels from database products with verified user-uploaded videos, combined with catalog videos
  const videoReels: VideoReelItem[] = useMemo(() => {
    const active = products
      .filter((p) => Boolean(p.videoUrl && isGenuineVideoUrl(p.videoUrl)))
      .map((p) => {
        const genuinePoster = (p.images || []).find(isGenuineImageUrl) || '';
        return {
          id: `reel-${p.id}`,
          title: p.name,
          category: p.categoryName || 'Fine Jewellery',
          price: p.price,
          mrp: p.mrp,
          discount: p.discountPercent,
          videoUrl: p.videoUrl!,
          posterImage: genuinePoster,
          duration: '0:15',
          features: p.shortDescription || p.description?.slice(0, 70) || `₹${p.price.toLocaleString('en-IN')}`,
          productId: p.id
        };
      });

    // Merge active with any initial products having videos so full video catalog is always rich, without duplicates
    const seenIds = new Set(active.map((r) => r.productId));
    const catalogReels: VideoReelItem[] = INITIAL_PRODUCTS
      .filter((p) => Boolean(p.videoUrl && isGenuineVideoUrl(p.videoUrl) && !seenIds.has(p.id)))
      .map((p) => {
        const genuinePoster = (p.images || []).find(isGenuineImageUrl) || '';
        return {
          id: `reel-${p.id}`,
          title: p.name,
          category: p.categoryName || 'Fine Jewellery',
          price: p.price,
          mrp: p.mrp,
          discount: p.discountPercent,
          videoUrl: p.videoUrl!,
          posterImage: genuinePoster,
          duration: '0:15',
          features: p.shortDescription || p.description?.slice(0, 70) || `₹${p.price.toLocaleString('en-IN')}`,
          productId: p.id
        };
      });

    return [...active, ...catalogReels];
  }, [products]);

  // Active Lightbox State
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [videoHasError, setVideoHasError] = useState<boolean>(false);
  const [addedReelId, setAddedReelId] = useState<string | null>(null);

  const lightboxLoopHandleRef = useRef<SeamlessLoopVideoHandle | null>(null);

  // Reset video error on reel change
  useEffect(() => {
    setVideoHasError(false);
    setIsPlaying(true);
  }, [activeReelIndex]);

  // Scroll Left / Right on Desktop
  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeReelIndex === null || videoReels.length === 0) return;
      if (e.key === 'Escape') setActiveReelIndex(null);
      if (e.key === 'ArrowRight') handleNextReel();
      if (e.key === 'ArrowLeft') handlePrevReel();
      if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReelIndex, isPlaying, videoReels.length]);

  const handleNextReel = () => {
    if (activeReelIndex === null || videoReels.length === 0) return;
    setActiveReelIndex((prev) => (prev! + 1) % videoReels.length);
    setIsPlaying(true);
  };

  const handlePrevReel = () => {
    if (activeReelIndex === null || videoReels.length === 0) return;
    setActiveReelIndex((prev) => (prev! - 1 + videoReels.length) % videoReels.length);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!videoHasError && lightboxLoopHandleRef.current) {
      if (isPlaying) {
        lightboxLoopHandleRef.current.pause();
        setIsPlaying(false);
      } else {
        lightboxLoopHandleRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const toggleMute = () => {
    if (lightboxLoopHandleRef.current) {
      const nextMuted = lightboxLoopHandleRef.current.toggleMute();
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  const findMatchingProduct = (reel: VideoReelItem): Product => {
    if (reel.productId) {
      const match = products.find((p) => p.id === reel.productId);
      if (match) return match;
    }
    const cleanReelId = reel.id.replace(/^reel-/, '');
    const matchByCleanId = products.find((p) => p.id === cleanReelId);
    if (matchByCleanId) return matchByCleanId;

    return products[0];
  };

  const handleShopNow = (reel: VideoReelItem) => {
    const prod = findMatchingProduct(reel);
    setActiveReelIndex(null);
    onSelectProduct(prod);
  };

  const handleAddToCart = (reel: VideoReelItem) => {
    const prod = findMatchingProduct(reel);
    const variation = prod.variations[0] || {
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

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });

    setTimeout(() => setAddedReelId(null), 2500);
    openCart();
  };

  if (videoReels.length === 0) {
    return (
      <section id="shopping-video" className="relative overflow-hidden py-14 bg-[#FAF7F2] border-y border-[#E8DCCF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#E8DCCF]/60 text-[#802336] text-[11px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-[#DFB982]/40">
            <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
            <span>Studio Video Demonstrations</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
            Craftsmanship in Motion
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
            High-definition 360° video showcases and reel demonstrations will appear here once videos are uploaded. Connect directly with our jewellery styling team on WhatsApp for live video presentations of any piece.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/917302187770?text=Hello%20VIDHYAA%20Jewellery%2C%20I%20would%20like%20to%20request%20a%20live%20video%20showcase%20of%20your%20jewellery."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#0F5C4D] hover:bg-[#0A4338] text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <span>Request Live Video on WhatsApp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>
    );
  }

  const currentReel = activeReelIndex !== null ? videoReels[activeReelIndex] : null;

  return (
    <section id="shopping-video" className="relative overflow-hidden py-16 sm:py-20 bg-[#FAF7F2] border-y border-[#E8DCCF]">
      {/* Delicate Champagne-Gold Ambient Shimmer Background */}
      <div className="absolute inset-0 bg-radial from-white/80 via-[#FAF7F2]/95 to-[#FAF7F2] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#DFB982]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#FAF7F2] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
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

          {/* Desktop Left / Right Navigation Buttons */}
          <div className="hidden sm:flex items-center justify-center gap-2.5">
            <button
              onClick={() => handleScroll('left')}
              className="w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer"
              title="Previous videos"
              aria-label="Previous videos"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => handleScroll('right')}
              className="w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer"
              title="Next videos"
              aria-label="Next videos"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Cards Showcase Slider */}
        <div
          ref={scrollContainerRef}
          className="flex gap-5 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {videoReels.map((reel) => (
            <div
              key={reel.id}
              className="group relative flex-none w-[78vw] xs:w-[65vw] sm:w-[280px] lg:w-[285px] snap-center bg-white rounded-3xl overflow-hidden border border-[#E8DCCF] hover:border-[#DFB982] shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col"
              onClick={() => handleShopNow(reel)}
            >
              {/* 9:16 Portrait Continuous Autoplaying Background Video Container */}
              <div className="relative aspect-[9/16] w-full overflow-hidden bg-black select-none">
                {/* Autoplaying continuous looping background video (muted, no controls, object-fit: cover) */}
                <AutoplayingReelVideo
                  videoUrl={reel.videoUrl}
                  posterImage={reel.posterImage}
                  title={reel.title}
                />

                {/* Subtle luxury gradient overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#241C1A]/90 via-black/20 to-black/30 pointer-events-none" />

                {/* Top Tags Bar */}
                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10 pointer-events-none">
                  <span className="bg-white/90 backdrop-blur-md text-[#802336] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs border border-[#E8DCCF]">
                    {reel.category}
                  </span>

                  <span className="bg-black/50 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    <span>{reel.duration}</span>
                  </span>
                </div>

                {/* Overlay Text inside 9:16 Frame */}
                <div className="absolute bottom-0 inset-x-0 p-4 text-white space-y-1.5 z-10 pointer-events-none">
                  <span className="text-[10px] text-[#DFB982] font-semibold tracking-wider uppercase block">
                    {reel.features}
                  </span>

                  <h3 className="font-serif text-base font-bold text-white line-clamp-1 group-hover:text-[#DFB982] transition-colors">
                    {reel.title}
                  </h3>

                  <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
                    <span className="text-base font-bold text-white">
                      {formatPrice(reel.price)}
                    </span>
                    {reel.mrp > reel.price && (
                      <>
                        <span className="text-xs text-gray-300 line-through">
                          {formatPrice(reel.mrp)}
                        </span>
                        <span className="text-[10px] bg-[#802336] text-white px-1.5 py-0.5 rounded font-bold">
                          {calculateDiscountPercent(reel.mrp, reel.price)}% OFF
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Card Footer Actions */}
              <div className="p-3.5 bg-white border-t border-[#E8DCCF] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShopNow(reel);
                  }}
                  className="flex-1 btn-teak-green py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>SHOP NOW</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(reel);
                  }}
                  className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#0F5B46] text-[#0F5B46] hover:text-white border border-[#0F5B46]/30 transition-colors cursor-pointer"
                  title="Quick Add to Bag"
                  aria-label="Quick Add to Bag"
                >
                  <ShoppingBag className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Swipe Hint */}
        <div className="sm:hidden text-center text-[11px] text-[#802336] font-semibold flex items-center justify-center gap-1.5">
          <span>← Swipe to explore more jewellery reels →</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* INTERACTIVE VIDEO LIGHTBOX MODAL */}
      {/* ======================================================== */}
      {currentReel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setActiveReelIndex(null)}
        >
          {/* Lightbox Container */}
          <div
            className="relative w-full max-w-4xl bg-[#FAF7F2] rounded-3xl overflow-hidden shadow-2xl border border-[#DFB982]/50 flex flex-col md:flex-row max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveReelIndex(null)}
              className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close video viewer (Esc)"
              aria-label="Close video viewer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* LEFT / CENTER: 9:16 Continuous Autoplaying Background Video Area */}
            <div className="relative md:w-3/5 bg-black flex items-center justify-center overflow-hidden select-none">
              {!videoHasError ? (
                <div
                  className="relative w-full h-full max-h-[550px] md:max-h-[640px] flex items-center justify-center cursor-pointer"
                  onClick={togglePlayPause}
                >
                  <SeamlessLoopVideo
                    ref={lightboxLoopHandleRef}
                    key={currentReel.id}
                    src={currentReel.videoUrl}
                    poster={currentReel.posterImage && isGenuineImageUrl(currentReel.posterImage) ? currentReel.posterImage : undefined}
                    title={currentReel.title}
                    autoPlay={true}
                    isMuted={isMuted}
                    enableObserver={false}
                    onError={() => setVideoHasError(true)}
                    className="w-full h-full max-h-[550px] md:max-h-[640px] object-contain pointer-events-none select-none"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                  />

                  {/* Play / Pause indicator overlay if user pauses */}
                  {!isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/20 text-[#DFB982]">
                        <Play className="w-8 h-8 fill-[#DFB982] ml-1" />
                      </div>
                    </div>
                  )}

                  {/* Audio Toggle Button in Video Player */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                    title={isMuted ? 'Click to Unmute' : 'Click to Mute'}
                    aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-red-300" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                </div>
              ) : (
                <div
                  className="relative w-full h-full max-h-[550px] md:max-h-[640px] flex items-center justify-center overflow-hidden bg-[#1C1615] select-none pointer-events-none"
                >
                  {currentReel.posterImage && isGenuineImageUrl(currentReel.posterImage) ? (
                    <img
                      src={currentReel.posterImage}
                      alt={currentReel.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1C1615] flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-[#DFB982]/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                </div>
              )}

              {/* Reel Counter Tag (subtle, non-interfering) */}
              <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/20 text-[#DFB982]">
                  {activeReelIndex! + 1} / {videoReels.length}
                </div>
              </div>

              {/* Prev / Next Video Arrow Triggers */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevReel();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20"
                title="Previous jewellery reel"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextReel();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20"
                title="Next jewellery reel"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* RIGHT: Product Details & Instant Purchase Drawer */}
            <div className="md:w-2/5 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-white overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="bg-[#DFB982]/20 text-[#802336] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {currentReel.category}
                  </span>
                  <div className="flex items-center gap-1 text-[#B8860B] text-xs font-semibold">
                    <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                    <span>4.9 / 5.0 Rating</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#241C1A]">
                    {currentReel.title}
                  </h3>
                  <p className="text-xs text-[#5C4D4A] mt-1.5 leading-relaxed">
                    {currentReel.features}
                  </p>
                </div>

                <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF] space-y-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-serif font-bold text-[#802336]">
                      {formatPrice(currentReel.price)}
                    </span>
                    {currentReel.mrp > currentReel.price && (
                      <>
                        <span className="text-sm text-gray-400 line-through">
                          {formatPrice(currentReel.mrp)}
                        </span>
                        <span className="text-xs bg-[#D4AF37] text-[#3B1E22] font-bold px-2 py-0.5 rounded shadow-xs uppercase tracking-wider">
                          {calculateDiscountPercent(currentReel.mrp, currentReel.price)}% OFF
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

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-4 border-t border-[#E8DCCF]">
                <button
                  onClick={() => handleShopNow(currentReel)}
                  className="w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span>SHOP NOW</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>

                <button
                  onClick={() => handleAddToCart(currentReel)}
                  className="w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {addedReelId === currentReel.id ? (
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
