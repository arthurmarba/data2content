// src/app/api/discover/feed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isActiveLike, normalizePlanStatus } from '@/app/lib/planGuard';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';

import { findGlobalPostsByCriteria } from '@/app/lib/dataService/marketAnalysis/postsService';
import { fetchTopCategories } from '@/app/lib/dataService/marketAnalysis/rankingsService';
import { recommendWeeklySlots } from '@/app/lib/planner/recommender';
import findCommunityInspirationPosts from '@/utils/findCommunityInspirationPosts';
import { getExperienceFilters } from '@/app/lib/discover/experiences';
import { getRecipe, type ShelfSpec } from '@/app/lib/discover/recipes';

import MetricModel from '@/app/models/Metric';
import { aggregatePlatformTimePerformance } from '@/utils/aggregatePlatformTimePerformance';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Section = { key: string; title: string; items: PostCard[] };
type SectionsResponse =
  | { ok: true; generatedAt: string; sections: Section[]; allowedPersonalized: boolean; capabilities?: { hasReels: boolean; hasDuration: boolean; hasSaved: boolean } }
  | { ok: false; error: string };

type PostCard = {
  id: string;
  coverUrl?: string | null;
  videoUrl?: string;
  mediaType?: string;
  isVideo?: boolean;
  caption?: string;
  postDate?: string;
  creatorName?: string;
  creatorAvatarUrl?: string | null;
  postLink?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    video_duration_seconds?: number;
    saved?: number;
  };
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
  };
};

type ScoreWeights = {
  interactions?: number;
  saved?: number;
  savedRate?: number;
  interactionRate?: number;
  comments?: number;
  shares?: number;
  recency?: number;
};

type ScoreBoosts = {
  contexts?: string[];
  proposals?: string[];
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toProxyUrl(raw?: string | null): string | null | undefined {
  if (!raw) return raw;
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  return raw;
}

const DISABLE_VIDEO_PROXY = ['1', 'true', 'yes'].includes(
  String(process.env.DISABLE_VIDEO_PROXY || '').toLowerCase()
);

function toVideoProxyUrl(raw?: string | null): string | null | undefined {
  if (!raw) return raw;
  if (raw.startsWith('/api/proxy/video/')) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return DISABLE_VIDEO_PROXY ? raw : `/api/proxy/video/${encodeURIComponent(raw)}`;
  }
  return raw;
}

function resolveVideoMeta(rawType?: string | null, rawUrl?: string | null) {
  const mediaType = rawType ? String(rawType).toUpperCase() : undefined;
  const isVideo = mediaType === 'VIDEO' || mediaType === 'REEL';
  const proxyUrl = isVideo ? toVideoProxyUrl(rawUrl) : undefined;
  return {
    mediaType,
    isVideo,
    videoUrl: proxyUrl || undefined,
  };
}

function normalizeFormatKey(raw?: string | null): string | null {
  if (!raw) return null;
  const value = String(raw).toLowerCase();
  if (value.includes('reel')) return 'reel';
  if (value.includes('foto') || value.includes('photo')) return 'photo';
  if (value.includes('carrossel') || value.includes('carousel')) return 'carousel';
  if (value.includes('vídeo longo') || value.includes('video longo') || value.includes('long_video')) return 'long_video';
  return null;
}

function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const entries = Object.entries(weights).filter(([, value]) => typeof value === 'number' && value > 0);
  const total = entries.reduce((acc, [, value]) => acc + (value as number), 0);
  if (total <= 0) return weights;
  const normalized: ScoreWeights = {};
  entries.forEach(([key, value]) => {
    normalized[key as keyof ScoreWeights] = (value as number) / total;
  });
  return normalized;
}

function adjustWeightsForFormat(base: ScoreWeights, formatFilter?: string): ScoreWeights {
  if (!formatFilter) return base;
  const formats = formatFilter
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!formats.length) return base;
  const weights: ScoreWeights = { ...base };
  const bump = (key: keyof ScoreWeights, factor: number) => {
    if (weights[key] != null) weights[key]! *= factor;
  };
  if (formats.some((fmt) => fmt.includes('photo') || fmt.includes('foto') || fmt.includes('carousel') || fmt.includes('carrossel'))) {
    bump('savedRate', 1.25);
    bump('saved', 1.2);
    bump('comments', 1.15);
    bump('shares', 0.9);
  }
  if (formats.some((fmt) => fmt.includes('reel'))) {
    bump('shares', 1.25);
    bump('comments', 1.1);
    bump('savedRate', 0.95);
  }
  if (formats.some((fmt) => fmt.includes('long_video'))) {
    bump('comments', 1.2);
    bump('savedRate', 1.1);
    bump('recency', 0.95);
  }
  return normalizeWeights(weights);
}

function hasMinimumSignals(it: PostCard) {
  const stats = it.stats || {};
  const numeric = (value?: number) => typeof value === 'number' && isFinite(value) && value > 0;
  return Boolean(it.coverUrl) && (
    numeric(stats.total_interactions) ||
    numeric(stats.comments) ||
    numeric(stats.shares) ||
    numeric(stats.views) ||
    numeric((stats as any).saved)
  );
}

function applyDiversityCaps(
  items: PostCard[],
  opts: { maxPerContext?: number; maxPerProposal?: number; maxPerCreator?: number; maxItems: number }
): PostCard[] {
  const picked: PostCard[] = [];
  const contextCounts = new Map<string, number>();
  const proposalCounts = new Map<string, number>();
  const creatorCounts = new Map<string, number>();
  const getKey = (value?: string | null) => (value || '').trim().toLowerCase();

  for (const it of items) {
    const creatorKey = getKey(it.creatorName);
    const contextKey = getKey((it.categories?.context || [])[0]);
    const proposalKey = getKey((it.categories?.proposal || [])[0]);
    if (opts.maxPerCreator && creatorKey) {
      const count = creatorCounts.get(creatorKey) || 0;
      if (count >= opts.maxPerCreator) continue;
    }
    if (opts.maxPerContext && contextKey) {
      const count = contextCounts.get(contextKey) || 0;
      if (count >= opts.maxPerContext) continue;
    }
    if (opts.maxPerProposal && proposalKey) {
      const count = proposalCounts.get(proposalKey) || 0;
      if (count >= opts.maxPerProposal) continue;
    }
    picked.push(it);
    if (creatorKey) creatorCounts.set(creatorKey, (creatorCounts.get(creatorKey) || 0) + 1);
    if (contextKey) contextCounts.set(contextKey, (contextCounts.get(contextKey) || 0) + 1);
    if (proposalKey) proposalCounts.set(proposalKey, (proposalCounts.get(proposalKey) || 0) + 1);
    if (picked.length >= opts.maxItems) break;
  }
  return picked;
}

function applyCreatorCap(items: PostCard[], cap: number, maxItems: number): PostCard[] {
  if (cap <= 0) return items.slice(0, maxItems);
  const picked: PostCard[] = [];
  const counts = new Map<string, number>();
  for (const it of items) {
    const key = (it.creatorName || '').trim().toLowerCase();
    const current = key ? (counts.get(key) || 0) : 0;
    if (key && current >= cap) continue;
    picked.push(it);
    if (key) counts.set(key, current + 1);
    if (picked.length >= maxItems) break;
  }
  return picked;
}

