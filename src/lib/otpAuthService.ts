import {
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
  provider: 'firebase';
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

/**
 * Reset and clear active Firebase Phone Auth sessions and reCAPTCHA verifiers
 */
export function clearOtpSession(): void {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch (e) {
      console.warn('[reCAPTCHA Diagnostic] Clear warning:', e);
    }
    activeRecaptchaVerifier = null;
  }
  activeConfirmationResult = null;
  activeSessionPhone = '';
}

/**
 * Initialize functional reCAPTCHA verifier for Firebase Phone Authentication directly in browser
 * @param containerId DOM element ID where reCAPTCHA will be rendered
 * @param isVisible whether to render visible checkbox ('normal') or 'invisible'
 */
export async function getRecaptchaVerifier(
  containerId = 'firebase-recaptcha-container',
  isVisible = true
): Promise<RecaptchaVerifier> {
  // Clear previous verifier to prevent duplicate widget ID collision
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {}
    activeRecaptchaVerifier = null;
  }

  // Ensure DOM container exists
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    document.body.appendChild(el);
  }

  // Clear previous widget DOM nodes
  el.innerHTML = '';
  el.style.display = 'block';

  try {
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: isVisible ? 'normal' : 'invisible',
      callback: () => {
        console.log('[reCAPTCHA Diagnostic] Verification challenge completed.');
      },
      'expired-callback': () => {
        console.warn('[reCAPTCHA Diagnostic] reCAPTCHA token expired. Please re-verify.');
      }
    });

    await verifier.render();
    activeRecaptchaVerifier = verifier;
    return verifier;
  } catch (err: any) {
    console.warn('[reCAPTCHA Diagnostic] Normal render warning, trying fallback:', err);
    // Fallback to invisible verifier if normal rendering has container constraints
    try {
      const fallback = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible'
      });
      await fallback.render();
      activeRecaptchaVerifier = fallback;
      return fallback;
    } catch (fallbackErr: any) {
      throw new Error(`reCAPTCHA initialization failed: ${fallbackErr?.message || err?.message || 'Please refresh page'}`);
    }
  }
}

/**
 * Send real SMS verification code directly from the browser using Firebase Web SDK
 * Works 100% on static hosting (e.g. Hostinger) without any backend server dependency
 */
