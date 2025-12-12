import { Types } from 'mongoose';
import type { PipelineStage } from 'mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import AudienceDemographicSnapshotModel from '@/app/models/demographics/AudienceDemographicSnapshot';
import { connectToDatabase } from '@/app/lib/dataService/connection';
import { logger } from '@/app/lib/logger';
import {
  AdminCreatorSurveyAnalytics,
  AdminCreatorSurveyDetail,
  AdminCreatorSurveyFilters,
  AdminCreatorSurveyListItem,
  AdminCreatorSurveyListParams,
  AdminCreatorSurveyOpenResponse,
  AdminCreatorSurveyOpenResponseParams,
  AdminCreatorSurveyOpenResponseResult,
  CategoryMetricBreakdown,
  CityMetric,
  CityPricingBySize,
  DistributionEntry,
} from '@/types/admin/creatorSurvey';
import {
  MonetizationStatus,
  PriceRange,
} from '@/types/landing';
import { bucketFollowers, bucketEngagement, bucketGrowth, bucketReach, monetizationLabel as monetLabelHelper, priceRangeMidpoint } from '@/lib/surveyBuckets';

const SERVICE_TAG = '[adminCreatorSurveyService]';

function normalizeArray<T = string>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  return [];
}

function mapCategoryMetrics(entries: Array<{ _id: string; count: number; avgEngagement?: number; avgReach?: number; avgGrowth?: number; avgFollowers?: number }> | undefined): CategoryMetricBreakdown[] {
  if (!entries) return [];
  return entries
    .filter((e) => !!e._id)
    .map((e) => ({
      value: e._id,
      count: e.count,
      avgEngagement: e.avgEngagement ?? null,
      avgReach: e.avgReach ?? null,
      avgGrowth: e.avgGrowth ?? null,
      avgFollowers: e.avgFollowers ?? null,
    }));
}

function computeAvgTicketFromPriceRange(list: string[] | undefined): number | null {
  if (!list || !list.length) return null;
  let total = 0;
  let weight = 0;
  list.forEach((p) => {
    const mid = priceRangeMidpoint(p);
    if (mid != null) {
      total += mid;
      weight += 1;
    }
  });
  return weight ? total / weight : null;
}

