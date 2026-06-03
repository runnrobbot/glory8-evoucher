import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from './constants';

/**
 * Log an audit event to Firestore.
 * @param {Object} params
 * @param {Object} params.user - Current user object { uid, displayName, email, role, divisionId, divisionName }
 * @param {string} params.action - Action performed (from AUDIT_ACTIONS)
 * @param {string} params.module - Module where action occurred (from AUDIT_MODULES)
 * @param {Object} params.metadata - Additional data about the action
 */
export async function logAudit({ user, action, module, metadata = {} }) {
  try {
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      userId: user?.uid || 'system',
      userName: user?.displayName || 'System',
      userEmail: user?.email || '',
      userRole: user?.role || '',
      divisionId: user?.divisionId || '',
      divisionName: user?.divisionName || '',
      action,
      module,
      metadata,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
