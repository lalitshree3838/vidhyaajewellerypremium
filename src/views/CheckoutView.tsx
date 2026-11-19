import React, { useState, useEffect, useCallback } from 'react';
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
  Clock
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
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Payment Transaction ID
            </span>
            <span className="font-mono font-bold text-gray-900 break-all">{transactionId}</span>
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

  // Multi-step states: 1: Address, 2: Review, 3: Payment, 4: Confirmed / Submitted
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Address & Contact info
  const [name, setName] = useState(
    userProfile?.displayName || user?.displayName || patronSession?.displayName || ''
  );
  const [email, setEmail] = useState(
    userProfile?.email || user?.email || patronSession?.email || ''
  );
  const [phone, setPhone] = useState(
    userProfile?.phone || patronSession?.phone || patronSession?.mobile || ''
  );
  const [houseNo, setHouseNo] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Uttarakhand');
  const [pincode, setPincode] = useState('');
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Payment method states: Cashfree (UPI/Cards/Netbanking), UPI QR, UPI Phone, 1-Tap App, Bank VPA
  const [upiMethod, setUpiMethod] = useState<'card' | 'phone' | 'qr' | 'intent' | 'vpa'>('card');
  const [cashfreeStatus, setCashfreeStatus] = useState<{
    isConfigured: boolean;
    env: 'SANDBOX' | 'PRODUCTION';
    appIdMasked?: string;
    hasSecretKey?: boolean;
  } | null>(null);

  // Stable order number per active checkout session
  const [orderNumber, setOrderNumber] = useState<string>(() => getOrCreateDraftOrderNumber());

  const [utrNumber, setUtrNumber] = useState('');
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRestoringOrder, setIsRestoringOrder] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

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
      const candidate =
        userProfile?.phone || patronSession?.phone || patronSession?.mobile || '';
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

  // Merchant UPI Credentials
  const merchantVpa = storeSettings?.upiVpa || 'neerajchauhan2000-1@oksbi';
  const payeeName = storeSettings?.upiPayeeName || 'neeraj chauhan';
  const upiMobileNumber = storeSettings?.upiMobileNumber || '9758350524';

  const combinedStreet = [houseNo.trim(), area.trim()].filter(Boolean).join(', ');
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${finalTotal}&cu=INR&tn=${encodeURIComponent(`Vidhyaa Jewellery Order ${orderNumber}`)}`;

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
        sessionStorage.setItem(COMPLETED_ORDER_KEY, synced.orderNumber || synced.id);
      } catch {}
      setCompletedOrder(synced);
      clearCart();
      setStep(4);
      onOrderSuccess(synced);
    },
    [clearCart, onOrderSuccess]
  );

  const verifyAndFinalizeCashfreePayment = useCallback(
    async (cfOrderId: string) => {
      setIsVerifying(true);
      setPaymentError(null);
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

        const hasShippingInForm = Boolean(name.trim() && combinedStreet && city.trim() && pincode.trim());
        const shippingAddressPayload: Address | undefined = hasShippingInForm
          ? {
              id: `addr_${Date.now()}`,
              name: name.trim(),
              phone: formatIndianPhone(phone),
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
                    customerPhone: formatIndianPhone(phone),
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

        if (verifyData.success && verifyData.isPaid === true && verifyData.order) {
          if (verifyData.receiptToken) {
            saveOrderReceiptToken(verifyData.order.id, verifyData.receiptToken);
            saveOrderReceiptToken(verifyData.order.orderNumber || cfOrderId, verifyData.receiptToken);
          }
          await finalizeVerifiedOrderSuccess(verifyData.order);
          return true;
        }

        const gatewayStatus = String(verifyData.orderStatus || 'INCOMPLETE').toUpperCase();
        if (verifyData.isFailed || ['FAILED', 'CANCELLED', 'USER_DROPPED', 'TERMINATED', 'VOID', 'EXPIRED', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'].includes(gatewayStatus)) {
          setPaymentError(
            verifyData.failureReason ||
              verifyData.error ||
              `Payment ${gatewayStatus.toLowerCase()}. Your order was not confirmed and you can safely retry or choose another payment method.`
          );
        } else if (gatewayStatus === 'ACTIVE' || gatewayStatus === 'PENDING') {
          setPaymentError(
            'Payment was not completed yet (status: pending). Please complete the payment to confirm your order.'
          );
        } else {
          setPaymentError(
            verifyData.error ||
              `Payment verification did not return PAID (status: ${gatewayStatus}). Please retry safely.`
          );
        }
        return false;
      } catch {
        setPaymentError(
          'Unable to verify payment status with server right now. If your account was debited, please check My Orders or contact +91 7302187770.'
        );
        return false;
      } finally {
        setIsVerifying(false);
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

  // Return URL (?cf_order_id=...) and Page Refresh Recovery
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cfReturnOrderId = params.get('cf_order_id')?.trim();

    if (cfReturnOrderId) {
      setIsRestoringOrder(true);
      setStep(3);
      verifyAndFinalizeCashfreePayment(cfReturnOrderId).finally(() => {
        setIsRestoringOrder(false);
        try {
          const cleanUrl = `${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);
        } catch {}
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
      } catch {}
      destFn();
    },
    []
  );

  // If user has saved addresses, allow quick selection
  const handleSelectSavedAddress = (addr: Address) => {
    setStep1Error(null);
    setName(addr.name || '');
    setPhone(addr.phone || '');
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
    const phoneDigits = phone.replace(/\D/g, '').slice(-10);
    const cleanHouseNo = houseNo.trim();
    const cleanArea = area.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim();
    const cleanPin = pincode.replace(/\D/g, '');

    if (!cleanName || cleanName.length < 2) {
      setStep1Error('Please enter your full name for delivery.');
      return;
    }
    if (phoneDigits.length !== 10) {
      setStep1Error('Please enter a valid 10-digit Indian mobile number.');
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
    setPhone(formattedPhone);

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

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(merchantVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(upiMobileNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Manual Direct UPI UTR Submission (Maintains 'pending' status until verified — never falsely confirms payment)
  const handleVerifyUpiPayment = async () => {
    setPaymentError(null);
    setIsVerifying(true);

    const cleanUtr = utrNumber.trim();
    if (cleanUtr.length < 8) {
      setPaymentError('Please enter a valid 12-digit UPI Reference Number / UTR from your UPI payment app.');
      setIsVerifying(false);
      return;
    }

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

      let methodLabel = 'Direct UPI Mobile Transfer';
      if (upiMethod === 'qr') {
        methodLabel = 'Direct UPI QR Code';
      } else if (upiMethod === 'intent') {
        methodLabel = 'Direct UPI App Transfer';
      } else if (upiMethod === 'vpa') {
        methodLabel = 'Direct UPI ID / VPA';
      }

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
        paymentMethod: methodLabel,
        paymentStatus: 'pending',
        isPaid: false,
        currency: 'INR',
        upiReference: cleanUtr,
        orderStatus: 'Pending',
        trackingNumber: '',
        courierName: 'Atelier Express Dispatch',
        giftItem: subtotal >= 2000 ? 'Gold Imitation Bangles' : subtotal >= 1500 ? 'Gold Imitation Jhoomki' : undefined,
        notes:
          upiMethod === 'phone'
            ? `Manual UPI Mobile Number transfer to ${upiMobileNumber} (UTR: ${cleanUtr})`
            : upiMethod === 'qr'
            ? `Manual UPI QR Code transfer (UTR: ${cleanUtr})`
            : `Manual UPI transfer (UTR: ${cleanUtr})`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const savedOrder = await createOrder(newOrderData);
      try {
        sessionStorage.removeItem(DRAFT_ORDER_KEY);
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
    }
  };

  // Cashfree Online Payment Handler (UPI, Credit/Debit Card, Netbanking)
  const handleCashfreeCardPayment = async () => {
    setIsVerifying(true);
    setPaymentError(null);

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

      const customerHeaders = await resolveCheckoutCustomerHeaders([orderNumber]);
      let attemptOrderNumber = orderNumber;

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
            customerPhone: formattedPhone || '9758350524',
            shippingAddress,
            items: orderItems,
            subtotal,
            discount,
            appliedPromo: appliedPromo || undefined,
            deliveryCharge,
            userId: effectiveUserId,
            giftItem: subtotal >= 2000 ? 'Gold Imitation Bangles' : subtotal >= 1500 ? 'Gold Imitation Jhoomki' : undefined,
            paymentMethods: 'upi,cc,dc,nb',
            paymentMethod: 'Cashfree (UPI / Cards / Netbanking)',
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
            'Cashfree Payments Gateway is not yet configured with Live Merchant API credentials. You can pay via Direct UPI or configure Cashfree in Admin Settings.'
          );
        } else {
          setPaymentError(data.error || 'Failed to initialize Cashfree Hosted Checkout session. Please try again.');
        }
        setIsVerifying(false);
        return;
      }

      if (typeof (window as any).Cashfree === 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Cashfree Hosted Checkout SDK'));
          document.body.appendChild(script);
        });
      }

      const cashfree = (window as any).Cashfree({
        mode: cfMode === 'production' ? 'production' : 'sandbox'
      });

      cashfree
        .checkout({
          paymentSessionId,
          redirectTarget: '_modal'
        })
        .then(async (result: any) => {
          if (result?.error) {
            await verifyAndFinalizeCashfreePayment(cfOrderId);
            return;
          }
          await verifyAndFinalizeCashfreePayment(cfOrderId);
        })
        .catch(async () => {
          await verifyAndFinalizeCashfreePayment(cfOrderId);
        });
    } catch (err: any) {
      setIsVerifying(false);
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
                  Mobile Number (for Courier SMS) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 98290 12345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
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
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.src !== JEWELLERY_PLACEHOLDER_IMAGE) {
                          img.src = JEWELLERY_PLACEHOLDER_IMAGE;
                        }
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
                  {upiMethod === 'card' ? <CreditCard className="w-4 h-4 text-[#DFB982]" /> : <Smartphone className="w-4 h-4" />}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Selected Payment Option:
                  </span>
                  <div className="font-bold text-[#3B1E22] flex items-center gap-2">
                    <span>
                      {upiMethod === 'card' && 'Cashfree Online Payment (UPI • Cards • Netbanking)'}
                      {upiMethod === 'phone' && 'Pay by UPI Mobile Number'}
                      {upiMethod === 'qr' && 'Pay by UPI QR Code'}
                      {upiMethod === 'intent' && 'Google Pay (1-Tap UPI)'}
                      {upiMethod === 'vpa' && 'UPI ID / VPA'}
                    </span>
                    {upiMethod === 'phone' && (
                      <span className="font-mono text-[#802336] font-extrabold">{upiMobileNumber}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-600">
                    {upiMethod === 'card'
                      ? 'Official Hosted Checkout • Instant verification for UPI, Visa, Mastercard, RuPay & Netbanking'
                      : 'Direct UPI transfer verified by our studio team'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-[11px] font-bold text-[#802336] hover:underline self-start sm:self-auto cursor-pointer"
              >
                Change in Step 3 →
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
              <div className="flex items-center gap-2">
                <span className="bg-[#802336] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-xs">
                  <ShieldCheck className="w-3 h-3 text-[#DFB982]" />
                  <span>Secure Checkout</span>
                </span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Order #{orderNumber}
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#3B1E22] mt-1.5">
                Select Payment Method
              </h2>
              <p className="text-xs text-gray-500">
                Choose Cashfree instant online checkout (UPI, Cards, Netbanking) or direct UPI below.
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

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-[#3B1E22]">
                  Select Payment Option (Choose Preferred Method)
                </label>
                <p className="text-xs text-gray-500">
                  Cashfree Instant Gateway (UPI, Cards & Netbanking), UPI QR Code, and Direct Mobile UPI are supported.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#802336] bg-[#FAF7F2] px-3 py-1 rounded-full border border-[#E8DCCF]">
                3 Options Available
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Option 1: Cashfree Payments Gateway (UPI, Cards & Netbanking) */}
              <button
                type="button"
                onClick={() => setUpiMethod('card')}
                className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  upiMethod === 'card'
                    ? 'bg-[#FAF7F2] border-[#802336] ring-2 ring-[#802336]/30 shadow-md'
                    : 'bg-white border-[#E8DCCF] hover:border-[#802336]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                      upiMethod === 'card' ? 'bg-[#0F5B46] text-white shadow-xs' : 'bg-[#FAF7F2] text-[#0F5B46] border border-[#E8DCCF]'
                    }`}>
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                        Instant Verify
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 px-2 py-1 rounded-full border border-purple-200">
                        UPI • Cards
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Option 1
                  </span>
                  <h3 className="text-base font-bold text-[#3B1E22] mt-0.5">
                    Online Payment (UPI / Cards)
                  </h3>
                  <p className="text-xs font-semibold text-[#0F5B46] mt-1">
                    Pay ₹{finalTotal.toLocaleString('en-IN')} via Cashfree
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    Official 3D Secure & UPI checkout. Supports GPay, PhonePe, Visa, Mastercard, RuPay & Netbanking.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DCCF]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      upiMethod === 'card' ? 'border-[#802336] bg-[#802336]' : 'border-gray-400 bg-white'
                    }`}>
                      {upiMethod === 'card' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={upiMethod === 'card' ? 'text-[#802336]' : 'text-gray-600'}>
                      {upiMethod === 'card' ? 'Selected Method' : 'Tap to Select'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-700">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>

              {/* Option 2: Pay by UPI QR Code */}
              <button
                type="button"
                onClick={() => setUpiMethod('qr')}
                className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  upiMethod === 'qr'
                    ? 'bg-[#FAF7F2] border-[#802336] ring-2 ring-[#802336]/30 shadow-md'
                    : 'bg-white border-[#E8DCCF] hover:border-[#802336]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                      upiMethod === 'qr' ? 'bg-[#802336] text-white shadow-xs' : 'bg-[#FAF7F2] text-[#802336] border border-[#E8DCCF]'
                    }`}>
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                        Scan & Pay
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                        Auto-Amount
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Option 2
                  </span>
                  <h3 className="text-base font-bold text-[#3B1E22] mt-0.5">
                    Pay by UPI QR Code
                  </h3>
                  <p className="text-xs font-semibold text-[#802336] mt-1">
                    Scan with any UPI app to pay ₹{finalTotal.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    Displays verified UPI QR code on screen. Supports Google Pay, PhonePe, Paytm, BHIM & CRED.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DCCF]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      upiMethod === 'qr' ? 'border-[#802336] bg-[#802336]' : 'border-gray-400 bg-white'
                    }`}>
                      {upiMethod === 'qr' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={upiMethod === 'qr' ? 'text-[#802336]' : 'text-gray-600'}>
                      {upiMethod === 'qr' ? 'Selected Method' : 'Tap to Select'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-700">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>

              {/* Option 3: Pay by UPI Contact Number */}
              <button
                type="button"
                onClick={() => setUpiMethod('phone')}
                className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  upiMethod === 'phone'
                    ? 'bg-[#FAF7F2] border-[#802336] ring-2 ring-[#802336]/30 shadow-md'
                    : 'bg-white border-[#E8DCCF] hover:border-[#802336]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                      upiMethod === 'phone' ? 'bg-[#802336] text-white shadow-xs' : 'bg-[#FAF7F2] text-[#802336] border border-[#E8DCCF]'
                    }`}>
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#802336] text-white px-2.5 py-1 rounded-full shadow-xs">
                        Contact Transfer
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                        Active UPI
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Option 3
                  </span>
                  <h3 className="text-base font-bold text-[#3B1E22] mt-0.5">
                    Pay by UPI Contact Number
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-sm font-extrabold text-[#802336]">
                      {upiMobileNumber}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      (neeraj chauhan)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    Send directly to our registered mobile contact number using any UPI app with easy 1-click copy.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DCCF]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      upiMethod === 'phone' ? 'border-[#802336] bg-[#802336]' : 'border-gray-400 bg-white'
                    }`}>
                      {upiMethod === 'phone' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={upiMethod === 'phone' ? 'text-[#802336]' : 'text-gray-600'}>
                      {upiMethod === 'phone' ? 'Selected Method' : 'Tap to Select'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-700">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>
            </div>

            {/* Alternate Gateway Options (1-Tap App Pay & Bank VPA) kept accessible */}
            <div className="flex items-center justify-center gap-3 pt-1 text-xs text-gray-500">
              <span className="text-[11px]">Other Options:</span>
              <button
                type="button"
                onClick={() => setUpiMethod('intent')}
                className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                  upiMethod === 'intent' ? 'text-[#802336] font-bold underline' : 'text-gray-600'
                }`}
              >
                ⚡ 1-Tap App Pay (Mobile)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setUpiMethod('vpa')}
                className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                  upiMethod === 'vpa' ? 'text-[#802336] font-bold underline' : 'text-gray-600'
                }`}
              >
                🏦 UPI ID / VPA ({merchantVpa})
              </button>
            </div>
          </div>

          {/* METHOD CONTENT CONTAINER */}
          <div className="p-6 sm:p-8 bg-[#FAF7F2] rounded-3xl border border-[#E8DCCF] flex flex-col items-center text-center space-y-6">
            
            {/* 0. CREDIT / DEBIT CARD VIEW (CASHFREE HOSTED CHECKOUT) */}
            {upiMethod === 'card' && (
              <div className="w-full max-w-xl space-y-5 animate-fadeIn">
                <div className="p-5 sm:p-6 bg-white rounded-2xl border-2 border-[#802336] shadow-sm text-left space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E8DCCF] gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#802336] uppercase tracking-wider block">
                        Selected Method
                      </span>
                      <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                        Cashfree Online Checkout (UPI • Cards • Netbanking)
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

                  {/* Supported Payment Networks Banner */}
                  <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#DFB982] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        Accepted Payment Modes
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                        3D Secure & Instant Verify
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2.5 py-1 bg-white border border-emerald-300 rounded-md text-xs font-black tracking-wider text-emerald-800 shadow-xs">
                        UPI (GPay / PhonePe / Paytm)
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-blue-900 shadow-xs">
                        VISA
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-red-600 shadow-xs">
                        Mastercard
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-emerald-800 shadow-xs">
                        RuPay
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-bold tracking-wider text-blue-700 shadow-xs">
                        Netbanking
                      </span>
                    </div>
                  </div>

                  {/* Gateway Environment Status Indicator */}
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-blue-900">
                      <Lock className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                      <span>Official Cashfree Hosted Checkout</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-900/90">
                      Complete your payment via Cashfree's PCI-DSS Level 1 gateway using UPI, Credit/Debit Card, or Netbanking. Order confirmation appears immediately after gateway verification.
                    </p>
                    {cashfreeStatus && (
                      <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="font-semibold text-blue-800">Mode:</span>
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          cashfreeStatus.env === 'PRODUCTION'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {cashfreeStatus.env === 'PRODUCTION' ? 'Production (Live Payments)' : 'Sandbox Test Mode'}
                        </span>
                        {!cashfreeStatus.isConfigured && (
                          <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Merchant App ID & Secret Key required in Admin Settings or .env
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Error if any */}
                  {paymentError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{paymentError}</span>
                    </div>
                  )}

                  {/* Payment Action Button */}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={handleCashfreeCardPayment}
                    className="w-full bg-[#0F5B46] hover:bg-[#0A3D2F] disabled:bg-gray-400 text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" />
                        <span>Processing Cashfree Checkout...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-[#DFB982]" />
                        <span>Pay ₹{finalTotal.toLocaleString('en-IN')} Now</span>
                        <Lock className="w-3.5 h-3.5 text-white/80 ml-1" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 1. PAY BY UPI MOBILE NUMBER VIEW */}
            {upiMethod === 'phone' && (
              <div className="w-full max-w-xl space-y-5">
                <div className="p-5 sm:p-6 bg-white rounded-2xl border-2 border-[#802336] shadow-sm text-left space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E8DCCF] gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#802336] uppercase tracking-wider block">
                        Selected Method
                      </span>
                      <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                        Pay by UPI Mobile Number
                      </h3>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                        Order Total to Pay
                      </span>
                      <span className="font-serif text-xl sm:text-2xl font-bold text-[#802336]">
                        ₹{finalTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Prominent Contact Number Card with Working Copy Button */}
                  <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#DFB982] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                        UPI Contact Number
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#3B1E22] tracking-wider select-all">
                          {upiMobileNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Active UPI
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                        copiedPhone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#802336] hover:bg-[#681c2b] text-white'
                      }`}
                    >
                      {copiedPhone ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-[#DFB982]" />}
                      <span>{copiedPhone ? `Copied ${upiMobileNumber}!` : 'Copy Number'}</span>
                    </button>
                  </div>

                  {/* Mandatory Recipient Verification Warning */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>Please Verify Recipient Name Before Transfer</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900/90">
                      When paying to mobile number <strong className="font-mono">{upiMobileNumber}</strong> in your UPI app, please confirm the verified recipient name appears as <strong className="text-black">{payeeName}</strong> before approving the payment.
                    </p>
                  </div>

                  {/* Step by Step Instructions */}
                  <div className="space-y-2 pt-1 text-xs text-gray-700">
                    <h4 className="font-bold uppercase tracking-wider text-[11px] text-[#3B1E22] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#802336]" />
                      <span>Payment Instructions:</span>
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-600 pl-1 leading-relaxed">
                      <li>Open any supported UPI app (<span className="font-semibold text-gray-800">Google Pay, PhonePe, Paytm, BHIM, CRED</span>).</li>
                      <li>Choose <strong className="text-gray-900">"Pay to Mobile Number"</strong> or <strong className="text-gray-900">"Pay Contacts"</strong>.</li>
                      <li>Enter or paste mobile number <strong className="font-mono text-gray-900">{upiMobileNumber}</strong>.</li>
                      <li>Verify the recipient name displays as <strong className="text-gray-900">{payeeName}</strong>.</li>
                      <li>Enter the exact order total of <strong className="text-[#802336]">₹{finalTotal.toLocaleString('en-IN')}</strong> and complete payment with your UPI PIN.</li>
                      <li>After paying, copy the 12-digit <strong className="text-gray-900">UPI Reference Number / UTR</strong> and enter it below.</li>
                    </ol>
                  </div>

                  {/* Supported UPI Apps Row */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400 font-medium">Supported UPI Apps:</span>
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-700">
                      <span className="bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8DCCF]">Google Pay</span>
                      <span className="bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8DCCF]">PhonePe</span>
                      <span className="bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8DCCF]">Paytm</span>
                      <span className="bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8DCCF]">BHIM</span>
                      <span className="bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8DCCF]">CRED</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. GOOGLE PAY QR VIEW */}
            {upiMethod === 'qr' && (
              <GooglePayQRCard
                payeeName={payeeName}
                upiId={merchantVpa}
                amount={finalTotal}
                orderNumber={orderNumber}
              />
            )}

            {/* 3. 1-TAP APP PAY VIEW */}
            {upiMethod === 'intent' && (
              <div className="w-full max-w-md space-y-4">
                <div className="p-4 bg-white rounded-2xl border border-[#E8DCCF] text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Instant 1-Tap Mobile Payment
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    If you are on your smartphone or tablet, tap below to open Google Pay directly with the exact order amount (<strong>₹{finalTotal.toLocaleString('en-IN')}</strong>) pre-filled.
                  </p>
                </div>

                {/* Primary Google Pay Intent */}
                <a
                  href={upiDeepLink}
                  className="w-full p-4 bg-gradient-to-r from-[#1A73E8] to-[#1557B0] hover:from-[#1557B0] hover:to-[#0D47A1] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-md transition-all hover:shadow-lg"
                >
                  <div className="bg-white p-1 rounded-full">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                  </div>
                  <span>Pay ₹{finalTotal.toLocaleString('en-IN')} with Google Pay</span>
                </a>

                {/* Alternate UPI Apps */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <a
                    href={upiDeepLink}
                    className="p-3 bg-white rounded-xl border border-[#E8DCCF] hover:border-[#5F259F] text-xs font-semibold text-[#3B1E22] flex items-center justify-center gap-2 shadow-xs hover:bg-purple-50/30 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#5F259F]" />
                    <span>PhonePe</span>
                  </a>
                  <a
                    href={upiDeepLink}
                    className="p-3 bg-white rounded-xl border border-[#E8DCCF] hover:border-[#00BAF2] text-xs font-semibold text-[#3B1E22] flex items-center justify-center gap-2 shadow-xs hover:bg-sky-50/30 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00BAF2]" />
                    <span>Paytm UPI</span>
                  </a>
                  <a
                    href={upiDeepLink}
                    className="p-3 bg-white rounded-xl border border-[#E8DCCF] hover:border-gray-800 text-xs font-semibold text-[#3B1E22] flex items-center justify-center gap-2 shadow-xs hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-black" />
                    <span>CRED UPI</span>
                  </a>
                  <a
                    href={upiDeepLink}
                    className="p-3 bg-white rounded-xl border border-[#E8DCCF] hover:border-[#0F4C4A] text-xs font-semibold text-[#3B1E22] flex items-center justify-center gap-2 shadow-xs hover:bg-emerald-50/30 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#0F4C4A]" />
                    <span>Any UPI App</span>
                  </a>
                </div>
              </div>
            )}

            {/* 4. UPI ID / VPA VIEW */}
            {upiMethod === 'vpa' && (
              <div className="w-full max-w-md space-y-4">
                <div className="p-5 bg-white rounded-2xl border border-[#E8DCCF] shadow-sm text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Google Pay Merchant UPI VPA
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      SBI Verified
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-medium">
                        Payee Name: <strong className="text-gray-800">{payeeName}</strong>
                      </span>
                      <span className="font-mono text-sm sm:text-base font-bold text-[#3B1E22] select-all">
                        {merchantVpa}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-[#802336] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs border border-[#E8DCCF]"
                    >
                      {copiedVpa ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedVpa ? 'Copied!' : 'Copy ID'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-500">
                    Open your banking or UPI app, choose "Pay to UPI ID / VPA", enter <span className="font-mono font-semibold text-gray-800">{merchantVpa}</span>, verify the payee is <strong>{payeeName}</strong>, and send ₹{finalTotal.toLocaleString('en-IN')}.
                  </p>
                </div>
              </div>
            )}

            {/* MANDATORY 12-DIGIT UPI REFERENCE / UTR INPUT (UPI ONLY) */}
            {upiMethod !== 'card' && (
              <div className="w-full max-w-md pt-5 border-t border-[#E8DCCF] text-left space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B1E22]">
                    Enter 12-Digit UPI Reference / UTR Number *
                  </label>
                  <span className="text-[10px] text-[#802336] font-semibold bg-[#802336]/10 px-2 py-0.5 rounded-full">
                    Mandatory for Dispatch
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 427819028471"
                    maxLength={12}
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 text-base font-mono font-bold tracking-widest border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#802336] bg-white text-gray-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400 placeholder:text-xs"
                  />
                  {utrNumber.length === 12 && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>Valid</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200 text-[11px] text-gray-600 space-y-1">
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>Where to find this in your UPI app?</span>
                  </div>
                  <p>
                    After paying in Google Pay, PhonePe, or Paytm, tap the payment in your transaction history and copy the 12-digit number labeled <strong>"UPI transaction ID"</strong>, <strong>"UTR"</strong>, or <strong>"Ref No."</strong>.
                  </p>
                </div>

                {paymentError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}
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
            {upiMethod === 'card' ? (
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleCashfreeCardPayment}
                className="bg-[#0F5B46] hover:bg-[#0A3D2F] text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" />
                    <span>Connecting to Cashfree...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-[#DFB982]" />
                    <span>Pay ₹{finalTotal.toLocaleString('en-IN')} Now</span>
                    <Lock className="w-3.5 h-3.5 text-white/80" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleVerifyUpiPayment}
                className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isVerifying ? (
                  <span>Submitting Order...</span>
                ) : upiMethod === 'phone' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                    <span>Submit Order (Pay to {upiMobileNumber})</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                    <span>Submit UTR & Place Order</span>
                  </>
                )}
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
