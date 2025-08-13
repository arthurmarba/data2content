import type Stripe from 'stripe';

export interface StripeAccountInfo {
  payouts_enabled: boolean;
  charges_enabled: boolean;
  default_currency: string | null;
  disabled_reason: string | null;
  capabilities: {
    card_payments: Stripe.Account.CapabilityStatus | undefined;
    transfers: Stripe.Account.CapabilityStatus | undefined;
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
    (account.requirements as any)?.disabled_reason || (account as any).disabled_reason || null;
  const capabilities = {
    card_payments: account.capabilities?.card_payments || "inactive",
    transfers: account.capabilities?.transfers || "inactive",
  } as const;
  const requirements = {
    currently_due: account.requirements?.currently_due || [],
    past_due: account.requirements?.past_due || [],
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
    capabilities,
    requirements,
    needsOnboarding,
    stripeAccountStatus,
  };
}
