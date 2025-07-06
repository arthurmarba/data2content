'use client';

import { useState, useEffect, useRef } from 'react';
import type { AdminCreatorListItem } from '@/types/admin/creators';

interface UseCreatorSearchOptions {
  limit?: number;
}

const resultCache = new Map<string, AdminCreatorListItem[]>();

export function useCreatorSearch(
  query: string,
  { limit = 5 }: UseCreatorSearchOptions = {}
) {
  const [results, setResults] = useState<AdminCreatorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    if (resultCache.has(query)) {
      setResults(resultCache.get(query)!);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(limit), search: query });
        const resp = await fetch(`/api/admin/creators?${params.toString()}`, { signal: controller.signal });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao buscar criadores');
        }
        const data = await resp.json();
        const creators: AdminCreatorListItem[] = data.creators || [];
        resultCache.set(query, creators);
        setResults(creators);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [query, limit]);

  return { results, isLoading, error };
}
