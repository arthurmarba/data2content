import { NextRequest, NextResponse } from "next/server";

import { fetchCastingCreators } from "@/app/lib/landing/castingService";
import { logger } from "@/app/lib/logger";

export const dynamic = "force-dynamic";

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
        "Cache-Control": "no-store",
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
