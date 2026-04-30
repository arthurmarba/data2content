import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import PostCreationFunnelEvent from "@/app/models/PostCreationFunnelEvent";

const DEFAULT_WINDOW_DAYS = 30;
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
  return Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.floor(raw)));
}

function roundMetric(value: unknown, decimals = 2): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const windowDays = parseWindowDays(url.searchParams);
  const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  await connectToDatabase();

  const [overviewAgg, stepAgg, optionAgg, latestStageAgg, laneAgg, pathAgg, recentAgg] = await Promise.all([
    PostCreationFunnelEvent.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          draftIds: { $addToSet: "$draftId" },
          checkpointSelections: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_checkpoint_selected"] }, 1, 0] },
          },
          checkpointRecommendedSelections: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventName", "post_creation_checkpoint_selected"] },
                    { $eq: ["$recommendedSelected", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          ideaSelections: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_idea_selected"] }, 1, 0] },
          },
          ideaRecommendedSelections: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventName", "post_creation_idea_selected"] },
                    { $eq: ["$recommendedSelected", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          blueprintActivations: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_blueprint_activated"] }, 1, 0] },
          },
          scriptStarts: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_blueprint_script_started"] }, 1, 0] },
          },
          scriptSuccesses: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_blueprint_script_succeeded"] }, 1, 0] },
          },
          scriptFailures: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_blueprint_script_failed"] }, 1, 0] },
          },
          scriptOpens: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$eventName",
                    ["post_creation_blueprint_script_opened", "post_creation_script_opened"],
                  ],
                },
                1,
                0,
              ],
            },
          },
          scriptSaves: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_script_saved"] }, 1, 0] },
          },
          contentLinked: {
            $sum: { $cond: [{ $eq: ["$eventName", "post_creation_content_linked"] }, 1, 0] },
          },
        },
      },
    ]),
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventName: "post_creation_checkpoint_selected",
          step: { $in: ["window", "proposal", "context", "tone", "theme"] },
        },
      },
      {
        $group: {
          _id: "$step",
          count: { $sum: 1 },
          recommendedCount: { $sum: { $cond: [{ $eq: ["$recommendedSelected", true] }, 1, 0] } },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
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
            optionLabel: "$metadata.option_label",
          },
          count: { $sum: 1 },
          recommendedCount: { $sum: { $cond: [{ $eq: ["$recommendedSelected", true] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]),
    PostCreationFunnelEvent.aggregate([
      { $match: { createdAt: { $gte: startDate }, draftId: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$draftId",
          latestStage: { $first: "$stage" },
          latestEventName: { $first: "$eventName" },
        },
      },
      {
        $group: {
          _id: "$latestStage",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
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
      { $sort: { count: -1, _id: 1 } },
    ]),
    PostCreationFunnelEvent.aggregate([
      {
        $match: {
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
    PostCreationFunnelEvent.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $sort: { createdAt: -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          createdAt: 1,
          eventName: 1,
          stage: 1,
          step: 1,
          slotId: 1,
          scriptId: 1,
          ideaId: 1,
          contentId: 1,
          source: 1,
          lane: 1,
          recommendedSelected: 1,
        },
      },
    ]),
  ]);

  const overviewRaw = overviewAgg[0] || {};
  const distinctDrafts = Array.isArray(overviewRaw.draftIds)
    ? overviewRaw.draftIds.filter(Boolean).length
    : 0;

  const overview = {
    totalEvents: Number(overviewRaw.totalEvents || 0),
    distinctDrafts,
    checkpointSelections: Number(overviewRaw.checkpointSelections || 0),
    checkpointRecommendedSelections: Number(overviewRaw.checkpointRecommendedSelections || 0),
    ideaSelections: Number(overviewRaw.ideaSelections || 0),
    ideaRecommendedSelections: Number(overviewRaw.ideaRecommendedSelections || 0),
    blueprintActivations: Number(overviewRaw.blueprintActivations || 0),
    scriptStarts: Number(overviewRaw.scriptStarts || 0),
    scriptSuccesses: Number(overviewRaw.scriptSuccesses || 0),
    scriptFailures: Number(overviewRaw.scriptFailures || 0),
    scriptOpens: Number(overviewRaw.scriptOpens || 0),
    scriptSaves: Number(overviewRaw.scriptSaves || 0),
    contentLinked: Number(overviewRaw.contentLinked || 0),
    checkpointRecommendationAcceptanceRate:
      Number(overviewRaw.checkpointSelections || 0) > 0
        ? Number(overviewRaw.checkpointRecommendedSelections || 0) / Number(overviewRaw.checkpointSelections || 0)
        : 0,
    ideaRecommendationAcceptanceRate:
      Number(overviewRaw.ideaSelections || 0) > 0
        ? Number(overviewRaw.ideaRecommendedSelections || 0) / Number(overviewRaw.ideaSelections || 0)
        : 0,
    blueprintToScriptRate:
      Number(overviewRaw.blueprintActivations || 0) > 0
        ? Number(overviewRaw.scriptSuccesses || 0) / Number(overviewRaw.blueprintActivations || 0)
        : 0,
    scriptToLinkedRate:
      Number(overviewRaw.scriptSuccesses || 0) > 0
        ? Number(overviewRaw.contentLinked || 0) / Number(overviewRaw.scriptSuccesses || 0)
        : 0,
  };

  const checkpointOptions = optionAgg.slice(0, 12).map((row: any) => ({
    step: String(row?._id?.step || "unknown"),
    optionId: String(row?._id?.optionId || "unknown"),
    optionLabel: String(row?._id?.optionLabel || row?._id?.optionId || "unknown"),
    count: Number(row.count || 0),
    recommendedCount: Number(row.recommendedCount || 0),
    recommendedRate:
      Number(row.count || 0) > 0 ? roundMetric(Number(row.recommendedCount || 0) / Number(row.count || 0), 3) : 0,
  }));

  const checkpointRules = checkpointOptions
    .map((row) => {
      const rule = buildRuleStrength(row.count, Number(row.recommendedRate || 0), 0.72, 0.28);
      if (!rule) return null;
      return {
        step: row.step,
        optionId: row.optionId,
        optionLabel: row.optionLabel,
        mode: rule.mode,
        strength: roundMetric(rule.strength, 3),
      };
    })
    .filter(Boolean);

  const ideaLanes = laneAgg.map((row: any) => ({
    lane: String(row._id || "unknown"),
    count: Number(row.count || 0),
    avgConfidence: roundMetric(row.avgConfidence, 3),
    recommendedCount: Number(row.recommendedCount || 0),
    recommendedRate:
      Number(row.count || 0) > 0 ? roundMetric(Number(row.recommendedCount || 0) / Number(row.count || 0), 3) : 0,
  }));

  const laneRules = ideaLanes
    .map((row) => {
      const rule = buildRuleStrength(row.count, Number(row.recommendedRate || 0), 0.66, 0.22);
      if (!rule) return null;
      return {
        lane: row.lane,
        mode: rule.mode,
        strength: roundMetric(rule.strength, 3),
      };
    })
    .filter(Boolean);

  const topPaths = pathAgg.slice(0, 10).map((row: any) => ({
    pathKey: String(row._id || "unknown"),
    count: Number(row.count || 0),
    avgConfidence: roundMetric(row.avgConfidence, 3),
    recommendedCount: Number(row.recommendedCount || 0),
    recommendedRate:
      Number(row.count || 0) > 0 ? roundMetric(Number(row.recommendedCount || 0) / Number(row.count || 0), 3) : 0,
  }));

  const pathRules = topPaths
    .map((row) => {
      const rule = buildRuleStrength(row.count, Number(row.recommendedRate || 0), 0.66, 0.24);
      if (!rule) return null;
      return {
        pathKey: row.pathKey,
        mode: rule.mode,
        strength: roundMetric(rule.strength, 3),
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    windowDays,
    from: startDate.toISOString(),
    overview,
    checkpointSteps: stepAgg.map((row: any) => ({
      step: String(row._id || "unknown"),
      count: Number(row.count || 0),
      recommendedCount: Number(row.recommendedCount || 0),
      recommendedRate:
        Number(row.count || 0) > 0 ? roundMetric(Number(row.recommendedCount || 0) / Number(row.count || 0), 3) : 0,
    })),
    checkpointOptions,
    checkpointRules,
    latestStageDistribution: latestStageAgg.map((row: any) => ({
      stage: String(row._id || "unknown"),
      count: Number(row.count || 0),
    })),
    ideaLanes,
    laneRules,
    topPaths,
    pathRules,
    recentEvents: recentAgg.map((row: any) => ({
      id: row.id,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      eventName: String(row.eventName || "unknown"),
      stage: String(row.stage || "unknown"),
      step: row.step ? String(row.step) : null,
      slotId: row.slotId || null,
      scriptId: row.scriptId || null,
      ideaId: row.ideaId || null,
      contentId: row.contentId || null,
      source: row.source || null,
      lane: row.lane || null,
      recommendedSelected: typeof row.recommendedSelected === "boolean" ? row.recommendedSelected : null,
    })),
  });
}
