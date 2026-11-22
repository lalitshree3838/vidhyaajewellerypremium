import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  CheckCircle,
  Truck,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  Smartphone,
  AlertCircle,
  Package,
  ShoppingBag,
  Sparkles,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  CreditCard,
  Lock,
  Loader2,
  Gift,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Address, Order, OrderItem, StoreSettings } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  createOrder,
  fetchOrderById,
  syncOrderToLocalAndFirestore,
  isOrderPaid,
  formatIndianPhone,
  formatFullAddress,
  saveOrderReceiptToken,
  getOrderReceiptToken,
  getCustomerAuthToken
} from '../lib/dbService';
import { auth } from '../lib/firebase';
import { GooglePayQRCard } from '../components/GooglePayQRCard';
import {
  JEWELLERY_PLACEHOLDER_IMAGE,
  resolveSafeProductImageUrl,
  useAvailableMediaInventory
} from '../lib/storageService';
import { formatPrice, OrderSavingsSummaryCard } from '../lib/priceUtils';

const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

const DRAFT_ORDER_KEY = 'vidhyaa_draft_order_number';
const COMPLETED_ORDER_KEY = 'vidhyaa_completed_order_id';
const CHECKOUT_DRAFT_FORM_KEY = 'vidhyaa_checkout_draft_form';
const PENDING_CASHFREE_ORDER_KEY = 'vidhyaa_pending_cf_order';

type CheckoutPaymentOption = 'upi' | 'cc' | 'dc' | 'manual_qr';

interface PendingCashfreeSession {
  orderId: string;
  orderNumber: string;
  paymentChannel: 'upi' | 'cc' | 'dc';
  createdAt: number;
}

function extractIndianMobile10(raw?: string | null): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function isValidIndianMobile10(raw?: string | null): boolean {
  const digits = extractIndianMobile10(raw);
  return /^[6-9]\d{9}$/.test(digits);
}

function loadCheckoutDraftForm(): Record<string, any> {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_FORM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePendingCashfreeSession(session: PendingCashfreeSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(PENDING_CASHFREE_ORDER_KEY);
    } else {
      sessionStorage.setItem(PENDING_CASHFREE_ORDER_KEY, JSON.stringify(session));
    }
  } catch {}
}

function loadPendingCashfreeSession(): PendingCashfreeSession | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CASHFREE_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.orderId !== 'string' || !parsed.orderId.trim()) return null;
    // Ignore stale sessions older than 2 hours
    if (typeof parsed.createdAt === 'number' && Date.now() - parsed.createdAt > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_CASHFREE_ORDER_KEY);
      return null;
    }
    return parsed as PendingCashfreeSession;
  } catch {
    return null;
  }
}

function getOrCreateDraftOrderNumber(): string {
  try {
    const existing = sessionStorage.getItem(DRAFT_ORDER_KEY);
    if (existing && /^VDH-\d{6,}$/.test(existing)) return existing;
    const next = `VDH-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    sessionStorage.setItem(DRAFT_ORDER_KEY, next);
    return next;
  } catch {
    return `VDH-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
  }
}