async function buildTopCityMap(userIds: Types.ObjectId[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const agg = await AudienceDemographicSnapshotModel.aggregate([
    { $match: { user: { $in: userIds } } },
    { $sort: { user: 1, recordedAt: -1 } },
    {
      $group: {
        _id: '$user',
        latestSnapshot: { $first: '$demographics.follower_demographics.city' },
      },
    },
  ]);
  const map = new Map<string, string>();
  agg.forEach((row: any) => {
    if (row._id && row.latestSnapshot) {
      const entries = Object.entries(row.latestSnapshot as Record<string, number>).filter(([, v]) => typeof v === 'number' && v > 0);
      if (entries.length) {
        entries.sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
        map.set(String(row._id), entries[0]![0]);
      }
    }
  });
  return map;
}

const OPEN_TEXT_FIELDS: Array<{ key: string; label: string; path: string; isArray?: boolean }> = [
  { key: 'success12m', label: 'História de sucesso (12m)', path: 'success12m' },
  { key: 'mainGoalOther', label: 'Objetivo (outro)', path: 'mainGoalOther' },
  { key: 'otherPain', label: 'Outra dor', path: 'otherPain' },
  { key: 'pricingFearOther', label: 'Medo de precificar (outro)', path: 'pricingFearOther' },
  { key: 'reasonOther', label: 'Motivo para usar a plataforma (outro)', path: 'reasonOther' },
  { key: 'dailyExpectation', label: 'Expectativa diária', path: 'dailyExpectation' },
  { key: 'dreamBrands', label: 'Marcas dos sonhos', path: 'dreamBrands', isArray: true },
  { key: 'brandTerritories', label: 'Territórios de marca', path: 'brandTerritories', isArray: true },
  { key: 'niches', label: 'Niches/temas', path: 'niches', isArray: true },
  { key: 'hasHelp', label: 'Tem ajuda', path: 'hasHelp', isArray: true },
];

function buildMonetizationLabel(status: MonetizationStatus | null, priceRange: PriceRange): string {
  return monetLabelHelper(status, priceRange);
}

export function buildSurveyMatch(filters: AdminCreatorSurveyFilters) {
  const {
    search,
    userId,
    username,
    followersMin,
    followersMax,
    mediaMin,
    mediaMax,
    country,
    city,
    gender,
    engagementMin,
    engagementMax,
    reachMin,
    reachMax,
    growthMin,
    growthMax,
    stage,
    pains,
    hardestStage,
    monetizationStatus,
    nextPlatform,
    niches,
    brandTerritories,
    accountReasons,
    dateFrom,
    dateTo,
  } = filters;

  const match: Record<string, any> = { creatorProfileExtended: { $exists: true } };

  if (userId && Types.ObjectId.isValid(userId)) {
    match._id = new Types.ObjectId(userId);
  }
  if (username?.trim()) {
    match.username = { $regex: new RegExp(username.trim(), 'i') };
  }

  if (search?.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    match.$or = [
      { name: regex },
      { email: regex },
      { username: regex },
    ];
  }

  if (stage?.length) match['creatorProfileExtended.stage'] = { $in: stage };
  if (pains?.length) match['creatorProfileExtended.mainPains'] = { $in: pains };
  if (hardestStage?.length) match['creatorProfileExtended.hardestStage'] = { $in: hardestStage };
  if (monetizationStatus?.length) match['creatorProfileExtended.hasDoneSponsoredPosts'] = { $in: monetizationStatus };
  if (nextPlatform?.length) match['creatorProfileExtended.nextPlatform'] = { $in: nextPlatform };
  if (niches?.length) match['creatorProfileExtended.niches'] = { $in: niches };
  if (brandTerritories?.length) match['creatorProfileExtended.brandTerritories'] = { $in: brandTerritories };
  if (accountReasons?.length) match['creatorProfileExtended.mainPlatformReasons'] = { $in: accountReasons };

  if (dateFrom || dateTo) {
    const updatedAt: Record<string, any> = {};
    if (dateFrom) updatedAt.$gte = new Date(dateFrom);
    if (dateTo) updatedAt.$lte = new Date(dateTo);
    match['creatorProfileExtended.updatedAt'] = updatedAt;
  }

  if (followersMin !== undefined || followersMax !== undefined) {
    match.followers_count = {};
    if (followersMin !== undefined) match.followers_count.$gte = followersMin;
    if (followersMax !== undefined) match.followers_count.$lte = followersMax;
  }

  if (mediaMin !== undefined || mediaMax !== undefined) {
    match.media_count = {};
    if (mediaMin !== undefined) match.media_count.$gte = mediaMin;
    if (mediaMax !== undefined) match.media_count.$lte = mediaMax;
  }

  if (country?.length) match['location.country'] = { $in: country };
  if (city?.length) match['location.city'] = { $in: city };
  if (gender?.length) match.gender = { $in: gender };
  if (engagementMin !== undefined || engagementMax !== undefined) {
    match['creatorProfileExtended.engagementRate'] = {};
    if (engagementMin !== undefined) match['creatorProfileExtended.engagementRate'].$gte = engagementMin;
    if (engagementMax !== undefined) match['creatorProfileExtended.engagementRate'].$lte = engagementMax;
  }
  if (reachMin !== undefined || reachMax !== undefined) {
    match['creatorProfileExtended.reach30d'] = {};
    if (reachMin !== undefined) match['creatorProfileExtended.reach30d'].$gte = reachMin;
    if (reachMax !== undefined) match['creatorProfileExtended.reach30d'].$lte = reachMax;
  }
  if (growthMin !== undefined || growthMax !== undefined) {
    match['creatorProfileExtended.followersGrowthPct'] = {};
    if (growthMin !== undefined) match['creatorProfileExtended.followersGrowthPct'].$gte = growthMin;
    if (growthMax !== undefined) match['creatorProfileExtended.followersGrowthPct'].$lte = growthMax;
  }

  return match;
}

export async function listCreatorSurveyResponses(
  params: AdminCreatorSurveyListParams,
): Promise<{ items: AdminCreatorSurveyListItem[]; total: number; page: number; pageSize: number }> {
  const TAG = `${SERVICE_TAG}[listCreatorSurveyResponses]`;
  await connectToDatabase();

  const {
    page = 1,
    pageSize = 25,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    ...filters
  } = params;

  const match = buildSurveyMatch(filters);
  const skip = (page - 1) * pageSize;
  const direction = sortOrder === 'asc' ? 1 : -1;

  const sort: Record<string, any> = {};
  if (sortBy === 'name') {
    sort.name = direction;
  } else if (sortBy === 'monetization') {
    sort['creatorProfileExtended.hasDoneSponsoredPosts'] = direction;
    sort['creatorProfileExtended.avgPriceRange'] = direction;
  } else if (sortBy === 'createdAt') {
    sort.createdAt = direction;
  } else {
    sort['creatorProfileExtended.updatedAt'] = direction;
    sort.updatedAt = direction;
  }

  const projection = {
    name: 1,
    email: 1,
    username: 1,
    creatorProfileExtended: 1,
    createdAt: 1,
    updatedAt: 1,
    followers_count: 1,
    media_count: 1,
    gender: 1,
    location: 1,
  };

  try {
    logger.info(`${TAG} match=${JSON.stringify(match)} sort=${JSON.stringify(sort)} page=${page} size=${pageSize}`);
    const [docs, total] = await Promise.all([
      UserModel.find(match, projection).sort(sort).skip(skip).limit(pageSize).lean(),
      UserModel.countDocuments(match),
    ]);

    const userIds = docs.map((d: any) => d._id);
    const topCityMap = await buildTopCityMap(userIds as Types.ObjectId[]);
    const insights = await AccountInsightModel.aggregate([
      { $match: { user: { $in: userIds } } },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$user',
          reach: { $first: '$accountInsightsPeriod.reach' },
          engaged: { $first: '$accountInsightsPeriod.accounts_engaged' },
          views: { $first: '$accountInsightsPeriod.views' },
          followers: { $first: '$followersCount' },
          media: { $first: '$mediaCount' },
          followersHistory: { $push: '$followersCount' },
          topCityFromDemographics: { $first: { $arrayElemAt: ['$audienceDemographics.follower_demographics.city', 0] } },
          accountCity: { $first: '$accountDetails.city' },
        },
      },
      {
        $project: {
          reach: 1,
          engaged: 1,
          views: 1,
          followers: 1,
          media: 1,
          topCityFromDemographics: 1,
          accountCity: 1,
          followersPrev: { $arrayElemAt: ['$followersHistory', 1] },
        },
      },
    ]);
    const insightMap = new Map<string, any>();
    insights.forEach((i) => insightMap.set(String(i._id), i));

    const items: AdminCreatorSurveyListItem[] = docs.map((doc) => {
      const id = (doc as any)._id as Types.ObjectId;
      const profile = (doc as any).creatorProfileExtended ?? {};
      const monetizationLabel = buildMonetizationLabel(profile.hasDoneSponsoredPosts ?? null, profile.avgPriceRange ?? null);
      const pains = normalizeArray<string>(profile.mainPains);
      const insight = insightMap.get(String(id)) || {};
      const cityFromDemographics = insight.topCityFromDemographics?.value;
      const resolvedCity = (doc as any).location?.city ?? topCityMap.get(String(id)) ?? cityFromDemographics ?? insight.accountCity ?? null;
      const reach = insight.reach ?? insight.views ?? null;
      const engaged = insight.engaged ?? null;
      const followersLatest = (doc as any).followers_count ?? insight.followers ?? null;
      const followersPrev = insight.followersPrev ?? null;
      const engagementRateComputed =
        reach && engaged && reach > 0 ? (engaged / reach) * 100 : null;
      const growthPctComputed =
        followersLatest != null && followersPrev != null && followersPrev > 0
          ? ((followersLatest - followersPrev) / followersPrev) * 100
          : null;
      return {
        id: id.toString(),
        name: (doc as any).name ?? '—',
        email: (doc as any).email ?? '—',
        username: (doc as any).username ?? null,
        niches: normalizeArray<string>(profile.niches),
        brandTerritories: normalizeArray<string>(profile.brandTerritories),
        stage: normalizeArray(profile.stage),
        mainPains: pains,
        hardestStage: normalizeArray(profile.hardestStage),
        hasDoneSponsoredPosts: profile.hasDoneSponsoredPosts ?? null,
        avgPriceRange: profile.avgPriceRange ?? null,
        updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : (doc as any).updatedAt?.toISOString?.(),
        createdAt: (doc as any).createdAt?.toISOString?.(),
        monetizationLabel,
        mainPainLabel: pains[0] ?? '—',
        followersCount: followersLatest,
        mediaCount: (doc as any).media_count ?? null,
        gender: (doc as any).gender ?? null,
        country: (doc as any).location?.country ?? null,
        city: resolvedCity,
        reach,
        engaged,
        engagementRate: profile.engagementRate ?? engagementRateComputed ?? null,
        followersGrowthPct: profile.followersGrowthPct ?? growthPctComputed ?? null,
      };
    });

    return { items, total, page, pageSize };
  } catch (err: any) {
    logger.error(`${TAG} failed`, err);
    throw new Error(err.message || 'Failed to list creator survey responses');
  }
}

