import React, { useState, useEffect } from 'react';
import { Heart, Star, ShoppingBag, Eye, Check, Volume2, VolumeX, Play } from 'lucide-react';
import { Product, ProductVariation } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { isGenuineImageUrl, isGenuineProduct, isGenuineVideoUrl } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';
import { JEWELLERY_PLACEHOLDER_IMAGE } from '../lib/storageService';
import { SeamlessLoopVideo } from './SeamlessLoopVideo';

interface ProductCardProps {
  product: Product;
  onOpenQuickView: (product: Product, variation?: ProductVariation) => void;
  onSelectProduct: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenQuickView,
  onSelectProduct
}) => {
  const { addToCart, openCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  // If the product is not genuine or has no genuine image, hide it from the storefront
  if (!isGenuineProduct(product)) {
    return null;
  }

  // Selected variation state (defaults to first variation if present)
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(
    product.variations && product.variations.length > 0 ? product.variations[0] : undefined
  );

  const [addedToast, setAddedToast] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(true);
  const [showVideo, setShowVideo] = useState(true);

  // Synchronize variation when product changes
  useEffect(() => {
    if (product.variations && product.variations.length > 0) {
      setSelectedVariation(product.variations[0]);
    } else {
      setSelectedVariation(undefined);
    }
  }, [product.id]);

  // Active displayed image: prioritize non-empty variation image if valid, otherwise primary product image
  const primaryProductImage = (Array.isArray(product.images) ? product.images.find((img) => Boolean(img && img.trim())) : '')?.trim() || '';
  const variationImage = selectedVariation?.image?.trim();
  const displayImage = (variationImage && isGenuineImageUrl(variationImage)) ? variationImage : primaryProductImage;
  const secondaryImage = product.images?.[1]?.trim() || displayImage;

  // Reset image error status when the product or displayed image changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [product.id, displayImage]);

  const currentPrice = product.price;
  const currentMrp = product.mrp > 0 ? product.mrp : product.price;
  const discountPercent = calculateDiscountPercent(currentMrp, currentPrice);
  const hasDiscount = currentMrp > currentPrice && discountPercent > 0;

  // Video presence check with actual saved URL from database
  const hasVideo = Boolean(product.videoUrl && isGenuineVideoUrl(product.videoUrl) && !videoError);
  const isDisplayingVideo = hasVideo && showVideo;

  // Elegant luxury jewellery placeholder if image is missing or cannot be loaded (never homepage banner)
  const fallbackImage = JEWELLERY_PLACEHOLDER_IMAGE;
  const effectiveImage = (!imageError && displayImage) ? displayImage : fallbackImage;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const variationToUse = selectedVariation || {
      id: 'default',
      name: 'Standard',
      colorFinish: 'Default',
      hexCode: '#D4AF37',
      sku: product.id,
      stock: product.stock,
      image: product.images[0] || '',
      active: true
    };
    addToCart(product, variationToUse, 1);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 1500);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const variationToUse = selectedVariation || {
      id: 'default',
      name: 'Standard',
      colorFinish: 'Default',
      hexCode: '#D4AF37',
      sku: product.id,
      stock: product.stock,
      image: product.images[0] || '',
      active: true
    };
    addToCart(product, variationToUse, 1);
    openCart();
  };

  const handleVariationClick = (e: React.MouseEvent, variation: ProductVariation) => {
    e.stopPropagation();
    setSelectedVariation(variation);
    setImageError(false);
    // When customer chooses a specific color/finish variation, show that variation's photo
    if (variation.image && isGenuineImageUrl(variation.image)) {
      setShowVideo(false);
    }
  };

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="group bg-white rounded-xl overflow-hidden border border-[#E8DCCF]/70 hover:border-[#D4AF37]/60 hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Image / Video Container with Consistent 4:5 Aspect Ratio & Object-Contain */}
      <div className="relative aspect-[4/5] bg-white overflow-hidden flex items-center justify-center p-3 border-b border-[#F4EBE1]/60">
        {/* Loading placeholder skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-[#FAF7F2] animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#DFB982]/40 border-t-[#0F5B46] animate-spin" />
          </div>
        )}

        {isDisplayingVideo ? (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-white">
            <SeamlessLoopVideo
              src={product.videoUrl!}
              poster={effectiveImage}
              title={product.name}
              autoPlay={true}
              isMuted={isSoundMuted}
              enableObserver={true}
              observerThreshold={0.05}
              onError={() => {
                setVideoError(true);
                setImageLoaded(true);
              }}
              onLoadedData={() => setImageLoaded(true)}
              onCanPlay={() => setImageLoaded(true)}
              className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500 ease-out"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* User-controlled Sound Toggle Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSoundMuted((prev) => !prev);
              }}
              className="absolute top-12 right-3 z-20 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer shadow-md flex items-center justify-center active:scale-90"
              title={isSoundMuted ? 'Click to Unmute video' : 'Click to Mute video'}
              aria-label={isSoundMuted ? 'Unmute video audio' : 'Mute video audio'}
            >
              {isSoundMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-white/90" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          </div>
        ) : (
          <img
            src={effectiveImage}
            alt={product.name}
            className={`w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500 ease-out ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
          />
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10 pointer-events-none">
          {hasVideo && (
            <span className="bg-[#0F5C4D] text-[#FAF7F2] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>360° Reel</span>
            </span>
          )}
          {product.isBestseller && (
            <span className="bg-[#802336] text-[#FAF7F2] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm">
              Bestseller
            </span>
          )}
          {product.isNewArrival && (
            <span className="bg-[#3B1E22] text-[#DFB982] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm">
              New Arrival
            </span>
          )}
          {hasDiscount && (
            <span className="bg-[#D4AF37] text-[#3B1E22] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Video / Photo Switcher if user switched to variation image */}
        {hasVideo && !showVideo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowVideo(true);
            }}
            className="absolute top-12 left-3 z-10 bg-black/70 hover:bg-black text-[#DFB982] text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 shadow cursor-pointer transition-all"
            title="Resume 360° Video Demonstration"
          >
            <Play className="w-2.5 h-2.5 fill-[#DFB982]" />
            <span>Play Video</span>
          </button>
        )}

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white text-[#3B1E22] hover:text-[#802336] backdrop-blur-sm shadow-sm transition-transform active:scale-90 z-10 cursor-pointer"
          title={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-label="Wishlist toggle"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isInWishlist(product.id) ? 'fill-[#802336] text-[#802336]' : 'text-gray-600'
            }`}
          />
        </button>

        {/* Hover Quick View Trigger */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex gap-2 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenQuickView(product, selectedVariation);
            }}
            className="flex-1 bg-white/95 hover:bg-white text-[#3B1E22] py-2 px-3 rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 backdrop-blur-sm transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#802336]" />
            Quick View
          </button>
        </div>
      </div>

      {/* Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-[#802336]">
              {product.subcategory || product.categoryName}
            </span>
            <div className="flex items-center gap-1 text-[#B8860B] font-medium">
              <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
              <span>{product.rating}</span>
              <span className="text-gray-400 text-[10px]">({product.reviewCount})</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-serif text-base font-semibold text-[#241C1A] group-hover:text-[#802336] transition-colors line-clamp-1">
            {product.name}
          </h3>

          {/* Material note */}
          <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
            {product.material}
          </p>

          {/* Color Variation Swatches */}
          {product.variations && product.variations.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-1">
                Finish:
              </span>
              {product.variations.map((v) => {
                const isSelected = selectedVariation?.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={(e) => handleVariationClick(e, v)}
                    className={`w-4 h-4 rounded-full border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'ring-2 ring-[#3B2F2A] ring-offset-1 scale-110 border-white shadow-xs'
                        : 'border-gray-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: v.hexCode }}
                    title={`${v.name} (${v.colorFinish})`}
                  />
                );
              })}
              {selectedVariation && (
                <span className="text-[10px] font-medium text-[#3B2F2A] ml-1">
                  {selectedVariation.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price, Stock & Add to Cart */}
        <div className="mt-3 pt-3 border-t border-[#F4EBE1] space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base font-bold text-[#241C1A]">
                {formatPrice(currentPrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xs text-gray-400 line-through">
                    {formatPrice(currentMrp)}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded leading-none">
                    {discountPercent}% OFF
                  </span>
                </>
              )}
            </div>

            {/* Stock Availability Badge */}
            {(() => {
              const currentStock = selectedVariation ? selectedVariation.stock : product.stock;
              if (currentStock <= 0) {
                return (
                  <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                    Out of Stock
                  </span>
                );
              }
              if (currentStock <= 3) {
                return (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Only {currentStock} Left
                  </span>
                );
              }
              return (
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  In Stock ({currentStock})
                </span>
              );
            })()}
          </div>

          {/* Action Buttons: Add to Cart and Buy Now in Teak Green (#0F5B46) */}
          {(() => {
            const currentStock = selectedVariation ? selectedVariation.stock : product.stock;
            const isOutOfStock = currentStock <= 0;

            return (
              <div className="flex gap-2">
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${
                    isOutOfStock
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200'
                      : addedToast
                      ? 'bg-[#083A2D] text-white ring-2 ring-[#0F5B46]'
                      : 'btn-teak-green'
                  }`}
                >
                  {isOutOfStock ? (
                    <span>Out of Stock</span>
                  ) : addedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Added!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5 text-white" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>

                {!isOutOfStock && (
                  <button
                    onClick={handleBuyNow}
                    className="btn-teak-green py-2.5 px-3.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap shadow-sm hover:shadow-md active:scale-98"
                  >
                    Buy Now
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
