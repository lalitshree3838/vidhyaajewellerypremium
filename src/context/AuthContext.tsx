import React, { createContext, useContext, useEffect, useState } from 'react';
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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginAdminBackend: (
    email: string,
    pass: string,
    totpCode?: string
  ) => Promise<{ success: boolean; requires2FA?: boolean; token?: string; admin?: AdminSessionData; error?: string }>;
  exchangeFirebaseAdminToken: (firebaseUser?: User | null) => Promise<boolean>;
  logoutAdminSession: () => Promise<void>;
  signOut: () => Promise<void>;
  saveAddress: (address: Address) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  updateUserProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'anavneeraj2003@gmail.com';
const ADMIN_SESSION_STORAGE_KEY = 'vidhyaa_admin_token';
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
  const [adminSessionActive, setAdminSessionActive] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || localStorage.getItem(ADMIN_SESSION_STORAGE_KEY));
    } catch {
      return false;
    }
  });
  const [adminUser, setAdminUser] = useState<AdminSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  // Validate existing stored admin session token on mount
  useEffect(() => {
    const verifyStoredAdminSession = async () => {
      const storedToken = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
      if (!storedToken) return;

      try {
        const res = await fetch('/api/admin/verify-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
          },
          body: JSON.stringify({ token: storedToken })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setAdminSessionActive(true);
            setAdminUser({
              email: data.email || ADMIN_EMAIL,
              role: 'admin',
              name: data.name || 'Executive Administrator'
            });
          } else {
            sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
            localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
            setAdminSessionActive(false);
          }
        } else if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          setAdminSessionActive(false);
        }
      } catch {
        // network or offline — preserve stored session until confirmed invalid
      }
    };

    verifyStoredAdminSession();
  }, []);

  const exchangeFirebaseAdminToken = async (firebaseUser?: User | null): Promise<boolean> => {
    const targetUser = firebaseUser || auth.currentUser;
    if (!targetUser || targetUser.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return false;
    }
    try {
      const idToken = await targetUser.getIdToken();
      if (!idToken) return false;
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.token) {
        sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, data.token);
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, data.token);
        setAdminSessionActive(true);
        setAdminUser(data.admin || { email: ADMIN_EMAIL, role: 'admin', name: 'Neeraj Chauhan (Owner)' });
        return true;
      }
    } catch {}
    return false;
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

        if (isOfficialAdmin) {
          const existingToken =
            sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ||
            localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
          if (!existingToken) {
            await exchangeFirebaseAdminToken(currentUser);
          }
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
  ): Promise<{ success: boolean; requires2FA?: boolean; token?: string; admin?: AdminSessionData; error?: string }> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
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

      if (data?.token) {
        sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, data.token);
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, data.token);
        setAdminSessionActive(true);
        setAdminUser(data.admin || { email, role: 'admin', name: 'Executive Administrator' });
        return { success: true, token: data.token, admin: data.admin };
      }

      return { success: false, error: 'Failed to obtain session token.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unable to connect to authentication gateway.' };
    }
  };

  const logoutAdminSession = async () => {
    const storedToken = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (storedToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`,
            'x-admin-token': storedToken
          }
        });
      } catch {}
    }
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    sessionStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_session_token');
    setAdminSessionActive(false);
    setAdminUser(null);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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
