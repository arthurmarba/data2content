export type ConnectStatus = {
  payoutsEnabled: boolean;
  needsOnboarding: boolean;
  isUnderReview: boolean;
  defaultCurrency: string | null;
  disabledReasonKey: string | null;
  accountCountry: string | null;
  lastRefreshedAt: string;
};
