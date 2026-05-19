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
import { getInviteForEmailVerification, verifyInviteEmail, } from '@/lib/user-accounts';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeToken(value) {
    const token = String(value !== null && value !== void 0 ? value : '').trim().toLowerCase();
    if (!/^[a-f0-9]{24,128}$/.test(token))
        return '';
    return token;
}
function messageForReason(reason) {
    var _a;
    const map = {
        invalid_invite_token: 'Invite link is invalid or unavailable.',
        invite_not_found: 'Invite link is invalid or unavailable.',
        invite_expired: 'Invite link has expired. Ask an admin to send a new invitation.',
        invite_revoked: 'Invite link has been revoked. Contact your admin.',
        invite_already_verified: 'Invite verification is already completed. You can sign in.',
        invite_user_not_found: 'Invited account is not available. Contact your admin.',
        account_disabled: 'Invited account is disabled. Contact your admin.',
    };
    return (_a = map[reason]) !== null && _a !== void 0 ? _a : 'Unable to process invite verification.';
}
function statusForReason(reason) {
    if (reason === 'invalid_invite_token')
        return 400;
    if (reason === 'invite_not_found' || reason === 'invite_user_not_found')
        return 404;
    if (reason === 'invite_expired')
        return 410;
    if (reason === 'invite_revoked' || reason === 'account_disabled')
        return 403;
    if (reason === 'invite_already_verified')
        return 200;
    return 400;
}
// ---------------------------------------------------------------------------
// GET — load invite info for display
// ---------------------------------------------------------------------------
export function GET(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const token = normalizeToken(request.nextUrl.searchParams.get('token'));
        if (!token) {
            return NextResponse.json({ message: messageForReason('invalid_invite_token') }, { status: 400 });
        }
        try {
            const invite = yield getInviteForEmailVerification(token);
            if (!invite) {
                return NextResponse.json({ message: messageForReason('invite_not_found') }, { status: 404 });
            }
            if (invite.status === 'expired') {
                return NextResponse.json({ message: messageForReason('invite_expired'), invite }, { status: 410 });
            }
            if (invite.status === 'revoked') {
                return NextResponse.json({ message: messageForReason('invite_revoked'), invite }, { status: 403 });
            }
            return NextResponse.json({ ok: true, invite });
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : 'unknown_error';
            if (reason === 'invite_already_verified') {
                const invite = yield getInviteForEmailVerification(token).catch(() => null);
                return NextResponse.json({ ok: true, alreadyVerified: true, invite, message: messageForReason(reason) }, { status: 200 });
            }
            return NextResponse.json({ message: messageForReason(reason) }, { status: statusForReason(reason) });
        }
    });
}
// ---------------------------------------------------------------------------
// POST — verify invite email
// ---------------------------------------------------------------------------
export function POST(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        let token = '';
        try {
            const body = yield request.json();
            token = normalizeToken((_a = body === null || body === void 0 ? void 0 : body.token) !== null && _a !== void 0 ? _a : null);
        }
        catch (_b) {
            token = '';
        }
        if (!token) {
            return NextResponse.json({ message: messageForReason('invalid_invite_token') }, { status: 400 });
        }
        try {
            const result = yield verifyInviteEmail({ token });
            return NextResponse.json({
                ok: true,
                user: result.user,
                invite: result.invite,
                message: 'Email verification completed. You can now sign in with Google.',
            });
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : 'unknown_error';
            if (reason === 'invite_already_verified') {
                return NextResponse.json({ ok: true, alreadyVerified: true, message: messageForReason(reason) }, { status: 200 });
            }
            return NextResponse.json({ message: messageForReason(reason), reason }, { status: statusForReason(reason) });
        }
    });
}
