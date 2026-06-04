import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_PAGE_SIZE, VOUCHER_STATUS, AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';
import { logAudit } from '@/utils/auditLogger';
import { sanitizeObject } from '@/utils/sanitize';

/**
 * Redeem a voucher atomically.
 */
export async function redeemVoucher(voucherId, redeemData, currentUser) {
  const voucherRef = doc(db, COLLECTIONS.VOUCHERS, voucherId);

  return runTransaction(db, async (transaction) => {
    const voucherDoc = await transaction.get(voucherRef);

    if (!voucherDoc.exists()) {
      throw new Error('Voucher not found');
    }

    const voucher = voucherDoc.data();

    // Validate voucher status
    if (voucher.status !== VOUCHER_STATUS.ACTIVE) {
      throw new Error(`Cannot redeem: voucher status is ${voucher.status}`);
    }

    if (voucher.remainingUsage <= 0) {
      throw new Error('Voucher has been fully used');
    }

    // Check expiration
    const expiredDate = voucher.expiredDate?.toDate ? voucher.expiredDate.toDate() : new Date(voucher.expiredDate);
    if (expiredDate < new Date()) {
      transaction.update(voucherRef, { status: VOUCHER_STATUS.EXPIRED });
      throw new Error('Voucher has expired');
    }

    // Check min purchase
    if (voucher.minPurchase > 0 && Number(redeemData.purchaseAmount) < voucher.minPurchase) {
      throw new Error(`Minimum purchase amount is ${voucher.minPurchase}`);
    }

    // Calculate discount
    let discountApplied = 0;
    if (voucher.discountType === 'percentage') {
      discountApplied = (Number(redeemData.purchaseAmount) * voucher.value) / 100;
      if (voucher.maxDiscount > 0 && discountApplied > voucher.maxDiscount) {
        discountApplied = voucher.maxDiscount;
      }
    } else {
      discountApplied = voucher.value;
    }

    const newRemainingUsage = voucher.remainingUsage - 1;
    const newStatus = newRemainingUsage <= 0 ? VOUCHER_STATUS.USED : VOUCHER_STATUS.ACTIVE;

    // Update voucher
    transaction.update(voucherRef, {
      remainingUsage: increment(-1),
      status: newStatus,
      updatedAt: new Date(),
    });

    // Create redeem record
    const sanitized = sanitizeObject(redeemData);
    const redeemRecord = {
      voucherId,
      voucherCode: voucher.code,
      campaignId: voucher.campaignId,
      campaignName: voucher.campaignName,
      customerName: sanitized.customerName,
      transactionNumber: sanitized.transactionNumber,
      purchaseAmount: Number(redeemData.purchaseAmount),
      discountApplied,
      redeemedBy: currentUser.uid,
      redeemedByName: currentUser.displayName,
      redeemedByEmail: currentUser.email,
      notes: sanitized.notes || '',
      redeemedAt: new Date(),
    };

    // We can't addDoc inside a transaction, so we'll do it after
    return { redeemRecord, discountApplied, newStatus };
  }).then(async ({ redeemRecord, discountApplied, newStatus }) => {
    // Create redeem doc outside transaction
    const redeemRef = await addDoc(collection(db, COLLECTIONS.REDEEMS), {
      ...redeemRecord,
      redeemedAt: serverTimestamp(),
    });

    await logAudit({
      user: currentUser,
      action: AUDIT_ACTIONS.REDEEM,
      module: AUDIT_MODULES.REDEEM,
      metadata: {
        voucherId,
        voucherCode: redeemRecord.voucherCode,
        redeemId: redeemRef.id,
        discountApplied,
        purchaseAmount: redeemRecord.purchaseAmount,
      },
    });

    return { id: redeemRef.id, ...redeemRecord, discountApplied };
  });
}

/**
 * Get redeem history with pagination.
 */
export async function getRedeems({ pageSize = DEFAULT_PAGE_SIZE, lastDoc = null, filters = {} } = {}) {
  const constraints = [
    orderBy('redeemedAt', 'desc'),
    limit(pageSize),
  ];

  if (filters.voucherId) {
    constraints.unshift(where('voucherId', '==', filters.voucherId));
  }

  if (filters.campaignId) {
    constraints.unshift(where('campaignId', '==', filters.campaignId));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, COLLECTIONS.REDEEMS), ...constraints);
  const snapshot = await getDocs(q);
  const redeems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return { redeems, lastVisible, hasMore: snapshot.docs.length === pageSize };
}
