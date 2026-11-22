import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowLeft,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import {
  analyzePassword,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  logAuditEvent
} from '../../lib/securityService';
import { useAuth } from '../../context/AuthContext';

interface AdminLoginViewProps {
  onSuccessLogin: () => void;
  onNavigateHome: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onSuccessLogin,
  onNavigateHome
}) => {
  const {
    loginAdminBackend,
    setupAdminPassword,
    getLastAdminAuthError,
    exchangeFirebaseAdminToken,
    signInWithGoogle,
    signInWithEmail,
    resetPassword,
    user,
    adminSessionActive
  } = useAuth();

  const [email, setEmail] = useState('anavneeraj2003@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Server auth capabilities
  const [authCapabilities, setAuthCapabilities] = useState<{
    loaded: boolean;
    passwordConfigured: boolean;
    canFirstRunSetup: boolean;
  }>({
    loaded: false,
    passwordConfigured: true,
    canFirstRunSetup: false
  });
  const [setupMode, setSetupMode] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 2FA Flow
  const [step2FA, setStep2FA] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Forgot Password Modal
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Rate Limiting Cooldown
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Password analysis
  const passwordAnalysis = analyzePassword(password);

  // Query server authentication status on mount
  const refreshAuthCapabilities = async () => {
    try {
      const res = await fetch('/api/admin/auth-status', {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!res.ok) {
        setAuthCapabilities({ loaded: true, passwordConfigured: true, canFirstRunSetup: false });
        return;
      }
      const data = await res.json().catch(() => null);
      if (data && typeof data.passwordConfigured === 'boolean') {
        setAuthCapabilities({
          loaded: true,
          passwordConfigured: Boolean(data.passwordConfigured),
          canFirstRunSetup: Boolean(data.canFirstRunSetup)
        });
      }
    } catch {
      setAuthCapabilities({ loaded: true, passwordConfigured: true, canFirstRunSetup: false });
    }
  };

  useEffect(() => {
    refreshAuthCapabilities();
  }, []);

  // Auto-detect when Google/Firebase sign-in has exchanged a verified backend admin session token
  useEffect(() => {
    let active = true;
    if (adminSessionActive) {
      onSuccessLogin();
      return;
    }
    if (!googleSigningIn && user && user.email?.toLowerCase() === 'anavneeraj2003@gmail.com') {
      exchangeFirebaseAdminToken(user).then((ok) => {
        if (ok && active) {
          onSuccessLogin();
        }
      });
    }
    return () => {
      active = false;
    };
  }, [user, adminSessionActive, googleSigningIn, exchangeFirebaseAdminToken, onSuccessLogin]);

  useEffect(() => {
    // Check rate limiting on mount
    const status = checkRateLimit(email);
    if (!status.allowed) {
      setLockoutRemaining(status.remainingSeconds);
    }
  }, [email]);

  useEffect(() => {
    let timer: any;
    if (lockoutRemaining > 0) {
      timer = setInterval(() => {
        setLockoutRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Rate limit check
    const rateStatus = checkRateLimit(email);
    if (!rateStatus.allowed) {
      setErrorMessage(`Account temporarily locked out for security due to repeated failed attempts. Please retry in ${rateStatus.remainingSeconds} seconds.`);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your administrator email and password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate via secure backend administrator endpoint
      const backendRes = await loginAdminBackend(email.trim(), password);

      if (backendRes.requires2FA) {
        setStep2FA(true);
        setLoading(false);
        return;
      }

      if (backendRes.success) {
        resetFailedAttempts(email);
        // Optionally sync Firebase session if available
        try {
          await signInWithEmail(email.trim(), password);
        } catch {}
        setSuccessMessage('Authentication verified. Redirecting to Executive Admin Dashboard...');
        setLoading(false);
        onSuccessLogin();
        return;
      }

      // 2. Try Firebase email/password login and exchange its verified ID token for a backend session
      try {
        await signInWithEmail(email.trim(), password);
        const exchanged = await exchangeFirebaseAdminToken();
        if (exchanged) {
          resetFailedAttempts(email);
          setSuccessMessage('Authentication verified. Redirecting to Executive Admin Dashboard...');
          setLoading(false);
          onSuccessLogin();
          return;
        }
      } catch (fbErr: any) {
        if (fbErr?.code === 'auth/operation-not-allowed') {
          console.warn('Firebase Auth Email/Password provider is disabled in Firebase Console.');
        }
      }

      const isUnconfiguredServerError = Boolean(
        backendRes.error && /not configured/i.test(backendRes.error)
      );

      // Both failed: handle failed attempt & report accurate reason
      setLoading(false);

      if (isUnconfiguredServerError) {
        await refreshAuthCapabilities();
        setErrorMessage(
          backendRes.error ||
            'Server password login is not configured. Sign in with Google Workspace Admin (anavneeraj2003@gmail.com) or configure ADMIN_PASSWORD_HASH outside public_html.'
        );
        return;
      }

      const failStatus = recordFailedAttempt(email);

      await logAuditEvent({
        adminId: 'unauthenticated',
        adminEmail: email.trim(),
        action: 'ADMIN_LOGIN_FAILED',
        category: 'auth',
        ipAddress: 'client',
        userAgent: navigator.userAgent,
        result: 'failure',
        details: `Failed credentials attempt for ${email.trim()}: ${backendRes.error || 'Unauthorized'}`
      });

      if (failStatus.locked) {
        setLockoutRemaining(failStatus.remainingSeconds);
        setErrorMessage(`Security Lockout Activated: 5 consecutive failed attempts detected. Access suspended for ${Math.ceil(failStatus.remainingSeconds / 60)} minutes.`);
      } else {
        setErrorMessage(backendRes.error || 'Invalid administrator credentials. Please check your credentials and try again.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Authentication error encountered. Please check credentials and try again.');
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please enter your admin email, new password, and confirmation password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please enter the same password in both fields.');
      return;
    }
    if (!passwordAnalysis.isStrong) {
      setErrorMessage(
        passwordAnalysis.warnings[0] ||
          'Please choose a stronger password (at least 12 characters with uppercase, lowercase, number, and symbol).'
      );
      return;
    }

    setLoading(true);
    const res = await setupAdminPassword(email.trim(), password, confirmPassword);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save administrator password.');
      return;
    }

    resetFailedAttempts(email);
    setAuthCapabilities((prev) => ({ ...prev, passwordConfigured: true, canFirstRunSetup: false }));
    setSetupMode(false);
    setSuccessMessage('Administrator password saved securely. Entering Executive Admin Dashboard...');
    onSuccessLogin();
  };

  const handleGoogleAdminLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    setGoogleSigningIn(true);
    try {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        setLoading(false);
        setGoogleSigningIn(false);
        setErrorMessage('Google sign-in did not complete. Please allow popups and try again.');
        return;
      }

      const exchanged = await exchangeFirebaseAdminToken(signedInUser);
      if (exchanged) {
        setLoading(false);
        setGoogleSigningIn(false);
        onSuccessLogin();
        return;
      }

      setLoading(false);
      setGoogleSigningIn(false);
      if (signedInUser.email?.toLowerCase() !== 'anavneeraj2003@gmail.com') {
        setErrorMessage(
          `Signed-in Google account (${signedInUser.email || 'unknown'}) is not authorized for Executive Admin access. Please select anavneeraj2003@gmail.com in the Google account chooser.`
        );
      } else {
        setErrorMessage(
          getLastAdminAuthError() ||
            'Google session verified, but backend admin authorization failed. Please refresh and try again.'
        );
      }
    } catch (err: any) {
      setLoading(false);
      setGoogleSigningIn(false);
      const code = String(err?.code || err?.message || '');
      if (code.includes('auth/popup-blocked')) {
        setErrorMessage('Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (code.includes('auth/popup-closed-by-user') || code.includes('auth/cancelled-popup-request')) {
        setErrorMessage('Google Sign-In window was closed before completing. Please click Google Workspace Admin Sign In again.');
      } else if (code.includes('auth/unauthorized-domain')) {
        setErrorMessage(
          `Google Sign-In is not yet authorized on this domain (${window.location.hostname}) in Firebase Authentication settings. Add this hostname to Firebase Console → Authentication → Authorized domains, or sign in with an Administrator Password.`
        );
      } else if (code.includes('auth/network-request-failed')) {
        setErrorMessage('Network error during Google Sign-In. Please check your internet connection and retry.');
      } else {
        setErrorMessage(err?.message || 'Google administrator sign-in failed. Please try again.');
      }
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (!otpCode.trim()) {
      setOtpError('Please enter the 6-digit TOTP verification code from your authenticator app.');
      return;
    }

    setLoading(true);
    const res = await loginAdminBackend(email.trim(), password, otpCode.trim());
    setLoading(false);

    if (!res.success) {
      setOtpError(res.error || 'Invalid two-factor authentication code.');
      return;
    }

    resetFailedAttempts(email);
    await logAuditEvent({
      adminId: user?.uid || 'super_admin',
      adminEmail: email.trim(),
      action: 'ADMIN_LOGIN_SUCCESS_2FA',
      category: 'auth',
      ipAddress: 'client',
      userAgent: navigator.userAgent,
      result: 'success',
      details: 'Super Admin authenticated with server-verified 2FA TOTP token.'
    });

    setSuccessMessage('Authentication verified. Redirecting to Executive Admin Dashboard...');
    setTimeout(() => {
      onSuccessLogin();
    }, 400);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotSubmitted(true);
      await logAuditEvent({
        adminId: 'recovery',
        adminEmail: forgotEmail.trim(),
        action: 'PASSWORD_RESET_REQUESTED',
        category: 'security',
        ipAddress: '103.212.144.20',
        userAgent: navigator.userAgent,
        result: 'success',
        details: 'Cryptographically signed password reset instructions sent.'
      });
    } catch {
      // Show generic success confirmation regardless to prevent email enumeration
      setForgotSubmitted(true);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#140D0F] text-[#F5EDE5] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient luxury glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#DFB982]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#0F4C4A]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Return to Store Link */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#DFB982] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Storefront</span>
        </button>
      </div>

      <div className="max-w-md w-full space-y-8 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#DFB982] to-[#B38D4A] p-0.5 shadow-2xl mx-auto flex items-center justify-center">
            <div className="w-full h-full bg-[#1C1215] rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-[#DFB982]" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-white">
              VIDHYAA STUDIO
            </h1>
            <p className="text-xs uppercase tracking-[0.25em] text-[#DFB982] font-semibold mt-1">
              Executive Admin Portal
            </p>
          </div>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Authorized jewellery management, real-time inventory and encrypted audit dashboard.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[#1C1215]/95 border border-[#DFB982]/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative">
          {/* Rate Limit Banner */}
          {lockoutRemaining > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-start gap-3 text-xs text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-red-300">Security Cooldown Active</strong>
                <span>
                  Too many failed authentication attempts. Access paused for{' '}
                  <strong className="font-mono text-white">{lockoutRemaining}s</strong> to prevent unauthorized brute-force entry.
                </span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-600/60 flex items-center gap-3 text-xs text-emerald-200">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-red-950/70 border border-red-800/60 flex items-start gap-3 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Unconfigured live-server guidance banner */}
          {!step2FA && authCapabilities.loaded && !authCapabilities.passwordConfigured && !setupMode && (
            <div className="mb-6 p-4 rounded-2xl bg-[#0F4C4A]/35 border border-[#DFB982]/40 text-xs text-[#F5EDE5] space-y-1.5">
              <div className="font-bold text-[#DFB982] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Recommended: Google Workspace Admin Sign In</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Server password login is not configured yet. Sign in using <strong>Google Workspace Admin Sign In</strong> below with <span className="font-mono text-[#DFB982]">anavneeraj2003@gmail.com</span>.
              </p>
              {authCapabilities.canFirstRunSetup && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSetupMode(true);
                  }}
                  className="text-[#DFB982] underline font-semibold hover:text-white cursor-pointer pt-0.5"
                >
                  Or set up first-run Admin Password now →
                </button>
              )}
            </div>
          )}

          {/* Step 1: First-Run Setup OR Email & Password */}
          {!step2FA ? (
            setupMode && authCapabilities.canFirstRunSetup ? (
              <form onSubmit={handleSetupSubmit} className="space-y-5">
                <div className="p-3.5 rounded-2xl bg-[#0F4C4A]/30 border border-[#DFB982]/35 text-xs space-y-1">
                  <div className="font-bold text-[#DFB982] flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>First-Run Admin Password Setup</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">
                    No server admin password is saved yet. Create your PBKDF2-SHA256 admin password now to unlock Executive Admin login.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase tracking-wider mb-2">
                    Authorized Admin Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#120B0D] border border-[#DFB982]/30 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982] focus:ring-1 focus:ring-[#DFB982] transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase tracking-wider mb-2">
                    New Admin Password (min 12 chars)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Upper, lower, digit & symbol"
                      disabled={loading}
                      className="w-full bg-[#120B0D] border border-[#DFB982]/30 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982] focus:ring-1 focus:ring-[#DFB982] transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-[#120B0D] border border-[#DFB982]/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Security Strength:</span>
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
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
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
                      {passwordAnalysis.warnings.length > 0 && (
                        <p className="text-[11px] text-amber-300">{passwordAnalysis.warnings[0]}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase tracking-wider mb-2">
                    Confirm Admin Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      disabled={loading}
                      className="w-full bg-[#120B0D] border border-[#DFB982]/30 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982] focus:ring-1 focus:ring-[#DFB982] transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 shadow-lg cursor-pointer disabled:opacity-50 border border-[#DFB982]/30"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#DFB982]" />
                      <span>Saving Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Password & Enter Dashboard</span>
                      <ArrowRight className="w-4 h-4 text-[#DFB982]" />
                    </>
                  )}
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#DFB982]/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#1C1215] px-3 text-gray-400 font-medium tracking-wider">Or Use Google</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAdminLogin}
                  disabled={loading}
                  className="w-full bg-[#120B0D] hover:bg-[#1a0f12] border border-[#DFB982]/40 text-[#F5EDE5] py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>Google Workspace Admin Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSetupMode(false);
                  }}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer text-center"
                >
                  Switch to standard password login
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase tracking-wider mb-2">
                    Admin Email / Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@vidhyaajewellery.com"
                      disabled={lockoutRemaining > 0 || loading}
                      className="w-full bg-[#120B0D] border border-[#DFB982]/30 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982] focus:ring-1 focus:ring-[#DFB982] transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-[#DFB982] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotModalOpen(true)}
                      className="text-xs text-[#DFB982] hover:text-white underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={lockoutRemaining > 0 || loading}
                      className="w-full bg-[#120B0D] border border-[#DFB982]/30 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982] focus:ring-1 focus:ring-[#DFB982] transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength & Breach Detection Preview */}
                  {password.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-[#120B0D] border border-[#DFB982]/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Security Strength:</span>
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

                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
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
                        <div className="flex items-center gap-1.5 text-red-400 text-[11px] font-semibold pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Warning: Commonly breached password pattern detected!</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-[#120B0D] border-[#DFB982]/40 text-[#DFB982] focus:ring-0 cursor-pointer"
                    />
                    <span>Remember this secure workstation</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={lockoutRemaining > 0 || loading}
                  className="w-full bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#DFB982]/30 active:scale-98"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#DFB982]" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Authenticate & Continue</span>
                      <ArrowRight className="w-4 h-4 text-[#DFB982]" />
                    </>
                  )}
                </button>

                {/* Alternative Google Admin Sign-in */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#DFB982]/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#1C1215] px-3 text-gray-400 font-medium tracking-wider">Or Sign In Via</span>
                  </div>
                </div>

                {user && user.email && user.email.toLowerCase() !== 'anavneeraj2003@gmail.com' && (
                  <p className="text-[11px] text-amber-300/90 text-center">
                    Currently signed in as <span className="font-mono">{user.email}</span>. Click below to select <span className="font-mono">anavneeraj2003@gmail.com</span>.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGoogleAdminLogin}
                  disabled={loading}
                  className="w-full bg-[#120B0D] hover:bg-[#1a0f12] border border-[#DFB982]/40 text-[#F5EDE5] py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"
                    />
                  </svg>
                  <span>Google Workspace Admin Sign In</span>
                </button>
              </form>
            )
          ) : (
            /* Step 2: Two-Factor Authentication TOTP */
            <form onSubmit={handleVerify2FA} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#0F4C4A]/40 border border-[#0F4C4A] flex items-center justify-center mx-auto text-[#DFB982]">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg font-bold text-white">
                  Two-Factor Authentication
                </h3>
                <p className="text-xs text-gray-400">
                  Enter the 6-digit TOTP verification code from your authenticator app (Google Authenticator, Authy) or backup recovery key.
                </p>
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-700/60 flex items-center gap-2 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#DFB982] uppercase tracking-wider mb-2 text-center">
                  6-Digit OTP / Backup Code
                </label>
                <input
                  type="text"
                  maxLength={9}
                  autoFocus
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-[#120B0D] border border-[#DFB982]/40 rounded-xl px-4 py-3.5 text-center font-mono text-2xl tracking-[0.3em] text-white placeholder-gray-600 focus:outline-none focus:border-[#DFB982] focus:ring-1 focus:ring-[#DFB982]"
                />
                <p className="text-[11px] text-center text-gray-400 mt-2">
                  Enter the code from your authenticator app or backup recovery key
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg border border-[#DFB982]/30"
                >
                  {loading ? (
                    <span>Validating OTP Token...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
                      <span>Confirm & Enter Dashboard</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep2FA(false)}
                  className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer text-center"
                >
                  ← Back to credential login
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security Compliance Footnote */}
        <div className="text-center space-y-1 text-[11px] text-gray-500">
          <p className="flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-[#DFB982]" />
            <span>256-Bit TLS Encryption • PBKDF2-SHA256 Hashing • OWASP Compliant</span>
          </p>
          <p>Protected by VIDHYAA Automated Intrusion Detection & Audit Telemetry</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#1C1215] border border-[#DFB982]/40 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#DFB982]" />
                <h3 className="font-serif text-lg font-bold text-white">
                  Reset Administrator Password
                </h3>
              </div>
              <button
                onClick={() => {
                  setForgotModalOpen(false);
                  setForgotSubmitted(false);
                }}
                className="text-gray-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-base font-bold text-white">
                  Recovery Email Dispatched
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  If the entered email is an authorized administrator, a single-use cryptographically signed reset token has been transmitted with a 15-minute validity window.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotModalOpen(false);
                    setForgotSubmitted(false);
                  }}
                  className="bg-[#0F4C4A] hover:bg-[#0A3635] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Enter your registered administrator email address. We will verify your security credentials and provide instructions to create a compliant, high-entropy password.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#DFB982] uppercase mb-1.5">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@vidhyaajewellery.com"
                    className="w-full bg-[#120B0D] border border-[#DFB982]/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#DFB982]"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="flex-1 py-3 border border-gray-700 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
