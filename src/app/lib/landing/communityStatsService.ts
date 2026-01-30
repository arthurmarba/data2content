import { PipelineStage, Types } from 'mongoose';
import { subDays } from 'date-fns';

import { connectToDatabase } from '@/app/lib/dataService/connection';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import AccountInsightModel from '@/app/models/AccountInsight';
import { logger } from '@/app/lib/logger';
import { getCategoryById } from '@/app/lib/classification';
import {
  LandingCategoryInsight,
  LandingCommunityMetrics,
  LandingCommunityStatsResponse,
  LandingCreatorHighlight,
  LandingNextMentorship,
} from '@/types/landing';

const SERVICE_TAG = '[landing][communityStatsService]';
const DEFAULT_TTL_MS = Math.max(
  60_000,
  Math.min(15 * 60_000, Number(process.env.LANDING_COMMUNITY_STATS_TTL_MS ?? 300_000))
);
const RANK_WINDOW_DAYS = 21;
const CATEGORY_LOOKBACK_DAYS = 30;
const RECENT_ENTRIES_DAYS = 7;
const DEFAULT_TOP_CREATORS_LIMIT = 16;
const envTopCreatorsLimit = Number(process.env.LANDING_TOP_CREATORS_LIMIT);
const TOP_CREATORS_LIMIT = Math.max(
  DEFAULT_TOP_CREATORS_LIMIT,
  Number.isFinite(envTopCreatorsLimit) && envTopCreatorsLimit > 0
    ? Math.floor(envTopCreatorsLimit)
    : 0,
);
const TOP_CATEGORIES_LIMIT = 4;

type LeanCommunityUser = {
  _id: Types.ObjectId;
  followers_count?: number | null;
  communityInspirationOptInDate?: Date | null;
  username?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
  isInstagramConnected?: boolean | null;
};

type RawCategoryAggregation = {
  _id: string;
  postCount: number;
  totalInteractions: number;
  totalReach: number;
  totalSaves: number;
  formats: unknown[];
  proposals: unknown[];
};

type RawCreatorAggregation = {
  userId: Types.ObjectId;
  postCount: number;
  totalInteractions: number;
  avgInteractionsPerPost: number;
  totalReach?: number;
  avgReachPerPost?: number;
  user?: {
    name?: string | null;
    username?: string | null;
    followers_count?: number | null;
    profile_picture_url?: string | null;
    mediaKitSlug?: string | null;
  };
};

type CacheEntry = {
  expires: number;
  payload: LandingCommunityStatsResponse;
};

let cacheEntry: CacheEntry | null = null;

type AggregateSummary = {
  _id: null;
  postCount: number;
  totalReach: number;
  totalViews: number;
  totalFollows: number;
  totalInteractions: number;
};

type AccountInsightGrowthSummary = {
  _id: null;
  totalDelta: number;
};

export async function fetchCommunityLandingStats(options: { forceRefresh?: boolean } = {}): Promise<LandingCommunityStatsResponse> {
  const now = Date.now();
  if (!options.forceRefresh && cacheEntry && cacheEntry.expires > now) {
    return cacheEntry.payload;
  }

  const payload = await buildCommunityStats();
  cacheEntry = { expires: now + DEFAULT_TTL_MS, payload };
  return payload;
}

async function buildCommunityStats(): Promise<LandingCommunityStatsResponse> {
  const TAG = `${SERVICE_TAG}[buildCommunityStats]`;
  logger.info(`${TAG} Building landing stats payload.`);

  await connectToDatabase();

  const now = new Date();
  const rankingSince = subDays(now, RANK_WINDOW_DAYS);
  const categoriesSince = subDays(now, CATEGORY_LOOKBACK_DAYS);
  const recentEntriesSince = subDays(now, RECENT_ENTRIES_DAYS);

  const communityUsers = (await UserModel.find(
    { communityInspirationOptIn: true },
    {
      _id: 1,
      followers_count: 1,
      communityInspirationOptInDate: 1,
      username: 1,
      name: 1,
      profile_picture_url: 1,
      isInstagramConnected: 1,
    }
  )
    .lean<LeanCommunityUser[]>()
    .exec()) as LeanCommunityUser[];

  const activeUsers = communityUsers.filter((user) => user.isInstagramConnected === true);
  const activeCreatorIds = activeUsers.map((user) => user._id);

  const metrics = await buildCommunityMetrics({
    activeUsers,
    activeCreatorIds,
    recentEntriesSince,
    categoriesSince,
    now,
  });

  const [ranking, categories] = await Promise.all([
    computeTopCreators(activeCreatorIds, rankingSince),
    computeCategoryInsights(activeCreatorIds, categoriesSince),
  ]);

  const nextMentorship = computeNextMentorshipSlot(now);

  const payload: LandingCommunityStatsResponse = {
    metrics,
    ranking,
    categories,
    nextMentorship,
    lastUpdatedIso: now.toISOString(),
  };

  logger.info(`${TAG} Payload ready with ${metrics.activeCreators} active creators.`);
  return payload;
}