function balanceFormats(items: PostCard[], maxItems: number, minPerFormat = 1): PostCard[] {
  const desired = ['reel', 'photo', 'carousel', 'long_video'];
  const buckets = new Map<string, PostCard[]>();
  for (const key of desired) buckets.set(key, []);
  const rest: PostCard[] = [];
  for (const it of items) {
    const fmtRaw = (it.categories?.format || [])[0];
    const fmtKey = normalizeFormatKey(fmtRaw || null);
    if (fmtKey && buckets.has(fmtKey)) {
      buckets.get(fmtKey)!.push(it);
    } else {
      rest.push(it);
    }
  }
  const result: PostCard[] = [];
  const used = new Set<string>();
  for (const key of desired) {
    const bucket = buckets.get(key) || [];
    let count = 0;
    for (const it of bucket) {
      if (used.has(it.id)) continue;
      result.push(it);
      used.add(it.id);
      count += 1;
      if (count >= minPerFormat || result.length >= maxItems) break;
    }
    if (result.length >= maxItems) break;
  }
  if (result.length < maxItems) {
    for (const it of items) {
      if (used.has(it.id)) continue;
      result.push(it);
      used.add(it.id);
      if (result.length >= maxItems) break;
    }
  }
  return result.slice(0, maxItems);
}

