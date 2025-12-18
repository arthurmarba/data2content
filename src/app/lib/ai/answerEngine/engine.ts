import { logger } from '@/app/lib/logger';
import MetricModel, { IMetric } from '@/app/models/Metric';
import * as stateService from '@/app/lib/stateService';
import { buildProfileSignals } from './profile';
import { detectAnswerIntent, resolvePolicy, coerceToAnswerIntent, detectRequestedFormat } from './policies';
import { rankCandidates } from './ranker';
import type {
  AnswerEngineRequest,
  AnswerEngineResult,
  CandidatePost,
  RankedCandidate,
  UserBaselines,
  ContextPack,
} from './types';

const BASELINE_TTL_SECONDS = 6 * 60 * 60; // 6h

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] ?? 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? sorted[0] ?? 0;
    const right = sorted[mid] ?? sorted[sorted.length - 1] ?? left;
    return (left + right) / 2;
  }
  return sorted[mid] ?? sorted[sorted.length - 1] ?? 0;
}

function computeEngagementRate(stats: any) {
  if (typeof stats?.engagement_rate_on_reach === 'number') return stats.engagement_rate_on_reach;
  const reach = typeof stats?.reach === 'number' ? stats.reach : stats?.impressions;
  if (!reach || reach <= 0) return null;
  const interactions = typeof stats?.total_interactions === 'number'
    ? stats.total_interactions
    : (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.saved || 0);
  return interactions / reach;
}

async function computeBaselinesForUser(
  userId: string,
  windowDays: number,
  now: Date,
): Promise<UserBaselines> {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const docs: Array<IMetric & { _id: string }> = await MetricModel.find({
    user: userId,
    postDate: { $gte: since },
  })
    .select('stats format postDate updatedAt')
    .sort({ postDate: -1 })
    .limit(600)
    .lean();

  const interactionValues: number[] = [];
  const erValues: number[] = [];
  const perFormat: UserBaselines['perFormat'] = {};
  const perFormatInteractions: Record<string, number[]> = {};
  const perFormatEr: Record<string, number[]> = {};

  for (const doc of docs) {
    const interactions = typeof (doc as any)?.stats?.total_interactions === 'number'
      ? (doc as any).stats.total_interactions
      : ((doc as any)?.stats?.likes || 0) +
        ((doc as any)?.stats?.comments || 0) +
        ((doc as any)?.stats?.shares || 0) +
        ((doc as any)?.stats?.saved || 0);
    interactionValues.push(interactions);
    const er = computeEngagementRate((doc as any).stats);
    if (typeof er === 'number' && er > 0) erValues.push(er);

    const formats = Array.isArray((doc as any)?.format) ? (doc as any).format : [];
    for (const fmt of formats) {
      if (!perFormatInteractions[fmt]) perFormatInteractions[fmt] = [];
      perFormatInteractions[fmt].push(interactions);
      if (typeof er === 'number' && er > 0) {
        if (!perFormatEr[fmt]) perFormatEr[fmt] = [];
        perFormatEr[fmt].push(er);
      }
    }
  }

  for (const fmt of Object.keys(perFormatInteractions)) {
    const fmtInteractions = perFormatInteractions[fmt] || [];
    const fmtEr = perFormatEr[fmt] || [];
    perFormat[fmt] = {
      totalInteractionsP50: median(fmtInteractions),
      engagementRateP50: fmtEr.length ? median(fmtEr) : null,
      sampleSize: fmtInteractions.length,
    };
  }

  return {
    totalInteractionsP50: median(interactionValues),
    engagementRateP50: median(erValues),
    perFormat,
    sampleSize: interactionValues.length,
    computedAt: now.getTime(),
    windowDays,
  };
}

async function getBaselinesCached(userId: string, windowDays: number, now: Date): Promise<UserBaselines> {
  const cacheKey = `answerEngine:baselines:${userId}:${windowDays}`;
  try {
    const cached = await stateService.getFromCache(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as UserBaselines;
      return parsed;
    }
  } catch (err) {
    logger.warn('[answer-engine] baseline cache read failed', err);
  }

  const computed = await computeBaselinesForUser(userId, windowDays, now);
  try {
    await stateService.setInCache(cacheKey, JSON.stringify(computed), BASELINE_TTL_SECONDS);
  } catch (err) {
    logger.warn('[answer-engine] baseline cache write failed', err);
  }
  return computed;
}

