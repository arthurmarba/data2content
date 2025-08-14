import { useMemo } from 'react';
import useSWR from 'swr';

export type CurrencyCode = 'BRL' | 'USD' | string;
export interface CurrencySummary {
  availableCents: number;
  pendingCents: number;
  nextMatureAt?: string;
  debtCents: number;
  minRedeemCents?: number;
}

export interface AffiliateSummary {
  byCurrency: Record<CurrencyCode, CurrencySummary>;
  // legacy fields for retrocompatibility
  balances: Record<string, number>;
  debt: Record<string, number>;
  min: Record<string, number>;
  pendingNextDates?: Record<string, string>;
  pending?: Record<string, number>;
}

export interface AffiliateStatus {
  payouts_enabled: boolean;
  disabled_reason?: string;
  default_currency: string;
  needsOnboarding?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAffiliateSummary() {
  const { data: rawSummary, error: summaryError, mutate: mutateSummary } = useSWR<AffiliateSummary>('/api/affiliate/summary', fetcher);
  const { data: status, error: statusError, mutate: mutateStatus } = useSWR<AffiliateStatus>('/api/affiliate/connect/status', fetcher);

  const summary = useMemo<AffiliateSummary | undefined>(() => {
    if (!rawSummary) return undefined;
    const currencies = new Set<string>([
      ...Object.keys(rawSummary.balances || {}),
      ...Object.keys(rawSummary.pending || {}),
      ...Object.keys(rawSummary.debt || {}),
      ...Object.keys(rawSummary.min || {}),
    ]);
    const byCurrency: Record<string, CurrencySummary> = {};
    currencies.forEach(cur => {
      byCurrency[cur] = {
        availableCents: rawSummary.balances?.[cur] ?? 0,
        pendingCents: rawSummary.pending?.[cur] ?? 0,
        nextMatureAt: rawSummary.pendingNextDates?.[cur],
        debtCents: rawSummary.debt?.[cur] ?? 0,
        minRedeemCents: rawSummary.min?.[cur],
      };
    });
    return { ...rawSummary, byCurrency };
  }, [rawSummary]);

  const loading = !summary || !status;
  const error = summaryError || statusError;
  const refresh = async () => {
    await Promise.all([mutateSummary(), mutateStatus()]);
  };
  return { summary, status, loading, refresh, error };
}

export function canRedeem(
  status: AffiliateStatus | undefined,
  summary: AffiliateSummary | undefined,
  cur: string,
) {
  if (!status?.payouts_enabled) return false;
  if (!summary) return false;
  if (cur !== status.default_currency) return false;
  const curSummary = summary.byCurrency?.[cur];
  if (!curSummary) return false;
  const min = curSummary.minRedeemCents ?? 0;
  return curSummary.availableCents >= min && curSummary.debtCents === 0;
}

export type RedeemBlockReason =
  | 'needsOnboarding'
  | 'payouts_disabled'
  | 'currency_mismatch'
  | 'below_min'
  | 'has_debt';

export function getRedeemBlockReason(
  status: AffiliateStatus | undefined,
  summary: AffiliateSummary | undefined,
  cur: string,
): RedeemBlockReason | null {
  if (!status) return null;
  if (!status.payouts_enabled) {
    return status.needsOnboarding ? 'needsOnboarding' : 'payouts_disabled';
  }
  if (!summary) return null;
  if (cur !== status.default_currency) return 'currency_mismatch';
  const curSummary = summary.byCurrency?.[cur];
  if (!curSummary) return null;
  if (curSummary.debtCents > 0) return 'has_debt';
  const min = curSummary.minRedeemCents ?? 0;
  if (curSummary.availableCents < min) return 'below_min';
  return null;
}
