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

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  adminSessionActive: boolean;
  adminUser: AdminSessionData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginAdminBackend: (email: string, pass: string) => Promise<{ success: boolean; token?: string; admin?: AdminSessionData; error?: string }>;
  logoutAdminSession: () => Promise<void>;
  signOut: () => Promise<void>;
  saveAddress: (address: Address) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'anavneeraj2003@gmail.com';
const ADMIN_SESSION_STORAGE_KEY = 'vidhyaa_admin_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdminState, setIsAdminState] = useState<boolean>(false);
  const [adminSessionActive, setAdminSessionActive] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<AdminSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
              name: 'Executive Administrator'
            });
          } else {
            sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
            localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          }
        } else {
          sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        }
      } catch {
        // network or offline
      }
    };

    verifyStoredAdminSession();
  }, []);

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

        setIsAdminState(isOfficialAdmin || hasAdminDoc || profile.role === 'admin');
        setUserProfile(profile);
      } else {
        setUserProfile(null);
        setIsAdminState(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginAdminBackend = async (email: string, pass: string): Promise<{ success: boolean; token?: string; admin?: AdminSessionData; error?: string }> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pass })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication failed. Please verify credentials.' };
      }

      if (data.token) {
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
            'Authorization': `Bearer ${storedToken}`
          }
        });
      } catch {}
    }
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
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
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const saveAddress = async (address: Address) => {
    if (!user || !userProfile) return;
    const existing = userProfile.savedAddresses || [];
    const index = existing.findIndex((a) => a.id === address.id);
    let updated: Address[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = address;
    } else {
      updated = [...existing, address];
    }
    const updatedProfile = { ...userProfile, savedAddresses: updated };
    setUserProfile(updatedProfile);
    await saveUserProfile(user.uid, { savedAddresses: updated });
  };

  const deleteAddress = async (addressId: string) => {
    if (!user || !userProfile) return;
    const updated = (userProfile.savedAddresses || []).filter((a) => a.id !== addressId);
    const updatedProfile = { ...userProfile, savedAddresses: updated };
    setUserProfile(updatedProfile);
    await saveUserProfile(user.uid, { savedAddresses: updated });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin: isAdminState || adminSessionActive,
        adminSessionActive,
        adminUser,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        loginAdminBackend,
        logoutAdminSession,
        signOut,
        saveAddress,
        deleteAddress
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
