import { Types } from 'mongoose';
import type { PipelineStage } from 'mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import { connectToDatabase } from '@/app/lib/dataService/connection';
import { logger } from '@/app/lib/logger';
import {
  AdminCreatorSurveyAnalytics,
  AdminCreatorSurveyDetail,
  AdminCreatorSurveyFilters,
  AdminCreatorSurveyListItem,
  AdminCreatorSurveyListParams,
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
    'creatorProfileExtended.engagementRate': 1,
    'creatorProfileExtended.reach30d': 1,
    'creatorProfileExtended.followersGrowthPct': 1,
  };

  try {
    logger.info(`${TAG} match=${JSON.stringify(match)} sort=${JSON.stringify(sort)} page=${page} size=${pageSize}`);
    const [docs, total] = await Promise.all([
      UserModel.find(match, projection).sort(sort).skip(skip).limit(pageSize).lean(),
      UserModel.countDocuments(match),
    ]);

    const userIds = docs.map((d: any) => d._id);
    const insights = await AccountInsightModel.aggregate([
      { $match: { user: { $in: userIds } } },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$user',
          reach: { $first: '$accountInsightsPeriod.reach' },
          engaged: { $first: '$accountInsightsPeriod.accounts_engaged' },
          followers: { $first: '$followersCount' },
          media: { $first: '$mediaCount' },
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
        followersCount: (doc as any).followers_count ?? null,
        mediaCount: (doc as any).media_count ?? null,
        gender: (doc as any).gender ?? null,
        country: (doc as any).location?.country ?? null,
        city: (doc as any).location?.city ?? null,
        reach: insight.reach ?? null,
        engaged: insight.engaged ?? null,
        engagementRate: profile.engagementRate ?? null,
        followersGrowthPct: profile.followersGrowthPct ?? null,
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

  const insight = await AccountInsightModel.findOne({ user: id }).sort({ recordedAt: -1 }).lean();

  const profile = (doc as any).creatorProfileExtended ?? {};
  return {
    id: (doc as any)._id.toString(),
    name: (doc as any).name ?? '—',
    email: (doc as any).email ?? '—',
    username: (doc as any).username ?? null,
    createdAt: (doc as any).createdAt?.toISOString?.(),
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : (doc as any).updatedAt?.toISOString?.(),
    profile,
    followersCount: (doc as any).followers_count ?? null,
    mediaCount: (doc as any).media_count ?? insight?.mediaCount ?? null,
    gender: (doc as any).gender ?? null,
    country: (doc as any).location?.country ?? null,
    city: (doc as any).location?.city ?? null,
    reach: insight?.accountInsightsPeriod?.reach ?? null,
    engaged: insight?.accountInsightsPeriod?.accounts_engaged ?? null,
    engagementRate: profile.engagementRate ?? null,
    followersGrowthPct: profile.followersGrowthPct ?? null,
  };
}

function mapDistribution(entries: Array<{ _id: string; count: number }> | undefined) {
  if (!entries) return [];
  return entries
    .filter((e) => !!e._id)
    .map((e) => ({ value: e._id, count: e.count }));
}

export async function getCreatorSurveyAnalytics(filters: AdminCreatorSurveyFilters): Promise<AdminCreatorSurveyAnalytics> {
  const TAG = `${SERVICE_TAG}[getCreatorSurveyAnalytics]`;
  await connectToDatabase();
  const match = buildSurveyMatch(filters);

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $project: {
        mainPains: '$creatorProfileExtended.mainPains',
        hardestStage: '$creatorProfileExtended.hardestStage',
        hasDoneSponsoredPosts: '$creatorProfileExtended.hasDoneSponsoredPosts',
        avgPriceRange: '$creatorProfileExtended.avgPriceRange',
        mainPlatformReasons: '$creatorProfileExtended.mainPlatformReasons',
        nextPlatform: '$creatorProfileExtended.nextPlatform',
        pricingMethod: '$creatorProfileExtended.pricingMethod',
        learningStyles: '$creatorProfileExtended.learningStyles',
        engagementRate: '$creatorProfileExtended.engagementRate',
        reach30d: '$creatorProfileExtended.reach30d',
        followersGrowthPct: '$creatorProfileExtended.followersGrowthPct',
        success12m: { $ifNull: ['$creatorProfileExtended.success12m', ''] },
        updatedAt: {
          $ifNull: ['$creatorProfileExtended.updatedAt', '$updatedAt'],
        },
        followers_count: 1,
        media_count: 1,
        gender: 1,
        country: '$location.country',
        city: '$location.city',
      },
    },
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
              _id: '$creatorProfileExtended.stage',
              avgEngagement: { $avg: '$engagementRate' },
              count: { $sum: 1 },
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
      },
    },
  ];

  const [result] = await UserModel.aggregate(pipeline);
  const totalRespondents = result?.total?.[0]?.count ?? 0;
  const monetizationEntries = mapDistribution(result?.monetization);
  const monetizationYes = monetizationEntries
    .filter((m) => m.value === 'varias' || m.value === 'poucas')
    .reduce((acc, cur) => acc + cur.count, 0);
  const monetizationNo = totalRespondents - monetizationYes;

  const pains = mapDistribution(result?.pains);
  const nextPlatform = mapDistribution(result?.nextPlatform);
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

  return {
    totalRespondents,
    monetizationYesPct: totalRespondents ? Math.round((monetizationYes / totalRespondents) * 100) : 0,
    monetizationNoPct: totalRespondents ? Math.round((monetizationNo / totalRespondents) * 100) : 0,
    topPain: pains[0],
    topNextPlatform: nextPlatform[0],
    metrics: {
      avgEngagement: result?.metrics?.[0]?.avgEngagement ?? null,
      avgReach: result?.metrics?.[0]?.avgReach ?? null,
      avgGrowth: result?.metrics?.[0]?.avgGrowth ?? null,
      avgFollowers: result?.metrics?.[0]?.avgFollowers ?? null,
      monetizationRate: result?.metrics?.[0]?.monetizationRate ?? null,
      avgTicket,
    },
    distributions: {
      pains,
      hardestStage: mapDistribution(result?.hardestStage),
      hasDoneSponsoredPosts: monetizationEntries,
      avgPriceRange: mapDistribution(result?.priceRange),
      mainPlatformReasons: mapDistribution(result?.platformReasons),
      nextPlatform,
      pricingMethod: mapDistribution(result?.pricingMethod),
      learningStyles: mapDistribution(result?.learningStyles),
      followers: (result?.followersBuckets || []).map((b: any) => ({
        value:
          b._id === 'sem-dado'
            ? 'Sem dado'
            : Array.isArray(b._id)
              ? `${b._id[0]}+`
              : typeof b._id === 'number'
                ? `${b._id}+`
                : b._id,
        count: b.count,
      })),
      gender: mapDistribution(result?.gender),
      country: mapDistribution(result?.country),
      city: mapDistribution(result?.city),
      engagement: (result?.engagementBuckets || []).map((b: any) => ({ value: bucketEngagement(b._id), count: b.count })),
      reach: (result?.reachBuckets || []).map((b: any) => ({ value: bucketReach(b._id), count: b.count })),
      growth: (result?.growthBuckets || []).map((b: any) => ({ value: bucketGrowth(b._id), count: b.count })),
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
  };
}

