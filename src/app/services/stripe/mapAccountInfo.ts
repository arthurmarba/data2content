// src/app/services/stripe/mapAccountInfo.ts
import type Stripe from 'stripe';

// Alias local — o SDK não exporta CapabilityStatus
type CapabilityStatus = 'active' | 'inactive' | 'pending';

export interface StripeAccountInfo {
  payouts_enabled: boolean;
  charges_enabled: boolean;
  default_currency: string | null;
  disabled_reason: string | null;
  capabilities: {
    card_payments: CapabilityStatus;
    transfers: CapabilityStatus;
  };
  requirements: {
    currently_due: string[];
    past_due: string[];
    current_deadline: string | null;
  };
  needsOnboarding: boolean;
  stripeAccountStatus: 'verified' | 'pending' | 'disabled';
}

export function mapStripeAccountInfo(account: Stripe.Account): StripeAccountInfo {
  const payouts_enabled = !!account.payouts_enabled;
  const charges_enabled = !!account.charges_enabled;
  const default_currency = account.default_currency
    ? String(account.default_currency).toLowerCase()
    : null;

  const disabled_reason =
    (account.requirements as any)?.disabled_reason ||
    (account as any).disabled_reason ||
    null;

  // Normaliza capabilities com fallback seguro
  const card_payments = (account.capabilities?.card_payments ?? 'inactive') as CapabilityStatus;
  const transfers = (account.capabilities?.transfers ?? 'inactive') as CapabilityStatus;

  const requirements = {
    currently_due: (account.requirements?.currently_due ?? []) as string[],
    past_due: (account.requirements?.past_due ?? []) as string[],
    current_deadline: account.requirements?.current_deadline
      ? new Date(account.requirements.current_deadline * 1000).toISOString()
      : null,
  };

  const needsOnboarding = requirements.currently_due.length > 0 || !payouts_enabled;

  let stripeAccountStatus: 'verified' | 'pending' | 'disabled' = 'pending';
  if (disabled_reason) {
    stripeAccountStatus = 'disabled';
  } else if (payouts_enabled && charges_enabled) {
    stripeAccountStatus = 'verified';
  }

  return {
    payouts_enabled,
    charges_enabled,
    default_currency,
    disabled_reason,
    capabilities: { card_payments, transfers },
    requirements,
    needsOnboarding,
    stripeAccountStatus,
  };
}
