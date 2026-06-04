import { z } from 'zod';
import { ROLES, DISCOUNT_TYPES, CAMPAIGN_STATUS, VOUCHER_STATUS } from './constants';

// Common field schemas
const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const requiredString = (field) => z.string().min(1, `${field} is required`).trim();
const optionalString = z.string().trim().optional().or(z.literal(''));
const positiveNumber = (field) => z.coerce.number().min(0, `${field} must be positive`);
const dateField = (field) => z.string().min(1, `${field} is required`);

// Login
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Forgot Password
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Bootstrap (first Super Admin)
export const bootstrapSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm password is required'),
  displayName: requiredString('Name'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// User
export const userSchema = z.object({
  email: emailSchema,
  displayName: requiredString('Name'),
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF], { required_error: 'Role is required' }),
  divisionId: requiredString('Division'),
  password: z.string().optional(),
});

export const userEditSchema = z.object({
  displayName: requiredString('Name'),
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF], { required_error: 'Role is required' }),
  divisionId: requiredString('Division'),
});

// Division
export const divisionSchema = z.object({
  name: requiredString('Name'),
  description: optionalString,
});

// Campaign
export const campaignSchema = z.object({
  name: requiredString('Campaign Name'),
  code: requiredString('Campaign Code')
    .regex(/^[A-Z0-9_-]+$/i, 'Only letters, numbers, hyphens, and underscores allowed'),
  description: optionalString,
  bannerUrl: optionalString,
  startDate: dateField('Start Date'),
  endDate: dateField('End Date'),
  status: z.enum(Object.values(CAMPAIGN_STATUS)).default(CAMPAIGN_STATUS.DRAFT),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

// Voucher
export const voucherSchema = z.object({
  name: requiredString('Voucher Name'),
  campaignId: requiredString('Campaign'),
  description: optionalString,
  value: positiveNumber('Value').min(1, 'Value must be at least 1'),
  discountType: z.enum(Object.values(DISCOUNT_TYPES), { required_error: 'Discount type is required' }),
  terms: optionalString,
  startDate: dateField('Start Date'),
  expiredDate: dateField('Expired Date'),
  usageLimit: z.coerce.number().int().min(1, 'Usage limit must be at least 1'),
  minPurchase: positiveNumber('Min Purchase').default(0),
  maxDiscount: positiveNumber('Max Discount').default(0),
  backgroundUrl: optionalString,
  bgPositionX: z.coerce.number().min(0).max(100).default(50),
  bgPositionY: z.coerce.number().min(0).max(100).default(50),
}).refine((data) => {
  if (data.startDate && data.expiredDate) {
    return new Date(data.expiredDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'Expired date must be after start date',
  path: ['expiredDate'],
});

// Bulk Generate
export const bulkGenerateSchema = z.object({
  campaignId: requiredString('Campaign'),
  name: requiredString('Voucher Name'),
  description: optionalString,
  value: positiveNumber('Value').min(1, 'Value must be at least 1'),
  discountType: z.enum(Object.values(DISCOUNT_TYPES), { required_error: 'Discount type is required' }),
  terms: optionalString,
  startDate: dateField('Start Date'),
  expiredDate: dateField('Expired Date'),
  usageLimit: z.coerce.number().int().min(1, 'Usage limit must be at least 1'),
  minPurchase: positiveNumber('Min Purchase').default(0),
  maxDiscount: positiveNumber('Max Discount').default(0),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(500, 'Maximum 500 vouchers per batch'),
  backgroundUrl: optionalString,
  bgPositionX: z.coerce.number().min(0).max(100).default(50),
  bgPositionY: z.coerce.number().min(0).max(100).default(50),
});

// Redeem
export const redeemSchema = z.object({
  customerName: requiredString('Customer Name'),
  transactionNumber: requiredString('Transaction Number'),
  purchaseAmount: positiveNumber('Purchase Amount').min(1, 'Purchase amount must be at least 1'),
  notes: optionalString,
});

// Settings
export const settingsSchema = z.object({
  companyName: requiredString('Company Name'),
  companyLogo: optionalString,
  voucherPrefix: requiredString('Voucher Prefix')
    .max(5, 'Prefix max 5 characters')
    .regex(/^[A-Z0-9]+$/, 'Only uppercase letters and numbers'),
});
