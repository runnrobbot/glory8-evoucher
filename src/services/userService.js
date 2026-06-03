import { db, auth, secondaryAuth } from '@/lib/firebase';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { COLLECTIONS, ROLES, DEFAULT_PAGE_SIZE, AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';
import { logAudit } from '@/utils/auditLogger';
import { sanitizeObject } from '@/utils/sanitize';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Create the very first Super Admin account.
 * Called ONLY from /setup before any user exists.
 * Uses the primary auth — it's fine here because there's no session to preserve.
 */
export async function bootstrapSuperAdmin({ email, password, displayName }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  const userData = {
    email,
    displayName: sanitizeObject({ displayName }).displayName,
    role: ROLES.SUPER_ADMIN,
    divisionId: '',
    divisionName: '',
    avatarUrl: null,
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), userData);
  return { uid: cred.user.uid, ...userData };
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Sign in a user and return their profile.
 * Throws a user-friendly error if the account is inactive or missing.
 */
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, cred.user.uid));

  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error('User profile not found. Contact your administrator.');
  }

  const profile = userSnap.data();

  if (profile.isDeleted || !profile.isActive) {
    await signOut(auth);
    throw new Error('Account is deactivated. Contact your administrator.');
  }

  await updateDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), {
    lastLoginAt: serverTimestamp(),
  });

  await logAudit({
    user: { uid: cred.user.uid, ...profile },
    action: AUDIT_ACTIONS.LOGIN,
    module: AUDIT_MODULES.AUTH,
    metadata: { email },
  });

  return { uid: cred.user.uid, ...profile };
}

/**
 * Sign out the current user.
 */
export async function logoutUser(currentUser) {
  if (currentUser) {
    await logAudit({
      user: currentUser,
      action: AUDIT_ACTIONS.LOGOUT,
      module: AUDIT_MODULES.AUTH,
      metadata: {},
    });
  }
  await signOut(auth);
}

/**
 * Send a password-reset email.
 */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new user WITHOUT disrupting the current admin session.
 *
 * Problem: Firebase client SDK's createUserWithEmailAndPassword() automatically
 * signs in as the newly created user, replacing the admin's session. The Firestore
 * write that follows then uses the new (unprivileged) token → permission denied.
 *
 * Solution: Use the `secondaryAuth` instance (a separate Firebase App) so the
 * new user is created in an isolated context. The primary admin session remains
 * intact and the Firestore write succeeds with the admin's token.
 */
export async function createUser(data, currentUser) {
  const { email, password, displayName, role, divisionId, divisionName } = data;

  // 1. Create the Firebase Auth account on the secondary (isolated) app.
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

  // 2. Sign out from secondary app immediately — we don't need that session.
  await signOut(secondaryAuth);

  // 3. Write the Firestore profile using the PRIMARY admin session token.
  const userData = {
    email,
    displayName: sanitizeObject({ displayName }).displayName,
    role,
    divisionId: divisionId || '',
    divisionName: divisionName || '',
    avatarUrl: null,
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: null,
  };

  await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), userData);

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.CREATE,
    module: AUDIT_MODULES.USER,
    metadata: { createdUserId: cred.user.uid, email, role },
  });

  return { uid: cred.user.uid, ...userData };
}

/**
 * Get a paginated, optionally filtered list of users.
 */
export async function getUsers({ pageSize = DEFAULT_PAGE_SIZE, lastDoc = null, filters = {} } = {}) {
  const constraints = [
    where('isDeleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  if (filters.role) constraints.splice(1, 0, where('role', '==', filters.role));
  if (filters.divisionId) constraints.splice(1, 0, where('divisionId', '==', filters.divisionId));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const q = query(collection(db, COLLECTIONS.USERS), ...constraints);
  const snapshot = await getDocs(q);

  return {
    users: snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })),
    lastVisible: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

/**
 * Get a single user by UID.
 */
export async function getUserById(uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

/**
 * Update a user's profile fields.
 */
export async function updateUser(uid, data, currentUser) {
  const sanitized = sanitizeObject(data);
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.USER,
    metadata: { updatedUserId: uid, changes: Object.keys(data) },
  });
}

/**
 * Soft-delete (deactivate) a user.
 */
export async function deleteUser(uid, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    isDeleted: true,
    isActive: false,
    deletedAt: serverTimestamp(),
    deletedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.DELETE,
    module: AUDIT_MODULES.USER,
    metadata: { deletedUserId: uid },
  });
}

/**
 * Restore a soft-deleted user.
 */
export async function restoreUser(uid, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    isDeleted: false,
    isActive: true,
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.RESTORE,
    module: AUDIT_MODULES.USER,
    metadata: { restoredUserId: uid },
  });
}