function rotateDraftOrderNumber(): string {
  const next = `VDH-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
  try {
    sessionStorage.setItem(DRAFT_ORDER_KEY, next);
  } catch {}
  return next;
}

async function resolveCheckoutCustomerHeaders(orderKeys: Array<string | undefined>): Promise<Record<string, string>> {
  let receiptTok = '';
  for (const key of orderKeys) {
    if (key) {
      const found = getOrderReceiptToken(key);
      if (found) {
        receiptTok = found;
        break;
      }
    }
  }

  let customerTok = '';
  try {
    const patronTok =
      typeof localStorage !== 'undefined' ? localStorage.getItem('vidhyaa_patron_token') || '' : '';
    const hasPatronSession =
      typeof localStorage !== 'undefined' ? Boolean(localStorage.getItem('vidhyaa_patron_session')) : false;
    if (patronTok && hasPatronSession) {
      customerTok = patronTok;
    } else if (auth?.currentUser) {
      customerTok = await auth.currentUser.getIdToken().catch(() => '');
    }
    if (!customerTok) {
      customerTok = patronTok || (await getCustomerAuthToken().catch(() => ''));
    }
  } catch {
    customerTok = await getCustomerAuthToken().catch(() => '');
  }

  return {
    ...(receiptTok ? { 'x-order-token': receiptTok } : {}),
    ...(customerTok ? { Authorization: `Bearer ${customerTok}`, 'x-customer-token': customerTok } : {})
  };
}

function formatOrderDateIST(isoDate?: string): string {
  try {
    return new Date(isoDate || Date.now()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Just now';
  }
}

interface VerifiedPaymentSuccessViewProps {
  order: Order;
  onViewMyOrders: () => void;
  onTrackOrder: (orderNumber: string) => void;
  onContinueShopping: () => void;
}

const VerifiedPaymentSuccessView: React.FC<VerifiedPaymentSuccessViewProps> = ({
  order,
  onViewMyOrders,
  onTrackOrder,
  onContinueShopping
}) => {
  const mediaInventory = useAvailableMediaInventory();
  const orderId = order.orderNumber || order.id;
  const orderDateTime = formatOrderDateIST(order.paidAt || order.createdAt);
  const customerName = order.customerName || order.shippingAddress?.name || 'Valued Patron';
  const customerMobile = formatIndianPhone(order.customerPhone || order.shippingAddress?.phone) || 'N/A';
  const customerEmail = order.customerEmail || 'Not Provided';
  const fullAddress = formatFullAddress(order.shippingAddress) || 'Delivery address recorded';
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : Number(order.totalAmount || 0);
  const discount = typeof order.discount === 'number' ? order.discount : 0;
  const deliveryCharge = typeof order.deliveryCharge === 'number' ? order.deliveryCharge : 0;
  const totalAmount = typeof order.totalAmount === 'number' ? order.totalAmount : subtotal;
  const transactionId =
    order.paymentId ||
    order.upiReference ||
    (order.cfOrderId ? String(order.cfOrderId) : '') ||
    order.gatewayOrderId ||
    orderId;
  const paymentMethod = order.paymentMethod || 'Online Payment (Cashfree)';

  const whatsappReceiptMsg =
    `Vidhyaa Jewellery Studio - Order Receipt\n` +
    `Order ID: ${orderId}\n` +
    `Amount Paid: ₹${totalAmount.toLocaleString('en-IN')}\n` +
    `Transaction ID: ${transactionId}\n` +
    `Customer: ${customerName} (${customerMobile})`;
  const whatsappUrl = `https://wa.me/917302187770?text=${encodeURIComponent(whatsappReceiptMsg)}`;

  return (
    <div
      data-testid="payment-success-screen"
      className="bg-white rounded-3xl border-2 border-emerald-300 p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-fadeIn max-w-3xl mx-auto"
    >
      {/* Premium Animated Celebration Header */}
      <div className="space-y-4">
        <div className="relative mx-auto w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-500 flex items-center justify-center shadow-lg">
          <CheckCircle className="w-11 h-11 text-emerald-700" strokeWidth={2.5} />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#D4AF37] text-[#3B1E22] flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border-2 border-emerald-500 text-emerald-800 px-6 py-2.5 rounded-2xl shadow-sm">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-wide">
                ✓ PAYMENT DONE
              </span>
            </div>
            <div className="inline-flex items-center gap-2 bg-emerald-700 text-white px-6 py-2 rounded-2xl shadow-md">
              <span className="text-xl sm:text-2xl font-extrabold tracking-wider">
                ✓ ORDER CONFIRMED
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto pt-2 leading-relaxed">
            Thank you, <strong className="text-[#3B1E22]">{customerName}</strong>! Your payment of{' '}
            <strong className="text-emerald-800">₹{totalAmount.toLocaleString('en-IN')}</strong> has been verified. Your handcrafted heirloom pieces are confirmed and scheduled for royal packaging at our Roorkee atelier.
          </p>
        </div>
      </div>

      {/* Key Payment & Order Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-2xl mx-auto">
        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Order ID
          </span>
          <span className="font-mono text-xs sm:text-sm font-extrabold text-[#3B1E22] break-all">
            {orderId}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Amount Paid
          </span>
          <span className="font-serif text-base sm:text-lg font-extrabold text-emerald-900">
            ₹{totalAmount.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Payment Method
          </span>
          <span className="text-xs font-bold text-[#3B1E22] line-clamp-2">
            {paymentMethod}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8DCCF]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Order Date & Time
          </span>
          <span className="text-[11px] font-semibold text-gray-800 block">
            {orderDateTime}
          </span>
        </div>
      </div>

      {/* Complete Order Receipt Card */}
      <div className="max-w-2xl mx-auto bg-[#FAF7F2] p-5 sm:p-6 rounded-2xl border border-[#E8DCCF] text-left space-y-4 text-xs shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-[#E8DCCF]">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Patron Details
            </span>
            <p className="font-bold text-[#3B1E22] text-sm">{customerName}</p>
            <p className="text-gray-700 font-mono">{customerMobile}</p>
            <p className="text-gray-600 break-all">{customerEmail}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Delivery Address
            </span>
            <p className="text-gray-800 font-medium leading-relaxed">{fullAddress}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[#E8DCCF]">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Payment Transaction ID
            </span>
            <span className="font-mono font-bold text-gray-900 break-all block">{transactionId}</span>
            {order.bankReference && order.bankReference !== transactionId && (
              <span className="font-mono text-[11px] text-gray-600 block">
                Bank / UPI Ref: <strong>{order.bankReference}</strong>
              </span>
            )}
          </div>
          <div className="sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Verification Status
            </span>
            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Paid • {order.orderStatus || 'Confirmed'}
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Confirmed Jewellery Pieces ({items.reduce((acc, it) => acc + (it.quantity || 1), 0)})
            </span>
            <div className="divide-y divide-[#E8DCCF]/70 bg-white rounded-xl border border-[#E8DCCF] px-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={resolveSafeProductImageUrl(item.image, mediaInventory)}
                      alt={item.productName}
                      className="w-11 h-11 rounded-lg object-contain border border-[#E8DCCF] bg-white shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === '1' || img.src.startsWith('data:image/svg+xml')) return;
                        img.dataset.fallbackApplied = '1';
                        img.src = JEWELLERY_PLACEHOLDER_IMAGE;
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-serif font-semibold text-[#3B1E22] truncate">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {item.variationName ? `${item.variationName} • ` : ''}Qty: {item.quantity || 1}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-[#3B1E22] shrink-0">
                    ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-semibold">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Discount Applied</span>
              <span>-₹{discount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Shipping Charges</span>
            <span className="font-semibold">
              {deliveryCharge > 0 ? `₹${deliveryCharge.toLocaleString('en-IN')}` : 'FREE (Royal Atelier Delivery)'}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold text-[#3B1E22] pt-2 border-t border-[#E8DCCF]">
            <span>Final Paid Amount</span>
            <span className="text-emerald-800 text-base">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Primary CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onViewMyOrders}
          className="w-full sm:w-auto bg-[#0F5B46] hover:bg-[#0A3D2F] text-white px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4 text-[#DFB982]" />
          <span>View My Order</span>
        </button>

        <button
          type="button"
          onClick={onContinueShopping}
          className="w-full sm:w-auto bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md"
        >
          Continue Shopping
        </button>

        <button
          type="button"
          onClick={() => onTrackOrder(orderId)}
          className="w-full sm:w-auto bg-white border border-[#E8DCCF] hover:bg-[#FAF7F2] text-[#3B1E22] px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Truck className="w-4 h-4 text-[#802336]" />
          <span>Track Shipment</span>
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Atelier Concierge</span>
        </a>
      </div>
    </div>
  );
};

interface WhatsAppOrderConfirmationViewProps {
  order: Order;
  onViewMyOrders: () => void;
  onTrackOrder: (orderNumber: string) => void;
  onContinueShopping: () => void;
}

const WhatsAppOrderConfirmationView: React.FC<WhatsAppOrderConfirmationViewProps> = ({
  order,
  onViewMyOrders,
  onTrackOrder,
  onContinueShopping
}) => {
  const [isConfirmed, setIsConfirmed] = useState<boolean>(
    Boolean(order?.whatsappCustomerConfirmed)
  );
  const [hasClickedWhatsApp, setHasClickedWhatsApp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullReceipt, setShowFullReceipt] = useState(false);

  const orderId = order?.orderNumber || order?.id || 'N/A';
  const orderDateTime = formatOrderDateIST(order?.createdAt);
  const customerName = order?.customerName || order?.shippingAddress?.name || 'Valued Patron';
  const customerMobile = formatIndianPhone(order?.customerPhone || order?.shippingAddress?.phone) || 'N/A';
  const customerEmail = order?.customerEmail || 'Not Provided';
  const address = formatFullAddress(order?.shippingAddress) || 'Delivery address provided at checkout';

  const items = Array.isArray(order?.items) ? order.items : [];
  const totalFallback = Number(order?.totalAmount || (order as any)?.total || 0);
  const itemsFormatted =
    items.length > 0
      ? items
          .map((item, idx) => {
            const itemName = item.productName || (item as any).title || 'Handcrafted Jewellery';
            const qty = item.quantity || 1;
            const price = typeof item.price === 'number' ? item.price : Number(item.price) || 0;
            return `${idx + 1}. ${itemName}\n   Qty: ${qty} | Price: ₹${price.toLocaleString('en-IN')}`;
          })
          .join('\n')
      : `1. Handcrafted Jewellery (Qty: 1) - ₹${totalFallback.toLocaleString('en-IN')}`;

  const subtotal = typeof order?.subtotal === 'number' ? order.subtotal : totalFallback;
  const discount = typeof order?.discount === 'number' ? order.discount : 0;
  const deliveryCharge = typeof order?.deliveryCharge === 'number' ? order.deliveryCharge : 0;
  const totalAmount = typeof order?.totalAmount === 'number' ? order.totalAmount : totalFallback;
  const paymentMethod = order?.paymentMethod || 'Direct UPI Transfer';
  const transactionId = order?.upiReference || order?.paymentId || 'Pending UTR Verification';

  const preparedMessage =
    `Vidhyaa Jewellery Studio\nORDER VERIFICATION REQUEST\n\n` +
    `Order ID: ${orderId}\nOrder Date and Time: ${orderDateTime}\n\n` +
    `Customer Details:\n• Customer Name: ${customerName}\n• Customer Mobile Number: ${customerMobile}\n• Customer Email: ${customerEmail}\n\n` +
    `Complete Delivery Address:\n${address}\n\n` +
    `Products Ordered:\n${itemsFormatted}\n\n` +
    `Financial Breakdown:\n• Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n• Discount: ₹${discount.toLocaleString('en-IN')}\n• Shipping Charges: ₹${deliveryCharge.toLocaleString('en-IN')}\n• Order Total: ₹${totalAmount.toLocaleString('en-IN')}\n\n` +
    `Payment Information:\n• Payment Method: ${paymentMethod}\n• UTR / Reference: ${transactionId}\n• Payment Status: PENDING STUDIO VERIFICATION\n\n` +
    `Please verify this UPI transfer for dispatch.`;

  const whatsappUrl = `https://wa.me/917302187770?text=${encodeURIComponent(preparedMessage)}`;

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setHasClickedWhatsApp(true);
  };

  const handleConfirmSent = async () => {
    setIsSubmitting(true);
    try {
      const orderKey = order.id || order.orderNumber;
      const authHeaders = await resolveCheckoutCustomerHeaders([order.id, order.orderNumber]);
      await fetch(
        `/api/orders/${encodeURIComponent(orderKey)}/customer-whatsapp-confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ whatsappCustomerConfirmed: true })
        }
      ).catch(() => {});
      setIsConfirmed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyMessage = () => {
    try {
      navigator.clipboard.writeText(preparedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8DCCF] p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-fadeIn max-w-3xl mx-auto">
      <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-700">
        <Clock className="w-8 h-8" />
      </div>

      <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white bg-amber-600">
            ⏳ PAYMENT VERIFICATION PENDING
          </span>
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white text-amber-900 border border-amber-300">
            Order #{orderId} Saved
          </span>
        </div>
        <h2 className="font-serif text-lg sm:text-xl font-bold text-[#3B1E22]">
          Direct UPI Order Submitted — Awaiting Studio Verification
        </h2>
        <p className="text-xs text-gray-700 leading-relaxed">
          Your order <strong>{orderId}</strong> (₹{totalAmount.toLocaleString('en-IN')}) with UTR{' '}
          <strong className="font-mono">{transactionId}</strong> has been recorded. Our studio team will confirm payment receipt and update your order status to Confirmed shortly. You can also notify the studio via WhatsApp below to expedite verification.
        </p>
      </div>

      {!isConfirmed ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full max-w-md mx-auto bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            <span>SHARE UTR ON WHATSAPP (+91 7302187770)</span>
          </button>
          {hasClickedWhatsApp && (
            <button
              type="button"
              onClick={handleConfirmSent}
              disabled={isSubmitting}
              className="mx-auto bg-[#3B1E22] hover:bg-[#802336] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all"
            >
              {isSubmitting ? 'Updating...' : '✓ I Have Sent My UTR on WhatsApp'}
            </button>
          )}
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-semibold max-w-lg mx-auto">
          ✓ WhatsApp notification recorded. Once our studio verifies your UTR, your order status will switch to Confirmed.
        </div>
      )}

      <div className="max-w-lg mx-auto bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCCF] text-left space-y-2.5 text-xs">
        <div className="flex justify-between pb-2 border-b border-[#E8DCCF]">
          <span className="font-mono font-bold text-[#3B1E22]">{orderId}</span>
          <span className="text-gray-600">{orderDateTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Customer</span>
          <span className="font-bold text-gray-800">{customerName} ({customerMobile})</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500 shrink-0">Address</span>
          <span className="text-gray-800 text-right">{address}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">UTR / Reference</span>
          <span className="font-mono font-bold text-gray-800">{transactionId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Amount</span>
          <span className="font-bold text-[#802336]">₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Payment Status</span>
          <span className="font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full text-[11px]">
            PENDING VERIFICATION
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto text-left">
        <button
          type="button"
          onClick={() => setShowFullReceipt(!showFullReceipt)}
          className="text-xs font-bold text-[#3B1E22] hover:text-[#802336] underline cursor-pointer"
        >
          {showFullReceipt ? '▲ Hide WhatsApp Summary' : '▼ View Prepared WhatsApp Summary'}
        </button>
        {showFullReceipt && (
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-mono text-gray-700 whitespace-pre-wrap">
            {preparedMessage}
            <button
              type="button"
              onClick={handleCopyMessage}
              className="mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded cursor-pointer block"
            >
              {copied ? '✓ Copied!' : 'Copy Summary'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onViewMyOrders}
          className="w-full sm:w-auto bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md"
        >
          View My Order
        </button>
        <button
          type="button"
          onClick={() => onTrackOrder(orderId)}
          className="w-full sm:w-auto bg-white border border-[#E8DCCF] hover:bg-gray-50 text-[#3B1E22] px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Track Order Status
        </button>
        <button
          type="button"
          onClick={onContinueShopping}
          className="w-full sm:w-auto bg-white border border-[#E8DCCF] hover:bg-gray-50 text-gray-700 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
};

interface CheckoutViewProps {
  storeSettings?: StoreSettings;
  onOrderSuccess: (order: Order) => void;
  onNavigateHome: () => void;
  onTrackOrder: (orderNumber: string) => void;
  onViewMyOrders?: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  storeSettings,
  onOrderSuccess,
  onNavigateHome,
  onTrackOrder,
  onViewMyOrders
}) => {
  const {
    items,
    subtotal,
    originalTotal,
    productSavings,
    discount,
    totalSavings,
    deliveryCharge,
    finalTotal,
    appliedPromo,
    clearCart
  } = useCart();

  const { user, userProfile, patronSession, saveAddress } = useAuth();
  const mediaInventory = useAvailableMediaInventory();
  const effectiveUserId = user?.uid || patronSession?.uid || undefined;

  const initialDraft = useRef<Record<string, any>>(loadCheckoutDraftForm());

  // Multi-step states: 1: Address, 2: Review, 3: Payment, 4: Confirmed / Submitted
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    const saved = initialDraft.current.step;
    return saved === 2 || saved === 3 ? saved : 1;
  });

  // Address & Contact info (restored from session draft on refresh or payment return)
  const [name, setName] = useState<string>(
    initialDraft.current.name ||
      userProfile?.displayName ||
      user?.displayName ||
      patronSession?.displayName ||
      ''
  );
  const [email, setEmail] = useState<string>(
    initialDraft.current.email ||
      userProfile?.email ||
      user?.email ||
      patronSession?.email ||
      ''
  );
  const [phone, setPhone] = useState<string>(() =>
    extractIndianMobile10(
      initialDraft.current.phone ||
        userProfile?.phone ||
        patronSession?.phone ||
        patronSession?.mobile ||
        ''
    )
  );
  const [houseNo, setHouseNo] = useState<string>(initialDraft.current.houseNo || '');
  const [area, setArea] = useState<string>(initialDraft.current.area || '');
  const [landmark, setLandmark] = useState<string>(initialDraft.current.landmark || '');
  const [city, setCity] = useState<string>(initialDraft.current.city || '');
  const [state, setState] = useState<string>(initialDraft.current.state || 'Uttarakhand');
  const [pincode, setPincode] = useState<string>(initialDraft.current.pincode || '');
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Explicit Cashfree payment channel selection: UPI, Credit Card, Debit Card (+ optional manual QR fallback only if gateway unavailable)
  const [paymentOption, setPaymentOption] = useState<CheckoutPaymentOption>(() => {
    const saved = initialDraft.current.paymentOption;
    if (saved === 'upi' || saved === 'cc' || saved === 'dc' || saved === 'manual_qr') {
      return saved;
    }
    return 'upi';
  });
  const [cashfreeStatus, setCashfreeStatus] = useState<{
    isConfigured: boolean;
    hasLiveCredentials?: boolean;
    blockedOnLiveDomain?: boolean;
    env: 'SANDBOX' | 'PRODUCTION';
    appIdMasked?: string;
    hasSecretKey?: boolean;
  } | null>(null);

  // Stable order number per active checkout session
  const [orderNumber, setOrderNumber] = useState<string>(() => getOrCreateDraftOrderNumber());

  const [utrNumber, setUtrNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRestoringOrder, setIsRestoringOrder] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: 'pending' | 'cancelled' | 'failed';
    title: string;
    message: string;
    cfOrderId?: string;
  } | null>(null);
  const [pendingCfOrderId, setPendingCfOrderId] = useState<string | null>(
    () => loadPendingCashfreeSession()?.orderId || null
  );
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Synchronous submission lock to prevent duplicate payment creation on rapid clicks
  const submittingRef = useRef(false);

  // Persist checkout form draft cleanly in sessionStorage for refresh / app-switch recovery
  useEffect(() => {
    if (step === 4) return;
    try {
      sessionStorage.setItem(
        CHECKOUT_DRAFT_FORM_KEY,
        JSON.stringify({
          step: step === 1 || step === 2 || step === 3 ? step : 1,
          name,
          email,
          phone,
          houseNo,
          area,
          landmark,
          city,
          state,
          pincode,
          paymentOption
        })
      );
    } catch {}
  }, [step, name, email, phone, houseNo, area, landmark, city, state, pincode, paymentOption]);

  // Sync user / patron profile info cleanly into blank inputs
  useEffect(() => {
    if (!name) {
      const candidate =
        userProfile?.displayName || user?.displayName || patronSession?.displayName || '';
      if (candidate) setName(candidate);
    }
    if (!email) {
      const candidate = userProfile?.email || user?.email || patronSession?.email || '';
      if (candidate) setEmail(candidate);
    }
    if (!phone) {
      const candidate = extractIndianMobile10(
        userProfile?.phone || patronSession?.phone || patronSession?.mobile || ''
      );
      if (candidate) setPhone(candidate);
    }
  }, [user, userProfile, patronSession]);

  useEffect(() => {
    fetch('/api/payments/cashfree/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCashfreeStatus(data);
        }
      })
      .catch(() => {});
  }, []);

  // Merchant UPI Credentials (used only for manual fallback when Cashfree gateway is not configured)
  const merchantVpa = storeSettings?.upiVpa || 'neerajchauhan2000-1@oksbi';
  const payeeName = storeSettings?.upiPayeeName || 'neeraj chauhan';
  const cashfreeAvailable = Boolean(
    cashfreeStatus?.isConfigured && !cashfreeStatus?.blockedOnLiveDomain
  );

  const combinedStreet = [houseNo.trim(), area.trim()].filter(Boolean).join(', ');
  const normalizedPhone10 = extractIndianMobile10(phone);

  const getPaymentOptionLabel = (opt: CheckoutPaymentOption): string => {
    if (opt === 'upi') return 'UPI (Google Pay, PhonePe, Paytm, BHIM & QR)';
    if (opt === 'cc') return 'Credit Card (Visa, Mastercard, RuPay)';
    if (opt === 'dc') return 'Debit Card (Visa, Mastercard, RuPay)';
    return 'Direct Studio UPI QR (Manual Verification)';
  };

  const finalizeVerifiedOrderSuccess = useCallback(
    async (verifiedOrder: Order) => {
      const synced = await syncOrderToLocalAndFirestore(verifiedOrder);
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#802336', '#0F5B46', '#FAF7F2']
        });
      } catch {}
      try {
        sessionStorage.removeItem(DRAFT_ORDER_KEY);
        sessionStorage.removeItem(CHECKOUT_DRAFT_FORM_KEY);
        savePendingCashfreeSession(null);
        sessionStorage.setItem(COMPLETED_ORDER_KEY, synced.orderNumber || synced.id);
      } catch {}
      setPendingCfOrderId(null);
      setPaymentNotice(null);
      setPaymentError(null);
      setCompletedOrder(synced);
      clearCart();
      setStep(4);
      onOrderSuccess(synced);
    },
    [clearCart, onOrderSuccess]
  );

  const verifyAndFinalizeCashfreePayment = useCallback(
    async (cfOrderId: string, opts: { autoPollPending?: boolean } = {}) => {
      setIsVerifying(true);
      setPaymentError(null);
      const maxAttempts = opts.autoPollPending ? 3 : 1;

      try {
        const orderItems: OrderItem[] = items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          variationId: i.variationId,
          variationName: i.variationName,
          quantity: i.quantity,
          price: i.price,
          mrp: i.mrp,
          image: i.image,
          sku: i.sku
        }));

        const formattedPhone = formatIndianPhone(phone);
        const hasShippingInForm = Boolean(name.trim() && combinedStreet && city.trim() && pincode.trim());
        const shippingAddressPayload: Address | undefined = hasShippingInForm
          ? {
              id: `addr_${Date.now()}`,
              name: name.trim(),
              phone: formattedPhone,
              houseNo: houseNo.trim(),
              area: area.trim(),
              street: combinedStreet,
              landmark: landmark.trim(),
              city: city.trim(),
              state: state.trim(),
              pincode: pincode.trim()
            }
          : undefined;

        const authHeaders = await resolveCheckoutCustomerHeaders([cfOrderId, orderNumber]);

        let lastVerifyData: any = {};
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2500));
          }

          const verifyRes = await fetch('/api/payments/cashfree/verify-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify({
              orderId: cfOrderId,
              ...(hasShippingInForm && orderItems.length > 0
                ? {
                    orderData: {
                      orderNumber: cfOrderId.startsWith('VDH') ? cfOrderId : orderNumber,
                      userId: effectiveUserId,
                      customerName: name.trim(),
                      customerEmail: email.trim(),
                      customerPhone: formattedPhone,
                      shippingAddress: shippingAddressPayload,
                      items: orderItems,
                      originalTotal,
                      productSavings,
                      couponSavings: discount,
                      totalSavings,
                      subtotal,
                      discount,
                      appliedPromo: appliedPromo || undefined,
                      deliveryCharge,
                      totalAmount: finalTotal
                    }
                  }
                : {})
            })
          });

          const verifyData = await verifyRes.json().catch(() => ({}));
          lastVerifyData = verifyData;

          if (verifyData.success && verifyData.isPaid === true && verifyData.order) {
            if (verifyData.receiptToken) {
              saveOrderReceiptToken(verifyData.order.id, verifyData.receiptToken);
              saveOrderReceiptToken(verifyData.order.orderNumber || cfOrderId, verifyData.receiptToken);
            }
            await finalizeVerifiedOrderSuccess(verifyData.order);
            return true;
          }

          const gatewayStatus = String(verifyData.orderStatus || 'INCOMPLETE').toUpperCase();
          const isStillPending =
            Boolean(verifyData.isPending) ||
            gatewayStatus === 'ACTIVE' ||
            gatewayStatus === 'PENDING' ||
            gatewayStatus === 'NOT_ATTEMPTED';

          if (!isStillPending) {
            break;
          }
        }

        const gatewayStatus = String(lastVerifyData.orderStatus || 'INCOMPLETE').toUpperCase();
        if (
          lastVerifyData.isCancelled ||
          gatewayStatus === 'USER_DROPPED' ||
          gatewayStatus === 'CANCELLED'
        ) {
          savePendingCashfreeSession(null);
          setPendingCfOrderId(null);
          const msg =
            lastVerifyData.error ||
            'You closed or cancelled the payment before completion. No payment was confirmed and your cart is safely preserved.';
          setPaymentNotice({
            type: 'cancelled',
            title: 'Payment Cancelled',
            message: msg,
            cfOrderId
          });
          setPaymentError(null);
        } else if (
          lastVerifyData.isFailed ||
          ['FAILED', 'TERMINATED', 'VOID', 'EXPIRED', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'].includes(gatewayStatus)
        ) {
          savePendingCashfreeSession(null);
          setPendingCfOrderId(null);
          const msg =
            lastVerifyData.failureReason ||
            lastVerifyData.error ||
            `Payment ${gatewayStatus.toLowerCase()}. Your order was not confirmed and your shopping bag is preserved so you can retry safely.`;
          setPaymentNotice({
            type: 'failed',
            title: 'Payment Failed',
            message: msg,
            cfOrderId
          });
          setPaymentError(null);
        } else {
          // Still pending / awaiting UPI bank confirmation — keep pendingCfOrderId so user can re-check without double-charging
          setPendingCfOrderId(cfOrderId);
          setPaymentNotice({
            type: 'pending',
            title: 'Payment Verification Pending',
            message:
              'Your payment is not confirmed by Cashfree yet (common while UPI apps or banks complete settlement). Do not pay twice — tap "Check Payment Status" below, or retry only if no amount was debited.',
            cfOrderId
          });
          setPaymentError(null);
        }
        return false;
      } catch {
        setPendingCfOrderId(cfOrderId);
        setPaymentNotice({
          type: 'pending',
          title: 'Unable to Reach Payment Verification Server',
          message:
            'We could not confirm your payment status due to a network interruption. Tap "Check Payment Status" to verify without creating a duplicate charge.',
          cfOrderId
        });
        return false;
      } finally {
        setIsVerifying(false);
        submittingRef.current = false;
      }
    },
    [
      area,
      city,
      combinedStreet,
      deliveryCharge,
      discount,
      effectiveUserId,
      email,
      finalTotal,
      finalizeVerifiedOrderSuccess,
      houseNo,
      items,
      landmark,
      name,
      orderNumber,
      originalTotal,
      phone,
      pincode,
      productSavings,
      state,
      subtotal,
      totalSavings,
      appliedPromo
    ]
  );

  // Return URL (?cf_order_id=...) and Page Refresh / Mobile UPI App-Switch Recovery
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cfReturnOrderId = params.get('cf_order_id')?.trim();

    if (cfReturnOrderId) {
      setIsRestoringOrder(true);
      setStep(3);
      verifyAndFinalizeCashfreePayment(cfReturnOrderId, { autoPollPending: true }).finally(() => {
        setIsRestoringOrder(false);
        try {
          const cleanUrl = `${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);
        } catch {}
      });
      return;
    }

    // Recover interrupted Cashfree checkout session after browser refresh or mobile app-switch
    const pendingSession = loadPendingCashfreeSession();
    if (pendingSession && !completedOrder) {
      setIsRestoringOrder(true);
      setStep(3);
      setPendingCfOrderId(pendingSession.orderId);
      verifyAndFinalizeCashfreePayment(pendingSession.orderId, { autoPollPending: false }).finally(() => {
        setIsRestoringOrder(false);
      });
      return;
    }

    // If user already completed an order in this session and refreshed the page, restore the verified receipt
    try {
      const completedId = sessionStorage.getItem(COMPLETED_ORDER_KEY);
      if (completedId && items.length === 0 && !completedOrder) {
        setIsRestoringOrder(true);
        fetchOrderById(completedId)
          .then((ord) => {
            if (ord) {
              setCompletedOrder(ord);
              setStep(4);
            }
          })
          .finally(() => setIsRestoringOrder(false));
      } else if (items.length > 0) {
        // Active new cart checkout: clear previous completed-order token
        sessionStorage.removeItem(COMPLETED_ORDER_KEY);
      }
    } catch {}
  }, []);

  const clearCompletedTokenAndNavigate = useCallback(
    (destFn: () => void) => {
      try {
        sessionStorage.removeItem(COMPLETED_ORDER_KEY);
        sessionStorage.removeItem(DRAFT_ORDER_KEY);
        sessionStorage.removeItem(CHECKOUT_DRAFT_FORM_KEY);
        savePendingCashfreeSession(null);
      } catch {}
      destFn();
    },
    []
  );

  // If user has saved addresses, allow quick selection
  const handleSelectSavedAddress = (addr: Address) => {
    setStep1Error(null);
    setName(addr.name || '');
    setPhone(extractIndianMobile10(addr.phone || ''));
    setHouseNo(addr.houseNo || addr.street || '');
    setArea(addr.area || '');
    setLandmark(addr.landmark || '');
    setCity(addr.city || '');
    setState(addr.state || 'Uttarakhand');
    setPincode(addr.pincode || '');
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const phoneDigits = extractIndianMobile10(phone);
    const cleanHouseNo = houseNo.trim();
    const cleanArea = area.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim();
    const cleanPin = pincode.replace(/\D/g, '');

    if (!cleanName || cleanName.length < 2) {
      setStep1Error('Please enter your full name for delivery.');
      return;
    }
    if (!isValidIndianMobile10(phoneDigits)) {
      setStep1Error('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setStep1Error('Please enter a valid email address for your order invoice and updates.');
      return;
    }
    if (!cleanHouseNo) {
      setStep1Error('Please enter your House / Flat No. or Building Name.');
      return;
    }
    if (!cleanArea) {
      setStep1Error('Please enter your Street / Area / Colony / Sector.');
      return;
    }
    if (!cleanCity) {
      setStep1Error('Please enter your City.');
      return;
    }
    if (!cleanState) {
      setStep1Error('Please select your State or Union Territory.');
      return;
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      setStep1Error('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    const formattedPhone = formatIndianPhone(phoneDigits);
    setPhone(phoneDigits);

    if (saveToAccount && (user || patronSession)) {
      saveAddress({
        id: `addr_${Date.now()}`,
        name: cleanName,
        phone: formattedPhone,
        houseNo: cleanHouseNo,
        area: cleanArea,
        street: [cleanHouseNo, cleanArea].filter(Boolean).join(', '),
        landmark: landmark.trim(),
        city: cleanCity,
        state: cleanState,
        pincode: cleanPin
      });
    }
    setStep(2);
  };

  // Manual Direct UPI QR Fallback (Only used when Cashfree gateway is not configured; strictly remains 'pending' until Admin verifies)
  const handleVerifyManualUpiQr = async () => {
    if (submittingRef.current) return;
    setPaymentError(null);
    setPaymentNotice(null);

    const cleanUtr = utrNumber.trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      setPaymentError('Please enter the exact 12-digit UPI Reference Number / UTR from your UPI payment app.');
      return;
    }
    if (!isValidIndianMobile10(phone)) {
      setPaymentError('Please go back to Step 1 and enter a valid 10-digit Indian mobile number.');
      return;
    }

    submittingRef.current = true;
    setIsVerifying(true);

    try {
      const orderItems: OrderItem[] = items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        variationId: i.variationId,
        variationName: i.variationName,
        quantity: i.quantity,
        price: i.price,
        mrp: i.mrp,
        image: i.image,
        sku: i.sku
      }));

      const formattedPhone = formatIndianPhone(phone);
      const shippingAddress: Address = {
        id: `addr_${Date.now()}`,
        name: name.trim(),
        phone: formattedPhone,
        houseNo: houseNo.trim(),
        area: area.trim(),
        street: combinedStreet,
        landmark: landmark.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim()
      };

      const newOrderData: Omit<Order, 'id'> = {
        orderNumber,
        userId: effectiveUserId,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: formattedPhone,
        shippingAddress,
        items: orderItems,
        originalTotal,
        productSavings,
        couponSavings: discount,
        totalSavings,
        subtotal,
        discount,
        appliedPromo: appliedPromo || undefined,
        deliveryCharge,
        totalAmount: finalTotal,
        paymentMethod: 'Direct Studio UPI QR (Manual Verification)',
        paymentStatus: 'pending',
        isPaid: false,
        currency: 'INR',
        upiReference: cleanUtr,
        orderStatus: 'Pending',
        trackingNumber: '',
        courierName: 'Atelier Express Dispatch',
        giftItem: subtotal >= 2000 ? 'Gold Imitation Bangles' : subtotal >= 1500 ? 'Gold Imitation Jhoomki' : undefined,
        notes: `Manual Studio UPI QR transfer (UTR: ${cleanUtr}) — Awaiting Admin bank verification`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const savedOrder = await createOrder(newOrderData);
      try {
        sessionStorage.removeItem(DRAFT_ORDER_KEY);
        sessionStorage.removeItem(CHECKOUT_DRAFT_FORM_KEY);
        savePendingCashfreeSession(null);
        sessionStorage.setItem(COMPLETED_ORDER_KEY, savedOrder.orderNumber || savedOrder.id);
      } catch {}

      setCompletedOrder(savedOrder);
      clearCart();
      setStep(4);
      onOrderSuccess(savedOrder);
    } catch {
      setPaymentError('Order submission failed. Please verify your network connection and try again.');
    } finally {
      setIsVerifying(false);
      submittingRef.current = false;
    }
  };

  // Retry cleanly with a fresh order number (used after a confirmed Failed or Cancelled payment)
  const handlePrepareFreshRetry = () => {
    savePendingCashfreeSession(null);
    setPendingCfOrderId(null);
    setPaymentNotice(null);
    setPaymentError(null);
    const freshOrderNum = rotateDraftOrderNumber();
    setOrderNumber(freshOrderNum);
  };

  // Authoritative Cashfree Online Payment Handler (UPI, Credit Card, Debit Card)
  const handleCashfreePayment = async (channelOverride?: 'upi' | 'cc' | 'dc') => {
    if (submittingRef.current || isVerifying) return;

    const activeChannel: 'upi' | 'cc' | 'dc' =
      channelOverride || (paymentOption === 'cc' || paymentOption === 'dc' || paymentOption === 'upi' ? paymentOption : 'upi');

    const cleanMobile = extractIndianMobile10(phone);
    if (!isValidIndianMobile10(cleanMobile)) {
      setPaymentError('Please enter a valid 10-digit Indian mobile number in Step 1 before paying.');
      return;
    }

    if (cashfreeStatus && (!cashfreeStatus.isConfigured || cashfreeStatus.blockedOnLiveDomain)) {
      setPaymentError(
        cashfreeStatus.blockedOnLiveDomain
          ? 'Cashfree Gateway is currently in SANDBOX mode and disabled on the live domain. Please switch to PRODUCTION credentials in Admin Settings.'
          : 'Cashfree Merchant API credentials are not configured on the server yet. Please configure Cashfree in Admin Settings.'
      );
      return;
    }

    submittingRef.current = true;
    setIsVerifying(true);
    setPaymentError(null);
    setPaymentNotice(null);

    try {
      const orderItems: OrderItem[] = items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        variationId: i.variationId,
        variationName: i.variationName,
        quantity: i.quantity,
        price: i.price,
        mrp: i.mrp,
        image: i.image,
        sku: i.sku
      }));

      const formattedPhone = formatIndianPhone(cleanMobile);
      const shippingAddress: Address = {
        id: `addr_${Date.now()}`,
        name: name.trim(),
        phone: formattedPhone,
        houseNo: houseNo.trim(),
        area: area.trim(),
        street: combinedStreet,
        landmark: landmark.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim()
      };

      const channelLabel =
        activeChannel === 'cc'
          ? 'Credit Card (Cashfree)'
          : activeChannel === 'dc'
          ? 'Debit Card (Cashfree)'
          : 'UPI (Cashfree)';

      const customerHeaders = await resolveCheckoutCustomerHeaders([orderNumber]);
      let attemptOrderNumber = orderNumber;
      const activeReturnUrl = `${window.location.origin}/?view=checkout&cf_order_id={order_id}`;

      const postCreateOrder = async (targetOrderNum: string) =>
        fetch('/api/payments/cashfree/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...customerHeaders
          },
          body: JSON.stringify({
            orderId: targetOrderNum,
            orderNumber: targetOrderNum,
            orderAmount: finalTotal,
            customerName: name.trim() || 'Valued Patron',
            customerEmail: email.trim() || 'patron@vidhyaajewellery.com',
            customerPhone: cleanMobile,
            shippingAddress,
            items: orderItems,
            subtotal,
            discount,
            appliedPromo: appliedPromo || undefined,
            deliveryCharge,
            userId: effectiveUserId,
            giftItem: subtotal >= 2000 ? 'Gold Imitation Bangles' : subtotal >= 1500 ? 'Gold Imitation Jhoomki' : undefined,
            returnUrl: activeReturnUrl,
            paymentMethods: activeChannel,
            paymentMethod: channelLabel,
            orderNote: `VIDHYAA Jewellery Studio Order ${targetOrderNum} (${items.length} items)`
          })
        });

      let res = await postCreateOrder(attemptOrderNumber);
      if (res.status === 409) {
        attemptOrderNumber = rotateDraftOrderNumber();
        setOrderNumber(attemptOrderNumber);
        res = await postCreateOrder(attemptOrderNumber);
      }

      const data = await res.json().catch(() => ({}));
      const paymentSessionId = data.paymentSessionId || data.payment_session_id;
      const cfOrderId = data.orderId || data.order_id || attemptOrderNumber;
      const cfMode = data.mode;

      if (data?.receiptToken) {
        saveOrderReceiptToken(cfOrderId, data.receiptToken);
        saveOrderReceiptToken(attemptOrderNumber, data.receiptToken);
        if (data?.order?.id) saveOrderReceiptToken(data.order.id, data.receiptToken);
      }

      if (!res.ok || !data.success || !paymentSessionId) {
        if (data.configured === false) {
          setPaymentError(
            'Cashfree Payments Gateway is not yet configured with Merchant API credentials. Configure Cashfree in Admin Settings to enable live Card & UPI checkout.'
          );
        } else {
          setPaymentError(data.error || 'Failed to initialize Cashfree Hosted Checkout session. Please try again.');
        }
        setIsVerifying(false);
        submittingRef.current = false;
        return;
      }

      // Persist pending gateway session BEFORE launching Cashfree so refresh / UPI app switch always recovers
      savePendingCashfreeSession({
        orderId: cfOrderId,
        orderNumber: attemptOrderNumber,
        paymentChannel: activeChannel,
        createdAt: Date.now()
      });
      setPendingCfOrderId(cfOrderId);

      if (typeof (window as any).Cashfree === 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Cashfree Hosted Checkout SDK. Please check your internet connection.'));
          document.body.appendChild(script);
        });
      }

      const cashfree = (window as any).Cashfree({
        mode: cfMode === 'production' ? 'production' : 'sandbox'
      });

      const isSmallMobile =
        typeof window !== 'undefined' &&
        window.innerWidth < 640 &&
        activeChannel === 'upi';

      cashfree
        .checkout({
          paymentSessionId,
          redirectTarget: isSmallMobile ? '_self' : '_modal'
        })
        .then(async () => {
          await verifyAndFinalizeCashfreePayment(cfOrderId, { autoPollPending: true });
        })
        .catch(async () => {
          await verifyAndFinalizeCashfreePayment(cfOrderId, { autoPollPending: true });
        });
    } catch (err: any) {
      setIsVerifying(false);
      submittingRef.current = false;
      setPaymentError(err?.message || 'Error communicating with Cashfree Payments Gateway.');
    }
  };

  if (isRestoringOrder && step !== 4) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#802336] mx-auto" />
        <h2 className="font-serif text-xl font-bold text-[#3B1E22]">
          Verifying Your Payment Status...
        </h2>
        <p className="text-xs text-gray-500">
          Please wait while we confirm your transaction with our payment gateway.
        </p>
      </div>
    );
  }

  if (items.length === 0 && step !== 4 && !completedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FAF7F2] flex items-center justify-center mx-auto text-[#802336]">
          <ShoppingBag className="w-8 h-8 opacity-60" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
          Your Shopping Bag is Empty
        </h2>
        <p className="text-xs text-gray-500">
          Please add jewellery pieces to your bag before proceeding to checkout.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onNavigateHome}
            className="bg-[#3B1E22] text-[#FAF7F2] px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-[#802336] transition-colors cursor-pointer"
          >
            Return to Collections
          </button>
          {onViewMyOrders && (
            <button
              onClick={onViewMyOrders}
              className="bg-white border border-[#E8DCCF] text-[#3B1E22] px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              View My Orders
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Checkout Progress Stepper */}
      <div className="mb-10">
        <div className="flex items-center justify-between max-w-xl mx-auto relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#E8DCCF] -translate-y-1/2 z-0" />
          {[
            { num: 1, label: 'Delivery' },
            { num: 2, label: 'Review' },
            { num: 3, label: 'Payment' },
            { num: 4, label: 'Confirmed' }
          ].map((s) => (
            <div key={s.num} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.num
                    ? step === 4 && isOrderPaid(completedOrder)
                      ? 'bg-emerald-700 text-white ring-4 ring-emerald-200'
                      : 'bg-[#802336] text-white ring-4 ring-[#802336]/20'
                    : step > s.num
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border-2 border-[#E8DCCF] text-gray-400'
                }`}
              >
                {step > s.num || (step === 4 && isOrderPaid(completedOrder)) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-[11px] font-semibold mt-1 uppercase tracking-wider ${
                  step === s.num ? 'text-[#802336]' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Atelier Origin & Concierge Banner */}
      <div className="bg-[#FAF7F2] border border-[#DFB982] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-start sm:items-center gap-2 text-gray-700">
          <MapPin className="w-4 h-4 text-[#802336] flex-shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-snug">
            <strong className="text-[#3B1E22]">Dispatched from VIDHYAA Atelier:</strong> Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand - 247667
          </span>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0 text-[11px]">
          <a
            href="tel:7302187770"
            className="flex items-center gap-1 font-bold text-[#802336] hover:underline"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call 7302187770</span>
          </a>
          <span className="text-gray-300">|</span>
          <a
            href="https://wa.me/917302187770"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* STEP 1: Delivery Address */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E8DCCF]">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                Customer & Delivery Information
              </h2>
              <p className="text-xs text-gray-500">
                Please enter where we should deliver your jewellery parcel.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#802336] bg-[#FAF7F2] px-3 py-1 rounded-full border border-[#E8DCCF]">
              Step 1 of 3
            </span>
          </div>

          {/* Saved Addresses quick pick if logged in */}
          {userProfile?.savedAddresses && userProfile.savedAddresses.length > 0 && (
            <div className="mb-6 p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
              <span className="text-xs font-bold text-[#3B1E22] uppercase tracking-wider block mb-2">
                Use Saved Address:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {userProfile.savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => handleSelectSavedAddress(addr)}
                    className="p-3 bg-white rounded-lg border border-[#E8DCCF] text-left text-xs hover:border-[#802336] transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-[#3B1E22]">{addr.name}</div>
                    <div className="text-gray-500 text-[11px] truncate">
                      {addr.street}, {addr.city} - {addr.pincode}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Indian Mobile Number (+91) *
                </label>
                <div className="flex items-stretch">
                  <span className="inline-flex items-center px-3 bg-[#FAF7F2] border border-r-0 border-[#E8DCCF] rounded-l-xl text-xs font-mono font-bold text-[#3B1E22] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    maxLength={10}
                    placeholder="9829012345"
                    value={normalizedPhone10}
                    onChange={(e) => setPhone(extractIndianMobile10(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-[#E8DCCF] rounded-r-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {normalizedPhone10.length > 0 && !isValidIndianMobile10(normalizedPhone10) ? (
                    <span className="text-red-600 font-semibold">
                      Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.
                    </span>
                  ) : (
                    'Saved with your order & linked to Cashfree checkout for UPI/card receipts and courier updates.'
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Email Address (for Invoice & Order Status) *
              </label>
              <input
                type="email"
                required
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
              />
            </div>

            {step1Error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{step1Error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  House / Flat No. / Building Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 302, Royal Palms"
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Street / Area / Colony *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Solani Puram West, M.I. Road"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near IIT Roorkee Main Gate"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Roorkee / Jaipur / Delhi"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  State / Union Territory *
                </label>
                <select
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] bg-white"
                >
                  {INDIAN_STATES_AND_UTS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  PIN Code (6 Digits) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="247667"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToAccount}
                  onChange={(e) => setSaveToAccount(e.target.checked)}
                  className="rounded accent-[#802336]"
                />
                <span>Save this delivery address to my account profile</span>
              </label>

              <button
                type="submit"
                className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span>Continue to Review</span>
                <ArrowRight className="w-4 h-4 text-[#DFB982]" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: Order Review & Summary */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DCCF]">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                  Review Your Order Items
                </h2>
                <p className="text-xs text-gray-500">
                  Verify your jewellery finishes, quantities and delivery address.
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-[#802336] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Edit Delivery Address
              </button>
            </div>

            {/* Address Summary Box */}
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[#802336] block mb-1">
                Delivering To:
              </span>
              <p className="font-bold text-[#3B1E22]">
                {name} • <span className="font-normal text-gray-600 font-mono">{formatIndianPhone(phone)}</span>
              </p>
              <p className="text-gray-600">
                {combinedStreet}{landmark ? `, ${landmark}` : ''}, {city}, {state} - {pincode}
              </p>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                Order Items ({items.reduce((a, b) => a + b.quantity, 0)}):
              </span>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-[#FAF7F2]/50"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveSafeProductImageUrl(item.image, mediaInventory)}
                      alt={item.productName}
                      className="w-14 h-14 object-contain rounded-lg border border-[#E8DCCF] bg-white"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === '1' || img.src.startsWith('data:image/svg+xml')) return;
                        img.dataset.fallbackApplied = '1';
                        img.src = JEWELLERY_PLACEHOLDER_IMAGE;
                      }}
                    />
                    <div>
                      <h4 className="font-serif text-sm font-semibold text-[#241C1A]">
                        {item.productName}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        <span className="bg-white px-2 py-0.5 rounded border border-[#E8DCCF] text-[#802336] font-medium">
                          {item.variationName}
                        </span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#3B1E22]">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}

              {/* House of Parati Style Complimentary Gift Item in Checkout */}
              {subtotal >= 1500 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#DFB982] bg-[#174A3A] text-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center border border-[#DFB982]/50 text-[#DFB982]">
                      <Gift className="w-6 h-6 text-[#DFB982]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif text-sm font-bold text-white">
                          {subtotal >= 2000 ? 'Gold Imitation Bangles' : 'Gold Imitation Jhoomki'}
                        </h4>
                        <span className="bg-[#DFB982] text-[#174A3A] text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                          Free Gift
                        </span>
                      </div>
                      <p className="text-[11px] text-[#DFB982] mt-0.5">
                        ✦ Exclusive Atelier Gift for shopping above ₹{subtotal >= 2000 ? '2,000' : '1,500'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#DFB982]">₹0 FREE</span>
                    <span className="block text-[10px] text-gray-300 line-through">
                      ₹{subtotal >= 2000 ? '950' : '550'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing Breakdown */}
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Product Subtotal</span>
                <span className="font-semibold text-gray-900">
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Special Discount</span>
                  <span>-₹{discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping Charges</span>
                <span className="font-semibold text-gray-900">
                  ₹{deliveryCharge}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#3B1E22] pt-2 border-t border-[#E8DCCF]">
                <span>Final Payable Amount</span>
                <span className="text-lg text-[#0F4C4A]">
                  ₹{finalTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Selected Payment Method Overview */}
            <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#802336] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  {paymentOption === 'upi' ? (
                    <Smartphone className="w-4 h-4 text-[#DFB982]" />
                  ) : (
                    <CreditCard className="w-4 h-4 text-[#DFB982]" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Selected Payment Option:
                  </span>
                  <div className="font-bold text-[#3B1E22] flex items-center gap-2">
                    <span>{getPaymentOptionLabel(paymentOption)}</span>
                  </div>
                  <span className="text-[11px] text-gray-600">
                    {paymentOption === 'manual_qr'
                      ? 'Manual Studio UPI QR • Requires 12-digit UTR & admin bank verification'
                      : 'Official Cashfree PCI-DSS Hosted Checkout • Verified automatically via server'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-[11px] font-bold text-[#802336] hover:underline self-start sm:self-auto cursor-pointer"
              >
                Choose in Step 3 →
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md flex items-center gap-2"
              >
                <span>Proceed to Payment</span>
                <ArrowRight className="w-4 h-4 text-[#DFB982]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Payment Method Selection */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DCCF] gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#802336] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-xs">
                  <ShieldCheck className="w-3 h-3 text-[#DFB982]" />
                  <span>Cashfree Secure Checkout</span>
                </span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Order #{orderNumber}
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#3B1E22] mt-1.5">
                Choose Your Payment Method
              </h2>
              <p className="text-xs text-gray-500">
                Pay securely via Cashfree using UPI, Credit Card, or Debit Card. Order confirms only after server payment verification.
              </p>
            </div>
            <div className="sm:text-right bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCCF]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                Final Payable Amount
              </span>
              <span className="font-serif text-2xl sm:text-3xl font-bold text-[#802336]">
                ₹{finalTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Pending / Cancelled / Failed Payment Recovery Banner */}
          {paymentNotice && (
            <div
              data-testid={`payment-notice-${paymentNotice.type}`}
              className={`p-4 sm:p-5 rounded-2xl border-2 space-y-3 ${
                paymentNotice.type === 'failed'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {paymentNotice.type === 'pending' ? (
                  <Clock className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      paymentNotice.type === 'failed' ? 'text-red-600' : 'text-amber-700'
                    }`}
                  />
                )}
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-bold">{paymentNotice.title}</h3>
                  <p className="text-xs leading-relaxed opacity-90">{paymentNotice.message}</p>
                  {paymentNotice.cfOrderId && (
                    <p className="text-[11px] font-mono opacity-80">
                      Reference Order: <strong>{paymentNotice.cfOrderId}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {paymentNotice.type === 'pending' && pendingCfOrderId && (
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => verifyAndFinalizeCashfreePayment(pendingCfOrderId, { autoPollPending: false })}
                    className="bg-[#3B1E22] hover:bg-[#802336] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                    <span>{isVerifying ? 'Checking Status...' : 'Check Payment Status Again'}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={handlePrepareFreshRetry}
                  className="bg-white hover:bg-gray-50 border border-[#E8DCCF] text-[#3B1E22] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {paymentNotice.type === 'pending' ? 'Start Fresh Payment Attempt' : 'Retry Payment Now'}
                </button>
              </div>
            </div>
          )}

          {/* Gateway Status Warning if Unconfigured or Blocked on Live Domain */}
          {cashfreeStatus && (!cashfreeStatus.isConfigured || cashfreeStatus.blockedOnLiveDomain) && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-1.5">
              <div className="font-bold flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>
                  {cashfreeStatus.blockedOnLiveDomain
                    ? 'Cashfree Sandbox Mode Blocked on Live Website'
                    : 'Cashfree Online Payment Gateway Awaiting Merchant Credentials'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900/90">
                {cashfreeStatus.blockedOnLiveDomain
                  ? 'Online Card and UPI gateway checkout requires Live Production Cashfree credentials configured in Admin Settings > Cashfree Gateway.'
                  : 'Instant UPI, Credit Card, and Debit Card checkout requires CASHFREE_APP_ID and CASHFREE_SECRET_KEY configured on the server (Admin Settings > Cashfree Gateway or environment variables).'}
              </p>
            </div>
          )}

          {/* 3 Explicit Cashfree Payment Channels: UPI, Credit Card, Debit Card */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Option 1: UPI (Google Pay, PhonePe, Paytm, BHIM & QR) */}
              <button
                type="button"
                data-testid="pay-option-upi"
                onClick={() => {
                  setPaymentOption('upi');
                  setPaymentError(null);
                }}
                className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  paymentOption === 'upi'
                    ? 'bg-[#FAF7F2] border-[#802336] ring-2 ring-[#802336]/25 shadow-md'
                    : 'bg-white border-[#E8DCCF] hover:border-[#802336]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                        paymentOption === 'upi'
                          ? 'bg-[#0F5B46] text-white shadow-xs'
                          : 'bg-[#FAF7F2] text-[#0F5B46] border border-[#E8DCCF]'
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                      Instant UPI
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#3B1E22]">UPI & UPI QR</h3>
                  <p className="text-xs font-semibold text-[#0F5B46] mt-0.5">
                    Google Pay, PhonePe, Paytm, BHIM
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">
                    1-tap UPI app intent on mobile or scannable Cashfree UPI QR / UPI ID on desktop with automatic verification.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DCCF]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentOption === 'upi' ? 'border-[#802336] bg-[#802336]' : 'border-gray-400 bg-white'
                      }`}
                    >
                      {paymentOption === 'upi' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={paymentOption === 'upi' ? 'text-[#802336]' : 'text-gray-600'}>
                      {paymentOption === 'upi' ? 'Selected' : 'Select UPI'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-700">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>

              {/* Option 2: Credit Card */}
              <button
                type="button"
                data-testid="pay-option-cc"
                onClick={() => {
                  setPaymentOption('cc');
                  setPaymentError(null);
                }}
                className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  paymentOption === 'cc'
                    ? 'bg-[#FAF7F2] border-[#802336] ring-2 ring-[#802336]/25 shadow-md'
                    : 'bg-white border-[#E8DCCF] hover:border-[#802336]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                        paymentOption === 'cc'
                          ? 'bg-[#802336] text-white shadow-xs'
                          : 'bg-[#FAF7F2] text-[#802336] border border-[#E8DCCF]'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
                      3D Secure
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#3B1E22]">Credit Card</h3>
                  <p className="text-xs font-semibold text-[#802336] mt-0.5">
                    Visa, Mastercard, RuPay
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">
                    Enter card details securely inside Cashfree's PCI-DSS hosted checkout with bank 3DS / OTP authentication.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DCCF]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentOption === 'cc' ? 'border-[#802336] bg-[#802336]' : 'border-gray-400 bg-white'
                      }`}
                    >
                      {paymentOption === 'cc' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={paymentOption === 'cc' ? 'text-[#802336]' : 'text-gray-600'}>
                      {paymentOption === 'cc' ? 'Selected' : 'Select Credit Card'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-700">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>

              {/* Option 3: Debit Card */}
              <button
                type="button"
                data-testid="pay-option-dc"
                onClick={() => {
                  setPaymentOption('dc');
                  setPaymentError(null);
                }}
                className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  paymentOption === 'dc'
                    ? 'bg-[#FAF7F2] border-[#802336] ring-2 ring-[#802336]/25 shadow-md'
                    : 'bg-white border-[#E8DCCF] hover:border-[#802336]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                        paymentOption === 'dc'
                          ? 'bg-[#3B1E22] text-[#DFB982] shadow-xs'
                          : 'bg-[#FAF7F2] text-[#3B1E22] border border-[#E8DCCF]'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200">
                      Bank OTP
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#3B1E22]">Debit Card</h3>
                  <p className="text-xs font-semibold text-[#3B1E22] mt-0.5">
                    RuPay, Visa, Mastercard Debit
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">
                    Secure hosted Debit Card payment via Cashfree with bank 3D Secure verification. Zero card data stored on our site.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DCCF]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentOption === 'dc' ? 'border-[#802336] bg-[#802336]' : 'border-gray-400 bg-white'
                      }`}
                    >
                      {paymentOption === 'dc' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={paymentOption === 'dc' ? 'text-[#802336]' : 'text-gray-600'}>
                      {paymentOption === 'dc' ? 'Selected' : 'Select Debit Card'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-700">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>
            </div>

            {/* Honest Mobile Number Payment Guidance Strip (Phase 4) */}
            <div className="p-3.5 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start sm:items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4 text-[#802336] flex-shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  Customer Mobile linked to Cashfree:{' '}
                  <strong className="font-mono text-[#3B1E22]">
                    {normalizedPhone10 ? `+91 ${normalizedPhone10}` : 'Not entered'}
                  </strong>
                  <span className="text-gray-500 ml-1.5">
                    — Used by Cashfree for UPI/card receipts and bank verification. To pay, select UPI, Credit Card, or Debit Card above.
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[11px] font-bold text-[#802336] hover:underline shrink-0 self-end sm:self-auto cursor-pointer"
              >
                Edit Mobile
              </button>
            </div>

            {/* Secondary Manual Studio UPI QR Fallback ONLY when Cashfree gateway is not configured */}
            {cashfreeStatus && (!cashfreeStatus.isConfigured || cashfreeStatus.blockedOnLiveDomain) && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOption(paymentOption === 'manual_qr' ? 'upi' : 'manual_qr');
                    setPaymentError(null);
                  }}
                  className="text-[11px] font-semibold text-[#802336] hover:underline cursor-pointer inline-flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>
                    {paymentOption === 'manual_qr'
                      ? 'Back to Cashfree Instant Methods'
                      : 'Alternative: Direct Studio UPI QR (Manual 12-Digit UTR — Order stays Pending until verified)'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ACTIVE METHOD DETAIL & EXECUTION PANEL */}
          <div className="p-6 sm:p-8 bg-[#FAF7F2] rounded-3xl border border-[#E8DCCF] flex flex-col items-center text-center space-y-5">
            {paymentOption !== 'manual_qr' ? (
              <div className="w-full max-w-xl space-y-5 animate-fadeIn">
                <div className="p-5 sm:p-6 bg-white rounded-2xl border-2 border-[#802336] shadow-sm text-left space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E8DCCF] gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#802336] uppercase tracking-wider block">
                        Selected Cashfree Payment Mode
                      </span>
                      <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                        {getPaymentOptionLabel(paymentOption)}
                      </h3>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                        Payable Amount
                      </span>
                      <span className="font-serif text-xl sm:text-2xl font-bold text-[#802336]">
                        ₹{finalTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Mode-specific Accepted Badges */}
                  <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#DFB982] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        {paymentOption === 'upi'
                          ? 'Supported UPI Apps & Modes'
                          : paymentOption === 'cc'
                          ? 'Supported Credit Card Networks'
                          : 'Supported Debit Card Networks'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                        Server-Verified
                      </span>
                    </div>

                    {paymentOption === 'upi' ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md text-xs font-bold text-blue-900">
                          Google Pay
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-purple-200 rounded-md text-xs font-bold text-purple-900">
                          PhonePe
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-sky-200 rounded-md text-xs font-bold text-sky-900">
                          Paytm
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-md text-xs font-bold text-emerald-900">
                          BHIM UPI
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-bold text-gray-800">
                          UPI QR / UPI ID
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-blue-900">
                          VISA
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-red-600">
                          Mastercard
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-emerald-800">
                          RuPay
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md text-xs font-semibold text-blue-800">
                          3D Secure / Bank OTP
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Security & Environment Disclosure */}
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-blue-900">
                      <Lock className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                      <span>PCI-DSS Level 1 Cashfree Hosted Checkout</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-900/90">
                      {paymentOption === 'upi'
                        ? 'You can approve payment in Google Pay, PhonePe, Paytm, BHIM, or by scanning Cashfree’s dynamic UPI QR. After returning, we verify payment status securely with Cashfree before confirming your order.'
                        : 'Card numbers, CVV, and bank OTP are entered strictly inside Cashfree’s encrypted hosted checkout and are never stored by VIDHYAA Jewellery Studio.'}
                    </p>
                    {cashfreeStatus && (
                      <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="font-semibold text-blue-800">Gateway Mode:</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            cashfreeStatus.env === 'PRODUCTION'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {cashfreeStatus.env === 'PRODUCTION'
                            ? cashfreeStatus.isConfigured
                              ? 'Production (Live Payments)'
                              : 'Production (Credentials Missing)'
                            : cashfreeStatus.isConfigured
                            ? 'Sandbox Test Mode'
                            : 'Not Configured Yet'}
                        </span>
                      </div>
                    )}
                  </div>

                  {paymentError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{paymentError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    data-testid="cashfree-pay-now-btn"
                    disabled={isVerifying || (cashfreeStatus !== null && !cashfreeAvailable)}
                    onClick={() => handleCashfreePayment(paymentOption)}
                    className="w-full bg-[#0F5B46] hover:bg-[#0A3D2F] disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" />
                        <span>Connecting to Cashfree...</span>
                      </>
                    ) : cashfreeStatus !== null && !cashfreeAvailable ? (
                      <>
                        <Lock className="w-4 h-4 text-white/80" />
                        <span>Cashfree Credentials Required</span>
                      </>
                    ) : (
                      <>
                        {paymentOption === 'upi' ? (
                          <Smartphone className="w-4 h-4 text-[#DFB982]" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-[#DFB982]" />
                        )}
                        <span>
                          Pay ₹{finalTotal.toLocaleString('en-IN')} via{' '}
                          {paymentOption === 'upi'
                            ? 'UPI'
                            : paymentOption === 'cc'
                            ? 'Credit Card'
                            : 'Debit Card'}
                        </span>
                        <Lock className="w-3.5 h-3.5 text-white/80 ml-1" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Manual Studio UPI QR Fallback (only accessible when Cashfree is unavailable) */
              <div className="w-full max-w-md space-y-5">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-950">
                  <strong>Manual Studio Verification:</strong> Orders submitted with a 12-digit UTR remain in{' '}
                  <strong>Payment Pending</strong> status until verified in our studio bank account.
                </div>

                <GooglePayQRCard
                  payeeName={payeeName}
                  upiId={merchantVpa}
                  amount={finalTotal}
                  orderNumber={orderNumber}
                />

                <div className="pt-4 border-t border-[#E8DCCF] text-left space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B1E22]">
                    Enter 12-Digit UPI Reference / UTR Number *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 427819028471"
                    maxLength={12}
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 text-base font-mono font-bold tracking-widest border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#802336] bg-white text-gray-900"
                  />
                  {paymentError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-3 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Back
            </button>
            {paymentOption !== 'manual_qr' ? (
              <button
                type="button"
                disabled={isVerifying || (cashfreeStatus !== null && !cashfreeAvailable)}
                onClick={() => handleCashfreePayment(paymentOption)}
                className="bg-[#0F5B46] hover:bg-[#0A3D2F] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg flex items-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                    <span>Pay ₹{finalTotal.toLocaleString('en-IN')} Securely</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleVerifyManualUpiQr}
                className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                <span>{isVerifying ? 'Submitting...' : 'Submit UTR (Pending Verification)'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Verified Payment Success Screen OR Honest Pending UTR Submission Screen */}
      {step === 4 && completedOrder && (
        isOrderPaid(completedOrder) ? (
          <VerifiedPaymentSuccessView
            order={completedOrder}
            onViewMyOrders={() =>
              clearCompletedTokenAndNavigate(
                onViewMyOrders
                  ? onViewMyOrders
                  : () => onTrackOrder(completedOrder.orderNumber || completedOrder.id)
              )
            }
            onTrackOrder={(num) => clearCompletedTokenAndNavigate(() => onTrackOrder(num))}
            onContinueShopping={() => clearCompletedTokenAndNavigate(onNavigateHome)}
          />
        ) : (
          <WhatsAppOrderConfirmationView
            order={completedOrder}
            onViewMyOrders={() =>
              clearCompletedTokenAndNavigate(
                onViewMyOrders
                  ? onViewMyOrders
                  : () => onTrackOrder(completedOrder.orderNumber || completedOrder.id)
              )
            }
            onTrackOrder={(num) => clearCompletedTokenAndNavigate(() => onTrackOrder(num))}
            onContinueShopping={() => clearCompletedTokenAndNavigate(onNavigateHome)}
          />
        )
      )}
    </div>
  );
};
