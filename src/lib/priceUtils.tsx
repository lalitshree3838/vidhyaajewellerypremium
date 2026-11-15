import React from 'react';

/**
 * Format a number into Indian Rupees currency format e.g. ₹1,49,999 or ₹1,499
 */
export function formatPrice(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Calculate the discount percentage according to the formula:
 * discountPercent = ((MRP - sellingPrice) / MRP) * 100
 * Returns 0 if MRP <= sellingPrice or if MRP is non-positive.
 */
export function calculateDiscountPercent(mrp: number | undefined | null, sellingPrice: number | undefined | null): number {
  if (!mrp || !sellingPrice || mrp <= 0) return 0;
  if (sellingPrice >= mrp) return 0;
  const pct = Math.round(((mrp - sellingPrice) / mrp) * 100);
  return pct > 0 ? pct : 0;
}

/**
 * Validates that prices are non-negative and selling price does not exceed MRP.
 */
export function validatePrices(
  mrp: number,
  sellingPrice: number
): { valid: boolean; error?: string } {
  if (isNaN(mrp) || isNaN(sellingPrice)) {
    return { valid: false, error: 'Prices must be valid numbers.' };
  }
  if (mrp < 0 || sellingPrice < 0) {
    return { valid: false, error: 'Prices must be non-negative.' };
  }
  if (sellingPrice > mrp) {
    return {
      valid: false,
      error: `Selling price (${formatPrice(sellingPrice)}) cannot exceed Original MRP (${formatPrice(mrp)}).`
    };
  }
  return { valid: true };
}

interface PriceDisplayProps {
  sellingPrice: number;
  mrp?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  showSavingsText?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
  badgeClassName?: string;
}

/**
 * Standard Price Display Component
 * - Shows discounted selling price prominently next to the MRP
 * - Shows original MRP in Indian Rupees (₹) with a strikethrough when MRP > sellingPrice
 * - Shows discount badge like "40% OFF" when sellingPrice < MRP
 * - If MRP and sellingPrice are equal, hides discount badge and strikethrough
 */
export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  sellingPrice,
  mrp,
  size = 'md',
  showBadge = true,
  showSavingsText = false,
  theme = 'light',
  className = '',
  badgeClassName = ''
}) => {
  const effectiveMrp = mrp !== undefined && mrp > 0 ? mrp : sellingPrice;
  const hasDiscount = effectiveMrp > sellingPrice;
  const discountPercent = hasDiscount ? calculateDiscountPercent(effectiveMrp, sellingPrice) : 0;
  const savings = hasDiscount ? effectiveMrp - sellingPrice : 0;

  // Typography size maps
  const priceClasses = {
    xs: 'text-xs font-bold',
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold font-serif',
    xl: 'text-3xl font-bold font-serif'
  }[size];

  const mrpClasses = {
    xs: 'text-[10px] text-gray-400 line-through',
    sm: 'text-xs text-gray-400 line-through',
    md: 'text-xs text-gray-400 line-through',
    lg: 'text-sm text-gray-400 line-through',
    xl: 'text-base text-gray-400 line-through'
  }[size];

  const badgeSizeClasses = {
    xs: 'text-[9px] px-1 py-0.2',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2 py-0.5',
    xl: 'text-xs px-2.5 py-1'
  }[size];

  const priceColor = theme === 'dark' ? 'text-white' : 'text-[#241C1A]';

  return (
    <div className={`inline-flex items-baseline flex-wrap gap-2 ${className}`}>
      {/* Prominent Discounted Selling Price */}
      <span className={`${priceClasses} ${priceColor}`}>
        {formatPrice(sellingPrice)}
      </span>

      {/* Original MRP with strikethrough (only when MRP > sellingPrice) */}
      {hasDiscount && (
        <span className={mrpClasses} title={`Original MRP: ${formatPrice(effectiveMrp)}`}>
          {formatPrice(effectiveMrp)}
        </span>
      )}

      {/* Discount Badge (only when MRP > sellingPrice) */}
      {hasDiscount && showBadge && discountPercent > 0 && (
        <span
          className={`font-bold uppercase tracking-wider rounded shadow-xs ${
            theme === 'dark'
              ? 'bg-[#DFB982] text-[#120B0D]'
              : 'bg-[#D4AF37] text-[#3B1E22]'
          } ${badgeSizeClasses} ${badgeClassName}`}
        >
          {discountPercent}% OFF
        </span>
      )}

      {/* Optional savings text e.g. Save ₹500 */}
      {hasDiscount && showSavingsText && savings > 0 && (
        <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          Save {formatPrice(savings)}
        </span>
      )}
    </div>
  );
};

export interface CartCalculationResult {
  originalTotal: number; // Sum of (MRP * quantity)
  subtotal: number; // Discounted product total = Sum of (Selling Price * quantity)
  productDiscount: number; // Total product discount across all items
  couponDiscount: number; // Additional discount from applied coupon
  totalSavings: number; // productDiscount + couponDiscount
  deliveryCharge: number; // Shipping charge
  tax: number; // Applicable taxes (0 if tax included)
  finalPayable: number; // subtotal - couponDiscount + deliveryCharge + tax
}

/**
 * Calculates cart totals and savings across multiple items and quantities.
 * Formula:
 * - Product Savings = Sum of [(MRP - Selling Price) * Quantity]
 * - Total Savings = Product Savings + Additional Coupon Discounts
 * - Final Payable = Discounted Product Total + Shipping Charges + Taxes - Coupon Discount
 */
