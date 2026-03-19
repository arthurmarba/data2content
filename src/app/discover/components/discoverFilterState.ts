import { canonicalizeCategoryValues, type CategoryType } from "@/app/lib/classification";

export type DiscoverFilterCategoryId = "format" | "proposal" | "context" | "tone" | "references";
export type DiscoverSelectedFilters = Record<DiscoverFilterCategoryId, string[]>;
export type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

export const DISCOVER_FILTER_ORDER: DiscoverFilterCategoryId[] = [
  "format",
  "proposal",
  "context",
  "tone",
  "references",
];

const FILTER_TYPE_BY_KEY: Record<DiscoverFilterCategoryId, CategoryType> = {
  format: "format",
  proposal: "proposal",
  context: "context",
  tone: "tone",
  references: "reference",
};

export function createEmptyDiscoverSelection(): DiscoverSelectedFilters {
  return DISCOVER_FILTER_ORDER.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as DiscoverSelectedFilters);
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function canonicalizeDiscoverFilterValues(
  key: DiscoverFilterCategoryId,
  values: string[] | string
): string[] {
  return canonicalizeCategoryValues(values, FILTER_TYPE_BY_KEY[key]);
}

export function buildDiscoverSelectedFromParams(params: SearchParamsLike): DiscoverSelectedFilters {
  const state = createEmptyDiscoverSelection();

  DISCOVER_FILTER_ORDER.forEach((key) => {
    state[key] = canonicalizeDiscoverFilterValues(key, parseCsv(params.get(key)));
  });

  return state;
}

export function buildDiscoverSearchParams(
  params: SearchParamsLike,
  state: DiscoverSelectedFilters
): URLSearchParams {
  const search = new URLSearchParams(params.toString());

  DISCOVER_FILTER_ORDER.forEach((key) => {
    const values = canonicalizeDiscoverFilterValues(key, state[key]);
    if (values.length > 0) {
      search.set(key, Array.from(new Set(values)).join(","));
    } else {
      search.delete(key);
    }
  });

  return search;
}