async function buildCommunityMetrics(params: {
  activeUsers: LeanCommunityUser[];
  activeCreatorIds: Types.ObjectId[];
  recentEntriesSince: Date;
  categoriesSince: Date;
  now: Date;
}): Promise<LandingCommunityMetrics> {
  const { activeUsers, activeCreatorIds, recentEntriesSince, categoriesSince, now } = params;

  const activeCreators = activeUsers.length;
  const combinedFollowers = activeUsers.reduce((sum, user) => sum + (user.followers_count ?? 0), 0);
  const newMembersLast7Days = activeUsers.filter((user) => {
    const joinedAt = user.communityInspirationOptInDate;
    return joinedAt ? joinedAt >= recentEntriesSince : false;
  }).length;

  if (activeCreatorIds.length === 0) {
    return {
      activeCreators,
      combinedFollowers,
      totalPostsAnalyzed: 0,
      postsLast30Days: 0,
      newMembersLast7Days,
      reachLast30Days: 0,
      reachAllTime: 0,
      viewsLast30Days: 0,
      viewsAllTime: 0,
      followersGainedLast30Days: 0,
      followersGainedAllTime: 0,
      interactionsLast30Days: 0,
      interactionsAllTime: 0,
    };
  }

  const [
    totalPostsAnalyzed,
    last30Aggregation,
    followerGrowthAggregation,
    lifetimeAggregation,
  ] = await Promise.all([
    MetricModel.countDocuments({ user: { $in: activeCreatorIds } }).exec(),
    MetricModel.aggregate<AggregateSummary>([
      {
        $match: {
          user: { $in: activeCreatorIds },
          postDate: { $gte: categoriesSince },
        },
      },
      {
        $project: {
          reach: { $ifNull: ['$stats.reach', 0] },
          videoViews: { $ifNull: ['$stats.video_views', 0] },
          views: { $ifNull: ['$stats.views', 0] },
          follows: { $ifNull: ['$stats.follows', 0] },
          interactions: { $ifNull: ['$stats.total_interactions', 0] },
        },
      },
      {
        $addFields: {
          computedViews: {
            $cond: [
              { $gt: ['$videoViews', 0] },
              '$videoViews',
              '$views',
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          postCount: { $sum: 1 },
          totalReach: { $sum: '$reach' },
          totalViews: { $sum: '$computedViews' },
          totalFollows: { $sum: '$follows' },
          totalInteractions: { $sum: '$interactions' },
        },
      },
    ]).exec(),
    AccountInsightModel.aggregate<AccountInsightGrowthSummary>([
      {
        $match: {
          user: { $in: activeCreatorIds },
          recordedAt: { $gte: categoriesSince, $lte: now },
        },
      },
      {
        $project: {
          user: 1,
          recordedAt: 1,
          followers: {
            $ifNull: ['$followersCount', '$accountDetails.followers_count'],
          },
        },
      },
      {
        $match: {
          followers: { $ne: null },
        },
      },
      { $sort: { user: 1, recordedAt: 1 } },
      {
        $group: {
          _id: '$user',
          first: { $first: '$followers' },
          last: { $last: '$followers' },
        },
      },
      {
        $project: {
          delta: {
            $cond: [
              { $gt: [{ $subtract: ['$last', '$first'] }, 0] },
              { $subtract: ['$last', '$first'] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalDelta: { $sum: '$delta' },
        },
      },
    ]).exec(),
    MetricModel.aggregate<AggregateSummary>([
      {
        $match: {
          user: { $in: activeCreatorIds },
        },
      },
      {
        $project: {
          reach: { $ifNull: ['$stats.reach', 0] },
          videoViews: { $ifNull: ['$stats.video_views', 0] },
          views: { $ifNull: ['$stats.views', 0] },
          follows: { $ifNull: ['$stats.follows', 0] },
          interactions: { $ifNull: ['$stats.total_interactions', 0] },
        },
      },
      {
        $addFields: {
          computedViews: {
            $cond: [
              { $gt: ['$videoViews', 0] },
              '$videoViews',
              '$views',
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          postCount: { $sum: 1 },
          totalReach: { $sum: '$reach' },
          totalViews: { $sum: '$computedViews' },
          totalFollows: { $sum: '$follows' },
          totalInteractions: { $sum: '$interactions' },
        },
      },
    ]).exec(),
  ]);

  const summarize = (entry?: AggregateSummary | null) => ({
    postCount: Number(entry?.postCount ?? 0),
    totalReach: Number(entry?.totalReach ?? 0),
    totalViews: Number(entry?.totalViews ?? 0),
    totalFollows: Number(entry?.totalFollows ?? 0),
    totalInteractions: Number(entry?.totalInteractions ?? 0),
  });

  const last30Summary = summarize(last30Aggregation[0]);
  const lifetimeSummary = summarize(lifetimeAggregation[0]);
  const followerGainsFromInsights = followerGrowthAggregation[0]?.totalDelta;
  const followersFromMetrics = last30Summary.totalFollows;
  const followersFromInsights =
    typeof followerGainsFromInsights === 'number' && followerGainsFromInsights > 0
      ? Number(followerGainsFromInsights)
      : null;

  return {
    activeCreators,
    combinedFollowers,
    totalPostsAnalyzed,
    postsLast30Days: last30Summary.postCount,
    newMembersLast7Days,
    reachLast30Days: last30Summary.totalReach,
    reachAllTime: lifetimeSummary.totalReach,
    viewsLast30Days: last30Summary.totalViews,
    viewsAllTime: lifetimeSummary.totalViews,
    followersGainedLast30Days: followersFromInsights ?? followersFromMetrics,
    followersGainedAllTime: lifetimeSummary.totalFollows,
    interactionsLast30Days: last30Summary.totalInteractions,
    interactionsAllTime: lifetimeSummary.totalInteractions,
  };
}

async function computeTopCreators(userIds: Types.ObjectId[], since: Date): Promise<LandingCreatorHighlight[]> {
  if (!userIds.length) return [];

  const pipeline: PipelineStage[] = [
    {
      $match: {
        user: { $in: userIds },
        postDate: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$user',
        postCount: { $sum: 1 },
        totalInteractions: { $sum: { $ifNull: ['$stats.total_interactions', 0] } },
        totalReach: { $sum: { $ifNull: ['$stats.reach', 0] } },
      },
    },
    { $match: { postCount: { $gt: 0 } } },
    { $sort: { totalInteractions: -1, postCount: -1 } },
    { $limit: TOP_CREATORS_LIMIT * 3 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [
          {
            $project: {
              name: 1,
              username: 1,
              followers_count: 1,
              profile_picture_url: 1,
              mediaKitSlug: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        postCount: 1,
        totalInteractions: 1,
        totalReach: 1,
        avgInteractionsPerPost: {
          $cond: [
            { $gt: ['$postCount', 0] },
            { $divide: ['$totalInteractions', '$postCount'] },
            0,
          ],
        },
        avgReachPerPost: {
          $cond: [
            { $gt: ['$postCount', 0] },
            { $divide: ['$totalReach', '$postCount'] },
            0,
          ],
        },
        user: 1,
      },
    },
  ];

  const rawResults = (await MetricModel.aggregate(pipeline).exec()) as RawCreatorAggregation[];
  const limitedResults = rawResults.slice(0, TOP_CREATORS_LIMIT);

  const missingAvatarUserIds = limitedResults
    .filter((item) => !item.user?.profile_picture_url)
    .map((item) => item.userId)
    .filter((id): id is Types.ObjectId => Boolean(id));

  let avatarByUserId: Record<string, string> = {};
  if (missingAvatarUserIds.length) {
    const insightAvatars = await AccountInsightModel.aggregate<{
      _id: Types.ObjectId;
      profilePicture?: string | null;
    }>([
      {
        $match: {
          user: { $in: missingAvatarUserIds },
          'accountDetails.profile_picture_url': { $exists: true, $nin: [null, ''] },
        },
      },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$user',
          profilePicture: { $first: '$accountDetails.profile_picture_url' },
        },
      },
    ]).exec();

    avatarByUserId = Object.fromEntries(
      insightAvatars
        .filter((doc) => doc.profilePicture)
        .map((doc) => [doc._id.toString(), doc.profilePicture as string]),
    );
  }

  return limitedResults.map((item, index) => {
    const avgInteractions = Number(item.avgInteractionsPerPost ?? 0);
    const postCount = Number(item.postCount ?? 0);
    const totalInteractions = Number(item.totalInteractions ?? 0);
    const avgReachPerPost = Number((item as any).avgReachPerPost ?? 0);
    const consistencyScore = postCount > 0 ? Number((postCount / RANK_WINDOW_DAYS).toFixed(2)) : null;
    const userIdString = item.userId ? String(item.userId) : undefined;
    const rawAvatar = item.user?.profile_picture_url ?? (userIdString ? avatarByUserId[userIdString] : null);

    return {
      id: String(item.userId),
      name: item.user?.name || item.user?.username || 'Criador',
      username: item.user?.username ?? null,
      followers: item.user?.followers_count ?? null,
      avatarUrl: toProxyAvatar(rawAvatar ?? null),
      totalInteractions,
      postCount,
      avgInteractionsPerPost: avgInteractions,
      avgReachPerPost,
      rank: index + 1,
      consistencyScore,
      mediaKitSlug: item.user?.mediaKitSlug ?? null,
    };
  });
}

async function computeCategoryInsights(userIds: Types.ObjectId[], since: Date): Promise<LandingCategoryInsight[]> {
  if (!userIds.length) return [];

  const pipeline: PipelineStage[] = [
    {
      $match: {
        user: { $in: userIds },
        postDate: { $gte: since },
        context: { $exists: true, $ne: [] },
      },
    },
    {
      $project: {
        context: {
          $filter: {
            input: { $ifNull: ['$context', []] },
            as: 'ctx',
            cond: { $and: [{ $ne: ['$$ctx', null] }, { $ne: ['$$ctx', ''] }] },
          },
        },
        format: {
          $filter: {
            input: { $ifNull: ['$format', []] },
            as: 'fmt',
            cond: { $and: [{ $ne: ['$$fmt', null] }, { $ne: ['$$fmt', ''] }] },
          },
        },
        proposal: {
          $filter: {
            input: { $ifNull: ['$proposal', []] },
            as: 'prop',
            cond: { $and: [{ $ne: ['$$prop', null] }, { $ne: ['$$prop', ''] }] },
          },
        },
        stats: 1,
      },
    },
    { $unwind: '$context' },
    {
      $group: {
        _id: '$context',
        postCount: { $sum: 1 },
        totalInteractions: { $sum: { $ifNull: ['$stats.total_interactions', 0] } },
        totalReach: { $sum: { $ifNull: ['$stats.reach', 0] } },
        totalSaves: { $sum: { $ifNull: ['$stats.saved', 0] } },
        formats: { $push: '$format' },
        proposals: { $push: '$proposal' },
      },
    },
    { $sort: { totalInteractions: -1, postCount: -1 } },
    { $limit: TOP_CATEGORIES_LIMIT * 2 },
  ];

  const rawResults = (await MetricModel.aggregate(pipeline).exec()) as RawCategoryAggregation[];

  return rawResults.slice(0, TOP_CATEGORIES_LIMIT).map((item) => {
    const category = getCategoryById(item._id, 'context');
    const label = category?.label ?? item._id;
    const description = category?.description ?? null;

    const postCount = item.postCount ?? 0;
    const totalInteractions = item.totalInteractions ?? 0;
    const totalReach = item.totalReach ?? 0;
    const totalSaves = item.totalSaves ?? 0;

    const avgInteractionsPerPost = postCount > 0 ? totalInteractions / postCount : 0;
    const engagementRate = totalReach > 0 ? (totalInteractions / totalReach) * 100 : null;
    const avgSaves = postCount > 0 ? totalSaves / postCount : null;

    const topFormats = collectTopLabels(item.formats, 'format');
    const topProposals = collectTopLabels(item.proposals, 'proposal');

    return {
      id: item._id,
      label,
      description,
      postCount,
      totalInteractions,
      avgInteractionsPerPost,
      engagementRate,
      avgSaves,
      topFormats,
      topProposals,
    };
  });
}

function collectTopLabels(
  rawValues: unknown[],
  type: 'format' | 'proposal',
  limit = 2
): Array<{ id: string; label: string }> {
  const counter = new Map<string, number>();

  for (const entry of rawValues ?? []) {
    const values = Array.isArray(entry) ? entry : [entry];
    for (const original of values) {
      if (typeof original !== 'string') continue;
      const id = original.trim();
      if (!id) continue;
      counter.set(id, (counter.get(id) ?? 0) + 1);
    }
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => ({
      id,
      label: getCategoryById(id, type)?.label ?? id,
    }));
}

function computeNextMentorshipSlot(baseDate: Date): LandingNextMentorship {
  const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const targetWeekday = 1; // Monday

  const reference = new Date(baseDate.getTime());
  const currentDay = reference.getDay();
  let delta = (targetWeekday - currentDay + 7) % 7;
  if (delta === 0 && reference.getHours() >= 19) {
    delta = 7;
  }

  const next = new Date(reference.getTime());
  next.setDate(reference.getDate() + delta);
  next.setHours(19, 0, 0, 0);

  const label = `${WEEKDAY_LABELS[next.getDay()]} • 19h (BRT)`;

  return {
    isoDate: next.toISOString(),
    display: label,
  };
}
function toProxyAvatar(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  }
  return raw;
}
