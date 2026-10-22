import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Truck,
  RotateCcw,
  Star,
  CheckCircle,
  Gem,
  Clock,
  Compass,
  Heart
} from 'lucide-react';
import { Product, ProductVariation, Category } from '../types';
import { ProductCard } from '../components/ProductCard';
import { MetadataManager } from '../components/MetadataManager';
import { ShopByVideoSection } from '../components/ShopByVideoSection';
import { isGenuineProduct, isGenuineImageUrl } from '../lib/sampleData';
import { formatPrice } from '../lib/priceUtils';

const LotusOrnament: React.FC<{ className?: string }> = ({ className = "w-6 h-5 text-[#DFB982]" }) => (
  <svg className={className} viewBox="0 0 32 24" fill="currentColor">
    <path d="M16 2 C14 8 13 14 16 19 C19 14 18 8 16 2 Z" opacity="0.95" />
    <path d="M16 8 C12 11 10 16 13 19 C15 17 16 13 16 8 Z" opacity="0.85" />
    <path d="M16 8 C20 11 22 16 19 19 C17 17 16 13 16 8 Z" opacity="0.85" />
    <path d="M16 12 C9 13 7 18 10 20 C13 19 15 16 16 12 Z" opacity="0.75" />
    <path d="M16 12 C23 13 25 18 22 20 C19 19 17 16 16 12 Z" opacity="0.75" />
    <circle cx="16" cy="20.5" r="1.5" />
  </svg>
);

