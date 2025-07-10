import { useState, useEffect, useCallback } from "react";

export interface DemographicsData {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

interface UsePlatformDemographicsReturn {
  data: DemographicsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CACHE_KEY = "platform_demographics_cache";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export default function usePlatformDemographics(): UsePlatformDemographicsReturn {
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cachedRaw = typeof window !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { timestamp: number; data: DemographicsData };
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setData(cached.data);
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/v1/platform/demographics");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const json: DemographicsData = await res.json();
      setData(json);
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: json }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar dados");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
