import { PipelineStage, Types } from "mongoose";
import { subDays } from "date-fns";

import { connectToDatabase } from "@/app/lib/dataService/connection";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import AccountInsightModel from "@/app/models/AccountInsight";
import { logger } from "@/app/lib/logger";
import type { LandingCreatorHighlight } from "@/types/landing";

const SERVICE_TAG = "[landing][castingService]";
const CACHE_TTL_MS = Math.max(60_000, Number(process.env.LANDING_CASTING_TTL_MS ?? 240_000));
const RANK_WINDOW_DAYS = 30;
const ACTIVE_PLAN_STATUSES = ["active", "trial", "trialing", "non_renewing"] as const;
const MAX_LIMIT = 2000;

type CacheEntry = {
  expires: number;
  creators: LandingCreatorHighlight[];
};

type SubscriberUser = {
  _id: Types.ObjectId;
  name?: string | null;
  username?: string | null;
  followers_count?: number | null;
  profile_picture_url?: string | null;
  mediaKitSlug?: string | null;
};

export type CastingFilters = {
  forceRefresh?: boolean;
  search?: string | null;
  minFollowers?: number | null;
  minAvgInteractions?: number | null;
  sort?: "interactions" | "followers" | "rank";
  limit?: number | null;
};

let cacheEntry: CacheEntry | null = null;

export async function fetchCastingCreators(options: CastingFilters = {}) {
  const base = await loadBaseList(options.forceRefresh === true);
  const filters = normalizeFilters(options);

  let filtered = [...base];

  if (filters.search) {
    const term = normalizeText(filters.search);
    filtered = filtered.filter((creator) => {
      const name = normalizeText(creator.name ?? "");
      const username = normalizeText(creator.username ?? "");
      return name.includes(term) || username.includes(term);
    });
  }

  if (filters.minFollowers != null) {
    filtered = filtered.filter((creator) => (creator.followers ?? 0) >= filters.minFollowers!);
  }

  if (filters.minAvgInteractions != null) {
    filtered = filtered.filter(
      (creator) => (creator.avgInteractionsPerPost ?? 0) >= filters.minAvgInteractions!,
    );
  }

  const total = filtered.length;
  const sorted = sortCreators(filtered, filters.sort);
  const limited = filters.limit != null ? sorted.slice(0, filters.limit) : sorted;

  return { creators: limited, total };
}

async function loadBaseList(forceRefresh: boolean): Promise<LandingCreatorHighlight[]> {
  const now = Date.now();
  if (!forceRefresh && cacheEntry && cacheEntry.expires > now) {
    return cacheEntry.creators;
  }

  const creators = await buildCastingCreators();
  cacheEntry = { creators, expires: now + CACHE_TTL_MS };
  return creators;
}

function normalizeFilters(options: CastingFilters) {
  const searchRaw = options.search?.trim() || null;
  const search = searchRaw?.startsWith("@") ? searchRaw.slice(1) : searchRaw;
  const minFollowers =
    options.minFollowers != null && Number.isFinite(options.minFollowers) && options.minFollowers >= 0
      ? Math.floor(options.minFollowers)
      : null;
  const minAvgInteractions =
    options.minAvgInteractions != null &&
    Number.isFinite(options.minAvgInteractions) &&
    options.minAvgInteractions >= 0
      ? Math.floor(options.minAvgInteractions)
      : null;
  const sort: CastingFilters["sort"] =
    options.sort === "followers" || options.sort === "rank" ? options.sort : "interactions";
  const limit =
    options.limit != null && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(options.limit)))
      : null;

  return { search, minFollowers, minAvgInteractions, sort, limit };
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function sortCreators(
  creators: LandingCreatorHighlight[],
  sort: CastingFilters["sort"],
): LandingCreatorHighlight[] {
  const sorted = [...creators];
  if (sort === "followers") {
    sorted.sort((a, b) => {
      const diff = (b.followers ?? 0) - (a.followers ?? 0);
      if (diff !== 0) return diff;
      return a.rank - b.rank;
    });
    return sorted;
  }

  if (sort === "rank") {
    sorted.sort((a, b) => a.rank - b.rank);
    return sorted;
  }

  sorted.sort((a, b) => {
    if (b.totalInteractions !== a.totalInteractions) return b.totalInteractions - a.totalInteractions;
    if (b.postCount !== a.postCount) return b.postCount - a.postCount;
    return a.rank - b.rank;
  });

  return sorted;
}

