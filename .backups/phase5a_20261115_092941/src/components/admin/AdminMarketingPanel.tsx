import React, { useState } from 'react';
import { Tag, Plus, Trash2, CheckCircle, Percent, Calendar } from 'lucide-react';
import { Coupon } from '../../types';
import { logAuditEvent } from '../../lib/securityService';

const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'c_1',
    code: 'VIDHYAA10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 999,
    active: true,
    expiresAt: '2026-12-31',
    usageCount: 42
  },
  {
    id: 'c_2',
    code: 'FESTIVE500',
    discountType: 'fixed',
    discountValue: 500,
    minOrderAmount: 2500,
    active: true,
    expiresAt: '2026-11-15',
    usageCount: 18
  },
  {
    id: 'c_3',
    code: 'BRIDALVIP',
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 5000,
    active: true,
    expiresAt: '2026-12-31',
    usageCount: 9
  }
];

export const AdminMarketingPanel: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
      const raw = localStorage.getItem('vidhyaa_coupons');
      return raw ? JSON.parse(raw) : INITIAL_COUPONS;
    } catch {
      return INITIAL_COUPONS;
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minOrder, setMinOrder] = useState<number>(999);

  const saveCoupons = (list: Coupon[]) => {
    setCoupons(list);
    try {
      localStorage.setItem('vidhyaa_coupons', JSON.stringify(list));
    } catch {}
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const coupon: Coupon = {
      id: `c_${Date.now()}`,
      code: newCode.trim().toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrder),
      active: true,
      usageCount: 0
    };

    const updated = [...coupons, coupon];
    saveCoupons(updated);

    await logAuditEvent({
      adminId: 'super_admin',
      adminEmail: 'anavneeraj2003@gmail.com',
      action: 'COUPON_CREATED',
      category: 'settings',
      targetResource: coupon.code,
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'success',
      details: `Created promotional code ${coupon.code} with ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : '₹'} discount`
    });

    setNewCode('');
    setModalOpen(false);
  };

  const handleDelete = async (id: string, code: string) => {
    const updated = coupons.filter((c) => c.id !== id);
    saveCoupons(updated);

    await logAuditEvent({
      adminId: 'super_admin',
      adminEmail: 'anavneeraj2003@gmail.com',
      action: 'COUPON_DELETED',
      category: 'settings',
      targetResource: code,
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'warning',
      details: `Deleted promotional coupon code ${code}`
    });
  };

  return (
    <div className="bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-white">
            Promotional Coupons & Marketing
          </h3>
          <p className="text-xs text-gray-400">
            Create real discount codes for patrons, cart incentives, and live broadcast promotions.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4 text-[#DFB982]" />
          <span>New Discount Code</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coupons.map((c) => (
          <div key={c.id} className="p-5 bg-[#120B0D] border border-gray-800 rounded-2xl space-y-3 relative group">
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-[#DFB982] tracking-wider">
                {c.code}
              </span>
              <button
                onClick={() => handleDelete(c.id, c.code)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity cursor-pointer p-1"
                title="Delete coupon"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs text-gray-300">
              {c.discountType === 'percentage' ? `${c.discountValue}% OFF Total Cart` : `₹${c.discountValue} Flat Discount`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-800/80 pt-2">
              <span>Min. Order: ₹{c.minOrderAmount}</span>
              <span>Used: {c.usageCount} times</span>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1215] border border-[#DFB982]/40 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-white pb-2 border-b border-gray-800">
              Create Promotional Coupon
            </h3>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIWALI20"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white uppercase font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1">
                  Minimum Order Amount (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={minOrder}
                  onChange={(e) => setMinOrder(Number(e.target.value))}
                  className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-800 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Create Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