export function calculateCartBreakdown(
  items: Array<{ price: number; mrp?: number; quantity: number }>,
  couponDiscount: number = 0,
  shippingCharge: number = 0,
  tax: number = 0
): CartCalculationResult {
  const originalTotal = items.reduce((acc, item) => {
    const effectiveMrp = item.mrp && item.mrp > 0 ? item.mrp : item.price;
    return acc + effectiveMrp * (item.quantity || 1);
  }, 0);

  const subtotal = items.reduce((acc, item) => {
    return acc + (item.price || 0) * (item.quantity || 1);
  }, 0);

  const productDiscount = Math.max(0, originalTotal - subtotal);
  const totalSavings = productDiscount + couponDiscount;
  const finalPayable = items.length > 0
    ? Math.max(0, subtotal - couponDiscount + shippingCharge + tax)
    : 0;

  return {
    originalTotal,
    subtotal,
    productDiscount,
    couponDiscount,
    totalSavings,
    deliveryCharge: shippingCharge,
    tax,
    finalPayable
  };
}

interface OrderSavingsSummaryCardProps {
  originalTotal: number;
  subtotal: number;
  productDiscount?: number;
  couponDiscount?: number;
  totalSavings?: number;
  deliveryCharge?: number;
  tax?: number;
  finalPayable: number;
  isCompletedOrder?: boolean;
  appliedPromo?: string | null;
  className?: string;
}

/**
 * Prominent Order & Payment Summary component displaying exact customer savings,
 * strikethrough original MRP, item discounts, shipping charges, and final payable amount.
 */
export const OrderSavingsSummaryCard: React.FC<OrderSavingsSummaryCardProps> = ({
  originalTotal,
  subtotal,
  productDiscount = Math.max(0, originalTotal - subtotal),
  couponDiscount = 0,
  totalSavings = productDiscount + couponDiscount,
  deliveryCharge = 0,
  tax = 0,
  finalPayable,
  isCompletedOrder = false,
  appliedPromo,
  className = ''
}) => {
  const hasSavings = totalSavings > 0;

  return (
    <div className={`rounded-2xl border border-[#E8DCCF] bg-[#FAF7F2] p-4 sm:p-5 space-y-3.5 ${className}`}>
      <div className="flex items-center justify-between pb-2.5 border-b border-[#E8DCCF]">
        <h4 className="font-serif text-sm sm:text-base font-bold text-[#3B1E22]">
          {isCompletedOrder ? 'Order Payment Breakdown' : 'Order & Payment Summary'}
        </h4>
        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          All Prices in INR (₹)
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {/* 1. Original MRP Total (with strikethrough if discounted) */}
        <div className="flex justify-between items-center text-gray-600">
          <span>Original Total (Total MRP)</span>
          <span className={`font-semibold ${productDiscount > 0 ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {formatPrice(originalTotal)}
          </span>
        </div>

        {/* 2. Discounted Product Subtotal */}
        <div className="flex justify-between items-center text-gray-600">
          <span>Discounted Product Total</span>
          <span className="font-semibold text-gray-900">
            {formatPrice(subtotal)}
          </span>
        </div>

        {/* 3. Product Discount (if any) */}
        {productDiscount > 0 && (
          <div className="flex justify-between items-center text-emerald-700 font-medium">
            <span>Product Discount (Catalog Savings)</span>
            <span>-{formatPrice(productDiscount)}</span>
          </div>
        )}

        {/* 4. Applied Promo Coupon Discount (if any) */}
        {couponDiscount > 0 && (
          <div className="flex justify-between items-center text-emerald-700 font-medium">
            <span>
              Promo Code Savings {appliedPromo ? `(${appliedPromo})` : ''}
            </span>
            <span>-{formatPrice(couponDiscount)}</span>
          </div>
        )}

        {/* 5. Total Discount row if both product and coupon exist */}
        {productDiscount > 0 && couponDiscount > 0 && (
          <div className="flex justify-between items-center text-emerald-800 font-semibold pt-1 border-t border-dashed border-[#E8DCCF]">
            <span>Total Discount Applied</span>
            <span>-{formatPrice(productDiscount + couponDiscount)}</span>
          </div>
        )}

        {/* 6. Shipping / Delivery Charges */}
        <div className="flex justify-between items-center text-gray-600">
          <span>Delivery & Express Shipping</span>
          <span className="font-semibold text-gray-900">
            {deliveryCharge > 0 ? formatPrice(deliveryCharge) : 'FREE'}
          </span>
        </div>

        {/* 7. Taxes if any */}
        {tax > 0 && (
          <div className="flex justify-between items-center text-gray-600">
            <span>Applicable Taxes (GST)</span>
            <span className="font-semibold text-gray-900">{formatPrice(tax)}</span>
          </div>
        )}

        {/* 8. PROMINENT "YOU SAVE ₹X" ROW IN VIBRANT GREEN */}
        {hasSavings && (
          <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-emerald-500/5 border border-emerald-300 text-emerald-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-xs text-emerald-950">
                {isCompletedOrder ? 'You Saved on this Order' : 'You Save on this Order'}
              </span>
            </div>
            <span className="font-serif text-base sm:text-lg font-extrabold text-emerald-700">
              {formatPrice(totalSavings)}
            </span>
          </div>
        )}

        {/* 9. Final Payable Amount */}
        <div className="flex justify-between items-center pt-3 border-t-2 border-[#E8DCCF]">
          <div>
            <span className="text-sm font-bold text-[#3B1E22] block">
              Final Payable Amount
            </span>
            <span className="text-[10px] text-gray-500">
              Inclusive of all taxes & insurance
            </span>
          </div>
          <span className="font-serif text-xl sm:text-2xl font-extrabold text-[#0F4C4A]">
            {formatPrice(finalPayable)}
          </span>
        </div>
      </div>
    </div>
  );
};
