import { subDays } from 'date-fns';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/app/lib/dataService/connection';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import AudienceDemographicSnapshotModel from '@/app/models/demographics/AudienceDemographicSnapshot';
import { getCategoryById } from '@/app/lib/classification';
import { logger } from '@/app/lib/logger';
import {
  LandingCoverageRegion,
  LandingCoverageSegment,
} from '@/types/landing';
import {
  BRAZIL_CITY_TO_STATE_MAP,
  normalizeCityName,
} from '@/data/brazilCityToState';
import { BRAZIL_REGION_STATES } from '@/data/brazilRegions';

const SERVICE_TAG = '[landing][coverageService]';
const COVERAGE_SEGMENT_LOOKBACK_DAYS = Number(
  process.env.LANDING_COVERAGE_SEGMENT_LOOKBACK_DAYS ?? 30,
);
const DEFAULT_SEGMENT_LIMIT = Number(
  process.env.LANDING_COVERAGE_SEGMENT_LIMIT ?? 6,
);
const DEFAULT_REGION_LIMIT = Number(
  process.env.LANDING_COVERAGE_REGION_LIMIT ?? 6,
);
const COVERAGE_TTL_MS = Math.max(
  60_000,
  Math.min(15 * 60_000, Number(process.env.LANDING_COVERAGE_TTL_MS ?? 300_000)),
);

type CoverageCachePayload = {
  segments: LandingCoverageSegment[];
  regions: LandingCoverageRegion[];
};

type CoverageCache = {
  expires: number;
  payload: CoverageCachePayload;
};

if (!(global as any).__landingCoverageCache)
  (global as any).__landingCoverageCache = null as CoverageCache | null;

type LeanCommunityUser = {
  _id: Types.ObjectId;
  followers_count?: number | null;
  communityInspirationOptInDate?: Date | null;
  username?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
  isInstagramConnected?: boolean | null;
};

type RawSegmentAggregation = {
  _id: string;
  postCount: number;
  totalInteractions: number;
  totalReach: number;
};

type RawAudienceSnapshot = {
  _id: Types.ObjectId;
  demographics: {
    follower_demographics?: {
      city?: Record<string, number>;
      country?: Record<string, number>;
    };
    engaged_audience_demographics?: {
      city?: Record<string, number>;
      country?: Record<string, number>;
    };
  };
};

const BRAZIL_STATE_LABELS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

const STATE_TO_REGION: Record<string, string> = Object.entries(
  BRAZIL_REGION_STATES,
).reduce<Record<string, string>>((acc, [region, states]) => {
  states.forEach((state) => {
    acc[state] = region;
  });
  return acc;
}, {});

async function loadActiveUsers(): Promise<{
  activeUsers: LeanCommunityUser[];
  activeCreatorIds: Types.ObjectId[];
}> {
  await connectToDatabase();

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
    },
  )
    .lean<LeanCommunityUser[]>()
    .exec()) as LeanCommunityUser[];

  const activeUsers = communityUsers.filter(
    (user) => user.isInstagramConnected === true,
  );
  const activeCreatorIds = activeUsers.map((user) => user._id);

  return { activeUsers, activeCreatorIds };
}

function toProxyAvatar(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  }
  return raw;
}

export async function fetchCoverageData(options?: {
  segmentLimit?: number;
  regionLimit?: number;
}): Promise<CoverageCachePayload> {
  const { segmentLimit = DEFAULT_SEGMENT_LIMIT, regionLimit = DEFAULT_REGION_LIMIT } =
    options ?? {};

  const now = Date.now();
  const cacheEntry = (global as any).__landingCoverageCache as CoverageCache | null;
  if (cacheEntry && cacheEntry.expires > now) {
    return cacheEntry.payload;
  }

  const TAG = `${SERVICE_TAG}[fetchCoverageData]`;
  logger.info(`${TAG} Building coverage payload.`);

  const { activeUsers, activeCreatorIds } = await loadActiveUsers();
  if (!activeCreatorIds.length) {
    logger.warn(`${TAG} No active creators found.`);
    const emptyPayload: CoverageCachePayload = { segments: [], regions: [] };
    (global as any).__landingCoverageCache = {
      expires: now + COVERAGE_TTL_MS,
      payload: emptyPayload,
    };
    return emptyPayload;
  }

  const [segments, regions] = await Promise.all([
    computeCoverageSegments(activeCreatorIds, segmentLimit),
    computeCoverageRegions(activeCreatorIds, regionLimit),
  ]);

  const payload: CoverageCachePayload = { segments, regions };
  (global as any).__landingCoverageCache = {
    expires: now + COVERAGE_TTL_MS,
    payload,
  };

  return payload;
}

