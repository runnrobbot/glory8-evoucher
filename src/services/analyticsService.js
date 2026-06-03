import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { COLLECTIONS, VOUCHER_STATUS, CAMPAIGN_STATUS } from '@/utils/constants';

/**
 * Get dashboard statistics.
 */
export async function getDashboardStats() {
  const [
    usersCount,
    divisionsCount,
    campaignsCount,
    vouchersStats,
  ] = await Promise.all([
    getCollectionCount(COLLECTIONS.USERS, [where('isDeleted', '==', false)]),
    getCollectionCount(COLLECTIONS.DIVISIONS),
    getCollectionCount(COLLECTIONS.CAMPAIGNS, [where('isDeleted', '==', false)]),
    getVoucherStats(),
  ]);

  return {
    totalUsers: usersCount,
    totalDivisions: divisionsCount,
    totalCampaigns: campaignsCount,
    ...vouchersStats,
  };
}

/**
 * Get voucher statistics by status.
 */
async function getVoucherStats() {
  const baseFilter = [where('isDeleted', '==', false)];

  const [total, active, used, expired] = await Promise.all([
    getCollectionCount(COLLECTIONS.VOUCHERS, baseFilter),
    getCollectionCount(COLLECTIONS.VOUCHERS, [...baseFilter, where('status', '==', VOUCHER_STATUS.ACTIVE)]),
    getCollectionCount(COLLECTIONS.VOUCHERS, [...baseFilter, where('status', '==', VOUCHER_STATUS.USED)]),
    getCollectionCount(COLLECTIONS.VOUCHERS, [...baseFilter, where('status', '==', VOUCHER_STATUS.EXPIRED)]),
  ]);

  return {
    totalVouchers: total,
    activeVouchers: active,
    usedVouchers: used,
    expiredVouchers: expired,
  };
}

/**
 * Get collection count with filters.
 */
async function getCollectionCount(collectionName, filters = []) {
  try {
    const q = query(collection(db, collectionName), ...filters);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch {
    // Fallback: do a limited read
    const q = query(collection(db, collectionName), ...filters, limit(1000));
    const snapshot = await getDocs(q);
    return snapshot.size;
  }
}

/**
 * Get recent redeems for chart data (last 30 days).
 */
export async function getRedeemTrend(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const q = query(
    collection(db, COLLECTIONS.REDEEMS),
    where('redeemedAt', '>=', startDate),
    orderBy('redeemedAt', 'asc'),
    limit(500)
  );

  const snapshot = await getDocs(q);
  const redeems = snapshot.docs.map((d) => d.data());

  // Group by date
  const grouped = {};
  redeems.forEach((r) => {
    const date = (r.redeemedAt?.toDate ? r.redeemedAt.toDate() : new Date(r.redeemedAt))
      .toISOString()
      .split('T')[0];
    grouped[date] = (grouped[date] || 0) + 1;
  });

  // Fill missing dates
  const result = [];
  const current = new Date(startDate);
  const today = new Date();
  while (current <= today) {
    const dateStr = current.toISOString().split('T')[0];
    result.push({ date: dateStr, count: grouped[dateStr] || 0 });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Get campaign performance data.
 */
export async function getCampaignPerformance() {
  const q = query(
    collection(db, COLLECTIONS.CAMPAIGNS),
    where('isDeleted', '==', false),
    where('status', '==', CAMPAIGN_STATUS.ACTIVE),
    orderBy('voucherCount', 'desc'),
    limit(10)
  );

  const snapshot = await getDocs(q);
  const campaigns = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Get redeem counts for each campaign
  const results = await Promise.all(
    campaigns.map(async (campaign) => {
      const redeemQ = query(
        collection(db, COLLECTIONS.REDEEMS),
        where('campaignId', '==', campaign.id),
        limit(1000)
      );
      const redeemSnapshot = await getDocs(redeemQ);
      return {
        name: campaign.name,
        vouchers: campaign.voucherCount || 0,
        redeems: redeemSnapshot.size,
      };
    })
  );

  return results;
}

/**
 * Get voucher generation trend (last 30 days).
 */
export async function getVoucherGenerationTrend(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const q = query(
    collection(db, COLLECTIONS.VOUCHERS),
    where('isDeleted', '==', false),
    where('createdAt', '>=', startDate),
    orderBy('createdAt', 'asc'),
    limit(500)
  );

  const snapshot = await getDocs(q);
  const vouchers = snapshot.docs.map((d) => d.data());

  const grouped = {};
  vouchers.forEach((v) => {
    const date = (v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt))
      .toISOString()
      .split('T')[0];
    grouped[date] = (grouped[date] || 0) + 1;
  });

  const result = [];
  const current = new Date(startDate);
  const today = new Date();
  while (current <= today) {
    const dateStr = current.toISOString().split('T')[0];
    result.push({ date: dateStr, count: grouped[dateStr] || 0 });
    current.setDate(current.getDate() + 1);
  }

  return result;
}
