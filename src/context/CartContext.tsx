import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Product, ProductVariation } from '../types';

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
    const imageToUse = variation.image || product.images[0];

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

  // Promo code discounts
  let discount = 0;
  if (appliedPromo === 'VIDHYAA10') {
    discount = Math.round(subtotal * 0.1); // 10% off
  } else if (appliedPromo === 'FESTIVE500' && subtotal >= 2500) {
    discount = 500;
  }

  const totalSavings = productSavings + discount;

  // Fixed shipping charge of ₹100 per order (applied once when items are in cart)
  const deliveryCharge = items.length > 0 ? STANDARD_DELIVERY_CHARGE : 0;
  const finalTotal = items.length > 0 ? Math.max(0, subtotal - discount + deliveryCharge) : 0;

  const freeDeliveryThreshold = 0;
  const freeDeliveryRemaining = 0;
  const freeDeliveryProgress = 100;

  const applyPromo = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === 'VIDHYAA10') {
      setAppliedPromo('VIDHYAA10');
      return { success: true, message: 'Exclusive 10% Patron Discount applied!' };
    }
    if (clean === 'FESTIVE500') {
      if (subtotal < 2500) {
        return { success: false, message: 'Code FESTIVE500 requires minimum cart of ₹2,500' };
      }
      setAppliedPromo('FESTIVE500');
      return { success: true, message: '₹500 Festive Savings applied!' };
    }
    return { success: false, message: 'Invalid or expired promotional code' };
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
