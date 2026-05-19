var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, serverTimestamp, Timestamp, } from 'firebase/firestore';
import { randomBytes } from 'crypto';
import { db } from '@/lib/firebase';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateToken() {
    return randomBytes(48).toString('hex'); // 96 hex chars
}
function toIso(val) {
    if (!val)
        return null;
    if (val instanceof Timestamp)
        return val.toDate().toISOString();
    if (val instanceof Date)
        return val.toISOString();
    if (typeof val === 'string')
        return val;
    return null;
}
function normalizeUser(id, data) {
    var _a, _b, _c, _d, _e, _f;
    return {
        uid: id,
        email: String((_a = data.email) !== null && _a !== void 0 ? _a : '').toLowerCase().trim(),
        displayName: String((_b = data.displayName) !== null && _b !== void 0 ? _b : ''),
        role: (_c = data.role) !== null && _c !== void 0 ? _c : 'viewer',
        status: (_d = data.status) !== null && _d !== void 0 ? _d : 'active',
        source: (_e = data.source) !== null && _e !== void 0 ? _e : 'manual',
        emailVerifiedAt: toIso(data.emailVerifiedAt),
        createdAt: (_f = toIso(data.createdAt)) !== null && _f !== void 0 ? _f : new Date().toISOString(),
        lastLoginAt: toIso(data.lastLoginAt),
    };
}
function normalizeInvite(id, data) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        id,
        email: String((_a = data.email) !== null && _a !== void 0 ? _a : '').toLowerCase().trim(),
        role: (_b = data.role) !== null && _b !== void 0 ? _b : 'viewer',
        invitedBy: String((_c = data.invitedBy) !== null && _c !== void 0 ? _c : ''),
        invitedAt: (_d = toIso(data.invitedAt)) !== null && _d !== void 0 ? _d : new Date().toISOString(),
        expiresAt: (_e = toIso(data.expiresAt)) !== null && _e !== void 0 ? _e : new Date().toISOString(),
        status: (_f = data.status) !== null && _f !== void 0 ? _f : 'pending',
        token: String((_g = data.token) !== null && _g !== void 0 ? _g : ''),
    };
}
// ---------------------------------------------------------------------------
// getLoginAccount — used by /api/auth/login
// ---------------------------------------------------------------------------
export function getLoginAccount(email) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalized = email.toLowerCase().trim();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', normalized));
        const snap = yield getDocs(q);
        if (snap.empty)
            return null;
        const docSnap = snap.docs[0];
        return normalizeUser(docSnap.id, docSnap.data());
    });
}
// ---------------------------------------------------------------------------
// listUserAccounts — admin panel
// ---------------------------------------------------------------------------
export function listUserAccounts() {
    return __awaiter(this, void 0, void 0, function* () {
        const snap = yield getDocs(collection(db, 'users'));
        return snap.docs.map((d) => normalizeUser(d.id, d.data()));
    });
}
// ---------------------------------------------------------------------------
// markUserLogin — update lastLoginAt
// ---------------------------------------------------------------------------
export function markUserLogin(email) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalized = email.toLowerCase().trim();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', normalized));
        const snap = yield getDocs(q);
        if (snap.empty)
            return;
        yield updateDoc(snap.docs[0].ref, { lastLoginAt: serverTimestamp() });
    });
}
// ---------------------------------------------------------------------------
// inviteUserAccount — admin invites a new user
// ---------------------------------------------------------------------------
export function inviteUserAccount(_a) {
    return __awaiter(this, arguments, void 0, function* ({ email, role, invitedBy, }) {
        var _b;
        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedEmail || !normalizedEmail.includes('@')) {
            throw new Error('invalid_email');
        }
        const validRoles = ['admin', 'analyst', 'viewer'];
        if (!validRoles.includes(role)) {
            throw new Error('invalid_role');
        }
        // Check for existing user
        const usersRef = collection(db, 'users');
        const existingQ = query(usersRef, where('email', '==', normalizedEmail));
        const existingSnap = yield getDocs(existingQ);
        let userId;
        let userData;
        if (!existingSnap.empty) {
            // User already exists — re-invite only if pending
            const existing = normalizeUser(existingSnap.docs[0].id, existingSnap.docs[0].data());
            if (existing.status !== 'pending') {
                throw new Error('user_already_exists');
            }
            userId = existing.uid;
            userData = existing;
        }
        else {
            // Create new user doc
            userId = doc(usersRef).id;
            const newUserData = {
                uid: userId,
                email: normalizedEmail,
                displayName: (_b = normalizedEmail.split('@')[0]) !== null && _b !== void 0 ? _b : normalizedEmail,
                role,
                status: 'pending',
                source: 'invite',
                emailVerifiedAt: null,
                createdAt: serverTimestamp(),
                lastLoginAt: null,
                invitedBy,
            };
            yield setDoc(doc(db, 'users', userId), newUserData);
            userData = normalizeUser(userId, Object.assign(Object.assign({}, newUserData), { createdAt: new Date(), status: 'pending' }));
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
        yield setDoc(doc(db, 'invites', inviteId), inviteData);
        const invite = normalizeInvite(inviteId, Object.assign(Object.assign({}, inviteData), { invitedAt: new Date(), expiresAt }));
        return { user: userData, invite };
    });
}
// ---------------------------------------------------------------------------
// getInviteForEmailVerification — used by /api/invite/verify GET
// ---------------------------------------------------------------------------
export function getInviteForEmailVerification(token) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!token)
            return null;
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('token', '==', token));
        const snap = yield getDocs(q);
        if (snap.empty)
            return null;
        const inviteDoc = snap.docs[0];
        const invite = normalizeInvite(inviteDoc.id, inviteDoc.data());
        // Auto-expire check
        if (invite.status === 'pending' && new Date(invite.expiresAt) < new Date()) {
            yield updateDoc(inviteDoc.ref, { status: 'expired' });
            return Object.assign(Object.assign({}, invite), { status: 'expired' });
        }
        if (invite.status === 'verified') {
            throw new Error('invite_already_verified');
        }
        return invite;
    });
}
// ---------------------------------------------------------------------------
// verifyInviteEmail — used by /api/invite/verify POST
// ---------------------------------------------------------------------------
export function verifyInviteEmail(_a) {
    return __awaiter(this, arguments, void 0, function* ({ token, }) {
        if (!token)
            throw new Error('invalid_invite_token');
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('token', '==', token));
        const snap = yield getDocs(q);
        if (snap.empty)
            throw new Error('invite_not_found');
        const inviteDoc = snap.docs[0];
        const invite = normalizeInvite(inviteDoc.id, inviteDoc.data());
        if (invite.status === 'verified') {
            throw new Error('invite_already_verified');
        }
        if (invite.status === 'expired' || new Date(invite.expiresAt) < new Date()) {
            yield updateDoc(inviteDoc.ref, { status: 'expired' });
            throw new Error('invite_expired');
        }
        if (invite.status === 'revoked') {
            throw new Error('invite_revoked');
        }
        const now = serverTimestamp();
        // Mark invite as verified
        yield updateDoc(inviteDoc.ref, { status: 'verified', verifiedAt: now });
        // Activate user
        const userQ = query(collection(db, 'users'), where('email', '==', invite.email));
        const userSnap = yield getDocs(userQ);
        let user;
        if (!userSnap.empty) {
            yield updateDoc(userSnap.docs[0].ref, {
                status: 'active',
                emailVerifiedAt: now,
            });
            user = normalizeUser(userSnap.docs[0].id, Object.assign(Object.assign({}, userSnap.docs[0].data()), { status: 'active', emailVerifiedAt: new Date().toISOString() }));
        }
        else {
            throw new Error('invite_user_not_found');
        }
        return { user, invite: Object.assign(Object.assign({}, invite), { status: 'verified' }) };
    });
}
// ---------------------------------------------------------------------------
// revokeInviteById
// ---------------------------------------------------------------------------
export function revokeInviteById(inviteId) {
    return __awaiter(this, void 0, void 0, function* () {
        const inviteRef = doc(db, 'invites', inviteId);
        const snap = yield getDoc(inviteRef);
        if (!snap.exists())
            return;
        yield updateDoc(inviteRef, { status: 'revoked', revokedAt: serverTimestamp() });
    });
}
// ---------------------------------------------------------------------------
// bootstrapAdminAccount — auto-provisions the very first Google sign-in as
// admin when the users collection is completely empty (dev / first setup).
// ---------------------------------------------------------------------------
export function bootstrapAdminAccount(_a) {
    return __awaiter(this, arguments, void 0, function* ({ uid, email, displayName, }) {
        var _b;
        const normalizedEmail = email.toLowerCase().trim();
        const userId = uid || doc(collection(db, 'users')).id;
        const name = (_b = displayName !== null && displayName !== void 0 ? displayName : normalizedEmail.split('@')[0]) !== null && _b !== void 0 ? _b : normalizedEmail;
        const userData = {
            uid: userId,
            email: normalizedEmail,
            displayName: name,
            role: 'admin',
            status: 'active',
            source: 'manual',
            emailVerifiedAt: new Date().toISOString(),
            createdAt: serverTimestamp(),
            lastLoginAt: null,
            invitedBy: null,
            bootstrapped: true,
        };
        yield setDoc(doc(db, 'users', userId), userData, { merge: true });
        return normalizeUser(userId, Object.assign(Object.assign({}, userData), { createdAt: new Date() }));
    });
}
