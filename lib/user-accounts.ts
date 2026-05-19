import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { randomBytes } from 'crypto';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'pending' | 'disabled';
  source: 'invite' | 'manual';
  emailVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'verified' | 'expired' | 'revoked';
  token: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  return randomBytes(48).toString('hex'); // 96 hex chars
}

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return null;
}

function normalizeUser(id: string, data: Record<string, unknown>): UserAccount {
  return {
    uid: id,
    email: String(data.email ?? '').toLowerCase().trim(),
    displayName: String(data.displayName ?? ''),
    role: (data.role as UserRole) ?? 'viewer',
    status: (data.status as UserAccount['status']) ?? 'active',
    source: (data.source as UserAccount['source']) ?? 'manual',
    emailVerifiedAt: toIso(data.emailVerifiedAt),
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
    lastLoginAt: toIso(data.lastLoginAt),
  };
}

function normalizeInvite(id: string, data: Record<string, unknown>): InviteRecord {
  return {
    id,
    email: String(data.email ?? '').toLowerCase().trim(),
    role: (data.role as UserRole) ?? 'viewer',
    invitedBy: String(data.invitedBy ?? ''),
    invitedAt: toIso(data.invitedAt) ?? new Date().toISOString(),
    expiresAt: toIso(data.expiresAt) ?? new Date().toISOString(),
    status: (data.status as InviteRecord['status']) ?? 'pending',
    token: String(data.token ?? ''),
  };
}

// ---------------------------------------------------------------------------
// getLoginAccount — used by /api/auth/login
// ---------------------------------------------------------------------------

