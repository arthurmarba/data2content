import { NextRequest, NextResponse } from "next/server";

import { fetchCastingCreators } from "@/app/lib/landing/castingService";
import { logger } from "@/app/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 5;

const PUBLIC_CACHE_CONTROL =
  "public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400";
const BYPASS_CACHE_CONTROL = "no-store";

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  try {
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
    const mode = parseMode(req.nextUrl.searchParams.get("mode"));
    const search = req.nextUrl.searchParams.get("search") ?? null;
    const minFollowers = parseNumber(req.nextUrl.searchParams.get("minFollowers"));
    const minAvgInteractions = parseNumber(req.nextUrl.searchParams.get("minAvgInteractions"));
    const sort = parseSort(req.nextUrl.searchParams.get("sort"));
    const offset = parseNumber(req.nextUrl.searchParams.get("offset")) ?? 0;
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"), mode);

    const payload = await fetchCastingCreators({
      forceRefresh,
      mode,
      search,
      minFollowers,
      minAvgInteractions,
      sort,
      offset,
      limit,
    });

    const durationMs = performance.now() - startedAt;
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": forceRefresh ? BYPASS_CACHE_CONTROL : PUBLIC_CACHE_CONTROL,
        "Server-Timing": `casting;dur=${durationMs.toFixed(1)}`,
      },
    });
  } catch (error: any) {
    logger.error("[api/landing/casting] Failed to fetch casting creators:", error);
    return NextResponse.json({ error: "failed_to_fetch_casting" }, { status: 500 });
  }
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseSort(value: string | null): "interactions" | "followers" | "rank" | undefined {
  if (!value) return undefined;
  if (value === "followers" || value === "rank" || value === "interactions") return value;
  return undefined;
}

function parseMode(value: string | null): "featured" | "full" {
  return value === "featured" ? "featured" : "full";
}

function parseLimit(value: string | null, mode: "featured" | "full"): number | null {
  if (!value) return mode === "featured" ? 12 : null;
  return parseNumber(value);
}
