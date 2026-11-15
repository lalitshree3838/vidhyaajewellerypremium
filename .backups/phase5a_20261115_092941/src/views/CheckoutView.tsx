import React, { useState, useEffect } from 'react';
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
  Gift
} from 'lucide-react';
import { Address, Order, OrderItem, StoreSettings } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../lib/dbService';
import { GooglePayQRCard } from '../components/GooglePayQRCard';
import { isGenuineImageUrl } from '../lib/sampleData';
import { formatPrice, OrderSavingsSummaryCard } from '../lib/priceUtils';

interface WhatsAppOrderConfirmationViewProps {
  order: Order;
  onTrackOrder: (orderNumber: string) => void;
  onContinueShopping: () => void;
}

const WhatsAppOrderConfirmationView: React.FC<WhatsAppOrderConfirmationViewProps> = ({
  order,
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

  const isPaid = order?.paymentStatus === 'paid' || order?.orderStatus === 'Confirmed';
  const orderId = order?.orderNumber || order?.id || 'N/A';

  let orderDateTime = 'Just now';
  try {
    orderDateTime = new Date(order?.createdAt || Date.now()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    // fallback already set
  }

  const customerName =
    order?.customerName ||
    (order?.shippingAddress as any)?.fullName ||
    'Valued Patron';
  const customerMobile = order?.customerPhone || order?.shippingAddress?.phone || 'N/A';
  const customerEmail = order?.customerEmail || 'Not Provided';

  let address = 'Delivery address provided at checkout';
  if (order?.shippingAddress) {
    const parts = [
      order.shippingAddress.street,
      order.shippingAddress.landmark,
      order.shippingAddress.city,
      order.shippingAddress.state
        ? `${order.shippingAddress.state} - ${order.shippingAddress.pincode || ''}`
        : order.shippingAddress.pincode
    ].filter(Boolean);
    if (parts.length > 0) address = parts.join(', ');
  }

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

  const subtotal =
    typeof order?.subtotal === 'number'
      ? order.subtotal
      : Number(order?.subtotal) || totalFallback;
  const discount = typeof order?.discount === 'number' ? order.discount : Number(order?.discount) || 0;
  const deliveryCharge = typeof order?.deliveryCharge === 'number' ? order.deliveryCharge : 0;
  const totalAmount =
    typeof order?.totalAmount === 'number' ? order.totalAmount : totalFallback;
  const paymentMethod = order?.paymentMethod || 'Online Payment';
  const transactionId =
    order?.paymentId || order?.upiReference || order?.cardNetwork || 'Verified via Payment Gateway';
  const paymentStatusText = isPaid ? 'SUCCESSFUL' : 'PENDING VERIFICATION';

  const preparedMessage =
    `Vidhyaa Jewellery Studio\nORDER CONFIRMATION REQUEST\n\n` +
    `Order ID: ${orderId}\nOrder Date and Time: ${orderDateTime}\n\n` +
    `Customer Details:\n• Customer Name: ${customerName}\n• Customer Mobile Number: ${customerMobile}\n• Customer Email: ${customerEmail}\n\n` +
    `Complete Delivery Address:\n${address}\n\n` +
    `Products Ordered:\n${itemsFormatted}\n\n` +
    `Financial Breakdown:\n• Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n• Discount: ₹${discount.toLocaleString('en-IN')}\n• Shipping Charges: ₹${deliveryCharge.toLocaleString('en-IN')}\n• ${isPaid ? 'Final Paid Amount' : 'Final Payable Amount'}: ₹${totalAmount.toLocaleString('en-IN')}\n\n` +
    `Payment Information:\n• Payment Method: ${paymentMethod}\n• Payment Transaction ID: ${transactionId}\n• Payment Status: ${paymentStatusText}\n\n` +
    `Please confirm this order for delivery.`;

  const whatsappUrl = `https://wa.me/917302187770?text=${encodeURIComponent(preparedMessage)}`;

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setHasClickedWhatsApp(true);
  };

  const handleConfirmSent = async () => {
    setIsSubmitting(true);
    try {
      await fetch(
        `/api/orders/${encodeURIComponent(order.id || order.orderNumber)}/customer-whatsapp-confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsappCustomerConfirmed: true })
        }
      ).catch(() => {});
      setIsConfirmed(true);
    } catch {
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
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E8DCCF] p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-fadeIn max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pb-4 border-b border-[#E8DCCF] text-xs font-bold tracking-wide">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs ${
            isPaid
              ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
              : 'text-amber-900 bg-amber-50 border-amber-300'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] font-extrabold ${
              isPaid ? 'bg-emerald-600' : 'bg-amber-500'
            }`}
          >
            {isPaid ? '✓' : '1'}
          </span>
          <span>{isPaid ? '1. Payment Successful' : '1. Order Submitted'}</span>
        </div>
        <span className="text-gray-400">→</span>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs transition-all ${
            isConfirmed
              ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
              : 'text-amber-900 bg-amber-50 border-amber-400 ring-2 ring-amber-300'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
              isConfirmed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white animate-pulse'
            }`}
          >
            {isConfirmed ? '✓' : '2'}
          </span>
          <span>{isConfirmed ? '2. WhatsApp Confirmed ✓' : '2. Confirm on WhatsApp'}</span>
        </div>
        <span className="text-gray-400">→</span>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs ${
            isConfirmed
              ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
              : 'text-gray-400 bg-gray-50 border-gray-200'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
              isConfirmed ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-white'
            }`}
          >
            {isConfirmed ? '✓' : '3'}
          </span>
          <span>3. Atelier Packing</span>
        </div>
      </div>

      {!isConfirmed ? (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white shadow-xs ${
                isPaid ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            >
              {isPaid ? '✓ Payment Successful' : '⏳ Payment Pending Verification'}
            </span>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs animate-pulse">
              ⚠️ WhatsApp Message Not Yet Sent
            </span>
          </div>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-[#3B1E22]">
            Mandatory Step: Confirm Your Order on WhatsApp
          </h2>
          <p className="text-xs text-gray-700 leading-relaxed">
            {isPaid
              ? `Your payment of ₹${totalAmount.toLocaleString('en-IN')} has been verified and Order ${orderId} is safely saved in our database. To schedule atelier packing and delivery, please tap the green button below to send the pre-filled order confirmation to our studio owner at 7302187770.`
              : `Your order ${orderId} (₹${totalAmount.toLocaleString('en-IN')}) has been saved and is awaiting payment verification. Please tap the green button below to send your pre-filled order & payment reference details on WhatsApp to our studio owner at 7302187770.`}
          </p>
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white shadow-xs ${
                isPaid ? 'bg-emerald-700' : 'bg-amber-600'
              }`}
            >
              {isPaid ? '✓ Payment Successful' : '⏳ Payment Pending Verification'}
            </span>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-700 text-white shadow-xs">
              ✓ WhatsApp Confirmation Completed
            </span>
          </div>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-emerald-950">
            ✓ Order Confirmation Sent on WhatsApp!
          </h2>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Thank you for completing WhatsApp confirmation! Studio owner (+91 7302187770) has received your order details.{' '}
            {isPaid
              ? 'Your royal handcrafted pieces are now being prepared at our Roorkee atelier.'
              : 'Once your UPI payment reference is verified, your royal handcrafted pieces will be prepared at our Roorkee atelier.'}
          </p>
        </div>
      )}

      {!isConfirmed && (
        <div className="space-y-4 py-2">
          <button
            onClick={handleOpenWhatsApp}
            className="w-full max-w-md mx-auto bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white font-black text-sm sm:text-base px-6 py-4 rounded-2xl shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer border-2 border-emerald-400 group"
          >
            <svg className="w-6 h-6 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            <span className="tracking-wide">CONFIRM ORDER ON WHATSAPP</span>
          </button>
          <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
            Opens official WhatsApp chat with Vidhyaa Studio Owner (+91 7302187770) with your complete order message pre-filled.
          </p>
        </div>
      )}

      {!isConfirmed && hasClickedWhatsApp && (
        <div className="bg-[#FAF7F2] border-2 border-[#DFB982] rounded-2xl p-5 sm:p-6 text-center space-y-3.5 animate-fadeIn max-w-lg mx-auto shadow-sm">
          <div className="text-2xl">📱</div>
          <h3 className="font-serif text-base sm:text-lg font-bold text-[#3B1E22]">
            Did you press the SEND button in WhatsApp?
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Please ensure you switched to WhatsApp and pressed the SEND (➤) button to send the prepared order message to 7302187770. Once sent, click below to finalize confirmation:
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleConfirmSent}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-[#3B1E22] hover:bg-[#802336] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span className="text-[#DFB982] font-black">✓</span>
              <span>{isSubmitting ? 'Saving Confirmation...' : 'I Have Sent the Message on WhatsApp'}</span>
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto bg-white border border-[#3B1E22] text-[#3B1E22] hover:bg-gray-100 font-bold text-xs px-4 py-3 rounded-xl cursor-pointer transition-all"
            >
              Re-open WhatsApp
            </button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto bg-[#FAF7F2] p-5 sm:p-6 rounded-2xl border border-[#E8DCCF] text-left space-y-3 text-xs shadow-xs">
        <div className="flex justify-between items-center pb-2 border-b border-[#E8DCCF]">
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Order Number</span>
            <span className="font-mono font-bold text-sm text-[#3B1E22]">{orderId}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Order Date & Time</span>
            <span className="font-mono text-gray-700 text-xs font-semibold">{orderDateTime}</span>
          </div>
        </div>

        <div className="space-y-1.5 py-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Customer Name</span>
            <span className="font-bold text-gray-800">{customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Mobile Number</span>
            <span className="font-bold text-gray-800">{customerMobile}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email Address</span>
            <span className="text-gray-700">{customerEmail}</span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-500 shrink-0">Delivery Address</span>
            <span className="text-gray-800 text-right font-medium max-w-xs">{address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method</span>
            <span className="font-semibold text-gray-800">{paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Transaction ID / UTR</span>
            <span className="font-mono font-bold text-gray-700">{transactionId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Payment Status</span>
            <span
              className={`font-extrabold uppercase text-[11px] border px-2 py-0.5 rounded-full ${
                isPaid
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
                  : 'text-amber-800 bg-amber-50 border-amber-300'
              }`}
            >
              {isPaid ? 'SUCCESSFUL (PAID)' : 'PENDING VERIFICATION'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">WhatsApp Status</span>
            <span
              className={`font-extrabold uppercase text-[11px] px-2 py-0.5 rounded-full ${
                isConfirmed
                  ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                  : 'text-amber-900 bg-amber-100 border border-amber-300'
              }`}
            >
              {isConfirmed ? '✓ CONFIRMED ON WHATSAPP' : 'CONFIRMATION PENDING'}
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <div className="pt-2 border-t border-[#E8DCCF] space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Ordered Products
            </span>
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0"
              >
                <div className="text-gray-800 font-medium">
                  {idx + 1}. {item.productName || (item as any).title}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </div>
                <div className="font-semibold text-gray-900">
                  ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-[#E8DCCF] space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Product Subtotal</span>
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
            <span>{isPaid ? 'Final Paid Amount' : 'Final Payable Amount'}</span>
            <span className="text-[#802336]">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto text-left">
        <button
          onClick={() => setShowFullReceipt(!showFullReceipt)}
          className="text-xs font-bold text-[#3B1E22] hover:text-[#802336] underline cursor-pointer flex items-center gap-1"
        >
          {showFullReceipt
            ? '▲ Hide Prepared WhatsApp Message'
            : '▼ View Prepared WhatsApp Message to 7302187770'}
        </button>
        {showFullReceipt && (
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-mono text-gray-700 whitespace-pre-wrap relative">
            {preparedMessage}
            <button
              onClick={handleCopyMessage}
              className="mt-2 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded cursor-pointer block"
            >
              {copied ? '✓ Copied to Clipboard!' : 'Copy Message Text'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <button
          onClick={() => onTrackOrder(orderId)}
          className="w-full sm:w-auto bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          <span className="text-[#DFB982]">📦</span>
          <span>Track Order Live</span>
        </button>
        <button
          onClick={onContinueShopping}
          className="w-full sm:w-auto bg-white border border-[#E8DCCF] hover:bg-gray-50 text-[#3B1E22] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Continue Shopping
        </button>
        <button
          onClick={handleOpenWhatsApp}
          className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>💬</span>
          <span>Chat with Studio Owner</span>
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
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  storeSettings,
  onOrderSuccess,
  onNavigateHome,
  onTrackOrder
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
    clearCart,
    freeDeliveryThreshold,
    appliedPromo
  } = useCart();

  const { user, userProfile, saveAddress } = useAuth();

  // Multi-step states: 1: Address, 2: Review, 3: UPI Payment, 4: Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Address & Contact info
  const [name, setName] = useState(userProfile?.displayName || user?.displayName || '');
  const [email, setEmail] = useState(userProfile?.email || user?.email || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Rajasthan');
  const [pincode, setPincode] = useState('');
  const [saveToAccount, setSaveToAccount] = useState(true);

  // Payment method states: Credit/Debit Card (Cashfree), UPI Phone, UPI QR, 1-Tap App, Bank VPA
  const [upiMethod, setUpiMethod] = useState<'card' | 'phone' | 'qr' | 'intent' | 'vpa'>('card');
  const [cashfreeStatus, setCashfreeStatus] = useState<{
    isConfigured: boolean;
    env: 'SANDBOX' | 'PRODUCTION';
    appIdMasked?: string;
    hasSecretKey?: boolean;
  } | null>(null);

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

  const [utrNumber, setUtrNumber] = useState('');
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Merchant UPI Credentials
  const merchantVpa = storeSettings?.upiVpa || 'neerajchauhan2000-1@oksbi';
  const payeeName = storeSettings?.upiPayeeName || 'neeraj chauhan';
  const upiMobileNumber = storeSettings?.upiMobileNumber || '9758350524';

  const orderNumber = `VDH-${Math.floor(100000 + Math.random() * 900000)}`;
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${finalTotal}&cu=INR&tn=${encodeURIComponent(`Vidhyaa Jewellery Order ${orderNumber}`)}`;

  // If user has saved addresses, allow quick selection
  const handleSelectSavedAddress = (addr: Address) => {
    setName(addr.name);
    setPhone(addr.phone);
    setStreet(addr.street);
    setLandmark(addr.landmark || '');
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !street.trim() || !city.trim() || !pincode.trim()) {
      alert('Please fill in all mandatory delivery fields.');
      return;
    }
    if (saveToAccount && user) {
      saveAddress({
        id: `addr_${Date.now()}`,
        name,
        phone,
        street,
        landmark,
        city,
        state,
        pincode
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

  // Payment Verification and Order Creation
  const handleVerifyUpiPayment = async () => {
    setPaymentError(null);
    setIsVerifying(true);

    // Validate UTR / Reference
    const cleanUtr = utrNumber.trim();
    if (cleanUtr.length < 8) {
      setPaymentError('Please enter a valid 12-digit UPI Reference Number / UTR from your UPI payment app.');
      setIsVerifying(false);
      return;
    }

    try {
      // Simulate gateway verification handshake
      await new Promise((resolve) => setTimeout(resolve, 1500));

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

      const shippingAddress: Address = {
        id: `addr_${Date.now()}`,
        name,
        phone,
        street,
        landmark,
        city,
        state,
        pincode
      };

      let methodLabel = 'Pay by UPI Mobile Number';
      if (upiMethod === 'qr') {
        methodLabel = 'Pay by UPI QR Code';
      } else if (upiMethod === 'intent') {
        methodLabel = 'Google Pay (1-Tap UPI)';
      } else if (upiMethod === 'vpa') {
        methodLabel = 'UPI ID / VPA';
      }

      const newOrderData: Omit<Order, 'id'> = {
        orderNumber,
        userId: user?.uid,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        shippingAddress,
        items: orderItems,
        originalTotal,
        productSavings,
        couponSavings: discount,
        totalSavings,
        subtotal,
        discount,
        deliveryCharge,
        totalAmount: finalTotal,
        paymentMethod: methodLabel,
        // Maintain 'pending' until verified by merchant/gateway; do not falsely mark paid
        paymentStatus: 'pending',
        paymentId: `PAY_UPI_${Date.now()}`,
        upiReference: cleanUtr,
        orderStatus: 'Pending',
        trackingNumber: `BD${Math.floor(100000000 + Math.random() * 900000000)}IN`,
        courierName: 'BlueDart Express',
        giftItem: subtotal >= 2000 ? 'Gold Imitation Bangles' : subtotal >= 1500 ? 'Gold Imitation Jhoomki' : undefined,
        notes: upiMethod === 'phone'
          ? `Paid via UPI Mobile Number: ${upiMobileNumber}`
          : upiMethod === 'qr'
          ? `Paid via UPI QR Code (Merchant: ${payeeName})`
          : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const savedOrder = await createOrder(newOrderData);

      // Trigger Celebration Confetti
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#802336', '#FAF7F2']
        });
      } catch (e) {
        // ignore confetti errors
      }

      setCompletedOrder(savedOrder);
      clearCart();
      setStep(4);
      onOrderSuccess(savedOrder);
    } catch (err) {
      setPaymentError('Payment submission failed. Please check the UTR and try again or contact support.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Cashfree Credit / Debit Card Payment Handlers
  const handleCashfreeCardPayment = async () => {
    setIsVerifying(true);
    setPaymentError(null);

    try {
      const res = await fetch('/api/payments/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `VDH_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
          orderAmount: finalTotal,
          customerName: name.trim() || 'Valued Patron',
          customerEmail: email.trim() || 'patron@vidhyaajewellery.com',
          customerPhone: phone.trim() || '9758350524',
          orderNote: `VIDHYAA Order ${orderNumber} (${items.length} items)`
        })
      });

      const data = await res.json().catch(() => ({}));

      const paymentSessionId = data.paymentSessionId || data.payment_session_id;
      const cfOrderId = data.orderId || data.order_id;
      const cfMode = data.mode;

      if (!res.ok || !data.success || !paymentSessionId) {
        if (data.configured === false) {
          setPaymentError('Cashfree Payments Gateway requires configuration. Please enter your Cashfree App ID & Secret Key in Admin Settings > Cashfree Gateway or set CASHFREE_APP_ID in your environment. You can also pay instantly via UPI.');
        } else {
          setPaymentError(data.error || 'Failed to initialize Cashfree Hosted Checkout session. Please try again.');
        }
        setIsVerifying(false);
        return;
      }

      // Ensure Cashfree JS SDK is loaded
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

      // Launch Cashfree Hosted Checkout overlay
      cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_modal'
      }).then(async (result: any) => {
        if (result?.error) {
          setIsVerifying(false);
          setPaymentError(`Payment window closed or cancelled: ${result.error.message || 'Payment not completed.'}`);
          return;
        }
        await verifyAndFinalizeCashfreePayment(cfOrderId);
      }).catch(async () => {
        await verifyAndFinalizeCashfreePayment(cfOrderId);
      });

    } catch (err: any) {
      setIsVerifying(false);
      setPaymentError(err?.message || 'Error communicating with Cashfree Payments Gateway.');
    }
  };

  const verifyAndFinalizeCashfreePayment = async (cfOrderId: string) => {
    setIsVerifying(true);
    setPaymentError(null);
    try {
      const verifyRes = await fetch('/api/payments/cashfree/verify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: cfOrderId })
      });

      const verifyData = await verifyRes.json().catch(() => ({}));

      if (verifyData.success && verifyData.isPaid) {
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

        const shippingAddress: Address = {
          id: `addr_${Date.now()}`,
          name,
          phone,
          street,
          landmark,
          city,
          state,
          pincode
        };

        const methodLabel = verifyData.paymentDetails?.paymentMethod || 'Credit / Debit Card (Cashfree)';

        const newOrderData: Omit<Order, 'id'> = {
          orderNumber,
          userId: user?.uid,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress,
          items: orderItems,
          originalTotal,
          productSavings,
          couponSavings: discount,
          totalSavings,
          subtotal,
          discount,
          deliveryCharge,
          totalAmount: finalTotal,
          paymentMethod: methodLabel,
          paymentStatus: 'paid', // Verified server-side via Cashfree official API!
          paymentId: String(verifyData.paymentDetails?.cfPaymentId || cfOrderId),
          cfOrderId: String(verifyData.cfOrderId || cfOrderId),
          cardNetwork: verifyData.paymentDetails?.cardNetwork,
          cardType: verifyData.paymentDetails?.cardType,
          orderStatus: 'Confirmed',
          trackingNumber: `BD${Math.floor(100000000 + Math.random() * 900000000)}IN`,
          courierName: 'BlueDart Express',
          notes: `Paid via Cashfree Card Gateway. Transaction: ${verifyData.paymentDetails?.cfPaymentId || cfOrderId}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const savedOrder = await createOrder(newOrderData);

        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#802336', '#0F5B46', '#FAF7F2']
          });
        } catch {}

        setCompletedOrder(savedOrder);
        clearCart();
        setStep(4);
        onOrderSuccess(savedOrder);
      } else {
        const status = verifyData.orderStatus || 'INCOMPLETE';
        if (status === 'ACTIVE' || status === 'PENDING') {
          setPaymentError('Card payment is pending or was not completed. You can retry with your card or choose UPI.');
        } else if (status === 'EXPIRED' || status === 'TERMINATED') {
          setPaymentError('The payment session expired. Please retry or choose UPI.');
        } else {
          setPaymentError(`Payment status: ${status}. Your card was not debited. You can retry safely.`);
        }
      }
    } catch (err: any) {
      setPaymentError('Server verification error. If your card was debited, please contact atelier support.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (items.length === 0 && step !== 4) {
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
        <button
          onClick={onNavigateHome}
          className="bg-[#3B1E22] text-[#FAF7F2] px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-[#802336] transition-colors cursor-pointer"
        >
          Return to Collections
        </button>
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
            { num: 3, label: 'UPI Payment' },
            { num: 4, label: 'Confirmed' }
          ].map((s) => (
            <div key={s.num} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.num
                    ? 'bg-[#802336] text-white ring-4 ring-[#802336]/20'
                    : step > s.num
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border-2 border-[#E8DCCF] text-gray-400'
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Street Address, House/Flat No., Building Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Flat 302, Royal Palms, M.I. Road"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Near IIT Roorkee"
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
                  placeholder="Roorkee or Delhi"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="302001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
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
                className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md flex items-center gap-2"
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
                {name} • <span className="font-normal text-gray-600">{phone}</span>
              </p>
              <p className="text-gray-600">
                {street}, {landmark ? `${landmark}, ` : ''}{city}, {state} - {pincode}
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
                    {Boolean(item.image && isGenuineImageUrl(item.image)) ? (
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="w-14 h-14 object-contain rounded-lg border border-[#E8DCCF] bg-white"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-[#E8DCCF] bg-[#FAF7F2] flex items-center justify-center text-[#802336]">
                        <ShoppingBag className="w-5 h-5 opacity-70" />
                      </div>
                    )}
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
                      {upiMethod === 'card' && 'Credit / Debit Card (Cashfree 3D Secure)'}
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
                      ? 'Official Hosted Checkout • Supports Visa, Mastercard, RuPay & all major banks'
                      : 'Pay securely using Google Pay, PhonePe, Paytm or any UPI app'}
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

      {/* STEP 3: Payment Method Selection & UPI Flow */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DCCF] gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#802336] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-xs">
                  <ShieldCheck className="w-3 h-3 text-[#DFB982]" />
                  <span>UPI Payment Gateway</span>
                </span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  All UPI Apps Accepted
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#3B1E22] mt-1.5">
                Select Payment Method
              </h2>
              <p className="text-xs text-gray-500">
                Choose your preferred payment method below. Mobile number and instant gateway are both supported.
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

          {/* PAYMENT METHOD SELECTION SECTION (Visible on Mobile & Desktop) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-[#3B1E22]">
                  Select Payment Option (Choose Preferred Method)
                </label>
                <p className="text-xs text-gray-500">
                  Credit / Debit Cards, UPI QR Code, and Direct Mobile UPI are all supported.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#802336] bg-[#FAF7F2] px-3 py-1 rounded-full border border-[#E8DCCF]">
                3 Options Available
              </span>
            </div>

            {/* THREE PRIMARY PAYMENT METHOD CARDS - DISPLAYED TOGETHER (Stacked on Mobile, 3 Columns on Desktop) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Option 1: Credit / Debit Card (Cashfree Payments Gateway) */}
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
                        Cashfree
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 px-2 py-1 rounded-full border border-purple-200">
                        Visa • MC • RuPay
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Option 1
                  </span>
                  <h3 className="text-base font-bold text-[#3B1E22] mt-0.5">
                    Credit / Debit Card
                  </h3>
                  <p className="text-xs font-semibold text-[#0F5B46] mt-1">
                    Pay ₹{finalTotal.toLocaleString('en-IN')} via Card
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    Official 3D Secure checkout. Visa, Mastercard, RuPay & all major banks supported.
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
                        Credit / Debit Card (Cashfree Payments)
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

                  {/* Supported Card Networks Banner */}
                  <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#DFB982] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        Accepted Card Networks
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                        3D Secure 2.0
                      </span>
                    </div>

                    {/* Card Network Logos / Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-blue-900 shadow-xs">
                        VISA
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-red-600 shadow-xs">
                        Mastercard
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-black tracking-wider text-emerald-800 shadow-xs">
                        RuPay
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-bold tracking-wider text-cyan-800 shadow-xs">
                        Maestro
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-bold tracking-wider text-blue-700 shadow-xs">
                        Amex
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-bold tracking-wider text-gray-700 shadow-xs">
                        Diners Club
                      </span>
                    </div>
                  </div>

                  {/* Gateway Environment Status Indicator */}
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-blue-900">
                      <Lock className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                      <span>Official PCI-DSS Level 1 Hosted Checkout</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-900/90">
                      You will be securely redirected to the official Cashfree 3D Secure page to enter your card details. We never collect or store your card number, CVV, or OTP on our servers.
                    </p>
                    {cashfreeStatus && (
                      <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="font-semibold text-blue-800">Mode:</span>
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          cashfreeStatus.env === 'PRODUCTION'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {cashfreeStatus.env === 'PRODUCTION' ? 'Production (Live Cards)' : 'Sandbox Test Mode'}
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

                  {/* Card Payment Button */}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={handleCashfreeCardPayment}
                    className="w-full bg-[#0F5B46] hover:bg-[#0A3D2F] disabled:bg-gray-400 text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" />
                        <span>Initializing Cashfree Checkout...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-[#DFB982]" />
                        <span>Proceed to Card Payment (₹{finalTotal.toLocaleString('en-IN')})</span>
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

                {/* Fast Test Button for Preview */}
                <div className="pt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setUtrNumber(`42890${Math.floor(1000000 + Math.random() * 9000000)}`)}
                    className="text-[11px] text-[#802336] font-semibold underline hover:text-black cursor-pointer"
                  >
                    ⚡ Fill Sample Test UTR (Preview)
                  </button>
                  <span className="text-[10px] text-gray-400">Sandbox Secure Handshake</span>
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
                    <span>Pay ₹{finalTotal.toLocaleString('en-IN')} via Card</span>
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
                  <span>Processing Order...</span>
                ) : upiMethod === 'phone' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                    <span>Place Order (Pay to {upiMobileNumber})</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                    <span>Verify Payment & Place Order</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Order Confirmation & Receipt (WhatsApp Studio Confirmation Flow) */}
      {step === 4 && completedOrder && (
        <WhatsAppOrderConfirmationView
          order={completedOrder}
          onTrackOrder={onTrackOrder}
          onContinueShopping={onNavigateHome}
        />
      )}
    </div>
  );
};
