'use client';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirebaseClientAuth } from '@/lib/firebase-client-auth';
const AuthContext = createContext(undefined);
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }) {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetchProfile = () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        setLoading(true);
        try {
            const res = yield fetch('/api/auth/profile');
            if (!res.ok) {
                setUserProfile(null);
                return;
            }
            const data = yield res.json();
            if (data === null || data === void 0 ? void 0 : data.user) {
                setUserProfile({
                    uid: (_a = data.user.uid) !== null && _a !== void 0 ? _a : '',
                    email: (_b = data.user.email) !== null && _b !== void 0 ? _b : '',
                    displayName: (_c = data.user.displayName) !== null && _c !== void 0 ? _c : '',
                    role: ((_d = data.user.role) !== null && _d !== void 0 ? _d : 'viewer'),
                    createdAt: data.user.createdAt ? new Date(data.user.createdAt) : new Date(),
                    lastLoginAt: data.user.lastLoginAt ? new Date(data.user.lastLoginAt) : undefined,
                });
            }
            else {
                setUserProfile(null);
            }
        }
        catch (_e) {
            setUserProfile(null);
        }
        finally {
            setLoading(false);
        }
    });
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
    const logout = () => __awaiter(this, void 0, void 0, function* () {
        try {
            yield fetch('/api/auth/logout', { method: 'POST' });
            const auth = getFirebaseClientAuth();
            yield firebaseSignOut(auth).catch(() => { });
        }
        finally {
            setUserProfile(null);
        }
    });
    return (<AuthContext.Provider value={{ userProfile, loading, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>);
}
// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context)
        throw new Error('useAuth must be used within AuthProvider');
    return context;
}