async function buildCastingCreators(): Promise<LandingCreatorHighlight[]> {
  const TAG = `${SERVICE_TAG}[buildCastingCreators]`;
  logger.info(`${TAG} Building casting creators list.`);

  await connectToDatabase();

  const since = subDays(new Date(), RANK_WINDOW_DAYS);
  const subscribers = (await UserModel.find(
    {
      planStatus: { $in: ACTIVE_PLAN_STATUSES },
      mediaKitSlug: { $exists: true, $nin: [null, ""] },
    },
    {
      _id: 1,
      name: 1,
      username: 1,
      followers_count: 1,
      profile_picture_url: 1,
      mediaKitSlug: 1,
    },
  )
    .lean<SubscriberUser[]>()
    .exec()) as SubscriberUser[];

  if (!subscribers.length) {
    logger.warn(`${TAG} No active subscribers found for casting payload.`);
    return [];
  }

  const subscriberIds = subscribers
    .map((creator) => creator._id)
    .filter((id): id is Types.ObjectId => Boolean(id));

  const metricsPipeline: PipelineStage[] = [
    {
      $match: {
        user: { $in: subscriberIds },
        postDate: { $gte: since },
      },
    },
    {
      $group: {
        _id: "$user",
        postCount: { $sum: 1 },
        totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        postCount: 1,
        totalInteractions: 1,
        avgInteractionsPerPost: {
          $cond: [{ $gt: ["$postCount", 0] }, { $divide: ["$totalInteractions", "$postCount"] }, 0],
        },
      },
    },
  ];

  const metricsResults = (await MetricModel.aggregate(metricsPipeline).exec()) as Array<{
    userId: Types.ObjectId;
    postCount: number;
    totalInteractions: number;
    avgInteractionsPerPost: number;
  }>;

  const metricsByUser = new Map<
    string,
    { postCount: number; totalInteractions: number; avgInteractionsPerPost: number }
  >(
    metricsResults.map((entry) => [
      entry.userId.toString(),
      {
        postCount: Number(entry.postCount ?? 0),
        totalInteractions: Number(entry.totalInteractions ?? 0),
        avgInteractionsPerPost: Number(entry.avgInteractionsPerPost ?? 0),
      },
    ]),
  );

  const missingAvatarIds = subscribers
    .filter((creator) => !creator.profile_picture_url)
    .map((creator) => creator._id)
    .filter((id): id is Types.ObjectId => Boolean(id));

  let avatarByUserId: Record<string, string> = {};
  if (missingAvatarIds.length) {
    const insightAvatars = await AccountInsightModel.aggregate<{
      _id: Types.ObjectId;
      profilePicture?: string | null;
    }>([
      {
        $match: {
          user: { $in: missingAvatarIds },
          "accountDetails.profile_picture_url": { $exists: true, $nin: [null, ""] },
        },
      },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: "$user",
          profilePicture: { $first: "$accountDetails.profile_picture_url" },
        },
      },
    ]).exec();

    avatarByUserId = Object.fromEntries(
      insightAvatars
        .filter((doc) => doc.profilePicture)
        .map((doc) => [doc._id.toString(), doc.profilePicture as string]),
    );
  }

  const creators = subscribers.map((creator) => {
    const userId = creator._id.toString();
    const metrics = metricsByUser.get(userId);
    const avatar = creator.profile_picture_url ?? avatarByUserId[userId] ?? null;

    return {
      id: userId,
      name: creator.name || creator.username || "Criador",
      username: creator.username ?? null,
      followers: creator.followers_count ?? null,
      avatarUrl: toProxyAvatar(avatar),
      totalInteractions: metrics?.totalInteractions ?? 0,
      postCount: metrics?.postCount ?? 0,
      avgInteractionsPerPost: metrics?.avgInteractionsPerPost ?? 0,
      rank: 0, // placeholder until sorted
      consistencyScore: null,
      mediaKitSlug: creator.mediaKitSlug ?? null,
    } satisfies LandingCreatorHighlight;
  });

  creators.sort((a, b) => {
    if (b.totalInteractions !== a.totalInteractions) return b.totalInteractions - a.totalInteractions;
    if (b.postCount !== a.postCount) return b.postCount - a.postCount;
    const followersA = a.followers ?? 0;
    const followersB = b.followers ?? 0;
    return followersB - followersA;
  });

  return creators.map((creator, index) => ({
    ...creator,
    rank: index + 1,
  }));
}

function toProxyAvatar(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("/api/proxy/thumbnail/")) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  }
  return raw;
}
