import { PipelineStage, Types } from "mongoose";
import { subDays } from "date-fns";

import { connectToDatabase } from "@/app/lib/dataService/connection";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import AccountInsightModel from "@/app/models/AccountInsight";
import { logger } from "@/app/lib/logger";
import type { CreatorStage, LandingCreatorHighlight } from "@/types/landing";
import { resolveContextLabel } from "@/app/lib/classification";

const SERVICE_TAG = "[landing][castingService]";
const CACHE_TTL_MS = Math.max(60_000, Number(process.env.LANDING_CASTING_TTL_MS ?? 240_000));
const RANK_WINDOW_DAYS = 30;
const ACTIVE_PLAN_STATUSES = ["active", "trial", "trialing", "non_renewing"] as const;
const MAX_LIMIT = 2000;
const FORMAT_DISALLOWED = ["story", "stories"];
const TOP_CONTEXT_METRIC = "$stats.total_interactions";

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
  image?: string | null;
  mediaKitSlug?: string | null;
  availableIgAccounts?: Array<{ profile_picture_url?: string | null }> | null;
   creatorProfileExtended?: {
    niches?: string[] | null;
    brandTerritories?: string[] | null;
    stage?: string[] | null;
    updatedAt?: Date | null;
  };
  creatorContext?: {
    id?: string | null;
  } | null;
  location?: {
    country?: string | null;
    city?: string | null;
  } | null;
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

  const searchTerms = tokenizeSearch(filters.search);
  if (searchTerms.length) {
    filtered = filtered.filter((creator) => matchesSearchTerms(creator, searchTerms));
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

function collectNormalizedTags(creator: LandingCreatorHighlight) {
  return [
    ...(creator.niches ?? []),
    ...(creator.brandTerritories ?? []),
    ...(creator.contexts ?? []),
  ]
    .map(normalizeText)
    .filter(Boolean);
}

function tokenizeSearch(value?: string | null) {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((term) => term.trim().replace(/^@/, ""))
    .map(normalizeText)
    .filter(Boolean);
}

function matchesSearchTerms(creator: LandingCreatorHighlight, terms: string[]) {
  if (!terms.length) return true;
  const bag = [
    normalizeText(creator.name ?? ""),
    normalizeText(creator.username ?? ""),
    ...collectNormalizedTags(creator),
  ].filter(Boolean);
  return terms.every((term) => bag.some((entry) => entry.includes(term)));
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

function normalizeAvatarCandidate(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

function pickAvailableIgAvatar(creator: SubscriberUser): string | null {
  if (!Array.isArray(creator.availableIgAccounts)) return null;
  for (const account of creator.availableIgAccounts) {
    const candidate = normalizeAvatarCandidate(account?.profile_picture_url ?? null);
    if (candidate) return candidate;
  }
  return null;
}

function pickUserAvatar(creator: SubscriberUser): string | null {
  return (
    normalizeAvatarCandidate(creator.profile_picture_url ?? null) ||
    normalizeAvatarCandidate(creator.image ?? null) ||
    pickAvailableIgAvatar(creator)
  );
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
      image: 1,
      mediaKitSlug: 1,
      "availableIgAccounts.profile_picture_url": 1,
      "creatorProfileExtended.niches": 1,
      "creatorProfileExtended.brandTerritories": 1,
      "creatorProfileExtended.stage": 1,
      "creatorProfileExtended.updatedAt": 1,
      "creatorContext.id": 1,
      "location.country": 1,
      "location.city": 1,
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
    .filter((creator) => !pickUserAvatar(creator))
    .map((creator) => creator._id)
    .filter((id): id is Types.ObjectId => Boolean(id));

  const formatAgg = await MetricModel.aggregate<{
    _id: { user: Types.ObjectId; format: string };
    postCount: number;
    totalInteractions: number;
  }>([
    {
      $match: {
        user: { $in: subscriberIds },
        postDate: { $gte: since },
        format: { $exists: true, $ne: [] },
      },
    },
    {
      $project: {
        user: 1,
        format: { $ifNull: ["$format", []] },
        totalInteractions: { $ifNull: ["$stats.total_interactions", 0] },
      },
    },
    { $unwind: "$format" },
    {
      $project: {
        user: 1,
        format: { $toLower: "$format" },
        totalInteractions: 1,
      },
    },
    {
      $match: {
        format: { $nin: FORMAT_DISALLOWED },
      },
    },
    {
      $group: {
        _id: { user: "$user", format: "$format" },
        postCount: { $sum: 1 },
        totalInteractions: { $sum: "$totalInteractions" },
      },
    },
  ]).exec();

  const formatByUser = new Map<
    string,
    Map<string, { postCount: number; totalInteractions: number }>
  >();
  formatAgg.forEach((doc) => {
    const userId = doc._id.user.toString();
    const normalized = normalizeFormatTag(doc._id.format);
    if (!normalized) return;
    const current = formatByUser.get(userId) ?? new Map();
    const existing = current.get(normalized) ?? { postCount: 0, totalInteractions: 0 };
    existing.postCount += Number(doc.postCount ?? 0);
    existing.totalInteractions += Number(doc.totalInteractions ?? 0);
    current.set(normalized, existing);
    formatByUser.set(userId, current);
  });

  const topContextAgg = await MetricModel.aggregate<{
    _id: Types.ObjectId;
    topContext: { name: string; avg: number; count: number } | null;
  }>([
    {
      $match: {
        user: { $in: subscriberIds },
        postDate: { $gte: since },
        context: { $exists: true, $ne: [], $nin: [null] },
        [TOP_CONTEXT_METRIC.replace(/^\$/, "")]: { $ne: null },
      },
    },
    {
      $project: {
        user: 1,
        context: { $ifNull: ["$context", []] },
        metricValue: TOP_CONTEXT_METRIC,
      },
    },
    { $unwind: "$context" },
    {
      $group: {
        _id: { user: "$user", context: "$context" },
        avg: { $avg: "$metricValue" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.user": 1, avg: -1 } },
    {
      $group: {
        _id: "$_id.user",
        topContext: {
          $first: {
            name: "$_id.context",
            avg: "$avg",
            count: "$count",
          },
        },
      },
    },
  ]).exec();

  const topContextByUser = new Map<string, string>();
  topContextAgg.forEach((doc) => {
    const userId = doc._id?.toString();
    const ctx = doc.topContext?.name;
    if (!userId || !ctx) return;
    topContextByUser.set(userId, String(ctx));
  });

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
        .map((doc) => [doc._id.toString(), normalizeAvatarCandidate(doc.profilePicture ?? null)] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    );
  }

  const creators = subscribers.map((creator) => {
    const userId = creator._id.toString();
    const metrics = metricsByUser.get(userId);
    const avatar = pickUserAvatar(creator) ?? normalizeAvatarCandidate(avatarByUserId[userId] ?? null);
    const niches = sanitizeTags(creator.creatorProfileExtended?.niches);
    const brandTerritories = sanitizeTags(creator.creatorProfileExtended?.brandTerritories);
    const contextId = creator.creatorContext?.id ?? null;
    const contexts = mapContextsToLabels(buildContexts(brandTerritories, contextId));
    const stage = (creator.creatorProfileExtended?.stage ?? [])[0] ?? null;
    const surveyCompleted = Boolean(creator.creatorProfileExtended?.updatedAt);
    const formatsStrong = pickTopFormats(formatByUser.get(userId));
    const resolvedTopContext = resolveContextLabel(topContextByUser.get(userId) ?? null)?.label ?? null;

    return {
      id: userId,
      name: creator.name || creator.username || "Criador",
      username: creator.username ?? null,
      followers: creator.followers_count ?? null,
      avatarUrl: toProxyAvatar(avatar),
      niches: niches.length ? niches : null,
      brandTerritories: brandTerritories.length ? brandTerritories : null,
      contexts: contexts.length ? contexts : null,
      formatsStrong: formatsStrong.length ? formatsStrong : null,
      topPerformingContext: resolvedTopContext,
      country: creator.location?.country ?? null,
      city: creator.location?.city ?? null,
      stage: (stage as CreatorStage | null) ?? null,
      surveyCompleted,
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

function sanitizeTags(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .map((value) => value.slice(0, 120));
}

function buildContexts(brandTerritories: string[], contextId: string | null): string[] {
  return uniqueStrings([...brandTerritories, ...(contextId ? [contextId] : [])]);
}

function mapContextsToLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((raw) => {
    const resolved = resolveContextLabel(raw);
    const label = resolved?.label ?? raw?.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(label);
  });
  return result;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

function normalizeFormatTag(raw?: string | null): "reels" | "feed_carousel" | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value || FORMAT_DISALLOWED.includes(value)) return null;
  if (value.includes("reel")) return "reels";
  if (value.includes("carousel") || value.includes("carrossel") || value.includes("album")) return "feed_carousel";
  if (value.includes("photo") || value.includes("image") || value.includes("feed")) return "feed_carousel";
  if (value.includes("video")) return "feed_carousel";
  return null;
}

function pickTopFormats(
  formats?: Map<string, { postCount: number; totalInteractions: number }>,
): string[] {
  if (!formats || !formats.size) return [];
  const entries = Array.from(formats.entries());
  entries.sort((a, b) => {
    const interactionsDiff = (b[1]?.totalInteractions ?? 0) - (a[1]?.totalInteractions ?? 0);
    if (interactionsDiff !== 0) return interactionsDiff;
    const countDiff = (b[1]?.postCount ?? 0) - (a[1]?.postCount ?? 0);
    if (countDiff !== 0) return countDiff;
    return a[0].localeCompare(b[0]);
  });
  return entries.slice(0, 2).map(([key]) => (key === "reels" ? "Reels" : "Feed/Carrossel"));
}
