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
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(value) {
    if (!value)
        return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return '—';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
}
// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
function InviteVerificationContent() {
    var _a, _b;
    const searchParams = useSearchParams();
    const token = useMemo(() => { var _a; return String((_a = searchParams.get('token')) !== null && _a !== void 0 ? _a : '').trim(); }, [searchParams]);
    const [invite, setInvite] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasAutoAttempted, setHasAutoAttempted] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    // ── load invite info ─────────────────────────────────────────────────────
    const loadInvite = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!token) {
            setErrorMessage('Invite link is invalid or unavailable.');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const res = yield fetch(`/api/invite/verify?token=${encodeURIComponent(token)}`);
            const payload = yield res.json().catch(() => ({}));
            if (!res.ok) {
                setInvite((_a = payload === null || payload === void 0 ? void 0 : payload.invite) !== null && _a !== void 0 ? _a : null);
                const alreadyVerified = (payload === null || payload === void 0 ? void 0 : payload.alreadyVerified) === true || ((_b = payload === null || payload === void 0 ? void 0 : payload.invite) === null || _b === void 0 ? void 0 : _b.status) === 'verified';
                setIsVerified(alreadyVerified);
                if (alreadyVerified) {
                    setSuccessMessage((_c = payload === null || payload === void 0 ? void 0 : payload.message) !== null && _c !== void 0 ? _c : 'Invite already verified. You can now sign in.');
                }
                else {
                    setErrorMessage((_d = payload === null || payload === void 0 ? void 0 : payload.message) !== null && _d !== void 0 ? _d : 'Unable to validate invite link.');
                }
                return;
            }
            setInvite((_e = payload === null || payload === void 0 ? void 0 : payload.invite) !== null && _e !== void 0 ? _e : null);
            const alreadyVerified = (payload === null || payload === void 0 ? void 0 : payload.alreadyVerified) === true || ((_f = payload === null || payload === void 0 ? void 0 : payload.invite) === null || _f === void 0 ? void 0 : _f.status) === 'verified';
            setIsVerified(alreadyVerified);
            if (alreadyVerified) {
                setSuccessMessage((_g = payload === null || payload === void 0 ? void 0 : payload.message) !== null && _g !== void 0 ? _g : 'Invite already verified. You can now sign in.');
            }
        }
        catch (_h) {
            setErrorMessage('Unable to validate invite link.');
        }
        finally {
            setIsLoading(false);
        }
    }), [token]);
    useEffect(() => { loadInvite(); }, [loadInvite]);
    // ── verify email ─────────────────────────────────────────────────────────
    const handleVerifyEmail = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!token || isSubmitting || isVerified)
            return;
        setIsSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const res = yield fetch('/api/invite/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action: 'verify_email' }),
            });
            const payload = yield res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorMessage((_a = payload === null || payload === void 0 ? void 0 : payload.message) !== null && _a !== void 0 ? _a : 'Unable to verify invite.');
                return;
            }
            setInvite((prev) => { var _a; return (_a = payload === null || payload === void 0 ? void 0 : payload.invite) !== null && _a !== void 0 ? _a : prev; });
            setIsVerified(true);
            setSuccessMessage((_b = payload === null || payload === void 0 ? void 0 : payload.message) !== null && _b !== void 0 ? _b : 'Email verified. You can now sign in with Google.');
        }
        catch (_c) {
            setErrorMessage('Unable to verify invite.');
        }
        finally {
            setIsSubmitting(false);
        }
    }), [invite, isSubmitting, isVerified, token]);
    // ── auto-verify on load ───────────────────────────────────────────────────
    useEffect(() => {
        var _a;
        if (isLoading || isVerified || !invite || !token || hasAutoAttempted)
            return;
        const status = String((_a = invite === null || invite === void 0 ? void 0 : invite.status) !== null && _a !== void 0 ? _a : '').toLowerCase();
        if (status === 'expired' || status === 'revoked')
            return;
        setHasAutoAttempted(true);
        handleVerifyEmail();
    }, [handleVerifyEmail, hasAutoAttempted, invite, isLoading, isVerified, token]);
    const canSubmit = !isLoading && !isSubmitting && !isVerified && Boolean(token);
    // ── render ───────────────────────────────────────────────────────────────
    return (<main className="relative min-h-screen overflow-hidden bg-[#080c14] px-4 py-10 sm:px-6 lg:px-8">

      {/* Background glows */}
      <div className="pointer-events-none absolute -top-72 -left-48 h-[600px] w-[600px] rounded-full bg-cyan-500 opacity-[0.06] blur-[140px]"/>
      <div className="pointer-events-none absolute -bottom-72 -right-48 h-[600px] w-[600px] rounded-full bg-indigo-600 opacity-[0.06] blur-[140px]"/>
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
            backgroundSize: '28px 28px',
        }}/>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"/>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-[0_32px_90px_-42px_rgba(15,23,42,0.8)]">

          {/* Top line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none"/>

          {/* Header */}
          <div className="border-b border-slate-700/50 bg-slate-900/40 px-6 py-5 sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
              ATRAVA Domain Defense
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Verify Invite Email
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Confirm this invitation to activate your account and continue to sign in.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-6 sm:px-7">

            {errorMessage && (<p className="rounded-xl border border-red-900/50 bg-red-950/60 px-3.5 py-2.5 text-sm text-red-300">
                {errorMessage}
              </p>)}
            {successMessage && (<p className="rounded-xl border border-emerald-800/50 bg-emerald-950/60 px-3.5 py-2.5 text-sm text-emerald-300">
                {successMessage}
              </p>)}

            {/* Verify button card */}
            <div className={`rounded-2xl border p-4 sm:p-5 ${isVerified ? 'border-emerald-700/50 bg-emerald-950/40' : 'border-slate-700/50 bg-slate-900/40'}`}>
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  {isVerified
            ? 'Your email has been verified. Use the same invited email to sign in with Google.'
            : 'This invite link verifies your email and activates your account.'}
                </p>
                <button type="button" id="verify-invite-button" onClick={handleVerifyEmail} disabled={!canSubmit} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading
            ? 'Checking…'
            : isSubmitting
                ? 'Verifying…'
                : isVerified
                    ? '✓ Invite Verified'
                    : 'Verify Invite and Continue'}
                </button>
              </div>
            </div>

            {/* Meta info */}
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-3.5 py-3 text-xs text-slate-500 space-y-1">
              <p>
                Status:{' '}
                <span className="font-semibold text-slate-300">
                  {(_a = invite === null || invite === void 0 ? void 0 : invite.status) !== null && _a !== void 0 ? _a : (isLoading ? 'Checking…' : '—')}
                </span>
              </p>
              <p>
                Email:{' '}
                <span className="font-semibold text-slate-300">{(_b = invite === null || invite === void 0 ? void 0 : invite.email) !== null && _b !== void 0 ? _b : '—'}</span>
              </p>
              <p>
                Expires:{' '}
                <span className="font-semibold text-slate-300">{formatDate(invite === null || invite === void 0 ? void 0 : invite.expiresAt)}</span>
              </p>
            </div>

            {/* Go to sign in */}
            <Link href="/sign-in" id="go-to-sign-in-link" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-600/50 bg-slate-800/50 px-5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700/60 hover:text-white">
              Go to Sign In
            </Link>

          </div>
        </section>
      </div>
    </main>);
}
// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------
function InviteVerificationFallback() {
    return (<main className="relative min-h-screen overflow-hidden bg-[#080c14] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-3xl border border-slate-700/50 bg-slate-800/60 p-8 sm:p-10 space-y-3 animate-pulse">
          <div className="h-3 w-40 rounded-md bg-slate-700"/>
          <div className="h-7 w-full max-w-sm rounded-md bg-slate-700"/>
          <div className="h-3 w-full max-w-lg rounded-md bg-slate-700"/>
        </section>
      </div>
    </main>);
}
// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------
export default function InviteVerificationPage() {
    return (<Suspense fallback={<InviteVerificationFallback />}>
      <InviteVerificationContent />
    </Suspense>);
}
