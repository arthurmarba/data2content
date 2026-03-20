import { canonicalizeCategoryValues, type CategoryType } from "@/app/lib/classification";
import { buildMetricClassificationSnapshot } from "@/app/lib/classificationV2Bridge";
import { canonicalizeV2CategoryValues } from "@/app/lib/classificationV2";
import { canonicalizeV25CategoryValues } from "@/app/lib/classificationV2_5";

export type DiscoverFilterCategoryId =
  | "format"
  | "contentIntent"
  | "context"
  | "narrativeForm"
  | "contentSignals"
  | "stance"
  | "proofStyle"
  | "commercialMode"
  | "references";
export type DiscoverSelectedFilters = Record<DiscoverFilterCategoryId, string[]>;
export type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

export const DISCOVER_FILTER_ORDER: DiscoverFilterCategoryId[] = [
  "format",
  "contentIntent",
  "context",
  "narrativeForm",
  "contentSignals",
  "stance",
  "proofStyle",
  "commercialMode",
  "references",
];

const FILTER_TYPE_BY_KEY: Partial<Record<DiscoverFilterCategoryId, CategoryType>> = {
  format: "format",
  context: "context",
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
  if (key === "contentIntent") {
    return canonicalizeV2CategoryValues(values, "contentIntent");
  }
  if (key === "narrativeForm") {
    return canonicalizeV2CategoryValues(values, "narrativeForm");
  }
  if (key === "contentSignals") {
    return canonicalizeV2CategoryValues(values, "contentSignal");
  }
  if (key === "stance") {
    return canonicalizeV25CategoryValues(values, "stance");
  }
  if (key === "proofStyle") {
    return canonicalizeV25CategoryValues(values, "proofStyle");
  }
  if (key === "commercialMode") {
    return canonicalizeV25CategoryValues(values, "commercialMode");
  }
  return canonicalizeCategoryValues(values, FILTER_TYPE_BY_KEY[key]!);
}

export function buildDiscoverSelectedFromParams(params: SearchParamsLike): DiscoverSelectedFilters {
  const state = createEmptyDiscoverSelection();

  DISCOVER_FILTER_ORDER.forEach((key) => {
    state[key] = canonicalizeDiscoverFilterValues(key, parseCsv(params.get(key)));
  });

  const legacySnapshot = buildMetricClassificationSnapshot({
    proposal: parseCsv(params.get("proposal")),
    tone: parseCsv(params.get("tone")),
  });

  state.contentIntent = Array.from(
    new Set([...state.contentIntent, ...legacySnapshot.contentIntent])
  );
  state.narrativeForm = Array.from(
    new Set([...state.narrativeForm, ...legacySnapshot.narrativeForm])
  );

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

  search.delete("proposal");
  search.delete("tone");

  return search;
}
