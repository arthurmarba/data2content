import {
  buildDiscoverSearchParams,
  buildDiscoverSelectedFromParams,
} from "@/app/discover/components/discoverFilterState";

type BoardSurface = "board" | "full";

type BuildDiscoverBoardFeedQueryOptions = {
  limitPerRow: number;
  days: number;
  surface: BoardSurface;
};

const DISCOVER_BOARD_FILTER_PARAM_KEYS = [
  "format",
  "contentIntent",
  "context",
  "narrativeForm",
  "contentSignals",
  "stance",
  "proofStyle",
  "commercialMode",
  "references",
  "proposal",
  "tone",
] as const;

const DISCOVER_BOARD_PASSTHROUGH_PARAM_KEYS = ["videoOnly", "exp", "view"] as const;

function getCombinedParamValue(params: URLSearchParams, key: string) {
  const values = params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length ? Array.from(new Set(values)).join(",") : null;
}

export function buildDiscoverBoardFeedQueryString(
  searchParamsText: string,
  options: BuildDiscoverBoardFeedQueryOptions,
) {
  const source = new URLSearchParams(searchParamsText);
  const filterParams = new URLSearchParams();

  for (const key of DISCOVER_BOARD_FILTER_PARAM_KEYS) {
    const value = getCombinedParamValue(source, key);
    if (value) filterParams.set(key, value);
  }

  const normalized = buildDiscoverSearchParams(
    filterParams,
    buildDiscoverSelectedFromParams(filterParams),
  );

  for (const key of DISCOVER_BOARD_PASSTHROUGH_PARAM_KEYS) {
    const value = getCombinedParamValue(source, key);
    if (value) normalized.set(key, value);
  }

  normalized.set("limitPerRow", String(options.limitPerRow));
  normalized.set("days", String(options.days));
  normalized.set("surface", options.surface);

  return normalized.toString();
}
