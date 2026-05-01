import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { Types, type PipelineStage } from 'mongoose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import {
  fetchAvgEngagementPerPostCreators,
  fetchTopInteractionCreators,
  type ICreatorMetricRankItem,
} from '@/app/lib/dataService/marketAnalysisService';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getCategoryById, getCategoryByValue, getCategoryWithSubcategoryIds } from '@/app/lib/classification';
import { scoreCollabCreator } from '@/app/lib/planner/collabCreatorScoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLAB_CANDIDATE_POOL_LIMIT = 24;

type RankingSource = 'avg_interactions' | 'total_interactions';

type RankedCreatorEntry = {
  item: ICreatorMetricRankItem;
  source: RankingSource;
  matchedTheme?: boolean;
  profile?: {
    username?: string | null;
    followers?: number | null;
    mediaKitSlug?: string | null;
  };
};

type ThemeCreatorAggregate = {
  creatorId: any;
  creatorName: string;
  username?: string | null;
  profilePictureUrl?: string | null;
  followers?: number | null;
  mediaKitSlug?: string | null;
  metricValue: number;
  avgReach?: number | null;
  avgShares?: number | null;
  avgSaves?: number | null;
  postCount?: number | null;
  latestPostDate?: Date | string | null;
};

type CreatorMetricSummary = {
  creatorId: any;
  avgInteractions?: number | null;
  avgReach?: number | null;
  avgShares?: number | null;
  avgSaves?: number | null;
  postCount?: number | null;
  latestPostDate?: Date | string | null;
};

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function resolveContextValues(contextIds: string[]) {
  const values: string[] = [];
  contextIds.forEach((value) => {
    const ids = getCategoryWithSubcategoryIds(value, 'context');
    const labels = ids.map((id) => getCategoryById(id, 'context')?.label || id);
    values.push(value, ...ids, ...labels);
  });
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMetricMatch(params: {
  contextIds: string[];
  creatorIds?: string[];
  endDate: Date;
  startDate: Date;
}) {
  const andClauses: any[] = [
    { postDate: { $gte: params.startDate, $lte: params.endDate } },
    { 'stats.total_interactions': { $exists: true, $ne: null, $gt: 0 } },
  ];
  const contextValues = resolveContextValues(params.contextIds);
  if (contextValues.length) {
    andClauses.push({ context: { $in: contextValues } });
  }
  if (params.creatorIds?.length) {
    const objectIds = params.creatorIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (objectIds.length) {
      andClauses.push({ user: { $in: objectIds } });
    }
  }
  return { $and: andClauses };
}

async function fetchCreatorMetricSummaries(params: {
  contextIds: string[];
  creatorIds: string[];
  endDate: Date;
  startDate: Date;
}) {
  if (!params.creatorIds.length) return new Map<string, CreatorMetricSummary>();

  const pipeline: PipelineStage[] = [
    { $match: buildMetricMatch(params) },
    {
      $group: {
        _id: '$user',
        postCount: { $sum: 1 },
        avgInteractions: { $avg: '$stats.total_interactions' },
        avgReach: { $avg: { $ifNull: ['$stats.reach', '$stats.views'] } },
        avgShares: { $avg: '$stats.shares' },
        avgSaves: { $avg: '$stats.saved' },
        latestPostDate: { $max: '$postDate' },
      },
    },
    {
      $project: {
        _id: 0,
        creatorId: '$_id',
        postCount: 1,
        avgInteractions: { $round: ['$avgInteractions', 0] },
        avgReach: { $round: ['$avgReach', 0] },
        avgShares: { $round: ['$avgShares', 0] },
        avgSaves: { $round: ['$avgSaves', 0] },
        latestPostDate: 1,
      },
    },
  ];

  const summaries = (await MetricModel.aggregate(pipeline)) as CreatorMetricSummary[];
  return new Map(summaries.map((entry) => [entry.creatorId?.toString(), entry]));
}

async function fetchThemeCreatorSuggestions(params: {
  contextIds: string[];
  endDate: Date;
  limit: number;
  startDate: Date;
  themeKeyword: string | null;
}): Promise<ThemeCreatorAggregate[]> {
  const theme = params.themeKeyword?.trim();
  if (!theme || theme.length < 3) return [];

  await connectToDatabase();
  const andClauses: any[] = [
    ...buildMetricMatch({
      contextIds: params.contextIds,
      endDate: params.endDate,
      startDate: params.startDate,
    }).$and,
    {
      $or: [
        { text_content: { $regex: escapeRegExp(theme), $options: 'i' } },
        { description: { $regex: escapeRegExp(theme), $options: 'i' } },
      ],
    },
  ];
  const contextValues = resolveContextValues(params.contextIds);
  if (contextValues.length) {
    andClauses.push({ context: { $in: contextValues } });
  }

  const pipeline: PipelineStage[] = [
    { $match: { $and: andClauses } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'creatorDetails',
        pipeline: [
          {
            $project: {
              name: 1,
              username: 1,
              profile_picture_url: 1,
              followers_count: 1,
              mediaKitSlug: 1,
              isInstagramConnected: 1,
              planStatus: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
    { $match: { 'creatorDetails.isInstagramConnected': true, 'creatorDetails.planStatus': 'active' } },
    {
      $group: {
        _id: '$user',
        postCount: { $sum: 1 },
        totalInteractions: { $sum: '$stats.total_interactions' },
        avgInteractions: { $avg: '$stats.total_interactions' },
        avgReach: { $avg: { $ifNull: ['$stats.reach', '$stats.views'] } },
        avgShares: { $avg: '$stats.shares' },
        avgSaves: { $avg: '$stats.saved' },
        latestPostDate: { $max: '$postDate' },
        creatorName: { $first: '$creatorDetails.name' },
        username: { $first: '$creatorDetails.username' },
        profilePictureUrl: { $first: '$creatorDetails.profile_picture_url' },
        followers: { $first: '$creatorDetails.followers_count' },
        mediaKitSlug: { $first: '$creatorDetails.mediaKitSlug' },
      },
    },
    {
      $addFields: {
        metricValue: '$avgInteractions',
      },
    },
    { $sort: { metricValue: -1, totalInteractions: -1 } },
    { $limit: params.limit },
    {
      $project: {
        _id: 0,
        creatorId: '$_id',
        creatorName: { $ifNull: ['$creatorName', 'Criador'] },
        username: 1,
        profilePictureUrl: 1,
        followers: 1,
        mediaKitSlug: 1,
        postCount: 1,
        avgReach: { $round: ['$avgReach', 0] },
        avgShares: { $round: ['$avgShares', 0] },
        avgSaves: { $round: ['$avgSaves', 0] },
        latestPostDate: 1,
        metricValue: { $round: ['$metricValue', 1] },
      },
    },
  ];

  return MetricModel.aggregate(pipeline);
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const viewerId = session.user.id;

  try {
    const routePath = new URL(request.url).pathname;
    const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const categories = body?.categories || {};
    const contextIds = normalizeStringArray(categories?.context);
    const contextId = contextIds[0] || null;
    const contextLabel = contextId ? getCategoryByValue(contextId, 'context')?.label || contextId : null;
    const themeKeyword =
      (typeof body?.themeKeyword === 'string' && body.themeKeyword.trim()) ||
      (typeof body?.title === 'string' && body.title.trim()) ||
      null;
    const periodDays = Math.max(30, Math.min(365, Number(body?.periodDays) || 180));
    const limit = Math.max(1, Math.min(3, Number(body?.limit) || 3));
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - periodDays);
    const rankingParams = {
      dateRange: { startDate, endDate },
      limit: COLLAB_CANDIDATE_POOL_LIMIT,
      offset: 0,
      onlyActiveSubscribers: true,
      ...(contextIds.length ? { context: contextIds } : {}),
    };

    const [themeMatches, primary, fallback] = await Promise.all([
      fetchThemeCreatorSuggestions({
        contextIds,
        endDate,
        limit: COLLAB_CANDIDATE_POOL_LIMIT,
        startDate,
        themeKeyword,
      }),
      fetchAvgEngagementPerPostCreators(rankingParams),
      fetchTopInteractionCreators(rankingParams),
    ]);
    const entries = new Map<string, RankedCreatorEntry>();
    themeMatches.forEach((item) => {
      const id = item.creatorId?.toString();
      if (!id || id === viewerId) return;
      entries.set(id, {
        item: {
          creatorId: item.creatorId,
          creatorName: item.creatorName,
          profilePictureUrl: item.profilePictureUrl || undefined,
          metricValue: item.metricValue,
        },
        source: 'avg_interactions',
        matchedTheme: true,
        profile: {
          username: item.username || null,
          followers: typeof item.followers === 'number' ? item.followers : null,
          mediaKitSlug: item.mediaKitSlug || null,
        },
      });
    });

    primary.forEach((item) => {
      const id = item.creatorId?.toString();
      if (!id || id === viewerId || entries.has(id)) return;
      entries.set(id, { item, source: 'avg_interactions' });
    });

    fallback.forEach((item) => {
      const id = item.creatorId?.toString();
      if (!id || id === viewerId || entries.has(id)) return;
      entries.set(id, { item, source: 'total_interactions' });
    });

    const candidateEntries = Array.from(entries.entries());
    const candidateCreatorIds = candidateEntries.map(([id]) => id);
    const [users, metricSummaries] = await Promise.all([
      candidateEntries.length
        ? UserModel.find({ _id: { $in: candidateCreatorIds } })
            .select('name username profile_picture_url followers_count mediaKitSlug')
            .lean()
        : [],
      fetchCreatorMetricSummaries({
        contextIds,
        creatorIds: candidateCreatorIds,
        endDate,
        startDate,
      }),
    ]);
    const userMap = new Map(users.map((user: any) => [user._id?.toString(), user]));

    const scoredCandidates = candidateEntries
      .map(([id, entry]) => {
        const user = userMap.get(id) as any;
        const summary = metricSummaries.get(id);
        const name = user?.name || entry.item.creatorName || 'Criador';
        const metricValue =
          typeof entry.item.metricValue === 'number' && Number.isFinite(entry.item.metricValue)
            ? entry.item.metricValue
            : 0;
        const avgInteractions =
          typeof summary?.avgInteractions === 'number' && Number.isFinite(summary.avgInteractions)
            ? summary.avgInteractions
            : metricValue || null;
        const followers =
          typeof entry.profile?.followers === 'number'
            ? entry.profile.followers
            : typeof user?.followers_count === 'number'
              ? user.followers_count
              : null;
        const avgReach =
          typeof summary?.avgReach === 'number' && Number.isFinite(summary.avgReach)
            ? summary.avgReach
            : null;
        const avgShares =
          typeof summary?.avgShares === 'number' && Number.isFinite(summary.avgShares)
            ? summary.avgShares
            : null;
        const avgSaves =
          typeof summary?.avgSaves === 'number' && Number.isFinite(summary.avgSaves)
            ? summary.avgSaves
            : null;
        const postCount =
          typeof summary?.postCount === 'number' && Number.isFinite(summary.postCount)
            ? summary.postCount
            : null;
        return {
          id,
          name,
          username: entry.profile?.username || user?.username || null,
          avatarUrl: user?.profile_picture_url || entry.item.profilePictureUrl || null,
          followers,
          mediaKitSlug: entry.profile?.mediaKitSlug || user?.mediaKitSlug || null,
          metricValue,
          avgInteractions,
          avgReach,
          avgShares,
          avgSaves,
          postCount,
          latestPostDate: summary?.latestPostDate || null,
          matchedTheme: Boolean(entry.matchedTheme),
          source: entry.source,
        };
      })
      .filter((candidate) => {
        if (!candidate.avgInteractions || candidate.avgInteractions <= 0) return false;
        if (candidate.postCount && candidate.postCount >= 3) return true;
        return Boolean(candidate.matchedTheme && candidate.postCount && candidate.postCount >= 1);
      });

    const maxAvgInteractions = Math.max(...scoredCandidates.map((candidate) => candidate.avgInteractions || 0), 0);
    const maxAvgReach = Math.max(...scoredCandidates.map((candidate) => candidate.avgReach || 0), 0);
    const maxFollowers = Math.max(...scoredCandidates.map((candidate) => candidate.followers || 0), 0);
    const maxEfficiency = Math.max(
      ...scoredCandidates.map((candidate) =>
        candidate.followers && candidate.followers > 0 && candidate.avgInteractions
          ? candidate.avgInteractions / candidate.followers
          : 0
      ),
      0
    );

    const items = scoredCandidates
      .map((candidate) => {
        const scoring = scoreCollabCreator(candidate, {
          now: endDate,
          maxAvgInteractions,
          maxAvgReach,
          maxFollowers,
          maxEfficiency,
        });
        return {
          ...candidate,
          collabScore: scoring.score,
          matchType: scoring.matchType,
          scoreParts: scoring.scoreParts,
        };
      })
      .sort((a, b) => b.collabScore - a.collabScore || (b.avgInteractions || 0) - (a.avgInteractions || 0))
      .slice(0, limit)
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
      }));

    return NextResponse.json({ ok: true, items, contextLabel });
  } catch (err) {
    console.error('[planner/collab-creators] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load collab creators' },
      { status: 500 }
    );
  }
}
