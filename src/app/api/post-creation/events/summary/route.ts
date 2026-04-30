import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { validatePostCreationBoardAccess } from "@/app/lib/postCreationTrial/access";
import { resolveTargetScriptsUser } from "@/app/lib/scripts/access";
import PostCreationFunnelEvent from "@/app/models/PostCreationFunnelEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 120;
const MAX_WINDOW_DAYS = 365;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function buildRuleStrength(count: number, rate: number, positiveThreshold: number, negativeThreshold: number) {
  if (count < 3) return null;
  if (rate >= positiveThreshold) {
    return {
      mode: "promote" as const,
      strength: clamp01((count / 10) * 0.45 + (rate - positiveThreshold) * 1.6),
    };
  }
  if (rate <= negativeThreshold) {
    return {
      mode: "degrade" as const,
      strength: clamp01((count / 10) * 0.35 + (negativeThreshold - rate) * 1.4),
    };
  }
  return null;
}

function parseWindowDays(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("days") || DEFAULT_WINDOW_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_WINDOW_DAYS;
  return Math.max(7, Math.min(MAX_WINDOW_DAYS, Math.floor(raw)));
}

async function getAuthenticatedSession() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (typeof userId !== "string" || !userId.trim()) return null;
  return session;
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validatePostCreationBoardAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, reason: access.reason }, { status: access.status });
  }

  const url = new URL(request.url);
  const windowDays = parseWindowDays(url.searchParams);
  const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: url.searchParams.get("targetUserId"),
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }

  await connectToDatabase();
  const userId = new Types.ObjectId(targetResolution.userId);

  const [stepAgg, laneAgg, pathAgg] = await Promise.all([
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          eventName: "post_creation_checkpoint_selected",
          step: { $in: ["window", "proposal", "context", "tone", "theme"] },
          "metadata.option_id": { $type: "string" },
        },
      },
      {
        $group: {
          _id: {
            step: "$step",
            optionId: "$metadata.option_id",
          },
          count: { $sum: 1 },
          recommendedCount: {
            $sum: { $cond: [{ $eq: ["$recommendedSelected", true] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]),
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          eventName: "post_creation_idea_selected",
          lane: { $in: ["recommended", "safe", "bold", "practical"] },
        },
      },
      {
        $group: {
          _id: "$lane",
          count: { $sum: 1 },
          avgConfidence: { $avg: "$confidence" },
          recommendedCount: { $sum: { $cond: [{ $eq: ["$recommendedSelected", true] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]),
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          eventName: "post_creation_idea_selected",
          "metadata.path_key": { $type: "string" },
        },
      },
      {
        $group: {
          _id: "$metadata.path_key",
          count: { $sum: 1 },
          avgConfidence: { $avg: "$confidence" },
          recommendedCount: { $sum: { $cond: [{ $eq: ["$recommendedSelected", true] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  const stepPreferences = stepAgg.reduce<Record<string, Array<{ optionId: string; count: number; recommendedRate: number }>>>(
    (acc, row: any) => {
      const step = String(row?._id?.step || "");
      const optionId = String(row?._id?.optionId || "");
      if (!step || !optionId) return acc;
      if (!acc[step]) acc[step] = [];
      acc[step].push({
        optionId,
        count: Number(row.count || 0),
        recommendedRate:
          Number(row.count || 0) > 0 ? Number(row.recommendedCount || 0) / Number(row.count || 0) : 0,
      });
      return acc;
    },
    {}
  );

  const stepRules = Object.entries(stepPreferences).reduce<Record<string, Array<{ optionId: string; mode: "promote" | "degrade"; strength: number }>>>(
    (acc, [step, options]) => {
      const rules = options
        .map((item) => {
          const rule = buildRuleStrength(item.count, item.recommendedRate, 0.72, 0.28);
          if (!rule) return null;
          return {
            optionId: item.optionId,
            mode: rule.mode,
            strength: Number(rule.strength.toFixed(3)),
          };
        })
        .filter(Boolean) as Array<{ optionId: string; mode: "promote" | "degrade"; strength: number }>;
      if (rules.length) {
        acc[step] = rules;
      }
      return acc;
    },
    {}
  );

  const lanePreferences = laneAgg.map((row: any) => ({
    lane: String(row._id || "recommended"),
    count: Number(row.count || 0),
    avgConfidence: typeof row.avgConfidence === "number" ? row.avgConfidence : null,
    recommendedRate:
      Number(row.count || 0) > 0 ? Number(row.recommendedCount || 0) / Number(row.count || 0) : 0,
  }));

  const laneRules = lanePreferences
    .map((item) => {
      const rule = buildRuleStrength(item.count, item.recommendedRate || 0, 0.66, 0.22);
      if (!rule) return null;
      return {
        lane: item.lane,
        mode: rule.mode,
        strength: Number(rule.strength.toFixed(3)),
      };
    })
    .filter(Boolean);

  const pathPreferences = pathAgg.map((row: any) => ({
    pathKey: String(row._id || ""),
    count: Number(row.count || 0),
    avgConfidence: typeof row.avgConfidence === "number" ? row.avgConfidence : null,
    recommendedRate:
      Number(row.count || 0) > 0 ? Number(row.recommendedCount || 0) / Number(row.count || 0) : 0,
  }));

  const pathRules = pathPreferences
    .map((item) => {
      const rule = buildRuleStrength(item.count, item.recommendedRate || 0, 0.66, 0.24);
      if (!rule) return null;
      return {
        pathKey: item.pathKey,
        mode: rule.mode,
        strength: Number(rule.strength.toFixed(3)),
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    windowDays,
    from: startDate.toISOString(),
    stepPreferences,
    stepRules,
    lanePreferences,
    laneRules,
    pathPreferences,
    pathRules,
  });
}