function toCandidate(doc: any): CandidatePost {
  const stats = doc?.stats || {};
  const totalInteractions = typeof stats.total_interactions === 'number'
    ? stats.total_interactions
    : (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.saved || 0);
  return {
    id: String(doc._id),
    permalink: doc.postLink || doc.permalink || null,
    postDate: doc.postDate || null,
    format: Array.isArray(doc.format) ? doc.format : [],
    tags: [
      ...(Array.isArray(doc.context) ? doc.context : []),
      ...(Array.isArray(doc.proposal) ? doc.proposal : []),
      ...(Array.isArray(doc.tone) ? doc.tone : []),
    ].filter(Boolean),
    stats: {
      total_interactions: totalInteractions,
      engagement_rate_on_reach: computeEngagementRate(stats),
      reach: stats.reach ?? stats.impressions ?? null,
      saves: stats.saved ?? null,
      shares: stats.shares ?? null,
      comments: stats.comments ?? null,
      likes: stats.likes ?? null,
      watch_time: stats.ig_reels_video_view_total_time ?? null,
      retention_rate: stats.retention_rate ?? null,
    },
    raw: doc,
  };
}

async function fetchCandidates(
  userId: string,
  windowDays: number,
  minAbsoluteInteractions: number,
  options: { formatLocked?: string | null; tags?: string[]; relaxApplied: Array<{ step: string; reason: string }> },
): Promise<{ candidates: CandidatePost[]; appliedTags?: string[] }> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const baseQuery: any = {
    user: userId,
    postDate: { $gte: since },
    'stats.total_interactions': { $gte: minAbsoluteInteractions * 0.6 },
  };
  if (options.formatLocked) {
    baseQuery.format = { $in: [options.formatLocked] };
  }

  const tagFilter = options.tags && options.tags.length
    ? {
        $or: [
          { context: { $in: options.tags } },
          { proposal: { $in: options.tags } },
          { tone: { $in: options.tags } },
        ],
      }
    : null;

  const queryWithTags = tagFilter ? { ...baseQuery, ...tagFilter } : baseQuery;

  const findWithQuery = async (query: any) => {
    const docs = await MetricModel.find(query)
      .select('stats postDate format proposal context tone postLink coverUrl updatedAt')
      .sort({ postDate: -1 })
      .limit(400)
      .lean();
    return docs.map(toCandidate);
  };

  let candidates = await findWithQuery(queryWithTags);
  if (!candidates.length && tagFilter) {
    options.relaxApplied.push({ step: 'tags_relaxed', reason: 'no_candidates_with_tags' });
    candidates = await findWithQuery(baseQuery);
    return { candidates, appliedTags: [] };
  }

  return { candidates, appliedTags: options.tags };
}

function buildContextPack(
  ranked: RankedCandidate[],
  top: RankedCandidate[],
  baselines: UserBaselines,
  policy: ReturnType<typeof resolvePolicy>,
  profileSignals: ReturnType<typeof buildProfileSignals>,
  query: string,
  relaxApplied: Array<{ step: string; reason: string }>,
): ContextPack {
  const notes: string[] = [];
  notes.push(`threshold_interactions=${policy.thresholds.effectiveInteractions}`);
  if (policy.thresholds.effectiveEr) {
    notes.push(`threshold_er=${(policy.thresholds.effectiveEr * 100).toFixed(2)}%`);
  }
  if (policy.formatLocked) notes.push(`format_locked=${policy.formatLocked}`);
  return {
    user_profile: profileSignals,
    user_baselines: baselines,
    policy: {
      intent: policy.intent,
      requireHighEngagement: policy.requireHighEngagement,
      thresholds: policy.thresholds,
      formatLocked: policy.formatLocked,
      metricsRequired: policy.metricsRequired,
    },
    top_posts: top.map((p) => ({
      id: p.id,
      permalink: p.permalink || null,
      formato: p.format?.[0] || null,
      tema: p.tags?.[0] || null,
      total_interactions: p.stats.total_interactions || 0,
      saves: p.stats.saves ?? null,
      shares: p.stats.shares ?? null,
      comments: p.stats.comments ?? null,
      reach: p.stats.reach ?? null,
      engagement_rate_by_reach: p.stats.engagement_rate_on_reach ?? null,
      baseline_delta: p.baselineDelta ?? null,
      reach_delta: p.reachDelta ?? null,
      post_date: p.postDate ? new Date(p.postDate).toISOString() : null,
    })),
    generated_at: new Date().toISOString(),
    query,
    intent: policy.intent,
    notes,
    relaxApplied: relaxApplied.length ? relaxApplied : undefined,
  };
}

