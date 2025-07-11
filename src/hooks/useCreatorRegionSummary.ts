import { useCallback, useMemo } from "react";
import useCachedFetch from "./useCachedFetch";

// --- Tipos de Dados ---
export interface CityBreakdown {
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
}

export interface StateBreakdown {
  state: string; // Sigla do estado, ex: "SP"
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
  cities: Record<string, CityBreakdown>;
}

interface ApiResponse {
  states: StateBreakdown[];
}

export interface UseCreatorRegionSummaryOptions {
  gender?: string;
  region?: string;
  minAge?: string;
  maxAge?: string;
}

export default function useCreatorRegionSummary(options: UseCreatorRegionSummaryOptions) {
  // Memoizar a string de query para que ela só mude quando as opções realmente mudarem.
  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (options.gender) query.set("gender", options.gender);
    if (options.region) query.set("region", options.region);
    if (options.minAge) query.set("minAge", options.minAge);
    if (options.maxAge) query.set("maxAge", options.maxAge);
    return query.toString();
  }, [options.gender, options.region, options.minAge, options.maxAge]);

  const key = `creator_region_summary_${queryString}`;

  // Memoizar a função fetcher com useCallback.
  const fetcher = useCallback(async (): Promise<Record<string, StateBreakdown>> => {
    const res = await fetch(`/api/admin/creators/region-summary?${queryString}`);
    if (!res.ok) throw new Error(`Erro na API: ${res.statusText}`);
    const json: ApiResponse = await res.json();
    
    // Transforma o array de estados em um mapa (objeto) usando a sigla como chave
    return json.states.reduce((acc, state) => {
      acc[state.state] = state;
      return acc;
    }, {} as Record<string, StateBreakdown>);

  }, [queryString]); // A dependência agora é estável.

  return useCachedFetch<Record<string, StateBreakdown>>(key, fetcher);
}