import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import type { UserRole } from '@/lib/types';

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

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET ?? '';
  const isPlaceholder =
    !raw ||
    raw.toUpperCase().startsWith('REPLACE_WITH') ||
    raw.toUpperCase().startsWith('YOUR_');

  if (isPlaceholder) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET environment variable is not set for production.');
    }
    // Dev mode: warn once and use fallback
    console.warn(
      '[auth-session] AUTH_SECRET is not configured. Using dev fallback — set AUTH_SECRET in .env.local.'
    );
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }

  return new TextEncoder().encode(raw);
}

// ---------------------------------------------------------------------------
// Cookie options
// ---------------------------------------------------------------------------

export function getSessionCookieOptions(expiresAt: Date): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  };
}

export function getExpiredCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  };
}

// ---------------------------------------------------------------------------
// Session payload type
// ---------------------------------------------------------------------------

interface SessionPayload extends JWTPayload {
  email: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Create session
// ---------------------------------------------------------------------------

export async function createSession(
  email: string,
  role: UserRole,
): Promise<{ token: string; expiresAt: Date }> {
  const secret = getSecret();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  const token = await new SignJWT({ email, role } as SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  return { token, expiresAt };
}

// ---------------------------------------------------------------------------
// Verify / get session from cookies (server-side)
// ---------------------------------------------------------------------------

export interface Session {
  email: string;
  role: UserRole;
}

export async function getServerSession(): Promise<Session | null> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return null;
  }

  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(raw, secret);
    const { email, role } = payload as SessionPayload;
    if (!email || !role) return null;
    return { email, role };
  } catch {
    return null;
  }
}
