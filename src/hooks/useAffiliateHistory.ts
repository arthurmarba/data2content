import useSWRInfinite from 'swr/infinite';

export type HistoryStatus = 'pending'|'available'|'paid'|'canceled'|'reversed';
export type HistoryItem = {
  id: string;
  currency: string;        // 'BRL' | 'USD' | ...
  amountCents: number;
  status: HistoryStatus;
  createdAt: string;       // ISO
  availableAt?: string;    // ISO, se pending
  invoiceId?: string;
  subscriptionId?: string;
  transferId?: string;     // se paid
  reasonCode?: string;     // ver mapa abaixo
  notes?: string | null;   // livre
};

export type HistoryQuery = {
  statuses?: HistoryStatus[];
  currencies?: string[];
  dateFrom?: string;  // ISO
  dateTo?: string;    // ISO
  sortBy?: 'createdAt'|'amountCents';
  sortDir?: 'asc'|'desc';
  cursor?: string;    // paginação
  limit?: number;     // default 20
};

export type HistoryResponse = {
  items: HistoryItem[];
  nextCursor?: string | null;
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Network error');
  return r.json();
});

function buildQuery(q: HistoryQuery & { cursor?: string }) {
  const params = new URLSearchParams();
  if (q.statuses) q.statuses.forEach(s => params.append('statuses', s));
  if (q.currencies) q.currencies.forEach(c => params.append('currencies', c));
  if (q.dateFrom) params.set('dateFrom', q.dateFrom);
  if (q.dateTo) params.set('dateTo', q.dateTo);
  if (q.sortBy) params.set('sortBy', q.sortBy);
  if (q.sortDir) params.set('sortDir', q.sortDir);
  if (q.cursor) params.set('cursor', q.cursor);
  if (q.limit) params.set('limit', String(q.limit));
  return params.toString();
}

export function useAffiliateHistory(query: HistoryQuery = {}) {
  const getKey = (pageIndex: number, previousPageData: HistoryResponse | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    const cursor = pageIndex === 0 ? query.cursor : previousPageData?.nextCursor;
    const q = { ...query, cursor } as HistoryQuery;
    const qs = buildQuery(q);
    return `/api/affiliate/history${qs ? `?${qs}` : ''}`;
  };

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<HistoryResponse>(getKey, fetcher);
  const items = data ? data.flatMap(p => p.items) : [];
  const loading = !data && !error;
  const hasMore = !!data?.[data.length - 1]?.nextCursor;

  const loadMore = () => setSize(size + 1);
  const refresh = () => mutate();

  return { items, loading, error, loadMore, hasMore, isValidating, refresh };
}

export function daysUntil(dateIso?: string) {
  if (!dateIso) return 0;
  const target = new Date(dateIso).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}
