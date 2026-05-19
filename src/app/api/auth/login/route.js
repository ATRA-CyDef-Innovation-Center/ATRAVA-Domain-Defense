var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { createSession, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth-session';
import { getLoginAccount, listUserAccounts, markUserLogin, bootstrapAdminAccount, } from '@/lib/user-accounts';
export function POST(request) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const body = yield request.json();
            const idToken = typeof (body === null || body === void 0 ? void 0 : body.idToken) === 'string' ? body.idToken : '';
            if (!idToken) {
                return NextResponse.json({ message: 'Google sign-in token is missing.', reason: 'missing_id_token' }, { status: 400 });
            }
            // 1. Verify Firebase ID token
            let identity;
            try {
                identity = yield verifyFirebaseIdToken(idToken);
            }
            catch (err) {
                const reason = err instanceof Error ? err.message : 'identity_lookup_failed';
                const message = reason === 'missing_id_token'
                    ? 'Google sign-in token is missing.'
                    : reason === 'invalid_id_token'
                        ? 'Invalid Google sign-in token.'
                        : reason === 'firebase_custom_claims_not_configured'
                            ? 'Firebase Admin is not configured. Set FIREBASE_ADMIN_* environment variables.'
                            : 'Unable to verify Google sign-in.';
                return NextResponse.json({ message, reason }, { status: 400 });
            }
            const { uid, email, emailVerified, providerIds, displayName } = identity;
            // 2. Require verified email
            if (!emailVerified) {
                return NextResponse.json({ message: 'Google account email must be verified.', reason: 'email_not_verified' }, { status: 403 });
            }
            // 3. Require Google provider
            const isGoogle = providerIds.includes('google.com');
            if (!isGoogle) {
                return NextResponse.json({ message: 'Only Google sign-in is allowed for this workspace.', reason: 'provider_not_allowed' }, { status: 403 });
            }
            // 4. Bootstrap: if no users exist yet, auto-provision the first signer as admin
            let account = yield getLoginAccount(email);
            if (!account) {
                const allUsers = yield listUserAccounts();
                if (allUsers.length === 0) {
                    // First user ever — bootstrap as admin
                    account = yield bootstrapAdminAccount({ uid, email, displayName });
                }
                else {
                    return NextResponse.json({
                        message: 'Your account has not been provisioned. Ask an admin to invite you.',
                        reason: 'role_not_provisioned',
                    }, { status: 403 });
                }
            }
            // 5. Check account status
            if (account.status === 'disabled') {
                return NextResponse.json({ message: 'Account is disabled. Please contact an admin.', reason: 'account_disabled' }, { status: 403 });
            }
            // 6. Require invite email verification for invited users
            if (account.source === 'invite' && !account.emailVerifiedAt) {
                return NextResponse.json({
                    message: 'Complete invite email verification first. Open your invite link and verify before signing in.',
                    reason: 'invite_email_verification_required',
                }, { status: 403 });
            }
            // 7. Account must be active
            if (account.status !== 'active') {
                return NextResponse.json({
                    message: 'Account is not active yet. Please contact an admin.',
                    reason: 'account_inactive',
                }, { status: 403 });
            }
            // 8. Create session
            const { token, expiresAt } = yield createSession(account.email, account.role);
            yield markUserLogin(account.email);
            const response = NextResponse.json({ ok: true, landingPath: '/' });
            response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
            return response;
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : 'internal_error';
            console.error('[/api/auth/login]', reason, err);
            return NextResponse.json({ message: 'Unable to process login request.', reason }, { status: 500 });
        }
    });
}
