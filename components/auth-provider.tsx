'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User as AppUser, UserRole } from '@/lib/types';

type SignUpPayload = {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
};

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  userProfile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeProfile(uid: string, email: string | null, data: Record<string, any>): AppUser {
  return {
    uid,
    email: email ?? data.email ?? '',
    displayName: data.displayName ?? '',
    role: (data.role ?? 'viewer') as UserRole,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    lastLoginAt: data.lastLoginAt?.toDate?.(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const fallbackProfile = {
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
          role: 'viewer' as UserRole,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };

        await setDoc(userRef, fallbackProfile, { merge: true });
        setUserProfile(
          normalizeProfile(user.uid, user.email, {
            ...fallbackProfile,
            createdAt: new Date(),
            lastLoginAt: new Date(),
          })
        );
        setLoading(false);
        return;
      }

      await updateDoc(userRef, { lastLoginAt: serverTimestamp() });
      setUserProfile(
        normalizeProfile(user.uid, user.email, {
          ...userSnap.data(),
          lastLoginAt: new Date(),
        })
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async ({ displayName, email, password, role }: SignUpPayload) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(credential.user, { displayName });
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      email,
      displayName,
      role,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, userProfile, loading, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
