// ============================================
// GLORY8 E-VOUCHER — Constants
// ============================================

export const APP_NAME = 'GLORY8 E-VOUCHER';

// Roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.STAFF]: 'Staff',
};

export const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.STAFF, label: 'Staff' },
];

// Campaign Status
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
};

export const CAMPAIGN_STATUS_LABELS = {
  [CAMPAIGN_STATUS.DRAFT]: 'Draft',
  [CAMPAIGN_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [CAMPAIGN_STATUS.ACTIVE]: 'Active',
  [CAMPAIGN_STATUS.EXPIRED]: 'Expired',
  [CAMPAIGN_STATUS.SUSPENDED]: 'Suspended',
};

export const CAMPAIGN_STATUS_COLORS = {
  [CAMPAIGN_STATUS.DRAFT]: 'gray',
  [CAMPAIGN_STATUS.PENDING_APPROVAL]: 'amber',
  [CAMPAIGN_STATUS.ACTIVE]: 'emerald',
  [CAMPAIGN_STATUS.EXPIRED]: 'red',
  [CAMPAIGN_STATUS.SUSPENDED]: 'orange',
};

// Voucher Status
export const VOUCHER_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  USED: 'used',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
};

export const VOUCHER_STATUS_LABELS = {
  [VOUCHER_STATUS.DRAFT]: 'Draft',
  [VOUCHER_STATUS.ACTIVE]: 'Active',
  [VOUCHER_STATUS.USED]: 'Used',
  [VOUCHER_STATUS.EXPIRED]: 'Expired',
  [VOUCHER_STATUS.SUSPENDED]: 'Suspended',
};

export const VOUCHER_STATUS_COLORS = {
  [VOUCHER_STATUS.DRAFT]: 'gray',
  [VOUCHER_STATUS.ACTIVE]: 'emerald',
  [VOUCHER_STATUS.USED]: 'blue',
  [VOUCHER_STATUS.EXPIRED]: 'red',
  [VOUCHER_STATUS.SUSPENDED]: 'orange',
};

// Discount Types
export const DISCOUNT_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
};

export const DISCOUNT_TYPE_LABELS = {
  [DISCOUNT_TYPES.PERCENTAGE]: 'Percentage (%)',
  [DISCOUNT_TYPES.FIXED]: 'Fixed Amount (Rp)',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

// Audit Actions
export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  FAILED_LOGIN: 'failed_login',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESTORE: 'restore',
  REDEEM: 'redeem',
  APPROVE: 'approve',
  REJECT: 'reject',
  SUSPEND: 'suspend',
  GENERATE: 'generate',
  VALIDATE: 'validate',
};

// Audit Modules
export const AUDIT_MODULES = {
  AUTH: 'auth',
  USER: 'user',
  DIVISION: 'division',
  CAMPAIGN: 'campaign',
  VOUCHER: 'voucher',
  REDEEM: 'redeem',
  SETTINGS: 'settings',
  NOTIFICATION: 'notification',
};

// Validation Results
export const VALIDATION_RESULTS = {
  VALID: 'valid',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  USED: 'used',
  SUSPENDED: 'suspended',
  CAMPAIGN_INACTIVE: 'campaign_inactive',
};

// Firestore Collections
export const COLLECTIONS = {
  USERS: 'users',
  DIVISIONS: 'divisions',
  CAMPAIGNS: 'campaigns',
  VOUCHERS: 'vouchers',
  REDEEMS: 'redeems',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
};

// Pagination
export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

// Permissions per role
export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'users.view', 'users.create', 'users.edit', 'users.delete',
    'divisions.view', 'divisions.create', 'divisions.edit', 'divisions.delete',
    'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.delete', 'campaigns.approve',
    'vouchers.view', 'vouchers.create', 'vouchers.edit', 'vouchers.delete', 'vouchers.generate',
    'vouchers.validate', 'vouchers.redeem',
    'analytics.view',
    'audit.view',
    'settings.view', 'settings.edit',
    'notifications.view',
  ],
  [ROLES.ADMIN]: [
    'campaigns.view', 'campaigns.create', 'campaigns.edit',
    'vouchers.view', 'vouchers.create', 'vouchers.edit', 'vouchers.generate',
    'vouchers.validate', 'vouchers.redeem',
    'analytics.view',
    'notifications.view',
  ],
  [ROLES.STAFF]: [
    'campaigns.view',
    'vouchers.view', 'vouchers.validate', 'vouchers.redeem',
    'notifications.view',
  ],
};

// Theme Colors
export const THEME = {
  primary: '#0F766E',
  secondary: '#14B8A6',
  accent: '#22C55E',
  background: '#F8FAFC',
};

// Voucher Code Prefix
export const VOUCHER_PREFIX = 'GL8';
