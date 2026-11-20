import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Product, ProductVariation } from '../types';
import { getProductPrimaryImage } from '../lib/storageService';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, variation: ProductVariation, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  subtotal: number;
  originalTotal: number;
  productSavings: number;
  discount: number;
  totalSavings: number;
  deliveryCharge: number;
  finalTotal: number;
  freeDeliveryThreshold: number;
  freeDeliveryRemaining: number;
  freeDeliveryProgress: number;
  appliedPromo: string | null;
  applyPromo: (code: string) => { success: boolean; message: string };
  removePromo: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STANDARD_DELIVERY_CHARGE = 100; // Fixed shipping charge of ₹100 per order

export const CartProvider: React.FC<{ products?: Product[]; children: React.ReactNode }> = ({ products, children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('vidhyaa_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [customCoupons, setCustomCoupons] = useState<
    Array<{
      code: string;
      discountType: 'percentage' | 'fixed';
      discountValue: number;
      minOrderAmount: number;
      active: boolean;
    }>
  >(() => {
    try {
      const raw = localStorage.getItem('vidhyaa_coupons');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const reloadCoupons = () => {
      try {
        const raw = localStorage.getItem('vidhyaa_coupons');
        const parsed = raw ? JSON.parse(raw) : [];
        setCustomCoupons(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCustomCoupons([]);
      }
    };
    window.addEventListener('vidhyaa_coupons_updated', reloadCoupons);
    window.addEventListener('storage', reloadCoupons);
    return () => {
      window.removeEventListener('vidhyaa_coupons_updated', reloadCoupons);
      window.removeEventListener('storage', reloadCoupons);
    };
  }, []);

  // Synchronize cart item prices immediately whenever saved admin product prices change
  useEffect(() => {
    const syncWithCatalog = (catalogProducts: Product[]) => {
      if (!catalogProducts || catalogProducts.length === 0) return;
      setItems((prevItems) => {
        let changed = false;
        const updated = prevItems.map((item) => {
          const prod = catalogProducts.find((p) => p.id === item.productId);
          if (prod) {
            const currentProdPrice = prod.price;
            const currentProdMrp = Math.max(prod.mrp || prod.price, prod.price);
            if (item.price !== currentProdPrice || item.mrp !== currentProdMrp) {
              changed = true;
              return {
                ...item,
                price: currentProdPrice,
                mrp: currentProdMrp
              };
            }
          }
          return item;
        });
        return changed ? updated : prevItems;
      });
    };

    if (products && products.length > 0) {
      syncWithCatalog(products);
    }

    const handleCustomUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        syncWithCatalog(e.detail);
      }
    };

    window.addEventListener('vidhyaa_products_updated', handleCustomUpdate);
    return () => {
      window.removeEventListener('vidhyaa_products_updated', handleCustomUpdate);
    };
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('vidhyaa_cart', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to storage', e);
    }
  }, [items]);

  const addToCart = (product: Product, variation: ProductVariation, quantity: number = 1) => {
    const itemId = `${product.id}_${variation.id}`;
    const priceToUse = product.price;
    const mrpToUse = Math.max(product.mrp || product.price, product.price);
    const imageToUse = getProductPrimaryImage(product, undefined, variation);

    setItems((prev) => {
      const existing = prev.find((item) => item.id === itemId);
      if (existing) {
        return prev.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      const newItem: CartItem = {
        id: itemId,
        productId: product.id,
        productName: product.name,
        variationId: variation.id,
        variationName: variation.name,
        price: priceToUse,
        mrp: mrpToUse,
        quantity,
        image: imageToUse,
        sku: variation.sku,
        material: product.material
      };
      return [...prev, newItem];
    });

    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedPromo(null);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const originalTotal = items.reduce(
    (acc, item) => acc + ((item.mrp && item.mrp > 0 ? item.mrp : item.price) * item.quantity),
    0
  );

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const productSavings = Math.max(0, originalTotal - subtotal);

  const evaluatePromoDiscount = (code: string | null, cartSubtotal: number): { valid: boolean; discountAmount: number; message: string } => {
    if (!code) return { valid: false, discountAmount: 0, message: '' };
    const clean = code.trim().toUpperCase();

    if (clean === 'VIDHYAA10' || clean === 'ROYAL10') {
      return {
        valid: true,
        discountAmount: Math.round(cartSubtotal * 0.1),
        message: 'Exclusive 10% Patron Discount applied!'
      };
    }
    if (clean === 'LIVESTUDIO15') {
      return {
        valid: true,
        discountAmount: Math.round(cartSubtotal * 0.15),
        message: '15% Live Studio Showcase Discount applied!'
      };
    }
    if (clean === 'FESTIVE500') {
      if (cartSubtotal < 2500) {
        return {
          valid: false,
          discountAmount: 0,
          message: 'Code FESTIVE500 requires minimum cart of ₹2,500'
        };
      }
      return {
        valid: true,
        discountAmount: 500,
        message: '₹500 Festive Savings applied!'
      };
    }
    if (clean === 'BRIDALVIP') {
      if (cartSubtotal < 5000) {
        return {
          valid: false,
          discountAmount: 0,
          message: 'Code BRIDALVIP requires minimum cart of ₹5,000'
        };
      }
      return {
        valid: true,
        discountAmount: Math.round(cartSubtotal * 0.15),
        message: '15% Bridal VIP Savings applied!'
      };
    }

    const custom = customCoupons.find(
      (c) => c && c.active !== false && String(c.code || '').trim().toUpperCase() === clean
    );
    if (custom) {
      const minOrder = Number(custom.minOrderAmount || 0);
      if (cartSubtotal < minOrder) {
        return {
          valid: false,
          discountAmount: 0,
          message: `Code ${clean} requires minimum cart of ₹${minOrder.toLocaleString('en-IN')}`
        };
      }
      const val = Number(custom.discountValue || 0);
      const calc =
        custom.discountType === 'percentage'
          ? Math.round((cartSubtotal * val) / 100)
          : Math.round(val);
      return {
        valid: true,
        discountAmount: Math.max(0, calc),
        message: `Promo code ${clean} applied!`
      };
    }

    return { valid: false, discountAmount: 0, message: 'Invalid or expired promotional code' };
  };

  // Promo code discounts (capped at cart subtotal)
  const rawPromoEval = evaluatePromoDiscount(appliedPromo, subtotal);
  const discount = rawPromoEval.valid ? Math.min(subtotal, Math.max(0, rawPromoEval.discountAmount)) : 0;

  const totalSavings = productSavings + discount;

  // Fixed shipping charge of ₹100 per order (applied once when items are in cart)
  const deliveryCharge = items.length > 0 ? STANDARD_DELIVERY_CHARGE : 0;
  const finalTotal = items.length > 0 ? Math.max(0, subtotal - discount + deliveryCharge) : 0;

  const freeDeliveryThreshold = 0;
  const freeDeliveryRemaining = 0;
  const freeDeliveryProgress = 100;

  const applyPromo = (code: string) => {
    const clean = code.trim().toUpperCase();
    const res = evaluatePromoDiscount(clean, subtotal);
    if (res.valid) {
      setAppliedPromo(clean);
      return { success: true, message: res.message };
    }
    return { success: false, message: res.message };
  };

  const removePromo = () => setAppliedPromo(null);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        openCart,
        closeCart,
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
