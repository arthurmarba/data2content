'use client';

import { useState, useEffect, useRef } from 'react';
import type { AdminCreatorListItem } from '@/types/admin/creators';

interface UseCreatorSearchOptions {
  limit?: number;
  /**
   * Minimum number of characters to trigger the search.
   * @default 2
   */
  minChars?: number;
  /**
   * Debounce delay (ms) before firing the request.
   * @default 150
   */
  debounceMs?: number;
  /**
   * Optional filter to limit results to active subscribers.
   * @default false
   */
  onlyActiveSubscribers?: boolean;
}

type CachedEntry = {
  results: AdminCreatorListItem[];
  expiresAt: number;
};

// Cache with a simple size limit to prevent excessive memory usage.
const resultCache = new Map<string, CachedEntry>();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 2 * 60_000;

const pruneCache = (now: number) => {
  for (const [key, entry] of resultCache) {
    if (entry.expiresAt <= now) {
      resultCache.delete(key);
    }
  }
};

const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('debugCreatorSearch') === '1';
  } catch {
    return false;
  }
};

const pushDebugMetric = (metric: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __creatorSearchMetrics?: Record<string, unknown>[] };
  if (!win.__creatorSearchMetrics) {
    win.__creatorSearchMetrics = [];
  }
  win.__creatorSearchMetrics.push(metric);
  if (win.__creatorSearchMetrics.length > 50) {
    win.__creatorSearchMetrics.shift();
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[creator-search]', metric);
  }
};

export function useCreatorSearch(
  query: string,
  {
    limit = 5,
    minChars = 2,
    debounceMs = 150,
    onlyActiveSubscribers = false,
    apiPrefix = '/api/admin',
  }: UseCreatorSearchOptions & { apiPrefix?: string } = {}
) {
  const [results, setResults] = useState<AdminCreatorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const debugEnabled = isDebugEnabled();
    const effectStartedAt = debugEnabled ? performance.now() : 0;

    if (normalizedQuery.length < minChars) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      abortRef.current?.abort();
      return;
    }

    const cacheKey = `${apiPrefix}:${normalizedQuery.toLowerCase()}_limit=${limit}_active=${onlyActiveSubscribers ? '1' : '0'}`;
    const now = Date.now();
    const cached = resultCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      setResults(cached.results);
      setError(null);
      setIsLoading(false);
      if (debugEnabled) {
        pushDebugMetric({
          source: 'cache',
          query: normalizedQuery,
          resultCount: cached.results.length,
          totalMs: Math.round(performance.now() - effectStartedAt),
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }
    if (cached) {
      resultCache.delete(cacheKey);
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const fetchData = async () => {
      const requestStartedAt = debugEnabled ? performance.now() : 0;
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: normalizedQuery,
          limit: String(limit),
        });
        if (onlyActiveSubscribers) {
          params.set('onlyActiveSubscribers', 'true');
        }

        const resp = await fetch(`${apiPrefix}/dashboard/creators/search?${params.toString()}`, { signal: controller.signal });
        
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao buscar criadores');
        }

        const serverTiming = resp.headers.get('server-timing') ?? undefined;
        
        const data = await resp.json();
        const sourceList = Array.isArray(data?.creators) ? data.creators : Array.isArray(data) ? data : [];
        const creators: AdminCreatorListItem[] = sourceList.map((c: any) => ({
          _id: c._id?.toString?.() || c.id || '',
          name: c.name,
          email: c.email ?? '',
          profilePictureUrl: c.profilePictureUrl ?? c.profile_picture_url ?? c.image,
          adminStatus: c.adminStatus || 'active',
          registrationDate: c.registrationDate || c.createdAt || new Date().toISOString(),
        })).filter((creator: AdminCreatorListItem) => Boolean(creator._id) && Boolean(creator.name));

        pruneCache(Date.now());
        while (resultCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = resultCache.keys().next().value;
          if (!oldestKey) break;
          resultCache.delete(oldestKey);
        }
        resultCache.set(cacheKey, { results: creators, expiresAt: Date.now() + CACHE_TTL_MS });
        setResults(creators);

        if (debugEnabled && !controller.signal.aborted) {
          pushDebugMetric({
            source: 'network',
            query: normalizedQuery,
            resultCount: creators.length,
            requestMs: Math.round(performance.now() - requestStartedAt),
            totalMs: Math.round(performance.now() - effectStartedAt),
            serverTiming,
            timestamp: new Date().toISOString(),
          });
        }
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

    const timeoutId = window.setTimeout(() => {
      fetchData();
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, limit, minChars, apiPrefix, debounceMs, onlyActiveSubscribers]);

  return { results, isLoading, error };
}
