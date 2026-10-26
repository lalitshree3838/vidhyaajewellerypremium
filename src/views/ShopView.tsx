import React, { useState, useMemo, useEffect } from 'react';
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  Sparkles,
  RotateCcw,
  Star,
  Check
} from 'lucide-react';
import { Product, ProductVariation, Category } from '../types';
import { ProductCard } from '../components/ProductCard';
import { MetadataManager } from '../components/MetadataManager';
import { isGenuineProduct, isGenuineImageUrl } from '../lib/sampleData';
import { filterProductsByNavSlug, getNavHeadingInfo } from '../lib/navigationConfig';

interface ShopViewProps {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
  onSelectProduct: (product: Product) => void;
  onOpenQuickView: (product: Product, variation?: ProductVariation) => void;
}

export const COLLECTION_SLUG_MAP: Record<string, { label: string; keywords: string[]; categoryId?: string }> = {
  // Shop By Category
  'necklaces': { label: 'Necklaces', keywords: ['necklace', 'haar', 'choker'], categoryId: 'necklaces' },
  'necklace': { label: 'Necklaces', keywords: ['necklace', 'haar', 'choker'], categoryId: 'necklaces' },
  'kada-bangles': { label: 'Kada & Bangles', keywords: ['kangan', 'kada', 'bracelet', 'bangles', 'bangle'], categoryId: 'kangan-kada-bracelet' },
  'kangan-kada-bracelet': { label: 'Kada & Bangles', keywords: ['kangan', 'kada', 'bracelet', 'bangles', 'bangle'], categoryId: 'kangan-kada-bracelet' },
  'kangan-kada-and-bracelet': { label: 'Kada & Bangles', keywords: ['kangan', 'kada', 'bracelet', 'bangles', 'bangle'], categoryId: 'kangan-kada-bracelet' },
  'kangan-kada': { label: 'Kada & Bangles', keywords: ['kangan', 'kada', 'bangles', 'bangle'], categoryId: 'kangan-kada-bracelet' },
  'rings': { label: 'Rings', keywords: ['ring'], categoryId: 'rings' },
  'mangalsutra': { label: 'Mangalsutra', keywords: ['mangalsutra', 'sunburst'], categoryId: 'mangalsutra' },
  'devotional-jewellery': { label: 'Devotional Jewellery', keywords: ['ganesha', 'devotional', 'mandala', 'ring'], categoryId: 'devotional-rings' },
  'devotional-rings': { label: 'Devotional Jewellery', keywords: ['ganesha', 'devotional', 'mandala', 'ring'], categoryId: 'devotional-rings' },
  'watches': { label: 'Watches', keywords: ['watch', 'timepiece'], categoryId: 'watches' },
  'oxidised-jewellery': { label: 'Oxidised Jewellery', keywords: ['oxidised', 'oxidise', 'german silver', 'silver'], categoryId: 'oxidised-jewellery' },
  'pendant-sets': { label: 'Necklaces & Pendant Sets', keywords: ['necklace', 'choker', 'rani haar'], categoryId: 'necklaces' },
  'bracelet': { label: 'Bracelets', keywords: ['bracelet', 'cuff', 'kada'], categoryId: 'kangan-kada-bracelet' },
  'bracelets': { label: 'Bracelets', keywords: ['bracelet', 'cuff', 'kada'], categoryId: 'kangan-kada-bracelet' },
  'bangles-bracelets': { label: 'Kada & Bangles', keywords: ['kangan', 'kada', 'bracelet', 'bangles'], categoryId: 'kangan-kada-bracelet' },
  'statement-rings': { label: 'Statement Cocktail Rings', keywords: ['cocktail', 'ring', 'emerald', 'solitaire'], categoryId: 'rings' },
  'other-jewellery': { label: 'Statement Rings', keywords: ['ring'], categoryId: 'rings' },
  'earrings-cuffs': { label: 'Necklace Sets with Matching Earrings', keywords: ['earrings', 'jhumka', 'choker', 'tops'], categoryId: 'necklaces' },
  'earrings-cough': { label: 'Earrings / Cough', keywords: ['earrings', 'jhumka', 'drop', 'tops', 'jhoomki'], categoryId: 'necklaces' },
  'bridal-sets': { label: 'Necklaces & Bridal Choker Sets', keywords: ['choker', 'necklace', 'polki'], categoryId: 'necklaces' },
  'pendants': { label: 'Pendants & Sets', keywords: ['pendant', 'necklace', 'rani haar'], categoryId: 'necklaces' },
  'anklets': { label: 'Anklets & Traditional Payal', keywords: ['anklet', 'payal', 'temple', 'beads', 'jhumkas'], categoryId: 'necklaces' },
  'bangles-kangan': { label: 'Kangan / Kada', keywords: ['kangan', 'kada', 'bangles', 'bangle'], categoryId: 'kangan-kada-bracelet' },
  'bangales-kangan': { label: 'Kangan / Kada', keywords: ['kangan', 'kada', 'bangles', 'bangle'], categoryId: 'kangan-kada-bracelet' },
  'chains': { label: 'Chains & Mangalsutras', keywords: ['chain', 'mangalsutra', 'haar', 'black beads'], categoryId: 'mangalsutra' },
  'oxidise-sets': { label: 'Oxidise Sets', keywords: ['oxidised', 'temple', 'necklace', 'jhumka'], categoryId: 'necklaces' },
  'temple-sets': { label: 'Temple Sets & Heirlooms', keywords: ['temple', 'elephant', 'oxidised'], categoryId: 'necklaces' },
  'polki-kundan': { label: 'Polki Kundan Sets', keywords: ['kundan', 'polki', 'choker', 'navratna'], categoryId: 'necklaces' },

  // Shop By Collection
  'all': { label: 'All Collections', keywords: [] },
  'diamond-necklace-sets': { label: 'American Diamond & Choker Sets', keywords: ['choker', 'kundan', 'necklace'], categoryId: 'necklaces' },
  'diamond-pendant-sets': { label: 'Polki Kundan Sets', keywords: ['kundan', 'polki'], categoryId: 'necklaces' },
  'kundan-polki-necklace-sets': { label: 'Kundan & Polki Necklace Sets', keywords: ['kundan', 'polki', 'choker', 'navratna'], categoryId: 'necklaces' },
  'kundan-polki-pendant-sets': { label: 'Kundan & Polki Sets', keywords: ['kundan', 'polki'], categoryId: 'necklaces' },
  'temple-jewellery-sets': { label: 'Temple Jewellery Sets', keywords: ['temple', 'elephant', 'oxidised'], categoryId: 'necklaces' },
  'gold-finish-jewellery': { label: 'Gold Finish Jewellery', keywords: ['gold', 'choker', 'ring', 'mangalsutra'] },
  'ragwada-collections': { label: 'Rajwada Collections', keywords: ['rajwada', 'polki', 'dome', 'ring'], categoryId: 'rings' },
  'moissanite-collection': { label: 'American Diamond Collection', keywords: ['diamond', 'ad', 'crystal', 'solitaire'] },
  'emerald-jewellery': { label: 'Emerald & Green Stone Jewellery', keywords: ['emerald', 'green'] },
  'ruby-jewellery-collection': { label: 'Pink & Ruby Stone Collection', keywords: ['pink', 'ruby'] },
  'pearl-stone-mala-collection': { label: 'Pearl & Stone Rani Haar', keywords: ['pearl', 'rani haar'] },
  'wedding-guest-jewellery': { label: 'Wedding Collection', keywords: ['choker', 'kundan', 'temple', 'ring'] },
  'festive-jewellery-collection': { label: 'Festive Jewellery Collection', keywords: ['festive', 'choker', 'temple', 'ganesha', 'kundan'] },
  'sangeet-jewellery-collection': { label: 'Cocktail Statement Rings', keywords: ['cocktail', 'ring', 'emerald', 'solitaire'], categoryId: 'rings' },
  'rhodium-plating': { label: 'Rhodium & Micro Gold Plated', keywords: ['gold', 'rhodium'] },
  'choker-sets': { label: 'Choker Sets', keywords: ['choker'], categoryId: 'necklaces' },
  'hasli-sets': { label: 'Temple & Choker Sets', keywords: ['choker', 'temple'], categoryId: 'necklaces' },
  'chain-collection': { label: 'Mangalsutra & Pearl Haar', keywords: ['mangalsutra', 'haar'] },
  '925-silver-jewellery': { label: 'Oxidised Temple Jewellery', keywords: ['temple', 'oxidised'], categoryId: 'necklaces' },
  'anklets-collection': { label: 'Traditional Temple Heirlooms', keywords: ['temple', 'ganesha'] },
};

