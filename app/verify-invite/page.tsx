'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

interface InviteRecord {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: string;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function InviteVerificationContent() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => String(searchParams.get('token') ?? '').trim(),
    [searchParams]
  );

  const [invite, setInvite] = useState<InviteRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAutoAttempted, setHasAutoAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // ── load invite info ─────────────────────────────────────────────────────

  const loadInvite = useCallback(async () => {
    if (!token) {
      setErrorMessage('Invite link is invalid or unavailable.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/invite/verify?token=${encodeURIComponent(token)}`);
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setInvite(payload?.invite ?? null);
        const alreadyVerified =
          payload?.alreadyVerified === true || payload?.invite?.status === 'verified';
        setIsVerified(alreadyVerified);
        if (alreadyVerified) {
          setSuccessMessage(payload?.message ?? 'Invite already verified. You can now sign in.');
        } else {
          setErrorMessage(payload?.message ?? 'Unable to validate invite link.');
        }
        return;
      }

      setInvite(payload?.invite ?? null);
      const alreadyVerified =
        payload?.alreadyVerified === true || payload?.invite?.status === 'verified';
      setIsVerified(alreadyVerified);
      if (alreadyVerified) {
        setSuccessMessage(payload?.message ?? 'Invite already verified. You can now sign in.');
      }
    } catch {
      setErrorMessage('Unable to validate invite link.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { loadInvite(); }, [loadInvite]);

  // ── verify email ─────────────────────────────────────────────────────────

  const handleVerifyEmail = useCallback(async () => {
    if (!token || isSubmitting || isVerified) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'verify_email' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(payload?.message ?? 'Unable to verify invite.');
        return;
      }
      setInvite((prev) => payload?.invite ?? prev);
      setIsVerified(true);
      setSuccessMessage(payload?.message ?? 'Email verified. You can now sign in with Google.');
    } catch {
      setErrorMessage('Unable to verify invite.');
    } finally {
      setIsSubmitting(false);
    }
  }, [invite, isSubmitting, isVerified, token]);

  // ── auto-verify on load ───────────────────────────────────────────────────

  useEffect(() => {
    if (isLoading || isVerified || !invite || !token || hasAutoAttempted) return;
    const status = String(invite?.status ?? '').toLowerCase();
    if (status === 'expired' || status === 'revoked') return;
    setHasAutoAttempted(true);
    handleVerifyEmail();
  }, [handleVerifyEmail, hasAutoAttempted, invite, isLoading, isVerified, token]);

  const canSubmit = !isLoading && !isSubmitting && !isVerified && Boolean(token);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080c14] px-4 py-10 sm:px-6 lg:px-8">

      {/* Background glows */}
      <div className="pointer-events-none absolute -top-72 -left-48 h-[600px] w-[600px] rounded-full bg-cyan-500 opacity-[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-72 -right-48 h-[600px] w-[600px] rounded-full bg-indigo-600 opacity-[0.06] blur-[140px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-[0_32px_90px_-42px_rgba(15,23,42,0.8)]">

          {/* Top line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />

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

            {errorMessage && (
              <p className="rounded-xl border border-red-900/50 bg-red-950/60 px-3.5 py-2.5 text-sm text-red-300">
                {errorMessage}
              </p>
            )}
            {successMessage && (
              <p className="rounded-xl border border-emerald-800/50 bg-emerald-950/60 px-3.5 py-2.5 text-sm text-emerald-300">
                {successMessage}
              </p>
            )}

            {/* Verify button card */}
            <div className={`rounded-2xl border p-4 sm:p-5 ${isVerified ? 'border-emerald-700/50 bg-emerald-950/40' : 'border-slate-700/50 bg-slate-900/40'}`}>
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  {isVerified
                    ? 'Your email has been verified. Use the same invited email to sign in with Google.'
                    : 'This invite link verifies your email and activates your account.'}
                </p>
                <button
                  type="button"
                  id="verify-invite-button"
                  onClick={handleVerifyEmail}
                  disabled={!canSubmit}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
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
                  {invite?.status ?? (isLoading ? 'Checking…' : '—')}
                </span>
              </p>
              <p>
                Email:{' '}
                <span className="font-semibold text-slate-300">{invite?.email ?? '—'}</span>
              </p>
              <p>
                Expires:{' '}
                <span className="font-semibold text-slate-300">{formatDate(invite?.expiresAt)}</span>
              </p>
            </div>

            {/* Go to sign in */}
            <Link
              href="/sign-in"
              id="go-to-sign-in-link"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-600/50 bg-slate-800/50 px-5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700/60 hover:text-white"
            >
              Go to Sign In
            </Link>

          </div>
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function InviteVerificationFallback() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080c14] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-3xl border border-slate-700/50 bg-slate-800/60 p-8 sm:p-10 space-y-3 animate-pulse">
          <div className="h-3 w-40 rounded-md bg-slate-700" />
          <div className="h-7 w-full max-w-sm rounded-md bg-slate-700" />
          <div className="h-3 w-full max-w-lg rounded-md bg-slate-700" />
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function InviteVerificationPage() {
  return (
    <Suspense fallback={<InviteVerificationFallback />}>
      <InviteVerificationContent />
    </Suspense>
  );
}