export async function getLoginAccount(email: string): Promise<UserAccount | null> {
  const normalized = email.toLowerCase().trim();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return normalizeUser(docSnap.id, docSnap.data() as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// listUserAccounts — admin panel
// ---------------------------------------------------------------------------

export async function listUserAccounts(): Promise<UserAccount[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => normalizeUser(d.id, d.data() as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// markUserLogin — update lastLoginAt
// ---------------------------------------------------------------------------

export async function markUserLogin(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', normalized));
  const snap = await getDocs(q);
  if (snap.empty) return;
  await updateDoc(snap.docs[0].ref, { lastLoginAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// inviteUserAccount — admin invites a new user
// ---------------------------------------------------------------------------

export async function inviteUserAccount({
  email,
  role,
  invitedBy,
}: {
  email: string;
  role: UserRole;
  invitedBy: string;
}): Promise<{ user: UserAccount; invite: InviteRecord }> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('invalid_email');
  }

  const validRoles: UserRole[] = ['admin', 'analyst', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new Error('invalid_role');
  }

  // Check for existing user
  const usersRef = collection(db, 'users');
  const existingQ = query(usersRef, where('email', '==', normalizedEmail));
  const existingSnap = await getDocs(existingQ);

  let userId: string;
  let userData: UserAccount;

  if (!existingSnap.empty) {
    // User already exists — re-invite only if pending
    const existing = normalizeUser(existingSnap.docs[0].id, existingSnap.docs[0].data() as Record<string, unknown>);
    if (existing.status !== 'pending') {
      throw new Error('user_already_exists');
    }
    userId = existing.uid;
    userData = existing;
  } else {
    // Create new user doc
    userId = doc(usersRef).id;
    const newUserData = {
      uid: userId,
      email: normalizedEmail,
      displayName: normalizedEmail.split('@')[0] ?? normalizedEmail,
      role,
      status: 'pending',
      source: 'invite',
      emailVerifiedAt: null,
      createdAt: serverTimestamp(),
      lastLoginAt: null,
      invitedBy,
    };
    await setDoc(doc(db, 'users', userId), newUserData);
    userData = normalizeUser(userId, { ...newUserData, createdAt: new Date(), status: 'pending' });
  }

  // Create invite doc
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const inviteId = doc(collection(db, 'invites')).id;
  const inviteData = {
    id: inviteId,
    email: normalizedEmail,
    userId,
    role,
    invitedBy,
    invitedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    status: 'pending',
    token,
  };
  await setDoc(doc(db, 'invites', inviteId), inviteData);
  const invite = normalizeInvite(inviteId, { ...inviteData, invitedAt: new Date(), expiresAt });

  return { user: userData, invite };
}

// ---------------------------------------------------------------------------
// getInviteForEmailVerification — used by /api/invite/verify GET
// ---------------------------------------------------------------------------

export async function getInviteForEmailVerification(token: string): Promise<InviteRecord | null> {
  if (!token) return null;
  const invitesRef = collection(db, 'invites');
  const q = query(invitesRef, where('token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const inviteDoc = snap.docs[0];
  const invite = normalizeInvite(inviteDoc.id, inviteDoc.data() as Record<string, unknown>);

  // Auto-expire check
  if (invite.status === 'pending' && new Date(invite.expiresAt) < new Date()) {
    await updateDoc(inviteDoc.ref, { status: 'expired' });
    return { ...invite, status: 'expired' };
  }

  if (invite.status === 'verified') {
    throw new Error('invite_already_verified');
  }

  return invite;
}

// ---------------------------------------------------------------------------
// verifyInviteEmail — used by /api/invite/verify POST
// ---------------------------------------------------------------------------

export async function verifyInviteEmail({
  token,
}: {
  token: string;
}): Promise<{ user: UserAccount; invite: InviteRecord }> {
  if (!token) throw new Error('invalid_invite_token');

  const invitesRef = collection(db, 'invites');
  const q = query(invitesRef, where('token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('invite_not_found');

  const inviteDoc = snap.docs[0];
  const invite = normalizeInvite(inviteDoc.id, inviteDoc.data() as Record<string, unknown>);

  if (invite.status === 'verified') {
    throw new Error('invite_already_verified');
  }
  if (invite.status === 'expired' || new Date(invite.expiresAt) < new Date()) {
    await updateDoc(inviteDoc.ref, { status: 'expired' });
    throw new Error('invite_expired');
  }
  if (invite.status === 'revoked') {
    throw new Error('invite_revoked');
  }

  const now = serverTimestamp();
  // Mark invite as verified
  await updateDoc(inviteDoc.ref, { status: 'verified', verifiedAt: now });

  // Activate user
  const userQ = query(collection(db, 'users'), where('email', '==', invite.email));
  const userSnap = await getDocs(userQ);
  let user: UserAccount;
  if (!userSnap.empty) {
    await updateDoc(userSnap.docs[0].ref, {
      status: 'active',
      emailVerifiedAt: now,
    });
    user = normalizeUser(userSnap.docs[0].id, {
      ...userSnap.docs[0].data(),
      status: 'active',
      emailVerifiedAt: new Date().toISOString(),
    } as Record<string, unknown>);
  } else {
    throw new Error('invite_user_not_found');
  }

  return { user, invite: { ...invite, status: 'verified' } };
}

// ---------------------------------------------------------------------------
// revokeInviteById
// ---------------------------------------------------------------------------

export async function revokeInviteById(inviteId: string): Promise<void> {
  const inviteRef = doc(db, 'invites', inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) return;
  await updateDoc(inviteRef, { status: 'revoked', revokedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// bootstrapAdminAccount — auto-provisions the very first Google sign-in as
// admin when the users collection is completely empty (dev / first setup).
// ---------------------------------------------------------------------------

export async function bootstrapAdminAccount({
  uid,
  email,
  displayName,
}: {
  uid: string;
  email: string;
  displayName?: string;
}): Promise<UserAccount> {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = uid || doc(collection(db, 'users')).id;
  const name = displayName ?? normalizedEmail.split('@')[0] ?? normalizedEmail;

  const userData = {
    uid: userId,
    email: normalizedEmail,
    displayName: name,
    role: 'admin' as UserRole,
    status: 'active',
    source: 'manual',
    emailVerifiedAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
    lastLoginAt: null,
    invitedBy: null,
    bootstrapped: true,
  };

  await setDoc(doc(db, 'users', userId), userData, { merge: true });

  return normalizeUser(userId, {
    ...userData,
    createdAt: new Date(),
  });
}

