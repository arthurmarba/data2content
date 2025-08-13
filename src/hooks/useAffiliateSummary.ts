import useSWR from 'swr';

interface AffiliateSummary {
  balances: Record<string, number>;
  debt: Record<string, number>;
  min: Record<string, number>;
  pendingNextDates?: Record<string, string>;
}

interface AffiliateStatus {
  payouts_enabled: boolean;
  disabled_reason?: string;
  default_currency: string;
  needsOnboarding?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAffiliateSummary() {
  const { data: summary, mutate: mutateSummary } = useSWR<AffiliateSummary>('/api/affiliate/summary', fetcher);
  const { data: status, mutate: mutateStatus } = useSWR<AffiliateStatus>('/api/affiliate/connect/status', fetcher);
  const loading = !summary || !status;
  const refresh = async () => {
    await Promise.all([mutateSummary(), mutateStatus()]);
  };
  return { summary, status, loading, refresh };
}

export function canRedeem(status: AffiliateStatus | undefined, summary: AffiliateSummary | undefined, cur: string) {
  if (!status?.payouts_enabled) return false;
  if (!summary) return false;
  if (cur !== status.default_currency) return false;
  const balance = summary.balances?.[cur] ?? 0;
  const min = summary.min?.[cur] ?? 0;
  const debt = summary.debt?.[cur] ?? 0;
  return balance >= min && debt === 0;
}
