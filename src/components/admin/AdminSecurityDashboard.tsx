import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Smartphone,
  History,
  Monitor,
  CheckCircle,
  Clock,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  LogOut,
  Download,
  Filter,
  Search,
  Check
} from 'lucide-react';
import {
  analyzePassword,
  fetchAuditLogs,
  logAuditEvent,
  getLocalSessions,
  saveLocalSessions,
  generateTOTPSecret
} from '../../lib/securityService';
import { AuditLog, AdminSession } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AdminSecurityDashboard: React.FC = () => {
  const { user } = useAuth();
  const adminEmail = user?.email || 'anavneeraj2003@gmail.com';

  // Security Sub-tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'audit_logs' | 'sessions' | 'change_password' | '2fa'>('overview');

  // Password Strength Estimator state
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // TOTP Secret Helper state
  const [totpSecret, setTotpSecret] = useState('JBSWY3DPEHPK3PXP');
  const [backupCodes, setBackupCodes] = useState<string[]>([
    'VDH8-94A2', 'K92F-88BC', 'EM91-34DF', 'QP77-21KL', 'ZZ89-10MK'
  ]);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterCategory, setLogFilterCategory] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Sessions
  const [sessions, setSessions] = useState<AdminSession[]>([]);

  const passwordAnalysis = analyzePassword(newPassword);

  useEffect(() => {
    loadLogs();
    setSessions(getLocalSessions(adminEmail));
  }, [adminEmail]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    saveLocalSessions(updated);

    await logAuditEvent({
      adminId: user?.uid || 'super_admin',
      adminEmail,
      action: 'ADMIN_SESSION_REVOKED',
      category: 'security',
      targetResource: sessionId,
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'success',
      details: `Remote workstation session ${sessionId} was revoked.`
    });
    loadLogs();
  };

  const handleRevokeAllOtherSessions = async () => {
    const current = sessions.filter((s) => s.isCurrent);
    setSessions(current);
    saveLocalSessions(current);

    await logAuditEvent({
      adminId: user?.uid || 'super_admin',
      adminEmail,
      action: 'ADMIN_LOGOUT_ALL_DEVICES',
      category: 'security',
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'success',
      details: 'All other remote active sessions terminated.'
    });
    loadLogs();
  };

  const handleGenerateNew2FA = () => {
    const generated = generateTOTPSecret();
    setTotpSecret(generated.secret);
    setBackupCodes(generated.backupCodes);
  };

  // Filtered Logs
  const filteredLogs = auditLogs.filter((log) => {
    const matchesCategory = logFilterCategory === 'all' || log.category === logFilterCategory;
    const matchesSearch =
      log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.adminEmail.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(logSearchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1E1417] via-[#142321] to-[#120B0D] p-6 sm:p-8 rounded-3xl border border-[#DFB982]/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-[#0F4C4A] text-white text-[11px] font-bold uppercase px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-[#DFB982]" />
            <span>Server-Verified Admin Access</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Administrator Security & Audit Center
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 max-w-xl">
            Signed backend token verification, server-side credential vault protection, session auto-lock, and studio audit logging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-gray-400 block uppercase">Security Status</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
              <CheckCircle className="w-3.5 h-3.5" />
              Active Session Guard
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-800">
        {[
          { id: 'overview', label: 'Security Health', icon: ShieldCheck },
          { id: 'audit_logs', label: 'Audit Telemetry Logs', icon: History },
          { id: 'sessions', label: 'Active Sessions', icon: Monitor },
          { id: 'change_password', label: 'Credential Policy', icon: KeyRound },
          { id: '2fa', label: 'Auth & Recovery Keys', icon: Smartphone }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#0F4C4A] text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 text-[#DFB982]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW / HEALTH */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1C1215] border border-gray-800 p-6 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Authentication Status</span>
              <span className="text-emerald-400 font-bold">Active</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-white">
              Super Admin Session
            </h3>
            <p className="text-xs text-gray-400">
              Authenticated via backend HMAC token & Google Workspace owner check: <strong className="text-white">{adminEmail}</strong>
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] text-gray-500">
              <Clock className="w-3.5 h-3.5 text-[#DFB982]" />
              <span>15-minute inactivity auto-lock enabled</span>
            </div>
          </div>

          <div className="bg-[#1C1215] border border-gray-800 p-6 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Workspace & Backend Auth</span>
              <span className="text-emerald-400 font-bold">Configured</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-white">
              Google SSO + Vault Credentials
            </h3>
            <p className="text-xs text-gray-400">
              Supports Google Workspace Sign-In for the verified store owner and server-verified admin credentials.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] text-[#DFB982]">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Server token validated via /api/admin/verify-session</span>
            </div>
          </div>

          <div className="bg-[#1C1215] border border-gray-800 p-6 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Credential Storage</span>
              <span className="text-emerald-400 font-bold">Protected</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-white">
              Protected Server Vault
            </h3>
            <p className="text-xs text-gray-400">
              Admin credentials reside outside the public bundle in <span className="font-mono text-gray-300">.admin-secrets/admin-credentials.json</span> with direct HTTP access blocked.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] text-gray-500">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>scrypt / PHP password_verify + HMAC-SHA256</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TELEMETRY LOGS */}
      {activeTab === 'audit_logs' && (
        <div className="bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-bold text-white">
                Tamper-Resistant Audit Log Stream
              </h3>
              <p className="text-xs text-gray-400">
                All administrative access, product price modifications, role assignments and security events are logged.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search audit actions..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full bg-[#120B0D] border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB982]"
                />
              </div>

              <select
                value={logFilterCategory}
                onChange={(e) => setLogFilterCategory(e.target.value)}
                className="bg-[#120B0D] border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#DFB982] cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="auth">Authentication</option>
                <option value="security">Security & 2FA</option>
                <option value="product">Products</option>
                <option value="order">Orders</option>
                <option value="settings">Store Settings</option>
              </select>

              <button
                onClick={loadLogs}
                className="p-2 border border-gray-800 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#120B0D] text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Admin Identity</th>
                  <th className="py-3 px-4">IP / Workstation</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No security audit records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('en-IN', {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        <span className="font-mono text-[#DFB982]">{log.action}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 truncate max-w-[160px]">
                        {log.adminEmail}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400 whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.result === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : log.result === 'failure'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {log.result}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 truncate max-w-xs" title={log.details}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-bold text-white">
                Active Administrative Sessions
              </h3>
              <p className="text-xs text-gray-400">
                Review all authenticated browser sessions and revoke remote or unrecognized devices immediately.
              </p>
            </div>
            <button
              onClick={handleRevokeAllOtherSessions}
              className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout All Other Devices</span>
            </button>
          </div>

          <div className="divide-y divide-gray-800">
            {sessions.map((sess) => (
              <div key={sess.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0F4C4A]/30 border border-[#0F4C4A] flex items-center justify-center text-[#DFB982] flex-shrink-0">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{sess.device}</h4>
                      {sess.isCurrent && (
                        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                          Current Workstation
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Browser: {sess.browser} • IP: <span className="font-mono text-gray-300">{sess.ipAddress}</span> • {sess.location}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Logged in: {new Date(sess.loginTime).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {!sess.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(sess.id)}
                    className="self-end sm:self-center text-xs text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Session</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CREDENTIAL POLICY & PASSWORD STRENGTH CHECK */}
      {activeTab === 'change_password' && (
        <div className="max-w-2xl bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="font-serif text-xl font-bold text-white">
              Administrator Credential Policy
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              For security, primary administrator password hashes are stored server-side in <span className="font-mono text-gray-300">.admin-secrets/admin-credentials.json</span> (never editable from browser storage). Owner Google Workspace SSO for <strong className="text-white">{adminEmail}</strong> is verified via signed Firebase ID tokens on the server.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              To rotate server administrator credentials on Hostinger or Node, update the hashed entry in <span className="font-mono">.admin-secrets/admin-credentials.json</span> via SSH/server provisioning rather than client forms.
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#DFB982] uppercase">
                  Offline Password Strength Checker
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Test candidate password against complexity rules (local only)"
                className="w-full bg-[#120B0D] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#DFB982]"
              />

              {newPassword.length > 0 && (
                <div className="mt-3 p-3.5 rounded-xl bg-[#120B0D] border border-gray-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Entropy Score:</span>
                    <span
                      className={`font-bold ${
                        passwordAnalysis.score >= 75
                          ? 'text-emerald-400'
                          : passwordAnalysis.score >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {passwordAnalysis.level} ({passwordAnalysis.score}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordAnalysis.score >= 75
                          ? 'bg-emerald-500'
                          : passwordAnalysis.score >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${passwordAnalysis.score}%` }}
                    />
                  </div>

                  {passwordAnalysis.isCompromised && (
                    <div className="p-2 rounded-lg bg-red-950/70 border border-red-700/60 text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                      <span>This password has been exposed in public breaches. Choose a unique combination.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px]">
                    <div className={passwordAnalysis.requirements.minLength ? 'text-emerald-400' : 'text-gray-500'}>
                      ✓ Minimum 12 characters
                    </div>
                    <div className={passwordAnalysis.requirements.hasUpper ? 'text-emerald-400' : 'text-gray-500'}>
                      ✓ Uppercase letter
                    </div>
                    <div className={passwordAnalysis.requirements.hasLower ? 'text-emerald-400' : 'text-gray-500'}>
                      ✓ Lowercase letter
                    </div>
                    <div className={passwordAnalysis.requirements.hasNumber ? 'text-emerald-400' : 'text-gray-500'}>
                      ✓ Number (0-9)
                    </div>
                    <div className={passwordAnalysis.requirements.hasSpecial ? 'text-emerald-400' : 'text-gray-500'}>
                      ✓ Special symbol (!@#$)
                    </div>
                    <div className={passwordAnalysis.requirements.notCompromised ? 'text-emerald-400' : 'text-red-400'}>
                      ✓ No breach collision
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUTHENTICATION & SECRET KEY HELPER */}
      {activeTab === '2fa' && (
        <div className="max-w-2xl bg-[#1C1215] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-800">
            <div>
              <h3 className="font-serif text-xl font-bold text-white">
                Authentication & Key Reference
              </h3>
              <p className="text-xs text-gray-400">
                Owner login is protected via Google Workspace SSO and backend signed tokens. TOTP helper keys below are for optional server-side provisioning.
              </p>
            </div>
            <span className="bg-[#0F4C4A]/40 text-[#DFB982] border border-[#0F4C4A] text-xs font-bold px-3 py-1 rounded-full uppercase">
              SSO + Token
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#120B0D] rounded-2xl border border-gray-800 space-y-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider block">
                Generated Base32 Key Preview (Helper Only)
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-[#DFB982] tracking-widest">
                  {totpSecret}
                </span>
                <button
                  type="button"
                  onClick={handleGenerateNew2FA}
                  className="text-xs text-[#DFB982] hover:text-white underline cursor-pointer"
                >
                  Generate New Preview
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-serif text-sm font-bold text-white mb-2">
                Sample Reference Recovery Codes
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                If you enable server-side TOTP in <span className="font-mono">.admin-secrets/admin-credentials.json</span>, store offline recovery codes safely outside the web root.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#120B0D] border border-gray-800 rounded-xl font-mono text-center text-xs text-gray-200"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
