import type { ConnectStatus } from './connect';

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

export type AffiliateStatus = ConnectStatus;
