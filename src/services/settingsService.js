import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/utils/constants';

const SETTINGS_DOC_ID = 'general';

export async function getSettings() {
  const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

export async function initializeSettings(data) {
  await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), {
    companyName: data.companyName || 'Glory8',
    companyLogo: data.companyLogo || null,
    voucherPrefix: data.voucherPrefix || 'GL8',
    lastVoucherSequence: 0,
    isBootstrapped: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSettings(data) {
  await updateDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function checkIsBootstrapped() {
  const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID));
  if (!snap.exists()) return false;
  return snap.data().isBootstrapped === true;
}
