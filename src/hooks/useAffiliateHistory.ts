import useSWRInfinite from 'swr/infinite';

export type HistoryStatus = 'pending' | 'available' | 'paid' | 'canceled' | 'reversed';

export interface HistoryItem {
  id: string;
  kind: 'commission' | 'redemption';
  currency: string;
  amountCents: number;
  status: HistoryStatus;
  createdAt: string;
  availableAt?: string | null;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  transferId?: string | null;
  reasonCode?: string | null;
  notes?: string | null;
}

export interface HistoryResponse {
  items: HistoryItem[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json());

export function useAffiliateHistory(filters: { status?: string[]; currency?: string; from?: string; to?: string } = {}) {
  const qs = new URLSearchParams();
  qs.set('take', String(PAGE_SIZE));
  if (filters.currency) qs.set('currency', filters.currency);
  if (filters.status?.length) qs.set('status', filters.status.join(','));
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);

  const getKey = (index: number, prev: HistoryResponse | null) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = index === 0 ? '' : `&cursor=${encodeURIComponent(prev!.nextCursor!)}`;
    return `/api/affiliate/history?${qs.toString()}${cursor}`;
  };

  const { data, error, size, setSize, isLoading } = useSWRInfinite<HistoryResponse>(getKey, fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.flatMap(d => d.items) ?? [];
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return {
    items,
    hasMore,
    loadMore: () => setSize(size + 1),
    error,
    isLoading,
    size,
    setSize,
  };
}

export function daysUntil(dateIso?: string | null) {
  if (!dateIso) return 0;
  const target = new Date(dateIso).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}
