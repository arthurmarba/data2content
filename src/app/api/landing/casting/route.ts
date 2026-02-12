import { NextRequest, NextResponse } from "next/server";

import { fetchCastingCreators } from "@/app/lib/landing/castingService";
import { logger } from "@/app/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 5;

const PUBLIC_CACHE_CONTROL =
  "public, max-age=30, s-maxage=300, stale-while-revalidate=1800, stale-if-error=3600";
const BYPASS_CACHE_CONTROL = "no-store";

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
    const search = req.nextUrl.searchParams.get("search") ?? null;
    const minFollowers = parseNumber(req.nextUrl.searchParams.get("minFollowers"));
    const minAvgInteractions = parseNumber(req.nextUrl.searchParams.get("minAvgInteractions"));
    const sort = parseSort(req.nextUrl.searchParams.get("sort"));
    const limit = parseNumber(req.nextUrl.searchParams.get("limit"));

    const payload = await fetchCastingCreators({
      forceRefresh,
      search,
      minFollowers,
      minAvgInteractions,
      sort,
      limit,
    });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": forceRefresh ? BYPASS_CACHE_CONTROL : PUBLIC_CACHE_CONTROL,
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
