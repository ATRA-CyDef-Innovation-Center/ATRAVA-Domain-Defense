var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function normalizeEmailProvider(raw) {
    const v = raw.trim().toLowerCase();
    if (v === 'firebase' || v.includes('firebase'))
        return 'firebase';
    if (v === 'resend' || v.includes('resend'))
        return 'resend';
    if (v === 'console' || v === 'dev')
        return 'console';
    return '';
}
function getEmailProvider() {
    var _a, _b, _c;
    const configured = normalizeEmailProvider((_a = process.env.ATRAVA_EMAIL_PROVIDER) !== null && _a !== void 0 ? _a : '');
    if (configured)
        return configured;
    const hasResend = String((_b = process.env.RESEND_API_KEY) !== null && _b !== void 0 ? _b : '').trim().startsWith('re_') &&
        String((_c = process.env.ATRAVA_EMAIL_FROM) !== null && _c !== void 0 ? _c : '').trim().length > 0;
    if (hasResend)
        return 'resend';
    return 'firebase';
}
function normalizeBaseUrl(value) {
    const raw = value.trim();
    if (!raw)
        return '';
    if (raw.startsWith('http://') || raw.startsWith('https://'))
        return raw.replace(/\/+$/, '');
    return `https://${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}
function getAppBaseUrl(requestOrigin = '') {
    var _a;
    const candidates = [
        normalizeBaseUrl(requestOrigin),
        normalizeBaseUrl((_a = process.env.NEXT_PUBLIC_APP_URL) !== null && _a !== void 0 ? _a : ''),
        normalizeBaseUrl(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
            ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
            : ''),
    ].filter(Boolean);
    if (candidates.length === 0)
        throw new Error('app_base_url_not_configured');
    return candidates[0];
}
function escapeHtml(v) {
    return v
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function buildEmailContent({ invitedBy, verifyUrl, loginUrl, expiresAt, }) {
    const expDate = new Date(expiresAt);
    const readableExp = Number.isNaN(expDate.getTime())
        ? expiresAt
        : expDate.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    const safeInvitedBy = escapeHtml(invitedBy || 'ATRAVA Admin');
    const safeVerifyUrl = escapeHtml(verifyUrl);
    const safeLoginUrl = escapeHtml(loginUrl);
    const safeExp = escapeHtml(readableExp);
    const subject = "You're invited to ATRAVA Domain Defense — verify your email to get started";
    const text = [
        'You have been invited to ATRAVA Domain Defense.',
        '',
        'Verify your email to activate your account:',
        verifyUrl,
        '',
        `Sign in after verification: ${loginUrl}`,
        `Invited by: ${invitedBy}`,
        `Invitation expires: ${readableExp}`,
        '',
        'Use the same invited email when signing in with Google.',
    ].join('\n');
    const html = [
        '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px">',
        '<p style="margin:0 0 12px 0">Hello,</p>',
        '<p style="margin:0 0 12px 0">You have been invited to <strong>ATRAVA Domain Defense</strong>.</p>',
        '<p style="margin:0 0 16px 0">Click the button below to verify your email and activate your account.</p>',
        `<p style="margin:0 0 16px 0"><a href="${safeVerifyUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Verify Email &amp; Activate Account</a></p>`,
        `<p style="margin:0 0 12px 0"><strong>Invited by:</strong> ${safeInvitedBy}<br/>`,
        `<strong>Invitation expires:</strong> ${safeExp}</p>`,
        `<p style="margin:0 0 12px 0">After verification, sign in here using Google: <a href="${safeLoginUrl}">${safeLoginUrl}</a></p>`,
        '<p style="margin:0;color:#475569;font-size:12px">Use the same invited email address when signing in with Google.</p>',
        '</div>',
    ].join('');
    return { subject, text, html };
}
function sendViaFirebaseAuth(_a) {
    return __awaiter(this, arguments, void 0, function* ({ toEmail, verifyUrl, }) {
        var _b, _c, _d;
        const apiKey = String((_b = process.env.NEXT_PUBLIC_FIREBASE_API_KEY) !== null && _b !== void 0 ? _b : '').trim();
        if (!apiKey)
            throw new Error('firebase_api_key_not_configured');
        const res = yield fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestType: 'EMAIL_SIGNIN',
                email: toEmail,
                continueUrl: verifyUrl,
                canHandleCodeInApp: true,
            }),
        });
        if (!res.ok) {
            const payload = yield res.json().catch(() => ({}));
            const code = String((_d = (_c = payload === null || payload === void 0 ? void 0 : payload.error) === null || _c === void 0 ? void 0 : _c.message) !== null && _d !== void 0 ? _d : '');
            if (code === 'OPERATION_NOT_ALLOWED')
                throw new Error('firebase_email_provider_not_enabled');
            if (code === 'MISSING_CONTINUE_URI' || code === 'INVALID_CONTINUE_URI')
                throw new Error('firebase_continue_url_invalid');
            if (code === 'INVALID_EMAIL')
                throw new Error('invalid_email');
            throw new Error('email_delivery_failed');
        }
        return { provider: 'firebase', status: 'sent', messageId: `firebase-${Date.now()}` };
    });
}
function sendViaResend(_a) {
    return __awaiter(this, arguments, void 0, function* ({ toEmail, subject, html, text, }) {
        var _b, _c;
        const apiKey = String((_b = process.env.RESEND_API_KEY) !== null && _b !== void 0 ? _b : '').trim();
        const from = String((_c = process.env.ATRAVA_EMAIL_FROM) !== null && _c !== void 0 ? _c : '').trim();
        if (!apiKey || !from || !apiKey.startsWith('re_'))
            throw new Error('email_provider_not_configured');
        const res = yield fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ from, to: [toEmail], subject, html, text }),
        });
        if (!res.ok) {
            const payload = yield res.json().catch(() => ({}));
            const msg = typeof (payload === null || payload === void 0 ? void 0 : payload.message) === 'string' ? payload.message : '';
            throw new Error(msg ? `email_delivery_failed:${msg}` : 'email_delivery_failed');
        }
        const payload = yield res.json().catch(() => ({}));
        return {
            provider: 'resend',
            status: 'sent',
            messageId: typeof (payload === null || payload === void 0 ? void 0 : payload.id) === 'string' ? payload.id : `resend-${Date.now()}`,
        };
    });
}
function sendViaConsole({ toEmail, verifyUrl, loginUrl, }) {
    const messageId = `console-${Date.now()}`;
    console.info('[ATRAVA:InviteEmail]', { toEmail, verifyUrl, loginUrl, messageId });
    return { provider: 'console', status: 'simulated', messageId, previewUrl: verifyUrl };
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function deliverInviteEmail(_a) {
    return __awaiter(this, arguments, void 0, function* ({ toEmail, invitedBy, expiresAt, inviteToken, requestOrigin = '', }) {
        const baseUrl = getAppBaseUrl(requestOrigin);
        const verifyUrl = `${baseUrl}/verify-invite?token=${encodeURIComponent(inviteToken)}`;
        const loginUrl = `${baseUrl}/sign-in`;
        const content = buildEmailContent({ invitedBy, verifyUrl, loginUrl, expiresAt });
        const provider = getEmailProvider();
        if (provider === 'firebase') {
            return sendViaFirebaseAuth({ toEmail, verifyUrl });
        }
        if (provider === 'resend') {
            return sendViaResend({ toEmail, subject: content.subject, html: content.html, text: content.text });
        }
        if (provider === 'console') {
            if (process.env.ATRAVA_ALLOW_CONSOLE_EMAIL !== 'true') {
                throw new Error('email_provider_not_configured');
            }
            return sendViaConsole({ toEmail, verifyUrl, loginUrl });
        }
        throw new Error('unsupported_email_provider');
    });
}
