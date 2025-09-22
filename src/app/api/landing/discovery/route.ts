import { NextRequest, NextResponse } from 'next/server';
import { findGlobalPostsByCriteria } from '@/app/lib/dataService/marketAnalysisService';
import { getCategoryById } from '@/app/lib/classification';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';

type LandingCategory = {
  id: string;
  label: string;
  items: Array<{
    id: string;
    title: string;
    imageUrl: string | null | undefined;
    href?: string | null;
    creator?: string | null;
    creatorAvatarUrl?: string | null;
    stats?: {
      total_interactions?: number;
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      video_duration_seconds?: number;
    };
    categories?: {
      format?: string[];
      proposal?: string[];
      context?: string[];
      tone?: string[];
      references?: string[];
    };
  }>;
};

const DEFAULT_CONTEXTS = [
  'beauty_personal_care',
  'fashion_style',
  'fitness_sports',
  'food_culinary',
  'technology_digital',
  'travel_tourism',
];

// Cache leve em memória (válido apenas enquanto o processo vive)
type CacheBucket = { expires: number; payload: any };
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!(global as any).__landingDiscoveryCache) (global as any).__landingDiscoveryCache = {} as Record<string, CacheBucket>;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const cacheStore = (global as any).__landingDiscoveryCache as Record<string, CacheBucket>;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const perCat = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || '15')));
  const ttlMs = Math.max(60_000, Math.min(15 * 60_000, Number(process.env.LANDING_DISCOVERY_TTL_MS || '300000')));
  const cacheKey = `viral:v2:limit=${perCat}`;

  const now = Date.now();
  const hit = cacheStore[cacheKey];
  if (hit && hit.expires > now) {
    return NextResponse.json(hit.payload);
  }

  // Helpers locais
  const originFrom = (req: NextRequest): string => {
    try {
      const u = new URL(req.url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return '';
    }
  };

  async function filterAvailableCovers(origin: string, items: Array<{ id: string; title: string; href?: string | null; creator?: string | null }>, per: number) {
    // Checa disponibilidade via HEAD /api/media/cover/:id com timeout curto
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const approved: typeof items = [];
      for (const it of items) {
        try {
          const res = await fetch(`${origin}/api/media/cover/${it.id}`, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
          });
          if (res.ok) approved.push(it);
          if (approved.length >= per) break;
        } catch {
          // ignora e segue
        }
      }
      return approved.slice(0, per);
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    const origin = originFrom(req);

    // Viral feed global (sem filtros), últimos 60 dias
    const nowDate = new Date();
    const startDate = new Date(nowDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const fetchLimit = Math.max(perCat * 4, perCat + 4);

    const { posts } = await findGlobalPostsByCriteria({
      dateRange: { startDate, endDate: nowDate },
      sortBy: 'stats.total_interactions',
      sortOrder: 'desc',
      limit: fetchLimit,
      page: 1,
      onlyOptIn: true,
      minInteractions: 10,
    });

    // helper p/ proxificar avatar
    const toProxy = (raw?: string | null) => {
      if (!raw) return null;
      if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
      if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
      return raw;
    };

    const rawItems = posts.map((p: any) => ({
      id: String(p._id ?? ''),
      title: p.description || p.creatorName || 'Post',
      href: p.postLink,
      creator: p.creatorName ?? null,
      creatorAvatarUrl: toProxy((p as any).creatorAvatarUrl || (p as any).creator_avatar_url || null),
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

    // Não filtra por disponibilidade para não reduzir a lista — usamos fallback visual no cliente
    let items = rawItems
      .slice(0, perCat)
      .map(r => ({ ...r, imageUrl: `/api/media/cover/${r.id}` }));

    // Se ainda houver menos que perCat (caso raro), completa com exemplos estáticos
    if (items.length < perCat) {
      const needed = perCat - items.length;
      const fillers = [
        { id: `static-a`, title: 'Tutorial prático', imageUrl: '/images/Tutorial.png', href: null, creator: null },
        { id: `static-b`, title: 'Portfolio de exemplo', imageUrl: '/images/portfolio_exemplo.png', href: null, creator: null },
        { id: `static-c`, title: 'Make em 5 minutos', imageUrl: '/images/mulher_se_maquiando.png', href: null, creator: null },
        { id: `static-d`, title: 'Bastidores', imageUrl: '/images/IMG_8633.PNG', href: null, creator: null },
      ].slice(0, needed) as any;
      items = [...items, ...fillers];
    }

    const categories: LandingCategory[] = [
      { id: 'viral', label: 'Viral', items },
    ];

    const payload = { categories };
    cacheStore[cacheKey] = { expires: now + ttlMs, payload };
    return NextResponse.json(payload);
  } catch (error: any) {
    logger.error('[api/landing/discovery] Failed to build viral feed:', error);
    return NextResponse.json({ error: 'failed_to_build_discovery' }, { status: 500 });
  }
}
