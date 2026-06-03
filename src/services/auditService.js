import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_PAGE_SIZE } from '@/utils/constants';

/**
 * Get audit logs with pagination and filters.
 */
export async function getAuditLogs({ pageSize = DEFAULT_PAGE_SIZE, lastDoc = null, filters = {} } = {}) {
  const constraints = [
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  if (filters.module) {
    constraints.unshift(where('module', '==', filters.module));
  }

  if (filters.action) {
    constraints.unshift(where('action', '==', filters.action));
  }

  if (filters.userId) {
    constraints.unshift(where('userId', '==', filters.userId));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), ...constraints);
  const snapshot = await getDocs(q);
  const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return { logs, lastVisible, hasMore: snapshot.docs.length === pageSize };
}
