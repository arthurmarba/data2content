'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface UseAdminListParams {
  endpoint: string;
  initialParams?: {
    page?: number;
    limit?: number;
    filters?: Record<string, any>;
    sort?: { sortBy: string; order: 'asc' | 'desc' };
  };
  syncWithUrl?: boolean;
}

const RESERVED_QUERY_KEYS = new Set(['page', 'limit', 'sortBy', 'sortOrder']);

export function useAdminList<T>({
  endpoint,
  initialParams = {},
  syncWithUrl = true,
}: UseAdminListParams) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL if syncWithUrl is true, otherwise use initialParams
  const getInitialState = useCallback((key: string, defaultValue: any) => {
    if (!syncWithUrl) return defaultValue;
    return searchParams.get(key) ?? defaultValue;
  }, [searchParams, syncWithUrl]);
  
  const [data, setData] = useState<{
    items: T[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
  } | null>(null);

  const [page, setPage] = useState<number>(parseInt(getInitialState('page', initialParams.page ?? 1), 10));
  const [limit, setLimit] = useState<number>(parseInt(getInitialState('limit', initialParams.limit ?? 10), 10));
  const [filters, setFilters] = useState<Record<string, any>>(() => {
    if (!syncWithUrl) return initialParams.filters ?? {};

    const urlFilters: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      if (RESERVED_QUERY_KEYS.has(key)) continue;
      urlFilters[key] = value;
    }

    return Object.keys(urlFilters).length > 0 ? urlFilters : (initialParams.filters ?? {});
  });
  const [sort, setSort] = useState(() => {
    const fallback = initialParams.sort ?? { sortBy: 'createdAt', order: 'desc' as const };
    if (!syncWithUrl) return fallback;

    const sortBy = searchParams.get('sortBy') ?? fallback.sortBy;
    const orderParam = searchParams.get('sortOrder');
    const order: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : (orderParam === 'desc' ? 'desc' : fallback.order);
    return { sortBy, order };
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      if (sort.sortBy) {
        params.set('sortBy', sort.sortBy);
        params.set('sortOrder', sort.order);
      }

      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val));
        }
      });

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao carregar os dados.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, page, limit, filters, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync state back to URL
  useEffect(() => {
    if (!syncWithUrl) return;

    const query: Record<string, string> = {};
    if (page > 1) query.page = String(page);
    if (limit !== 10) query.limit = String(limit);
    if (sort.sortBy !== 'createdAt') query.sortBy = sort.sortBy;
    if (sort.order !== 'desc') query.sortOrder = sort.order;

    Object.entries(filters).forEach(([key, value]) => {
        if(value) query[key] = String(value);
    });

    const newUrl = new URL(window.location.href);
    newUrl.search = new URLSearchParams(query).toString();
    router.replace(newUrl.pathname + newUrl.search, { scroll: false });

  }, [page, limit, filters, sort, syncWithUrl, router]);


  return {
    data,
    isLoading,
    error,
    page,
    setPage,
    limit,
    setLimit,
    filters,
    setFilters,
    sort,
    setSort,
    reload: fetchData,
  };
}
