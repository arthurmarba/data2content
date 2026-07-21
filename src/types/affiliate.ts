import type { ConnectStatus } from './connect';

export type CurrencySummary = {
  availableCents: number;
  storedAvailableCents: number;
  reconciliationStatus: 'reconciled' | 'mismatch';
  pendingCents: number;
  debtCents: number;
  nextMatureAt: string | null;
  minRedeemCents: number;
  activeRedemption?: {
    id: string;
    amountCents: number;
    balanceReserved: boolean;
  } | null;
};

export type AffiliateSummary = {
  byCurrency: Record<string, CurrencySummary>;
};

export type AffiliateStatus = ConnectStatus;