const CertifiedPurityIcon: React.FC<{ className?: string }> = ({ className = "w-7 h-7 text-[#DFB982]" }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 3 L27 7 V16 C27 23 22 28 16 30 C10 28 5 23 5 16 V7 Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 6 L24 9.5 V16 C24 21.5 20 25.5 16 27 C12 25.5 8 21.5 8 16 V9.5 Z" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
    <path d="M12 16 L15 19 L21 13" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UpiCheckoutIcon: React.FC<{ className?: string }> = ({ className = "w-7 h-7 text-[#DFB982]" }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="7" y="4" width="13" height="24" rx="2.5" />
    <line x1="11" y1="7" x2="16" y2="7" strokeLinecap="round" strokeWidth="1" />
    <path d="M10.5 12 H15.5 M10.5 15 H15.5 M10.5 12 V18.5 M10.5 15 C13 15 14.5 14.5 14.5 13.5 C14.5 12.5 13 12 10.5 12 M13 15 L16 19" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M23 11 C24.5 13 24.5 17 23 19" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M26 8 C28.5 11.5 28.5 19.5 26 23" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

interface HomeViewProps {
  products: Product[];
  categories: Category[];
  onNavigate: (view: string, param?: string) => void;
  onSelectProduct: (product: Product) => void;
  onOpenQuickView: (product: Product, variation?: ProductVariation) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  categories,
  onNavigate,
  onSelectProduct,
  onOpenQuickView
}) => {
  const [activeTab, setActiveTab] = useState<'featured' | 'bestsellers' | 'new'>('featured');
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  const handleImageError = (url: string) => {
    setFailedImageUrls((prev) => {
      const updated = new Set(prev);
      updated.add(url);
      return updated;
    });
  };

  const genuineProducts = useMemo(() => {
    return products.filter((p: Product) => {
      if (!isGenuineProduct(p)) return false;
      const validImg = (p.images || []).find((img) => isGenuineImageUrl(img) && !failedImageUrls.has(img));
      return Boolean(validImg);
    });
  }, [products, failedImageUrls]);

  const filteredProducts = genuineProducts.filter((p: Product) => {
    if (activeTab === 'bestsellers') return p.isBestseller;
    if (activeTab === 'new') return p.isNewArrival;
    return p.isFeatured;
  });

  const handleShopNow = () => {
    const el = document.getElementById('shop-products');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      onNavigate('shop', 'all');
    }
  };

  const handleExploreCollection = () => {
    const el = document.getElementById('categories-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      onNavigate('shop', 'necklaces');
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Homepage SEO & Jewelry Store Structured Data via react-helmet-async */}
      <MetadataManager
        title="VIDHYAA Jewellery Studio | Premium Women's Jewellery & Watches"
        description="Shop exclusive handcrafted gold imitation jewellery, certified 92.5 sterling silver, luxury watches, and oxidised bridal & festive collections with insured pan-India delivery."
        image="/hero-section-image-final.jpg"
      />

      {/* 1. Hero Section - Original Hero Banner with Teak Green Buttons */}
      <section className="relative w-full bg-[#2b040c] border-b border-[#e5c158]/20 flex items-center justify-center overflow-hidden">
        <div className="relative w-full max-w-[1920px] mx-auto">
          {/* Original Hero Banner Image */}
          <img
            src="/hero-section-image-final.jpg"
            alt="VIDHYAA Jewellery Studio - Timeless Jewellery"
            className="w-full h-auto block select-none"
            loading="eager"
          />

          {/* Button 1: SHOP NOW directly over the original SHOP NOW button */}
          <button
            onClick={handleShopNow}
            style={{
              position: 'absolute',
              left: '4.14%',
              top: '64.08%',
              width: '15.47%',
              height: '7.21%',
            }}
            className="bg-[#0F5C4D] hover:bg-[#0A4338] text-[#FAF7F2] font-semibold text-[8px] sm:text-[11px] md:text-xs lg:text-[14px] xl:text-[15px] tracking-[0.10em] uppercase border border-[#0F5C4D] rounded-[2px] shadow-md hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] z-20"
            title="Shop Now - View All Jewellery"
            aria-label="Shop Now"
          >
            <span>SHOP NOW &rarr;</span>
          </button>

          {/* Button 2: EXPLORE COLLECTION directly over the original EXPLORE COLLECTION button */}
          <button
            onClick={handleExploreCollection}
            style={{
              position: 'absolute',
              left: '20.70%',
              top: '64.08%',
              width: '20.16%',
              height: '7.21%',
            }}
            className="bg-[#0F5C4D] hover:bg-[#0A4338] text-[#FAF7F2] font-semibold text-[7.5px] sm:text-[10px] md:text-[11.5px] lg:text-[13px] xl:text-[14px] tracking-[0.08em] uppercase border border-[#0F5C4D] rounded-[2px] shadow-md hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] z-20"
            title="Explore Curated Jewellery Collections"
            aria-label="Explore Collection"
          >
            <span>EXPLORE COLLECTION &rarr;</span>
          </button>
        </div>
      </section>

      {/* 2. Category Section with Circular Cards */}
      <div id="shop-by-category" />
      <section id="categories-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold tracking-[0.25em] text-[#0F4C4A] uppercase">
            Curated For You
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A] mt-1">
            Shop by Category
          </h2>
          <div className="w-16 h-0.5 bg-[#DFB982] mx-auto mt-3"></div>
        </div>

        {/* Square/Portrait Category Cards Grid - Curated Categories & Collections */}
        {(() => {
          const categoryCards = [
            {
              name: 'Necklaces & Choker Sets',
              subtitle: 'Heritage 22K Micro Gold Plated & Temple Sets',
              image: '/products/pink_pearl_rani_haar_1150.jpg',
              onClick: () => onNavigate('shop', 'necklaces')
            },
            {
              name: 'Statement & Cocktail Rings',
              subtitle: 'Pink Emerald Cut & Marquise Solitaires',
              image: '/products/pink_emerald_cocktail_ring_1900.jpg',
              onClick: () => onNavigate('shop', 'rings')
            },
            {
              name: 'Devotional Temple Rings',
              subtitle: 'Lord Ganesha Blessings • Mandala Filigree',
              image: '/products/lord_ganesha_ring_300.jpg',
              onClick: () => onNavigate('shop', 'devotional-rings')
            },
            {
              name: 'Rajwada Polki & Jadau',
              subtitle: 'Uncut Polki Glass & 24K Gold Foil Jadau',
              image: '/products/polki_rajwada_dome_ring_900.jpg',
              onClick: () => onNavigate('shop', 'ragwada-collections')
            },
            {
              name: 'American Diamond Rings',
              subtitle: 'Dual Solitaires & Marquise Petal Coronet',
              image: '/products/ad_floral_cocktail_ring_750.jpg',
              onClick: () => onNavigate('shop', 'rings')
            },
            {
              name: 'Royal Rajwada Choker Sets',
              subtitle: '22K Gold Polish Chokers with Maang Tikka',
              image: '/products/rajwada_choker_set_green_2100.jpg',
              onClick: () => onNavigate('shop', 'chocker-set')
            },
            {
              name: 'Rose Gold Diamond Cascades',
              subtitle: 'Artisan Diamond Waterfall Fringe & Studs',
              image: '/products/rose_gold_diamond_set_2000.jpg',
              onClick: () => onNavigate('shop', 'necklace')
            },
            {
              name: 'Pink Crystal Pearl Beaded Chokers',
              subtitle: 'Cascading Pink Beads & Kundan Pendant',
              image: '/products/pink_beaded_choker_set_1250.jpg',
              onClick: () => onNavigate('shop', 'necklaces')
            },
            {
              name: 'Royal Sapphire Doublet Rings',
              subtitle: 'Sapphire Doublet Petals & Baguette Wheel',
              image: '/products/sapphire_wheel_cocktail_ring_1650.jpg',
              onClick: () => onNavigate('shop', 'statement-rings')
            }
          ].filter(
            (card) => Boolean(card.image && isGenuineImageUrl(card.image) && !failedImageUrls.has(card.image))
          );

          if (categoryCards.length === 0) return null;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5 sm:gap-5 lg:gap-6">
              {categoryCards.map((card) => (
                <div
                  key={card.name}
                  onClick={card.onClick}
                  className="group relative rounded-2xl md:rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-square shadow-md hover:shadow-2xl border border-[#3B1E22]/15 cursor-pointer transition-all duration-300 bg-[#1A0E11]"
                >
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                    loading="lazy"
                    onError={() => handleImageError(card.image)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent group-hover:via-black/55 transition-colors" />

                  <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 md:p-5 text-center flex flex-col items-center justify-end z-10">
                    <h3 className="font-serif text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-white group-hover:text-[#DFB982] transition-colors leading-tight line-clamp-1 drop-shadow-sm">
                      {card.name}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] md:text-xs text-[#E8DCCF]/95 line-clamp-1 mt-1 font-normal tracking-wide">
                      {card.subtitle}
                    </p>
                    <div className="mt-2 sm:mt-2.5 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-[#DFB982] group-hover:text-[#F7E7CE] tracking-widest uppercase transition-colors">
                      <span>EXPLORE</span>
                      <ArrowRight className="w-3 sm:w-3.5 h-3 sm:h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Round Category Icons - Circular Category Navigation Row */}
        {(() => {
          const roundItems = [
            { name: 'Necklaces', img: '/products/pink_pearl_rani_haar_1150.jpg', cat: 'necklaces' },
            { name: 'Choker Sets', img: '/products/rajwada_choker_set_green_2100.jpg', cat: 'chocker-set' },
            { name: 'Statement Rings', img: '/products/pink_emerald_cocktail_ring_1900.jpg', cat: 'rings' },
            { name: 'Devotional Rings', img: '/products/lord_ganesha_ring_300.jpg', cat: 'devotional-rings' },
            { name: 'Rajwada Polki', img: '/products/polki_rajwada_dome_ring_900.jpg', cat: 'ragwada-collections' },
            { name: 'AD Rings', img: '/products/ad_floral_cocktail_ring_750.jpg', cat: 'rings' },
            { name: 'Sapphire Rings', img: '/products/sapphire_wheel_cocktail_ring_1650.jpg', cat: 'statement-rings' },
            { name: 'Cushion Solitaires', img: '/products/cushion_solitaire_winged_ring_1850.jpg', cat: 'rings' },
            { name: 'Oval Solitaires', img: '/products/oval_solitaire_infinity_ring_1150.jpg', cat: 'rings' },
            { name: 'Rose Gold Sets', img: '/products/rose_gold_diamond_set_2000.jpg', cat: 'necklace' },
            { name: 'Pearl Rani Haar', img: '/products/pink_beaded_choker_set_1250.jpg', cat: 'necklaces' }
          ].filter(
            (item) => Boolean(item.img && isGenuineImageUrl(item.img) && !failedImageUrls.has(item.img))
          );

          if (roundItems.length === 0) return null;

          return (
            <div className="mt-10 sm:mt-12 pt-8 border-t border-[#E8DCCF]/80">
              <div className="flex items-center justify-start lg:justify-center gap-4 sm:gap-6 md:gap-7 overflow-x-auto pb-4 pt-1 px-2 no-scrollbar">
                {roundItems.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => onNavigate('shop', item.cat)}
                    className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0 transition-transform active:scale-95"
                    title={`Explore ${item.name}`}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[82px] lg:h-[82px] rounded-full p-1 border-2 border-[#D4AF37]/70 group-hover:border-[#802336] transition-all overflow-hidden shadow-sm group-hover:scale-108 bg-[#181113] flex items-center justify-center">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={() => handleImageError(item.img)}
                      />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-[#3B1E22] group-hover:text-[#802336] transition-colors text-center whitespace-nowrap leading-tight">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* 2.5 Live Shopping Atelier Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#241C1A] via-[#3B1E22] to-[#1C1615] rounded-3xl p-6 sm:p-8 border border-[#DFB982]/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-[#802336] text-white text-xs font-bold uppercase px-3 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>LIVE BROADCAST ON AIR</span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
              VIDHYAA Studio Live Shopping Experience
            </h3>
            <p className="text-xs sm:text-sm text-[#E8DCCF] max-w-xl leading-relaxed">
              Watch real-time live demonstrations of royal polki chokers, certified 92.5 sterling silver, and swiss-style watches. Claim <strong>15% OFF</strong> live exclusive discounts and chat with our master stylists!
            </p>
          </div>

          <div className="flex items-center gap-3 z-10 flex-shrink-0">
            <button
              onClick={() => onNavigate('go-live')}
              className="bg-[#DFB982] hover:bg-[#c9a36b] text-[#241C1A] px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-2"
            >
              <span>Join Live Stream</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Featured Products Responsive Grid */}
      <section id="shop-products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold tracking-[0.25em] text-[#0F4C4A] uppercase">
              Trending & Handcrafted Heirlooms
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              Featured Jewellery
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center p-1 bg-[#F4EBE1] rounded-xl border border-[#E8DCCF]">
            <button
              onClick={() => setActiveTab('featured')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'featured'
                  ? 'bg-[#0F4C4A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Featured
            </button>
            <button
              onClick={() => setActiveTab('bestsellers')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'bestsellers'
                  ? 'bg-[#0F4C4A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Best Sellers
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-[#0F4C4A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              New Arrivals
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.slice(0, 8).map((prod: Product) => (
            <ProductCard
              key={prod.id}
              product={prod}
              onSelectProduct={onSelectProduct}
              onOpenQuickView={onOpenQuickView}
            />
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => onNavigate('shop', 'all')}
            className="inline-flex items-center gap-2 bg-transparent hover:bg-[#0F4C4A] text-[#0F4C4A] hover:text-white border-2 border-[#0F4C4A] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs hover:shadow-md"
          >
            <span>Explore All {products.length} Designs</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* NEW: Premium SHOPPING VIDEO Section */}
      <ShopByVideoSection
        products={products}
        onSelectProduct={onSelectProduct}
      />

      {/* 5. Promotional Section: Necklaces & Statement Rings Duo Grid */}
      {(() => {
        const pearlImg = '/products/pink_pearl_rani_haar_1150.jpg';
        const solitaireImg = '/products/pink_emerald_cocktail_ring_1900.jpg';
        const hasPearl = isGenuineImageUrl(pearlImg) && !failedImageUrls.has(pearlImg);
        const hasSolitaire = isGenuineImageUrl(solitaireImg) && !failedImageUrls.has(solitaireImg);

        if (!hasPearl && !hasSolitaire) return null;

        const pearlPromoProduct = products.find((p) => p.id === 'prod-user-005');
        const solitairePromoProduct = products.find((p) => p.id === 'prod-user-010');
        const pearlPrice = pearlPromoProduct ? formatPrice(pearlPromoProduct.price) : '₹1,150';
        const solitairePrice = solitairePromoProduct ? formatPrice(solitairePromoProduct.price) : '₹1,450';

        return (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pink White Pearl Rani Haar Box */}
            {hasPearl && (
              <div
                className="relative rounded-3xl overflow-hidden aspect-[4/3] group cursor-pointer shadow-lg bg-white flex items-center justify-center p-4"
                onClick={() => {
                  if (pearlPromoProduct) {
                    onSelectProduct(pearlPromoProduct);
                  } else {
                    onNavigate('shop', 'necklaces');
                  }
                }}
              >
                <img
                  src={pearlImg}
                  alt="Pink White Pearl Rani Haar"
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700"
                  onError={() => handleImageError(pearlImg)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 p-8 text-white space-y-2 pointer-events-none">
                  <span className="text-xs font-bold text-[#DFB982] uppercase tracking-widest">
                    Royal Heritage • {pearlPrice}
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold">
                    Pink White Pearl Rani Haar
                  </h3>
                  <p className="text-xs text-gray-300 max-w-sm line-clamp-2">
                    Multi-layer cascading pink crystal beads, freshwater seed pearls, and antique Kundan earrings.
                  </p>
                  <div className="pt-2 flex items-center gap-1 text-xs font-semibold text-[#DFB982]">
                    <span>Discover Collection</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            )}

            {/* Statement Rings Box */}
            {hasSolitaire && (
              <div
                className="relative rounded-3xl overflow-hidden aspect-[4/3] group cursor-pointer shadow-lg bg-white flex items-center justify-center p-4"
                onClick={() => {
                  if (solitairePromoProduct) {
                    onSelectProduct(solitairePromoProduct);
                  } else {
                    onNavigate('shop', 'rings');
                  }
                }}
              >
                <img
                  src={solitaireImg}
                  alt="Pink Emerald Statement Ring"
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700"
                  onError={() => handleImageError(solitaireImg)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 p-8 text-white space-y-2 pointer-events-none">
                  <span className="text-xs font-bold text-[#DFB982] uppercase tracking-widest">
                    Cocktail Statement • {solitairePrice}
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold">
                    Pink Emerald Cut AD Cocktail Ring
                  </h3>
                  <p className="text-xs text-gray-300 max-w-sm line-clamp-2">
                    Step-cut pink solitaire enveloped in marquise-cut diamond cathedral trellis with comfort adjustable band.
                  </p>
                  <div className="pt-2 flex items-center gap-1 text-xs font-semibold text-[#DFB982]">
                    <span>Shop Rings</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* 6. Trust & Craftsmanship Section */}
      <section className="bg-[#FAF7F2] py-14 border-y border-[#E8DCCF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              The VIDHYAA Promise
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A] mt-1">
              Why Discerning Women Choose VIDHYAA
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-[#E8DCCF] shadow-sm text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#FAF7F2] border border-[#D4AF37] flex items-center justify-center mx-auto text-[#802336]">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                Certified 92.5 Silver & 24K Plating
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Authentic hallmarked purity stamp on every sterling silver piece and durable 24K micro-gold plating that resists daily fading.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#E8DCCF] shadow-sm text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#FAF7F2] border border-[#0F4C4A] flex items-center justify-center mx-auto text-[#0F4C4A]">
                <Truck className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                Insured Pan-India Express Delivery
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Prompt dispatch within 24 hours with BlueDart & Delhivery express tracking right to your doorstep anywhere in India.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#E8DCCF] shadow-sm text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#FAF7F2] border border-[#D4AF37] flex items-center justify-center mx-auto text-[#802336]">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                Instant UPI Secure Verification
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Pay frictionlessly with Google Pay, PhonePe, Paytm, or BHIM with zero transaction surcharges and bank-level safety.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Patron Reviews / Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
            Patron Love
          </span>
          <h2 className="font-serif text-3xl font-bold text-[#241C1A] mt-1">
            Cherished by Women Across India
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Dr. Ananya Mathur',
              city: 'Jaipur',
              piece: 'Padmavati Royal Kundan Set',
              quote: 'Wore the Kundan choker for my cousin’s wedding and received non-stop compliments. The finish is indistinguishable from solid heritage gold!'
            },
            {
              name: 'Pooja Iyer',
              city: 'Bangalore',
              piece: '92.5 Silver Solitaire Ring',
              quote: 'The 92.5 stamp is genuine and the stone sparkles brilliantly even under dim evening lights. Very prompt delivery within 3 days.'
            },
            {
              name: 'Meera Deshmukh',
              city: 'Mumbai',
              piece: 'Aurelia Rose Gold Mesh Watch',
              quote: 'The magnetic mesh strap is so comfortable. It looks like a high-end luxury Swiss watch. Super impressed with VIDHYAA packaging.'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-6 rounded-2xl border border-[#E8DCCF] shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex text-[#D4AF37] mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#D4AF37]" />
                  ))}
                </div>
                <p className="text-xs text-gray-700 italic leading-relaxed">
                  "{item.quote}"
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-[#3B1E22]">{item.name}</h4>
                  <span className="text-gray-400 text-[11px]">{item.city}</span>
                </div>
                <span className="text-[10px] text-[#802336] font-medium bg-[#FAF7F2] px-2 py-0.5 rounded">
                  {item.piece}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
