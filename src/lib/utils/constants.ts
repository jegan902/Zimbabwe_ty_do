// Roles
export const ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPERADMIN: 'SUPERADMIN',
} as const;

// User Status
export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;

// Wallet Transaction Types
export const WALLET_TX_TYPE = {
  DEPOSIT: 'DEPOSIT',
  PURCHASE: 'PURCHASE',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
  RESERVATION: 'RESERVATION',
  CAPTURE: 'CAPTURE',
  RELEASE: 'RELEASE',
} as const;

// Wallet Transaction Status
export const WALLET_TX_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Order Status
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  RESERVED: 'RESERVED',
  PROCESSING: 'PROCESSING',
  SUPPLIER_PENDING: 'SUPPLIER_PENDING',
  RECONCILIATION: 'RECONCILIATION',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
} as const;

// Supplier Status
export const SUPPLIER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Session
export const SESSION_EXPIRE_DAYS = 30;

// Timeouts (ms)
export const SUPPLIER_API_TIMEOUT = 30000;
export const PAYMENT_WEBHOOK_TIMEOUT = 10000;

// Sync Intervals (seconds)
export const PRODUCT_SYNC_INTERVAL = 300;
export const BALANCE_CHECK_INTERVAL = 600;

// Decimal Places
export const DECIMAL_PLACES = 2;
export const RATE_DECIMAL_PLACES = 2;

// Profit Calculation
export const DEFAULT_PROFIT_RATE = 10; // 10%
export const PROFIT_TYPES = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
} as const;

export const PRICING_MODES = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL',
} as const;
