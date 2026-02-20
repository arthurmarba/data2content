import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import type { PipelineStage } from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import PostReviewModel from "@/app/models/PostReview";
import { logger } from "@/app/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.POST_REVIEW_UNREAD_CACHE_TTL_MS ?? 15_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 15_000;
})();
const CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.POST_REVIEW_UNREAD_CACHE_MAX_ENTRIES ?? 10_000);
  return Number.isFinite(parsed) && parsed >= 500 ? Math.floor(parsed) : 10_000;
})();

const unreadCache = new Map<string, { unreadCount: number; expiresAt: number }>();

function pruneUnreadCache(nowTs: number) {
  for (const [key, value] of unreadCache.entries()) {
    if (value.expiresAt <= nowTs) unreadCache.delete(key);
  }
  if (unreadCache.size <= CACHE_MAX_ENTRIES) return;
  const overflow = unreadCache.size - CACHE_MAX_ENTRIES;
  const keys = Array.from(unreadCache.keys());
  for (let i = 0; i < overflow; i += 1) {
    const key = keys[i];
    if (!key) break;
    unreadCache.delete(key);
  }
}

function parseLimit(rawLimit: string | null): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseSince(rawSince: string | null): Date | null {
  if (!rawSince) return null;
  const parsed = new Date(rawSince);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  const userId = session?.user?.id as string | undefined;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const since = parseSince(searchParams.get("since"));

  const cacheKey = `${userId}|${since ? since.toISOString() : ""}|${limit}`;
  const nowTs = Date.now();
  pruneUnreadCache(nowTs);
  const cached = unreadCache.get(cacheKey);
  if (cached && cached.expiresAt > nowTs) {
    return NextResponse.json({ unreadCount: cached.unreadCount }, { status: 200 });
  }

  try {
    await connectToDatabase();

    const userObjectId = new Types.ObjectId(userId);
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
      { $match: { "post.user": userObjectId } },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
    ];

    if (since) {
      pipeline.push({ $match: { updatedAt: { $gt: since } } });
    }

    pipeline.push({ $count: "unreadCount" });

    const [agg] = await PostReviewModel.aggregate(pipeline).exec();
    const unreadCount = typeof agg?.unreadCount === "number" ? agg.unreadCount : 0;

    unreadCache.set(cacheKey, {
      unreadCount,
      expiresAt: nowTs + CACHE_TTL_MS,
    });

    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (error) {
    logger.error("[api/dashboard/post-reviews/unread-count] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
