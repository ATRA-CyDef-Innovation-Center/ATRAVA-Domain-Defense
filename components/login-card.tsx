'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { getFirebaseClientAuth } from '@/lib/firebase-client-auth';
import { useAuth } from '@/components/auth-provider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDIRECT_PENDING_KEY = 'atrava_google_redirect_pending';
const LOGIN_REQUEST_TIMEOUT_MS = 20_000;

function setRedirectPending() {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
}
function clearRedirectPending() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
}
function hasRedirectPending() {
  return typeof window !== 'undefined' && window.sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
}

function waitForSignedInUser(
  auth: ReturnType<typeof getFirebaseClientAuth>,
  timeoutMs = 8_000
): Promise<FirebaseUser | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    const timer = window.setTimeout(() => {
      if (!settled) { settled = true; unsubscribe(); resolve(null); }
    }, timeoutMs);
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      if (!settled) { settled = true; window.clearTimeout(timer); unsubscribe(); resolve(user); }
    });
  });
}

function buildGoogleProvider() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

function mapLoginError(err: unknown): string {
  const code = String((err as { code?: string })?.code ?? '').trim();
  const msg = String((err as { message?: string })?.message ?? '').toLowerCase();

  if (code === 'email_not_verified') return 'Google account email must be verified.';
  if (code === 'provider_not_allowed') return 'Only Google sign-in is allowed for this workspace.';
  if (code === 'role_not_provisioned') return 'Your account has not been provisioned. Ask an admin to invite you.';
  if (code === 'account_disabled') return 'Account is disabled. Please contact your admin.';
  if (code === 'invite_email_verification_required')
    return 'Complete invite email verification first. Open your invite link, then sign in.';
  if (code === 'account_inactive') return 'Account is not active yet. Please contact your admin.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized in Firebase Authentication settings.';
  if (code === 'auth/invalid-api-key') return 'Firebase API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY.';
  if (code === 'auth/internal-error') return 'Authentication was interrupted. Click Continue with Google again.';
  if (msg.includes('firebase_client_not_configured') || msg.includes('not_configured'))
    return 'Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY and related env vars.';
  return (err as { message?: string })?.message ?? 'Unable to complete Google sign-in.';
}

// ---------------------------------------------------------------------------
// LoginCard
// ---------------------------------------------------------------------------

