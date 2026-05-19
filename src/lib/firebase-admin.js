var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as admin from 'firebase-admin';
// ---------------------------------------------------------------------------
// Firebase Admin SDK — singleton initializer
// Returns null if credentials are not configured / are placeholders.
// ---------------------------------------------------------------------------
const PLACEHOLDER_MARKERS = [
    'REPLACE_WITH',
    'your-service-account',
    'YOUR_',
    '-----BEGIN RSA', // bare placeholder text (not real key)
];
function isPlaceholder(value) {
    return PLACEHOLDER_MARKERS.some((marker) => value.toUpperCase().includes(marker.toUpperCase()));
}
function tryGetAdminApp() {
    var _a, _b, _c;
    if (admin.apps.length > 0)
        return admin.apps[0];
    const projectId = (_a = process.env.FIREBASE_ADMIN_PROJECT_ID) !== null && _a !== void 0 ? _a : '';
    const clientEmail = (_b = process.env.FIREBASE_ADMIN_CLIENT_EMAIL) !== null && _b !== void 0 ? _b : '';
    const rawPrivateKey = (_c = process.env.FIREBASE_ADMIN_PRIVATE_KEY) !== null && _c !== void 0 ? _c : '';
    // If any credential is missing or is a placeholder, skip Admin SDK
    if (!projectId ||
        !clientEmail ||
        !rawPrivateKey ||
        isPlaceholder(clientEmail) ||
        isPlaceholder(rawPrivateKey)) {
        return null;
    }
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    try {
        return admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
            projectId,
        });
    }
    catch (_d) {
        return null;
    }
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
