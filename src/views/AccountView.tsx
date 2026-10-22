import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Package,
  MapPin,
  Heart,
  Plus,
  Trash2,
  Calendar,
  Truck,
  LogOut,
  Settings,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Order, Address } from '../types';
import { fetchOrdersByUserId } from '../lib/dbService';

interface AccountViewProps {
  onNavigateOrders: () => void;
  onNavigateWishlist: () => void;
  onNavigateAdmin: () => void;
  onTrackOrder: (orderNum: string) => void;
  onOpenAuth: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  onNavigateOrders,
  onNavigateWishlist,
  onNavigateAdmin,
  onTrackOrder,
  onOpenAuth
}) => {
  const { user, userProfile, isAdmin, signOut, saveAddress, deleteAddress } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // New address form
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addrName, setAddrName] = useState(user?.displayName || '');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('Rajasthan');
  const [addrPincode, setAddrPincode] = useState('');

  useEffect(() => {
    if (user) {
      setLoadingOrders(true);
      fetchOrdersByUserId(user.uid)
        .then(setOrders)
        .finally(() => setLoadingOrders(false));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FAF7F2] flex items-center justify-center mx-auto text-[#802336]">
          <UserIcon className="w-8 h-8 opacity-60" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
          Sign In to Your Patron Account
        </h2>
        <p className="text-xs text-gray-500">
          Sign in to view your orders, track shipments, and manage saved delivery addresses.
        </p>
        <button
          onClick={onOpenAuth}
          className="bg-[#3B1E22] text-[#FAF7F2] px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-[#802336] transition-colors cursor-pointer"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName || !addrPhone || !addrStreet || !addrCity || !addrPincode) {
      alert('Please fill all mandatory address fields.');
      return;
    }
    const newAddr: Address = {
      id: `addr_${Date.now()}`,
      name: addrName,
      phone: addrPhone,
      street: addrStreet,
      landmark: addrLandmark,
      city: addrCity,
      state: addrState,
      pincode: addrPincode
    };
    saveAddress(newAddr);
    setShowAddAddress(false);
    setAddrStreet('');
    setAddrLandmark('');
    setAddrCity('');
    setAddrPincode('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Account Banner */}
      <div className="bg-white rounded-3xl border border-[#E8DCCF] p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border-2 border-[#D4AF37] flex items-center justify-center text-[#802336] font-serif text-2xl font-bold">
            {user.displayName?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-[#241C1A]">
                {user.displayName || 'VIDHYAA Patron'}
              </h1>
              {isAdmin && (
                <span className="bg-[#802336] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={onNavigateAdmin}
              className="bg-[#802336] hover:bg-[#631828] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Settings className="w-4 h-4 text-[#DFB982]" />
              <span>Admin Panel</span>
            </button>
          )}

          <button
            onClick={() => signOut()}
            className="px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#E8DCCF] text-xs font-bold uppercase tracking-wider pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'border-[#802336] text-[#802336]'
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Orders ({orders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('addresses')}
          className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'addresses'
              ? 'border-[#802336] text-[#802336]'
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Saved Addresses ({userProfile?.savedAddresses?.length || 0})</span>
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {loadingOrders ? (
            <div className="p-8 text-center text-xs text-gray-500">
              Loading your jewellery order history...
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DCCF] p-10 text-center space-y-3">
              <Package className="w-10 h-10 mx-auto text-gray-300" />
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                No Orders Placed Yet
              </h3>
              <p className="text-xs text-gray-500">
                You haven't ordered any jewellery pieces yet. Explore our handcrafted collections!
              </p>
            </div>
          ) : (
            orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#3B1E22]">
                      Order #{ord.orderNumber}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-2">
                      {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        ord.orderStatus === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.orderStatus === 'Cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ord.orderStatus}
                    </span>
                    <button
                      onClick={() => onTrackOrder(ord.orderNumber)}
                      className="text-xs font-semibold text-[#802336] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Track Shipment
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ord.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      {it.image ? (
                        <img
                          src={it.image}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border border-[#E8DCCF]"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#FAF7F2] border border-[#E8DCCF] flex items-center justify-center text-[#802336] flex-shrink-0">
                          <ShoppingBag className="w-5 h-5 opacity-70" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-[#241C1A] line-clamp-1">
                          {it.productName}
                        </h4>
                        <span className="text-[10px] text-[#802336]">{it.variationName}</span>
                        <div className="text-gray-500 text-[11px]">
                          Qty: {it.quantity} • ₹{(it.price * it.quantity).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs">
                  <span className="text-gray-500">
                    Paid via UPI (Ref: {ord.upiReference})
                  </span>
                  <span className="font-bold text-sm text-[#3B1E22]">
                    Total: ₹{ord.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Addresses Tab */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
              Delivery Addresses
            </h3>
            <button
              onClick={() => setShowAddAddress(!showAddAddress)}
              className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          {showAddAddress && (
            <form
              onSubmit={handleCreateAddress}
              className="p-6 bg-white rounded-2xl border border-[#E8DCCF] shadow-sm space-y-4"
            >
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#802336]">
                Enter New Address Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={addrName}
                  onChange={(e) => setAddrName(e.target.value)}
                  className="px-3 py-2 text-xs border rounded-lg"
                />
                <input
                  type="tel"
                  required
                  placeholder="Mobile Number"
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  className="px-3 py-2 text-xs border rounded-lg"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Street Address, Flat / House Number"
                value={addrStreet}
                onChange={(e) => setAddrStreet(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Landmark"
                  value={addrLandmark}
                  onChange={(e) => setAddrLandmark(e.target.value)}
                  className="px-3 py-2 text-xs border rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  className="px-3 py-2 text-xs border rounded-lg"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Pincode"
                  value={addrPincode}
                  onChange={(e) => setAddrPincode(e.target.value)}
                  className="px-3 py-2 text-xs border rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-[#802336] text-white px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAddress(false)}
                  className="px-4 py-2 border rounded-lg text-xs text-gray-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(userProfile?.savedAddresses || []).map((addr) => (
              <div
                key={addr.id}
                className="bg-white p-5 rounded-2xl border border-[#E8DCCF] flex justify-between items-start shadow-2xs"
              >
                <div className="text-xs space-y-1">
                  <span className="font-bold text-[#3B1E22] block">{addr.name}</span>
                  <p className="text-gray-600">
                    {addr.street}, {addr.landmark ? `${addr.landmark}, ` : ''}{addr.city}, {addr.state} - {addr.pincode}
                  </p>
                  <p className="text-gray-500 text-[11px]">Phone: {addr.phone}</p>
                </div>
                <button
                  onClick={() => deleteAddress(addr.id)}
                  className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                  title="Delete address"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
