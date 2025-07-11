import useCachedFetch, { UseCachedFetchReturn } from "./useCachedFetch";
import { useCallback } from "react";

export interface DemographicsData {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

const CACHE_KEY = "platform_demographics_cache";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export default function usePlatformDemographics(): UseCachedFetchReturn<DemographicsData> {
  const fetcher = useCallback(async (): Promise<DemographicsData> => {
    const res = await fetch("/api/v1/platform/demographics");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }, []);

  return useCachedFetch<DemographicsData>(CACHE_KEY, fetcher, CACHE_TTL);
}