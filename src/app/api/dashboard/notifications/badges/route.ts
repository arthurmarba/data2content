import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import type { FilterQuery, PipelineStage } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { hasScriptsAccess } from "@/app/lib/scripts/access";
import Alert from "@/app/models/Alert";
import PostReviewModel from "@/app/models/PostReview";
import ScriptEntry from "@/app/models/ScriptEntry";
import type { IScriptEntry } from "@/app/models/ScriptEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REVIEWS_LIMIT = 50;
const MAX_REVIEWS_LIMIT = 100;

const BADGES_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.DASHBOARD_BADGES_CACHE_TTL_MS ?? 15_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 15_000;
})();
const BADGES_CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.DASHBOARD_BADGES_CACHE_MAX_ENTRIES ?? 10_000);
  return Number.isFinite(parsed) && parsed >= 500 ? Math.floor(parsed) : 10_000;
})();

const badgesCache = new Map<
  string,
  {
    alertsUnreadCount: number;
    reviewsUnreadCount: number;
    scriptsUnreadCount: number;
    expiresAt: number;
  }
>();

function parseSince(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseReviewsLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REVIEWS_LIMIT;
  return Math.min(Math.floor(parsed), MAX_REVIEWS_LIMIT);
}

function pruneBadgesCache(nowTs: number) {
  for (const [key, value] of badgesCache.entries()) {
    if (value.expiresAt <= nowTs) badgesCache.delete(key);
  }
  if (badgesCache.size <= BADGES_CACHE_MAX_ENTRIES) return;
  const overflow = badgesCache.size - BADGES_CACHE_MAX_ENTRIES;
  const keys = Array.from(badgesCache.keys());
  for (let i = 0; i < overflow; i += 1) {
    const key = keys[i];
    if (!key) break;
    badgesCache.delete(key);
  }
}

function buildRecommendationCondition(lastViewedAt: Date | null): FilterQuery<IScriptEntry> {
  if (!lastViewedAt) {
    return { isAdminRecommendation: true };
  }

  return {
    isAdminRecommendation: true,
    $or: [
      { recommendedAt: { $gt: lastViewedAt } },
      {
        $and: [
          { $or: [{ recommendedAt: null }, { recommendedAt: { $exists: false } }] },
          { updatedAt: { $gt: lastViewedAt } },
        ],
      },
    ],
  };
}

function buildFeedbackCondition(lastViewedAt: Date | null): FilterQuery<IScriptEntry> {
  const hasAnnotationCondition: FilterQuery<IScriptEntry> = {
    adminAnnotation: { $nin: [null, ""] },
  };

  if (!lastViewedAt) {
    return hasAnnotationCondition;
  }

  return {
    ...hasAnnotationCondition,
    $or: [
      { adminAnnotationUpdatedAt: { $gt: lastViewedAt } },
      {
        $and: [
          { $or: [{ adminAnnotationUpdatedAt: null }, { adminAnnotationUpdatedAt: { $exists: false } }] },
          { updatedAt: { $gt: lastViewedAt } },
        ],
      },
    ],
  };
}

async function countUnreadPostReviews(params: { userId: Types.ObjectId; since: Date | null; limit: number }) {
  const { userId, since, limit } = params;
  const pipeline: PipelineStage[] = [
    {
      $lookup: {
        from: "metrics",
        localField: "postId",
        foreignField: "_id",
        as: "post",
      },
    },
    { $unwind: "$post" },
    { $match: { "post.user": userId } },
    { $sort: { updatedAt: -1 } },
    { $limit: limit },
  ];

  if (since) {
    pipeline.push({ $match: { updatedAt: { $gt: since } } });
  }

  pipeline.push({ $count: "unreadCount" });
  const [agg] = await PostReviewModel.aggregate(pipeline).exec();
  return typeof agg?.unreadCount === "number" ? agg.unreadCount : 0;
}

export async function GET(request: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const reviewsSince = parseSince(url.searchParams.get("reviewsSince"));
  const scriptsRecommendationsSince = parseSince(url.searchParams.get("scriptsRecommendationsSince"));
  const scriptsFeedbackSince = parseSince(url.searchParams.get("scriptsFeedbackSince"));
  const reviewsLimit = parseReviewsLimit(url.searchParams.get("reviewsLimit"));

  const cacheKey = [
    userId,
    reviewsSince ? reviewsSince.toISOString() : "",
    scriptsRecommendationsSince ? scriptsRecommendationsSince.toISOString() : "",
    scriptsFeedbackSince ? scriptsFeedbackSince.toISOString() : "",
    reviewsLimit,
  ].join("|");

  const nowTs = Date.now();
  pruneBadgesCache(nowTs);
  const cached = badgesCache.get(cacheKey);
  if (cached && cached.expiresAt > nowTs) {
    return NextResponse.json({
      alertsUnreadCount: cached.alertsUnreadCount,
      reviewsUnreadCount: cached.reviewsUnreadCount,
      scriptsUnreadCount: cached.scriptsUnreadCount,
    });
  }

  try {
    await connectToDatabase();
    const userObjectId = new Types.ObjectId(userId);
    const canAccessScripts = hasScriptsAccess(session?.user);

    const [alertsUnreadCount, reviewsUnreadCount, scriptsUnreadCountRaw] = await Promise.all([
      Alert.countDocuments({
        user: userId,
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      }),
      countUnreadPostReviews({
        userId: userObjectId,
        since: reviewsSince,
        limit: reviewsLimit,
      }),
      canAccessScripts
        ? ScriptEntry.countDocuments({
            userId: userObjectId,
            $or: [
              buildRecommendationCondition(scriptsRecommendationsSince),
              buildFeedbackCondition(scriptsFeedbackSince),
            ],
          })
        : Promise.resolve(0),
    ]);
    const scriptsUnreadCount = canAccessScripts ? scriptsUnreadCountRaw : 0;

    badgesCache.set(cacheKey, {
      alertsUnreadCount,
      reviewsUnreadCount,
      scriptsUnreadCount,
      expiresAt: nowTs + BADGES_CACHE_TTL_MS,
    });

    return NextResponse.json({ alertsUnreadCount, reviewsUnreadCount, scriptsUnreadCount });
  } catch (error) {
    logger.error("[api/dashboard/notifications/badges] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
