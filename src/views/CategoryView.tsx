import React, { useState, useMemo } from 'react';
import {
  Category,
  Product,
  ProductVariation,
  CategoryImage,
  CategoryVideo,
  CategorySectionKey
} from '../types';
import { ProductCard } from '../components/ProductCard';
import { MetadataManager } from '../components/MetadataManager';
import { isGenuineProduct, isGenuineImageUrl, isGenuineVideoUrl } from '../lib/sampleData';
import { SeamlessLoopVideo } from '../components/SeamlessLoopVideo';
import {
  Sparkles,
  ChevronRight,
  Filter,
  Play,
  X,
  Maximize2,
  CheckCircle,
  ArrowRight,
  MessageCircle,
  Image as ImageIcon,
  Video as VideoIcon,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  ExternalLink,
  Award,
  Flame
} from 'lucide-react';

interface CategoryViewProps {
  category: Category;
  categories: Category[];
  products: Product[];
  onSelectProduct: (product: Product, variation?: ProductVariation) => void;
  onOpenQuickView: (product: Product, variation?: ProductVariation) => void;
  onNavigate: (view: string, param?: string) => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  category,
  categories,
  products,
  onSelectProduct,
  onOpenQuickView,
  onNavigate
}) => {
  // Subcategory filter & Curation filter
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [curationFilter, setCurationFilter] = useState<'all' | 'featured' | 'bestseller' | 'new-arrival' | 'trending'>('all');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Lightbox Modal for Gallery Images
  const [activeLightboxImage, setActiveLightboxImage] = useState<CategoryImage | null>(null);

  // Video Modal Player
  const [activeVideo, setActiveVideo] = useState<CategoryVideo | null>(null);

  // Products belonging to this category with normalized ID and keyword fallback
  const categoryProducts = useMemo(() => {
    const catId = (category.id || '').toLowerCase().trim();
    const catSlug = (category.slug || catId).toLowerCase().trim();

    return products.filter((p) => {
      if (!isGenuineProduct(p)) return false;
      const pCatId = (p.categoryId || '').toLowerCase().trim();
      const pCatSlug = pCatId.replace(/[^a-z0-9]+/g, '-');

      // Direct match
      if (pCatId === catId || pCatSlug === catSlug || pCatId === catSlug || pCatSlug === catId) {
        return true;
      }

      // Rings and Devotional Rings grouping
      if ((catId === 'rings' || catId === 'devotional-rings') && (pCatId === 'rings' || pCatId === 'devotional-rings')) {
        return true;
      }

      // Bangles, Kangan, Kada, Bracelets
      if (
        (catId.includes('kangan') || catId.includes('bangle') || catId.includes('kada') || catId.includes('bracelet')) &&
        (pCatId.includes('kangan') || pCatId.includes('bangle') || pCatId.includes('kada') || pCatId.includes('bracelet') ||
         ['kangan', 'kada', 'bracelet', 'bangle'].some((kw) =>
           `${p.name} ${p.description} ${p.shortDescription || ''} ${p.subcategory || ''}`.toLowerCase().includes(kw)
         ))
      ) {
        return true;
      }

      // Watches
      if (catId === 'watches' && (pCatId === 'watches' || `${p.name} ${p.description}`.toLowerCase().includes('watch'))) {
        return true;
      }

      // Chains & Matar Mala
      if ((catId === 'chains' || catId === 'chain') && (pCatId === 'chains' || `${p.name} ${p.description}`.toLowerCase().includes('chain') || `${p.name} ${p.description}`.toLowerCase().includes('mala'))) {
        return true;
      }

      return false;
    });
  }, [products, category.id, category.slug]);

  // Featured Products pinned by CMS
  const featuredProducts = useMemo(() => {
    if (category.featuredProductIds && category.featuredProductIds.length > 0) {
      return categoryProducts.filter((p) => category.featuredProductIds?.includes(p.id));
    }
    return categoryProducts.filter((p) => p.isFeatured || p.isBestseller).slice(0, 4);
  }, [categoryProducts, category.featuredProductIds]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let result = categoryProducts.filter((p) => p.active);

    if (curationFilter === 'featured') {
      result = result.filter(
        (p) => (category.featuredProductIds || []).includes(p.id) || p.isFeatured
      );
    } else if (curationFilter === 'bestseller') {
      result = result.filter(
        (p) => (category.bestsellerProductIds || []).includes(p.id) || p.isBestseller
      );
    } else if (curationFilter === 'new-arrival') {
      result = result.filter(
        (p) => (category.newArrivalProductIds || []).includes(p.id) || p.isNewArrival
      );
    } else if (curationFilter === 'trending') {
      result = result.filter(
        (p) => (category.trendingProductIds || []).includes(p.id)
      );
    }

    if (selectedSubcategory !== 'all') {
      result = result.filter(
        (p) => p.subcategory?.toLowerCase() === selectedSubcategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q)
      );
    }

    if (inStockOnly) {
      result = result.filter((p) => p.inStock);
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    });
  }, [categoryProducts, category.featuredProductIds, category.bestsellerProductIds, category.newArrivalProductIds, category.trendingProductIds, curationFilter, selectedSubcategory, searchQuery, inStockOnly, sortBy]);

  // Published gallery images - only genuine uploaded images
  const galleryImages = useMemo(() => {
    return (category.galleryImages || [])
      .filter((img) => isGenuineImageUrl(img.url))
      .sort((a, b) => a.order - b.order);
  }, [category.galleryImages]);

  // Published videos - only genuine uploaded videos
  const publishedVideos = useMemo(() => {
    return (category.videos || [])
      .filter((v) => v.published !== false && isGenuineVideoUrl(v.videoUrl))
      .sort((a, b) => a.order - b.order);
  }, [category.videos]);

  // Active sections order
  const sectionsOrder: CategorySectionKey[] = useMemo(() => {
    const defaultOrder: CategorySectionKey[] = [
      'banner',
      'description',
      'gallery',
      'videos',
      'featured_products',
      'products',
      'custom_story',
      'cta'
    ];
    const order = category.sectionsOrder && category.sectionsOrder.length > 0
      ? category.sectionsOrder
      : defaultOrder;
    const hidden = new Set(category.hiddenSections || []);
    return order.filter((key) => !hidden.has(key));
  }, [category.sectionsOrder, category.hiddenSections]);

  // Helper to detect YouTube / Vimeo embed with continuous looping
  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&loop=1&playlist=${ytMatch[1]}&mute=1&playsinline=1`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/i);
    if (vimeoMatch && vimeoMatch[3]) {
      return `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1&loop=1&muted=1`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-24 space-y-16 animate-fadeIn">
      {/* 1. SEO METADATA */}
      <MetadataManager
        title={category.seoTitle || `${category.name} | VIDHYAA Luxury Jewellery`}
        description={
          category.seoDescription ||
          category.description ||
          `Shop handcrafted ${category.name} with certified quality, 22K gold plating and nationwide delivery.`
        }
        image={category.heroBannerUrl || category.image}
      />

      {/* Render Dynamic Sections in Configured Order */}
      {sectionsOrder.map((sectionKey) => {
        switch (sectionKey) {
          /* ---------------------------------------------------- */
          /* SECTION: HERO BANNER                                 */
          /* ---------------------------------------------------- */
          case 'banner':
            return (
              <section
                key="banner"
                className="relative overflow-hidden w-full border-b border-[#E8DCCF] min-h-[460px] sm:min-h-[520px] lg:min-h-[600px] flex items-center bg-[#241C1A]"
              >
                {Boolean((category.heroBannerUrl || category.image) && isGenuineImageUrl(category.heroBannerUrl || category.image)) ? (
                  <div
                    className="absolute inset-0 w-full h-full transform scale-100 hover:scale-[1.01] transition-transform duration-1000 ease-out"
                    style={{
                      backgroundImage: `url(${category.heroBannerUrl || category.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1C0F12] via-[#2A1619] to-[#120B0D]" />
                )}

                {/* Soft Luxury Overlay for pristine contrast */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30 md:w-3/4 lg:w-3/5 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full text-white space-y-6">
                  {/* Breadcrumb Navigation */}
                  <nav className="flex items-center gap-2 text-xs text-[#DFB982] tracking-wider uppercase font-medium flex-wrap">
                    <button
                      onClick={() => onNavigate('home')}
                      className="hover:underline hover:text-white cursor-pointer transition-colors"
                    >
                      Home
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                    <button
                      onClick={() => onNavigate('shop', 'all')}
                      className="hover:underline hover:text-white cursor-pointer transition-colors"
                    >
                      Collections
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white font-semibold">{category.name}</span>
                  </nav>

                  {/* Eyebrow Badge */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-[#DFB982]/40 text-[#DFB982] text-xs font-bold tracking-widest uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-[#DFB982]" />
                    <span>Curated Atelier Collection</span>
                  </div>

                  {/* Main Title & Subtitle */}
                  <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] max-w-2xl">
                    {category.name}
                  </h1>

                  {category.subtitle && (
                    <p className="font-serif italic text-lg sm:text-2xl text-[#DFB982] font-normal max-w-xl">
                      {category.subtitle}
                    </p>
                  )}

                  {/* Short description */}
                  <p className="text-sm sm:text-base text-gray-200 max-w-xl leading-relaxed font-normal">
                    {category.description}
                  </p>

                  {/* Quick Section Anchors & CTAs */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <a
                      href="#products"
                      className="bg-gradient-to-r from-[#DFB982] via-[#E8C89A] to-[#DFB982] hover:from-[#d4a86b] hover:to-[#c99855] text-[#3B1E22] font-bold text-xs uppercase tracking-widest px-7 py-3.5 rounded-xl border border-[#D4AF37]/50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#802336]" />
                      <span>Explore Designs ({categoryProducts.length})</span>
                    </a>

                    {publishedVideos.length > 0 && (
                      <a
                        href="#videos"
                        className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-md font-bold text-xs uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-2 shadow-sm"
                      >
                        <Play className="w-4 h-4 fill-white text-white" />
                        <span>Watch Video Showcase</span>
                      </a>
                    )}

                    {galleryImages.length > 0 && (
                      <a
                        href="#gallery"
                        className="bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider px-5 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4 text-[#DFB982]" />
                        <span>Gallery ({galleryImages.length})</span>
                      </a>
                    )}
                  </div>
                </div>
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: PROMOTIONAL / DESCRIPTION HIGHLIGHTS        */
          /* ---------------------------------------------------- */
          case 'description':
            return (
              <section key="description" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E8DCCF] shadow-xs flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="md:w-7/12 space-y-3">
                    <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
                      Craftsmanship & Lineage
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
                      Distinctive Artistry of {category.name}
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {category.description} Hand-finished by seasoned master karigars in Roorkee, District Haridwar using certified materials, precision settings, and heirloom-grade protective seals.
                    </p>

                    {/* Subcategories tags */}
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">Included Styles:</span>
                        {category.subcategories.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => {
                              setSelectedSubcategory(sub);
                              const el = document.getElementById('products');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-xs px-3 py-1 rounded-full bg-[#FAF7F2] hover:bg-[#802336] hover:text-white text-[#3B1E22] border border-[#E8DCCF] transition-colors cursor-pointer font-medium"
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:w-5/12 grid grid-cols-2 gap-3 w-full">
                    <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF] text-center space-y-1">
                      <CheckCircle className="w-5 h-5 text-[#B8860B] mx-auto" />
                      <div className="text-xs font-bold text-[#3B1E22]">Certified Purity</div>
                      <div className="text-[11px] text-gray-500">Hallmark & Micron Gold</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF] text-center space-y-1">
                      <CheckCircle className="w-5 h-5 text-[#B8860B] mx-auto" />
                      <div className="text-xs font-bold text-[#3B1E22]">Express Shipping</div>
                      <div className="text-[11px] text-gray-500">Insured Pan-India Transit</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF] text-center space-y-1">
                      <CheckCircle className="w-5 h-5 text-[#B8860B] mx-auto" />
                      <div className="text-xs font-bold text-[#3B1E22]">Velvet Gift Packaging</div>
                      <div className="text-[11px] text-gray-500">Complimentary with Order</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF] text-center space-y-1">
                      <Star className="w-5 h-5 text-[#D4AF37] fill-[#D4AF37] mx-auto" />
                      <div className="text-xs font-bold text-[#3B1E22]">4.9 / 5 Rating</div>
                      <div className="text-[11px] text-gray-500">Verified Patrons</div>
                    </div>
                  </div>
                </div>
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: IMAGES GALLERY                              */
          /* ---------------------------------------------------- */
          case 'gallery':
            if (galleryImages.length === 0) return null;
            return (
              <section key="gallery" id="gallery" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#B8860B]" />
                      Atelier Photography
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
                      High-Resolution Gallery
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Explore macro cuts, gemstone color fire, and signature design motifs.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#802336] bg-[#FAF7F2] px-3.5 py-1.5 rounded-full border border-[#E8DCCF] self-start sm:self-auto">
                    {galleryImages.length} High-Res Frames
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {galleryImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setActiveLightboxImage(img)}
                      className="group relative rounded-2xl overflow-hidden aspect-[4/5] bg-[#F4EBE1] border border-[#E8DCCF] shadow-xs hover:shadow-xl cursor-pointer transition-all duration-300"
                    >
                      <img
                        src={img.url}
                        alt={img.altText || img.title || category.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white" />

                      {/* Cover Badge */}
                      {img.isCover && (
                        <div className="absolute top-3 left-3 bg-[#DFB982] text-[#3B1E22] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                          Cover
                        </div>
                      )}

                      {/* Expand Icon */}
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-xs">
                        <Maximize2 className="w-4 h-4" />
                      </div>

                      {/* Bottom Caption on Hover */}
                      <div className="absolute inset-x-0 bottom-0 p-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="text-xs font-bold leading-snug">{img.title || category.name}</div>
                        {img.caption && <div className="text-[11px] text-gray-200 line-clamp-1">{img.caption}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: VIDEOS SHOWCASE                             */
          /* ---------------------------------------------------- */
          case 'videos':
            if (publishedVideos.length === 0) return null;
            return (
              <section key="videos" id="videos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase flex items-center gap-1.5">
                      <VideoIcon className="w-3.5 h-3.5 text-[#B8860B]" />
                      Motion & Shine
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
                      Video Demonstrations
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Watch how each piece sparkles in live movement and natural light.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#802336] bg-[#FAF7F2] px-3.5 py-1.5 rounded-full border border-[#E8DCCF] self-start sm:self-auto">
                    {publishedVideos.length} Video Repertoire
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {publishedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white rounded-3xl overflow-hidden border border-[#E8DCCF] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                    >
                      {/* Video Thumbnail Area with Continuous Seamless Loop Preview */}
                      <div
                        onClick={() => setActiveVideo(video)}
                        className="relative aspect-video bg-black cursor-pointer group overflow-hidden"
                      >
                        {video.videoUrl && !getEmbedUrl(video.videoUrl) ? (
                          <SeamlessLoopVideo
                            src={video.videoUrl}
                            poster={video.thumbnailUrl || category.image}
                            title={video.title}
                            autoPlay={true}
                            isMuted={true}
                            enableObserver={true}
                            observerThreshold={0.15}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (video.thumbnailUrl || category.image) ? (
                          <img
                            src={video.thumbnailUrl || category.image}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#241C1A] to-[#120B0D] flex items-center justify-center opacity-90" />
                        )}
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
                          <div className="w-14 h-14 rounded-full bg-[#DFB982]/90 backdrop-blur-sm text-[#3B1E22] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 fill-[#3B1E22] ml-1" />
                          </div>
                        </div>

                        {video.duration && (
                          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-white pointer-events-none">
                            {video.duration}
                          </div>
                        )}

                        {video.isFeatured && (
                          <div className="absolute top-3 left-3 bg-[#802336] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider pointer-events-none">
                            Featured Video
                          </div>
                        )}
                      </div>

                      {/* Video Content Description */}
                      <div className="p-6 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-serif text-lg font-bold text-[#241C1A]">{video.title}</h3>
                          {video.description && (
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">{video.description}</p>
                          )}
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t border-gray-100">
                          <button
                            onClick={() => setActiveVideo(video)}
                            className="text-xs font-bold text-[#802336] hover:text-[#5c1322] flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                          >
                            <span>Watch Full Video</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: FEATURED CURATION                           */
          /* ---------------------------------------------------- */
          case 'featured_products':
            if (featuredProducts.length === 0) return null;
            return (
              <section key="featured_products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
                      Patron Favourites
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
                      Featured In {category.name}
                    </h2>
                  </div>
                  <a
                    href="#products"
                    className="text-xs font-bold text-[#802336] hover:underline uppercase tracking-wider flex items-center gap-1"
                  >
                    <span>View All {categoryProducts.length} Designs</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {featuredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelectProduct={onSelectProduct}
                      onOpenQuickView={onOpenQuickView}
                    />
                  ))}
                </div>
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: ALL PRODUCTS CATALOG & FILTERS              */
          /* ---------------------------------------------------- */
          case 'products':
            return (
              <section key="products" id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                {/* Multiple Promotional Banners if configured */}
                {category.promoBanners && category.promoBanners.filter((b) => b.active).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                    {category.promoBanners.filter((b) => b.active).map((b) => (
                      <div
                        key={b.id}
                        className="relative rounded-3xl overflow-hidden bg-[#3B1E22] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md border border-[#DFB982]/30 group"
                      >
                        {b.imageUrl ? (
                          <img
                            src={b.imageUrl}
                            alt={b.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                          />
                        ) : null}
                        <div className="relative z-10 space-y-1.5 text-center sm:text-left">
                          <span className="text-[10px] font-bold tracking-[0.2em] text-[#DFB982] uppercase">
                            Special Curation
                          </span>
                          <h3 className="font-serif text-lg sm:text-xl font-bold text-white leading-tight">
                            {b.title}
                          </h3>
                          {b.subtitle && (
                            <p className="text-xs text-gray-200 line-clamp-2 max-w-sm">
                              {b.subtitle}
                            </p>
                          )}
                        </div>

                        {b.linkText && (
                          <a
                            href={b.linkUrl || '#products'}
                            className="relative z-10 px-5 py-2.5 bg-gradient-to-r from-[#DFB982] to-[#E8C89A] hover:from-[#d4a86b] hover:to-[#c99855] text-[#3B1E22] text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                          >
                            {b.linkText}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Header & Controls */}
                <div className="border-b border-[#E8DCCF] pb-6 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
                        Full Catalog
                      </span>
                      <h2 className="font-serif text-3xl font-bold text-[#241C1A] mt-1">
                        All {category.name} ({filteredProducts.length})
                      </h2>
                    </div>

                    {/* Sorting & Search */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search in this category..."
                          className="bg-white border border-[#E8DCCF] rounded-xl px-3.5 py-2 text-xs text-[#3B1E22] w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-[#802336]"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-white border border-[#E8DCCF] rounded-xl px-3.5 py-2 text-xs font-medium text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336] cursor-pointer"
                      >
                        <option value="featured">Featured First</option>
                        <option value="newest">Newest Additions</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="rating">Patron Rating</option>
                      </select>

                      <label className="flex items-center gap-2 text-xs font-medium text-[#3B1E22] bg-white border border-[#E8DCCF] rounded-xl px-3.5 py-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                          className="accent-[#802336] rounded"
                        />
                        <span>In Stock</span>
                      </label>
                    </div>
                  </div>

                  {/* Curation Filter Tabs (All, Featured, Bestsellers, New Arrivals, Trending) */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-gray-100">
                    <button
                      onClick={() => setCurationFilter('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        curationFilter === 'all'
                          ? 'bg-[#3B1E22] text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:text-black border border-[#E8DCCF]'
                      }`}
                    >
                      All Designs ({categoryProducts.length})
                    </button>

                    <button
                      onClick={() => setCurationFilter('featured')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        curationFilter === 'featured'
                          ? 'bg-[#802336] text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:text-black border border-[#E8DCCF]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#DFB982]" />
                      <span>Featured</span>
                    </button>

                    <button
                      onClick={() => setCurationFilter('bestseller')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        curationFilter === 'bestseller'
                          ? 'bg-[#802336] text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:text-black border border-[#E8DCCF]'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 text-[#DFB982]" />
                      <span>Best Sellers</span>
                    </button>

                    <button
                      onClick={() => setCurationFilter('new-arrival')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        curationFilter === 'new-arrival'
                          ? 'bg-[#802336] text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:text-black border border-[#E8DCCF]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#DFB982]" />
                      <span>New Arrivals</span>
                    </button>

                    <button
                      onClick={() => setCurationFilter('trending')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        curationFilter === 'trending'
                          ? 'bg-[#802336] text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:text-black border border-[#E8DCCF]'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Trending</span>
                    </button>
                  </div>

                  {/* Subcategory Pills */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                      <button
                        onClick={() => setSelectedSubcategory('all')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                          selectedSubcategory === 'all'
                            ? 'bg-[#802336] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All Styles
                      </button>

                      {category.subcategories.map((sub) => {
                        const count = categoryProducts.filter(
                          (p) => p.subcategory?.toLowerCase() === sub.toLowerCase()
                        ).length;
                        return (
                          <button
                            key={sub}
                            onClick={() => setSelectedSubcategory(sub)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                              selectedSubcategory.toLowerCase() === sub.toLowerCase()
                                ? 'bg-[#802336] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>{sub}</span>
                            <span className="text-[10px] opacity-75 font-normal">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Products Grid */}
                {filteredProducts.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-[#E8DCCF] space-y-4">
                    <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                    <h3 className="font-serif text-xl font-bold text-[#3B1E22]">No Designs Match Your Filter</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Try resetting your subcategory filter or search query to browse all available pieces in {category.name}.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedSubcategory('all');
                        setSearchQuery('');
                        setInStockOnly(false);
                      }}
                      className="bg-[#802336] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#68192a] transition-colors cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelectProduct={onSelectProduct}
                        onOpenQuickView={onOpenQuickView}
                      />
                    ))}
                  </div>
                )}
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: CUSTOM ATELIER STORY / HERITAGE             */
          /* ---------------------------------------------------- */
          case 'custom_story':
            const hasMainStory = !!(category.customStoryTitle || category.customStoryBody);
            const customSections = (category.customSections || []).filter((s) => s.active !== false);
            if (!hasMainStory && customSections.length === 0) return null;

            return (
              <section key="custom_story" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                {hasMainStory && (
                  <div className="bg-gradient-to-br from-[#FAF7F2] to-[#F4EBE1] rounded-3xl p-8 sm:p-12 border border-[#E8DCCF] shadow-sm flex flex-col md:flex-row items-center gap-10">
                    {category.customStoryImage && isGenuineImageUrl(category.customStoryImage) && (
                      <div className="md:w-5/12 overflow-hidden rounded-2xl border border-[#E8DCCF] shadow-md flex-shrink-0">
                        <img
                          src={category.customStoryImage}
                          alt={category.customStoryTitle || category.name}
                          className="w-full h-80 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className="space-y-4 flex-1">
                      <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
                        Atelier Heritage
                      </span>
                      <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]">
                        {category.customStoryTitle || `The Art of ${category.name}`}
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed font-normal whitespace-pre-line">
                        {category.customStoryBody}
                      </p>
                      <div className="pt-2 flex items-center gap-4 text-xs font-semibold text-[#802336]">
                        <span>Vidhyaa Jewellery Studio • Roorkee, District Haridwar</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Custom Text Sections */}
                {customSections.map((sec) => (
                  <div
                    key={sec.id}
                    className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E8DCCF] shadow-xs flex flex-col md:flex-row items-center justify-between gap-8"
                  >
                    {sec.imageUrl && (
                      <div className="md:w-5/12 rounded-2xl overflow-hidden border border-[#E8DCCF] shadow-sm flex-shrink-0">
                        <img
                          src={sec.imageUrl}
                          alt={sec.title}
                          className="w-full h-64 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="space-y-3 flex-1">
                      {sec.subtitle && (
                        <span className="text-xs font-bold tracking-[0.2em] text-[#802336] uppercase">
                          {sec.subtitle}
                        </span>
                      )}
                      <h3 className="font-serif text-2xl font-bold text-[#241C1A]">{sec.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {sec.content}
                      </p>
                      {sec.buttonText && (
                        <div className="pt-2">
                          <a
                            href={sec.buttonLink || '#products'}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#802336] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#68192a] transition-colors"
                          >
                            <span>{sec.buttonText}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            );

          /* ---------------------------------------------------- */
          /* SECTION: CALL TO ACTION BANNER                       */
          /* ---------------------------------------------------- */
          case 'cta':
            return (
              <section key="cta" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#3B1E22] via-[#5c1322] to-[#3B1E22] text-white p-8 sm:p-14 text-center space-y-6 shadow-xl border border-[#DFB982]/30">
                  <div className="max-w-2xl mx-auto space-y-3">
                    <span className="text-xs font-bold tracking-[0.25em] text-[#DFB982] uppercase">
                      Personalized Experience
                    </span>
                    <h3 className="font-serif text-2xl sm:text-4xl font-bold text-white leading-tight">
                      {category.ctaTitle || `Looking for Bespoke ${category.name}?`}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-200 leading-relaxed max-w-xl mx-auto">
                      {category.ctaSubtitle ||
                        'Connect directly with our jewellery consultants for live video previews, custom sizing, and wedding bridal set coordination.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                    <a
                      href={category.ctaButtonLink || 'https://wa.me/917302187770'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gradient-to-r from-[#DFB982] via-[#E8C89A] to-[#DFB982] hover:from-[#d4a86b] hover:to-[#c99855] text-[#3B1E22] font-bold text-xs uppercase tracking-widest px-8 py-4 rounded-xl border border-[#D4AF37]/50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center gap-2.5"
                    >
                      <MessageCircle className="w-4 h-4 text-[#802336]" />
                      <span>{category.ctaButtonText || 'Connect on WhatsApp'}</span>
                    </a>

                    <button
                      onClick={() => onNavigate('shop', 'all')}
                      className="bg-white/10 hover:bg-white/20 text-white border border-white/25 backdrop-blur-md font-bold text-xs uppercase tracking-widest px-7 py-4 rounded-xl transition-all duration-300 cursor-pointer shadow-xs"
                    >
                      Browse All Categories
                    </button>
                  </div>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      {/* LIGHTBOX MODAL FOR GALLERY IMAGES */}
      {activeLightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setActiveLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-black rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveLightboxImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={activeLightboxImage.url}
              alt={activeLightboxImage.altText || activeLightboxImage.title}
              className="max-h-[75vh] w-auto object-contain rounded-2xl"
              referrerPolicy="no-referrer"
            />

            {(activeLightboxImage.title || activeLightboxImage.caption) && (
              <div className="w-full bg-black/90 p-4 text-center text-white space-y-1">
                {activeLightboxImage.title && (
                  <h4 className="font-serif text-base font-bold text-[#DFB982]">{activeLightboxImage.title}</h4>
                )}
                {activeLightboxImage.caption && (
                  <p className="text-xs text-gray-300">{activeLightboxImage.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#1C1615] rounded-3xl overflow-hidden shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video Player Area */}
            <div className="relative aspect-video w-full bg-black">
              {getEmbedUrl(activeVideo.videoUrl) ? (
                <iframe
                  src={getEmbedUrl(activeVideo.videoUrl)!}
                  title={activeVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <SeamlessLoopVideo
                  src={activeVideo.videoUrl}
                  poster={activeVideo.thumbnailUrl}
                  title={activeVideo.title}
                  autoPlay={true}
                  isMuted={false}
                  controls={true}
                  enableObserver={false}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Title & Details */}
            <div className="p-6 text-white space-y-2">
              <h3 className="font-serif text-xl font-bold text-[#DFB982]">{activeVideo.title}</h3>
              {activeVideo.description && (
                <p className="text-xs text-gray-300 leading-relaxed">{activeVideo.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
