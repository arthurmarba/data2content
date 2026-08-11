// src/app/api/admin/churn-reasons/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/getAdminSession";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import {
  CANCELLATION_REASONS,
} from "@/types/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  interval: z.enum(["month", "year"]).optional(),
  source: z.enum(["self_service", "portal", "agency"]).optional(),
});

type FacetCount = { _id: string | null; count: number };

function countMapFromFacet(rows: FacetCount[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = row._id == null ? "unknown" : String(row._id);
    out[key] = row.count;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const TAG = "[api/admin/churn-reasons][GET]";
  try {
    const session = await getAdminSession(req);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const { from, to, interval, source } = parsed.data;

    // Filtro base: só usuários com feedback de cancelamento registrado
    const match: Record<string, unknown> = {
      "cancellationFeedback.canceledAt": { $exists: true, $ne: null },
    };

    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      match["cancellationFeedback.canceledAt"] = range;
    }
    if (interval) match["cancellationFeedback.planInterval"] = interval;
    if (source) match["cancellationFeedback.source"] = source;

    await connectToDatabase();

    const [facet] = await User.aggregate<{
      total: { n: number }[];
      byReason: FacetCount[];
      byInterval: FacetCount[];
      bySource: FacetCount[];
      withComment: { n: number }[];
    }>([
      { $match: match },
      {
        $facet: {
          total: [{ $count: "n" }],
          byReason: [
            { $unwind: "$cancellationFeedback.reasonCodes" },
            {
              $group: {
                _id: "$cancellationFeedback.reasonCodes",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          byInterval: [
            {
              $group: {
                _id: "$cancellationFeedback.planInterval",
                count: { $sum: 1 },
              },
            },
          ],
          bySource: [
            {
              $group: {
                _id: "$cancellationFeedback.source",
                count: { $sum: 1 },
              },
            },
          ],
          withComment: [
            {
              $match: {
                "cancellationFeedback.comment": { $nin: [null, ""] },
              },
            },
            { $count: "n" },
          ],
        },
      },
    ]);

    const total = facet?.total?.[0]?.n ?? 0;
    const withComment = facet?.withComment?.[0]?.n ?? 0;

    // Garante que todos os códigos conhecidos apareçam (mesmo com count 0)
    const reasonCounts = countMapFromFacet(facet?.byReason ?? []);
    const byReason = CANCELLATION_REASONS.map(({ code, label }) => ({
      code,
      label,
      count: reasonCounts[code] ?? 0,
    }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const payload = {
      ok: true,
      range: {
        from: from ?? null,
        to: to ?? null,
      },
      filters: {
        interval: interval ?? null,
        source: source ?? null,
      },
      total,
      withComment,
      byReason,
      byInterval: countMapFromFacet(facet?.byInterval ?? []),
      bySource: countMapFromFacet(facet?.bySource ?? []),
    };

    logger.info(`${TAG} ok`, {
      endpoint: "GET /api/admin/churn-reasons",
      adminUserId: (session.user as any)?.id ?? null,
      total,
      from: from ?? null,
      to: to ?? null,
    });

    return NextResponse.json(payload, { headers: noStoreHeaders });
  } catch (err: any) {
    logger.error(`${TAG} failed`, err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
