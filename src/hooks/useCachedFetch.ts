import { useState, useEffect, useCallback } from "react";

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export interface UseCachedFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export default function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 10 * 60 * 1000 // 10 minutos
): UseCachedFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      if (!forceRefresh) {
        const cachedRaw =
          typeof window !== "undefined" ? localStorage.getItem(key) : null;
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as CacheEntry<T>;
          if (Date.now() - cached.timestamp < ttl) {
            setData(cached.data);
            setLoading(false);
            return;
          }
        }
      }

      const result = await fetcher();
      setData(result);
      if (typeof window !== "undefined") {
        const entry: CacheEntry<T> = { timestamp: Date.now(), data: result };
        localStorage.setItem(key, JSON.stringify(entry));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar dados");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refresh };
}