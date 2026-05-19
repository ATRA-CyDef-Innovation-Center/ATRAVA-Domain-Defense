'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirebaseClientAuth } from '@/lib/firebase-client-auth';
import type { User as AppUser, UserRole } from '@/lib/types';
import { SESSION_COOKIE_NAME } from '@/lib/auth-session';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type AuthContextValue = {
  userProfile: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/profile');
      if (!res.ok) {
        setUserProfile(null);
        return;
      }
      const data = await res.json();
      if (data?.user) {
        setUserProfile({
          uid: data.user.uid ?? '',
          email: data.user.email ?? '',
          displayName: data.user.displayName ?? '',
          role: (data.user.role ?? 'viewer') as UserRole,
          createdAt: data.user.createdAt ? new Date(data.user.createdAt) : new Date(),
          lastLoginAt: data.user.lastLoginAt ? new Date(data.user.lastLoginAt) : undefined,
        });
      } else {
        setUserProfile(null);
      }
    } catch {
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Hydrate user profile from the session cookie via a lightweight API call.
    fetchProfile();

    // Also watch Firebase auth state: if the Firebase session ends unexpectedly,
    // clear the local profile so the guard redirects to sign-in.
    const auth = getFirebaseClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser && userProfile) {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      const auth = getFirebaseClientAuth();
      await firebaseSignOut(auth).catch(() => {});
    } finally {
      setUserProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ userProfile, loading, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
