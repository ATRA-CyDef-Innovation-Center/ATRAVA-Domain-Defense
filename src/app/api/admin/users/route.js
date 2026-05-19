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
import { getServerSession } from '@/lib/auth-session';
import { deliverInviteEmail } from '@/lib/invite-delivery';
import { inviteUserAccount, listUserAccounts, revokeInviteById, } from '@/lib/user-accounts';
// ---------------------------------------------------------------------------
// Auth guard helper
// ---------------------------------------------------------------------------
function requireAdmin(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const session = yield getServerSession();
        if (!session) {
            return { error: NextResponse.json({ message: 'Unauthorized.' }, { status: 401 }) };
        }
        if (session.role !== 'admin') {
            return { error: NextResponse.json({ message: 'Forbidden.' }, { status: 403 }) };
        }
        return { session };
    });
}
// ---------------------------------------------------------------------------
// GET /api/admin/users — list all users
// ---------------------------------------------------------------------------
export function GET(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const auth = yield requireAdmin(request);
        if ('error' in auth)
            return auth.error;
        const users = yield listUserAccounts();
        return NextResponse.json({ users });
    });
}
// ---------------------------------------------------------------------------
// POST /api/admin/users — invite a new user
// ---------------------------------------------------------------------------
export function POST(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const auth = yield requireAdmin(request);
        if ('error' in auth)
            return auth.error;
        const { session } = auth;
        try {
            const body = yield request.json();
            const email = typeof (body === null || body === void 0 ? void 0 : body.email) === 'string' ? body.email.toLowerCase().trim() : '';
            const role = typeof (body === null || body === void 0 ? void 0 : body.role) === 'string' ? body.role : 'viewer';
            const result = yield inviteUserAccount({ email, role, invitedBy: session.email });
            // Deliver invite email
            let delivery = null;
            try {
                delivery = yield deliverInviteEmail({
                    toEmail: result.user.email,
                    invitedBy: session.email,
                    expiresAt: result.invite.expiresAt,
                    inviteToken: result.invite.token,
                    requestOrigin: (_b = (_a = request.nextUrl) === null || _a === void 0 ? void 0 : _a.origin) !== null && _b !== void 0 ? _b : '',
                });
            }
            catch (deliveryErr) {
                const reason = deliveryErr instanceof Error ? deliveryErr.message : 'email_delivery_failed';
                // Revoke invite and fail
                yield revokeInviteById(result.invite.id).catch(() => null);
                let errorMessage = `Invite email could not be delivered. Invitation was revoked. (${reason})`;
                if (reason === 'firebase_email_provider_not_enabled') {
                    errorMessage = 'Failed to send invite email: Please enable "Email link (passwordless sign-in)" in Firebase Authentication settings (Sign-in method tab).';
                }
                return NextResponse.json({ message: errorMessage }, { status: 502 });
            }
            const baseUrl = (_d = (_c = request.nextUrl) === null || _c === void 0 ? void 0 : _c.origin) !== null && _d !== void 0 ? _d : 'http://localhost:3000';
            const verifyUrl = `${baseUrl}/verify-invite?token=${encodeURIComponent(result.invite.token)}`;
            return NextResponse.json(Object.assign({ ok: true, user: result.user, invite: {
                    id: result.invite.id,
                    email: result.invite.email,
                    role: result.invite.role,
                    invitedBy: result.invite.invitedBy,
                    invitedAt: result.invite.invitedAt,
                    expiresAt: result.invite.expiresAt,
                    status: result.invite.status,
                }, delivery, link: process.env.NODE_ENV !== 'production' || (delivery && 'previewUrl' in delivery) ? verifyUrl : undefined }, (delivery && 'status' in delivery && delivery.status === 'failed'
                ? { warning: `Invite email delivery failed (${delivery.reason || 'dev mode'}) — share the manual link.` }
                : {})), { status: 201 });
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : 'unknown_error';
            const message = reason === 'invalid_email'
                ? 'Invalid email address.'
                : reason === 'invalid_role'
                    ? 'Invalid role selected.'
                    : reason === 'user_already_exists'
                        ? 'A user with that email already exists and is active.'
                        : 'Unable to create invitation.';
            return NextResponse.json({ message }, { status: 400 });
        }
    });
}
