// src/app/dashboard/discover/page.tsx
import React from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';
// Grid é a única visualização
import NextDynamic from 'next/dynamic';
const DiscoverViewTracker = NextDynamic(() => import('../../discover/components/DiscoverViewTracker'), { ssr: false });
const DiscoverChips = NextDynamic(() => import('../../discover/components/DiscoverChips'), { ssr: false });
const DiscoverGrid = NextDynamic(() => import('../../discover/components/DiscoverGrid'), { ssr: false });
const DiscoverRails = NextDynamic(() => import('../../discover/components/DiscoverRails'), { ssr: false });
const DiscoverBillingGate = NextDynamic(() => import('./DiscoverBillingGate'), { ssr: false });
const DiscoverHeaderConfigurator = NextDynamic(() => import('./DiscoverHeaderConfigurator'), { ssr: false });

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
type FeedOk = { ok: true; sections: Section[]; allowedPersonalized: boolean; capabilities?: { hasReels?: boolean; hasDuration?: boolean; hasSaved?: boolean } };
type FeedErr = { ok: false; status: number };

function buildBaseUrl() {
  const hdrs = headers();
  const proto = hdrs.get('x-forwarded-proto') || 'http';
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function fetchFeed(qs?: string): Promise<FeedOk | FeedErr> {
  try {
    // Use URL absoluta com cookie forward para preservar sessão no SSR
    const base = process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()
      ? process.env.NEXT_PUBLIC_BASE_URL
      : buildBaseUrl();
    const url = `${base}/api/discover/feed${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        cookie: headers().get('cookie') || '',
      },
    });
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

  // Remover listas específicas solicitadas
  const blockedTitles = new Set<string>([
    'Tendências: Humor e Cena',
    'Tendências: Dicas e Tutoriais',
    'Tendências: Moda e Beleza',
    'Horários quentes',
    'Recomendados para você',
  ]);
  const visibleSections = (sections || []).filter(
    (s) => !blockedTitles.has((s.title || '').trim())
  );

  return (
    <main className="w-full max-w-none pb-10">
      <DiscoverHeaderConfigurator />
      <DiscoverViewTracker />

      <div className="max-w-[800px] lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Teaser de Afiliados removido; agora há uma página dedicada em /dashboard/afiliados */}

        {/* Gate reativo de assinatura/WhatsApp (client-side) */}
        <DiscoverBillingGate />

        {/* Filtros por categoria */}
        {/* Cabeçalho e orientação */}
        <div className="mb-3 space-y-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Descubra novas ideias</h1>
          <p className="text-sm text-slate-600 sm:text-base">
            Este espaço mostra o que outros criadores estão publicando agora. Explore à vontade mesmo sem conectar
            seu Instagram — e libere sugestões personalizadas quando estiver pronto.
          </p>
          {!allowedPersonalized ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-800">Conecte seu Instagram para personalizar a curadoria</p>
                <p className="text-xs text-rose-700">
                  Assim o Mobi ranqueia horários, formatos e concorrentes diretos com base nos seus dados reais.
                </p>
              </div>
              <Link
                href="/dashboard/instagram/connect"
                className="inline-flex items-center justify-center rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Conectar Instagram
              </Link>
            </div>
          ) : null}
        </div>
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filtrar por categoria</p>
          <DiscoverChips />
        </div>

        {/* Conteúdo: modo Experiências sempre com prateleiras (rails) */}
        <section aria-label="Coleções" className="mt-1">
          <DiscoverRails sections={visibleSections} />
          {visibleSections.length === 0 && (
            <p className="text-gray-500 mt-6">Nenhuma coleção encontrada por enquanto.</p>
          )}
        </section>
      </div>
    </main>
  );
}
