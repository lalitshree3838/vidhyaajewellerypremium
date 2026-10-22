import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Trash2,
  ArrowRight,
  Sparkles,
  Truck,
  ShieldCheck,
  Tag,
  Check
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { isGenuineImageUrl } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice } from '../lib/priceUtils';

interface CartDrawerProps {
  onCheckout: () => void;
  onViewShop: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onCheckout, onViewShop }) => {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    subtotal,
    originalTotal,
    productSavings,
    discount,
    totalSavings,
    deliveryCharge,
    finalTotal,
    freeDeliveryThreshold,
    freeDeliveryRemaining,
    freeDeliveryProgress,
    appliedPromo,
    applyPromo,
    removePromo
  } = useCart();

  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isCartOpen) return null;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = applyPromo(promoInput);
    if (res.success) {
      setPromoMessage({ text: res.message });
      setPromoInput('');
    } else {
      setPromoMessage({ text: res.message, error: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FAF7F2] shadow-2xl flex flex-col border-l border-[#E8DCCF]">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-[#E8DCCF] flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#802336]" />
              <h2 className="font-serif text-lg font-bold text-[#3B1E22]">
                Your Shopping Bag ({items.reduce((a, b) => a + b.quantity, 0)})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 rounded-full text-gray-500 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Luxury Quality Assurance Bar */}
          <div className="bg-[#FAF7F2] p-2.5 px-5 border-b border-[#E8DCCF] flex items-center justify-between text-xs text-[#0F4C4A]">
            <span className="flex items-center gap-1.5 font-medium">
              <Truck className="w-3.5 h-3.5 text-[#0F4C4A]" />
              <span>Insured Pan-India Express Delivery</span>
            </span>
            <span className="text-[11px] font-semibold text-[#802336] uppercase tracking-wider">
              100% Certified
            </span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#F4EBE1] flex items-center justify-center text-[#802336]">
                  <ShoppingBag className="w-8 h-8 opacity-60" />
                </div>
                <h3 className="font-serif text-xl font-bold text-[#3B1E22]">
                  Your Bag is Empty
                </h3>
                <p className="text-xs text-gray-500 max-w-xs">
                  Discover our certified 92.5 silver, regal gold imitation jewellery, and signature luxury watches.
                </p>
                <button
                  onClick={() => {
                    closeCart();
                    onViewShop();
                  }}
                  className="mt-2 bg-[#802336] text-[#FAF7F2] px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-[#631828] transition-colors cursor-pointer shadow"
                >
                  Explore Collections
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-xl border border-[#E8DCCF] flex gap-3 shadow-xs"
                >
                  {Boolean(item.image && isGenuineImageUrl(item.image)) && (
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="w-20 h-20 object-contain rounded-lg bg-[#FAF7F2] border border-[#E8DCCF]/50 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="font-serif text-sm font-semibold text-[#241C1A] line-clamp-1">
                          {item.productName}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-[#FAF7F2] text-[#802336] font-semibold px-2 py-0.5 rounded border border-[#E8DCCF]">
                          {item.variationName}
                        </span>
                        <span className="text-[10px] text-gray-400">SKU: {item.sku}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
                      <div className="flex items-center border border-[#E8DCCF] rounded-md bg-[#FAF7F2]">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-0.5 text-xs text-[#3B1E22] hover:bg-[#F4EBE1] cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2 py-0.5 text-xs font-bold text-[#3B1E22]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-0.5 text-xs text-[#3B1E22] hover:bg-[#F4EBE1] cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-[#3B1E22]">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                        {item.mrp > item.price && (
                          <div className="flex items-center gap-1 justify-end flex-wrap mt-0.5">
                            <span className="text-[10px] text-gray-400 line-through">
                              {formatPrice(item.mrp * item.quantity)}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded leading-none">
                              Save {formatPrice((item.mrp - item.price) * item.quantity)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer & Checkout Action */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 bg-white border-t border-[#E8DCCF] space-y-3">
              {/* Promo Code Input */}
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Coupon (e.g. VIDHYAA10)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-[#E8DCCF] rounded-lg uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#802336] bg-[#FAF7F2]"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#3B1E22] text-[#FAF7F2] px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#802336] transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </form>

              {appliedPromo && (
                <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 p-2 rounded-lg">
                  <span className="flex items-center gap-1 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Coupon <strong>{appliedPromo}</strong> active
                  </span>
                  <button
                    onClick={removePromo}
                    className="text-red-600 hover:underline text-[11px] font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {promoMessage && (
                <p
                  className={`text-[11px] ${
                    promoMessage.error ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {promoMessage.text}
                </p>
              )}

              {/* Price Calculations */}
              <div className="space-y-1.5 text-xs text-gray-600 pt-1 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span>Original Total (Total MRP)</span>
                  <span className={`font-semibold ${productSavings > 0 ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {formatPrice(originalTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Discounted Product Total</span>
                  <span className="font-semibold text-gray-900">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                {productSavings > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>Product Discount</span>
                    <span>-{formatPrice(productSavings)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>Coupon Savings {appliedPromo ? `(${appliedPromo})` : ''}</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>Shipping Charges</span>
                  <span className="font-semibold text-gray-900">{deliveryCharge > 0 ? formatPrice(deliveryCharge) : 'FREE'}</span>
                </div>

                {/* Prominent You Save Row */}
                {totalSavings > 0 && (
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-emerald-500/5 border border-emerald-300 text-emerald-900 flex items-center justify-between font-bold my-1 shadow-xs">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-950">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      You Save on this Order:
                    </span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {formatPrice(totalSavings)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold text-[#3B1E22] pt-2 border-t border-gray-200">
                  <span>Final Payable Amount</span>
                  <span className="text-base text-[#0F4C4A]">
                    {formatPrice(finalTotal)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => {
                  closeCart();
                  onCheckout();
                }}
                className="w-full btn-teak-green text-white py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-98"
              >
                <span>Proceed to UPI Checkout</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#B8860B]" />
                <span>UPI Fast Checkout • 100% Secure & Encrypted</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
