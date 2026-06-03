import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS, AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';
import { logAudit } from '@/utils/auditLogger';
import { sanitizeObject } from '@/utils/sanitize';

/**
 * Get all divisions.
 */
export async function getDivisions() {
  const q = query(collection(db, COLLECTIONS.DIVISIONS), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single division by ID.
 */
export async function getDivisionById(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.DIVISIONS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Create a new division.
 */
export async function createDivision(data, currentUser) {
  const sanitized = sanitizeObject(data);
  const docRef = await addDoc(collection(db, COLLECTIONS.DIVISIONS), {
    name: sanitized.name,
    description: sanitized.description || '',
    createdBy: currentUser.uid,
    createdByName: currentUser.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.CREATE,
    module: AUDIT_MODULES.DIVISION,
    metadata: { divisionId: docRef.id, name: sanitized.name },
  });

  return docRef.id;
}

/**
 * Update a division.
 */
export async function updateDivision(id, data, currentUser) {
  const sanitized = sanitizeObject(data);
  await updateDoc(doc(db, COLLECTIONS.DIVISIONS, id), {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.DIVISION,
    metadata: { divisionId: id, changes: Object.keys(data) },
  });
}

/**
 * Delete a division (hard delete since divisions are simple reference data).
 */
export async function deleteDivision(id, currentUser) {
  // Note: We don't hard-delete. We could add isDeleted to divisions too,
  // but for simplicity and since divisions rarely change, we just log it.
  const { deleteDoc: firestoreDelete } = await import('firebase/firestore');
  await firestoreDelete(doc(db, COLLECTIONS.DIVISIONS, id));

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.DELETE,
    module: AUDIT_MODULES.DIVISION,
    metadata: { divisionId: id },
  });
}
