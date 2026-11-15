import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';

interface AdminSensitiveActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export const AdminSensitiveActionModal: React.FC<AdminSensitiveActionModalProps> = ({
  isOpen,
  title,
  description,
  actionLabel,
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  const [securityKey, setSecurityKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onConfirm();
      setSecurityKey('');
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Action aborted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1C1215] border border-[#DFB982]/40 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDestructive ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-[#0F4C4A]/30 text-[#DFB982] border border-[#0F4C4A]'
          }`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-white">{title}</h3>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">
              Executive Authorization Required
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-300 leading-relaxed space-y-2">
          <p>{description}</p>
          {isDestructive && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/50 text-red-300 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>This operation is irreversible and will be logged in the permanent audit ledger.</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1.5">
              Confirm by typing "CONFIRM" or Admin Passkey
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Type CONFIRM to authorize"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
                className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#DFB982]"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 border border-gray-800 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (securityKey.trim().toUpperCase() !== 'CONFIRM' && securityKey.length < 3)}
              className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                isDestructive ? 'bg-red-700 hover:bg-red-800' : 'bg-[#0F4C4A] hover:bg-[#0A3635]'
              }`}
            >
              {loading ? 'Authorizing...' : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
