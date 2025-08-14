export type CurrencySummary = {
  availableCents: number;
  pendingCents: number;
  debtCents: number;
  nextMatureAt: string | null;
  minRedeemCents: number;
};

export type AffiliateSummary = {
  byCurrency: Record<string, CurrencySummary>;
};

export type AffiliateStatus = {
  payoutsEnabled: boolean;
  disabledReasonKey?: string;
  defaultCurrency?: string;
  needsOnboarding?: boolean;
  accountCountry?: string;
  isUnderReview?: boolean;
};
