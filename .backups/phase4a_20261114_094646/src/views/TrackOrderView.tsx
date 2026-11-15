import React, { useState, useEffect } from 'react';
import {
  Search,
  Truck,
  CheckCircle,
  Package,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowRight,
  ShoppingBag,
  Phone,
  MessageCircle
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { fetchOrderById } from '../lib/dbService';
import { MetadataManager } from '../components/MetadataManager';
import { isGenuineImageUrl } from '../lib/sampleData';

interface TrackOrderViewProps {
  initialOrderNumber?: string;
  onNavigateShop: () => void;
}

export const TrackOrderView: React.FC<TrackOrderViewProps> = ({
  initialOrderNumber = '',
  onNavigateShop
}) => {
  const [searchQuery, setSearchQuery] = useState(initialOrderNumber);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialOrderNumber) {
      handleSearch(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  const handleSearch = async (orderIdToSearch?: string) => {
    const q = (orderIdToSearch || searchQuery).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const found = await fetchOrderById(q);
      if (found) {
        setOrder(found);
      } else {
        setError(`No order found matching "${q}". Please check the order number or email confirmation.`);
        setOrder(null);
      }
    } catch (e) {
      setError('Failed to fetch order tracking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'Confirmed', label: 'Order Confirmed', desc: 'Payment verified via UPI' },
    { key: 'Processing', label: 'Processing & Quality Check', desc: 'Handcrafted in Roorkee atelier' },
    { key: 'Shipped', label: 'Dispatched & In Transit', desc: 'Handed over to express courier' },
    { key: 'Delivered', label: 'Delivered', desc: 'Hand delivered to your doorstep' }
  ];

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'Cancelled') return -1;
    if (status === 'Pending') return 0;
    if (status === 'Confirmed') return 0;
    if (status === 'Processing') return 1;
    if (status === 'Shipped') return 2;
    if (status === 'Delivered') return 3;
    return 0;
  };

  const activeIndex = order ? getStepIndex(order.orderStatus) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <MetadataManager
        title={order ? `Track Order #${order.orderNumber}` : 'Track Your Jewellery Order'}
        description="Track the real-time shipping and delivery status of your VIDHYAA Jewellery Studio handcrafted order."
      />

      {/* Title */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
          Live Logistics
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
          Track Your Jewellery Parcel
        </h1>
        <p className="text-xs text-gray-500">
          Enter your Order Number (e.g. VDH-123456) received in your receipt to view real-time delivery status.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="max-w-xl mx-auto bg-white p-2 rounded-2xl border border-[#E8DCCF] shadow-sm flex items-center gap-2">
        <input
          type="text"
          placeholder="e.g. VDH-78291"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-4 py-2.5 text-xs text-[#241C1A] uppercase tracking-wider focus:outline-none"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Tracking...' : 'Track'}
        </button>
      </div>

      {error && (
        <div className="max-w-xl mx-auto p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Order Status Display */}
      {order && (
        <div className="bg-white rounded-3xl border border-[#E8DCCF] p-6 sm:p-8 shadow-sm space-y-8 animate-fadeIn">
          {/* Top Info Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-[#E8DCCF] gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[#3B1E22]">
                  {order.orderNumber}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    order.orderStatus === 'Delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.orderStatus === 'Cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {order.orderStatus}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Placed on{' '}
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-gray-500 block">Courier Partner:</span>
              <span className="text-xs font-bold text-[#3B1E22]">
                {order.courierName || 'BlueDart Express'} (AWB: {order.trackingNumber || 'BD98214IN'})
              </span>
            </div>
          </div>

          {/* Stepper Timeline */}
          {order.orderStatus !== 'Cancelled' ? (
            <div className="py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
                {steps.map((st, idx) => {
                  const isDone = activeIndex >= idx;
                  const isCurrent = activeIndex === idx;

                  return (
                    <div
                      key={st.key}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        isCurrent
                          ? 'border-[#802336] bg-[#FAF7F2] ring-2 ring-[#802336]/20'
                          : isDone
                          ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                          : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold mb-2 ${
                          isDone
                            ? 'bg-[#802336] text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isDone ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                      </div>
                      <h4
                        className={`text-xs font-bold ${
                          isCurrent ? 'text-[#802336]' : 'text-gray-800'
                        }`}
                      >
                        {st.label}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">{st.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">
              This order was cancelled. Any processed UPI funds are returned within 2-3 business days.
            </div>
          )}

          {/* Ordered Items List */}
          <div className="space-y-3 pt-2">
            <h3 className="font-serif text-base font-bold text-[#3B1E22]">
              Package Contents ({order.items.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-[#FAF7F2]/50"
                >
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
                    <h5 className="font-serif text-xs font-semibold text-[#241C1A] line-clamp-1">
                      {item.productName}
                    </h5>
                    <span className="text-[10px] text-[#802336] font-medium bg-white px-2 py-0.5 rounded border border-[#E8DCCF]">
                      {item.variationName}
                    </span>
                    <div className="text-xs text-gray-600 mt-1 font-semibold">
                      Qty: {item.quantity} • ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery & Payment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E8DCCF] text-xs">
            <div className="space-y-1">
              <span className="font-bold text-gray-700 uppercase tracking-wider block">
                Shipping Address
              </span>
              <p className="text-[#3B1E22] font-semibold">{order.customerName}</p>
              <p className="text-gray-500">
                {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
              </p>
              <p className="text-gray-500">Phone: {order.customerPhone}</p>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="font-bold text-gray-700 uppercase tracking-wider block">
                Payment Info (UPI)
              </span>
              <p className="text-gray-600">Method: <strong>{order.paymentMethod || 'UPI'}</strong></p>
              <p className="text-gray-600">
                Status: <strong className={order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                  {order.paymentStatus === 'paid' ? 'Paid (Verified)' : 'Pending Verification'}
                </strong>
              </p>
              <p className="text-gray-600">Reference: <strong>{order.upiReference}</strong></p>
              <p className="font-serif text-base font-bold text-[#802336] pt-1">
                Total Amount: ₹{order.totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Atelier Dispatch & Customer Support Help */}
          <div className="pt-4 border-t border-[#E8DCCF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[#FAF7F2] p-4 rounded-xl">
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-[#802336] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Atelier Origin:</strong> Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand - 247667
              </span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
              <a
                href="tel:7302187770"
                className="font-bold text-[#802336] hover:underline flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call 7302187770</span>
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://wa.me/917302187770"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