export async function sendMobileOtp(
  rawInput: string,
  countryCode: CountryCode = 'IN',
  containerId = 'firebase-recaptcha-container'
): Promise<SendOtpResponse> {
  const validation = validateInternationalPhone(rawInput, countryCode);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Please enter a valid international mobile phone number.');
  }

  const e164 = validation.e164;
  const maskedNumber = maskPhoneNumber(e164);
  const countryInfo = getCountryByCode(validation.country);

  try {
    // Initialize visible reCAPTCHA verifier for reliable execution on all browsers & mobile devices
    const verifier = await getRecaptchaVerifier(containerId, true);

    // Call Firebase Auth signInWithPhoneNumber directly from the browser
    const confirmation = await signInWithPhoneNumber(auth, e164, verifier);
    activeConfirmationResult = confirmation;
    activeSessionPhone = e164;

    console.log('[Firebase Phone Auth] Real SMS OTP dispatched directly via Firebase to:', maskedNumber);

    return {
      success: true,
      message: `Verification code sent via SMS to ${maskedNumber}`,
      maskedNumber,
      e164,
      expiresIn: 300,
      provider: 'firebase'
    };
  } catch (firebaseErr: any) {
    console.error('[Firebase Phone Auth Error]', firebaseErr);

    // Clean up active verifier so customer can retry
    if (activeRecaptchaVerifier) {
      try { activeRecaptchaVerifier.clear(); } catch {}
      activeRecaptchaVerifier = null;
    }

    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
    const code = firebaseErr?.code || 'auth/unknown';
    const rawMsg = firebaseErr?.message || '';

    switch (code) {
      case 'auth/operation-not-allowed':
        throw new Error(
          `Firebase SMS Region Policy Restriction (OPERATION_NOT_ALLOWED): While Phone sign-in is enabled, SMS delivery to ${countryInfo.name} (${countryInfo.dialCode}) is restricted by your project's SMS Region Policy. In Firebase Console (project: gen-lang-client-0706507905), go to Authentication > Settings (tab at top) > SMS region policy, select 'Allow specific regions', and add ${countryInfo.name} (${countryInfo.dialCode}) to the allowlist.`
        );

      case 'auth/unauthorized-domain':
        throw new Error(
          `Domain authorization error: '${currentHost}' is not in Firebase Authorized Domains. In Firebase Console (project: gen-lang-client-0706507905), go to Authentication > Settings > Authorized domains and add '${currentHost}'.`
        );

      case 'auth/internal-error':
        throw new Error(
          `reCAPTCHA validation failed or domain '${currentHost}' is not authorized. In Firebase Console, confirm '${currentHost}' is listed under Authentication > Settings > Authorized domains.`
        );

      case 'auth/captcha-check-failed':
        throw new Error('reCAPTCHA verification failed or timed out. Please check the "I\'m not a robot" box and try again.');

      case 'auth/quota-exceeded':
        throw new Error('Daily SMS verification quota reached for this Firebase project. The free Spark tier includes 10 SMS/day. Please upgrade to the Blaze plan or add phone numbers for testing in Firebase Console.');

      case 'auth/too-many-requests':
        throw new Error('Too many SMS requests for this phone number. For your security, requests are temporarily throttled. Please wait a few moments.');

      case 'auth/invalid-phone-number':
        throw new Error(`Carrier rejected '${e164}'. Please check the national phone format for ${countryInfo.name}.`);

      case 'auth/billing-not-enabled':
        throw new Error(`International SMS delivery to ${countryInfo.name} requires the Firebase Blaze pay-as-you-go billing plan for global telecom carrier delivery.`);

      case 'auth/network-request-failed':
        throw new Error('Network connection error communicating with Firebase. Please check your internet connection.');

      default:
        throw new Error(rawMsg || `Failed to dispatch SMS to ${e164}. (${code})`);
    }
  }
}

/**
 * Verify 6-digit OTP code directly using Firebase ConfirmationResult
 * Authenticates the user in Firebase Auth and updates Firestore user profile in browser
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

  if (!activeConfirmationResult || activeSessionPhone !== e164) {
    throw new Error('No active OTP verification session found. Please request a new verification code.');
  }

  try {
    // Verify OTP directly against Firebase Auth
    const credential = await activeConfirmationResult.confirm(cleanOtp);
    const user = credential.user;

    // Sync verified phone number into Firestore user profile directly from browser
    await syncMobileUserProfile(user, e164);
    clearOtpSession();

    console.log('[Firebase Phone Auth] Mobile verification success:', e164, 'UID:', user.uid);

    return {
      success: true,
      verified: true,
      mobile: e164,
      user
    };
  } catch (err: any) {
    const code = err?.code || '';
    console.warn('[Firebase Phone Auth] Verification error:', code, err?.message);

    if (code === 'auth/invalid-verification-code') {
      throw new Error('Invalid verification code. Please check the 6-digit OTP received via SMS and try again.');
    }
    if (code === 'auth/code-expired') {
      throw new Error('This verification code has expired. Please click Resend OTP to receive a new code.');
    }
    throw new Error(err?.message || 'OTP verification failed. Please try again.');
  }
}

/**
 * Sync or create customer profile in Firestore with verified phone number
 * Runs directly from browser using client-side Firestore SDK
 */
async function syncMobileUserProfile(user: User, e164Phone: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
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
      const currentData = snap.data();
      if (!currentData?.phone || currentData.phone !== e164Phone) {
        await saveUserProfile(user.uid, {
          phone: e164Phone,
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn('[Firebase Phone Auth] Profile sync notice:', err);
  }
}
