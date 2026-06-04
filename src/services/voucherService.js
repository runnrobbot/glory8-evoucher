import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_PAGE_SIZE, VOUCHER_STATUS, AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';
import { logAudit } from '@/utils/auditLogger';
import { sanitizeObject } from '@/utils/sanitize';

/**
 * Get the next voucher sequence number atomically.
 */
async function getNextSequence(count = 1) {
  const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'general');

  return runTransaction(db, async (transaction) => {
    const settingsDoc = await transaction.get(settingsRef);
    const currentSeq = settingsDoc.exists() ? (settingsDoc.data().lastVoucherSequence || 0) : 0;
    const nextSeq = currentSeq + count;

    transaction.update(settingsRef, { lastVoucherSequence: nextSeq });

    return currentSeq + 1; // Return the first sequence number
  });
}

/**
 * Generate a voucher code.
 */
function generateVoucherCode(prefix, year, sequence) {
  const seqStr = String(sequence).padStart(6, '0');
  return `${prefix}-${year}-${seqStr}`;
}

/**
 * Get vouchers with pagination and filters.
 *
 * IMPORTANT: Firestore requires equality `where` clauses to come BEFORE
 * `orderBy` on a different field. Do NOT use splice() to insert mid-array.
 * Build constraints in order: equalities → orderBy → limit → startAfter.
 */
export async function getVouchers({ pageSize = DEFAULT_PAGE_SIZE, lastDoc = null, filters = {} } = {}) {
  const constraints = [where('isDeleted', '==', false)];

  // Equality filters MUST come before orderBy
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.campaignId) {
    constraints.push(where('campaignId', '==', filters.campaignId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, COLLECTIONS.VOUCHERS), ...constraints);
  const snapshot = await getDocs(q);
  const vouchers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return { vouchers, lastVisible, hasMore: snapshot.docs.length === pageSize };
}

/**
 * Get a voucher by code.
 */
export async function getVoucherByCode(code) {
  const q = query(
    collection(db, COLLECTIONS.VOUCHERS),
    where('code', '==', code.toUpperCase().trim()),
    where('isDeleted', '==', false),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Create a single voucher.
 */
export async function createVoucher(data, currentUser) {
  const sanitized = sanitizeObject(data);
  const year = new Date().getFullYear();
  const settingsDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'general'));
  const prefix = settingsDoc.exists() ? (settingsDoc.data().voucherPrefix || 'GL8') : 'GL8';

  const startSeq = await getNextSequence(1);
  const code = generateVoucherCode(prefix, year, startSeq);

  const voucherData = {
    name: sanitized.name,
    code,
    campaignId: data.campaignId,
    campaignName: data.campaignName || '',
    description: sanitized.description || '',
    value: Number(data.value),
    discountType: data.discountType,
    terms: sanitized.terms || '',
    startDate: new Date(data.startDate),
    expiredDate: new Date(data.expiredDate),
    usageLimit: Number(data.usageLimit),
    remainingUsage: Number(data.usageLimit),
    minPurchase: Number(data.minPurchase) || 0,
    maxDiscount: Number(data.maxDiscount) || 0,
    backgroundUrl: data.backgroundUrl || null,
    bgPositionX: data.bgPositionX ?? 50,
    bgPositionY: data.bgPositionY ?? 50,
    logoUrl: data.logoUrl || null,
    status: VOUCHER_STATUS.DRAFT,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdBy: currentUser.uid,
    createdByName: currentUser.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.VOUCHERS), voucherData);

  // Increment campaign voucher count
  if (data.campaignId) {
    await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, data.campaignId), {
      voucherCount: increment(1),
    });
  }

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.CREATE,
    module: AUDIT_MODULES.VOUCHER,
    metadata: { voucherId: docRef.id, code },
  });

  return { id: docRef.id, ...voucherData };
}

/**
 * Bulk generate vouchers.
 */
