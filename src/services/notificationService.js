import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_PAGE_SIZE } from '@/utils/constants';

/**
 * Get notifications for a user with pagination.
 */
export async function getNotifications(userId, { pageSize = DEFAULT_PAGE_SIZE, lastDoc = null } = {}) {
  const constraints = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, COLLECTIONS.NOTIFICATIONS), ...constraints);
  const snapshot = await getDocs(q);
  const notifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return { notifications, lastVisible, hasMore: snapshot.docs.length === pageSize };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId) {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('isRead', '==', false)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Subscribe to real-time notifications for a user.
 */
export function subscribeToNotifications(userId, callback) {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('isRead', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(notifications);
  });
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId) {
  await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
    isRead: true,
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId) {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('isRead', '==', false)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.update(d.ref, { isRead: true });
  });
  await batch.commit();
}

/**
 * Create a notification.
 */
export async function createNotification({ userId, title, message, type = 'info', module = '', referenceId = null }) {
  await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
    userId,
    title,
    message,
    type,
    module,
    referenceId,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Create notifications for multiple users.
 */
export async function createBulkNotifications(userIds, { title, message, type = 'info', module = '', referenceId = null }) {
  const batch = writeBatch(db);

  userIds.forEach((userId) => {
    const docRef = doc(collection(db, COLLECTIONS.NOTIFICATIONS));
    batch.set(docRef, {
      userId,
      title,
      message,
      type,
      module,
      referenceId,
      isRead: false,
      createdAt: new Date(),
    });
  });

  await batch.commit();
}
