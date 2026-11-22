import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Address, UserProfile } from '../types';
import { fetchUserProfile, saveUserProfile } from '../lib/dbService';

interface AdminSessionData {
  email: string;
  role: string;
  name: string;
}

export interface PatronSessionUser {
  uid: string;
  displayName: string;
  phone?: string;
  mobile?: string;
  email?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  patronSession: PatronSessionUser | null;
  isAdmin: boolean;
  adminSessionActive: boolean;
  adminUser: AdminSessionData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginAdminBackend: (
    email: string,
    pass: string,
    totpCode?: string
  ) => Promise<{ success: boolean; requires2FA?: boolean; token?: string; admin?: AdminSessionData; error?: string }>;
  setupAdminPassword: (
    email: string,
    pass: string,
    confirmPass: string
  ) => Promise<{ success: boolean; token?: string; admin?: AdminSessionData; error?: string }>;
  lastAdminAuthError: string | null;
  getLastAdminAuthError: () => string | null;
  exchangeFirebaseAdminToken: (firebaseUser?: User | null) => Promise<boolean>;
  logoutAdminSession: () => Promise<void>;
  signOut: () => Promise<void>;
  saveAddress: (address: Address) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  updateUserProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'anavneeraj2003@gmail.com';
const PATRON_PROFILE_PREFIX = 'vidhyaa_patron_profile_';

const loadPatronProfileFromStorage = (patron: PatronSessionUser): UserProfile => {
  const now = new Date().toISOString();
  const basePhone = patron.phone || patron.mobile || '';
  try {
    const raw = localStorage.getItem(`${PATRON_PROFILE_PREFIX}${patron.uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as UserProfile;
      return {
        ...parsed,
        id: parsed.id || patron.uid,
        displayName: parsed.displayName || patron.displayName || 'VIDHYAA Patron',
        phone: parsed.phone || basePhone,
        phoneCountryCode: parsed.phoneCountryCode || '+91',
        role: 'customer',
        savedAddresses: Array.isArray(parsed.savedAddresses) ? parsed.savedAddresses : []
      };
    }
  } catch {}
  return {
    id: patron.uid,
    email: patron.email || '',
    displayName: patron.displayName || 'VIDHYAA Patron',
    phone: basePhone,
    phoneCountryCode: '+91',
    phone_verified: Boolean(basePhone),
    role: 'customer',
    savedAddresses: [],
    createdAt: now,
    updatedAt: now
  };
};

const savePatronProfileToStorage = (uid: string, profile: UserProfile) => {
  try {
    localStorage.setItem(`${PATRON_PROFILE_PREFIX}${uid}`, JSON.stringify(profile));
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [patronSession, setPatronSession] = useState<PatronSessionUser | null>(() => {
    try {
      const raw = localStorage.getItem('vidhyaa_patron_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAdminState, setIsAdminState] = useState<boolean>(false);
  const [adminSessionActive, setAdminSessionActive] = useState<boolean>(false);
  const adminSessionActiveRef = useRef<boolean>(false);
  const adminStatusCheckedRef = useRef<boolean>(false);
  const [adminUser, setAdminUser] = useState<AdminSessionData | null>(null);
  const [lastAdminAuthError, setLastAdminAuthError] = useState<string | null>(null);
  const lastAdminAuthErrorRef = useRef<string | null>(null);
  const setAdminExchangeError = (msg: string | null) => {
    lastAdminAuthErrorRef.current = msg;
    setLastAdminAuthError(msg);
  };
  const [loading, setLoading] = useState<boolean>(true);
  const exchangeInFlightRef = useRef<{ uid: string; promise: Promise<boolean> } | null>(null);

  const updateAdminSessionState = (active: boolean, userData: AdminSessionData | null) => {
    adminSessionActiveRef.current = active;
    setAdminSessionActive(active);
    setAdminUser(userData);
  };

  useEffect(() => {
    const syncPatronSession = () => {
      try {
        const raw = localStorage.getItem('vidhyaa_patron_session');
        setPatronSession(raw ? JSON.parse(raw) : null);
      } catch {
        setPatronSession(null);
      }
    };
    window.addEventListener('vidhyaa_patron_auth_changed', syncPatronSession);
    window.addEventListener('storage', syncPatronSession);
    return () => {
      window.removeEventListener('vidhyaa_patron_auth_changed', syncPatronSession);
      window.removeEventListener('storage', syncPatronSession);
    };
  }, []);

  // Purge any legacy client-stored admin session tokens and verify HttpOnly cookie session on mount
  useEffect(() => {
    try {
      sessionStorage.removeItem('vidhyaa_admin_token');
      localStorage.removeItem('vidhyaa_admin_token');
      sessionStorage.removeItem('admin_session_token');
      localStorage.removeItem('admin_session_token');
    } catch {}

    const verifyStoredAdminSession = async () => {
      try {
        const res = await fetch('/api/admin/auth-status', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.isAuthenticatedAdmin) {
            updateAdminSessionState(
              true,
              data.admin || {
                email: ADMIN_EMAIL,
                role: 'admin',
                name: 'Executive Administrator'
              }
            );
          } else {
            updateAdminSessionState(false, null);
          }
        }
      } catch {
        // Offline / transient network error
      } finally {
        adminStatusCheckedRef.current = true;
      }
    };

    verifyStoredAdminSession();
  }, []);

  const exchangeFirebaseAdminToken = async (firebaseUser?: User | null): Promise<boolean> => {
    const targetUser = firebaseUser || auth.currentUser;
    if (!targetUser) {
      setAdminExchangeError('No signed-in Google account found. Please try again.');
      return false;
    }

    if (exchangeInFlightRef.current && exchangeInFlightRef.current.uid === targetUser.uid) {
      return exchangeInFlightRef.current.promise;
    }

    const run = (async (): Promise<boolean> => {
      try {
        setAdminExchangeError(null);
        const idToken = await targetUser.getIdToken();
        if (!idToken) {
          setAdminExchangeError('Unable to obtain a verified Google ID token.');
          return false;
        }
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          updateAdminSessionState(
            true,
            data.admin || {
              email: targetUser.email || ADMIN_EMAIL,
              role: 'admin',
              name: targetUser.displayName || 'Neeraj Chauhan (Owner)'
            }
          );
          return true;
        }
        setAdminExchangeError(
          data?.error ||
            `Backend admin authorization failed (HTTP ${res.status}).`
        );
      } catch (err: any) {
        setAdminExchangeError(
          err?.message || 'Unable to reach authentication server.'
        );
      } finally {
        exchangeInFlightRef.current = null;
      }
      return false;
    })();

    exchangeInFlightRef.current = { uid: targetUser.uid, promise: run };
    return run;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user profile
        let profile = await fetchUserProfile(currentUser.uid);
        const isOfficialAdmin = (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

        if (!profile) {
          profile = {
            id: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Valued Patron',
            role: isOfficialAdmin ? 'admin' : 'customer',
            savedAddresses: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await saveUserProfile(currentUser.uid, profile);
        }

        // Verify admin role in firestore
        let hasAdminDoc = false;
        try {
          const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
          hasAdminDoc = adminDoc.exists();
        } catch {
          // rule check
        }

        const adminEligible = isOfficialAdmin || hasAdminDoc || profile.role === 'admin';
        setIsAdminState(adminEligible);
        setUserProfile(profile);

        if (isOfficialAdmin && !adminSessionActiveRef.current) {
          await exchangeFirebaseAdminToken(currentUser);
        }
      } else {
        setIsAdminState(false);
        if (!patronSession) {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) return;
    if (patronSession) {
      const loaded = loadPatronProfileFromStorage(patronSession);
      savePatronProfileToStorage(patronSession.uid, loaded);
      setUserProfile(loaded);
    } else {
      setUserProfile(null);
    }
  }, [patronSession, user]);

  const loginAdminBackend = async (
    email: string,
    pass: string,
    totpCode?: string
  ): Promise<{ success: boolean; requires2FA?: boolean; admin?: AdminSessionData; error?: string }> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pass,
          ...(totpCode ? { totpCode } : {})
        })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        return { success: false, error: 'Authentication server returned a non-JSON response.' };
      }

      if (data?.requires2FA) {
        return {
          success: false,
          requires2FA: true,
          error: data.error || data.message
        };
      }

      if (!res.ok) {
        return { success: false, error: data?.error || 'Authentication failed. Please verify credentials.' };
      }

      if (data?.success) {
        const nextAdmin = data.admin || { email, role: 'admin', name: 'Executive Administrator' };
        updateAdminSessionState(true, nextAdmin);
        return { success: true, admin: nextAdmin };
      }

      return { success: false, error: 'Failed to establish authenticated session.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unable to connect to authentication gateway.' };
    }
  };

  const setupAdminPassword = async (
    email: string,
    pass: string,
    confirmPass: string
  ): Promise<{ success: boolean; admin?: AdminSessionData; error?: string }> => {
    try {
      const res = await fetch('/api/admin/setup-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pass,
          confirmPassword: confirmPass
        })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        return { success: false, error: 'Setup server returned a non-JSON response.' };
      }

      if (!res.ok) {
        return { success: false, error: data?.error || 'Failed to configure administrator password.' };
      }

      if (data?.success) {
        const nextAdmin = data.admin || { email, role: 'admin', name: 'Neeraj Chauhan (Owner)' };
        updateAdminSessionState(true, nextAdmin);
        return { success: true, admin: nextAdmin };
      }

      return { success: false, error: 'Failed to establish administrator session after password setup.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unable to connect to setup endpoint.' };
    }
  };

  const logoutAdminSession = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {}
    try {
      sessionStorage.removeItem('vidhyaa_admin_token');
      localStorage.removeItem('vidhyaa_admin_token');
      sessionStorage.removeItem('admin_session_token');
      localStorage.removeItem('admin_session_token');
    } catch {}
    updateAdminSessionState(false, null);
  };

  const signInWithGoogle = async (): Promise<User | null> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return cred?.user || auth.currentUser || null;
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(res.user, { displayName: name });
    const isOfficialAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const profile: UserProfile = {
      id: res.user.uid,
      email: res.user.email || email,
      displayName: name,
      role: isOfficialAdmin ? 'admin' : 'customer',
      savedAddresses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveUserProfile(res.user.uid, profile);
    setUserProfile(profile);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {}
    try {
      localStorage.removeItem('vidhyaa_patron_session');
      localStorage.removeItem('vidhyaa_patron_token');
      window.dispatchEvent(new Event('vidhyaa_patron_auth_changed'));
    } catch {}
    setUser(null);
    setUserProfile(null);
    setPatronSession(null);
  };

  const saveAddress = async (address: Address) => {
    if (user && userProfile) {
      const existing = userProfile.savedAddresses || [];
      const index = existing.findIndex((a) => a.id === address.id);
      let updated: Address[];
      if (index >= 0) {
        updated = [...existing];
        updated[index] = address;
      } else {
        updated = [...existing, address];
      }
      const updatedProfile = { ...userProfile, savedAddresses: updated, updatedAt: new Date().toISOString() };
      setUserProfile(updatedProfile);
      await saveUserProfile(user.uid, { savedAddresses: updated });
      return;
    }

    if (patronSession) {
      const currentProfile = userProfile || loadPatronProfileFromStorage(patronSession);
      const existing = currentProfile.savedAddresses || [];
      const index = existing.findIndex((a) => a.id === address.id);
      const updated = index >= 0
        ? existing.map((a, idx) => (idx === index ? address : a))
        : [...existing, address];
      const updatedProfile: UserProfile = {
        ...currentProfile,
        savedAddresses: updated,
        updatedAt: new Date().toISOString()
      };
      setUserProfile(updatedProfile);
      savePatronProfileToStorage(patronSession.uid, updatedProfile);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (user && userProfile) {
      const updated = (userProfile.savedAddresses || []).filter((a) => a.id !== addressId);
      const updatedProfile = { ...userProfile, savedAddresses: updated, updatedAt: new Date().toISOString() };
      setUserProfile(updatedProfile);
      await saveUserProfile(user.uid, { savedAddresses: updated });
      return;
    }

    if (patronSession) {
      const currentProfile = userProfile || loadPatronProfileFromStorage(patronSession);
      const updated = (currentProfile.savedAddresses || []).filter((a) => a.id !== addressId);
      const updatedProfile: UserProfile = {
        ...currentProfile,
        savedAddresses: updated,
        updatedAt: new Date().toISOString()
      };
      setUserProfile(updatedProfile);
      savePatronProfileToStorage(patronSession.uid, updatedProfile);
    }
  };

  const updateUserProfileData = async (data: Partial<UserProfile>) => {
    if (user) {
      if (userProfile) {
        const updatedProfile = { ...userProfile, ...data, updatedAt: new Date().toISOString() };
        setUserProfile(updatedProfile);
      }
      await saveUserProfile(user.uid, data);
      return;
    }

    if (patronSession) {
      const currentProfile = userProfile || loadPatronProfileFromStorage(patronSession);
      const updatedProfile: UserProfile = {
        ...currentProfile,
        ...data,
        updatedAt: new Date().toISOString()
      };
      setUserProfile(updatedProfile);
      savePatronProfileToStorage(patronSession.uid, updatedProfile);

      if (data.displayName !== undefined || data.phone !== undefined) {
        const updatedSession: PatronSessionUser = {
          ...patronSession,
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.phone !== undefined ? { phone: data.phone, mobile: data.phone } : {})
        };
        setPatronSession(updatedSession);
        try {
          localStorage.setItem('vidhyaa_patron_session', JSON.stringify(updatedSession));
          window.dispatchEvent(new Event('vidhyaa_patron_auth_changed'));
        } catch {}
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        patronSession,
        isAdmin: isAdminState || adminSessionActive,
        adminSessionActive,
        adminUser,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        loginAdminBackend,
        setupAdminPassword,
        lastAdminAuthError,
        getLastAdminAuthError: () => lastAdminAuthErrorRef.current,
        exchangeFirebaseAdminToken,
        logoutAdminSession,
        signOut,
        saveAddress,
        deleteAddress,
        updateUserProfileData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