export const ShopView: React.FC<ShopViewProps> = ({
  products,
  categories,
  initialCategory = 'all',
  onSelectProduct,
  onOpenQuickView
}) => {
  const [navSlug, setNavSlug] = useState<string>(initialCategory || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [selectedFinish, setSelectedFinish] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Available subcategories based on chosen category
  const availableSubcategories = useMemo(() => {
    if (selectedCategory === 'all') {
      const allSubs = new Set<string>();
      products.forEach((p) => {
        if (p.subcategory) allSubs.add(p.subcategory);
      });
      return Array.from(allSubs);
    }
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat ? cat.subcategories : [];
  }, [categories, selectedCategory, products]);

  useEffect(() => {
    if (initialCategory) {
      setNavSlug(initialCategory);
      const paramLower = initialCategory.toLowerCase();
      if (paramLower === 'bestsellers' || paramLower === 'bestseller' || paramLower === 'best-sellers') {
        setSortBy('bestseller');
      } else if (paramLower === 'new' || paramLower === 'new-arrivals') {
        setSortBy('newest');
      } else if (paramLower === 'trending') {
        setSortBy('rating');
      }
    } else {
      setNavSlug('all');
    }
  }, [initialCategory]);

  // Include all authentic catalog products
  const genuineProducts = useMemo(() => {
    return products.filter((p) => isGenuineProduct(p));
  }, [products]);

  // Dynamic materials & finishes derived solely from actual catalog products
  const materials = useMemo(() => {
    const set = new Set<string>();
    genuineProducts.forEach((p) => {
      if (p.material) set.add(p.material);
    });
    return ['all', ...Array.from(set)];
  }, [genuineProducts]);

  const finishes = useMemo(() => {
    const set = new Set<string>();
    genuineProducts.forEach((p) => {
      (p.variations || []).forEach((v) => {
        if (v.colorFinish) set.add(v.colorFinish);
      });
    });
    return ['all', ...Array.from(set)];
  }, [genuineProducts]);

  // Filtered and Sorted products
  const filteredProducts = useMemo(() => {
    let base = genuineProducts;
    if (navSlug && navSlug !== 'all') {
      base = filterProductsByNavSlug(genuineProducts, navSlug);
    }

    return base
      .filter((p) => {
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
          return false;
        }
        if (selectedSubcategory !== 'all') {
          const mapping = COLLECTION_SLUG_MAP[selectedSubcategory.toLowerCase()];
          if (mapping) {
            if (mapping.categoryId && p.categoryId !== mapping.categoryId) return false;
            if (mapping.keywords && mapping.keywords.length > 0) {
              const fullSearchText = `${p.name} ${p.description} ${p.shortDescription || ''} ${p.subcategory || ''} ${p.material} ${p.categoryName || ''}`.toLowerCase();
              const hasMatch = mapping.keywords.some((k) => fullSearchText.includes(k.toLowerCase()));
              if (!hasMatch) return false;
            }
          } else {
            const subLower = selectedSubcategory.toLowerCase();
            const pSubLower = (p.subcategory || '').toLowerCase();
            const pNameLower = p.name.toLowerCase();
            const pDescLower = p.description.toLowerCase();
            const isMatch = pSubLower === subLower || 
                            pSubLower.includes(subLower) || 
                            subLower.includes(pSubLower) ||
                            pNameLower.includes(subLower) ||
                            pDescLower.includes(subLower);
            if (!isMatch) return false;
          }
        }
        if (selectedMaterial !== 'all' && !p.material.toLowerCase().includes(selectedMaterial.toLowerCase().substring(0, 10))) return false;
        if (selectedFinish !== 'all') {
          const hasFinish = (p.variations || []).some(
            (v) => v.colorFinish.toLowerCase().includes(selectedFinish.toLowerCase()) || v.name.toLowerCase().includes(selectedFinish.toLowerCase())
          );
          if (!hasFinish) return false;
        }
        if (inStockOnly && !p.inStock) return false;
        if (minRating > 0 && p.rating < minRating) return false;
        if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'bestseller') return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0);
        return 0; // featured default
      });
  }, [genuineProducts, navSlug, selectedCategory, selectedSubcategory, selectedMaterial, selectedFinish, inStockOnly, minRating, priceRange, sortBy]);

  const resetFilters = () => {
    setNavSlug('all');
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    setSelectedMaterial('all');
    setSelectedFinish('all');
    setInStockOnly(false);
    setMinRating(0);
    setPriceRange([0, 5000]);
    setSortBy('featured');
    window.history.pushState({}, '', '/shop');
  };

  const navInfo = useMemo(() => getNavHeadingInfo(navSlug), [navSlug]);

  const hasActiveFilters =
    (navSlug !== 'all' && navSlug !== '') ||
    selectedCategory !== 'all' ||
    selectedSubcategory !== 'all' ||
    selectedMaterial !== 'all' ||
    selectedFinish !== 'all' ||
    inStockOnly ||
    minRating > 0 ||
    priceRange[0] > 0 ||
    priceRange[1] < 5000;

  const activeCatObj = categories.find((c) => c.id === selectedCategory);
  const pageTitle = navSlug === 'all'
    ? 'All Handcrafted Jewellery & Watches Collection'
    : `${navInfo.title} Collection`;
  const pageDesc = navSlug === 'all'
    ? 'Explore exclusive 24K gold plated chokers, 92.5 sterling silver, luxury timepiece watches, and oxidised tribal jewellery with insured pan-India express delivery.'
    : navInfo.subtitle;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Dynamic SEO Head Title & Metadata for Category/Shop via react-helmet-async */}
      <MetadataManager
        title={pageTitle}
        description={pageDesc}
        image={activeCatObj?.image}
        categoryName={navInfo.title || activeCatObj?.name || 'All Jewellery'}
      />

      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
          <span>Home</span>
          <span>/</span>
          <span className="text-[#802336] font-medium">{navInfo.isCategory ? 'Category' : 'Collections'}</span>
          {navSlug !== 'all' && (
            <>
              <span>/</span>
              <span className="font-semibold text-gray-800">{navInfo.title}</span>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              {navSlug === 'all' ? 'All Handcrafted Jewellery' : navInfo.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
              {pageDesc}
            </p>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-[#E8DCCF] text-xs font-semibold text-[#3B1E22] cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#802336]" />
              <span>Filters {hasActiveFilters && '• Active'}</span>
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 hidden sm:inline">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs font-semibold text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336] cursor-pointer shadow-xs"
              >
                <option value="featured">Featured Collection</option>
                <option value="bestseller">Best Selling</option>
                <option value="newest">New Arrivals</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Filters Sidebar + Products Grid */}
      <div className="flex gap-8 items-start">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block w-64 bg-white p-5 rounded-2xl border border-[#E8DCCF] space-y-6 flex-shrink-0 shadow-xs sticky top-28">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8DCCF]">
            <h3 className="font-serif text-base font-bold text-[#3B1E22] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#802336]" />
              Filter Jewellery
            </h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-[11px] text-[#802336] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {/* Categories Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Category
            </h4>
            <div className="space-y-1 text-xs">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedSubcategory('all');
                }}
                className={`w-full text-left py-1 px-2 rounded-md transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#802336] text-white font-semibold'
                    : 'text-gray-700 hover:bg-[#FAF7F2]'
                }`}
              >
                All Categories ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCategory(c.id);
                    setSelectedSubcategory('all');
                  }}
                  className={`w-full text-left py-1 px-2 rounded-md transition-colors cursor-pointer ${
                    selectedCategory === c.id
                      ? 'bg-[#802336] text-white font-semibold'
                      : 'text-gray-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subcategories Filter */}
          {availableSubcategories.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Style / Subcategory
              </h4>
              <div className="space-y-1 text-xs max-h-40 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedSubcategory('all')}
                  className={`w-full text-left py-1 px-2 rounded-md transition-colors cursor-pointer ${
                    selectedSubcategory === 'all'
                      ? 'bg-[#F4EBE1] text-[#802336] font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Styles
                </button>
                {availableSubcategories.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubcategory(sub)}
                    className={`w-full text-left py-1 px-2 rounded-md transition-colors cursor-pointer ${
                      selectedSubcategory === sub
                        ? 'bg-[#F4EBE1] text-[#802336] font-bold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Finish / Color Filter */}
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Finish / Color
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {finishes.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFinish(f)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                    selectedFinish === f
                      ? 'bg-[#3B1E22] text-[#DFB982] border-[#3B1E22]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#802336]'
                  }`}
                >
                  {f === 'all' ? 'All Finishes' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Slider */}
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center text-xs">
              <h4 className="font-bold text-gray-700 uppercase tracking-wider">
                Price (INR)
              </h4>
              <span className="font-semibold text-[#802336]">
                ₹{priceRange[0]} - ₹{priceRange[1]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5000}
              step={50}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
              className="w-full accent-[#802336] cursor-pointer"
            />
          </div>

          {/* In Stock & Rating Toggles */}
          <div className="space-y-3 pt-3 border-t border-gray-100 text-xs">
            <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded accent-[#802336]"
              />
              <span className="font-medium">In Stock Only</span>
            </label>

            <div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Minimum Rating
              </span>
              <div className="flex items-center gap-1">
                {[0, 4, 4.5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(r)}
                    className={`px-2 py-1 rounded text-xs border cursor-pointer ${
                      minRating === r
                        ? 'bg-[#FAF7F2] border-[#802336] text-[#802336] font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {r === 0 ? 'All' : `${r}★+`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Products Grid & Active Filter Pills */}
        <div className="flex-1 min-w-0">
          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-[#E8DCCF]">
              <span className="text-xs text-gray-400">Active Filters:</span>
              {navSlug !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-white border border-[#E8DCCF] text-[#802336] text-xs px-2.5 py-0.5 rounded-full font-medium shadow-xs">
                  <span>{navInfo.title}</span>
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-black"
                    onClick={() => {
                      setNavSlug('all');
                      window.history.pushState({}, '', '/shop');
                    }}
                  />
                </span>
              )}
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-white border border-[#E8DCCF] text-[#802336] text-xs px-2.5 py-0.5 rounded-full font-medium shadow-xs">
                  {categories.find((c) => c.id === selectedCategory)?.name}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedCategory('all')}
                  />
                </span>
              )}
              {selectedSubcategory !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-white border border-[#E8DCCF] text-[#802336] text-xs px-2.5 py-0.5 rounded-full font-medium shadow-xs">
                  {selectedSubcategory}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedSubcategory('all')}
                  />
                </span>
              )}
              {selectedFinish !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-white border border-[#E8DCCF] text-[#802336] text-xs px-2.5 py-0.5 rounded-full font-medium shadow-xs">
                  Finish: {selectedFinish}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedFinish('all')}
                  />
                </span>
              )}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1 bg-white border border-[#E8DCCF] text-[#802336] text-xs px-2.5 py-0.5 rounded-full font-medium shadow-xs">
                  In Stock Only
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setInStockOnly(false)} />
                </span>
              )}
              <button
                onClick={resetFilters}
                className="text-xs text-[#802336] font-semibold underline hover:text-black ml-1 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Product Count */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
            <span>
              Showing <strong>{filteredProducts.length}</strong> handcrafted jewellery pieces
            </span>
          </div>

          {/* Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DCCF] p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#0F5B46]/10 flex items-center justify-center mx-auto text-[#0F5B46]">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#241C1A]">
                {navSlug && navSlug !== 'all'
                  ? `No products available in this ${navInfo.isCategory ? 'category' : 'collection'} yet`
                  : 'No Jewellery Found Matching Filters'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                {navSlug && navSlug !== 'all'
                  ? `New handcrafted designs for ${navInfo.title} are currently being crafted in our Roorkee, District Haridwar atelier. Connect directly with our jewellery concierge on WhatsApp (+91 7302187770) for personalized bespoke orders, or explore our complete jewellery catalogue.`
                  : 'Try widening your price range, clearing specific color finishes, or choosing a different category.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={resetFilters}
                  className="btn-teak-green px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer shadow-sm hover:opacity-95"
                >
                  Explore All Jewellery
                </button>
                <a
                  href="https://wa.me/917302187770"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-teak-green-outline px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
                >
                  Inquire on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onSelectProduct={onSelectProduct}
                  onOpenQuickView={onOpenQuickView}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-xs bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DCCF]">
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                Filters
              </h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Category List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Categories
              </h4>
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSubcategory('all');
                  }}
                  className={`w-full text-left py-1.5 px-2 rounded ${
                    selectedCategory === 'all' ? 'bg-[#802336] text-white font-bold' : 'text-gray-700'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCategory(c.id);
                      setSelectedSubcategory('all');
                    }}
                    className={`w-full text-left py-1.5 px-2 rounded ${
                      selectedCategory === c.id ? 'bg-[#802336] text-white font-bold' : 'text-gray-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Finishes */}
            <div className="space-y-2 pt-3 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Color / Finish
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {finishes.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFinish(f)}
                    className={`px-2.5 py-1 rounded-full text-[11px] border ${
                      selectedFinish === f
                        ? 'bg-[#3B1E22] text-[#DFB982]'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Price */}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex justify-between text-xs">
                <span className="font-bold">Max Price</span>
                <span className="text-[#802336] font-bold">₹{priceRange[1]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                className="w-full accent-[#802336]"
              />
            </div>

            <div className="pt-4 border-t flex gap-2">
              <button
                onClick={resetFilters}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700"
              >
                Reset
              </button>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 py-2.5 bg-[#3B2F2A] hover:bg-[#4D3E37] text-white rounded-xl text-xs font-semibold uppercase tracking-wider shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
