var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const SESSION_COOKIE_NAME = 'atrava_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
// ---------------------------------------------------------------------------
// Secret
// ---------------------------------------------------------------------------
// Dev fallback — used only when AUTH_SECRET is not set or is the placeholder.
// This means sessions persist across hot-reloads in dev but are NOT secure for prod.
const DEV_FALLBACK_SECRET = 'atrava-dev-fallback-secret-not-for-production-use-only';
function getSecret() {
    var _a;
    const raw = (_a = process.env.AUTH_SECRET) !== null && _a !== void 0 ? _a : '';
    const isPlaceholder = !raw ||
        raw.toUpperCase().startsWith('REPLACE_WITH') ||
        raw.toUpperCase().startsWith('YOUR_');
    if (isPlaceholder) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('AUTH_SECRET environment variable is not set for production.');
        }
        // Dev mode: warn once and use fallback
        console.warn('[auth-session] AUTH_SECRET is not configured. Using dev fallback — set AUTH_SECRET in .env.local.');
        return new TextEncoder().encode(DEV_FALLBACK_SECRET);
    }
    return new TextEncoder().encode(raw);
}
// ---------------------------------------------------------------------------
// Cookie options
// ---------------------------------------------------------------------------
export function getSessionCookieOptions(expiresAt) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
    };
}
export function getExpiredCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
    };
}
// ---------------------------------------------------------------------------
// Create session
// ---------------------------------------------------------------------------
export function createSession(email, role) {
    return __awaiter(this, void 0, void 0, function* () {
        const secret = getSecret();
        const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
        const token = yield new SignJWT({ email, role })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
            .sign(secret);
        return { token, expiresAt };
    });
}
export function getServerSession() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        let cookieStore;
        try {
            cookieStore = yield cookies();
        }
        catch (_b) {
            return null;
        }
        const raw = (_a = cookieStore.get(SESSION_COOKIE_NAME)) === null || _a === void 0 ? void 0 : _a.value;
        if (!raw)
            return null;
        try {
            const secret = getSecret();
            const { payload } = yield jwtVerify(raw, secret);
            const { email, role } = payload;
            if (!email || !role)
                return null;
            return { email, role };
        }
        catch (_c) {
            return null;
        }
    });
}