export async function getCreatorSurveyById(id: string): Promise<AdminCreatorSurveyDetail | null> {
  const TAG = `${SERVICE_TAG}[getCreatorSurveyById]`;
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();

  const projection = {
    name: 1,
    email: 1,
    username: 1,
    creatorProfileExtended: 1,
    createdAt: 1,
    updatedAt: 1,
    followers_count: 1,
    media_count: 1,
    gender: 1,
    location: 1,
  };

  const doc = await UserModel.findById(id, projection).lean();
  if (!doc) {
    logger.warn(`${TAG} not found id=${id}`);
    return null;
  }

  const [insight, demoSnapshot, insightHistory] = await Promise.all([
    AccountInsightModel.findOne({ user: id }).sort({ recordedAt: -1 }).lean(),
    AudienceDemographicSnapshotModel.findOne({ user: id }).sort({ recordedAt: -1 }).lean(),
    AccountInsightModel.find({ user: id })
      .sort({ recordedAt: -1 })
      .limit(24)
      .lean()
      .then((rows) =>
        rows.map((row) => ({
          recordedAt: row.recordedAt?.toISOString?.(),
          reach: row.accountInsightsPeriod?.reach ?? null,
          engaged: row.accountInsightsPeriod?.accounts_engaged ?? null,
          followers: row.followersCount ?? row.accountDetails?.followers_count ?? null,
        })),
      ),
  ]);

  const profile = (doc as any).creatorProfileExtended ?? {};
  const cityRecordInsight = insight?.audienceDemographics?.follower_demographics?.city as Record<string, number> | undefined;
  const topCityFromDemographics = cityRecordInsight
    ? Object.entries(cityRecordInsight)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0]
    : undefined;
  const snapshotTopCity = demoSnapshot?.demographics?.follower_demographics?.city as Record<string, number> | undefined;
  const snapshotResolvedCity = snapshotTopCity
    ? Object.entries(snapshotTopCity)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0]
    : undefined;
  const accountCity = (insight as any)?.accountDetails?.city;
  const resolvedCity = (doc as any).location?.city ?? snapshotResolvedCity ?? topCityFromDemographics ?? accountCity ?? null;
  const followersLatest = (doc as any).followers_count ?? insight?.followersCount ?? insight?.accountDetails?.followers_count ?? null;
  const followersPrev = insightHistory?.[1]?.followers ?? null;
  const reach = insight?.accountInsightsPeriod?.reach ?? insight?.accountInsightsPeriod?.views ?? null;
  const engaged = insight?.accountInsightsPeriod?.accounts_engaged ?? null;
  const engagementRateComputed = reach && engaged && reach > 0 ? (engaged / reach) * 100 : null;
  const growthPctComputed =
    followersLatest != null && followersPrev != null && followersPrev > 0
      ? ((followersLatest - followersPrev) / followersPrev) * 100
      : null;
  return {
    id: (doc as any)._id.toString(),
    name: (doc as any).name ?? '—',
    email: (doc as any).email ?? '—',
    username: (doc as any).username ?? null,
    createdAt: (doc as any).createdAt?.toISOString?.(),
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : (doc as any).updatedAt?.toISOString?.(),
    profile,
    followersCount: followersLatest,
    mediaCount: (doc as any).media_count ?? insight?.mediaCount ?? null,
    gender: (doc as any).gender ?? null,
    country: (doc as any).location?.country ?? null,
    city: resolvedCity,
    reach,
    engaged,
    engagementRate: profile.engagementRate ?? engagementRateComputed ?? null,
    followersGrowthPct: profile.followersGrowthPct ?? growthPctComputed ?? null,
    insightsHistory: insightHistory,
  };
}

function mapDistribution(entries: Array<{ _id: string; count: number }> | undefined) {
  if (!entries) return [];
  return entries.map((e) => ({
    value: e._id || 'Sem dado',
    count: e.count,
  }));
}

function withFallbackDistribution(entries: DistributionEntry[], total: number) {
  if (entries.length === 0) {
    return [{ value: 'Sem dado', count: total ?? 0 }];
  }
  return entries;
}

