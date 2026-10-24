import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  User
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { CountryCode } from 'libphonenumber-js';
import { auth, db } from './firebase';
import { saveUserProfile } from './dbService';
import { UserProfile } from '../types';
import { validateInternationalPhone, maskPhoneNumber, getCountryByCode } from './countries';

export interface SendOtpResponse {
  success: boolean;
  message: string;
  maskedNumber: string;
  e164: string;
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
let activeSessionPhone = '';

export function clearOtpSession(): void {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {}
    activeRecaptchaVerifier = null;
  }
  activeConfirmationResult = null;
  activeSessionPhone = '';
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
    throw new Error(`reCAPTCHA check unavailable: ${recaptchaErr?.message || 'Please refresh page'}`);
  }
}

/**
 * Send real 6-digit SMS OTP to international or Indian mobile numbers worldwide
 * 1st: Attempts Firebase Phone Authentication (Google Telecom SMS worldwide network)
 * 2nd: Seamlessly routes to server SMS Gateway (Twilio for international, Fast2SMS / 2Factor / MSG91 for India)
 */
export async function sendMobileOtp(
  rawInput: string,
  countryCode: CountryCode = 'IN'
): Promise<SendOtpResponse> {
  const validation = validateInternationalPhone(rawInput, countryCode);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Please enter a valid international mobile phone number.');
  }

  const e164 = validation.e164;
  const maskedNumber = maskPhoneNumber(e164);
  const countryInfo = getCountryByCode(validation.country);

  let firebaseErrorCode = '';
  let firebaseErrorMessage = '';

  // 1. Primary Route: Firebase Phone Authentication (signInWithPhoneNumber)
  try {
    const verifier = await getRecaptchaVerifier();
    const confirmation = await signInWithPhoneNumber(auth, e164, verifier);
    activeConfirmationResult = confirmation;
    activeSessionPhone = e164;

    console.log('[Auth Diagnostic]', {
      provider: 'firebase_phone',
      status: 'SMS_DISPATCHED_TO_CARRIER',
      destinationCountry: countryInfo.name
    });

    return {
      success: true,
      message: `SMS verification code dispatched via Google telecom network to ${maskedNumber}`,
      maskedNumber,
      e164,
      expiresIn: 300,
      provider: 'firebase'
    };
  } catch (firebaseErr: any) {
    firebaseErrorCode = firebaseErr?.code || 'auth/unknown';
    firebaseErrorMessage = firebaseErr?.message || 'Firebase phone authentication failed.';

    console.warn('[Auth Diagnostic]', {
      provider: 'firebase_phone',
      errorCode: firebaseErrorCode,
      errorMessage: firebaseErrorMessage
    });

    if (activeRecaptchaVerifier) {
      try { activeRecaptchaVerifier.clear(); } catch {}
      activeRecaptchaVerifier = null;
    }
  }

  // 2. Secondary Fallback Route: Server SMS Gateway (/api/auth/send-otp)
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: e164, mobile: e164 }),
    });

    const data = await res.json().catch(() => ({}));

    console.warn('[Auth Diagnostic]', {
      provider: data.provider || 'none',
      httpStatus: res.status,
      errorCode: data.errorCode || (res.ok ? 'SUCCESS' : 'GATEWAY_ERROR')
    });

    if (!res.ok || !data.success) {
      let userFacingError = data.error || 'Failed to dispatch SMS to your phone.';

      if (firebaseErrorCode === 'auth/operation-not-allowed') {
        userFacingError = `SMS delivery to ${countryInfo.name} unavailable: Phone Authentication is disabled in Firebase Console (OPERATION_NOT_ALLOWED). Please enable Phone Provider in Firebase Console > Authentication > Sign-in method.`;
      } else if (firebaseErrorCode === 'auth/unauthorized-domain') {
        userFacingError = `SMS delivery unavailable: Current domain is not in Firebase Authorized Domains. Add this domain to Firebase Console > Authentication > Settings > Authorized Domains.`;
      } else if (firebaseErrorCode === 'auth/quota-exceeded') {
        userFacingError = 'Daily SMS verification quota exceeded for this project. Please retry later or contact support.';
      } else if (firebaseErrorCode === 'auth/invalid-phone-number') {
        userFacingError = `Carrier rejected phone format for ${countryInfo.name} (${e164}). Please verify your number.`;
      } else if (firebaseErrorCode === 'auth/billing-not-enabled') {
        userFacingError = 'International SMS delivery requires Firebase Blaze pay-as-you-go billing plan for telecom carrier routes outside test quotas.';
      }
      throw new Error(userFacingError);
    }

    activeConfirmationResult = null;
    activeSessionPhone = e164;

    return {
      success: true,
      message: data.message || `SMS OTP dispatched via telecom network to ${maskedNumber}`,
      maskedNumber,
      e164,
      expiresIn: data.expiresIn || 300,
      provider: data.provider || 'gateway'
    };
  } catch (gatewayErr: any) {
    throw new Error(gatewayErr?.message || 'Failed to send OTP via SMS. Please check your international phone number and network.');
  }
}

