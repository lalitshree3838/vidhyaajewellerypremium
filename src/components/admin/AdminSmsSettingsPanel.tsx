import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle,
  AlertCircle,
  Send,
  Save,
  Key,
  Shield,
  ExternalLink,
  Loader2,
  RefreshCw,
  PhoneCall,
  Check
} from 'lucide-react';

export const AdminSmsSettingsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [fast2smsKey, setFast2smsKey] = useState('');
  const [twofactorKey, setTwofactorKey] = useState('');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioPhone, setTwilioPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Test SMS states
  const [testMobile, setTestMobile] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const getAdminToken = () => {
    return (
      sessionStorage.getItem('vidhyaa_admin_token') ||
      localStorage.getItem('vidhyaa_admin_token') ||
      'vidhyaa-admin-authorized'
    );
  };

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sms-config', {
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.warn('Could not load SMS config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/sms-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          fast2smsApiKey: fast2smsKey || undefined,
          twofactorApiKey: twofactorKey || undefined,
          twilioAccountSid: twilioSid || undefined,
          twilioAuthToken: twilioToken || undefined,
          twilioPhoneNumber: twilioPhone || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update SMS settings.');
      }

      setStatus(data);
      setSuccess('SMS Gateway credentials saved successfully! Customer phone logins will now dispatch real SMS.');
      // Clear inputs
      setFast2smsKey('');
      setTwofactorKey('');
      setTwilioSid('');
      setTwilioToken('');
      setTwilioPhone('');
    } catch (err: any) {
      setError(err.message || 'Error saving SMS configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testMobile.trim();
    if (clean.length < 8) {
      setError('Please enter a valid mobile number (e.g. +919876543210 or international +14155552671).');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/test-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ phoneNumber: clean, mobile: clean }),
      });

      const data = await res.json();
      setTestResult(data);
      if (res.ok && data.success) {
        setSuccess(`Test SMS successfully dispatched! Carrier: ${data.provider} to ${data.phoneNumber || clean}`);
      } else {
        setError(data.error || data.message || 'Failed to dispatch test SMS. Please ensure an SMS gateway key is configured.');
      }
    } catch (err: any) {
      setError(err.message || 'Network failure while testing SMS.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-8 shadow-xs max-w-3xl animate-fadeIn space-y-6 mt-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] text-[#802336]">
              <Smartphone className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
              Worldwide SMS OTP & Mobile Login Configuration
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Configure real SMS delivery for customer mobile OTP login worldwide (India, US, UK, Canada, Australia, UAE, and 180+ countries) via Firebase Phone Authentication and telecom gateways.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
          title="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Gateway Live Status Banner */}
      <div className="p-4 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-gray-600">Active Delivery Engine:</span>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            status?.configured
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {status?.activeProvider || 'None Configured (Setup Required)'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <div className="text-gray-500 font-semibold">Fast2SMS India</div>
            <div className="font-bold mt-0.5 flex items-center gap-1">
              {status?.providers?.fast2sms?.configured ? (
                <span className="text-emerald-700 flex items-center gap-0.5"><Check className="w-3 h-3" /> Configured</span>
              ) : (
                <span className="text-gray-400">Not configured</span>
              )}
            </div>
          </div>

          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <div className="text-gray-500 font-semibold">2Factor.in</div>
            <div className="font-bold mt-0.5 flex items-center gap-1">
              {status?.providers?.twofactor?.configured ? (
                <span className="text-emerald-700 flex items-center gap-0.5"><Check className="w-3 h-3" /> Configured</span>
              ) : (
                <span className="text-gray-400">Not configured</span>
              )}
            </div>
          </div>

          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <div className="text-gray-500 font-semibold">Twilio SMS</div>
            <div className="font-bold mt-0.5 flex items-center gap-1">
              {status?.providers?.twilio?.configured ? (
                <span className="text-emerald-700 flex items-center gap-0.5"><Check className="w-3 h-3" /> Configured</span>
              ) : (
                <span className="text-gray-400">Not configured</span>
              )}
            </div>
          </div>

          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <div className="text-gray-500 font-semibold">Firebase Phone</div>
            <div className="font-bold mt-0.5 flex items-center gap-1">
              <span className="text-amber-700">Console setup req.</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Test Live SMS to Mobile */}
      <div className="p-4 bg-white border border-[#E8DCCF] rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B1E22] uppercase tracking-wider">
          <Send className="w-4 h-4 text-[#802336]" />
          <span>Send Live Test SMS to Handset</span>
        </div>
        <p className="text-[11px] text-gray-500">
          Enter any mobile number (e.g. +91 9876543210 for India, or +1 415 555 2671 for US) to test real carrier SMS transmission.
        </p>

        <form onSubmit={handleSendTestSms} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="tel"
              required
              value={testMobile}
              onChange={(e) => setTestMobile(e.target.value)}
              placeholder="+919876543210 or +14155552671"
              className="w-full px-3 py-2 text-xs font-mono font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336]"
            />
          </div>
          <button
            type="submit"
            disabled={testing || testMobile.trim().length < 8}
            className="px-5 py-2 bg-[#802336] hover:bg-[#681c2c] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
            <span>{testing ? 'Dispatching...' : 'Dispatch Test SMS'}</span>
          </button>
        </form>

        {testResult && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-gray-700">Delivery Response:</div>
            <div className="font-mono text-[11px] text-gray-600">{JSON.stringify(testResult, null, 2)}</div>
          </div>
        )}
      </div>

      {/* Gateway API Key Setup Form */}
      <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3B1E22] uppercase tracking-wider border-b border-[#E8DCCF] pb-2">
          <Key className="w-4 h-4 text-[#802336]" />
          <span>Connect SMS Provider Credentials</span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Fast2SMS API Key (Recommended for India)
            </label>
            <a
              href="https://www.fast2sms.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#802336] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Get Fast2SMS Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <input
            type="password"
            value={fast2smsKey}
            onChange={(e) => setFast2smsKey(e.target.value)}
            placeholder={status?.providers?.fast2sms?.configured ? '•••••••••••••••••••• (Leave blank to keep existing)' : 'Paste Fast2SMS Dev API authorization key'}
            className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#802336]"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Supports instant OTP route without complex DLT registrations. Starting at ₹100 recharge.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              2Factor.in API Key (Alternative Indian Provider)
            </label>
            <a
              href="https://2factor.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#802336] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Get 2Factor Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <input
            type="password"
            value={twofactorKey}
            onChange={(e) => setTwofactorKey(e.target.value)}
            placeholder={status?.providers?.twofactor?.configured ? '•••••••••••••••••••• (Leave blank to keep existing)' : 'Paste 2Factor.in API Key'}
            className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#802336]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Twilio Account SID (Optional)
            </label>
            <input
              type="text"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="AC..."
              className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#802336]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Twilio Auth Token
            </label>
            <input
              type="password"
              value={twilioToken}
              onChange={(e) => setTwilioToken(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#802336]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Twilio Phone Number
            </label>
            <input
              type="text"
              value={twilioPhone}
              onChange={(e) => setTwilioPhone(e.target.value)}
              placeholder="+1..."
              className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#802336]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-8 py-3 rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-md transition-colors flex items-center gap-2 text-xs"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" /> : <Save className="w-4 h-4 text-[#DFB982]" />}
          <span>{saving ? 'Saving...' : 'Save SMS Gateway Credentials'}</span>
        </button>
      </form>

      {/* Firebase Phone Authentication Guide */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-gray-800">
          <Shield className="w-4 h-4 text-[#B8860B]" />
          <span>How to enable Google Firebase Phone Authentication (Native SMS):</span>
        </div>
        <ol className="list-decimal list-inside space-y-1 text-gray-600 pl-1 text-[11px] leading-relaxed">
          <li>
            Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#802336] font-semibold underline">Firebase Console</a> and select project <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">gen-lang-client-0706507905</code>.
          </li>
          <li>
            Navigate to <strong>Build &gt; Authentication &gt; Sign-in method</strong> tab.
          </li>
          <li>
            Click on <strong>Phone</strong> and toggle <strong>Enable</strong>, then click <strong>Save</strong>.
          </li>
          <li>
            In <strong>Authentication &gt; Settings &gt; Authorized Domains</strong>, make sure your deployment domain (e.g. <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">ais-dev-...run.app</code> and your production Hostinger domain) is listed.
          </li>
          <li>
            (Optional for free tests) Add "Phone numbers for testing" (e.g. +91 9876543210 with OTP 123456, or +1 4155552671) in the Phone provider settings to test without consuming telecom credits.
          </li>
        </ol>
      </div>
    </div>
  );
};