export default function LoginCard() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const finalizingLoginRef = useRef(false);
  const { refreshProfile } = useAuth();

  // ── complete workspace login ─────────────────────────────────────────────

  const completeWorkspaceLogin = useCallback(
    async (auth: ReturnType<typeof getFirebaseClientAuth>, firebaseUser: FirebaseUser) => {
      const idToken = await firebaseUser.getIdToken(true);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), LOGIN_REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError')
          throw new Error('Login verification timed out. Please retry sign-in.');
        throw err;
      } finally {
        window.clearTimeout(timeoutId);
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        await signOut(auth).catch(() => {});
        const loginError: Error & { code?: string } = new Error(
          payload?.message ?? 'Unable to log in.'
        );
        loginError.code = String(payload?.reason ?? `http_${response.status}`).trim();
        throw loginError;
      }

      return payload as { landingPath?: string };
    },
    []
  );

  // ── handle Google login click ─────────────────────────────────────────────

  const handleGoogleLogin = useCallback(async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');
    let auth: ReturnType<typeof getFirebaseClientAuth> | null = null;
    let provider: GoogleAuthProvider | null = null;
    try {
      auth = getFirebaseClientAuth();
      provider = buildGoogleProvider();
      const popupResult = await signInWithPopup(auth, provider);
      if (popupResult?.user) {
        clearRedirectPending();
        setIsVerifyingAccess(true);
        const payload = await completeWorkspaceLogin(auth, popupResult.user);
        finalizingLoginRef.current = true;
        await refreshProfile();
        router.replace(payload?.landingPath ?? '/');
        router.refresh();
        return;
      }
      setRedirectPending();
      await signInWithRedirect(auth, provider);
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code ?? '').trim();
      const canFallback =
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/internal-error';

      if (canFallback && auth && provider) {
        try {
          setRedirectPending();
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: unknown) {
          clearRedirectPending();
          setErrorMessage(mapLoginError(redirectErr));
          return;
        }
      }

      setErrorMessage(mapLoginError(err));
    } finally {
      if (!finalizingLoginRef.current) {
        setIsSubmitting(false);
        setIsVerifyingAccess(false);
      }
    }
  }, [completeWorkspaceLogin, router, refreshProfile]);

  // ── redirect result processing (on mount) ────────────────────────────────

  useEffect(() => {
    let active = true;
    const processRedirectResult = async () => {
      try {
        const auth = getFirebaseClientAuth();
        const redirectWasPending = hasRedirectPending();
        const redirectResult = await getRedirectResult(auth);
        if (!active) return;

        const redirectUser =
          redirectResult?.user ??
          auth.currentUser ??
          (redirectWasPending ? await waitForSignedInUser(auth) : null);

        if (redirectUser) {
          setIsSubmitting(true);
          setIsVerifyingAccess(true);
          setErrorMessage('');
          clearRedirectPending();
          const payload = await completeWorkspaceLogin(auth, redirectUser);
          finalizingLoginRef.current = true;
          await refreshProfile();
          router.replace(payload?.landingPath ?? '/');
          router.refresh();
          return;
        }

        if (!redirectWasPending) return;
        clearRedirectPending();
        setInfoMessage('Sign-in session was not completed. Click Continue with Google to retry.');
      } catch (err: unknown) {
        if (!active) return;
        clearRedirectPending();
        setErrorMessage(mapLoginError(err));
      } finally {
        if (active && !finalizingLoginRef.current) {
          setIsSubmitting(false);
          setIsVerifyingAccess(false);
        }
      }
    };
    processRedirectResult();
    return () => { active = false; };
  }, [completeWorkspaceLogin, router, refreshProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── render ───────────────────────────────────────────────────────────────

  const isBusy = isSubmitting || isVerifyingAccess;

  return (
    <section className="w-full">
      <div className="relative mx-auto w-full max-w-xl">

        {/* Badge */}
        <div className="mb-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-400 shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Secure Workspace Access
          </span>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(15,23,42,0.4)] transition-all duration-500 hover:shadow-[0_0_60px_rgba(6,182,212,0.08),0_20px_60px_rgba(15,23,42,0.5)]">
          {/* Top border gradient */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          {/* Radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(6,182,212,0.05),transparent)]" />

          <div className="relative px-10 pt-10 pb-9 sm:px-12 sm:pt-12 sm:pb-10">

            {/* Logo area */}
            <div className="mb-7 flex items-center justify-center">
              <div className="flex items-center gap-3">
                {/* Shield icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
                    ATRAVA
                  </p>
                  <p className="text-[15px] font-bold text-white leading-tight">
                    Domain Defense
                  </p>
                </div>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-7 space-y-1.5 text-center">
              <h1 className="text-[28px] font-[650] leading-tight tracking-[-0.02em] text-white sm:text-[26px]">
                Sign in to your workspace.
              </h1>
              <p className="text-[14px] leading-relaxed text-slate-400">
                Access your secure DNS security control plane.
              </p>
            </div>

            {/* Divider */}
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-600/50" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
                continue with
              </span>
              <div className="h-px flex-1 bg-slate-600/50" />
            </div>

            {/* Google button */}
            <button
              type="button"
              id="google-sign-in-button"
              onClick={handleGoogleLogin}
              disabled={isBusy}
              className="group relative flex h-[54px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f4ee]/90 backdrop-blur-md px-5 text-[14px] font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-out hover:bg-white hover:shadow-[0_12px_30px_rgba(15,23,42,0.18)] hover:scale-[1.01] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              {/* Google logo */}
              <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7977 2.7155v2.2582h2.9082c1.7018-1.5664 2.6859-3.8741 2.6859-6.6146z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1805l-2.9082-2.2582c-.8064.5409-1.8377.8605-3.0482.8605-2.3468 0-4.3341-1.5859-5.0432-3.7168H.9577v2.3332C2.4382 15.98 5.4818 18 9 18z" />
                <path fill="#FBBC05" d="M3.9568 10.705c-.1809-.5409-.2841-1.1182-.2841-1.705 0-.5868.1032-1.1641.2841-1.705V4.9618H.9577C.3477 6.1732 0 7.5491 0 9c0 1.4509.3477 2.8268.9577 4.0382l2.9991-2.3332z" />
                <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4545 3.4405 1.3455l2.5805-2.5805C13.4632.891 11.4259 0 9 0 5.4818 0 2.4382 2.02.9577 4.9618l2.9991 2.3332C4.6659 5.1641 6.6532 3.5795 9 3.5795z" />
              </svg>

              <span className="relative">
                {isBusy
                  ? <span className="animate-pulse">{isVerifyingAccess ? 'Verifying access…' : 'Signing in…'}</span>
                  : 'Continue with Google'}
              </span>

              {!isBusy && (
                <svg
                  viewBox="0 0 16 16"
                  className="absolute right-5 h-4 w-4 text-stone-400 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              )}
            </button>

            {/* Error */}
            {errorMessage && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-900/50 bg-red-950/60 px-3.5 py-2.5">
                <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" fill="currentColor" aria-hidden="true">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5zm0 7a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                </svg>
                <p className="text-[12px] leading-relaxed text-red-300">{errorMessage}</p>
              </div>
            )}

            {/* Info */}
            {infoMessage && !errorMessage && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-800/50 bg-sky-950/60 px-3.5 py-2.5">
                <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" fill="currentColor" aria-hidden="true">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a.75.75 0 1 1 0 1.5A.75.75 0 0 1 8 4zm.75 3.5v4.5a.75.75 0 0 1-1.5 0V7.5a.75.75 0 0 1 1.5 0z" />
                </svg>
                <p className="text-[12px] leading-relaxed text-sky-300">{infoMessage}</p>
              </div>
            )}

            {/* Invitation-only note */}
            <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-500">
              Access is by invitation only. Verify your invite email first, then sign in.
            </p>

          </div>

          {/* Bottom border gradient */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-600/40 to-transparent" />
        </div>

        {/* Footer badges */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 backdrop-blur-sm">
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 1L2 3v3c0 2.2 1.7 4.2 4 4.7C8.3 10.2 10 8.2 10 6V3L6 1z" />
            </svg>
            Secure enterprise session
          </span>
          <span className="rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 backdrop-blur-sm">
            DNS Security v1
          </span>
          <span className="rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 backdrop-blur-sm">
            ATRA &amp; Associates
          </span>
        </div>

      </div>
    </section>
  );
}
