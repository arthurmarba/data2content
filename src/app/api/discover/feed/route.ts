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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toProxyUrl(raw?: string | null): string | null | undefined {
  if (!raw) return raw;
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  return raw;
}

export async function GET(req: NextRequest): Promise<NextResponse<SectionsResponse>> {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  const userId = session?.user?.id as string | undefined;
  const planStatusRaw = (session as any)?.user?.planStatus;
  const allowedPersonalized = isActiveLike(normalizePlanStatus(planStatusRaw));
  const { searchParams } = new URL(req.url);
  const days = clamp(parseInt(searchParams.get('days') || '60', 10) || 60, 7, 365);
  const limitPerRow = clamp(parseInt(searchParams.get('limitPerRow') || '12', 10) || 12, 6, 30);
  const expParam = searchParams.get('exp');
  const exp = expParam || undefined;
  const viewParam = searchParams.get('view');
  // Optional category filters (comma-separated)
  const formatFilter = searchParams.get('format') || undefined;
  const proposalFilter = searchParams.get('proposal') || undefined;
  const contextFilter = searchParams.get('context') || undefined;
  const toneFilter = searchParams.get('tone') || undefined;
  const referencesFilter = searchParams.get('references') || undefined;

  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

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
  const noFilter = !formatFilter && !proposalFilter && !contextFilter && !toneFilter && !referencesFilter;
  const TTL_MS = clamp(parseInt(process.env.DISCOVER_TTL_MS || '' + (7 * 60 * 1000)) || (7 * 60 * 1000), 60_000, 30 * 60_000);
  // module-level caches (persistem no escopo do módulo enquanto o processo vive)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!(global as any).__discoverCaches) (global as any).__discoverCaches = {} as Record<string, CacheBucket>;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const caches = (global as any).__discoverCaches as Record<string, CacheBucket>;

  try {
    logger.info('[discover/debug] start', {
      userId: userId || null,
      allowedPersonalized,
      params: {
        days,
        limitPerRow,
        formatFilter,
        proposalFilter,
        contextFilter,
        toneFilter,
        referencesFilter,
        exp: exp || null,
        view: viewParam || null,
      },
    });
    // Prepara filtros de experiência (Netflix-like)
    let topContextIdsForExp: string[] | undefined;
    if (exp === 'niche_humor' && userId) {
      try {
        const bestCtx = await fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
        topContextIdsForExp = (bestCtx || []).map((x: any) => String(x.category)).filter(Boolean);
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
    let topContextIdsForRecipe: string[] | undefined = topContextIdsForExp;
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
            minInteractions: spec.minInteractions ?? 0,
            onlyOptIn: spec.onlyOptIn ?? true,
            format: fmtCsv,
            proposal: propCsv,
            context: ctxCsv,
            tone: toneFilter,
            references: referencesFilter,
          });
          let items: PostCard[] = (res.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
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
      for (const shelf of recipe.shelves) tasksRecipe.push(runShelf(shelf));
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
            minInteractions: 10,
            onlyOptIn: true,
            format: mergeCsv(formatFilter, expFilters.format),
            proposal: mergeCsv(proposalFilter, expFilters.proposal),
            context: mergeCsv(contextFilter, expFilters.context),
            tone: toneFilter,
            references: referencesFilter,
          });
          items = (trending.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
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
        pushSection({ key: 'trending', title: 'Em alta agora', items: items || [] });
        logger.info('[discover/trending] ok', { ms: Date.now() - t0, count: items?.length || 0 });
      } catch (e) {
        logger.warn('[discover/trending] failed', e);
      }
    })());

    // Campeões em salvamentos
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        const res = await findGlobalPostsByCriteria({
          dateRange: { startDate, endDate },
          sortBy: 'stats.saved',
          sortOrder: 'desc',
          page: 1,
          limit: limitPerRow * 2,
          onlyOptIn: true,
          format: formatFilter,
          proposal: proposalFilter,
          context: contextFilter,
          tone: toneFilter,
          references: referencesFilter,
        });
        const items: PostCard[] = (res.posts || []).map((p: any) => ({
          id: String(p._id),
          coverUrl: toProxyUrl(p.coverUrl || null),
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
        pushSection({ key: 'top_saved', title: 'Campeões em salvamentos', items });
        logger.info('[discover/top_saved] ok', { ms: Date.now() - t0, count: items.length });
      } catch (e) {
        logger.warn('[discover/top_saved] failed', e);
      }
    })());

    // Campeões em comentários
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        const res = await findGlobalPostsByCriteria({
          dateRange: { startDate, endDate },
          sortBy: 'stats.comments',
          sortOrder: 'desc',
          page: 1,
          limit: limitPerRow * 2,
          onlyOptIn: true,
          format: formatFilter,
          proposal: proposalFilter,
          context: contextFilter,
          tone: toneFilter,
          references: referencesFilter,
        });
        const items: PostCard[] = (res.posts || []).map((p: any) => ({
          id: String(p._id),
          coverUrl: toProxyUrl(p.coverUrl || null),
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
        pushSection({ key: 'top_comments', title: 'Campeões em comentários', items });
        logger.info('[discover/top_comments] ok', { ms: Date.now() - t0, count: items.length });
      } catch (e) {
        logger.warn('[discover/top_comments] failed', e);
      }
    })());

    // Campeões em compartilhamentos
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        const res = await findGlobalPostsByCriteria({
          dateRange: { startDate, endDate },
          sortBy: 'stats.shares',
          sortOrder: 'desc',
          page: 1,
          limit: limitPerRow * 2,
          onlyOptIn: true,
          format: formatFilter,
          proposal: proposalFilter,
          context: contextFilter,
          tone: toneFilter,
          references: referencesFilter,
        });
        const items: PostCard[] = (res.posts || []).map((p: any) => ({
          id: String(p._id),
          coverUrl: toProxyUrl(p.coverUrl || null),
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
        pushSection({ key: 'top_shares', title: 'Campeões em compartilhamentos', items });
        logger.info('[discover/top_shares] ok', { ms: Date.now() - t0, count: items.length });
      } catch (e) {
        logger.warn('[discover/top_shares] failed', e);
      }
    })());

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
            onlyOptIn: true,
            format: mergeCsv(formatFilter, expFilters.format),
            proposal: mergeCsv(proposalFilter, expFilters.proposal),
            context: mergeCsv(contextFilter, expFilters.context),
            tone: toneFilter,
            references: referencesFilter,
            minInteractions: 0,
          });
          let items: PostCard[] = (res.posts || []).map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
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
          logger.info('[discover/reels_duration] ok', { key, title, count: items.length });
          pushSection({ key, title, items });
        } catch (e) {
          logger.warn('[discover/duration] failed', e);
        }
      };

      tasks.push(buildDurationRail('reels_lt_15', 'Reels até 15s', (s) => s <= 15));
      tasks.push(buildDurationRail('reels_15_45', 'Reels de 15 a 45s', (s) => s > 15 && s <= 45));
      tasks.push(buildDurationRail('reels_gt_45', 'Reels acima de 45s', (s) => s > 45));
    }

    // (Removido) Horários quentes — não gerado mais

    // Ideias para o fim de semana (últimos 2 fins de semana)
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        const weekendStart = new Date(endDate);
        weekendStart.setDate(weekendStart.getDate() - 16);
        const raw = await findGlobalPostsByCriteria({
          dateRange: { startDate: weekendStart, endDate },
          sortBy: 'stats.total_interactions',
          sortOrder: 'desc',
          page: 1,
          limit: limitPerRow * 3,
          minInteractions: 5,
          onlyOptIn: true,
          format: mergeCsv(formatFilter, expFilters.format),
          proposal: mergeCsv(proposalFilter, expFilters.proposal),
          context: mergeCsv(contextFilter, expFilters.context),
          tone: toneFilter,
          references: referencesFilter,
        });
        const weekendItems: PostCard[] = (raw.posts || [])
          .filter((p: any) => {
            const d = p?.postDate ? new Date(p.postDate) : null;
            if (!d) return false;
            const dow = d.getDay(); // 0=Dom,6=Sab
            return dow === 0 || dow === 6;
          })
          .map((p: any) => ({
            id: String(p._id),
            coverUrl: toProxyUrl(p.coverUrl || null),
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
        pushSection({ key: 'weekend_ideas', title: 'Ideias para o fim de semana', items: weekendItems });
        logger.info('[discover/weekend] ok', { ms: Date.now() - t0, count: weekendItems.length });
      } catch (e) {
        logger.warn('[discover/weekend] failed', e);
      }
    })());

    // (Removido) Para você — desativado conforme solicitação

    // Sugeridos ao usuário (baseado em categorias de melhor performance)
    // Fallback: usa categorias globais se o usuário não tiver histórico suficiente
    if (userId) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          let topCtx = await fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          let topProp = await fetchTopCategories({ userId, category: 'proposal', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 1 });
          logger.info('[discover/user_suggested] cats', { ctx: (topCtx || []).length, prop: (topProp || []).length });
          if ((!topCtx || topCtx.length === 0) && (!topProp || topProp.length === 0)) {
            // Fallback para ranking global
            topCtx = await fetchTopCategories({ category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
            topProp = await fetchTopCategories({ category: 'proposal', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 1 });
            logger.info('[discover/user_suggested] cats_fallback', { ctx: (topCtx || []).length, prop: (topProp || []).length });
          }
          const cats = [...(topCtx || []), ...(topProp || [])].slice(0, 3);
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
                onlyOptIn: true,
                // Merge filtros atuais com a categoria destacada do usuário
                format: mergeCsv(formatFilter, expFilters.format),
                context: mergeCsv(isProposal ? contextFilter : [String((c as any).category)].join(','), expFilters.context),
                proposal: mergeCsv(isProposal ? [String((c as any).category)].join(',') : proposalFilter, expFilters.proposal),
                tone: toneFilter,
                references: referencesFilter,
                minInteractions: 5,
              });
              for (const p of res.posts || []) {
                pool.push({
                  id: String(p._id),
                  coverUrl: toProxyUrl(p.coverUrl || null),
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
          pushSection({ key: 'user_suggested', title: 'Sugeridos ao usuário', items: pool });
          logger.info('[discover/user_suggested] ok', { ms: Date.now() - t0, count: pool.length });
        } catch (e) {
          logger.warn('[discover/user_suggested] failed', e);
        }
      })());
    }

    // (removido bloco duplicado de Reels por duração — agora controlado acima)

    // (Removido) Match com seu nicho — desativado conforme solicitação

    // (Removido) Tendências fixas por categoria — não geradas mais

    // Top no seu formato — fallback global quando não houver histórico do usuário
    if (userId) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          let topFormats = await fetchTopCategories({ userId, category: 'format', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          if (!topFormats || topFormats.length === 0) {
            topFormats = await fetchTopCategories({ category: 'format', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          }
          const ids = (topFormats || []).map((x: any) => String(x.category)).filter(Boolean);
          const pool: PostCard[] = [];
          for (const fmt of ids) {
            try {
              const byFmt = await findGlobalPostsByCriteria({
                dateRange: { startDate, endDate },
                sortBy: 'stats.total_interactions',
                sortOrder: 'desc',
                page: 1,
                limit: limitPerRow,
                onlyOptIn: true,
                format: mergeCsv([fmt, formatFilter].filter(Boolean).join(',') || fmt, expFilters.format),
                proposal: mergeCsv(proposalFilter, expFilters.proposal),
                context: mergeCsv(contextFilter, expFilters.context),
                tone: toneFilter,
                references: referencesFilter,
                minInteractions: 5,
              });
              for (const p of byFmt.posts || []) {
                pool.push({
                  id: String(p._id),
                  coverUrl: toProxyUrl(p.coverUrl || null),
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
          pushSection({ key: 'top_in_your_format', title: 'Top no seu formato', items: pool });
          logger.info('[discover/top_format] ok', { ms: Date.now() - t0, count: pool.length });
        } catch (e) {
          logger.warn('[discover/top_format] failed', e);
        }
      })());
    }

    // Colaborações em destaque (collab = true)
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
          { $project: {
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
        pushSection({ key: 'collabs', title: 'Colaborações em destaque', items: items || [] });
        logger.info('[discover/collabs] ok', { ms: Date.now() - t0, count: items?.length || 0 });
      } catch (e) {
        logger.warn('[discover/collabs] failed', e);
      }
    })());

    // Novidades da comunidade (recentes)
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        const match: any = { postDate: { $gte: startDate, $lte: endDate } };
        if (formatFilter) match.format = { $in: formatFilter.split(',').map(s => s.trim()).filter(Boolean) };
        if (proposalFilter) match.proposal = { $in: proposalFilter.split(',').map(s => s.trim()).filter(Boolean) };
        if (contextFilter) match.context = { $in: contextFilter.split(',').map(s => s.trim()).filter(Boolean) };
        if (toneFilter) match.tone = { $in: toneFilter.split(',').map(s => s.trim()).filter(Boolean) };
        if (referencesFilter) match.references = { $in: referencesFilter.split(',').map(s => s.trim()).filter(Boolean) };

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
          { $project: {
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
              format: 1,
              proposal: 1,
              context: 1,
              tone: 1,
              references: 1,
            }
          },
        ]).exec();

        const items: PostCard[] = rows.map((r: any) => ({
          id: String(r._id),
          coverUrl: toProxyUrl(r.coverUrl || null),
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
        pushSection({ key: 'community_new', title: 'Novidades da comunidade', items });
        logger.info('[discover/community_new] ok', { ms: Date.now() - t0, count: items.length });
      } catch (e) {
        logger.warn('[discover/community_new] failed', e);
      }
    })());

    await Promise.allSettled(tasks);
    logger.info('[discover/debug] final_sections', { keys: sections.map(s => s.key) });
    const caps = computeCapabilities(sections);
    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), sections, allowedPersonalized, capabilities: caps });
  } catch (err: any) {
    logger.error('[discover/feed] unexpected error', err);
    return NextResponse.json({ ok: false, error: 'Failed to build discover feed' }, { status: 500 });
  }
}
