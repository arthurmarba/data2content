// src/app/dashboard/discover/page.tsx
import React from 'react';
import { headers } from 'next/headers';
// Grid é a única visualização
import NextDynamic from 'next/dynamic';
const SubscribeCtaBanner = NextDynamic(() => import('@/app/mediakit/components/SubscribeCtaBanner'), { ssr: false });
const DiscoverViewTracker = NextDynamic(() => import('../../discover/components/DiscoverViewTracker'), { ssr: false });
const DiscoverChips = NextDynamic(() => import('../../discover/components/DiscoverChips'), { ssr: false });
const DiscoverGrid = NextDynamic(() => import('../../discover/components/DiscoverGrid'), { ssr: false });

export const dynamic = 'force-dynamic';

type PostCard = {
  id: string;
  coverUrl?: string | null;
  caption?: string;
  postDate?: string;
  creatorName?: string;
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

type Section = { key: string; title: string; items: PostCard[] };
type FeedOk = { ok: true; sections: Section[]; allowedPersonalized: boolean };
type FeedErr = { ok: false; status: number };

function buildBaseUrl() {
  const hdrs = headers();
  const proto = hdrs.get('x-forwarded-proto') || 'http';
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function fetchFeed(qs?: string): Promise<FeedOk | FeedErr> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()
      ? process.env.NEXT_PUBLIC_BASE_URL
      : buildBaseUrl();
    const url = `${base}/api/discover/feed${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false as const, status: res.status } as FeedErr;
    const data = await res.json();
    if (!data?.ok) return { ok: false as const, status: 500 } as FeedErr;
    return { ok: true as const, sections: (data.sections || []) as Section[], allowedPersonalized: Boolean(data.allowedPersonalized) } as FeedOk;
  } catch {
    return { ok: false as const, status: 500 } as FeedErr;
  }
}

export default async function DiscoverDashboardPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  const keys = ['format','proposal','context','tone','references'] as const;
  for (const k of keys) {
    const v = searchParams?.[k];
    if (!v) continue;
    if (Array.isArray(v)) params.set(k, v.join(','));
    else params.set(k, String(v));
  }
  const tab = ((searchParams?.tab as string) || 'trending').toLowerCase();
  const qs = params.toString();

  const result = await fetchFeed(qs).catch(() => ({ ok: false as const, status: 500 } as FeedErr));

  if (!result.ok) {
    const status = result.status;
    let title = 'Não foi possível carregar o feed de descoberta.';
    let hint: React.ReactNode = null;
    if (status === 401) {
      title = 'Faça login para ver a Comunidade.';
      hint = (<a href="/login" className="underline text-brand-pink">Entrar</a>);
    } else if (status === 403) {
      title = 'Ative seu plano para acessar a Comunidade.';
      hint = (<a href="/dashboard/billing" className="underline text-brand-pink">Gerir Assinatura</a>);
    }
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Comunidade</h1>
        <p className="mt-2 text-gray-600">{title} {hint}</p>
      </main>
    );
  }

  const { sections, allowedPersonalized } = result as FeedOk;
  const selected = sections.find(s => s.key === tab) || sections.find(s => s.key === 'trending') || { key: 'trending', title: 'Virais', items: [] };

  return (
    <main className="w-full max-w-none pt-2 sm:pt-3 lg:pt-4 pb-10">
      <DiscoverViewTracker />

      <div className="max-w-[800px] lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Teaser de Afiliados removido; agora há uma página dedicada em /dashboard/afiliados */}

        {/* Banner para plano inativo (gating suave) */}
        {allowedPersonalized === false && (
          <div className="mb-4">
            <SubscribeCtaBanner
              title="Ative seu plano para recomendações personalizadas"
              description="Desbloqueie o feed 'Para você', 'Match com seu nicho' e sugestões no Planner."
              primaryLabel="Ativar plano"
              secondaryLabel="Ver planos"
              isSubscribed={false}
            />
          </div>
        )}

        {/* Chips de seleção e filtros */}
        <div className="mb-3">
          <DiscoverChips allowedPersonalized={allowedPersonalized} />
        </div>

        {/* Conteúdo em grid */}
        <section aria-label="Conteúdo" className="mt-1">
          <DiscoverGrid items={selected.items} />
          {selected.items.length === 0 && (
            <p className="text-gray-500 mt-6">Nenhum conteúdo encontrado por enquanto.</p>
          )}
        </section>
      </div>
    </main>
  );
}
