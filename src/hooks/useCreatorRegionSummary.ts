/*
 * =============================================================================
 * ARQUIVO 2: src/hooks/useCreatorRegionSummary.ts (Recomendo renomear para useAudienceRegionSummary.ts)
 * =============================================================================
 */
import { useCallback, useMemo } from "react";
import useCachedFetch from "./useCachedFetch";

export interface CityBreakdown {
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
}

export interface StateBreakdown {
  state: string;
  count: number;
  density?: number;
  gender: Record<string, number>;
  age: Record<string, number>;
  cities: Record<string, CityBreakdown>;
}

interface ApiResponse {
  states: StateBreakdown[];
}

// --- ATUALIZAÇÃO: Adicionar os novos filtros à interface ---
export interface UseAudienceRegionSummaryOptions {
  region?: string;
  gender?: string;
  ageRange?: string;
  userId?: string;
}

// O nome da função foi atualizado para refletir o seu propósito
export default function useAudienceRegionSummary(options: UseAudienceRegionSummaryOptions & { apiPrefix?: string }) {
  const { apiPrefix = '/api/admin' } = options;
  // --- ATUALIZAÇÃO: Incluir os novos filtros na query string ---
  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (options.region) query.set("region", options.region);
    if (options.gender) query.set("gender", options.gender);
    if (options.ageRange) query.set("ageRange", options.ageRange);
    if (options.userId) query.set("userId", options.userId);
    return query.toString();
  }, [options.region, options.gender, options.ageRange, options.userId]);

  const key = `audience_region_summary_${apiPrefix}_${queryString}`;

  const fetcher = useCallback(async (): Promise<Record<string, StateBreakdown>> => {
    const res = await fetch(`${apiPrefix}/creators/region-summary?${queryString}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Erro na API: ${res.statusText}`);
    const json: ApiResponse = await res.json();

    return json.states.reduce((acc, state) => {
      acc[state.state] = state;
      return acc;
    }, {} as Record<string, StateBreakdown>);

  }, [queryString, apiPrefix]);

  return useCachedFetch<Record<string, StateBreakdown>>(key, fetcher);
}
