// src/app/services/stripe/mapAccountInfo.ts
import type Stripe from 'stripe';

export interface StripeUiStatus {
  payoutsEnabled: boolean;
  needsOnboarding: boolean;
  disabledReasonKey?: string;
  defaultCurrency?: string;
  accountCountry?: string;
  isUnderReview?: boolean;
}

export function mapStripeAccountInfo(account: Stripe.Account): StripeUiStatus {
  const payoutsEnabled = !!account.payouts_enabled;
  const defaultCurrency = account.default_currency
    ? String(account.default_currency).toUpperCase()
    : undefined;
  const accountCountry = account.country
    ? String(account.country).toUpperCase()
    : undefined;
  const disabledReasonKey =
    (account.requirements as any)?.disabled_reason ||
    (account as any).disabled_reason ||
    undefined;
  const needsOnboarding =
    !payoutsEnabled || (account.requirements?.currently_due?.length ?? 0) > 0;
  const isUnderReview =
    disabledReasonKey === 'under_review' ||
    (disabledReasonKey?.startsWith('rejected.') ?? false);

  return {
    payoutsEnabled,
    needsOnboarding,
    disabledReasonKey,
    defaultCurrency,
    accountCountry,
    isUnderReview,
  };
}