export async function getCreatorSurveyAnalytics(filters: AdminCreatorSurveyFilters): Promise<AdminCreatorSurveyAnalytics> {
  const TAG = `${SERVICE_TAG}[getCreatorSurveyAnalytics]`;
  await connectToDatabase();
  const {
    engagementMin,
    engagementMax,
    reachMin,
    reachMax,
    growthMin,
    growthMax,
    ...matchableFilters
  } = filters;
  const match = buildSurveyMatch(matchableFilters);
  const metricMatch: Record<string, any> = {};
  if (engagementMin !== undefined || engagementMax !== undefined) {
    metricMatch.engagementRate = {};
    if (engagementMin !== undefined) metricMatch.engagementRate.$gte = engagementMin;
    if (engagementMax !== undefined) metricMatch.engagementRate.$lte = engagementMax;
  }
  if (reachMin !== undefined || reachMax !== undefined) {
    metricMatch.reach30d = {};
    if (reachMin !== undefined) metricMatch.reach30d.$gte = reachMin;
    if (reachMax !== undefined) metricMatch.reach30d.$lte = reachMax;
  }
  if (growthMin !== undefined || growthMax !== undefined) {
    metricMatch.followersGrowthPct = {};
    if (growthMin !== undefined) metricMatch.followersGrowthPct.$gte = growthMin;
    if (growthMax !== undefined) metricMatch.followersGrowthPct.$lte = growthMax;
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: 'accountinsights',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
          { $sort: { recordedAt: -1 } },
          { $limit: 1 },
          {
            $project: {
              topCity: { $arrayElemAt: ['$audienceDemographics.follower_demographics.city', 0] },
              accountCity: '$accountDetails.city',
            },
          },
        ],
        as: 'insightCity',
      },
    },
    {
      $addFields: {
        cityFromInsights: {
          $let: {
            vars: { first: { $arrayElemAt: ['$insightCity', 0] } },
            in: {
              $ifNull: ['$$first.topCity.value', '$$first.accountCity'],
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: 'accountinsights',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
          { $sort: { recordedAt: -1 } },
          { $limit: 2 },
          {
            $project: {
              recordedAt: 1,
              reach: {
                $let: {
                  vars: { aip: '$accountInsightsPeriod' },
                  in: {
                    $cond: [
                      { $isArray: '$$aip' },
                      {
                        $let: {
                          vars: {
                            preferred: {
                              $first: {
                                $filter: {
                                  input: '$$aip',
                                  as: 'p',
                                  cond: { $eq: ['$$p.period', 'days_28'] },
                                },
                              },
                            },
                            first: { $first: '$$aip' },
                          },
                          in: {
                            $ifNull: [
                              { $ifNull: ['$$preferred.reach', '$$preferred.views'] },
                              { $ifNull: ['$$first.reach', '$$first.views'] },
                            ],
                          },
                        },
                      },
                      { $ifNull: ['$accountInsightsPeriod.reach', '$accountInsightsPeriod.views'] },
                    ],
                  },
                },
              },
              engaged: {
                $let: {
                  vars: { aip: '$accountInsightsPeriod' },
                  in: {
                    $cond: [
                      { $isArray: '$$aip' },
                      {
                        $let: {
                          vars: {
                            preferred: {
                              $first: {
                                $filter: {
                                  input: '$$aip',
                                  as: 'p',
                                  cond: { $eq: ['$$p.period', 'days_28'] },
                                },
                              },
                            },
                            first: { $first: '$$aip' },
                          },
                          in: { $ifNull: ['$$preferred.accounts_engaged', '$$first.accounts_engaged'] },
                        },
                      },
                      '$accountInsightsPeriod.accounts_engaged',
                    ],
                  },
                },
              },
              views: {
                $let: {
                  vars: { aip: '$accountInsightsPeriod' },
                  in: {
                    $cond: [
                      { $isArray: '$$aip' },
                      {
                        $let: {
                          vars: {
                            preferred: {
                              $first: {
                                $filter: {
                                  input: '$$aip',
                                  as: 'p',
                                  cond: { $eq: ['$$p.period', 'days_28'] },
                                },
                              },
                            },
                            first: { $first: '$$aip' },
                          },
                          in: { $ifNull: ['$$preferred.views', '$$first.views'] },
                        },
                      },
                      '$accountInsightsPeriod.views',
                    ],
                  },
                },
              },
              followers: '$followersCount',
            },
          },
        ],
        as: 'recentInsights',
      },
    },
    {
      $lookup: {
        from: 'metrics',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
          { $sort: { postDate: -1 } },
          { $limit: 1 },
          {
            $project: {
              reachFallback: '$stats.reach',
              engagementRateFallback: '$stats.engagement_rate_on_reach',
            },
          },
        ],
        as: 'latestMetric',
      },
    },
    {
      $addFields: {
        insightReachCandidates: {
          $map: {
            input: '$recentInsights',
            as: 'ri',
            in: { $ifNull: ['$$ri.reach', '$$ri.views'] },
          },
        },
        computedReach30d: {
          $first: {
            $filter: {
              input: '$insightReachCandidates',
              as: 'reachVal',
              cond: { $and: [{ $ne: ['$$reachVal', null] }, { $ne: ['$$reachVal', undefined] }] },
            },
          },
        },
        computedEngaged30d: { $arrayElemAt: ['$recentInsights.engaged', 0] },
        computedFollowers: { $arrayElemAt: ['$recentInsights.followers', 0] },
        computedFollowersPrev: { $arrayElemAt: ['$recentInsights.followers', 1] },
        computedEngagementRate: {
          $let: {
            vars: {
              reachVal: '$computedReach30d',
              engagedVal: { $arrayElemAt: ['$recentInsights.engaged', 0] },
            },
            in: {
              $cond: [
                { $and: [{ $gt: ['$$reachVal', 0] }, { $gt: ['$$engagedVal', 0] }] },
                { $multiply: [{ $divide: ['$$engagedVal', '$$reachVal'] }, 100] },
                null,
              ],
            },
          },
        },
        reachWithFallback: {
          $let: {
            vars: { metric: { $arrayElemAt: ['$latestMetric', 0] } },
            in: { $ifNull: ['$computedReach30d', '$$metric.reachFallback'] },
          },
        },
        engagementRateWithFallback: {
          $let: {
            vars: { metric: { $arrayElemAt: ['$latestMetric', 0] } },
            in: {
              $ifNull: [
                '$computedEngagementRate',
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$$metric.engagementRateFallback', null] },
                        { $ne: ['$$metric.engagementRateFallback', undefined] },
                      ],
                    },
                    { $multiply: ['$$metric.engagementRateFallback', 100] },
                    null,
                  ],
                },
              ],
            },
          },
        },
        computedGrowthPct: {
          $cond: [
            {
              $and: [
                { $gt: [{ $arrayElemAt: ['$recentInsights.followers', 1] }, 0] },
                { $gt: [{ $arrayElemAt: ['$recentInsights.followers', 0] }, 0] },
              ],
            },
            {
              $multiply: [
                {
                  $divide: [
                    {
                      $subtract: [
                        { $arrayElemAt: ['$recentInsights.followers', 0] },
                        { $arrayElemAt: ['$recentInsights.followers', 1] },
                      ],
                    },
                    { $arrayElemAt: ['$recentInsights.followers', 1] },
                  ],
                },
                100,
              ],
            },
            null,
          ],
        },
        hasCity: { $ne: ['$city', null] },
        hasFollowers: {
          $and: [
            { $ne: ['$followers_count', null] },
            { $ne: ['$followers_count', undefined] },
          ],
        },
        hasReach: { $ne: ['$reach30d', null] },
        hasEngagement: { $ne: ['$engagementRate', null] },
        hasMetrics: {
          $or: [
            { $ne: ['$reach30d', null] },
            { $ne: ['$engagementRate', null] },
          ],
        },
        isMonetizing: {
          $or: [
            { $in: ['$hasDoneSponsoredPosts', ['varias', 'poucas']] },
            { $ne: ['$avgPriceRange', null] },
          ],
        },
        subpricingFlag: {
          $and: [
            { $in: ['$avgPriceRange', ['permuta', '0-500', '500-1500']] },
            {
              $or: [
                { $gte: ['$followers_count', 50000] },
                { $gte: ['$reach30d', 50000] },
              ],
            },
          ],
        },
        priorityFlag: {
          $or: [
            {
              $and: [
                { $gt: ['$engagementRate', 2] },
                { $not: ['$isMonetizing'] },
              ],
            },
            { $lt: ['$followersGrowthPct', 0] },
            { $in: ['negociar', '$mainPains'] },
          ],
        },
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        mainPains: '$creatorProfileExtended.mainPains',
        hardestStage: '$creatorProfileExtended.hardestStage',
        hasDoneSponsoredPosts: '$creatorProfileExtended.hasDoneSponsoredPosts',
        avgPriceRange: '$creatorProfileExtended.avgPriceRange',
        mainPlatformReasons: '$creatorProfileExtended.mainPlatformReasons',
        nextPlatform: '$creatorProfileExtended.nextPlatform',
        stage: '$creatorProfileExtended.stage',
        pricingMethod: '$creatorProfileExtended.pricingMethod',
        learningStyles: '$creatorProfileExtended.learningStyles',
        engagementRate: { $ifNull: ['$creatorProfileExtended.engagementRate', '$engagementRateWithFallback'] },
        reach30d: { $ifNull: ['$creatorProfileExtended.reach30d', '$reachWithFallback'] },
        followersGrowthPct: { $ifNull: ['$creatorProfileExtended.followersGrowthPct', '$computedGrowthPct'] },
        success12m: { $ifNull: ['$creatorProfileExtended.success12m', ''] },
        updatedAt: {
          $ifNull: ['$creatorProfileExtended.updatedAt', '$updatedAt'],
        },
        followers_count: { $ifNull: ['$followers_count', '$computedFollowers'] },
        media_count: 1,
        gender: 1,
        country: '$location.country',
        city: { $ifNull: ['$location.city', { $ifNull: ['$cityFromInsights', 'Sem dado'] }] },
        hasCity: 1,
        hasFollowers: 1,
        hasReach: 1,
        hasEngagement: 1,
        hasMetrics: 1,
        isMonetizing: 1,
        subpricingFlag: 1,
        priorityFlag: 1,
      },
    },
    {
      $addFields: {
        sizeBucket: {
          $switch: {
            branches: [
              { case: { $lt: ['$followers_count', 10000] }, then: 'micro' },
              { case: { $and: [{ $gte: ['$followers_count', 10000] }, { $lt: ['$followers_count', 100000] }] }, then: 'mid' },
              { case: { $gte: ['$followers_count', 100000] }, then: 'macro' },
            ],
            default: 'sem-dado',
          },
        },
      },
    },
    ...(Object.keys(metricMatch).length ? [{ $match: metricMatch } as PipelineStage] : []),
    {
      $facet: {
        total: [{ $count: 'count' }],
        pains: [
          { $unwind: '$mainPains' },
          { $group: { _id: '$mainPains', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        hardestStage: [
          { $unwind: '$hardestStage' },
          { $group: { _id: '$hardestStage', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        painsMetrics: [
          { $unwind: '$mainPains' },
          {
            $group: {
              _id: '$mainPains',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgGrowth: { $avg: '$followersGrowthPct' },
              avgFollowers: { $avg: '$followers_count' },
            },
          },
          { $sort: { count: -1 } },
        ],
        hardestStageMetrics: [
          { $unwind: '$hardestStage' },
          {
            $group: {
              _id: '$hardestStage',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgGrowth: { $avg: '$followersGrowthPct' },
              avgFollowers: { $avg: '$followers_count' },
            },
          },
          { $sort: { count: -1 } },
        ],
        monetization: [
          { $group: { _id: '$hasDoneSponsoredPosts', count: { $sum: 1 } } },
        ],
        priceRange: [
          { $group: { _id: '$avgPriceRange', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        platformReasons: [
          { $unwind: '$mainPlatformReasons' },
          { $group: { _id: '$mainPlatformReasons', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        nextPlatform: [
          { $unwind: '$nextPlatform' },
          { $group: { _id: '$nextPlatform', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        nextPlatformMetrics: [
          { $unwind: '$nextPlatform' },
          {
            $group: {
              _id: '$nextPlatform',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgGrowth: { $avg: '$followersGrowthPct' },
              avgFollowers: { $avg: '$followers_count' },
            },
          },
          { $sort: { count: -1 } },
        ],
        pricingMethod: [
          { $group: { _id: '$pricingMethod', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        learningStyles: [
          { $unwind: { path: '$learningStyles', preserveNullAndEmptyArrays: true } },
          { $group: { _id: '$learningStyles', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        successStories: [
          { $match: { success12m: { $ne: '' } } },
          { $group: { _id: '$success12m', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
        timeSeries: [
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$updatedAt', timezone: 'America/Sao_Paulo' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        followersBuckets: [
          {
            $bucket: {
              groupBy: '$followers_count',
              boundaries: [0, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 100000000],
              default: 'sem-dado',
              output: { count: { $sum: 1 } },
            },
          },
        ],
        gender: [
          { $group: { _id: '$gender', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        country: [
          { $group: { _id: '$country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
        city: [
          { $group: { _id: '$city', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
        cityMetrics: [
          {
            $group: {
              _id: '$city',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgGrowth: { $avg: '$followersGrowthPct' },
              avgFollowers: { $avg: '$followers_count' },
              priceRangeList: { $push: '$avgPriceRange' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
        cityPricingBySize: [
          {
            $group: {
              _id: { city: '$city', size: '$sizeBucket' },
              priceRangeList: { $push: '$avgPriceRange' },
              count: { $sum: 1 },
            },
          },
        ],
        engagementBuckets: [
          {
            $group: {
              _id: '$engagementRate',
              avgEngagement: { $avg: '$engagementRate' },
              count: { $sum: 1 },
            },
          },
        ],
        reachBuckets: [
          {
            $group: {
              _id: '$reach30d',
              avgReach: { $avg: '$reach30d' },
              count: { $sum: 1 },
            },
          },
        ],
        growthBuckets: [
          {
            $group: {
              _id: '$followersGrowthPct',
              avgGrowth: { $avg: '$followersGrowthPct' },
              count: { $sum: 1 },
            },
          },
        ],
        stageEngagement: [
          {
            $group: {
              _id: '$stage',
              avgEngagement: { $avg: '$engagementRate' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        stageMetrics: [
          { $unwind: '$stage' },
          {
            $group: {
              _id: '$stage',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgGrowth: { $avg: '$followersGrowthPct' },
              avgFollowers: { $avg: '$followers_count' },
            },
          },
          { $sort: { count: -1 } },
        ],
        monetizationByCountry: [
          {
            $group: {
              _id: '$country',
              total: { $sum: 1 },
              monetizing: {
                $sum: {
                  $cond: [
                    { $in: ['$hasDoneSponsoredPosts', ['varias', 'poucas']] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { monetizing: -1 } },
          { $limit: 10 },
        ],
        metrics: [
          {
            $group: {
              _id: null,
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgGrowth: { $avg: '$followersGrowthPct' },
              avgFollowers: { $avg: '$followers_count' },
              monetizationRate: {
                $avg: {
                  $cond: [{ $in: ['$hasDoneSponsoredPosts', ['varias', 'poucas']] }, 1, 0],
                },
              },
            },
          },
        ],
        dataQuality: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              complete: {
                $sum: {
                  $cond: [
                    { $and: ['$hasCity', '$hasFollowers', '$hasReach', '$hasEngagement'] },
                    1,
                    0,
                  ],
                },
              },
              metricsConnected: {
                $sum: { $cond: ['$hasMetrics', 1, 0] },
              },
              missingCity: { $sum: { $cond: [{ $not: ['$hasCity'] }, 1, 0] } },
              missingFollowers: { $sum: { $cond: [{ $not: ['$hasFollowers'] }, 1, 0] } },
              missingReach: { $sum: { $cond: [{ $not: ['$hasReach'] }, 1, 0] } },
              missingEngagement: { $sum: { $cond: [{ $not: ['$hasEngagement'] }, 1, 0] } },
            },
          },
        ],
        monetizationSplit: [
          {
            $group: {
              _id: '$isMonetizing',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$engagementRate' },
              avgReach: { $avg: '$reach30d' },
              avgFollowers: { $avg: '$followers_count' },
              priceRangeList: { $push: '$avgPriceRange' },
            },
          },
        ],
        subpricingList: [
          { $match: { subpricingFlag: true } },
          {
            $project: {
              _id: 0,
              name: '$name',
              email: '$email',
              followers: '$followers_count',
              reach: '$reach30d',
              priceRange: '$avgPriceRange',
            },
          },
          { $limit: 15 },
        ],
        subpricingCount: [
          { $match: { subpricingFlag: true } },
          { $count: 'count' },
        ],
        priorityList: [
          { $match: { priorityFlag: true } },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              name: '$name',
              email: '$email',
              followers: '$followers_count',
              reach: '$reach30d',
              engagementRate: '$engagementRate',
              monetization: '$hasDoneSponsoredPosts',
              reason: {
                $cond: [
                  '$subpricingFlag',
                  'subprecificacao',
                  {
                    $cond: [
                      { $lt: ['$followersGrowthPct', 0] },
                      'crescimento_negativo',
                      {
                        $cond: [
                          { $not: ['$isMonetizing'] },
                          'monetizacao_baixa',
                          'dor_negociacao',
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          { $limit: 15 },
        ],
      },
    },
  ];

  const [result] = await UserModel.aggregate(pipeline);
  const totalRespondents = result?.total?.[0]?.count ?? 0;
  const monetizationEntries = mapDistribution(result?.monetization);
  const monetizationSplit = result?.monetizationSplit || [];
  const monetizingGroup = monetizationSplit.find((r: any) => r._id === true);
  const nonMonetizingGroup = monetizationSplit.find((r: any) => r._id === false);
  const monetizationYesFromStatus = monetizationEntries
    .filter((m) => m.value === 'varias' || m.value === 'poucas')
    .reduce((acc, cur) => acc + cur.count, 0);
  let monetizationYes = monetizationYesFromStatus;
  let monetizationNo = totalRespondents - monetizationYesFromStatus;
  if ((monetizingGroup?.count || 0) + (nonMonetizingGroup?.count || 0) === totalRespondents && (monetizingGroup?.count || 0) > 0) {
    monetizationYes = monetizingGroup?.count ?? monetizationYesFromStatus;
    monetizationNo = nonMonetizingGroup?.count ?? monetizationNo;
  }

  const pains = mapDistribution(result?.pains);
  const nextPlatform = mapDistribution(result?.nextPlatform);
  const cityMetrics: CityMetric[] = (result?.cityMetrics || []).map((row: any) => ({
    value: row._id || 'Sem dado',
    count: row.count,
    avgEngagement: row.avgEngagement ?? null,
    avgReach: row.avgReach ?? null,
    avgGrowth: row.avgGrowth ?? null,
    avgFollowers: row.avgFollowers ?? null,
    avgTicket: computeAvgTicketFromPriceRange(row.priceRangeList),
  }));
  const cityPricingBySize: CityPricingBySize[] = (result?.cityPricingBySize || []).map((row: any) => ({
    city: row._id?.city || 'Sem dado',
    size: (row._id?.size as any) || 'sem-dado',
    avgTicket: computeAvgTicketFromPriceRange(row.priceRangeList),
    count: row.count,
  }));
  const stageEngagement = (result?.stageEngagement || []).flatMap((row: any) =>
    (row._id || []).map((stage: string) => ({
      value: stage,
      count: row.count,
      avgEngagement: row.avgEngagement ?? null,
    })),
  );

  const avgTicket = (() => {
    const dist = mapDistribution(result?.priceRange);
    if (!dist.length) return null;
    let total = 0;
    let weight = 0;
    dist.forEach((d) => {
      const mid = priceRangeMidpoint(d.value);
      if (mid != null) {
        total += mid * d.count;
        weight += d.count;
      }
    });
    return weight ? total / weight : null;
  })();

  const dataQuality = result?.dataQuality?.[0];
  const buildMonetizationGroup = (isMonetizing: boolean) => {
    const row = monetizationSplit.find((r: any) => r._id === isMonetizing);
    if (!row) return undefined;
    return {
      count: row.count ?? 0,
      avgEngagement: row.avgEngagement ?? null,
      avgReach: row.avgReach ?? null,
      avgFollowers: row.avgFollowers ?? null,
      avgTicket: computeAvgTicketFromPriceRange(row.priceRangeList),
    };
  };
  const subpricingCount = result?.subpricingCount?.[0]?.count ?? 0;
  const subpricingExamples = (result?.subpricingList as any[]) || [];
  const priorityList = (result?.priorityList as any[]) || [];

  return {
    totalRespondents,
    monetizationYesPct: totalRespondents ? Math.round((monetizationYes / totalRespondents) * 100) : 0,
    monetizationNoPct: totalRespondents ? Math.round((monetizationNo / totalRespondents) * 100) : 0,
    topPain: pains[0],
    topNextPlatform: nextPlatform[0],
    qualitySummary: dataQuality
      ? {
          completeResponses: dataQuality.complete ?? 0,
          metricsConnected: dataQuality.metricsConnected ?? 0,
          missingCity: dataQuality.missingCity ?? 0,
          missingFollowers: dataQuality.missingFollowers ?? 0,
          missingReach: dataQuality.missingReach ?? 0,
          missingEngagement: dataQuality.missingEngagement ?? 0,
        }
      : undefined,
    monetizationComparison: {
      monetizing: buildMonetizationGroup(true),
      nonMonetizing: buildMonetizationGroup(false),
    },
    subpricing: {
      count: subpricingCount,
      examples: subpricingExamples,
    },
    priorityList,
    metrics: {
      avgEngagement: result?.metrics?.[0]?.avgEngagement ?? null,
      avgReach: result?.metrics?.[0]?.avgReach ?? null,
      avgGrowth: result?.metrics?.[0]?.avgGrowth ?? null,
      avgFollowers: result?.metrics?.[0]?.avgFollowers ?? null,
      monetizationRate: result?.metrics?.[0]?.monetizationRate ?? null,
      avgTicket,
    },
    distributions: {
      pains: withFallbackDistribution(pains, totalRespondents),
      hardestStage: withFallbackDistribution(mapDistribution(result?.hardestStage), totalRespondents),
      hasDoneSponsoredPosts: withFallbackDistribution(monetizationEntries, totalRespondents),
      avgPriceRange: withFallbackDistribution(mapDistribution(result?.priceRange), totalRespondents),
      mainPlatformReasons: withFallbackDistribution(mapDistribution(result?.platformReasons), totalRespondents),
      nextPlatform: withFallbackDistribution(nextPlatform, totalRespondents),
      pricingMethod: withFallbackDistribution(mapDistribution(result?.pricingMethod), totalRespondents),
      learningStyles: withFallbackDistribution(mapDistribution(result?.learningStyles), totalRespondents),
      followers: withFallbackDistribution((result?.followersBuckets || []).map((b: any) => ({
        value:
          b._id === 'sem-dado'
            ? 'Sem dado'
            : Array.isArray(b._id)
              ? `${b._id[0]}+`
              : typeof b._id === 'number'
                ? `${b._id}+`
                : b._id,
        count: b.count,
      })), totalRespondents),
      gender: withFallbackDistribution(mapDistribution(result?.gender), totalRespondents),
      country: withFallbackDistribution(mapDistribution(result?.country), totalRespondents),
      city: withFallbackDistribution(mapDistribution(result?.city), totalRespondents),
      engagement: withFallbackDistribution((result?.engagementBuckets || []).map((b: any) => ({ value: bucketEngagement(b._id), count: b.count })), totalRespondents),
      reach: withFallbackDistribution((result?.reachBuckets || []).map((b: any) => ({ value: bucketReach(b._id), count: b.count })), totalRespondents),
      growth: withFallbackDistribution((result?.growthBuckets || []).map((b: any) => ({ value: bucketGrowth(b._id), count: b.count })), totalRespondents),
      stageEngagement,
    },
    timeSeries: (result?.timeSeries || []).map((row: any) => ({ date: row._id, count: row.count })),
    topSuccessStories: mapDistribution(result?.successStories),
    monetizationByCountry: (result?.monetizationByCountry || []).map((row: any) => ({
      value: row._id || 'Sem dado',
      total: row.total,
      monetizing: row.monetizing,
      pct: row.total ? Math.round((row.monetizing / row.total) * 100) : 0,
    })),
    metricByCategory: {
      pains: mapCategoryMetrics(result?.painsMetrics),
      hardestStage: mapCategoryMetrics(result?.hardestStageMetrics),
      nextPlatform: mapCategoryMetrics(result?.nextPlatformMetrics),
      stage: mapCategoryMetrics(result?.stageMetrics),
    },
    cityMetrics,
    cityPricingBySize,
  };
}

export async function listOpenCreatorSurveyResponses(
  params: AdminCreatorSurveyOpenResponseParams,
): Promise<AdminCreatorSurveyOpenResponseResult> {
  const TAG = `${SERVICE_TAG}[listOpenCreatorSurveyResponses]`;
  await connectToDatabase();

  const {
    page = 1,
    pageSize = 30,
    question,
    q,
    ...filters
  } = params;

  const match = buildSurveyMatch(filters);
  const projection = {
    name: 1,
    email: 1,
    username: 1,
    creatorProfileExtended: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  logger.info(`${TAG} match=${JSON.stringify(match)} page=${page} size=${pageSize} question=${question || 'all'} q=${q || ''}`);

  const docs = await UserModel.find(match, projection)
    .sort({ 'creatorProfileExtended.updatedAt': -1, updatedAt: -1 })
    .lean();

  const qRegex = q?.trim() ? new RegExp(q.trim(), 'i') : null;
  const fields = question ? OPEN_TEXT_FIELDS.filter((f) => f.key === question) : OPEN_TEXT_FIELDS;

  const responses: AdminCreatorSurveyOpenResponse[] = [];

  docs.forEach((doc: any) => {
    const profile = doc.creatorProfileExtended ?? {};
    const updatedAt = profile.updatedAt ? new Date(profile.updatedAt).toISOString() : doc.updatedAt?.toISOString?.();

    fields.forEach((field) => {
      const rawValue = profile[field.path];
      const values = field.isArray ? normalizeArray<string>(rawValue) : [rawValue];
      values.forEach((val: any, idx: number) => {
        const text = typeof val === 'string' ? val.trim() : '';
        if (!text) return;
        if (qRegex && !qRegex.test(text)) return;
        responses.push({
          id: `${doc._id.toString()}-${field.key}-${idx}`,
          userId: doc._id.toString(),
          name: doc.name ?? '—',
          email: doc.email ?? '—',
          username: doc.username ?? null,
          question: field.key,
          questionLabel: field.label,
          text,
          updatedAt,
        });
      });
    });
  });

  responses.sort((a, b) => {
    const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bDate - aDate;
  });

  const start = (page - 1) * pageSize;
  const paged = responses.slice(start, start + pageSize);

  return {
    responses: paged,
    total: responses.length,
    page,
    pageSize,
    hasMore: start + pageSize < responses.length,
  };
}

export async function updateCreatorSurveyNotes(id: string, adminNotes: string) {
  const TAG = `${SERVICE_TAG}[updateCreatorSurveyNotes]`;
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid creator id');
  await connectToDatabase();
  await UserModel.findByIdAndUpdate(id, { $set: { 'creatorProfileExtended.adminNotes': adminNotes } }).lean();
  logger.info(`${TAG} updated notes for ${id}`);
}

export async function exportCreatorSurveyResponses(filters: AdminCreatorSurveyFilters, columns?: string[], includeHistory = false) {
  const TAG = `${SERVICE_TAG}[exportCreatorSurveyResponses]`;
  await connectToDatabase();
  const match = buildSurveyMatch(filters);
  logger.info(`${TAG} exporting with match=${JSON.stringify(match)}`);

  const projection = {
    name: 1,
    email: 1,
    username: 1,
    creatorProfileExtended: 1,
    createdAt: 1,
    updatedAt: 1,
    followers_count: 1,
    media_count: 1,
    gender: 1,
    location: 1,
  };

  const docs = await UserModel.find(match, projection).lean();

  const userIds = docs.map((d: any) => d._id);
  const insights = await AccountInsightModel.aggregate([
    { $match: { user: { $in: userIds } } },
    { $sort: { recordedAt: -1 } },
    {
      $group: {
        _id: '$user',
        reach: { $first: '$accountInsightsPeriod.reach' },
        engaged: { $first: '$accountInsightsPeriod.accounts_engaged' },
        views: { $first: '$accountInsightsPeriod.views' },
        followers: { $first: '$followersCount' },
        media: { $first: '$mediaCount' },
        topCityFromDemographics: { $first: { $arrayElemAt: ['$audienceDemographics.follower_demographics.city', 0] } },
        accountCity: { $first: '$accountDetails.city' },
      },
    },
  ]);
  const insightMap = new Map<string, any>();
  insights.forEach((i) => insightMap.set(String(i._id), i));

  const historyMap = new Map<string, any[]>();
  if (includeHistory && userIds.length) {
    const history = await AccountInsightModel.aggregate([
      { $match: { user: { $in: userIds } } },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$user',
          history: {
            $push: {
              recordedAt: '$recordedAt',
              reach: '$accountInsightsPeriod.reach',
              engaged: '$accountInsightsPeriod.accounts_engaged',
              followers: '$followersCount',
            },
          },
        },
      },
    ]);
    history.forEach((row: any) => {
      const sliced = (row.history || []).slice(0, 10).map((h: any) => ({
        recordedAt: h.recordedAt ? new Date(h.recordedAt).toISOString() : undefined,
        reach: h.reach ?? null,
        engaged: h.engaged ?? null,
        followers: h.followers ?? null,
      }));
      historyMap.set(String(row._id), sliced);
    });
  }

  const rows = docs.map((doc: any) => {
    const profile = doc.creatorProfileExtended ?? {};
    const monetizationLabel = buildMonetizationLabel(profile.hasDoneSponsoredPosts ?? null, profile.avgPriceRange ?? null);
    const join = (arr: string[]) => normalizeArray<string>(arr).join(', ');
    const insight = insightMap.get(String(doc._id)) || {};
    const cityFromDemographics = insight.topCityFromDemographics?.value;
    const resolvedCity = (doc.location?.city ?? cityFromDemographics ?? insight.accountCity ?? null) as string | null;
    const reach = insight.reach ?? insight.views ?? '';
    return {
      id: doc._id.toString(),
      name: doc.name ?? '',
      email: doc.email ?? '',
      username: doc.username ?? '',
      followersCount: doc.followers_count ?? insight.followers ?? '',
      mediaCount: doc.media_count ?? insight.media ?? '',
      reach,
      engaged: insight.engaged ?? '',
      gender: doc.gender ?? '',
      country: doc.location?.country ?? '',
      city: resolvedCity ?? '',
      stage: join(profile.stage),
      brandTerritories: join(profile.brandTerritories),
      niches: join(profile.niches),
      hasHelp: join(profile.hasHelp),
      dreamBrands: join(profile.dreamBrands),
      mainGoal3m: profile.mainGoal3m ?? '',
      mainGoalOther: profile.mainGoalOther ?? '',
      success12m: profile.success12m ?? '',
      mainPains: join(profile.mainPains),
      otherPain: profile.otherPain ?? '',
      hardestStage: join(profile.hardestStage),
      hasDoneSponsoredPosts: profile.hasDoneSponsoredPosts ?? '',
      avgPriceRange: profile.avgPriceRange ?? '',
      bundlePriceRange: profile.bundlePriceRange ?? '',
      pricingMethod: profile.pricingMethod ?? '',
      pricingFear: profile.pricingFear ?? '',
      pricingFearOther: profile.pricingFearOther ?? '',
      mainPlatformReasons: join(profile.mainPlatformReasons),
      reasonOther: profile.reasonOther ?? '',
      dailyExpectation: profile.dailyExpectation ?? '',
      nextPlatform: join(profile.nextPlatform),
      learningStyles: join(profile.learningStyles),
      notificationPref: join(profile.notificationPref),
      monetizationLabel,
      adminNotes: profile.adminNotes ?? '',
      updatedAt: profile.updatedAt || doc.updatedAt,
      createdAt: doc.createdAt,
      insightsHistory: includeHistory ? JSON.stringify(historyMap.get(String(doc._id)) || []) : undefined,
    };
  });

  if (!columns || !columns.length) return rows;

  return rows.map((row) => {
    const filtered: Record<string, any> = {};
    columns.forEach((col) => {
      filtered[col] = (row as any)[col] ?? '';
    });
    return filtered;
  });
}
