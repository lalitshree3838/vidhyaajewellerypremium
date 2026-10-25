import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Check,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Phone,
  RotateCcw,
  CheckCircle,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CountryCodeSelector } from './CountryCodeSelector';
import {
  CountryData,
  DEFAULT_COUNTRY,
  validateInternationalPhone,
  maskPhoneNumber
} from '../lib/countries';
import {
  sendMobileOtp,
  verifyMobileOtp,
  clearOtpSession
} from '../lib/otpAuthService';

interface PromotionalLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PromotionalLoginModal: React.FC<PromotionalLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  // Primary Method: 'email' | 'mobile'
  const [authMethod, setAuthMethod] = useState<'email' | 'mobile'>('email');

  // Email Mode: 'signup' (Default for promotional offer) | 'signin' | 'success'
  const [mode, setMode] = useState<'signup' | 'signin' | 'success'>('signup');

  // Input fields for Email
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mobile OTP States
  const [mobileStep, setMobileStep] = useState<'enter_phone' | 'verify_otp'>('enter_phone');
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [activeSessionE164, setActiveSessionE164] = useState('');
  const [maskedPhoneDisplay, setMaskedPhoneDisplay] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAuthMethod('email');
      setMode('signup');
      setDisplayName('');
      setEmail('');
      setPassword('');
      setPhoneNumber('');
      setOtpDigits(['', '', '', '', '', '']);
      setMobileStep('enter_phone');
      setError(null);
      setSuccessMsg(null);
      setLoading(false);
      setShowPassword(false);
      clearOtpSession();
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const phoneValidation = validateInternationalPhone(phoneNumber, selectedCountry.code);

  // Translate Firebase errors into helpful messages
  const parseError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account already exists with this email address. Please sign in below.';
    }
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password') || raw.includes('auth/user-not-found')) {
      return 'Incorrect email address or password. Please verify your credentials.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters long.';
    }
    if (raw.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (raw.includes('auth/invalid-verification-code')) {
      return 'Invalid 6-digit verification code. Please check your SMS and try again.';
    }
    if (raw.includes('auth/code-expired')) {
      return 'This verification code has expired. Please tap Resend OTP to receive a new code.';
    }
    if (raw.includes('auth/too-many-requests')) {
      return 'Too many SMS requests. Please wait a few moments before trying again.';
    }
    return raw || 'Authentication failed. Please try again.';
  };

  // Submit Handler (Email Sign Up or Sign In)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const name = displayName.trim() || 'Valued Patron';
        await signUpWithEmail(cleanEmail, password, name);
      } else {
        await signInWithEmail(cleanEmail, password);
      }

      setMode('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Google Sign-In
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      setMode('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // Mobile: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phoneNumber.trim()) {
      setError('Please enter your mobile phone number.');
      return;
    }

    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || `Please enter a valid phone number for ${selectedCountry.name}.`);
      return;
    }

    setLoading(true);
    try {
      const result = await sendMobileOtp(phoneNumber, selectedCountry.code);
      setActiveSessionE164(result.e164);
      setMaskedPhoneDisplay(result.maskedNumber || maskPhoneNumber(result.e164));
      setMobileStep('verify_otp');
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      setSuccessMsg(result.message);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // Mobile: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullCode = otpDigits.join('').trim();
    if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) {
      setError('Please enter all 6 digits of the SMS verification code.');
      return;
    }

    setLoading(true);
    try {
      const phoneToVerify = activeSessionE164 || phoneNumber;
      await verifyMobileOtp(phoneToVerify, fullCode, selectedCountry.code);
      setMode('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // Mobile: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const phoneToSend = activeSessionE164 || phoneNumber;
      const result = await sendMobileOtp(phoneToSend, selectedCountry.code);
      setActiveSessionE164(result.e164);
      setMaskedPhoneDisplay(result.maskedNumber || maskPhoneNumber(result.e164));
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // OTP digit input handlers
  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      const updated = [...otpDigits];
      for (let i = 0; i < chars.length; i++) {
        if (index + i < 6) updated[index + i] = chars[i];
      }
      setOtpDigits(updated);
      const nextIdx = Math.min(index + chars.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    const updated = [...otpDigits];
    updated[index] = clean;
    setOtpDigits(updated);
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E8DCCF] transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-[#FAF7F2]/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all cursor-pointer backdrop-blur-sm"
          aria-label="Close promotion modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="relative bg-[#3B1E22] text-[#FAF7F2] p-6 pb-6 text-center overflow-hidden">
          <div className="absolute -top-12 -left-12 w-44 h-44 bg-[#802336] rounded-full blur-2xl opacity-60 pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-[#0F5B46] rounded-full blur-2xl opacity-40 pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#C5A059] border border-[#C5A059]/30 text-[10px] font-bold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Privilege Patron Welcome</span>
            </div>

            <h2 className="font-serif text-2xl font-bold tracking-wide text-[#FFFFFF] drop-shadow-sm">
              Unlock 10% Off Your Order
            </h2>

            <p className="text-xs text-[#FAF7F2]/90 leading-relaxed max-w-xs mx-auto">
              Join the VIDHYAA Atelier circle to claim your exclusive introductory voucher on handcrafted bridal & silver jewellery.
            </p>
          </div>
        </div>

        {/* Primary Method Switcher: Login with Mobile Number vs Login with Email */}
        {mode !== 'success' && (
          <div className="grid grid-cols-2 border-b border-[#E8DCCF] text-xs font-semibold bg-[#FAF7F2]">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('mobile');
                setError(null);
              }}
              className={`py-3 px-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMethod === 'mobile'
                  ? 'border-b-2 border-[#802336] text-[#802336] bg-white font-bold shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-[#802336]" />
              <span>Login with Mobile Number</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod('email');
                setError(null);
              }}
              className={`py-3 px-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMethod === 'email'
                  ? 'border-b-2 border-[#802336] text-[#802336] bg-white font-bold shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Login with Email</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 bg-white space-y-4 max-h-[75vh] overflow-y-auto">
          {mode === 'success' ? (
            <div className="text-center py-8 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-[#3B1E22]">Welcome to VIDHYAA Studio!</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Your 10% privilege discount code <strong className="font-mono text-[#802336]">ROYAL10</strong> is active for checkout.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2 animate-fadeIn font-medium">
                  <X className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {/* Success Message */}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2 animate-fadeIn font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span className="flex-1">{successMsg}</span>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* OPTION 1: LOGIN WITH MOBILE NUMBER (INTERNATIONAL SMS OTP) */}
              {/* ---------------------------------------------------- */}
              {authMethod === 'mobile' && (
                <div>
                  {mobileStep === 'enter_phone' ? (
                    <form onSubmit={handleSendOtp} className="space-y-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                            Mobile Phone Number *
                          </label>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-[#802336]" />
                            <span>Worldwide SMS</span>
                          </span>
                        </div>

                        <div className="flex gap-2 items-stretch">
                          <CountryCodeSelector
                            selectedCountry={selectedCountry}
                            onSelectCountry={(c) => {
                              setSelectedCountry(c);
                              setError(null);
                            }}
                            disabled={loading}
                          />

                          <div className="relative flex-1 flex items-center">
                            <Phone className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                            <input
                              type="tel"
                              required
                              autoFocus
                              value={phoneNumber}
                              onChange={(e) => {
                                setPhoneNumber(e.target.value);
                                setError(null);
                              }}
                              placeholder={selectedCountry.placeholder || 'Enter mobile number'}
                              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs font-mono text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {phoneNumber.trim() && (
                          <div className="mt-1.5 text-[11px]">
                            {phoneValidation.isValid ? (
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Valid {selectedCountry.name} mobile ({phoneValidation.formattedInternational})</span>
                              </span>
                            ) : (
                              <span className="text-amber-700">
                                {phoneValidation.error || `Please enter a valid phone number for ${selectedCountry.name}.`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={loading || (phoneNumber.trim().length > 0 && !phoneValidation.isValid)}
                        className="w-full bg-[#3B1E22] hover:bg-[#802336] disabled:bg-gray-300 disabled:cursor-not-allowed text-[#FAF7F2] py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Send OTP</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Switch back to Email button */}
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMethod('email');
                            setError(null);
                          }}
                          className="text-xs text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer"
                        >
                          ✉️ Switch back to Login with Email
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Step 2: 6-Digit OTP Verification Field */
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="bg-[#FAF7F2] border border-[#E8DCCF] rounded-2xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                            Code sent to:
                          </p>
                          <p className="font-mono font-bold text-gray-900 mt-0.5">
                            {maskedPhoneDisplay || maskPhoneNumber(phoneNumber)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setMobileStep('enter_phone');
                            setError(null);
                          }}
                          className="text-[#802336] hover:underline text-xs font-semibold cursor-pointer"
                        >
                          Change Number
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 text-center">
                          Enter 6-Digit Verification Code (OTP) *
                        </label>

                        <div className="flex justify-center gap-2">
                          {otpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => { otpInputRefs.current[idx] = el; }}
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={digit}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              className={`w-10 h-11 text-center text-lg font-mono font-bold rounded-xl border transition-all outline-none ${
                                digit
                                  ? 'border-[#802336] bg-[#802336]/5 text-[#3B1E22] ring-1 ring-[#802336]'
                                  : 'border-[#E8DCCF] bg-white text-gray-800 focus:border-[#802336] focus:ring-1 focus:ring-[#802336]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpDigits.join('').length !== 6}
                        className="w-full bg-[#802336] hover:bg-[#631B2A] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verifying OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Verify OTP & Sign In</span>
                            <Check className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Resend OTP */}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                        <span>Didn't receive OTP?</span>
                        {resendCooldown > 0 ? (
                          <span className="font-mono text-gray-400">
                            Resend in <strong className="text-gray-700">{resendCooldown}s</strong>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={loading}
                            className="text-[#802336] hover:text-[#3B1E22] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Resend OTP</span>
                          </button>
                        )}
                      </div>

                      {/* Switch back to Email button */}
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMethod('email');
                            setError(null);
                          }}
                          className="text-xs text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer"
                        >
                          ✉️ Switch back to Login with Email
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* OPTION 2: LOGIN WITH EMAIL & PASSWORD                */}
              {/* ---------------------------------------------------- */}
              {authMethod === 'email' && (
                <>
                  {/* Mode Toggle Tabs for Email (Create Account vs Sign In) */}
                  <div className="flex border-b border-[#E8DCCF] text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                      }}
                      className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                        mode === 'signup'
                          ? 'border-b-2 border-[#802336] text-[#802336] font-bold'
                          : 'text-gray-500 hover:text-black'
                      }`}
                    >
                      Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                      }}
                      className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                        mode === 'signin'
                          ? 'border-b-2 border-[#802336] text-[#802336] font-bold'
                          : 'text-gray-500 hover:text-black'
                      }`}
                    >
                      Existing Member Sign In
                    </button>
                  </div>

                  {/* Email / Password Form */}
                  <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Full Name
                        </label>
                        <div className="relative flex items-center">
                          <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Radhika Sharma"
                            className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Email Address *
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="yourname@gmail.com"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Password *
                      </label>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full pl-9 pr-10 py-2 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#3B1E22] hover:bg-[#802336] disabled:bg-gray-400 text-[#FAF7F2] py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{mode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{mode === 'signup' ? 'Claim 10% Off & Register' : 'Sign In'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Switch to Mobile Number Option */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('mobile');
                        setError(null);
                      }}
                      className="text-xs text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer"
                    >
                      📱 Or Login with Mobile Number (Worldwide SMS OTP)
                    </button>
                  </div>
                </>
              )}

              {/* 1-Click Google Sign-In */}
              <div className="pt-1">
                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-[#E8DCCF] w-full"></div>
                  <span className="bg-white px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 absolute">
                    Or
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full mt-1 py-2 px-3 border border-[#E8DCCF] hover:border-gray-400 rounded-xl flex items-center justify-center gap-2.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-xs cursor-pointer active:scale-[0.99]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Trust Footer */}
              <div className="pt-2 text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F5B46]" />
                <span>100% Secure Firebase Authentication • No Spam</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
