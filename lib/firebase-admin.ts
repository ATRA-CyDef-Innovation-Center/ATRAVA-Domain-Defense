import * as admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  providerIds: string[];
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK — singleton initializer
// Returns null if credentials are not configured / are placeholders.
// ---------------------------------------------------------------------------

const PLACEHOLDER_MARKERS = [
  'REPLACE_WITH',
  'your-service-account',
  'YOUR_',
  '-----BEGIN RSA',  // bare placeholder text (not real key)
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) =>
    value.toUpperCase().includes(marker.toUpperCase())
  );
}

function tryGetAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? '';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '';
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';

  // If any credential is missing or is a placeholder, skip Admin SDK
  if (
    !projectId ||
    !clientEmail ||
    !rawPrivateKey ||
    isPlaceholder(clientEmail) ||
    isPlaceholder(rawPrivateKey)
  ) {
    return null;
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Strategy 1: Firebase Admin SDK (preferred, requires service account)
// ---------------------------------------------------------------------------

async function verifyViaAdminSdk(
  idToken: string,
  app: admin.app.App
): Promise<FirebaseIdentity> {
  const decoded = await admin.auth(app).verifyIdToken(idToken);

  if (!decoded.email) throw new Error('firebase_user_missing_email');

  const identities = decoded.firebase?.identities as Record<string, unknown> | undefined;
  const providerIds = Object.keys(identities ?? {});

  return {
    uid: decoded.uid,
    email: decoded.email.toLowerCase().trim(),
    emailVerified: decoded.email_verified ?? false,
    providerIds,
    displayName: decoded.name,
  };
}

// ---------------------------------------------------------------------------
// Strategy 2: Firebase REST API (fallback — no service account required)
// Uses the client-side API key to call accounts:lookup, which validates
// the idToken on Firebase's servers without a service account.
// ---------------------------------------------------------------------------

interface FirebaseAccountsLookupResponse {
  kind?: string;
  users?: Array<{
    localId?: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
    providerUserInfo?: Array<{ providerId?: string }>;
  }>;
  error?: { message?: string; code?: number };
}

async function verifyViaRestApi(idToken: string): Promise<FirebaseIdentity> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';
  if (!apiKey) throw new Error('firebase_api_key_not_configured');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  const payload: FirebaseAccountsLookupResponse = await res.json().catch(() => ({}));

  if (!res.ok || payload.error) {
    const code = String(payload.error?.message ?? '').toUpperCase();
    if (code.includes('INVALID_ID_TOKEN') || code.includes('TOKEN_EXPIRED')) {
      throw new Error('invalid_id_token');
    }
    throw new Error('identity_lookup_failed');
  }

  const user = payload.users?.[0];
  if (!user?.localId) throw new Error('identity_lookup_failed');
  if (!user.email) throw new Error('firebase_user_missing_email');

  const providerIds = (user.providerUserInfo ?? [])
    .map((p) => p.providerId ?? '')
    .filter(Boolean);

  return {
    uid: user.localId,
    email: user.email.toLowerCase().trim(),
    emailVerified: user.emailVerified ?? false,
    providerIds,
    displayName: user.displayName,
  };
}

// ---------------------------------------------------------------------------
// Public: verifyFirebaseIdToken
// Tries Admin SDK first; falls back to REST API if Admin is not configured.
// ---------------------------------------------------------------------------

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  if (!idToken) throw new Error('missing_id_token');

  const adminApp = tryGetAdminApp();

  if (adminApp) {
    try {
      return await verifyViaAdminSdk(idToken, adminApp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // Surface known errors directly
      if (
        msg === 'firebase_user_missing_email' ||
        msg === 'invalid_id_token' ||
        msg === 'firebase_api_key_not_configured'
      ) {
        throw err;
      }
      // For other Admin SDK failures, fall through to REST API fallback
      console.warn('[firebase-admin] Admin SDK verification failed, falling back to REST API:', msg);
    }
  }

  // Fallback: REST API verification (works without service account)
  return verifyViaRestApi(idToken);
}
