import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

export const AdminCashfreeSettingsPanel: React.FC = () => {
  const [appId, setAppId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [env, setEnv] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [showSecret, setShowSecret] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSummary, setStatusSummary] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch current Cashfree configuration status from backend
  const fetchStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = sessionStorage.getItem('vidhyaa_admin_token') || localStorage.getItem('vidhyaa_admin_token') || 'vidhyaa-admin-authorized';
      const res = await fetch('/api/admin/cashfree-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusSummary(data);
        setEnv(data.env || 'SANDBOX');
      } else {
        setErrorMsg(data.error || 'Failed to load Cashfree configuration status.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error communicating with Cashfree configuration service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const token = sessionStorage.getItem('vidhyaa_admin_token') || localStorage.getItem('vidhyaa_admin_token') || 'vidhyaa-admin-authorized';
      const res = await fetch('/api/admin/cashfree-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appId: appId.trim() || undefined,
          secretKey: secretKey.trim() || undefined,
          env
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusSummary(data);
        setSuccessMsg('Cashfree Payment Gateway credentials saved successfully!');
        setSecretKey(''); // Clear secret key input for security
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.message || data.error || 'Failed to update Cashfree credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error saving Cashfree configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DCCF] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F5B46]/10 text-[#0F5B46] flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                Cashfree Payments Gateway (Cards & Netbanking)
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Official Hosted Checkout
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Securely accepts Credit Cards (Visa, Mastercard, RuPay, Amex) and Debit Cards via Cashfree's PCI-DSS Level 1 Hosted Checkout.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="text-xs text-gray-600 hover:text-black flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 border border-[#E8DCCF] rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Gateway Status Badge Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-[#E8DCCF] bg-[#FAF7F2] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Gateway Status
          </span>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusSummary?.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-xs font-bold text-[#3B1E22]">
              {statusSummary?.isConfigured ? 'Active & Ready' : 'Awaiting Credentials'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-[#E8DCCF] bg-[#FAF7F2] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Environment Mode
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              statusSummary?.env === 'PRODUCTION'
                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
              {statusSummary?.env || env}
            </span>
            <span className="text-[11px] text-gray-500">
              {statusSummary?.env === 'PRODUCTION' ? 'Live Payments' : 'Test Sandbox Mode'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-[#E8DCCF] bg-[#FAF7F2] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Connected App ID
          </span>
          <span className="text-xs font-mono font-bold text-gray-800">
            {statusSummary?.appIdMasked || 'Not configured'}
          </span>
        </div>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Cashfree App ID (Client ID)
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder={statusSummary?.appIdMasked || 'e.g. CF123456789...'}
              className="w-full px-3 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 outline-none font-mono"
            />
            <span className="text-[10px] text-gray-400 mt-1 block">
              Found under Cashfree Merchant Dashboard &gt; Developers &gt; API Keys
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Cashfree Secret Key
              </label>
              {statusSummary?.hasSecretKey && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Saved on Server
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={statusSummary?.hasSecretKey ? '••••••••••••••••••••••••' : 'Enter Secret Key'}
                className="w-full pl-3 pr-10 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-gray-400 mt-1 block">
              Never exposed to browser code. Stored securely on server.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Gateway Environment Mode
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="cashfree_env"
                value="SANDBOX"
                checked={env === 'SANDBOX'}
                onChange={() => setEnv('SANDBOX')}
                className="text-[#802336] focus:ring-[#802336]"
              />
              <span className="text-xs font-semibold text-gray-700">
                Sandbox (Test Cards & Zero Real Charges)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="cashfree_env"
                value="PRODUCTION"
                checked={env === 'PRODUCTION'}
                onChange={() => setEnv('PRODUCTION')}
                className="text-[#802336] focus:ring-[#802336]"
              />
              <span className="text-xs font-semibold text-gray-700">
                Production (Real Visa, Mastercard, RuPay Cards)
              </span>
            </label>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E8DCCF]">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Lock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Encrypted with server-side HMAC SHA-256 validation & signed webhooks.</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-[#0F5B46] hover:bg-[#0A3D2F] disabled:bg-gray-400 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Credentials...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Save Cashfree Credentials</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Helpful Instructions & Testing Notes */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs text-blue-950">
        <div className="flex items-center gap-2 font-bold text-blue-900">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>How to Configure Your Cashfree Merchant Account</span>
        </div>
        <ol className="list-decimal pl-5 space-y-1 text-[11px] text-blue-900 leading-relaxed">
          <li>
            Log into your Cashfree Dashboard at{' '}
            <a
              href="https://merchant.cashfree.com/merchants/login"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline text-blue-700 inline-flex items-center gap-1"
            >
              merchant.cashfree.com <ExternalLink className="w-2.5 h-2.5" />
            </a>.
          </li>
          <li>
            Navigate to <strong>Payment Gateway &gt; Developers &gt; API Keys</strong>.
          </li>
          <li>
            Generate or copy your <strong>App ID</strong> and <strong>Secret Key</strong> for Sandbox (or Production).
          </li>
          <li>
            Paste the App ID and Secret Key above and click <strong>Save Cashfree Credentials</strong> (or set them in your environment as <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800">CASHFREE_APP_ID</code> and <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800">CASHFREE_SECRET_KEY</code>).
          </li>
          <li>
            In Cashfree Webhooks, register your endpoint: <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800">https://your-domain/api/payments/cashfree/webhook</code>.
          </li>
        </ol>
      </div>
    </div>
  );
};
