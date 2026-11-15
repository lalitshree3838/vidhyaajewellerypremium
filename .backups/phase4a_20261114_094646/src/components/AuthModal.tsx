import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  ArrowRight,
  KeyRound,
  Phone,
  RotateCcw,
  Sparkles,
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

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot' | 'mobile';
  promptMessage?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
  promptMessage
}) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  // Primary Method: 'mobile' (Worldwide SMS OTP) vs 'email' (Email & Password)
  const [authMethod, setAuthMethod] = useState<'mobile' | 'email'>(
    initialMode === 'mobile' ? 'mobile' : 'email'
  );

  // Email sub-mode: 'signin' | 'signup' | 'forgot'
  const [emailMode, setEmailMode] = useState<'signin' | 'signup' | 'forgot'>(
    initialMode === 'mobile' ? 'signin' : (initialMode || 'signin')
  );

  // Mobile sub-step: 'enter_phone' | 'verify_otp'
  const [mobileStep, setMobileStep] = useState<'enter_phone' | 'verify_otp'>('enter_phone');
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [activeSessionE164, setActiveSessionE164] = useState('');
  const [maskedPhoneDisplay, setMaskedPhoneDisplay] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Form Fields for Email Mode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback States
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // OTP input refs for auto-focus navigation
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset modal state on open or mode switch
  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'mobile') {
        setAuthMethod('mobile');
        setMobileStep('enter_phone');
      } else {
        setAuthMethod('email');
        setEmailMode(initialMode || 'signin');
      }
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setPhoneNumber('');
      setOtpDigits(['', '', '', '', '', '']);
      setError(null);
      setSuccessMsg(null);
      setSubmitting(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      clearOtpSession();
    }
  }, [isOpen, initialMode]);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Real-time phone validation
  const phoneValidation = validateInternationalPhone(phoneNumber, selectedCountry.code);

  // Translate Firebase Auth error codes into polite, human-readable explanations
  const parseAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password') || raw.includes('auth/user-not-found')) {
      return 'Incorrect email address or password. Please verify and try again.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account already exists with this email address. Please sign in instead.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'Password is too weak. Please choose at least 6 characters.';
    }
    if (raw.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (raw.includes('auth/too-many-requests')) {
      return 'Too many attempts. For your security, requests are temporarily throttled. Please try again in a few moments.';
    }
    if (raw.includes('auth/network-request-failed')) {
      return 'Network connection error. Please verify your internet connection.';
    }
    if (raw.includes('auth/popup-closed-by-user')) {
      return 'Google Sign-In was closed before completing.';
    }
    if (raw.includes('auth/invalid-verification-code')) {
      return 'Incorrect verification code. Please check the 6-digit OTP received on your phone.';
    }
    if (raw.includes('auth/code-expired')) {
      return 'Verification code has expired. Please tap Resend OTP to receive a fresh code.';
    }
    return raw || 'Authentication request failed. Please try again.';
  };

  // ----------------------------------------------------
  // MOBILE NUMBER OTP HANDLERS
  // ----------------------------------------------------

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!phoneNumber.trim()) {
      setError(`Please enter your mobile number for ${selectedCountry.name}.`);
      return;
    }

    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || `Please enter a valid mobile number for ${selectedCountry.name}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await sendMobileOtp(phoneNumber, selectedCountry.code, 'auth-recaptcha-container');
      setActiveSessionE164(res.e164);
      setMaskedPhoneDisplay(res.maskedNumber);
      setMobileStep('verify_otp');
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      setSuccessMsg(res.message);
      // Focus first OTP box
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setError(parseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || submitting) return;
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await sendMobileOtp(phoneNumber, selectedCountry.code, 'auth-recaptcha-container');
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      setSuccessMsg(`A fresh verification code was dispatched to ${res.maskedNumber}`);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(parseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleaned.length > 1) {
      // Pasted full 6-digit code
      const pasted = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(5, pasted.length - 1);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    // Auto-advance to next box if digit entered
    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const fullCode = otpDigits.join('').trim();
    if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) {
      setError('Please enter all 6 digits of the verification code received on your phone.');
      return;
    }

    setSubmitting(true);
    try {
      const phoneToVerify = activeSessionE164 || phoneNumber;
      await verifyMobileOtp(phoneToVerify, fullCode, selectedCountry.code);
      setSuccessMsg('Phone verified successfully! Welcome to VIDHYAA Jewellery Studio.');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(parseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // EMAIL & PASSWORD HANDLERS
  // ----------------------------------------------------

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();

    // 1. SIGN IN FLOW
    if (emailMode === 'signin') {
      if (!cleanEmail) {
        setError('Please enter your email address.');
        return;
      }
      if (!password) {
        setError('Please enter your password.');
        return;
      }

      setSubmitting(true);
      try {
        await signInWithEmail(cleanEmail, password);
        setSuccessMsg('Welcome back! You are now signed in.');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 600);
      } catch (err) {
        setError(parseAuthError(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 2. SIGN UP / REGISTRATION FLOW
    if (emailMode === 'signup') {
      if (!displayName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify both fields.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms & Conditions to create an account.');
        return;
      }

      setSubmitting(true);
      try {
        await signUpWithEmail(cleanEmail, password, displayName.trim());
        setSuccessMsg('Account created successfully! Welcome to VIDHYAA Jewellery Studio.');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 800);
      } catch (err) {
        setError(parseAuthError(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 3. FORGOT PASSWORD FLOW
    if (emailMode === 'forgot') {
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError('Please enter the valid email address associated with your account.');
        return;
      }

      setSubmitting(true);
      try {
        await resetPassword(cleanEmail);
        setSuccessMsg(`A password reset link has been dispatched to ${cleanEmail}. Please check your inbox (and spam folder).`);
      } catch (err) {
        setError(parseAuthError(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }
  };

  // Google 1-Click Sign-In
  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      setSuccessMsg('Signed in with Google successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 500);
    } catch (err) {
      setError(parseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[#E8DCCF] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer z-10"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="bg-[#FAF7F2] p-6 pb-4 border-b border-[#E8DCCF] text-center">
          <div className="text-[#B8860B] mb-1 font-serif text-xs font-semibold tracking-widest uppercase flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#B8860B]" />
            <span>VIDHYAA JEWELLERY STUDIO</span>
            <Sparkles className="w-3 h-3 text-[#B8860B]" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
            {authMethod === 'mobile'
              ? mobileStep === 'enter_phone'
                ? 'Mobile Number Login'
                : 'Verify Mobile OTP'
              : emailMode === 'signin'
              ? 'Sign In to Your Account'
              : emailMode === 'signup'
              ? 'Create Patron Account'
              : 'Reset Your Password'}
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            {promptMessage || (authMethod === 'mobile'
              ? 'Worldwide international SMS verification for patrons across India & overseas'
              : emailMode === 'forgot'
              ? 'Enter your registered email address to receive a secure password reset link'
              : 'Roorkee, Haridwar Atelier • Royal Handcrafted Heirlooms')}
          </p>
        </div>

        {/* Primary Method Switcher (Mobile Number OTP vs Email & Password) */}
        <div className="grid grid-cols-2 border-b border-[#E8DCCF] text-xs font-semibold bg-[#FAF7F2]">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('mobile');
              setError(null);
              setSuccessMsg(null);
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
              setSuccessMsg(null);
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

        {/* Sub-Tabs for Email Method (Sign In / Register) */}
        {authMethod === 'email' && emailMode !== 'forgot' && (
          <div className="flex border-b border-[#E8DCCF] text-xs font-semibold bg-white">
            <button
              type="button"
              onClick={() => {
                setEmailMode('signin');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                emailMode === 'signin'
                  ? 'text-[#802336] font-bold border-b-2 border-[#802336]'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <Mail className="w-3 h-3" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmailMode('signup');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                emailMode === 'signup'
                  ? 'text-[#802336] font-bold border-b-2 border-[#802336]'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <UserIcon className="w-3 h-3" />
              <span>Create Account</span>
            </button>
          </div>
        )}

        {/* Modal Form Body */}
        <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 leading-relaxed animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 leading-relaxed animate-fadeIn">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span className="flex-1 font-medium">{successMsg}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* SECTION A: MOBILE NUMBER INTERNATIONAL OTP LOGIN     */}
          {/* ==================================================== */}
          {authMethod === 'mobile' && (
            <div>
              {mobileStep === 'enter_phone' ? (
                /* Step 1: Country Selector & Phone Input */
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Mobile Phone Number *</span>
                      <span className="text-[10px] text-gray-400 font-normal lowercase flex items-center gap-1">
                        <Globe className="w-3 h-3 text-[#802336]" />
                        <span>Worldwide SMS</span>
                      </span>
                    </label>

                    {/* Integrated International Phone Input Group */}
                    <div className="flex gap-2 items-stretch">
                      {/* Searchable Country Code Selector */}
                      <CountryCodeSelector
                        selectedCountry={selectedCountry}
                        onSelectCountry={(c) => {
                          setSelectedCountry(c);
                          setError(null);
                        }}
                        disabled={submitting}
                      />

                      {/* Phone Input */}
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
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs font-mono text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Validation Feedback Hint */}
                    {phoneNumber.trim() && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                        {phoneValidation.isValid ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Valid {selectedCountry.name} mobile ({phoneValidation.formattedInternational})</span>
                          </span>
                        ) : (
                          <span className="text-amber-700 font-normal">
                            {phoneValidation.error || `Please enter a complete phone number for ${selectedCountry.name}.`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Visible reCAPTCHA Container */}
                  <div className="flex flex-col items-center justify-center my-1.5">
                    <div id="auth-recaptcha-container" className="min-h-[78px] flex items-center justify-center"></div>
                  </div>

                  {/* Send OTP Button */}
                  <button
                    type="submit"
                    disabled={submitting || (phoneNumber.trim().length > 0 && !phoneValidation.isValid)}
                    className="w-full bg-[#3B1E22] hover:bg-[#802336] disabled:bg-gray-300 disabled:cursor-not-allowed text-[#FAF7F2] py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Verification Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Verification Code (OTP)</span>
                        <ArrowRight className="w-4 h-4 text-[#DFB982]" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    A real 6-digit SMS verification code will be dispatched to your phone. Standard carrier SMS rates apply.
                  </p>

                  {/* Switch back to Email button */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('email');
                        setError(null);
                        setSuccessMsg(null);
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
                  <div className="bg-[#FAF7F2] border border-[#E8DCCF] rounded-2xl p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                        Verification code sent to:
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
                        setSuccessMsg(null);
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

                    {/* 6 Discrete OTP Input Boxes */}
                    <div className="flex justify-center gap-2 sm:gap-2.5">
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
                          className={`w-11 h-12 sm:w-12 sm:h-13 text-center text-lg font-mono font-bold rounded-xl border transition-all outline-none ${
                            digit
                              ? 'border-[#802336] bg-[#802336]/5 text-[#3B1E22] ring-1 ring-[#802336]'
                              : 'border-[#E8DCCF] bg-white text-gray-800 focus:border-[#802336] focus:ring-1 focus:ring-[#802336]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Verify Action Button */}
                  <button
                    type="submit"
                    disabled={submitting || otpDigits.join('').length !== 6}
                    className="w-full bg-[#802336] hover:bg-[#631B2A] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Sign In</span>
                        <CheckCircle className="w-4 h-4 text-[#DFB982]" />
                      </>
                    )}
                  </button>

                  {/* Resend OTP with Cooldown Timer */}
                  <div className="pt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Didn't receive code?</span>
                    {resendCooldown > 0 ? (
                      <span className="font-mono text-gray-400">
                        Resend in <strong className="text-gray-700">{resendCooldown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={submitting}
                        className="text-[#802336] hover:text-[#3B1E22] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Resend OTP via SMS</span>
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
                        setSuccessMsg(null);
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

          {/* ==================================================== */}
          {/* SECTION B: EMAIL & PASSWORD AUTHENTICATION           */}
          {/* ==================================================== */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {/* Full Name Field (Sign Up Only) */}
              {emailMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative flex items-center">
                    <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Smt. Radhika Sharma"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email Address Field */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password Field (Sign In & Sign Up) */}
              {emailMode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Password *
                    </label>
                    {emailMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmailMode('forgot');
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={emailMode === 'signup' ? 'Create a secure password (min. 6 characters)' : 'Enter your account password'}
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
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
              )}

              {/* Confirm Password Field (Sign Up Only) */}
              {emailMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Terms and Conditions Checkbox (Sign Up Only) */}
              {emailMode === 'signup' && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#802336] focus:ring-[#802336] border-gray-300"
                  />
                  <span className="text-[11px] text-gray-600 leading-tight">
                    I agree to the VIDHYAA Jewellery Studio Terms of Service and Privacy Policy.
                  </span>
                </label>
              )}

              {/* Submit Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#3B1E22] hover:bg-[#802336] disabled:bg-gray-400 text-[#FAF7F2] py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {emailMode === 'signin' && 'Signing In...'}
                      {emailMode === 'signup' && 'Creating Account...'}
                      {emailMode === 'forgot' && 'Sending Reset Link...'}
                    </span>
                  </>
                ) : (
                  <>
                    {emailMode === 'signin' && (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                    {emailMode === 'signup' && (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                    {emailMode === 'forgot' && (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Send Password Reset Link</span>
                      </>
                    )}
                  </>
                )}
              </button>

              {/* Forgot Password Mode: Return to Sign In link */}
              {emailMode === 'forgot' && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('signin');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              )}

              {/* Quick Switch to Mobile Number Login */}
              {emailMode !== 'forgot' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('mobile');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer"
                  >
                    📱 Or Login with Mobile Number (Worldwide SMS OTP)
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Social Authentication: 1-Click Google Sign-In */}
          {((authMethod === 'email' && emailMode !== 'forgot') || authMethod === 'mobile') && (
            <div className="pt-2">
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-[#E8DCCF] w-full"></div>
                <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 absolute">
                  Or Continue With
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 border border-[#E8DCCF] hover:border-gray-400 rounded-xl flex items-center justify-center gap-3 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-xs cursor-pointer active:scale-[0.99]"
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
          )}

          {/* Mode Switch Footer Links */}
          {authMethod === 'email' && emailMode !== 'forgot' && (
            <div className="pt-2 text-center text-xs text-gray-500">
              {emailMode === 'signin' ? (
                <p>
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('signup');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[#802336] hover:text-[#3B1E22] font-bold hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('signin');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[#802336] hover:text-[#3B1E22] font-bold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Security & Authenticity Trust Badge */}
          <div className="pt-3 border-t border-[#E8DCCF] flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <Shield className="w-3.5 h-3.5 text-[#0F5B46]" />
            <span>256-Bit SSL Encrypted & Verified Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
};