function rankByScore(items: PostCard[], weights: ScoreWeights, boosts?: ScoreBoosts): PostCard[] {
  if (!items.length) return items;
  const nowMs = Date.now();
  const get = (n: number | undefined) => (typeof n === 'number' && isFinite(n) ? n : 0);
  const metrics = items.map((it) => {
    const stats = it.stats || {};
    const interactions = get(stats.total_interactions);
    const comments = get(stats.comments);
    const shares = get(stats.shares);
    const saved = get((stats as any).saved);
    const views = get(stats.views);
    const reach = get((stats as any).reach);
    const impressions = get((stats as any).impressions);
    const savedRate = views > 0 ? saved / views : 0;
    const denom = reach || views || impressions || 0;
    const interactionRate = denom > 0 ? interactions / denom : 0;
    const ageDays = it.postDate ? Math.max(0, (nowMs - new Date(it.postDate).getTime()) / 86_400_000) : 999;
    const recency = Math.exp(-ageDays / 14);
    return { it, interactions, comments, shares, saved, savedRate, interactionRate, recency };
  });
  const max = (key: keyof (typeof metrics)[number]) => Math.max(1e-9, ...metrics.map((m) => (m as any)[key] || 0));
  const mInteractions = max('interactions');
  const mComments = max('comments');
  const mShares = max('shares');
  const mSaved = max('saved');
  const mSavedRate = max('savedRate');
  const mInteractionRate = max('interactionRate');
  const mRecency = max('recency');

  const normBoosts = {
    contexts: (boosts?.contexts || []).map((c) => c.toLowerCase()),
    proposals: (boosts?.proposals || []).map((p) => p.toLowerCase()),
  };

  return metrics
    .map((m) => {
        const w = weights;
        let score =
          (w.interactions || 0) * (m.interactions / mInteractions) +
          (w.comments || 0) * (m.comments / mComments) +
          (w.shares || 0) * (m.shares / mShares) +
          (w.saved || 0) * (m.saved / mSaved) +
          (w.savedRate || 0) * (m.savedRate / mSavedRate) +
          (w.interactionRate || 0) * (m.interactionRate / mInteractionRate) +
          (w.recency || 0) * (m.recency / mRecency);

      if (normBoosts.contexts.length || normBoosts.proposals.length) {
        const ctx = (m.it.categories?.context || []).map((x) => String(x).toLowerCase());
        const prop = (m.it.categories?.proposal || []).map((x) => String(x).toLowerCase());
        const ctxHit = normBoosts.contexts.some((c) => ctx.includes(c));
        const propHit = normBoosts.proposals.some((p) => prop.includes(p));
        const boostFactor = 1 + (ctxHit ? 0.15 : 0) + (propHit ? 0.1 : 0);
        score *= boostFactor;
      }

      return { it: m.it, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.it);
}

function postProcessItems(
  items: PostCard[],
  options: {
    weights: ScoreWeights;
    boosts?: ScoreBoosts;
    balanceFormats?: boolean;
    maxPerCreator?: number;
    maxPerContext?: number;
    maxPerProposal?: number;
    explorationRatio?: number;
    maxItems: number;
  }
): PostCard[] {
  const filtered = items.filter(hasMinimumSignals);
  const weights = normalizeWeights(options.weights);
  const ranked = rankByScore(filtered, weights, options.boosts);
  let combined = ranked;
  if (options.explorationRatio && options.explorationRatio > 0) {
    const exploreCount = Math.max(0, Math.floor(options.maxItems * options.explorationRatio));
    const baseCount = Math.max(1, options.maxItems - exploreCount);
    const base = ranked.slice(0, baseCount);
    const baseIds = new Set(base.map((it) => it.id));
    const remaining = ranked.filter((it) => !baseIds.has(it.id));
    const exploreWeights = normalizeWeights({ recency: 0.7, comments: 0.15, shares: 0.1, savedRate: 0.05 });
    const explore = rankByScore(remaining, exploreWeights).slice(0, exploreCount);
    combined = [...base, ...explore];
  }
  let result = combined;
  if (options.balanceFormats) {
    result = balanceFormats(result, options.maxItems, 1);
  }
  result = applyDiversityCaps(result, {
    maxPerContext: options.maxPerContext,
    maxPerProposal: options.maxPerProposal,
    maxPerCreator: options.maxPerCreator,
    maxItems: options.maxItems,
  });
  if (result.length >= options.maxItems) return result;
  const existing = new Set(result.map((it) => it.id));
  const fill = ranked.filter((it) => !existing.has(it.id));
  const filled = applyDiversityCaps([...result, ...fill], {
    maxPerContext: options.maxPerContext,
    maxPerProposal: options.maxPerProposal,
    maxPerCreator: options.maxPerCreator,
    maxItems: options.maxItems,
  });
  return filled;
}

const SCORE_PROFILES = {
  rising72h: { recency: 0.45, interactionRate: 0.25, comments: 0.15, shares: 0.1, savedRate: 0.05, interactions: 0.03 },
  trending: { comments: 0.2, shares: 0.2, savedRate: 0.25, saved: 0.15, recency: 0.2, interactions: 0.05, interactionRate: 0.15 },
  topSaved: { saved: 0.55, savedRate: 0.25, comments: 0.1, shares: 0.05, recency: 0.15, interactions: 0.03, interactionRate: 0.12 },
  topComments: { comments: 0.6, shares: 0.15, savedRate: 0.1, recency: 0.2, interactions: 0.03, interactionRate: 0.12 },
  topShares: { shares: 0.6, comments: 0.15, savedRate: 0.1, recency: 0.2, interactions: 0.03, interactionRate: 0.12 },
  reelsDuration: { comments: 0.2, shares: 0.2, savedRate: 0.2, saved: 0.1, recency: 0.3, interactions: 0.05, interactionRate: 0.15 },
  weekend: { comments: 0.2, shares: 0.2, savedRate: 0.2, saved: 0.1, recency: 0.3, interactions: 0.05, interactionRate: 0.15 },
  userSuggested: { comments: 0.2, shares: 0.2, savedRate: 0.25, saved: 0.1, recency: 0.25, interactions: 0.05, interactionRate: 0.15 },
  topFormat: { comments: 0.2, shares: 0.2, savedRate: 0.2, saved: 0.1, recency: 0.2, interactions: 0.05, interactionRate: 0.15 },
  collabs: { comments: 0.2, shares: 0.2, savedRate: 0.2, saved: 0.1, recency: 0.3, interactions: 0.05, interactionRate: 0.15 },
  communityNew: { recency: 0.65, comments: 0.15, shares: 0.1, savedRate: 0.1, interactions: 0.03, interactionRate: 0.12 },
};

export async function GET(req: NextRequest): Promise<NextResponse<SectionsResponse>> {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  const userId = session?.user?.id as string | undefined;
  const planStatusRaw = (session as any)?.user?.planStatus;
  const allowedPersonalized = isActiveLike(normalizePlanStatus(planStatusRaw));
  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get('days');
  const limitByDays = Boolean(daysParam && daysParam.toLowerCase() !== 'all');
  const days = limitByDays
    ? clamp(parseInt(daysParam || '60', 10) || 60, 7, 365)
    : null;
  const limitPerRow = clamp(parseInt(searchParams.get('limitPerRow') || '18', 10) || 18, 6, 48);
  const expParam = searchParams.get('exp');
  const exp = expParam || undefined;
  const viewParam = searchParams.get('view');
  const shelfKey = searchParams.get('shelfKey') || undefined;
  // Optional category filters (comma-separated)
  const formatFilter = searchParams.get('format') || undefined;
  const proposalFilter = searchParams.get('proposal') || undefined;
  const contextFilter = searchParams.get('context') || undefined;
  const toneFilter = searchParams.get('tone') || undefined;
  const referencesFilter = searchParams.get('references') || undefined;
  const videoOnly = ['1', 'true', 'yes'].includes((searchParams.get('videoOnly') || '').toLowerCase());

  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = limitByDays ? new Date(endDate) : new Date(1970, 0, 1);
  if (limitByDays && days !== null) {
    startDate.setDate(startDate.getDate() - days);
  }
  const risingWindowMs = 72 * 60 * 60 * 1000;
  const risingEndDate = new Date();
  const risingStartDate = new Date(risingEndDate.getTime() - risingWindowMs);

  await connectToDatabase();

  const sections: Section[] = [];
  const seen = new Set<string>();
  // Permitir duplicados entre prateleiras específicas para garantir exibição
  const allowDuplicateKeys = new Set<string>([
    'user_suggested',
    'top_in_your_format',
    'reels_lt_15',
    'reels_15_45',
    'reels_gt_45',
  ]);
  const shouldBuildShelf = (key: string) => !shelfKey || shelfKey === key;

  const pushSection = (s: Section) => {
    const dedup: PostCard[] = [];
    const allowDupes = allowDuplicateKeys.has(s.key);
    for (const item of s.items) {
      if (!item?.id) continue;
      if (!allowDupes && seen.has(item.id)) continue;
      if (!allowDupes) seen.add(item.id);
      dedup.push(item);
      if (dedup.length >= limitPerRow) break;
    }
    if (dedup.length) sections.push({ ...s, items: dedup });
  };

  const computeCapabilities = (secs: Section[]) => {
    let hasReels = false;
    let hasDuration = false;
    let hasSaved = false;
    for (const s of secs) {
      for (const it of (s.items || [])) {
        const formats = (it.categories?.format || []).map((x) => String(x).toLowerCase());
        if (formats.includes('reel')) hasReels = true;
        if (Number(it?.stats?.video_duration_seconds || 0) > 0) hasDuration = true;
        if (Number((it as any)?.stats?.saved ?? 0) > 0) hasSaved = true;
        if (hasReels && hasDuration && hasSaved) break;
      }
    }
    return { hasReels, hasDuration, hasSaved };
  };

  // --- leve cache (somente quando sem filtros) para seções globais ---
  type CacheBucket = { expires: number; items: PostCard[] };
  const noFilter = !formatFilter && !proposalFilter && !contextFilter && !toneFilter && !referencesFilter && !videoOnly;
  const TTL_MS = clamp(parseInt(process.env.DISCOVER_TTL_MS || '' + (7 * 60 * 1000)) || (7 * 60 * 1000), 60_000, 30 * 60_000);
  if (!(global as any).__discoverCaches) (global as any).__discoverCaches = {} as Record<string, CacheBucket>; // module-level caches (persistem no escopo do módulo enquanto o processo vive)
  const caches = (global as any).__discoverCaches as Record<string, CacheBucket>;
  const mediaTypeFilter = videoOnly ? ['VIDEO', 'REEL'] : undefined;
  const maxItems = limitPerRow * 2;

  try {
    logger.info('[discover/debug] start', {
      userId: userId || null,
      allowedPersonalized,
      params: {
        days: limitByDays ? days : 'all',
        limitPerRow,
        formatFilter,
        proposalFilter,
        contextFilter,
        toneFilter,
        referencesFilter,
        videoOnly,
        exp: exp || null,
        view: viewParam || null,
      },
    });
    let userTopContextIds: string[] = [];
    let userTopProposalIds: string[] = [];
    if (userId) {
      try {
        const [topCtx, topProp] = await Promise.all([
          fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 }),
          fetchTopCategories({ userId, category: 'proposal', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 1 }),
        ]);
        userTopContextIds = (topCtx || []).map((x: any) => String(x.category)).filter(Boolean);
        userTopProposalIds = (topProp || []).map((x: any) => String(x.category)).filter(Boolean);
      } catch {
        userTopContextIds = [];
        userTopProposalIds = [];
      }
    }
    const userBoosts: ScoreBoosts | undefined =
      allowedPersonalized && (userTopContextIds.length || userTopProposalIds.length)
        ? { contexts: userTopContextIds, proposals: userTopProposalIds }
        : undefined;
    // Prepara filtros de experiência (Netflix-like)
    let topContextIdsForExp: string[] | undefined;
    if (exp === 'niche_humor' && userId) {
      try {
        topContextIdsForExp = userTopContextIds.length ? userTopContextIds : undefined;
        if (!topContextIdsForExp) {
          const bestCtx = await fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          topContextIdsForExp = (bestCtx || []).map((x: any) => String(x.category)).filter(Boolean);
        }
      } catch {
        topContextIdsForExp = undefined;
      }
    }
    const expFilters = getExperienceFilters(exp ?? null, { allowedPersonalized, topContextIds: topContextIdsForExp });
    const mergeCsv = (a?: string, b?: string) => {
      const parts = [a, b]
        .filter(Boolean)
        .flatMap((s) => (s as string).split(',').map((x) => x.trim()).filter(Boolean));
      return parts.length ? Array.from(new Set(parts)).join(',') : undefined;
    };

    // Se houver receita (por exp/view), usamos prateleiras específicas e retornamos somente elas
    let topContextIdsForRecipe: string[] | undefined = topContextIdsForExp || (userTopContextIds.length ? userTopContextIds : undefined);
    if (!topContextIdsForRecipe && userId) {
      try {
        const bestCtx = await fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
        topContextIdsForRecipe = (bestCtx || []).map((x: any) => String(x.category)).filter(Boolean);
      } catch {
        /* noop */
      }
    }
    const recipe = getRecipe({ exp, view: viewParam, allowedPersonalized, topContextIds: topContextIdsForRecipe });
    if (recipe && recipe.shelves.length > 0) {
      const tasksRecipe: Array<Promise<void>> = [];
      const shelvesToRun = shelfKey
        ? recipe.shelves.filter((s) => s.key === shelfKey)
        : recipe.shelves;
      if (shelfKey && shelvesToRun.length === 0) {
        const caps = computeCapabilities([]);
        return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), sections: [], allowedPersonalized, capabilities: caps });
      }
      const toCsv = (arr?: string[]) => (arr && arr.length ? arr.join(',') : undefined);
      const runShelf = async (spec: ShelfSpec) => {
        try {
          const fmtCsv = mergeCsv(toCsv(spec.include?.format), formatFilter);
          const propCsv = mergeCsv(toCsv(spec.include?.proposal), proposalFilter);
          const ctxCsv = mergeCsv(toCsv(spec.include?.context), contextFilter);
          const res = await findGlobalPostsByCriteria({
            dateRange: { startDate, endDate },
            sortBy: spec.sortBy || 'stats.total_interactions',
            sortOrder: spec.sortOrder || 'desc',
            page: 1,
            limit: (spec.limitMultiplier ? spec.limitMultiplier : 2) * limitPerRow,
            skipCount: true,
            minInteractions: spec.minInteractions ?? 0,
            onlyOptIn: spec.onlyOptIn ?? true,
            format: fmtCsv,
            proposal: propCsv,
            context: ctxCsv,
            tone: toneFilter,
            references: referencesFilter,
            mediaType: mediaTypeFilter,
          });
          let items: PostCard[] = (res.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
            ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
            caption: p.description || p.text_content || '',
            postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
            creatorName: (p as any).creatorName,
            creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
            postLink: (p as any).postLink,
            stats: {
              total_interactions: p?.stats?.total_interactions,
              likes: p?.stats?.likes,
              comments: p?.stats?.comments,
              shares: p?.stats?.shares,
              views: p?.stats?.views,
              video_duration_seconds: p?.stats?.video_duration_seconds,
              saved: p?.stats?.saved,
            },
            categories: {
              format: Array.isArray(p?.format) ? p.format : undefined,
              proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
              context: Array.isArray(p?.context) ? p.context : undefined,
              tone: Array.isArray(p?.tone) ? p.tone : undefined,
              references: Array.isArray(p?.references) ? p.references : undefined,
            },
          }));
          // Pós-filtros do shelf (weekend/duration/hourRanges)
          if (spec.weekendOnly) {
            items = items.filter((it) => {
              const d = it.postDate ? new Date(it.postDate) : null;
              if (!d) return false;
              const dow = d.getDay();
              return dow === 0 || dow === 6;
            });
          }
          if (spec.duration) {
            const secsOf = (it: PostCard) => Number(it?.stats?.video_duration_seconds || 0);
            if (spec.duration.lt != null) items = items.filter((it) => secsOf(it) > 0 && secsOf(it) < (spec.duration!.lt as number));
            if (spec.duration.between) {
              const [lo, hi] = spec.duration.between;
              items = items.filter((it) => {
                const s = secsOf(it);
                return s >= lo && s <= hi;
              });
            }
            if (spec.duration.gt != null) items = items.filter((it) => secsOf(it) > (spec.duration!.gt as number));
          }
          if (spec.hourRanges && spec.hourRanges.length) {
            const toHour = (iso?: string) => {
              if (!iso) return null;
              const d = new Date(iso);
              if (isNaN(d.getTime())) return null;
              return d.getHours();
            };
            items = items.filter((it) => {
              const h = toHour(it.postDate);
              if (h == null) return false;
              return spec.hourRanges!.some(([start, end]) => {
                if (start <= end) return h >= start && h < end;
                // faixa cruzando meia-noite (ex.: 22-02)
                return h >= start || h < end;
              });
            });
          }

          // Ranking customizado (se weights presentes)
          if (spec.weights) {
            const nowMs = Date.now();
            const get = (n: number | undefined) => (typeof n === 'number' && isFinite(n) ? n : 0);
            const arr = items.map((it) => {
              const s = it.stats || {} as any;
              const saved = get((s as any).saved);
              const denom = get((s as any).reach) || get((s as any).views) || get((s as any).impressions) || 0;
              const savedRate = denom > 0 ? saved / denom : 0;
              const interactions = get((s as any).total_interactions);
              const shares = get((s as any).shares);
              const comments = get((s as any).comments);
              const ageDays = it.postDate ? Math.max(0, (nowMs - new Date(it.postDate).getTime()) / 86_400_000) : 999;
              const recency = Math.exp(-ageDays / 14);
              return { it, metrics: { savedRate, interactions, shares, comments, recency } };
            });
            const max = (k: keyof (typeof arr)[number]['metrics']) => Math.max(1e-9, ...arr.map(x => x.metrics[k]));
            const mSaved = max('savedRate');
            const mInt = max('interactions');
            const mSha = max('shares');
            const mCom = max('comments');
            const mRec = max('recency');
            items = arr
              .map(({ it, metrics }) => {
                const w = spec.weights!;
                const score =
                  (w.savedRate || 0) * (metrics.savedRate / mSaved) +
                  (w.interactions || 0) * (metrics.interactions / mInt) +
                  (w.shares || 0) * (metrics.shares / mSha) +
                  (w.comments || 0) * (metrics.comments / mCom) +
                  (w.recency || 0) * (metrics.recency / mRec);
                return { it, score };
              })
              .sort((a, b) => b.score - a.score)
              .map(x => x.it);
          }

          // Diversidade por criador (cap no topo)
          const cap = typeof spec.maxPerCreatorTop === 'number' ? spec.maxPerCreatorTop : 2;
          if (cap > 0 && items.length > 0) {
            const pick: PostCard[] = [];
            const counts = new Map<string, number>();
            for (const it of items) {
              const key = (it.creatorName || '').toLowerCase();
              const c = counts.get(key) || 0;
              if (c >= cap && pick.length < limitPerRow) continue;
              pick.push(it);
              counts.set(key, c + 1);
              if (pick.length >= limitPerRow * 2) break; // margem antes do pushSection cortar
            }
            if (pick.length >= Math.min(items.length, limitPerRow)) items = pick;
          }
          pushSection({ key: spec.key, title: spec.title, items });
        } catch (err) {
          logger.debug('[discover/recipe_shelf] failed', { shelf: spec.key, err });
        }
      };
      for (const shelf of shelvesToRun) tasksRecipe.push(runShelf(shelf));
      await Promise.allSettled(tasksRecipe);
      // Compute capabilities for chip gating
      const caps = computeCapabilities(sections);
      logger.info('[discover/debug] recipe_return', { keys: sections.map(s => s.key) });
      return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), sections, allowedPersonalized, capabilities: caps });
    }

    const tasks: Array<Promise<void>> = [];

    // Flag: chips incluem Reels?
    const isReelsSelected = (() => {
      const vals = (formatFilter || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      return vals.some(v => v === 'reel' || v === 'reels' || v.includes('reel'));
    })();
    logger.info('[discover/debug] reels_flag', { isReelsSelected, formatFilter });

    // Em alta agora (Trending)
    if (shouldBuildShelf('trending')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          let items: PostCard[] | undefined;
          const cacheKey = 'trending_default';
          if (noFilter && caches[cacheKey] && caches[cacheKey].expires > Date.now()) {
            items = caches[cacheKey].items;
          } else {
            const trending = await findGlobalPostsByCriteria({
              dateRange: { startDate, endDate },
              sortBy: 'stats.total_interactions',
              sortOrder: 'desc',
              page: 1,
              limit: limitPerRow * 2,
              skipCount: true,
              minInteractions: 10,
              onlyOptIn: true,
              format: formatFilter || expFilters.format,
              proposal: proposalFilter || expFilters.proposal,
              context: contextFilter || expFilters.context,
              tone: toneFilter,
              references: referencesFilter,
              mediaType: mediaTypeFilter,
            });
            items = (trending.posts || []).map((p: any) => ({
              id: String(p._id),
              coverUrl: toProxyUrl(p.coverUrl || null),
              ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
              caption: p.description || p.text_content || '',
              postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
              creatorName: p.creatorName,
              creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
              postLink: (p as any).postLink,
              stats: {
                total_interactions: p?.stats?.total_interactions,
                likes: p?.stats?.likes,
                comments: p?.stats?.comments,
                shares: p?.stats?.shares,
                views: p?.stats?.views,
                video_duration_seconds: p?.stats?.video_duration_seconds,
                saved: p?.stats?.saved,
              },
              categories: {
                format: Array.isArray(p?.format) ? p.format : undefined,
                proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
                context: Array.isArray(p?.context) ? p.context : undefined,
                tone: Array.isArray(p?.tone) ? p.tone : undefined,
                references: Array.isArray(p?.references) ? p.references : undefined,
              },
            }));
          if (noFilter) caches[cacheKey] = { expires: Date.now() + TTL_MS, items };
          }
          const processed = postProcessItems(items || [], {
            weights: adjustWeightsForFormat(SCORE_PROFILES.trending, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.15,
            maxItems,
          });
          pushSection({ key: 'trending', title: 'Em alta agora', items: processed });
          logger.info('[discover/trending] ok', { ms: Date.now() - t0, count: items?.length || 0 });
        } catch (e) {
          logger.warn('[discover/trending] failed', e);
        }
      })());
    }

    // Em ascensão (últimas 72h)
    if (shouldBuildShelf('rising_72h')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          let items: PostCard[] | undefined;
          const cacheKey = 'rising_72h_default';
          const effectiveStart = (limitByDays && startDate > risingStartDate) ? startDate : risingStartDate;
          if (noFilter && caches[cacheKey] && caches[cacheKey].expires > Date.now()) {
            items = caches[cacheKey].items;
          } else {
            const rising = await findGlobalPostsByCriteria({
              dateRange: { startDate: effectiveStart, endDate: risingEndDate },
              sortBy: 'stats.total_interactions',
              sortOrder: 'desc',
              page: 1,
              limit: limitPerRow * 3,
              skipCount: true,
              minInteractions: 5,
              onlyOptIn: true,
              format: formatFilter || expFilters.format,
              proposal: proposalFilter || expFilters.proposal,
              context: contextFilter || expFilters.context,
              tone: toneFilter,
              references: referencesFilter,
              mediaType: mediaTypeFilter,
            });
            items = (rising.posts || []).map((p: any) => ({
              id: String(p._id),
              coverUrl: toProxyUrl(p.coverUrl || null),
              ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
              caption: p.description || p.text_content || '',
              postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
              creatorName: p.creatorName,
              creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
              postLink: (p as any).postLink,
              stats: {
                total_interactions: p?.stats?.total_interactions,
                likes: p?.stats?.likes,
                comments: p?.stats?.comments,
                shares: p?.stats?.shares,
                views: p?.stats?.views,
                video_duration_seconds: p?.stats?.video_duration_seconds,
                saved: p?.stats?.saved,
              },
              categories: {
                format: Array.isArray(p?.format) ? p.format : undefined,
                proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
                context: Array.isArray(p?.context) ? p.context : undefined,
                tone: Array.isArray(p?.tone) ? p.tone : undefined,
                references: Array.isArray(p?.references) ? p.references : undefined,
              },
            }));
            if (noFilter) caches[cacheKey] = { expires: Date.now() + TTL_MS, items };
          }
          const processed = postProcessItems(items || [], {
            weights: adjustWeightsForFormat(SCORE_PROFILES.rising72h, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.2,
            maxItems,
          });
          pushSection({ key: 'rising_72h', title: 'Em ascensão (últimas 72h)', items: processed });
          logger.info('[discover/rising_72h] ok', { ms: Date.now() - t0, count: items?.length || 0 });
        } catch (e) {
          logger.warn('[discover/rising_72h] failed', e);
        }
      })());
    }

    // Campeões em salvamentos
    if (shouldBuildShelf('top_saved')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const res = await findGlobalPostsByCriteria({
            dateRange: { startDate, endDate },
            sortBy: 'stats.saved',
            sortOrder: 'desc',
            page: 1,
          limit: limitPerRow * 2,
          skipCount: true,
          onlyOptIn: true,
          format: formatFilter,
          proposal: proposalFilter,
          context: contextFilter,
          tone: toneFilter,
          references: referencesFilter,
          mediaType: mediaTypeFilter,
        });
        let items: PostCard[] = (res.posts || []).map((p: any) => ({
          id: String(p._id),
          coverUrl: toProxyUrl(p.coverUrl || null),
          ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
          caption: p.description || p.text_content || '',
            postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
            creatorName: (p as any).creatorName,
            creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
            postLink: (p as any).postLink,
            stats: {
              total_interactions: p?.stats?.total_interactions,
              likes: p?.stats?.likes,
              comments: p?.stats?.comments,
              shares: p?.stats?.shares,
              views: p?.stats?.views,
              video_duration_seconds: p?.stats?.video_duration_seconds,
              saved: p?.stats?.saved,
            },
            categories: {
              format: Array.isArray(p?.format) ? p.format : undefined,
              proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
              context: Array.isArray(p?.context) ? p.context : undefined,
              tone: Array.isArray(p?.tone) ? p.tone : undefined,
              references: Array.isArray(p?.references) ? p.references : undefined,
            },
          }));
          items = postProcessItems(items, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.topSaved, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.1,
            maxItems,
          });
          pushSection({ key: 'top_saved', title: 'Campeões em salvamentos', items });
          logger.info('[discover/top_saved] ok', { ms: Date.now() - t0, count: items.length });
        } catch (e) {
          logger.warn('[discover/top_saved] failed', e);
        }
      })());
    }

    // Campeões em comentários
    if (shouldBuildShelf('top_comments')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const res = await findGlobalPostsByCriteria({
            dateRange: { startDate, endDate },
            sortBy: 'stats.comments',
            sortOrder: 'desc',
            page: 1,
            limit: limitPerRow * 2,
            skipCount: true,
            onlyOptIn: true,
            format: formatFilter,
            proposal: proposalFilter,
            context: contextFilter,
            tone: toneFilter,
            references: referencesFilter,
            mediaType: mediaTypeFilter,
          });
          let items: PostCard[] = (res.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
            ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
            caption: p.description || p.text_content || '',
            postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
            creatorName: (p as any).creatorName,
            creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
            postLink: (p as any).postLink,
            stats: {
              total_interactions: p?.stats?.total_interactions,
              likes: p?.stats?.likes,
              comments: p?.stats?.comments,
              shares: p?.stats?.shares,
              views: p?.stats?.views,
              video_duration_seconds: p?.stats?.video_duration_seconds,
              saved: p?.stats?.saved,
            },
            categories: {
              format: Array.isArray(p?.format) ? p.format : undefined,
              proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
              context: Array.isArray(p?.context) ? p.context : undefined,
              tone: Array.isArray(p?.tone) ? p.tone : undefined,
              references: Array.isArray(p?.references) ? p.references : undefined,
            },
          }));
          items = postProcessItems(items, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.topComments, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.1,
            maxItems,
          });
          pushSection({ key: 'top_comments', title: 'Campeões em comentários', items });
          logger.info('[discover/top_comments] ok', { ms: Date.now() - t0, count: items.length });
        } catch (e) {
          logger.warn('[discover/top_comments] failed', e);
        }
      })());
    }

    // Campeões em compartilhamentos
    if (shouldBuildShelf('top_shares')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const res = await findGlobalPostsByCriteria({
            dateRange: { startDate, endDate },
            sortBy: 'stats.shares',
            sortOrder: 'desc',
            page: 1,
            limit: limitPerRow * 2,
            skipCount: true,
            onlyOptIn: true,
            format: formatFilter,
            proposal: proposalFilter,
            context: contextFilter,
            tone: toneFilter,
            references: referencesFilter,
            mediaType: mediaTypeFilter,
          });
          let items: PostCard[] = (res.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
            ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
            caption: p.description || p.text_content || '',
            postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
            creatorName: (p as any).creatorName,
            creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
            postLink: (p as any).postLink,
            stats: {
              total_interactions: p?.stats?.total_interactions,
              likes: p?.stats?.likes,
              comments: p?.stats?.comments,
              shares: p?.stats?.shares,
              views: p?.stats?.views,
              video_duration_seconds: p?.stats?.video_duration_seconds,
              saved: p?.stats?.saved,
            },
            categories: {
              format: Array.isArray(p?.format) ? p.format : undefined,
              proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
              context: Array.isArray(p?.context) ? p.context : undefined,
              tone: Array.isArray(p?.tone) ? p.tone : undefined,
              references: Array.isArray(p?.references) ? p.references : undefined,
            },
          }));
          items = postProcessItems(items, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.topShares, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.1,
            maxItems,
          });
          pushSection({ key: 'top_shares', title: 'Campeões em compartilhamentos', items });
          logger.info('[discover/top_shares] ok', { ms: Date.now() - t0, count: items.length });
        } catch (e) {
          logger.warn('[discover/top_shares] failed', e);
        }
      })());
    }

    // Duração: Reels < 15s, 15–45s, > 45s (somente quando Reels estiver selecionado nos chips)
    if (isReelsSelected) {
      const buildDurationRail = async (key: string, title: string, pred: (s: number) => boolean) => {
        try {
          const res = await findGlobalPostsByCriteria({
            dateRange: { startDate, endDate },
            sortBy: 'stats.total_interactions',
            sortOrder: 'desc',
            page: 1,
            limit: limitPerRow * 4, // margem para filtragem por duração
            skipCount: true,
            onlyOptIn: true,
            format: formatFilter || expFilters.format,
            proposal: proposalFilter || expFilters.proposal,
            context: contextFilter || expFilters.context,
            tone: toneFilter,
            references: referencesFilter,
            minInteractions: 0,
            mediaType: mediaTypeFilter,
          });
          let items: PostCard[] = (res.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
            ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
            caption: p.description || p.text_content || '',
            postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
            creatorName: (p as any).creatorName,
            creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
            postLink: (p as any).postLink,
            stats: {
              total_interactions: p?.stats?.total_interactions,
              likes: p?.stats?.likes,
              comments: p?.stats?.comments,
              shares: p?.stats?.shares,
              views: p?.stats?.views,
              video_duration_seconds: p?.stats?.video_duration_seconds,
              saved: p?.stats?.saved,
            },
            categories: {
              format: Array.isArray(p?.format) ? p.format : undefined,
              proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
              context: Array.isArray(p?.context) ? p.context : undefined,
              tone: Array.isArray(p?.tone) ? p.tone : undefined,
              references: Array.isArray(p?.references) ? p.references : undefined,
            },
          }));
          const secs = (it: PostCard) => Number(it?.stats?.video_duration_seconds || 0);
          // Como o chip já filtra o formato, só filtramos por duração e ignoramos outros formatos
          items = items.filter((it) => {
            const s = secs(it);
            return s > 0 && pred(s);
          });
          items = postProcessItems(items, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.reelsDuration, formatFilter),
            balanceFormats: false,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.1,
            maxItems,
          });
          logger.info('[discover/reels_duration] ok', { key, title, count: items.length });
          pushSection({ key, title, items });
        } catch (e) {
          logger.warn('[discover/duration] failed', e);
        }
      };

      if (shouldBuildShelf('reels_lt_15')) {
        tasks.push(buildDurationRail('reels_lt_15', 'Reels até 15s', (s) => s <= 15));
      }
      if (shouldBuildShelf('reels_15_45')) {
        tasks.push(buildDurationRail('reels_15_45', 'Reels de 15 a 45s', (s) => s > 15 && s <= 45));
      }
      if (shouldBuildShelf('reels_gt_45')) {
        tasks.push(buildDurationRail('reels_gt_45', 'Reels acima de 45s', (s) => s > 45));
      }
    }

    // (Removido) Horários quentes — não gerado mais

    // Ideias para o fim de semana (últimos 2 fins de semana)
    if (shouldBuildShelf('weekend_ideas')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const weekendStart = new Date(endDate);
          weekendStart.setDate(weekendStart.getDate() - 16);
          // Se o filtro de dias for mais restritivo (ex: 7 dias), respeitar o startDate global
          const effectiveWeekendStart = (limitByDays && startDate > weekendStart) ? startDate : weekendStart;

          const raw = await findGlobalPostsByCriteria({
            dateRange: { startDate: effectiveWeekendStart, endDate },
            sortBy: 'stats.total_interactions',
            sortOrder: 'desc',
            page: 1,
          limit: limitPerRow * 3,
          skipCount: true,
          minInteractions: 5,
          onlyOptIn: true,
          format: formatFilter || expFilters.format,
          proposal: proposalFilter || expFilters.proposal,
          context: contextFilter || expFilters.context,
          tone: toneFilter,
          references: referencesFilter,
          mediaType: mediaTypeFilter,
        });
        let weekendItems: PostCard[] = (raw.posts || [])
          .filter((p: any) => {
            const d = p?.postDate ? new Date(p.postDate) : null;
            if (!d) return false;
            const dow = d.getDay(); // 0=Dom,6=Sab
            return dow === 0 || dow === 6;
          })
          .map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
            ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
            caption: p.description || p.text_content || '',
              postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
              creatorName: p.creatorName,
              creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
              postLink: (p as any).postLink,
              stats: {
                total_interactions: p?.stats?.total_interactions,
                likes: p?.stats?.likes,
                comments: p?.stats?.comments,
                shares: p?.stats?.shares,
                views: p?.stats?.views,
                video_duration_seconds: p?.stats?.video_duration_seconds,
                saved: p?.stats?.saved,
              },
              categories: {
                format: Array.isArray(p?.format) ? p.format : undefined,
                proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
                context: Array.isArray(p?.context) ? p.context : undefined,
                tone: Array.isArray(p?.tone) ? p.tone : undefined,
              references: Array.isArray(p?.references) ? p.references : undefined,
            },
          }));
          weekendItems = postProcessItems(weekendItems, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.weekend, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.15,
            maxItems,
          });
          pushSection({ key: 'weekend_ideas', title: 'Ideias para o fim de semana', items: weekendItems });
          logger.info('[discover/weekend] ok', { ms: Date.now() - t0, count: weekendItems.length });
        } catch (e) {
          logger.warn('[discover/weekend] failed', e);
        }
      })());
    }

    // (Removido) Para você — desativado conforme solicitação

    // Sugeridos ao usuário (baseado em categorias de melhor performance)
    // Fallback: usa categorias globais se o usuário não tiver histórico suficiente
    if (userId && shouldBuildShelf('user_suggested')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          let topCtx = userTopContextIds.map((category) => ({ category }));
          let topProp = userTopProposalIds.map((category) => ({ category }));
          if (topCtx.length === 0) {
            topCtx = await fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 }) as any;
          }
          if (topProp.length === 0) {
            topProp = await fetchTopCategories({ userId, category: 'proposal', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 1 }) as any;
          }
          logger.info('[discover/user_suggested] cats', { ctx: (topCtx || []).length, prop: (topProp || []).length });
          if ((!topCtx || topCtx.length === 0) && (!topProp || topProp.length === 0)) {
            // Fallback para ranking global
            topCtx = await fetchTopCategories({ category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 }) as any;
            topProp = await fetchTopCategories({ category: 'proposal', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 1 }) as any;
            logger.info('[discover/user_suggested] cats_fallback', { ctx: (topCtx || []).length, prop: (topProp || []).length });
          }
          const cats = [
            ...(contextFilter ? [] : (topCtx || [])),
            ...(proposalFilter ? [] : (topProp || []))
          ].slice(0, 3);
          const pool: PostCard[] = [];
          for (const c of cats) {
            try {
              const isProposal = topProp?.some((p: any) => String(p.category) === String((c as any).category));
              const res = await findGlobalPostsByCriteria({
                dateRange: { startDate, endDate },
                sortBy: 'stats.total_interactions',
                sortOrder: 'desc',
                page: 1,
                limit: limitPerRow * 2,
                skipCount: true,
                onlyOptIn: true,
                // Merge filtros atuais com a categoria destacada do usuário
                format: mergeCsv(formatFilter, expFilters.format),
                context: mergeCsv(isProposal ? contextFilter : [String((c as any).category)].join(','), expFilters.context),
                proposal: mergeCsv(isProposal ? [String((c as any).category)].join(',') : proposalFilter, expFilters.proposal),
                tone: toneFilter,
                references: referencesFilter,
                minInteractions: 5,
                mediaType: mediaTypeFilter,
              });
              for (const p of res.posts || []) {
                pool.push({
                  id: String(p._id),
                  coverUrl: toProxyUrl(p.coverUrl || null),
                  ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
                  caption: p.description || p.text_content || '',
                  postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
                  creatorName: (p as any).creatorName,
                  creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
                  postLink: (p as any).postLink,
                  stats: {
                    total_interactions: p?.stats?.total_interactions,
                    likes: p?.stats?.likes,
                    comments: p?.stats?.comments,
                    shares: p?.stats?.shares,
                    views: p?.stats?.views,
                    video_duration_seconds: p?.stats?.video_duration_seconds,
                    saved: p?.stats?.saved,
                  },
                  categories: {
                    format: Array.isArray(p?.format) ? p.format : undefined,
                    proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
                    context: Array.isArray(p?.context) ? p.context : undefined,
                    tone: Array.isArray(p?.tone) ? p.tone : undefined,
                    references: Array.isArray(p?.references) ? p.references : undefined,
                  },
                });
              }
            } catch (subErr) {
              logger.debug('[discover/user_suggested] category load fail', { err: subErr });
            }
          }
          const processed = postProcessItems(pool, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.userSuggested, formatFilter),
            boosts: userBoosts,
            balanceFormats: false,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.2,
            maxItems,
          });
          pushSection({ key: 'user_suggested', title: 'Sugeridos ao usuário', items: processed });
          logger.info('[discover/user_suggested] ok', { ms: Date.now() - t0, count: processed.length });
        } catch (e) {
          logger.warn('[discover/user_suggested] failed', e);
        }
      })());
    }

    // (removido bloco duplicado de Reels por duração — agora controlado acima)

    // (Removido) Match com seu nicho — desativado conforme solicitação

    // (Removido) Tendências fixas por categoria — não geradas mais

    // Top no seu formato — fallback global quando não houver histórico do usuário
    if (userId && shouldBuildShelf('top_in_your_format')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          let topFormats = await fetchTopCategories({ userId, category: 'format', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          if (!topFormats || topFormats.length === 0) {
            topFormats = await fetchTopCategories({ category: 'format', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          }
          const allowedFormats = formatFilter ? formatFilter.split(',').map(s => s.trim().toLowerCase()) : null;
          const ids = (topFormats || [])
            .map((x: any) => String(x.category))
            .filter(Boolean)
            .filter((fmt: string) => !allowedFormats || allowedFormats.includes(fmt.toLowerCase()));
          const pool: PostCard[] = [];
          for (const fmt of ids) {
            try {
              const byFmt = await findGlobalPostsByCriteria({
                dateRange: { startDate, endDate },
                sortBy: 'stats.total_interactions',
                sortOrder: 'desc',
                page: 1,
                limit: limitPerRow,
                skipCount: true,
                onlyOptIn: true,
                format: mergeCsv([fmt, formatFilter].filter(Boolean).join(',') || fmt, expFilters.format),
                proposal: mergeCsv(proposalFilter, expFilters.proposal),
                context: mergeCsv(contextFilter, expFilters.context),
                tone: toneFilter,
                references: referencesFilter,
                minInteractions: 5,
                mediaType: mediaTypeFilter,
              });
              for (const p of byFmt.posts || []) {
                pool.push({
                  id: String(p._id),
                  coverUrl: toProxyUrl(p.coverUrl || null),
                  ...resolveVideoMeta(p?.type, p?.mediaUrl || p?.media_url || null),
                  caption: p.description || p.text_content || '',
                  postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
                  creatorName: (p as any).creatorName,
                  creatorAvatarUrl: toProxyUrl((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null) || null,
                  postLink: (p as any).postLink,
                  stats: {
                    total_interactions: p?.stats?.total_interactions,
                    likes: p?.stats?.likes,
                    comments: p?.stats?.comments,
                    shares: p?.stats?.shares,
                    views: p?.stats?.views,
                    video_duration_seconds: p?.stats?.video_duration_seconds,
                    saved: p?.stats?.saved,
                  },
                  categories: {
                    format: Array.isArray(p?.format) ? p.format : undefined,
                    proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
                    context: Array.isArray(p?.context) ? p.context : undefined,
                    tone: Array.isArray(p?.tone) ? p.tone : undefined,
                    references: Array.isArray(p?.references) ? p.references : undefined,
                  },
                });
              }
            } catch (sub) {
              logger.debug('[discover/top_format] fmt load fail', { fmt, err: sub });
            }
          }
          const processed = postProcessItems(pool, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.topFormat, formatFilter),
            boosts: userBoosts,
            balanceFormats: false,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.15,
            maxItems,
          });
          pushSection({ key: 'top_in_your_format', title: 'Top no seu formato', items: processed });
          logger.info('[discover/top_format] ok', { ms: Date.now() - t0, count: processed.length });
        } catch (e) {
          logger.warn('[discover/top_format] failed', e);
        }
      })());
    }

    // Colaborações em destaque (collab = true)
    if (shouldBuildShelf('collabs')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const cacheKey = 'collabs_default';
          let items: PostCard[] | undefined;
          if (noFilter && caches[cacheKey] && caches[cacheKey].expires > Date.now()) {
            items = caches[cacheKey].items;
          } else {
            const match: any = { postDate: { $gte: startDate, $lte: endDate }, collab: true };
            const fCsvC = mergeCsv(formatFilter, expFilters.format);
            const pCsvC = mergeCsv(proposalFilter, expFilters.proposal);
            const cCsvC = mergeCsv(contextFilter, expFilters.context);
            if (fCsvC) match.format = { $in: fCsvC.split(',').map(s => s.trim()).filter(Boolean) };
            if (pCsvC) match.proposal = { $in: pCsvC.split(',').map(s => s.trim()).filter(Boolean) };
            if (cCsvC) match.context = { $in: cCsvC.split(',').map(s => s.trim()).filter(Boolean) };
            if (toneFilter) match.tone = { $in: toneFilter.split(',').map(s => s.trim()).filter(Boolean) };
            if (referencesFilter) match.references = { $in: referencesFilter.split(',').map(s => s.trim()).filter(Boolean) };
            if (mediaTypeFilter) match.type = { $in: mediaTypeFilter };
            const rows = await MetricModel.aggregate([
              { $match: match },
              {
                $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'creatorInfo',
                }
              },
              { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
              { $match: { 'creatorInfo.communityInspirationOptIn': true } },
              { $sort: { 'stats.total_interactions': -1 } },
              { $limit: limitPerRow * 2 },
              {
                $project: {
                  description: 1,
                  postDate: 1,
                  coverUrl: 1,
                  postLink: 1,
                  'creatorInfo.username': 1,
                  'creatorInfo.profile_picture_url': 1,
                  'stats.total_interactions': 1,
                  'stats.likes': 1,
                  'stats.comments': 1,
                  'stats.shares': 1,
                  'stats.views': 1,
                  'stats.video_duration_seconds': 1,
                  'stats.saved': 1,
                  type: 1,
                  mediaUrl: { $ifNull: ['$mediaUrl', '$media_url'] },
                  thumbnailUrl: { $ifNull: ['$thumbnailUrl', '$thumbnail_url'] },
                  format: 1,
                  proposal: 1,
                  context: 1,
                  tone: 1,
                  references: 1,
                }
              },
            ]).exec();
            items = rows.map((r: any) => ({
              id: String(r._id),
              coverUrl: toProxyUrl(r.coverUrl || null),
              ...resolveVideoMeta(r?.type, r?.mediaUrl || r?.media_url || null),
              caption: r.description || '',
              postDate: r.postDate ? new Date(r.postDate).toISOString() : undefined,
              creatorName: r?.creatorInfo?.username,
              creatorAvatarUrl: toProxyUrl(r?.creatorInfo?.profile_picture_url || null) || null,
              postLink: r.postLink || undefined,
              stats: {
                total_interactions: r?.stats?.total_interactions,
                likes: r?.stats?.likes,
                comments: r?.stats?.comments,
                shares: r?.stats?.shares,
                views: r?.stats?.views,
                video_duration_seconds: r?.stats?.video_duration_seconds,
                saved: r?.stats?.saved,
              },
              categories: {
                format: Array.isArray(r?.format) ? r.format : undefined,
                proposal: Array.isArray(r?.proposal) ? r.proposal : undefined,
                context: Array.isArray(r?.context) ? r.context : undefined,
                tone: Array.isArray(r?.tone) ? r.tone : undefined,
                references: Array.isArray(r?.references) ? r.references : undefined,
              },
            }));
            if (noFilter) caches[cacheKey] = { expires: Date.now() + TTL_MS, items };
          }
          const processed = postProcessItems(items || [], {
            weights: adjustWeightsForFormat(SCORE_PROFILES.collabs, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.1,
            maxItems,
          });
          pushSection({ key: 'collabs', title: 'Colaborações em destaque', items: processed });
          logger.info('[discover/collabs] ok', { ms: Date.now() - t0, count: items?.length || 0 });
        } catch (e) {
          logger.warn('[discover/collabs] failed', e);
        }
      })());
    }

    // Novidades da comunidade (recentes)
    if (shouldBuildShelf('community_new')) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const match: any = { postDate: { $gte: startDate, $lte: endDate } };
          if (formatFilter) match.format = { $in: formatFilter.split(',').map(s => s.trim()).filter(Boolean) };
          if (proposalFilter) match.proposal = { $in: proposalFilter.split(',').map(s => s.trim()).filter(Boolean) };
          if (contextFilter) match.context = { $in: contextFilter.split(',').map(s => s.trim()).filter(Boolean) };
          if (toneFilter) match.tone = { $in: toneFilter.split(',').map(s => s.trim()).filter(Boolean) };
          if (referencesFilter) match.references = { $in: referencesFilter.split(',').map(s => s.trim()).filter(Boolean) };
          if (mediaTypeFilter) match.type = { $in: mediaTypeFilter };

          const rows = await MetricModel.aggregate([
            { $match: match },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'creatorInfo',
              }
            },
            { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
            { $match: { 'creatorInfo.communityInspirationOptIn': true } },
            { $sort: { postDate: -1 } },
            { $limit: limitPerRow * 2 },
            {
              $project: {
                description: 1,
                postDate: 1,
                coverUrl: 1,
                postLink: 1,
                'creatorInfo.username': 1,
                'creatorInfo.profile_picture_url': 1,
                'stats.total_interactions': 1,
                'stats.likes': 1,
                'stats.comments': 1,
                'stats.shares': 1,
                'stats.views': 1,
                'stats.video_duration_seconds': 1,
                'stats.saved': 1,
                type: 1,
                mediaUrl: { $ifNull: ['$mediaUrl', '$media_url'] },
                thumbnailUrl: { $ifNull: ['$thumbnailUrl', '$thumbnail_url'] },
                format: 1,
                proposal: 1,
                context: 1,
                tone: 1,
                references: 1,
              }
            },
          ]).exec();

          let items: PostCard[] = rows.map((r: any) => ({
            id: String(r._id),
            coverUrl: toProxyUrl(r.coverUrl || null),
            ...resolveVideoMeta(r?.type, r?.mediaUrl || r?.media_url || null),
            caption: r.description || '',
            postDate: r.postDate ? new Date(r.postDate).toISOString() : undefined,
            creatorName: r?.creatorInfo?.username,
            creatorAvatarUrl: toProxyUrl(r?.creatorInfo?.profile_picture_url || null) || null,
            postLink: r.postLink || undefined,
            stats: {
              total_interactions: r?.stats?.total_interactions,
              likes: r?.stats?.likes,
              comments: r?.stats?.comments,
              shares: r?.stats?.shares,
              views: r?.stats?.views,
              video_duration_seconds: r?.stats?.video_duration_seconds,
              saved: r?.stats?.saved,
            },
            categories: {
              format: Array.isArray(r?.format) ? r.format : undefined,
              proposal: Array.isArray(r?.proposal) ? r.proposal : undefined,
              context: Array.isArray(r?.context) ? r.context : undefined,
              tone: Array.isArray(r?.tone) ? r.tone : undefined,
              references: Array.isArray(r?.references) ? r.references : undefined,
            },
          }));
          items = postProcessItems(items, {
            weights: adjustWeightsForFormat(SCORE_PROFILES.communityNew, formatFilter),
            balanceFormats: !formatFilter && !videoOnly,
            maxPerCreator: 2,
            maxPerContext: 2,
            maxPerProposal: 2,
            explorationRatio: 0.25,
            maxItems,
          });
          pushSection({ key: 'community_new', title: 'Novidades da comunidade', items });
          logger.info('[discover/community_new] ok', { ms: Date.now() - t0, count: items.length });
        } catch (e) {
          logger.warn('[discover/community_new] failed', e);
        }
      })());
    }

    await Promise.allSettled(tasks);
    logger.info('[discover/debug] final_sections', { keys: sections.map(s => s.key) });
    const caps = computeCapabilities(sections);
    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), sections, allowedPersonalized, capabilities: caps });
  } catch (err: any) {
    logger.error('[discover/feed] unexpected error', err);
    return NextResponse.json({ ok: false, error: 'Failed to build discover feed' }, { status: 500 });
  }
}
