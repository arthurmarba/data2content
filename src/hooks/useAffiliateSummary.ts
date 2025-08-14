import useSWR from 'swr';
import { AffiliateSummary, AffiliateStatus } from '@/types/affiliate';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch summary');
    return r.json();
  });

export function useAffiliateSummary() {
  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = useSWR<AffiliateSummary>('/api/affiliate/summary', fetcher, {
    revalidateOnFocus: false,
  });
  const {
    data: status,
    error: statusError,
    isLoading: statusLoading,
    mutate: mutateStatus,
  } = useSWR<AffiliateStatus>('/api/affiliate/connect/status', fetcher, {
    revalidateOnFocus: false,
  });

  const loading = summaryLoading || statusLoading;
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
  const curNorm = cur.toUpperCase();
  const statusCur = status?.defaultCurrency?.toUpperCase();
  if (!status?.payoutsEnabled) return false;
  if (!summary) return false;
  if (statusCur && curNorm !== statusCur) return false;
  const curSummary = summary.byCurrency?.[curNorm];
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
  const curNorm = cur.toUpperCase();
  const statusCur = status?.defaultCurrency?.toUpperCase();
  if (!status) return null;
  if (!status.payoutsEnabled) {
    return status.needsOnboarding ? 'needsOnboarding' : 'payouts_disabled';
  }
  if (!summary) return null;
  if (statusCur && curNorm !== statusCur) return 'currency_mismatch';
  const curSummary = summary.byCurrency?.[curNorm];
  if (!curSummary) return null;
  if (curSummary.debtCents > 0) return 'has_debt';
  const min = curSummary.minRedeemCents ?? 0;
  if (curSummary.availableCents < min) return 'below_min';
  return null;
}
