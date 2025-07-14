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

export default function usePlatformDemographics(apiPrefix: string = '/api/v1/platform'): UseCachedFetchReturn<DemographicsData> {
  
  // A função fetcher agora depende do apiPrefix, garantindo que ela seja recriada se o prefixo mudar.
  const fetcher = useCallback(async (): Promise<DemographicsData> => {
    
    // CORREÇÃO: A URL agora inclui o segmento '/dashboard/' que estava faltando.
    const apiUrl = `${apiPrefix}/dashboard/demographics`;
    
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Not Found`); // Garante que o erro 404 seja exibido
    }
    return res.json();
  }, [apiPrefix]); // CORREÇÃO: apiPrefix foi adicionado ao array de dependências.

  return useCachedFetch<DemographicsData>(CACHE_KEY, fetcher, CACHE_TTL);
}