export async function runAnswerEngine(request: AnswerEngineRequest): Promise<AnswerEngineResult> {
  const now = request.now || new Date();
  const profileSignals = buildProfileSignals(request.surveyProfile, request.preferences);
  const intent = detectAnswerIntent(request.query, coerceToAnswerIntent(request.explicitIntent));
  const baselines =
    request.baselineOverride ||
    (await getBaselinesCached(String(request.user._id), 90, now).catch((err) => {
      logger.error('[answer-engine] baseline computation failed', err);
      return null;
    })) ||
    {
      totalInteractionsP50: 0,
      engagementRateP50: null,
      perFormat: {},
      sampleSize: 0,
      computedAt: now.getTime(),
      windowDays: 90,
    };

  const policy = resolvePolicy(intent, request.query, baselines, (request.user as any)?.followers_count || null);
  const relaxApplied: Array<{ step: string; reason: string }> = [];
  const tagsForFilter: string[] = [];
  if (profileSignals.nicho) tagsForFilter.push(profileSignals.nicho);

  const requestedFormat = policy.formatLocked || detectRequestedFormat(request.query);

  const candidateFetchResult =
    request.candidateOverride
      ? {
          candidates: policy.formatLocked
            ? request.candidateOverride.filter((c) => (c.format || []).includes(policy.formatLocked as string))
            : request.candidateOverride,
          appliedTags: tagsForFilter,
        }
      : await fetchCandidates(String(request.user._id), policy.windowDays, policy.thresholds.minAbsolute, {
          formatLocked: requestedFormat,
          tags: tagsForFilter,
          relaxApplied,
        });

  const candidates = candidateFetchResult.candidates;

  const ranked = rankCandidates(candidates, {
    policy,
    baselines: baselines as any,
    profileSignals,
    now,
    tagsApplied: candidateFetchResult.appliedTags,
  });

  const topPosts = ranked.filter((c) => c.passesThreshold).slice(0, policy.maxPosts);
  if (!topPosts.length && requestedFormat) {
    relaxApplied.push({ step: 'format_locked_empty', reason: `no_${requestedFormat}_candidates_above_threshold` });
  }

  if (!topPosts.length) {
    logger.warn('[answer-engine] chat_pack_empty', {
      intent,
      formatLocked: policy.formatLocked || null,
      metricsRequired: policy.metricsRequired,
      tags: tagsForFilter,
    });
  }

  const contextPack = buildContextPack(
    ranked,
    topPosts,
    baselines as any,
    policy,
    profileSignals,
    request.query,
    relaxApplied,
  );

  logger.info('[answer-engine] chat_answer_intent_detected', {
    intent,
    confidence: null,
    query: request.query.slice(0, 120),
  });
  logger.info('[answer-engine] chat_candidates_found', {
    count: candidates.length,
    aboveThreshold: topPosts.length,
  });
  logger.info('[answer-engine] chat_threshold_applied', {
    min_abs: policy.thresholds.minAbsolute,
    min_rel: policy.thresholds.minRelativeInteractions,
    min_er: policy.thresholds.minRelativeEr,
  });
  if (ranked.length) {
    logger.info('[answer-engine] chat_recommendations_returned', {
      count: topPosts.length,
      top_score: ranked[0]?.score || null,
    });
  }

  return {
    intent,
    policy,
    baselines: baselines as any,
    ranked,
    topPosts,
    contextPack,
    telemetry: {
      candidatesConsidered: candidates.length,
      thresholdApplied: policy.thresholds,
      relaxApplied,
    },
  };
}
