import { format, formatDistanceToNow, differenceInDays, isPast, isToday, isTomorrow } from 'date-fns';

/**
 * Format a Firestore timestamp or Date to a readable date string.
 */
export function formatDate(date, pattern = 'dd MMM yyyy') {
  if (!date) return '-';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return format(d, pattern);
}

/**
 * Format a Firestore timestamp to date and time.
 */
export function formatDateTime(date) {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

/**
 * Format a Firestore timestamp to relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(date) {
  if (!date) return '-';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Get expiration label for a voucher/campaign.
 */
export function getExpirationLabel(expiredDate) {
  if (!expiredDate) return null;
  const d = expiredDate?.toDate ? expiredDate.toDate() : new Date(expiredDate);

  if (isPast(d)) return { label: 'Expired', variant: 'red', urgent: true };

  const daysLeft = differenceInDays(d, new Date());

  if (isToday(d)) return { label: 'Expires Today', variant: 'red', urgent: true };
  if (isTomorrow(d)) return { label: 'Expires Tomorrow', variant: 'orange', urgent: true };
  if (daysLeft <= 7) return { label: `Expires in ${daysLeft} Days`, variant: 'amber', urgent: true };
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft} Days`, variant: 'amber', urgent: false };

  return { label: `${daysLeft} Days Left`, variant: 'emerald', urgent: false };
}

/**
 * Format currency (Indonesian Rupiah).
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Format percentage.
 */
export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format file size.
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(str, length = 50) {
  if (!str) return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

/**
 * Generate initials from a name.
 */
export function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
