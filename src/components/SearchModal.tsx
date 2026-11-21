import React, { useState, useMemo } from 'react';
import { X, Search, Star, ArrowRight, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { isGenuineProduct } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';
import {
  JEWELLERY_PLACEHOLDER_IMAGE,
  getProductPrimaryImage,
  useAvailableMediaInventory
} from '../lib/storageService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct
}) => {
  const [queryText, setQueryText] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const mediaInventory = useAvailableMediaInventory();

  const genuineProducts = useMemo(() => {
    return products.filter((p) => isGenuineProduct(p));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = genuineProducts;
    if (selectedTag) {
      if (selectedTag === 'Under ₹1500') {
        list = list.filter((p) => p.price <= 1500);
      } else {
        list = list.filter(
          (p) =>
            p.categoryId.toLowerCase().includes(selectedTag.toLowerCase()) ||
            p.subcategory.toLowerCase().includes(selectedTag.toLowerCase())
        );
      }
    }

    if (!queryText.trim()) {
      return selectedTag ? list.slice(0, 6) : [];
    }

    const q = queryText.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [genuineProducts, queryText, selectedTag]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-[#E8DCCF] flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E8DCCF] flex items-center gap-3 bg-[#FAF7F2]">
          <Search className="w-5 h-5 text-[#802336] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search jewellery by name, kundan, silver 92.5, watches, chokers..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="flex-1 text-sm bg-transparent focus:outline-none text-[#241C1A] placeholder-gray-400"
          />
          {queryText && (
            <button
              onClick={() => setQueryText('')}
              className="p-1 text-gray-400 hover:text-black cursor-pointer text-xs"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:text-black hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-gray-400 text-[11px] uppercase tracking-wider flex-shrink-0">
            Popular:
          </span>
          {['Necklaces', 'Mangalsutra', 'Rings', 'Chokers', 'Temple Jewellery', 'Under ₹1500'].map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full border text-[11px] transition-colors flex-shrink-0 cursor-pointer ${
                selectedTag === tag
                  ? 'bg-[#802336] text-white border-[#802336]'
                  : 'bg-[#FAF7F2] text-gray-700 border-[#E8DCCF] hover:border-[#802336]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              {queryText ? (
                <>
                  <p className="text-sm font-medium text-gray-600">
                    No jewellery pieces found matching "{queryText}"
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try searching for "Choker", "Temple", "Mangalsutra", "Ganesha", or "Polki".
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500">
                  Type a keyword above or select a popular tag to discover pieces.
                </p>
              )}
            </div>
          ) : (
            filteredProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => {
                  onSelectProduct(prod);
                  onClose();
                }}
                className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#FAF7F2] border border-transparent hover:border-[#E8DCCF] cursor-pointer transition-all group"
              >
                <img
                  src={getProductPrimaryImage(prod, mediaInventory)}
                  alt={prod.name}
                  className="w-14 h-14 object-contain p-1 rounded-lg bg-white border border-[#E8DCCF]/60 flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.dataset.fallbackApplied === '1' || img.src.startsWith('data:image/svg+xml')) return;
                    img.dataset.fallbackApplied = '1';
                    img.src = JEWELLERY_PLACEHOLDER_IMAGE;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#802336] uppercase font-semibold">
                      {prod.categoryName}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[10px] text-gray-500">{prod.subcategory}</span>
                  </div>
                  <h4 className="font-serif text-sm font-semibold text-[#241C1A] group-hover:text-[#802336] transition-colors truncate">
                    {prod.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-bold text-[#3B1E22]">
                      {formatPrice(prod.price)}
                    </span>
                    {prod.mrp > prod.price && (
                      <>
                        <span className="text-[10px] text-gray-400 line-through">
                          {formatPrice(prod.mrp)}
                        </span>
                        <span className="text-[9px] bg-[#D4AF37] text-[#3B1E22] font-bold px-1 py-0.2 rounded leading-none">
                          {calculateDiscountPercent(prod.mrp, prod.price)}% OFF
                        </span>
                      </>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-[#B8860B] ml-2">
                      <Star className="w-3 h-3 fill-[#D4AF37] text-[#D4AF37]" />
                      <span>{prod.rating}</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#802336] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