export async function updateCreatorSurveyNotes(id: string, adminNotes: string) {
  const TAG = `${SERVICE_TAG}[updateCreatorSurveyNotes]`;
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid creator id');
  await connectToDatabase();
  await UserModel.findByIdAndUpdate(id, { $set: { 'creatorProfileExtended.adminNotes': adminNotes } }).lean();
  logger.info(`${TAG} updated notes for ${id}`);
}

export async function exportCreatorSurveyResponses(filters: AdminCreatorSurveyFilters, columns?: string[]) {
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
        followers: { $first: '$followersCount' },
        media: { $first: '$mediaCount' },
      },
    },
  ]);
  const insightMap = new Map<string, any>();
  insights.forEach((i) => insightMap.set(String(i._id), i));

  const rows = docs.map((doc: any) => {
    const profile = doc.creatorProfileExtended ?? {};
    const monetizationLabel = buildMonetizationLabel(profile.hasDoneSponsoredPosts ?? null, profile.avgPriceRange ?? null);
    const join = (arr: string[]) => normalizeArray<string>(arr).join(', ');
    const insight = insightMap.get(String(doc._id)) || {};
    return {
      id: doc._id.toString(),
      name: doc.name ?? '',
      email: doc.email ?? '',
      username: doc.username ?? '',
      followersCount: doc.followers_count ?? insight.followers ?? '',
      mediaCount: doc.media_count ?? insight.media ?? '',
      reach: insight.reach ?? '',
      engaged: insight.engaged ?? '',
      gender: doc.gender ?? '',
      country: doc.location?.country ?? '',
      city: doc.location?.city ?? '',
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
