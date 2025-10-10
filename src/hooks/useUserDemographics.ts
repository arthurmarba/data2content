import { useCallback } from "react";
import useCachedFetch, { UseCachedFetchReturn } from "./useCachedFetch";

export interface DemographicsData {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

export default function useUserDemographics(userId: string | null): UseCachedFetchReturn<DemographicsData> {
  const fetcher = useCallback(async (): Promise<DemographicsData> => {
    if (!userId) {
      throw new Error("ID de usuário inválido.");
    }
    const res = await fetch(`/api/demographics/${userId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }, [userId]);

  const result = useCachedFetch<DemographicsData>(`user_demographics_${userId}`, fetcher, 10 * 60 * 1000);

  if (!userId) {
    return { data: null, loading: false, error: null, refresh: async () => {} };
  }

  return result;
}
