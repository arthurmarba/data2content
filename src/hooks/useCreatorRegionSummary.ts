import { useCallback } from "react";
import useCachedFetch from "./useCachedFetch";

export interface CityBreakdown {
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
}

export interface StateBreakdown {
  state: string;
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
  const query = new URLSearchParams();
  if (options.gender) query.set("gender", options.gender);
  if (options.region) query.set("region", options.region);
  if (options.minAge) query.set("minAge", options.minAge);
  if (options.maxAge) query.set("maxAge", options.maxAge);

  const key = `creator_region_summary_${query.toString()}`;

  const fetcher = useCallback(async (): Promise<Record<string, StateBreakdown>> => {
    const res = await fetch(`/api/admin/creators/region-summary?${query.toString()}`);
    if (!res.ok) throw new Error(res.statusText);
    const json: ApiResponse = await res.json();
    const map: Record<string, StateBreakdown> = {};
    json.states.forEach(s => {
      map[s.state] = s;
    });
    return map;
  }, [key]);

  return useCachedFetch<Record<string, StateBreakdown>>(key, fetcher);
}
