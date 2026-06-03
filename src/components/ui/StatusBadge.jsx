import { memo } from 'react';
import clsx from 'clsx';

const STATUS_STYLES = {
  // Voucher statuses
  draft: 'badge-gray',
  active: 'badge-emerald',
  used: 'badge-blue',
  expired: 'badge-red',
  suspended: 'badge-orange',
  // Campaign statuses
  pending_approval: 'badge-amber',
  // Generic
  success: 'badge-emerald',
  error: 'badge-red',
  warning: 'badge-amber',
  info: 'badge-blue',
  // Colors
  emerald: 'badge-emerald',
  amber: 'badge-amber',
  red: 'badge-red',
  blue: 'badge-blue',
  gray: 'badge-gray',
  orange: 'badge-orange',
};

const StatusBadge = memo(function StatusBadge({ status, label, className, dot = false, size = 'sm' }) {
  const displayLabel = label || status?.replace(/_/g, ' ');
  const badgeClass = STATUS_STYLES[status] || STATUS_STYLES.gray;

  return (
    <span className={clsx(badgeClass, size === 'lg' && 'px-3 py-1.5 text-sm', className)}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      <span className="capitalize">{displayLabel}</span>
    </span>
  );
});

export default StatusBadge;
