'use client';

import { useState, useEffect, useRef } from 'react';
import type { AdminCreatorListItem } from '@/types/admin/creators';

interface UseCreatorSearchOptions {
  limit?: number;
  /**
   * Minimum number of characters to trigger the search.
   * @default 1
   */
  minChars?: number;
}

// Cache with a simple size limit to prevent excessive memory usage.
const resultCache = new Map<string, AdminCreatorListItem[]>();
const MAX_CACHE_SIZE = 50;

export function useCreatorSearch(
  query: string,
  { limit = 5, minChars = 2, apiPrefix = '/api/admin' }: UseCreatorSearchOptions & { apiPrefix?: string } = {}
) {
  const [results, setResults] = useState<AdminCreatorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 1. Otimização: Adiciona limite mínimo de caracteres para busca.
    if (query.length < minChars) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      abortRef.current?.abort();
      return;
    }

    const cacheKey = `${query}_limit=${limit}`;
    if (resultCache.has(cacheKey)) {
      setResults(resultCache.get(cacheKey)!);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const encodedQuery = encodeURIComponent(query);
        const resp = await fetch(`${apiPrefix}/dashboard/creators?nameSearch=${encodedQuery}&limit=${limit}&page=1&sortBy=totalPosts&sortOrder=desc`, { signal: controller.signal });
        
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao buscar criadores');
        }
        
        const data = await resp.json();
        const sourceList = Array.isArray(data?.creators) ? data.creators : Array.isArray(data) ? data : [];
        const creators: AdminCreatorListItem[] = sourceList.map((c: any) => ({
          _id: c._id?.toString?.() || c.id || '',
          name: c.name,
          email: c.email ?? '',
          profilePictureUrl: c.profilePictureUrl,
          adminStatus: c.adminStatus || 'active',
          registrationDate: c.registrationDate || new Date().toISOString(),
        })).filter((creator: AdminCreatorListItem) => Boolean(creator._id) && Boolean(creator.name));

        // 2. Otimização: Implementa política de limpeza de cache (LRU simples).
        if (resultCache.size >= MAX_CACHE_SIZE) {
            const oldestKey = resultCache.keys().next().value;
            // ===== CORREÇÃO APLICADA AQUI =====
            // Adicionada verificação para garantir que oldestKey não é undefined
            if (oldestKey) {
              resultCache.delete(oldestKey);
            }
        }
        resultCache.set(cacheKey, creators);
        setResults(creators);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setResults([]);
        } else {
          setIsLoading(false);
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
  }, [query, limit, minChars, apiPrefix]);

  return { results, isLoading, error };
}
