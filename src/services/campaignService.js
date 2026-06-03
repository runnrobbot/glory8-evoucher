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
} from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_PAGE_SIZE, CAMPAIGN_STATUS, AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';
import { logAudit } from '@/utils/auditLogger';
import { sanitizeObject } from '@/utils/sanitize';

/**
 * Get campaigns with pagination and filters.
 */
export async function getCampaigns({ pageSize = DEFAULT_PAGE_SIZE, lastDoc = null, filters = {} } = {}) {
  const constraints = [
    where('isDeleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  if (filters.status) {
    constraints.splice(1, 0, where('status', '==', filters.status));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, COLLECTIONS.CAMPAIGNS), ...constraints);
  const snapshot = await getDocs(q);
  const campaigns = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return { campaigns, lastVisible, hasMore: snapshot.docs.length === pageSize };
}

/**
 * Get all campaigns available for dropdowns (voucher form, bulk generate).
 * Includes ACTIVE and PENDING_APPROVAL campaigns — draft campaigns are also
 * included so admins can pre-generate vouchers before a campaign goes live.
 * Excludes soft-deleted campaigns only.
 */
export async function getActiveCampaigns() {
  const q = query(
    collection(db, COLLECTIONS.CAMPAIGNS),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single campaign by ID.
 */
export async function getCampaignById(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.CAMPAIGNS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Create a new campaign.
 */
export async function createCampaign(data, currentUser) {
  const sanitized = sanitizeObject(data);
  const docRef = await addDoc(collection(db, COLLECTIONS.CAMPAIGNS), {
    name: sanitized.name,
    code: sanitized.code.toUpperCase(),
    description: sanitized.description || '',
    bannerUrl: data.bannerUrl || null,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    status: data.status || CAMPAIGN_STATUS.DRAFT,
    approvedBy: null,
    approvedAt: null,
    createdBy: currentUser.uid,
    createdByName: currentUser.displayName,
    divisionId: currentUser.divisionId || '',
    divisionName: currentUser.divisionName || '',
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    voucherCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.CREATE,
    module: AUDIT_MODULES.CAMPAIGN,
    metadata: { campaignId: docRef.id, name: sanitized.name, code: sanitized.code },
  });

  return docRef.id;
}

/**
 * Update a campaign.
 */
export async function updateCampaign(id, data, currentUser) {
  const updateData = { ...data, updatedAt: serverTimestamp() };

  if (data.startDate && typeof data.startDate === 'string') {
    updateData.startDate = new Date(data.startDate);
  }
  if (data.endDate && typeof data.endDate === 'string') {
    updateData.endDate = new Date(data.endDate);
  }

  // Sanitize text fields
  if (updateData.name) updateData.name = sanitizeObject({ name: updateData.name }).name;
  if (updateData.description) updateData.description = sanitizeObject({ description: updateData.description }).description;

  await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, id), updateData);

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.CAMPAIGN,
    metadata: { campaignId: id, changes: Object.keys(data) },
  });
}

/**
 * Approve a campaign.
 */
export async function approveCampaign(id, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, id), {
    status: CAMPAIGN_STATUS.ACTIVE,
    approvedBy: currentUser.uid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.APPROVE,
    module: AUDIT_MODULES.CAMPAIGN,
    metadata: { campaignId: id },
  });
}

/**
 * Suspend a campaign.
 */
export async function suspendCampaign(id, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, id), {
    status: CAMPAIGN_STATUS.SUSPENDED,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.SUSPEND,
    module: AUDIT_MODULES.CAMPAIGN,
    metadata: { campaignId: id },
  });
}

/**
 * Soft delete a campaign.
 */
export async function deleteCampaign(id, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, id), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.DELETE,
    module: AUDIT_MODULES.CAMPAIGN,
    metadata: { campaignId: id },
  });
}

/**
 * Restore a soft-deleted campaign.
 */
export async function restoreCampaign(id, currentUser) {
  await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, id), {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    user: currentUser,
    action: AUDIT_ACTIONS.RESTORE,
    module: AUDIT_MODULES.CAMPAIGN,
    metadata: { campaignId: id },
  });
}
