import React, { useState, useEffect } from 'react';
import {
  Heart,
  Star,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Share2,
  Check,
  Clock,
  ArrowRight,
  Eye,
  Info,
  Play,
  X,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Product, ProductVariation, Review } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { fetchProductReviews, addReview } from '../lib/dbService';
import { ProductCard } from '../components/ProductCard';
import { MetadataManager } from '../components/MetadataManager';
import { isGenuineProduct, isGenuineImageUrl, isGenuineVideoUrl } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';
import { SeamlessLoopVideo } from '../components/SeamlessLoopVideo';
import { JEWELLERY_PLACEHOLDER_IMAGE } from '../lib/storageService';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  initialVariation?: ProductVariation;
  onSelectProduct: (product: Product) => void;
  onOpenQuickView: (product: Product, variation?: ProductVariation) => void;
  onBuyNowDirect: () => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  allProducts,
  initialVariation,
  onSelectProduct,
  onOpenQuickView,
  onBuyNowDirect
}) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();

  if (!product || !isGenuineProduct(product)) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4 text-center">
        <h2 className="font-serif text-3xl font-bold text-[#241C1A]">Product Unavailable</h2>
        <p className="text-gray-600 mt-3 text-sm">
          This piece is currently being updated with verified studio imagery.
        </p>
        <button
          onClick={() => window.location.assign('/#shop')}
          className="mt-6 bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md"
        >
          Explore Verified Catalog
        </button>
      </div>
    );
  }

  // Active variation state (swaps main image and sku/price)
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(
    initialVariation || (product.variations && product.variations.length > 0 ? product.variations[0] : undefined)
  );

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'care' | 'reviews'>('description');
  const [pincodeInput, setPincodeInput] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState<string | null>(null);
  const [addedToast, setAddedToast] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewerName, setReviewerName] = useState(user?.displayName || '');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [activeMedia, setActiveMedia] = useState<'image' | 'video'>('image');

  useEffect(() => {
    if (initialVariation) {
      setSelectedVariation(initialVariation);
    } else if (product.variations && product.variations.length > 0) {
      setSelectedVariation(product.variations[0]);
    }
    setActiveImageIndex(0);
    setImageError(false);
    setActiveMedia('image');
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load reviews
    fetchProductReviews(product.id).then(setReviews);
  }, [product, initialVariation]);

  // When variation changes, prioritize variation image as index 0!
  const variationImage = selectedVariation?.image;
  const rawGallery = variationImage
    ? [variationImage, ...product.images.filter((img) => img !== variationImage)]
    : product.images;
  const validGallery = rawGallery.filter((img) => img && isGenuineImageUrl(img));
  const galleryImages = validGallery.length > 0 ? validGallery : [JEWELLERY_PLACEHOLDER_IMAGE];

  const currentDisplayImage = galleryImages[activeImageIndex] || galleryImages[0];
  const hasGenuineVideo = Boolean(product.videoUrl && isGenuineVideoUrl(product.videoUrl));
  const videoData = hasGenuineVideo
    ? {
        videoUrl: product.videoUrl!,
        title: product.name,
        duration: '0:15',
        poster: currentDisplayImage,
        description: product.description
      }
    : null;

  const currentPrice = product.price;
  const currentMrp = product.mrp > 0 ? product.mrp : product.price;
  const currentStock = selectedVariation?.stock !== undefined ? selectedVariation.stock : product.stock;
  const currentSku = selectedVariation?.sku || product.id;
  const discountPercent = calculateDiscountPercent(currentMrp, currentPrice);
  const hasDiscount = currentMrp > currentPrice && discountPercent > 0;

  const handleVariationChange = (v: ProductVariation) => {
    setSelectedVariation(v);
    setActiveImageIndex(0); // Immediately displays that variation's photo!
    setActiveMedia('image');
  };

  const handleAddToCart = () => {
    const varToUse = selectedVariation || {
      id: 'default',
      name: 'Standard',
      colorFinish: 'Default',
      hexCode: '#D4AF37',
      sku: product.id,
      stock: product.stock,
      image: product.images[0],
      active: true
    };
    addToCart(product, varToUse, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    onBuyNowDirect();
  };

  const checkPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincodeInput.trim().length === 6 && /^\d+$/.test(pincodeInput)) {
      setPincodeStatus('Available! Standard express delivery within 3-4 business days.');
    } else {
      setPincodeStatus('Please enter a valid 6-digit Indian pincode.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      const newRev = await addReview({
        productId: product.id,
        userId: user?.uid || 'guest-patron',
        userName: reviewerName.trim() || 'Valued Patron',
        rating: reviewRating,
        comment: reviewComment.trim(),
        verifiedPurchase: true,
        createdAt: new Date().toISOString()
      });
      setReviews([newRev, ...reviews]);
      setReviewComment('');
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 4000);
    } catch (err) {
      console.error('Error adding review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const relatedProducts = allProducts
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-14">
      {/* Dynamic SEO Meta & Open Graph via react-helmet-async */}
      <MetadataManager
        title={`${product.name} | ${product.categoryName}`}
        description={`Buy ${product.name} handcrafted in ${product.material}. Available at ₹${currentPrice.toLocaleString('en-IN')} with insured express delivery at VIDHYAA Jewellery Studio.`}
        image={currentDisplayImage}
        type="product"
        categoryName={product.categoryName}
        product={{
          name: product.name,
          sku: currentSku,
          price: currentPrice,
          mrp: currentMrp,
          currency: 'INR',
          inStock: currentStock > 0,
          image: currentDisplayImage,
          category: product.categoryName,
          material: product.material,
          rating: product.rating,
          reviewCount: product.reviewCount
        }}
      />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 flex items-center gap-1.5">
        <span>Home</span>
        <span>/</span>
        <span className="text-[#802336] font-medium">{product.categoryName}</span>
        <span>/</span>
        <span className="text-gray-400 truncate max-w-xs">{product.name}</span>
      </div>

      {/* Main Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        {/* Left Column: Image Gallery & Swatches */}
        <div className="space-y-4 lg:sticky lg:top-28">
          {/* Main Large Media Container with Consistent 4:5 Aspect Ratio & Object-Contain */}
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white border border-[#E8DCCF] shadow-md group flex items-center justify-center p-4">
            {activeMedia === 'video' && videoData ? (
              <div className="relative w-full h-full flex items-center justify-center bg-white overflow-hidden">
                <SeamlessLoopVideo
                  src={videoData.videoUrl}
                  poster={currentDisplayImage}
                  title={videoData.title}
                  autoPlay={true}
                  isMuted={videoMuted}
                  enableObserver={true}
                  observerThreshold={0.05}
                  onError={() => {
                    setImageError(true);
                    setActiveMedia('image');
                  }}
                  className="w-full h-full object-contain object-center"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Sound Toggle Button */}
                <button
                  type="button"
                  onClick={() => setVideoMuted(!videoMuted)}
                  className="absolute bottom-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer shadow-md flex items-center justify-center active:scale-90"
                  title={videoMuted ? 'Click to Unmute video' : 'Click to Mute video'}
                  aria-label={videoMuted ? 'Unmute video audio' : 'Mute video audio'}
                >
                  {videoMuted ? (
                    <VolumeX className="w-4 h-4 text-white/90" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                </button>

                {/* 360 Reel Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none z-10">
                  <span className="bg-[#0F5C4D] text-[#FAF7F2] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded shadow flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    <span>360° Studio Showcase</span>
                  </span>
                </div>
              </div>
            ) : imageError || !currentDisplayImage || !isGenuineImageUrl(currentDisplayImage) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-[#FAF7F2] text-gray-400 select-none">
                <div className="w-14 h-14 rounded-full bg-[#DFB982]/15 border border-[#DFB982]/30 flex items-center justify-center text-[#802336] mb-3">
                  <Sparkles className="w-6 h-6 text-[#802336]/80" />
                </div>
                <span className="text-sm font-medium text-gray-500">Handcrafted Jewellery Piece</span>
              </div>
            ) : (
              <img
                src={currentDisplayImage}
                alt={product.name}
                className="w-full h-full object-contain object-center transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            )}

            {/* Discount Badge */}
            {discountPercent > 0 && activeMedia !== 'video' && (
              <span className="absolute top-4 left-4 bg-[#802336] text-white text-xs font-bold px-2.5 py-1 rounded shadow-md uppercase tracking-wider">
                {discountPercent}% OFF
              </span>
            )}

            {/* Selected Finish Indicator */}
            {selectedVariation && (
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#E8DCCF] flex items-center gap-2 text-xs font-semibold text-[#3B1E22] shadow">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-gray-300"
                  style={{ backgroundColor: selectedVariation.hexCode }}
                />
                <span>Viewing: {selectedVariation.name}</span>
              </div>
            )}
          </div>

          {/* Thumbnails Row (Photos + 360° Video Button) */}
          <div className="flex gap-3 overflow-x-auto pb-2 items-center">
            {hasGenuineVideo && (
              <button
                type="button"
                onClick={() => setActiveMedia('video')}
                className={`w-20 h-20 rounded-xl overflow-hidden border-2 bg-gradient-to-b from-[#181113] to-[#2B0E14] p-1 flex flex-col items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                  activeMedia === 'video'
                    ? 'border-[#0F5B46] ring-2 ring-[#0F5B46]/30 scale-105'
                    : 'border-[#E8DCCF] opacity-80 hover:opacity-100 hover:border-[#DFB982]'
                }`}
                title="Watch 360° Studio Video Reel"
              >
                <div className="w-7 h-7 rounded-full bg-[#DFB982] flex items-center justify-center shadow mb-1">
                  <Play className="w-3.5 h-3.5 fill-black text-black ml-0.5" />
                </div>
                <span className="text-[9px] font-bold text-[#DFB982] tracking-wider uppercase">360° Video</span>
              </button>
            )}

            {galleryImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveMedia('image');
                  setActiveImageIndex(idx);
                }}
                className={`w-20 h-20 rounded-xl overflow-hidden border-2 bg-white p-1 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                  activeMedia === 'image' && activeImageIndex === idx
                    ? 'border-[#0F5B46] ring-2 ring-[#0F5B46]/30 scale-105'
                    : 'border-[#E8DCCF] opacity-70 hover:opacity-100 hover:border-gray-400'
                }`}
              >
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>

          {videoData && (
            <div className="mt-4 rounded-2xl overflow-hidden border border-[#DFB982]/60 bg-[#160E10] shadow-lg">
              <div
                className="relative aspect-[16/9] sm:aspect-[4/3] w-full bg-black overflow-hidden group"
              >
                <SeamlessLoopVideo
                  src={videoData.videoUrl}
                  poster={videoData.poster}
                  title={videoData.title}
                  autoPlay={true}
                  isMuted={videoMuted}
                  enableObserver={true}
                  observerThreshold={0.05}
                  className="w-full h-full object-contain"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                {/* Badges & Live Loop Indicator */}
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
                  <span className="bg-[#DFB982] text-black text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                    360° Studio Reel
                  </span>
                  <span className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-[#DFB982] text-[10px] px-2 py-0.5 rounded-full border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Continuous Loop
                  </span>
                </div>

                {/* Sound Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoMuted(!videoMuted);
                  }}
                  className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer shadow-md flex items-center justify-center active:scale-90"
                  title={videoMuted ? 'Click to Unmute' : 'Click to Mute'}
                  aria-label={videoMuted ? 'Unmute video audio' : 'Mute video audio'}
                >
                  {videoMuted ? (
                    <VolumeX className="w-4 h-4 text-white/90" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                </button>

                {/* Center Hover Trigger */}
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  className="absolute inset-0 flex items-center justify-center cursor-pointer group-hover:bg-black/20 transition-colors"
                  title="Expand to Full Screen Cinema View"
                >
                  <div className="w-12 h-12 rounded-full bg-black/50 group-hover:bg-black/80 border border-white/20 text-white flex items-center justify-center transition-all group-hover:scale-110 shadow-lg">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </button>

                {/* Bottom Bar */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-white text-xs pointer-events-none">
                  <span className="text-[11px] font-medium text-gray-200 drop-shadow">
                    Click to Open Full Screen Cinema View
                  </span>
                  <span className="bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-[#DFB982]">
                    HD 1080p
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Product Purchasing & Variations */}
        <div className="space-y-6">
          {/* Header Info */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="uppercase tracking-widest font-semibold text-[#802336]">
                {product.categoryName} • {product.subcategory}
              </span>
              <div className="flex items-center gap-1 text-[#B8860B] font-semibold">
                <Star className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />
                <span>{product.rating}</span>
                <span className="text-gray-400 font-normal">
                  ({product.reviewCount} customer reviews)
                </span>
              </div>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A] leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span>SKU: <strong className="text-gray-700">{currentSku}</strong></span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {currentStock > 0 ? `In Stock (${currentStock} left)` : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Pricing */}
          <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF] flex items-baseline justify-between flex-wrap gap-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-serif text-3xl font-bold text-[#3B1E22]">
                {formatPrice(currentPrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-gray-400 line-through">
                    {formatPrice(currentMrp)}
                  </span>
                  <span className="text-xs bg-[#D4AF37] text-[#3B1E22] font-bold px-2.5 py-1 rounded shadow-xs uppercase tracking-wider">
                    {discountPercent}% OFF
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                    Save {formatPrice(currentMrp - currentPrice)}
                  </span>
                </>
              )}
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              Tax included • Insured Express Dispatch
            </span>
          </div>

          {/* CRITICAL: COLOR / FINISH VARIATIONS PICKER */}
          {product.variations && product.variations.length > 0 && (
            <div className="space-y-3 p-4 bg-white rounded-2xl border border-[#E8DCCF] shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#3B1E22] uppercase tracking-wider">
                  Select Color / Polish Finish:
                </label>
                <span className="text-xs font-bold text-[#802336]">
                  {selectedVariation?.name}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {product.variations.map((v) => {
                  const isSelected = selectedVariation?.id === v.id;
                  const vPrice = v.price !== undefined ? v.price : product.price;

                  return (
                    <button
                      key={v.id}
                      onClick={() => handleVariationChange(v)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#802336] bg-[#FAF7F2] ring-2 ring-[#802336]/20 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                          style={{ backgroundColor: v.hexCode }}
                        />
                        <span className="text-xs font-bold text-[#241C1A] truncate">
                          {v.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-gray-800">{formatPrice(vPrice)}</span>
                          {v.mrp && v.mrp > vPrice && (
                            <span className="text-[10px] text-gray-400 line-through">{formatPrice(v.mrp)}</span>
                          )}
                        </div>
                        {v.stock <= 3 && (
                          <span className="text-amber-700 font-semibold text-[10px]">
                            Only {v.stock} left!
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 italic">
                * Switching finish updates the high-resolution photo and specific inventory.
              </p>
            </div>
          )}

          {/* Quantity Selector & Action Buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-[#E8DCCF] rounded-xl bg-[#FAF7F2]">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2.5 text-sm font-bold text-[#3B1E22] hover:bg-[#F4EBE1] rounded-l-xl cursor-pointer"
                >
                  -
                </button>
                <span className="px-4 py-2.5 text-sm font-bold text-[#3B1E22]">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2.5 text-sm font-bold text-[#3B1E22] hover:bg-[#F4EBE1] rounded-r-xl cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                className="flex-1 btn-teak-green py-3.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-98"
              >
                {addedToast ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Added to Bag!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4 text-white" />
                    <span>Add to Shopping Bag</span>
                  </>
                )}
              </button>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`p-3.5 rounded-xl border border-[#E8DCCF] transition-colors cursor-pointer ${
                  isInWishlist(product.id)
                    ? 'bg-[#3B2F2A] text-[#DFB982] border-[#3B2F2A]'
                    : 'bg-[#FAF7F2] text-[#3B2F2A] hover:bg-[#3B2F2A] hover:text-[#FAF7F2]'
                }`}
                title="Save to Wishlist"
              >
                <Heart
                  className={`w-5 h-5 ${isInWishlist(product.id) ? 'fill-[#DFB982]' : ''}`}
                />
              </button>
            </div>

            {/* Buy Now Direct Button */}
            <button
              onClick={handleBuyNow}
              className="w-full btn-teak-green py-3.5 px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Instant Buy with UPI</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Delivery Pincode Checker */}
          <div className="p-4 bg-white rounded-2xl border border-[#E8DCCF] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#3B2F2A] uppercase tracking-wider">
              <Truck className="w-4 h-4 text-[#DFB982]" />
              Check Express Delivery Estimate:
            </div>
            <form onSubmit={checkPincode} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit Pincode"
                maxLength={6}
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-[#E8DCCF] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3B2F2A]"
              />
              <button
                type="submit"
                className="bg-[#3B2F2A] hover:bg-[#4D3E37] text-white px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer shadow-xs"
              >
                Check
              </button>
            </form>
            {pincodeStatus && (
              <p
                className={`text-xs ${
                  pincodeStatus.includes('Available') ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {pincodeStatus}
              </p>
            )}
            <p className="text-[11px] text-gray-500">
              Orders qualify for <strong>INSURED EXPRESS DISPATCH</strong> with live tracking.
            </p>
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs text-gray-600">
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
              <ShieldCheck className="w-5 h-5 mx-auto text-[#802336] mb-1" />
              <span className="font-semibold text-[#241C1A] block">100% Certified</span>
              <span className="text-[10px] text-gray-500">Authentic Hallmarked</span>
            </div>
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
              <RotateCcw className="w-5 h-5 mx-auto text-[#802336] mb-1" />
              <span className="font-semibold text-[#241C1A] block">7 Days Return</span>
              <span className="text-[10px] text-gray-500">Easy Exchange</span>
            </div>
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
              <Sparkles className="w-5 h-5 mx-auto text-[#802336] mb-1" />
              <span className="font-semibold text-[#241C1A] block">UPI Checkout</span>
              <span className="text-[10px] text-gray-500">Zero Extra Fee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Specifications, Care, Customer Reviews */}
      <div className="bg-white rounded-2xl border border-[#E8DCCF] overflow-hidden shadow-xs">
        {/* Tab Headers */}
        <div className="flex border-b border-[#E8DCCF] bg-[#FAF7F2] overflow-x-auto text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('description')}
            className={`py-3.5 px-6 border-b-2 transition-colors cursor-pointer flex-shrink-0 ${
              activeTab === 'description'
                ? 'border-[#802336] text-[#802336] bg-white'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            Description & Story
          </button>
          <button
            onClick={() => setActiveTab('specifications')}
            className={`py-3.5 px-6 border-b-2 transition-colors cursor-pointer flex-shrink-0 ${
              activeTab === 'specifications'
                ? 'border-[#802336] text-[#802336] bg-white'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            Product Specifications
          </button>
          <button
            onClick={() => setActiveTab('care')}
            className={`py-3.5 px-6 border-b-2 transition-colors cursor-pointer flex-shrink-0 ${
              activeTab === 'care'
                ? 'border-[#802336] text-[#802336] bg-white'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            Jewellery Care Guide
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-3.5 px-6 border-b-2 transition-colors cursor-pointer flex-shrink-0 ${
              activeTab === 'reviews'
                ? 'border-[#802336] text-[#802336] bg-white'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            Patron Reviews ({reviews.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 sm:p-8 text-xs sm:text-sm text-gray-700 leading-relaxed">
          {activeTab === 'description' && (
            <div className="space-y-4 max-w-3xl">
              <p>{product.description}</p>
              <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                <h4 className="font-serif text-base font-bold text-[#3B1E22] mb-1">
                  Artisanal Craftsmanship
                </h4>
                <p className="text-xs text-gray-600">
                  Each piece at VIDHYAA Jewellery Studio is forged with premium metals, coated with high micron gold or rhodium, and individually hand-set by master craftsmen at our Roorkee, District Haridwar atelier.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'specifications' && (
            <div className="max-w-2xl">
              <table className="w-full text-xs text-left border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 font-bold text-gray-700 w-1/3">Material & Base</td>
                    <td className="py-2.5 text-gray-600">{product.material}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 font-bold text-gray-700">Category</td>
                    <td className="py-2.5 text-gray-600">{product.categoryName} ({product.subcategory})</td>
                  </tr>
                  {product.specifications &&
                    Object.entries(product.specifications).map(([key, val]) => (
                      <tr key={key} className="border-b border-gray-100">
                        <td className="py-2.5 font-bold text-gray-700">{key}</td>
                        <td className="py-2.5 text-gray-600">{val}</td>
                      </tr>
                    ))}
                  <tr>
                    <td className="py-2.5 font-bold text-gray-700">SKU Reference</td>
                    <td className="py-2.5 text-gray-600">{currentSku}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'care' && (
            <div className="space-y-4 max-w-3xl">
              <p className="font-medium text-[#3B1E22]">
                {product.careInstructions}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                  <h5 className="font-bold text-[#802336] text-xs uppercase mb-1">Do's:</h5>
                  <ul className="list-disc list-inside text-xs space-y-1 text-gray-600">
                    <li>Store in the velvet pouch or airtight ziplock provided.</li>
                    <li>Wipe gently with the microfiber polishing cloth after wearing.</li>
                    <li>Wear jewellery last after makeup and perfumes have fully dried.</li>
                  </ul>
                </div>
                <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                  <h5 className="font-bold text-[#802336] text-xs uppercase mb-1">Don'ts:</h5>
                  <ul className="list-disc list-inside text-xs space-y-1 text-gray-600">
                    <li>Do not spray perfumes, sanitizers, or hairspray directly.</li>
                    <li>Avoid wearing while swimming or in chlorine/salt water pools.</li>
                    <li>Do not store in humid bathrooms or open sunlit dressers.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-8">
              {/* Write Review Form */}
              <div className="p-5 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF]">
                <h4 className="font-serif text-lg font-bold text-[#3B1E22] mb-2">
                  Share Your Experience
                </h4>
                {reviewSubmitted ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Thank you! Your verified review has been published.</span>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit} className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-[#D4AF37]">
                        <span className="text-xs text-gray-700 font-semibold mr-1">Rating:</span>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => setReviewRating(s)}
                            className="cursor-pointer"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                s <= reviewRating
                                  ? 'fill-[#D4AF37] text-[#D4AF37]'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-[#E8DCCF] rounded-lg bg-white w-48"
                      />
                    </div>
                    <textarea
                      required
                      placeholder="Write what you love about this piece, its finish, and your experience..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={3}
                      className="w-full p-3 text-xs border border-[#E8DCCF] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#802336]"
                    />
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="bg-[#3B2F2A] hover:bg-[#4D3E37] active:bg-[#2E2420] text-[#FAF7F2] px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {submittingReview ? 'Submitting...' : 'Post Patron Review'}
                    </button>
                  </form>
                )}
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    Be the first patron to review this exquisite handcrafted piece!
                  </p>
                ) : (
                  reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl border border-gray-100 bg-white space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#3B1E22]">{rev.userName}</span>
                          {rev.verifiedPurchase && (
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.2 rounded flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified Buyer
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex text-[#D4AF37]">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating ? 'fill-[#D4AF37]' : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-700">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6 pt-6">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              Complete Your Ensemble
            </span>
            <h2 className="font-serif text-3xl font-bold text-[#241C1A] mt-1">
              You May Also Adore
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel}
                onSelectProduct={onSelectProduct}
                onOpenQuickView={onOpenQuickView}
              />
            ))}
          </div>
        </div>
      )}

      {/* 360 Video Player Modal */}
      {videoModalOpen && videoData && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setVideoModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#160E10] rounded-3xl overflow-hidden border border-[#DFB982]/50 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#DFB982]">
                  360° Studio Showcase
                </span>
                <h3 className="font-serif text-sm font-bold text-white line-clamp-1">
                  {videoData.title}
                </h3>
              </div>
              <button
                onClick={() => setVideoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close video"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-[3/4] max-h-[520px] bg-black flex items-center justify-center overflow-hidden">
              <SeamlessLoopVideo
                src={videoData.videoUrl}
                poster={videoData.poster}
                title={videoData.title}
                autoPlay={true}
                isMuted={videoMuted}
                enableObserver={false}
                className="w-full h-full object-contain"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {/* Audio Toggle */}
              <button
                onClick={() => setVideoMuted(!videoMuted)}
                className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/20 transition-colors cursor-pointer"
                title={videoMuted ? 'Unmute' : 'Mute'}
              >
                {videoMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#1F1416] border-t border-white/10 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-[#DFB982]">
                  {formatPrice(product.price)}
                </span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-xs text-gray-400 line-through">
                      {formatPrice(product.mrp)}
                    </span>
                    <span className="text-[10px] bg-[#D4AF37] text-[#3B1E22] font-bold px-1.5 py-0.5 rounded">
                      {calculateDiscountPercent(product.mrp, product.price)}% OFF
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setVideoModalOpen(false);
                  handleAddToCart();
                }}
                className="px-5 py-2 rounded-xl bg-[#802336] hover:bg-[#9B2C43] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow"
              >
                Add To Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