/**
 * Verify 6-digit OTP code received on customer's mobile phone
 */
export async function verifyMobileOtp(
  rawInput: string,
  otp: string,
  countryCode: CountryCode = 'IN'
): Promise<VerifyOtpResponse> {
  const validation = validateInternationalPhone(rawInput, countryCode);
  const e164 = validation.isValid ? validation.e164 : rawInput.trim();
  const cleanOtp = otp.trim();

  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    throw new Error('Please enter all 6 digits of the verification code received on your mobile.');
  }

  // Case A: Verified via Firebase Phone Auth confirmation session
  if (activeConfirmationResult && activeSessionPhone === e164) {
    try {
      const credential = await activeConfirmationResult.confirm(cleanOtp);
      const user = credential.user;
      await syncMobileUserProfile(user, e164);
      clearOtpSession();
      console.log('[Auth Diagnostic]', { provider: 'firebase_phone', status: 'VERIFICATION_SUCCESS' });
      return {
        success: true,
        verified: true,
        mobile: e164,
        user
      };
    } catch (err: any) {
      const code = err?.code || '';
      console.warn('[Auth Diagnostic]', { provider: 'firebase_phone', errorCode: code, errorMessage: err?.message });
      if (code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please check the 6-digit OTP received on your phone and try again.');
      }
      if (code === 'auth/code-expired') {
        throw new Error('The OTP code has expired. Please click Resend OTP to receive a fresh verification code.');
      }
      throw new Error(err.message || 'OTP verification failed. Please try again.');
    }
  }

  // Case B: Verified via SMS Gateway backend endpoint
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: e164, mobile: e164, otp: cleanOtp }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    console.warn('[Auth Diagnostic]', { provider: 'sms_gateway', status: 'VERIFICATION_FAILED', errorCode: data.error || 'INVALID_CODE' });
    throw new Error(data.error || 'Verification failed. Please check the OTP and try again.');
  }

  console.log('[Auth Diagnostic]', { provider: 'sms_gateway', status: 'VERIFICATION_SUCCESS' });
  const user = await completeMobileAuth(e164);
  clearOtpSession();

  return {
    success: true,
    verified: true,
    mobile: e164,
    user: user || undefined
  };
}

/**
 * Sync or create customer profile in Firestore with verified phone number
 * Preserves existing accounts and never merges solely on unverified data
 */
async function syncMobileUserProfile(user: User, e164Phone: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      // Check if another customer profile already had this verified phone number
      let existingProfile: Partial<UserProfile> | null = null;
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phone', '==', e164Phone));
        const matchingDocs = await getDocs(q);
        if (!matchingDocs.empty) {
          const docData = matchingDocs.docs[0].data() as UserProfile;
          existingProfile = docData;
        }
      } catch {}

      const cleanDigits = e164Phone.replace(/\D/g, '');
      const profile: Partial<UserProfile> = {
        id: user.uid,
        email: user.email || existingProfile?.email || '',
        displayName: user.displayName || existingProfile?.displayName || `Patron (${maskPhoneNumber(e164Phone)})`,
        phone: e164Phone,
        role: existingProfile?.role || 'customer',
        savedAddresses: existingProfile?.savedAddresses || [],
        createdAt: existingProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveUserProfile(user.uid, profile);
    } else {
      // Profile exists, ensure verified phone is recorded
      const currentData = snap.data();
      if (!currentData?.phone || currentData.phone !== e164Phone) {
        await saveUserProfile(user.uid, {
          phone: e164Phone,
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn('[Auth Diagnostic] Profile sync warning:', err);
  }
}

/**
 * Establish authenticated session for customer verified via backend gateway OTP
 */
export async function completeMobileAuth(e164Phone: string): Promise<User | null> {
  const cleanDigits = e164Phone.replace(/\D/g, '');
  const syntheticEmail = `${cleanDigits}@phone.vidhyaajewellery.com`;
  const syntheticPass = `Vidhyaa#MobileAuth_${cleanDigits}_SecureKey99!`;

  try {
    const cred = await signInWithEmailAndPassword(auth, syntheticEmail, syntheticPass);
    await syncMobileUserProfile(cred.user, e164Phone);
    return cred.user;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, syntheticEmail, syntheticPass);
        await updateProfile(newCred.user, {
          displayName: `Patron (${maskPhoneNumber(e164Phone)})`
        });
        await syncMobileUserProfile(newCred.user, e164Phone);
        return newCred.user;
      } catch (createErr) {
        console.warn('[Auth Diagnostic] Account creation fallback warning:', createErr);
        return auth.currentUser;
      }
    }
    return auth.currentUser;
  }
}
