// src/app/mediakit/[token]/page.tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { Metadata } from 'next';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import PubliCalculation from '@/app/models/PubliCalculation';
import { logMediaKitAccess } from '@/lib/logMediaKitAccess';
import { getClientIpFromHeaders } from '@/utils/getClientIp';

import MediaKitView from './MediaKitView';

// Tipos centralizados para garantir consistência em todo o fluxo de dados.
import {
  VideoListItem,
  PerformanceSummary,
  KpiComparison,
  DemographicsData,
  MediaKitPremiumAccessConfig,
} from '@/types/mediakit';
import { isPlanActiveLike } from '@/utils/planStatus';

// Força a renderização dinâmica e evita qualquer cache estático
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Helpers para imagem OG/Twitter */
function toProxyUrl(raw?: string | null) {
  if (!raw) return '';
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  }
  return raw;
}

function absoluteUrl(path: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const h = headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto =
    process.env.NEXT_PUBLIC_APP_URL?.startsWith('https')
      ? 'https'
      : (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${proto}://${host}${path.startsWith('/') ? path : '/' + path}`;
}

// Gera metadados dinâmicos para que o link do mídia kit apresente informações
// personalizadas do criador nas prévias de compartilhamento.
export async function generateMetadata(
  { params }: { params: { token: string } }
): Promise<Metadata> {
  await connectToDatabase();

  const user = await UserModel.findOne({ mediaKitSlug: params.token })
    .select('name biography profile_picture_url profileCoverUrl profile_cover_url bannerUrl cover_url ogImage mediaKitCoverUrl')
    .lean();

  if (!user) {
    return {
      title: 'Mídia Kit | Data2Content',
      description: 'Conheça os dados de desempenho dos nossos criadores.',
    };
  }

  const title = `Mídia Kit de ${user.name}`;
  const description = user.biography
    ? String(user.biography).slice(0, 160)
    : `Dados de desempenho e publicações de destaque de ${user.name}.`;
  
  const rawImg =
    (user as any).profileCoverUrl ||
    (user as any).profile_cover_url ||
    (user as any).bannerUrl ||
    (user as any).cover_url ||
    (user as any).ogImage ||
    (user as any).mediaKitCoverUrl ||
    (user as any).profile_picture_url ||
    'https://placehold.co/1200x630/png';

  const ogImage = absoluteUrl(toProxyUrl(rawImg));
  const pageUrl = absoluteUrl(`/mediakit/${params.token}`);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: pageUrl,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: pageUrl },
  };
}

// --- MÓDULO DE BUSCA DE DADOS (DATA FETCHING) ---

