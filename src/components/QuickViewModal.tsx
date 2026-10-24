import React, { useState, useEffect } from 'react';
import { X, Heart, Star, ShoppingBag, ShieldCheck, Truck, RefreshCw, Check, Play } from 'lucide-react';
import { Product, ProductVariation } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { isGenuineProduct, isGenuineImageUrl, isGenuineVideoUrl } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';
import { SeamlessLoopVideo } from './SeamlessLoopVideo';
import { JEWELLERY_PLACEHOLDER_IMAGE } from '../lib/storageService';

interface QuickViewModalProps {
  product: Product | null;
  initialVariation?: ProductVariation;
  onClose: () => void;
  onViewFullProduct: (product: Product) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  initialVariation,
  onClose,
  onViewFullProduct
}) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(
    initialVariation || (product?.variations?.[0])
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (initialVariation) {
      setSelectedVariation(initialVariation);
    } else if (product?.variations?.[0]) {
      setSelectedVariation(product.variations[0]);
    }
    setActiveImageIndex(0);
    setQuantity(1);
    setImageError(false);
    setShowVideo(false);
  }, [product, initialVariation]);

  if (!product || !isGenuineProduct(product)) return null;

  const hasVideo = Boolean(product.videoUrl && isGenuineVideoUrl(product.videoUrl));

  // When variation is selected, the primary image switches to that variation's image!
  const variationImage = selectedVariation?.image;
  const rawList = variationImage
    ? [variationImage, ...product.images.filter((img) => img !== variationImage)]
    : product.images;
  const validList = rawList.filter((img) => img && isGenuineImageUrl(img));
  const currentImages = validList.length > 0 ? validList : [JEWELLERY_PLACEHOLDER_IMAGE];
  const activeImage = currentImages[activeImageIndex] || currentImages[0];

  const currentPrice = product.price;
  const currentMrp = product.mrp > 0 ? product.mrp : product.price;
  const discountPercent = calculateDiscountPercent(currentMrp, currentPrice);
  const hasDiscount = currentMrp > currentPrice && discountPercent > 0;

  const handleAddToCart = () => {
    const variationToUse = selectedVariation || {
      id: 'default',
      name: 'Standard',
      colorFinish: 'Default',
      hexCode: '#D4AF37',
      sku: product.id,
      stock: product.stock,
      image: product.images[0],
      active: true
    };
    addToCart(product, variationToUse, quantity);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-[#E8DCCF] relative max-h-[90vh] flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 hover:bg-white text-gray-700 hover:text-black shadow-md transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gallery Column */}
        <div className="md:w-1/2 p-6 bg-[#FAF7F2] flex flex-col justify-between">
          <div className="relative aspect-square rounded-xl overflow-hidden bg-white border border-[#E8DCCF] flex items-center justify-center p-3">
            {showVideo && hasVideo ? (
              <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden rounded-lg">
                <SeamlessLoopVideo
                  src={product.videoUrl!}
                  poster={activeImage}
                  title={product.name}
                  autoPlay={true}
                  isMuted={true}
                  enableObserver={false}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-[#DFB982] text-black text-[9px] font-bold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                  360° Video Reel
                </div>
              </div>
            ) : imageError || !activeImage || !isGenuineImageUrl(activeImage) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-[#FAF7F2] text-gray-400">
                <span className="text-xs font-serif font-bold text-[#241C1A]">Product image coming soon</span>
                <span className="text-[10px] text-gray-500 mt-0.5">VIDHYAA Fine Jewellery</span>
              </div>
            ) : (
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-contain object-center transition-transform hover:scale-105 duration-300"
                onError={() => setImageError(true)}
              />
            )}
            {discountPercent > 0 && (
              <span className="absolute top-3 left-3 bg-[#802336] text-white text-[11px] font-bold px-2 py-0.5 rounded shadow">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          {/* Thumbnails (Images + Video Reel Button) */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 items-center">
            {hasVideo && (
              <button
                onClick={() => setShowVideo(true)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 bg-gradient-to-br from-[#160E10] to-[#2B0E14] flex flex-col items-center justify-center flex-shrink-0 cursor-pointer p-1 transition-all ${
                  showVideo
                    ? 'border-[#DFB982] scale-105 ring-2 ring-[#DFB982]/40'
                    : 'border-[#E8DCCF] opacity-80 hover:opacity-100'
                }`}
                title="Watch 360° Video Reel"
              >
                <div className="w-6 h-6 rounded-full bg-[#DFB982] flex items-center justify-center mb-0.5 shadow">
                  <Play className="w-3 h-3 fill-black text-black ml-0.5" />
                </div>
                <span className="text-[8px] font-bold text-[#DFB982] tracking-wider uppercase">Video</span>
              </button>
            )}
            {currentImages.length > 1 &&
              currentImages.slice(0, 5).map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowVideo(false);
                    setActiveImageIndex(idx);
                  }}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 bg-white flex-shrink-0 cursor-pointer p-1 transition-all ${
                    !showVideo && activeImageIndex === idx
                      ? 'border-[#0F5B46] scale-105 ring-2 ring-[#0F5B46]/20'
                      : 'border-[#E8DCCF] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
          </div>
        </div>

        {/* Info Column */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between text-xs text-[#802336] font-semibold uppercase tracking-wider mb-1">
              <span>{product.categoryName} • {product.subcategory}</span>
              <div className="flex items-center gap-1 text-[#B8860B]">
                <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                <span>{product.rating}</span>
                <span className="text-gray-400">({product.reviewCount} reviews)</span>
              </div>
            </div>

            <h2 className="font-serif text-2xl font-bold text-[#241C1A] leading-tight mb-2">
              {product.name}
            </h2>

            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
              <span className="text-2xl font-bold text-[#3B1E22]">
                {formatPrice(currentPrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    {formatPrice(currentMrp)}
                  </span>
                  <span className="text-xs bg-[#D4AF37] text-[#3B1E22] font-bold px-2 py-0.5 rounded shadow-xs uppercase tracking-wider">
                    {discountPercent}% OFF
                  </span>
                </>
              )}
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                Inclusive of all taxes
              </span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              {product.shortDescription || product.description}
            </p>

            {/* COLOR/FINISH VARIATIONS SWITCHER */}
            {product.variations && product.variations.length > 0 && (
              <div className="mb-5 p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#3B1E22] uppercase tracking-wider">
                    Select Finish / Color:
                  </span>
                  <span className="text-xs font-bold text-[#802336]">
                    {selectedVariation?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {product.variations.map((v) => {
                    const isSelected = selectedVariation?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVariation(v);
                          setActiveImageIndex(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#802336] text-[#802336] shadow-sm font-semibold'
                            : 'bg-white/60 border-gray-200 text-gray-700 hover:bg-white'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-gray-300"
                          style={{ backgroundColor: v.hexCode }}
                        />
                        <span>{v.name}</span>
                        {v.price && v.price !== product.price && (
                          <span className="text-[10px] text-gray-500">
                            (₹{v.price.toLocaleString('en-IN')})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-2 italic">
                  * Note: Main preview automatically reflects selected {selectedVariation?.name} finish.
                </p>
              </div>
            )}

            {/* Quantity and Actions */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center border border-[#E8DCCF] rounded-lg bg-[#FAF7F2]">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-sm font-semibold text-[#3B1E22] hover:bg-[#F4EBE1] rounded-l-lg cursor-pointer"
                >
                  -
                </button>
                <span className="px-3 py-2 text-sm font-semibold text-[#3B1E22]">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-sm font-semibold text-[#3B1E22] hover:bg-[#F4EBE1] rounded-r-lg cursor-pointer"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={added}
                className="flex-1 btn-teak-green py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4 text-white" />
                    <span>Add to Bag</span>
                  </>
                )}
              </button>

              <button
                onClick={() => toggleWishlist(product.id)}
                className={`p-2.5 rounded-xl border border-[#E8DCCF] transition-colors cursor-pointer ${
                  isInWishlist(product.id) ? 'bg-[#3B2F2A] text-[#DFB982] border-[#3B2F2A]' : 'bg-[#FAF7F2] text-[#3B2F2A] hover:bg-[#3B2F2A] hover:text-[#FAF7F2]'
                }`}
                title="Wishlist"
              >
                <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-[#DFB982]' : ''}`} />
              </button>
            </div>

            {/* Quick Guarantees */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 pt-2 border-t border-[#F4EBE1]">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#B8860B]" />
                <span>Complimentary Express Shipping</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#B8860B]" />
                <span>Certified Quality Guarantee</span>
              </div>
            </div>
          </div>

          {/* View Full Product Link */}
          <div className="mt-4 pt-3 border-t border-[#F4EBE1] text-center">
            <button
              onClick={() => {
                onViewFullProduct(product);
                onClose();
              }}
              className="text-xs font-semibold text-[#802336] hover:underline cursor-pointer"
            >
              View Full Product Specifications, Reviews & Details →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
