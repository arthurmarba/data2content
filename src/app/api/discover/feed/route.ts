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

import MetricModel from '@/app/models/Metric';
import { aggregatePlatformTimePerformance } from '@/utils/aggregatePlatformTimePerformance';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Section = { key: string; title: string; items: PostCard[] };
type SectionsResponse =
  | { ok: true; generatedAt: string; sections: Section[]; allowedPersonalized: boolean }
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

  const pushSection = (s: Section) => {
    // dedup por id e corta por limite
    const dedup: PostCard[] = [];
    for (const item of s.items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      dedup.push(item);
      if (dedup.length >= limitPerRow) break;
    }
    if (dedup.length) sections.push({ ...s, items: dedup });
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
    const tasks: Array<Promise<void>> = [];

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
            format: formatFilter,
            proposal: proposalFilter,
            context: contextFilter,
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

    // Horários quentes (combina plataforma + você quando disponível)
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        // Top slots da plataforma (por interações)
        const plat = await aggregatePlatformTimePerformance(days, 'stats.total_interactions', {
          format: formatFilter,
          proposal: proposalFilter,
          context: contextFilter,
        });
        const platSlots = (plat.bestSlots || []).slice(0, 2);

        // Top slots do usuário (se permitido)
        let youSlots: Array<{ dayOfWeek: number; hour: number }> = [];
        if (allowedPersonalized && userId) {
          const you = await aggregateUserTimePerformance(userId, days, 'stats.total_interactions', {
            format: formatFilter,
            proposal: proposalFilter,
            context: contextFilter,
          });
          youSlots = (you.bestSlots || []).slice(0, 1);
        }

        const slots = [...platSlots, ...youSlots];
        if (slots.length === 0) return; // nada a fazer

        const pool: PostCard[] = [];
        for (const s of slots) {
          try {
            const hours = [s.hour, (s.hour + 1) % 24, (s.hour + 2) % 24];
            const match: any = { postDate: { $gte: startDate, $lte: endDate } };
            if (formatFilter) match.format = { $in: formatFilter.split(',').map(v => v.trim()).filter(Boolean) };
            if (proposalFilter) match.proposal = { $in: proposalFilter.split(',').map(v => v.trim()).filter(Boolean) };
            if (contextFilter) match.context = { $in: contextFilter.split(',').map(v => v.trim()).filter(Boolean) };
            if (toneFilter) match.tone = { $in: toneFilter.split(',').map(v => v.trim()).filter(Boolean) };
            if (referencesFilter) match.references = { $in: referencesFilter.split(',').map(v => v.trim()).filter(Boolean) };

            const rows = await MetricModel.aggregate([
              { $match: match },
              {
                $addFields: {
                  dow: { $dayOfWeek: '$postDate' },
                  h: { $hour: '$postDate' },
                }
              },
              { $match: { dow: s.dayOfWeek, h: { $in: hours } } },
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
              { $limit: Math.max(6, Math.min(24, limitPerRow)) },
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
                  format: 1,
                  proposal: 1,
                  context: 1,
                  tone: 1,
                  references: 1,
                }
              },
            ]).exec();

            for (const r of rows) {
              pool.push({
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
                },
                categories: {
                  format: Array.isArray(r?.format) ? r.format : undefined,
                  proposal: Array.isArray(r?.proposal) ? r.proposal : undefined,
                  context: Array.isArray(r?.context) ? r.context : undefined,
                  tone: Array.isArray(r?.tone) ? r.tone : undefined,
                  references: Array.isArray(r?.references) ? r.references : undefined,
                },
              });
            }
          } catch (sub) {
            logger.debug('[discover/best_times] slot fetch fail', { slot: s, err: sub });
          }
        }

        pushSection({ key: 'best_times_hot', title: 'Horários quentes', items: pool });
        logger.info('[discover/best_times] ok', { ms: Date.now() - t0, slots: slots.length, pool: pool.length });
      } catch (e) {
        logger.warn('[discover/best_times] failed', e);
      }
    })());

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
          format: formatFilter,
          proposal: proposalFilter,
          context: contextFilter,
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

    // Para você (slots do planner + comunidade alinhada) — apenas para plano ativo
    if (allowedPersonalized && userId) {
      tasks.push((async () => {
        try {
          const recs = await recommendWeeklySlots({ userId, periodDays: days, targetSlotsPerWeek: 3 });
          const picks = (recs || []).slice(0, 3);
          const bucket: PostCard[] = [];
          for (const r of picks) {
            try {
              const comm = await findCommunityInspirationPosts({
                excludeUserId: userId,
                categories: (formatFilter || proposalFilter || contextFilter) ? {
                  ...(r.categories || {}),
                  ...(proposalFilter ? { proposal: [proposalFilter] } : {}),
                  ...(contextFilter ? { context: [contextFilter] } : {}),
                } : (r.categories || {}),
                periodInDays: days,
                limit: limitPerRow,
              });
              for (const c of comm) {
                bucket.push({
                  id: String(c.id),
                  coverUrl: toProxyUrl(c.coverUrl || null) || null,
                  caption: c.caption,
                  postDate: c.date,
                  creatorName: (c as any).creatorName,
                  creatorAvatarUrl: toProxyUrl((c as any).creatorAvatarUrl || null) || null,
                  postLink: c.postLink || undefined,
                  stats: { views: c.views },
                });
              }
            } catch (sub) {
              logger.debug('[discover/for_you] slot enrichment fail', sub);
            }
          }
          pushSection({ key: 'for_you', title: 'Recomendados para você', items: bucket });
        } catch (e) {
          logger.warn('[discover/for_you] failed', e);
        }
      })());
    }

    // Match com seu nicho — apenas para plano ativo
    if (allowedPersonalized && userId) {
      tasks.push((async () => {
        try {
          const topCtx = await fetchTopCategories({ userId, category: 'context', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
          const topProp = await fetchTopCategories({ userId, category: 'proposal', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 1 });
          const cats = [...(topCtx || []), ...(topProp || [])].slice(0, 3);
          const pool: PostCard[] = [];
          for (const c of cats) {
            try {
              const byCat = await findGlobalPostsByCriteria({
                dateRange: { startDate, endDate },
                sortBy: 'stats.total_interactions',
                sortOrder: 'desc',
                page: 1,
                limit: limitPerRow,
                onlyOptIn: true,
                context: c && (c as any).category && (cats.indexOf(c) < 2 ? (c as any).category : undefined) || contextFilter,
                proposal: c && (cats.indexOf(c) === 2 ? (c as any).category : undefined) || proposalFilter,
                format: formatFilter,
                tone: toneFilter,
                references: referencesFilter,
                minInteractions: 5,
              });
              for (const p of byCat.posts || []) {
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
              logger.debug('[discover/niche] cat load fail', sub);
            }
          }
          pushSection({ key: 'niche_match', title: 'Match com seu nicho', items: pool });
        } catch (e) {
          logger.warn('[discover/niche_match] failed', e);
        }
      })());
    }

    // Tendências por categoria (fixas)
    tasks.push((async () => {
      try {
        const t0 = Date.now();
        const categoryRows: Array<{ key: string; title: string; context?: string; proposal?: string }> = [
          { key: 'trend_fashion_beauty', title: 'Tendências: Moda e Beleza', context: 'fashion_style,beauty_personal_care' },
          { key: 'trend_tips', title: 'Tendências: Dicas e Tutoriais', proposal: 'tips' },
          { key: 'trend_humor', title: 'Tendências: Humor e Cena', proposal: 'humor_scene' },
        ];
        for (const row of categoryRows) {
          try {
            const mergedProposal = [row.proposal, proposalFilter].filter(Boolean).join(',') || undefined;
            const mergedContext = [row.context, contextFilter].filter(Boolean).join(',') || undefined;
            const res = await findGlobalPostsByCriteria({
              dateRange: { startDate, endDate },
              sortBy: 'stats.total_interactions',
              sortOrder: 'desc',
              page: 1,
              limit: limitPerRow * 2,
              onlyOptIn: true,
              format: formatFilter,
              proposal: mergedProposal,
              context: mergedContext,
              tone: toneFilter,
              references: referencesFilter,
              minInteractions: 5,
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
              },
              categories: {
                format: Array.isArray(p?.format) ? p.format : undefined,
                proposal: Array.isArray(p?.proposal) ? p.proposal : undefined,
                context: Array.isArray(p?.context) ? p.context : undefined,
                tone: Array.isArray(p?.tone) ? p.tone : undefined,
                references: Array.isArray(p?.references) ? p.references : undefined,
              },
            }));
            pushSection({ key: row.key, title: row.title, items });
          } catch (sub) {
            logger.debug('[discover/trend_category] row fail', { row: row.key, err: sub });
          }
        }
        logger.info('[discover/trend_category] ok', { ms: Date.now() - t0 });
      } catch (e) {
        logger.warn('[discover/trend_category] failed', e);
      }
    })());

    // Top no seu formato (pessoal)
    if (allowedPersonalized && userId) {
      tasks.push((async () => {
        try {
          const t0 = Date.now();
          const topFormats = await fetchTopCategories({ userId, category: 'format', metric: 'total_interactions', dateRange: { startDate, endDate }, limit: 2 });
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
                format: [fmt, formatFilter].filter(Boolean).join(',') || fmt,
                proposal: proposalFilter,
                context: contextFilter,
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

    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), sections, allowedPersonalized });
  } catch (err: any) {
    logger.error('[discover/feed] unexpected error', err);
    return NextResponse.json({ ok: false, error: 'Failed to build discover feed' }, { status: 500 });
  }
}
