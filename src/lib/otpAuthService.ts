import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { saveUserProfile } from './dbService';
import { UserProfile } from '../types';

export interface SendOtpResponse {
  success: boolean;
  message: string;
  maskedNumber: string;
  expiresIn: number;
  provider?: 'firebase' | 'fast2sms' | 'twofactor' | 'twilio' | 'msg91' | 'gateway';
}

export interface VerifyOtpResponse {
  success: boolean;
  verified: boolean;
  mobile: string;
  user?: User;
}

// In-memory reference for active Firebase Phone Auth confirmation session
let activeConfirmationResult: ConfirmationResult | null = null;
let activeRecaptchaVerifier: RecaptchaVerifier | null = null;
let activeSessionMobile = '';

export function clearOtpSession(): void {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {}
    activeRecaptchaVerifier = null;
  }
  activeConfirmationResult = null;
  activeSessionMobile = '';
}

/**
 * Initialize or retrieve invisible reCAPTCHA verifier for Firebase Phone Authentication
 */
export async function getRecaptchaVerifier(containerId = 'firebase-recaptcha-container'): Promise<RecaptchaVerifier> {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {}
    activeRecaptchaVerifier = null;
  }

  // Ensure DOM container exists in DOM tree
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    document.body.appendChild(el);
  }

  el.innerHTML = '';
  // Must NOT be display: none for Google reCAPTCHA iframe execution
  el.style.display = 'block';
  el.style.position = 'fixed';
  el.style.bottom = '10px';
  el.style.right = '10px';
  el.style.zIndex = '99999';
  el.style.pointerEvents = 'auto';

  try {
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('[reCAPTCHA Diagnostic] Invisible verification check passed.');
      },
      'expired-callback': () => {
        console.warn('[reCAPTCHA Diagnostic] Verification token expired, resetting verifier.');
        try {
          verifier.clear();
        } catch {}
        activeRecaptchaVerifier = null;
      }
    });

    await verifier.render();
    activeRecaptchaVerifier = verifier;
    return verifier;
  } catch (recaptchaErr: any) {
    console.warn('[reCAPTCHA Diagnostic]', {
      errorCode: recaptchaErr?.code || 'CAPTCHA_INIT_ERROR',
      message: recaptchaErr?.message || 'reCAPTCHA initialization failed'
    });
    throw new Error(`reCAPTCHA check unavailable: ${recaptchaErr?.message || 'Please refresh'}`);
  }
}

/**
 * Send 6-digit OTP to Indian mobile number via Real SMS.
 * 1st: Attempts Firebase Phone Auth (Google Telecom SMS) if enabled.
 * 2nd: Seamlessly routes to configured Indian SMS Gateway (Fast2SMS / 2Factor / Twilio / MSG91).
 */
export async function sendMobileOtp(mobile: string): Promise<SendOtpResponse> {
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
  }

  const formattedIndianNumber = `+91${cleanMobile}`;
  const maskedNumber = `+91 ${cleanMobile.slice(0, 2)}•••••${cleanMobile.slice(7)}`;

  // 1. Attempt Firebase Phone Authentication first (signInWithPhoneNumber)
  let firebaseErrorCode = '';
  let firebaseErrorMessage = '';

  try {
    const verifier = await getRecaptchaVerifier();
    const confirmation = await signInWithPhoneNumber(auth, formattedIndianNumber, verifier);
    activeConfirmationResult = confirmation;
    activeSessionMobile = cleanMobile;

    // Safe diagnostic logging (no phone numbers, no OTPs, no secrets)
    console.log('[Auth Diagnostic]', {
      provider: 'firebase_phone',
      status: 'SMS_DISPATCHED_TO_CARRIER'
    });

    return {
      success: true,
      message: `SMS OTP dispatched via Google telecom network to ${maskedNumber}`,
      maskedNumber,
      expiresIn: 300,
      provider: 'firebase'
    };
  } catch (firebaseErr: any) {
    firebaseErrorCode = firebaseErr?.code || 'auth/unknown';
    firebaseErrorMessage = firebaseErr?.message || 'Firebase phone authentication failed.';

    // Safe diagnostic logging for the real Firebase provider error code and message
    console.warn('[Auth Diagnostic]', {
      provider: 'firebase_phone',
      errorCode: firebaseErrorCode,
      errorMessage: firebaseErrorMessage
    });

    // Reset verifier
    if (activeRecaptchaVerifier) {
      try { activeRecaptchaVerifier.clear(); } catch {}
      activeRecaptchaVerifier = null;
    }
  }

  // 2. Dispatch via Indian SMS Gateway (/api/auth/send-otp)
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: cleanMobile }),
    });

    const data = await res.json().catch(() => ({}));

    // Safe diagnostic logging of gateway response
    console.warn('[Auth Diagnostic]', {
      provider: data.provider || 'none',
      httpStatus: res.status,
      errorCode: data.errorCode || (res.ok ? 'SUCCESS' : 'GATEWAY_ERROR')
    });

    if (!res.ok || !data.success) {
      // Build a clear, non-misleading error message explaining why no SMS was received
      let userFacingError = data.error || 'Failed to dispatch SMS to your phone.';
      if (firebaseErrorCode === 'auth/operation-not-allowed' && (!data.provider || data.provider === 'none')) {
        userFacingError = 'SMS delivery unavailable: Phone Authentication is disabled in Firebase Console (OPERATION_NOT_ALLOWED), and no Indian SMS gateway (Fast2SMS/2Factor) is configured in Admin Settings.';
      } else if (firebaseErrorCode === 'auth/unauthorized-domain' && (!data.provider || data.provider === 'none')) {
        userFacingError = 'SMS delivery unavailable: Current deployment domain is not in Firebase Authorized Domains, and no Indian SMS gateway is configured in Admin Settings.';
      }
      throw new Error(userFacingError);
    }

    activeConfirmationResult = null;
    activeSessionMobile = cleanMobile;

    return {
      success: true,
      message: data.message || `SMS OTP dispatched via telecom network to ${maskedNumber}`,
      maskedNumber,
      expiresIn: data.expiresIn || 300,
      provider: data.provider || 'gateway'
    };
  } catch (gatewayErr: any) {
    throw new Error(gatewayErr?.message || 'Failed to send OTP via SMS. Please check your network and mobile number.');
  }
}

