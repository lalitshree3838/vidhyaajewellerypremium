import React, { useState } from 'react';
import { Gem, Sparkles, Star, Plus, Edit, Eye, Filter } from 'lucide-react';
import { Product, ProductVariation } from '../../types';
import { calculateDiscountPercent, formatPrice } from '../../lib/priceUtils';

interface AdminJewelleryPanelProps {
  products: Product[];
  onEditProduct: (product: Product) => void;
  onOpenNewProduct: () => void;
}

export const AdminJewelleryPanel: React.FC<AdminJewelleryPanelProps> = ({
  products,
  onEditProduct,
  onOpenNewProduct
}) => {
  const [selectedSubtype, setSelectedSubtype] = useState<string>('all');

  const typesList = [
    { id: 'all', label: 'All Heirlooms' },
    { id: 'Necklaces', label: 'Necklaces & Chokers' },
    { id: 'Earrings', label: 'Earrings & Jhumkas' },
    { id: 'Rings', label: 'Solitaire & Heritage Rings' },
    { id: 'Watches', label: 'Signature Watches' },
    { id: 'silver', label: 'Certified 92.5 Silver' },
    { id: 'bridal', label: 'Bridal Atelier' },
    { id: 'bangles', label: 'Bangles & Kadas' }
  ];

  const filtered = products.filter((p) => {
    if (selectedSubtype === 'all') return true;
    if (selectedSubtype === 'silver') return p.categoryId === 'silver-925';
    if (selectedSubtype === 'bridal') return p.isFeatured || p.name.toLowerCase().includes('kundan') || p.name.toLowerCase().includes('bridal');
    if (selectedSubtype === 'bangles') return p.subcategory?.toLowerCase().includes('bangle') || p.name.toLowerCase().includes('bangle');
    return p.subcategory?.toLowerCase().includes(selectedSubtype.toLowerCase());
  });

  return (
    <div className="bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-white">
            Fine Jewellery Craftsmanship Management
          </h3>
          <p className="text-xs text-gray-400">
            Curate gold imitation chokers, certified 92.5 sterling silver, oxidised artisan creations, and luxury Swiss watches.
          </p>
        </div>

        <button
          onClick={onOpenNewProduct}
          className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4 text-[#DFB982]" />
          <span>Add Fine Jewellery</span>
        </button>
      </div>

      {/* Subtype Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-800/80">
        {typesList.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedSubtype(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              selectedSubtype === t.id
                ? 'bg-[#0F4C4A] text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Jewellery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((prod) => (
          <div
            key={prod.id}
            className="bg-[#120B0D] border border-gray-800 rounded-2xl overflow-hidden group hover:border-[#DFB982]/50 transition-all flex flex-col"
          >
            <div className="relative aspect-square overflow-hidden bg-black/40 flex items-center justify-center">
              {prod.images?.[0] ? (
                <img
                  src={prod.images[0]}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#1A0E11] text-[#DFB982]">
                  <Sparkles className="w-8 h-8 text-[#DFB982]/50" />
                </div>
              )}
              <span className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-[#DFB982] uppercase border border-[#DFB982]/30">
                {prod.subcategory || prod.categoryName}
              </span>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-serif text-sm font-bold text-white truncate" title={prod.name}>
                  {prod.name}
                </h4>
                <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{prod.material}</p>
                <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                  <span className="text-sm font-bold text-white">
                    {formatPrice(prod.price)}
                  </span>
                  {prod.mrp > prod.price && (
                    <>
                      <span className="text-xs text-gray-500 line-through">
                        {formatPrice(prod.mrp)}
                      </span>
                      <span className="text-[10px] bg-[#DFB982] text-black font-bold px-1.5 py-0.5 rounded">
                        {calculateDiscountPercent(prod.mrp, prod.price)}% OFF
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-xs">
                <span className={`text-[10px] font-semibold ${prod.stock <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  Stock: {prod.stock} units
                </span>
                <button
                  onClick={() => onEditProduct(prod)}
                  className="text-xs text-[#DFB982] hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
