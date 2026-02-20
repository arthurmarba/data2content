import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import type { FilterQuery } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";
import ScriptEntry from "@/app/models/ScriptEntry";
import type { IScriptEntry } from "@/app/models/ScriptEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_UNREAD_COUNT_CACHE_TTL_MS ?? 20_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 20_000;
})();
const CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.SCRIPTS_UNREAD_COUNT_CACHE_MAX_ENTRIES ?? 10_000);
  return Number.isFinite(parsed) && parsed >= 500 ? Math.floor(parsed) : 10_000;
})();

const unreadCountCache = new Map<string, { unreadCount: number; expiresAt: number }>();

function pruneUnreadCountCache(nowTs: number) {
  for (const [key, value] of unreadCountCache.entries()) {
    if (value.expiresAt <= nowTs) unreadCountCache.delete(key);
  }
  if (unreadCountCache.size <= CACHE_MAX_ENTRIES) return;
  const overflow = unreadCountCache.size - CACHE_MAX_ENTRIES;
  const keys = Array.from(unreadCountCache.keys());
  for (let i = 0; i < overflow; i += 1) {
    const key = keys[i];
    if (!key) break;
    unreadCountCache.delete(key);
  }
}

function parseSince(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

export async function GET(request: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validateScriptsAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error, reason: access.reason },
      { status: access.status }
    );
  }

  const url = new URL(request.url);
  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: url.searchParams.get("targetUserId"),
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }

  const recommendationsSince = parseSince(url.searchParams.get("recommendationsSince"));
  const feedbackSince = parseSince(url.searchParams.get("feedbackSince"));
  const effectiveUserId = targetResolution.userId;

  const cacheKey = [
    effectiveUserId,
    recommendationsSince ? recommendationsSince.toISOString() : "",
    feedbackSince ? feedbackSince.toISOString() : "",
  ].join("|");

  const nowTs = Date.now();
  pruneUnreadCountCache(nowTs);
  const cached = unreadCountCache.get(cacheKey);
  if (cached && cached.expiresAt > nowTs) {
    return NextResponse.json({ unreadCount: cached.unreadCount }, { status: 200 });
  }

  try {
    await connectToDatabase();

    const query: FilterQuery<IScriptEntry> = {
      userId: new Types.ObjectId(effectiveUserId),
      $or: [buildRecommendationCondition(recommendationsSince), buildFeedbackCondition(feedbackSince)],
    };
    const unreadCount = await ScriptEntry.countDocuments(query);

    unreadCountCache.set(cacheKey, {
      unreadCount,
      expiresAt: nowTs + CACHE_TTL_MS,
    });

    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (error) {
    logger.error("[api/scripts/unread-count] Failed to compute unread count", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