function humanizeSegmentId(raw: string): string {
  return raw
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function computeCoverageSegments(
  activeCreatorIds: Types.ObjectId[],
  limit: number,
): Promise<LandingCoverageSegment[]> {
  if (!activeCreatorIds.length) return [];

  const since = subDays(new Date(), COVERAGE_SEGMENT_LOOKBACK_DAYS);

  const rawSegments = (await MetricModel.aggregate<RawSegmentAggregation>([
    {
      $match: {
        user: { $in: activeCreatorIds },
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
            cond: {
              $and: [{ $ne: ['$$ctx', null] }, { $ne: ['$$ctx', ''] }],
            },
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
        totalInteractions: {
          $sum: { $ifNull: ['$stats.total_interactions', 0] },
        },
        totalReach: { $sum: { $ifNull: ['$stats.reach', 0] } },
      },
    },
    { $sort: { totalReach: -1, totalInteractions: -1 } },
    { $limit: limit * 3 },
  ]).exec()) as RawSegmentAggregation[];

  const totalReach = rawSegments.reduce(
    (sum, segment) => sum + (segment.totalReach ?? 0),
    0,
  );

  return rawSegments.slice(0, limit).map((segment) => {
    const category = getCategoryById(segment._id, 'context');
    const label = category?.label ?? humanizeSegmentId(segment._id);
    const reach = Number(segment.totalReach ?? 0);
    const postCount = Number(segment.postCount ?? 0);
    const totalInteractions = Number(segment.totalInteractions ?? 0);
    const avgInteractions =
      postCount > 0 ? totalInteractions / postCount : 0;
    const engagementRate =
      reach > 0 ? (totalInteractions / reach) * 100 : null;

    return {
      id: segment._id,
      label,
      reach,
      interactions: totalInteractions,
      postCount,
      avgInteractionsPerPost: avgInteractions,
      share: totalReach > 0 ? reach / totalReach : 0,
      engagementRate,
    };
  });
}

async function computeCoverageRegions(
  activeCreatorIds: Types.ObjectId[],
  limit: number,
): Promise<LandingCoverageRegion[]> {
  if (!activeCreatorIds.length) return [];

  const snapshots = (await AudienceDemographicSnapshotModel.aggregate<RawAudienceSnapshot>([
    {
      $match: {
        user: { $in: activeCreatorIds },
        'demographics.follower_demographics.city': { $exists: true },
      },
    },
    { $sort: { recordedAt: -1 } },
    {
      $group: {
        _id: '$user',
        demographics: { $first: '$demographics' },
      },
    },
  ]).exec()) as RawAudienceSnapshot[];

  const followersByState = new Map<string, number>();
  const engagedByState = new Map<string, number>();

  const accumulate = (
    target: Map<string, number>,
    state: string,
    value: number,
  ) => {
    if (!state || !Number.isFinite(value)) return;
    target.set(state, (target.get(state) ?? 0) + value);
  };

  snapshots.forEach((snapshot) => {
    const followerCities =
      snapshot.demographics?.follower_demographics?.city ?? {};
    const engagedCities =
      snapshot.demographics?.engaged_audience_demographics?.city ?? {};

    Object.entries(followerCities).forEach(([city, count]) => {
      const normalized = normalizeCityName(city);
      const state = BRAZIL_CITY_TO_STATE_MAP[normalized];
      if (state) accumulate(followersByState, state, Number(count ?? 0));
    });

    Object.entries(engagedCities).forEach(([city, count]) => {
      const normalized = normalizeCityName(city);
      const state = BRAZIL_CITY_TO_STATE_MAP[normalized];
      if (state) accumulate(engagedByState, state, Number(count ?? 0));
    });
  });

  const totalFollowers = Array.from(followersByState.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalEngaged = Array.from(engagedByState.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  const sortedFollowers = Array.from(followersByState.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  return sortedFollowers.slice(0, limit).map(([state, count]) => {
    const label = BRAZIL_STATE_LABELS[state] ?? state;
    const region = STATE_TO_REGION[state] ?? null;
    const engaged = engagedByState.get(state) ?? null;

    return {
      code: state,
      label,
      region,
      followers: count,
      share: totalFollowers > 0 ? count / totalFollowers : 0,
      engagedFollowers: engaged,
      engagedShare:
        engaged && totalEngaged > 0 ? engaged / totalEngaged : null,
    };
  });
}

export async function fetchCoverageSegments(options?: {
  limit?: number;
}): Promise<LandingCoverageSegment[]> {
  const { segments } = await fetchCoverageData({
    segmentLimit: options?.limit ?? DEFAULT_SEGMENT_LIMIT,
    regionLimit: DEFAULT_REGION_LIMIT,
  });
  return segments;
}

export async function fetchCoverageRegions(options?: {
  limit?: number;
}): Promise<LandingCoverageRegion[]> {
  const { regions } = await fetchCoverageData({
    segmentLimit: DEFAULT_SEGMENT_LIMIT,
    regionLimit: options?.limit ?? DEFAULT_REGION_LIMIT,
  });
  return regions;
}