export async function bulkGenerateVouchers(data, quantity, currentUser) {
  const sanitized = sanitizeObject(data);
  const year = new Date().getFullYear();
  const settingsDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'general'));
  const prefix = settingsDoc.exists() ? (settingsDoc.data().voucherPrefix || 'GL8') : 'GL8';

  const startSeq = await getNextSequence(quantity);
  const vouchers = [];

  // Process in batches of 500 (Firestore limit)
  const batchSize = 400; // Leave room for counter updates
  const totalBatches = Math.ceil(quantity / batchSize);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batch = writeBatch(db);
    const batchStart = batchIdx * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, quantity);

    for (let i = batchStart; i < batchEnd; i++) {
      const seq = startSeq + i;
      const code = generateVoucherCode(prefix, year, seq);

      const voucherData = {
        name: `${sanitized.name} #${seq}`,
        code,
        campaignId: data.campaignId,
        campaignName: data.campaignName || '',
        description: sanitized.description || '',
        value: Number(data.value),
        discountType: data.discountType,
        terms: sanitized.terms || '',
        startDate: new Date(data.startDate),
        expiredDate: new Date(data.expiredDate),
        usageLimit: Number(data.usageLimit),
        remainingUsage: Number(data.usageLimit),
        minPurchase: Number(data.minPurchase) || 0,
        maxDiscount: Number(data.maxDiscount) || 0,
        backgroundUrl: data.backgroundUrl || null,
        bgPositionX: data.bgPositionX ?? 50,
        bgPositionY: data.bgPositionY ?? 50,
        logoUrl: null,
        status: VOUCHER_STATUS.ACTIVE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      const docRef = doc(collection(db, COLLECTIONS.VOUCHERS));
      batch.set(docRef, voucherData);
      vouchers.push({ id: docRef.id, ...voucherData });
    }

    await batch.commit();
  }

  // Update campaign voucher count
  if (data.campaignId) {
    await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, data.campaignId), {
      voucherCount: increment(quantity),
    });
  }

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.GENERATE,
    module: AUDIT_MODULES.VOUCHER,
    metadata: {
      quantity,
      campaignId: data.campaignId,
      firstCode: vouchers[0]?.code,
      lastCode: vouchers[vouchers.length - 1]?.code,
    },
  });

  return vouchers;
}

/**
 * Update a voucher.
 */
export async function updateVoucher(id, data, currentUser) {
  const updateData = { ...data, updatedAt: serverTimestamp() };

  if (data.startDate && typeof data.startDate === 'string') {
    updateData.startDate = new Date(data.startDate);
  }
  if (data.expiredDate && typeof data.expiredDate === 'string') {
    updateData.expiredDate = new Date(data.expiredDate);
  }

  if (updateData.name) updateData.name = sanitizeObject({ name: updateData.name }).name;
  if (updateData.description) updateData.description = sanitizeObject({ description: updateData.description }).description;
  if (updateData.terms) updateData.terms = sanitizeObject({ terms: updateData.terms }).terms;

  await updateDoc(doc(db, COLLECTIONS.VOUCHERS, id), updateData);

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.VOUCHER,
    metadata: { voucherId: id, changes: Object.keys(data) },
  });
}

/**
 * Soft delete a voucher.
 */
export async function deleteVoucher(id, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.VOUCHERS, id), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.DELETE,
    module: AUDIT_MODULES.VOUCHER,
    metadata: { voucherId: id },
  });
}

/**
 * Validate a voucher code.
 */
export async function validateVoucher(code) {
  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    return { valid: false, result: 'invalid', message: 'Voucher not found' };
  }

  if (voucher.status === VOUCHER_STATUS.EXPIRED) {
    return { valid: false, result: 'expired', message: 'Voucher has expired', voucher };
  }

  if (voucher.status === VOUCHER_STATUS.SUSPENDED) {
    return { valid: false, result: 'suspended', message: 'Voucher is suspended', voucher };
  }

  if (voucher.status === VOUCHER_STATUS.USED || voucher.remainingUsage <= 0) {
    return { valid: false, result: 'used', message: 'Voucher has been fully used', voucher };
  }

  if (voucher.status !== VOUCHER_STATUS.ACTIVE) {
    return { valid: false, result: 'invalid', message: `Voucher status: ${voucher.status}`, voucher };
  }

  // Check expiration date
  const expiredDate = voucher.expiredDate?.toDate ? voucher.expiredDate.toDate() : new Date(voucher.expiredDate);
  if (expiredDate < new Date()) {
    // Auto-update status
    await updateDoc(doc(db, COLLECTIONS.VOUCHERS, voucher.id), {
      status: VOUCHER_STATUS.EXPIRED,
      updatedAt: serverTimestamp(),
    });
    return { valid: false, result: 'expired', message: 'Voucher has expired', voucher };
  }

  // Check campaign status
  if (voucher.campaignId) {
    const campaign = await getDoc(doc(db, COLLECTIONS.CAMPAIGNS, voucher.campaignId));
    if (campaign.exists()) {
      const campaignData = campaign.data();
      if (campaignData.status !== 'active') {
        return { valid: false, result: 'campaign_inactive', message: 'Campaign is not active', voucher };
      }
    }
  }

  return { valid: true, result: 'valid', message: 'Voucher is valid', voucher };
}
