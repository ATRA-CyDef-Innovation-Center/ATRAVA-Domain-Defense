var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as firebaseAdmin from 'firebase-admin';
import { config as loadDotenv } from 'dotenv';
const admin = firebaseAdmin.default || firebaseAdmin;
// ---------------------------------------------------------------------------
// Firebase Admin SDK — singleton initializer
// Returns null if credentials are not configured / are placeholders.
// ---------------------------------------------------------------------------
const PLACEHOLDER_MARKERS = [
    'REPLACE_WITH',
    'your-service-account',
    'your_private_key',
    'your-project-id',
    'YOUR_',
    '-----BEGIN RSA', // bare placeholder text (not real key)
];
let loadedFallbackEnv = false;
let adminConfigWarningEmitted = false;
function loadFallbackAdminEnv() {
    if (loadedFallbackEnv)
        return;
    loadedFallbackEnv = true;
    if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL)
        return;
    loadDotenv({ path: `${process.cwd()}/agent/.env.local`, override: false });
}
function isPlaceholder(value) {
    return PLACEHOLDER_MARKERS.some((marker) => value.toUpperCase().includes(marker.toUpperCase()));
}
function stripOuterQuotes(value) {
    const trimmed = String(value !== null && value !== void 0 ? value : '').trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
function normalizePrivateKey(value) {
    return stripOuterQuotes(value).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
}
function hasPrivateKeyShape(privateKey) {
    return privateKey.includes('-----BEGIN PRIVATE KEY-----') &&
        privateKey.includes('-----END PRIVATE KEY-----');
}
function warnAdminConfig(message) {
    if (adminConfigWarningEmitted)
        return;
    adminConfigWarningEmitted = true;
    console.warn(`[firebase-admin] ${message}`);
}
export function tryGetAdminApp() {
    var _a, _b, _c;
    if (admin.apps.length > 0)
        return admin.apps[0];
    loadFallbackAdminEnv();
    const projectId = stripOuterQuotes((_a = process.env.FIREBASE_ADMIN_PROJECT_ID) !== null && _a !== void 0 ? _a : process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '');
    const clientEmail = stripOuterQuotes((_b = process.env.FIREBASE_ADMIN_CLIENT_EMAIL) !== null && _b !== void 0 ? _b : process.env.FIREBASE_CLIENT_EMAIL || '');
    const rawPrivateKey = (_c = process.env.FIREBASE_ADMIN_PRIVATE_KEY) !== null && _c !== void 0 ? _c : process.env.FIREBASE_PRIVATE_KEY || '';
    const privateKey = normalizePrivateKey(rawPrivateKey);
    const missing = [];
    if (!projectId)
        missing.push('FIREBASE_ADMIN_PROJECT_ID');
    if (!clientEmail)
        missing.push('FIREBASE_ADMIN_CLIENT_EMAIL');
    if (!rawPrivateKey)
        missing.push('FIREBASE_ADMIN_PRIVATE_KEY');
    if (missing.length > 0) {
        warnAdminConfig(`Missing Firebase Admin environment variables: ${missing.join(', ')}.`);
    }
    const hasServiceAccount = projectId &&
        clientEmail &&
        privateKey &&
        !isPlaceholder(clientEmail) &&
        !isPlaceholder(privateKey) &&
        hasPrivateKeyShape(privateKey);
    if (rawPrivateKey && !hasServiceAccount && !isPlaceholder(privateKey)) {
        warnAdminConfig('Firebase Admin private key is present but does not look like a service account PEM. Use escaped \\n line breaks in FIREBASE_ADMIN_PRIVATE_KEY.');
    }
    if (hasServiceAccount) {
        try {
            return admin.initializeApp({
                credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
                projectId,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'unknown error';
            warnAdminConfig(`Failed to initialize Firebase Admin SDK from service account: ${message}`);
            return null;
        }
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.NODE_ENV === 'production') {
        try {
            return admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: projectId || undefined,
            });
        }
        catch (_e) {
            warnAdminConfig('Firebase Admin application default credentials are unavailable.');
            return null;
        }
    }
    return null;
}
export function getAdminFirestore() {
    const app = tryGetAdminApp();
    if (!app) {
        throw new Error('firebase_admin_not_configured');
    }
    return admin.firestore(app);
}
// ---------------------------------------------------------------------------
// Strategy 1: Firebase Admin SDK (preferred, requires service account)
// ---------------------------------------------------------------------------
function verifyViaAdminSdk(idToken, app) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const decoded = yield admin.auth(app).verifyIdToken(idToken);
        if (!decoded.email)
            throw new Error('firebase_user_missing_email');
        const identities = (_a = decoded.firebase) === null || _a === void 0 ? void 0 : _a.identities;
        const providerIds = Object.keys(identities !== null && identities !== void 0 ? identities : {});
        return {
            uid: decoded.uid,
            email: decoded.email.toLowerCase().trim(),
            emailVerified: (_b = decoded.email_verified) !== null && _b !== void 0 ? _b : false,
            providerIds,
            displayName: decoded.name,
        };
    });
}
function verifyViaRestApi(idToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const apiKey = (_a = process.env.NEXT_PUBLIC_FIREBASE_API_KEY) !== null && _a !== void 0 ? _a : '';
        if (!apiKey)
            throw new Error('firebase_api_key_not_configured');
        const res = yield fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        const payload = yield res.json().catch(() => ({}));
        if (!res.ok || payload.error) {
            const code = String((_c = (_b = payload.error) === null || _b === void 0 ? void 0 : _b.message) !== null && _c !== void 0 ? _c : '').toUpperCase();
            if (code.includes('INVALID_ID_TOKEN') || code.includes('TOKEN_EXPIRED')) {
                throw new Error('invalid_id_token');
            }
            throw new Error('identity_lookup_failed');
        }
        const user = (_d = payload.users) === null || _d === void 0 ? void 0 : _d[0];
        if (!(user === null || user === void 0 ? void 0 : user.localId))
            throw new Error('identity_lookup_failed');
        if (!user.email)
            throw new Error('firebase_user_missing_email');
        const providerIds = ((_e = user.providerUserInfo) !== null && _e !== void 0 ? _e : [])
            .map((p) => { var _a; return (_a = p.providerId) !== null && _a !== void 0 ? _a : ''; })
            .filter(Boolean);
        return {
            uid: user.localId,
            email: user.email.toLowerCase().trim(),
            emailVerified: (_f = user.emailVerified) !== null && _f !== void 0 ? _f : false,
            providerIds,
            displayName: user.displayName,
        };
    });
}
// ---------------------------------------------------------------------------
// Public: verifyFirebaseIdToken
// Tries Admin SDK first; falls back to REST API if Admin is not configured.
// ---------------------------------------------------------------------------
export function verifyFirebaseIdToken(idToken) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!idToken)
            throw new Error('missing_id_token');
        const adminApp = tryGetAdminApp();
        if (adminApp) {
            try {
                return yield verifyViaAdminSdk(idToken, adminApp);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : '';
                // Surface known errors directly
                if (msg === 'firebase_user_missing_email' ||
                    msg === 'invalid_id_token' ||
                    msg === 'firebase_api_key_not_configured') {
                    throw err;
                }
                // For other Admin SDK failures, fall through to REST API fallback
                console.warn('[firebase-admin] Admin SDK verification failed, falling back to REST API:', msg);
            }
        }
        // Fallback: REST API verification (works without service account)
        return verifyViaRestApi(idToken);
    });
}
