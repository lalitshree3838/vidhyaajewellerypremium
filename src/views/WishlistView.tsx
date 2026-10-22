import React from 'react';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { Product, ProductVariation } from '../types';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';
import { isGenuineImageUrl } from '../lib/sampleData';

interface WishlistViewProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onNavigateShop: () => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  products,
  onSelectProduct,
  onNavigateShop
}) => {
  const { wishlistIds, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const wishlistedProducts = products.filter((p) => wishlistIds.includes(p.id));

  const handleMoveToCart = (product: Product) => {
    const variationToUse = product.variations?.[0] || {
      id: 'default',
      name: 'Standard',
      colorFinish: 'Default',
      hexCode: '#D4AF37',
      sku: product.id,
      stock: product.stock,
      image: product.images[0],
      active: true
    };
    addToCart(product, variationToUse, 1);
    toggleWishlist(product.id);
  };

  if (wishlistedProducts.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FAF7F2] flex items-center justify-center mx-auto text-[#802336]">
          <Heart className="w-8 h-8 opacity-60" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
          Your Wishlist is Empty
        </h2>
        <p className="text-xs text-gray-500">
          Save your favourite jewellery and timepiece items by clicking the heart icon while browsing.
        </p>
        <button
          onClick={onNavigateShop}
          className="bg-[#3B1E22] text-[#FAF7F2] px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-[#802336] transition-colors cursor-pointer"
        >
          Explore Collections
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[#E8DCCF]">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#241C1A]">
            My Wishlist ({wishlistedProducts.length})
          </h1>
          <p className="text-xs text-gray-500">
            Curated jewellery pieces saved for your future celebrations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {wishlistedProducts.map((prod) => (
          <div
            key={prod.id}
            className="bg-white rounded-2xl border border-[#E8DCCF] overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
          >
            <div
              className="relative aspect-[4/5] bg-[#FAF7F2] cursor-pointer flex items-center justify-center"
              onClick={() => onSelectProduct(prod)}
            >
              {Boolean(prod.images?.[0] && isGenuineImageUrl(prod.images[0])) && (
                <img
                  src={prod.images[0]}
                  alt={prod.name}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWishlist(prod.id);
                }}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-red-600 hover:bg-white shadow cursor-pointer"
                title="Remove from wishlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <span className="text-[10px] text-[#802336] uppercase font-semibold">
                  {prod.categoryName}
                </span>
                <h3
                  onClick={() => onSelectProduct(prod)}
                  className="font-serif text-sm font-bold text-[#241C1A] hover:text-[#802336] transition-colors line-clamp-1 cursor-pointer"
                >
                  {prod.name}
                </h3>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span className="text-sm font-bold text-[#3B1E22]">
                    {formatPrice(prod.price)}
                  </span>
                  {prod.mrp > prod.price && (
                    <>
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(prod.mrp)}
                      </span>
                      <span className="text-[10px] bg-[#D4AF37] text-[#3B1E22] font-bold px-1.5 py-0.5 rounded leading-none">
                        {calculateDiscountPercent(prod.mrp, prod.price)}% OFF
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleMoveToCart(prod)}
                className="w-full btn-teak-green py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-white" />
                <span>Move to Bag</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
