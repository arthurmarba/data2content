export const AFFILIATE_PAYOUT_MODE = (process.env.AFFILIATE_PAYOUT_MODE as 'on_redeem' | 'instant' | undefined) || 'on_redeem';
export const AFFILIATE_HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS || 7);
export const COMMISSION_RATE = Number(process.env.COMMISSION_RATE || 0.10);
export const COMMISSION_BASE = (process.env.COMMISSION_BASE as 'amount_paid' | 'subtotal_after_discount' | undefined) || 'amount_paid';
export const CURRENCY_DECIMALS: Record<string, number> = { brl: 2, usd: 2 };

// Maturation cron configuration
export const MATURATION_CRON_ENABLED =
  process.env.MATURATION_CRON_ENABLED !== 'false';
export const MATURATION_BATCH_USERS = Number(
  process.env.MATURATION_BATCH_USERS || 200
);
export const MATURATION_MAX_ENTRIES_PER_USER = Number(
  process.env.MATURATION_MAX_ENTRIES_PER_USER || 100
);
export const MATURATION_TIMEOUT_MS = Number(
  process.env.MATURATION_TIMEOUT_MS || 25000
);