/** Busca o resumo de performance (melhores formatos e contextos). */
async function fetchSummary(baseUrl: string, userId: string): Promise<PerformanceSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/highlights/performance-summary`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar summary: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar summary:', error);
    return null;
  }
}

/** Busca os posts de melhor performance (Top 10 por views). */ // ALTERADO
async function fetchTopPosts(baseUrl: string, userId: string): Promise<VideoListItem[]> { // ALTERADO
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/videos/list?sortBy=views&limit=10`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar top posts: ${res.status}`); // ALTERADO
      return [];
    }
    const data = await res.json();
    return data.posts || []; // ALTERADO: AQUI ESTAVA O PROBLEMA
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar top posts:', error); // ALTERADO
    return [];
  }
}

/**
 * Busca os dados de KPI para o período comparativo informado.
 * @param comparisonPeriod Período de comparação desejado (padrão: último 30 dias vs anteriores).
 */
async function fetchKpis(
  baseUrl: string,
  userId: string,
  comparisonPeriod = 'last_30d_vs_previous_30d'
): Promise<KpiComparison | null> {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar kpis: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar kpis:', error);
    return null;
  }
}

/** Busca os dados demográficos do público. */
async function fetchDemographics(baseUrl: string, userId: string): Promise<DemographicsData | null> {
  try {
    const res = await fetch(`${baseUrl}/api/demographics/${userId}`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar demographics: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar demographics:', error);
    return null;
  }
}

async function fetchEngagementTrend(baseUrl: string, userId: string) {
  try {
    const url = `${baseUrl}/api/v1/users/${userId}/trends/reach-engagement?timePeriod=last_30_days&granularity=daily`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar engagement trend: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar engagement trend:', error);
    return null;
  }
}

// --- COMPONENTE DE PÁGINA (SERVER COMPONENT) ---

export default async function MediaKitPage(
  { params }: { params: { token: string } },
  req?: Request,
) {
  await connectToDatabase();

  const user = await UserModel.findOne({ mediaKitSlug: params.token }).lean();
  if (!user) {
    notFound();
  }

  const reqHeaders = headers();
  const ip = getClientIpFromHeaders(reqHeaders, req);
  const referer = reqHeaders.get('referer') || undefined;
  await logMediaKitAccess((user as any)._id.toString(), ip, referer);

  // Determina se o visitante é o dono para controlar o banner institucional
  const session = await getServerSession(authOptions as any);
  const sessionUserId = (session as any)?.user?.id;
  const isOwner = sessionUserId && String(sessionUserId) === String((user as any)._id);

  const proto = reqHeaders.get('x-forwarded-proto') || 'http';
  const host = reqHeaders.get('host') || 'localhost:3000';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  let [summary, videos, kpis, demographics, engagementTrend, latestCalculation] = await Promise.all([
    fetchSummary(baseUrl, (user as any)._id.toString()),
    fetchTopPosts(baseUrl, (user as any)._id.toString()), // ALTERADO
    fetchKpis(baseUrl, (user as any)._id.toString()),
    fetchDemographics(baseUrl, (user as any)._id.toString()),
    fetchEngagementTrend(baseUrl, (user as any)._id.toString()),
    PubliCalculation.findOne({ userId: (user as any)._id }).sort({ createdAt: -1 }).lean().exec(),
  ]);

  const normalizeCategoryField = (value: unknown): string[] => {
    const collected: string[] = [];
    const collect = (entry: unknown) => {
      if (entry == null) return;
      if (Array.isArray(entry)) {
        entry.forEach(collect);
        return;
      }
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) collected.push(trimmed);
        return;
      }
      collected.push(String(entry));
    };
    collect(value);
    return collected;
  };

  let compatibleVideos = (videos || []).map((video: any) => ({
    ...video,
    format: normalizeCategoryField(video.format),
    proposal: normalizeCategoryField(video.proposal),
    context: normalizeCategoryField(video.context),
    tone: normalizeCategoryField(video.tone),
    references: normalizeCategoryField(video.references),
  }));

  const plainUser = JSON.parse(JSON.stringify(user));
  if (
    plainUser &&
    typeof plainUser.followersCount !== 'number' &&
    typeof plainUser.followers_count === 'number'
  ) {
    plainUser.followersCount = plainUser.followers_count;
  }
  const now = Date.now();
  const planStatus = (plainUser?.planStatus ?? null) as any;
  const trialStatus = (plainUser?.proTrialStatus ?? null) as string | null;
  const trialExpiresAtValue = plainUser?.proTrialExpiresAt ? new Date(plainUser.proTrialExpiresAt).getTime() : null;
  const trialActive = trialStatus === 'active' && trialExpiresAtValue !== null && trialExpiresAtValue > now;
  const ownerHasPremiumAccess = isPlanActiveLike(planStatus) || trialActive;

  let premiumAccessConfig: MediaKitPremiumAccessConfig | undefined;

  if (!ownerHasPremiumAccess) {
    summary = null;
    compatibleVideos = compatibleVideos.map((video: any) => ({
      ...video,
      format: [],
      proposal: [],
      context: [],
      tone: [],
      references: [],
    }));
    premiumAccessConfig = {
      canViewCategories: false,
      visibilityMode: 'hide',
    };
  }

  const pricing = latestCalculation
    ? {
      estrategico: typeof latestCalculation?.result?.estrategico === 'number' ? latestCalculation.result.estrategico : 0,
      justo: typeof latestCalculation?.result?.justo === 'number' ? latestCalculation.result.justo : 0,
      premium: typeof latestCalculation?.result?.premium === 'number' ? latestCalculation.result.premium : 0,
      cpm: typeof latestCalculation?.cpmApplied === 'number' ? latestCalculation.cpmApplied : null,
      reach: typeof latestCalculation?.metrics?.reach === 'number' ? latestCalculation.metrics.reach : null,
      engagement: typeof latestCalculation?.metrics?.engagement === 'number' ? latestCalculation.metrics.engagement : null,
      calculationId: latestCalculation?._id?.toString?.() ?? null,
      createdAt: latestCalculation?.createdAt ? new Date(latestCalculation.createdAt).toISOString() : null,
    }
    : null;

  return (
        <MediaKitView
          user={plainUser}
          summary={summary}
          videos={compatibleVideos}
          kpis={kpis}
          demographics={demographics}
          engagementTrend={engagementTrend}
          showOwnerCtas={false}
          mediaKitSlug={params.token}
          premiumAccess={premiumAccessConfig}
          pricing={pricing}
        />
  );
}