/**
 * Verify 6-digit OTP received on user's phone
 */
export async function verifyMobileOtp(mobile: string, otp: string): Promise<VerifyOtpResponse> {
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
  const cleanOtp = otp.trim();

  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    throw new Error('Please enter all 6 digits of the verification code received on your mobile.');
  }

  // Case A: Verified via Firebase Phone Auth confirmation session
  if (activeConfirmationResult && activeSessionMobile === cleanMobile) {
    try {
      const credential = await activeConfirmationResult.confirm(cleanOtp);
      const user = credential.user;
      await syncMobileUserProfile(user, cleanMobile);
      clearOtpSession();
      console.log('[Auth Diagnostic]', { provider: 'firebase_phone', status: 'VERIFICATION_SUCCESS' });
      return {
        success: true,
        verified: true,
        mobile: cleanMobile,
        user
      };
    } catch (err: any) {
      const code = err?.code || '';
      console.warn('[Auth Diagnostic]', { provider: 'firebase_phone', errorCode: code, errorMessage: err?.message });
      if (code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please check the 6-digit OTP received on your phone and try again.');
      }
      if (code === 'auth/code-expired') {
        throw new Error('The OTP code has expired. Please click Resend OTP to receive a fresh code.');
      }
      throw new Error(err.message || 'OTP verification failed. Please try again.');
    }
  }

  // Case B: Verified via SMS Gateway endpoint
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: cleanMobile, otp: cleanOtp }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    console.warn('[Auth Diagnostic]', { provider: 'sms_gateway', status: 'VERIFICATION_FAILED', errorCode: data.error || 'INVALID_CODE' });
    throw new Error(data.error || 'Verification failed. Please check the OTP and try again.');
  }

  console.log('[Auth Diagnostic]', { provider: 'sms_gateway', status: 'VERIFICATION_SUCCESS' });
  const user = await completeMobileAuth(cleanMobile);
  clearOtpSession();

  return {
    success: true,
    verified: true,
    mobile: cleanMobile,
    user: user || undefined
  };
}

/**
 * Sync or create user profile in Firestore
 */
async function syncMobileUserProfile(user: User, cleanMobile: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      const profile: Partial<UserProfile> = {
        id: user.uid,
        email: user.email || `${cleanMobile}@vidhyaacustomer.in`,
        displayName: user.displayName || `Customer +91${cleanMobile.slice(-4)}`,
        phone: `+91${cleanMobile}`,
        role: 'customer',
        savedAddresses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveUserProfile(user.uid, profile);
    }
  } catch (err) {
    console.warn('[Auth Diagnostic] Profile sync warning:', err);
  }
}

/**
 * Establish authenticated session for customer verified via backend gateway OTP
 */
export async function completeMobileAuth(cleanMobile: string): Promise<User | null> {
  const syntheticEmail = `${cleanMobile}@vidhyaacustomer.in`;
  const syntheticPass = `Vidhyaa#MobileAuth_${cleanMobile}_SecureKey`;

  try {
    const cred = await signInWithEmailAndPassword(auth, syntheticEmail, syntheticPass);
    return cred.user;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, syntheticEmail, syntheticPass);
        await updateProfile(newCred.user, {
          displayName: `Customer +91${cleanMobile.slice(-4)}`
        });
        await syncMobileUserProfile(newCred.user, cleanMobile);
        return newCred.user;
      } catch (createErr) {
        console.warn('[Auth Diagnostic] Account creation fallback warning:', createErr);
        return auth.currentUser;
      }
    }
    return auth.currentUser;
  }
}
