"use client";

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import MediaKitView from '@/app/mediakit/[token]/MediaKitView';

export default function MediaKitSelfServePage() {
  const { data: session, status } = useSession();
  const [slug, setSlug] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const instagramConnected = Boolean(session?.user?.instagramConnected);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (status !== 'authenticated') return;
      try {
        const res = await fetch('/api/users/media-kit-token', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        if (res.ok) {
          setSlug(data.slug ?? null);
          setUrl(data.url ?? null);
          // Redireciona diretamente para o Mídia Kit quando já existir
          if (data.url) {
            try { window.location.href = data.url; } catch {}
          }
        } else {
          setError(data.error || 'Falha ao carregar token do Mídia Kit.');
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Erro inesperado.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [status]);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/users/media-kit-token', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSlug(data.slug);
        setUrl(data.url);
      } else {
        setError(data.error || 'Falha ao gerar link.');
      }
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); } catch {}
  };

  if (status === 'loading') {
    return <div className="p-6">Carregando…</div>;
  }
  if (status === 'unauthenticated') {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Faça login para gerar seu Mídia Kit.</p>
      </div>
    );
  }

  // Caso não conectado, renderizamos a mesma UI do MediaKit público, com dados ausentes e CTA
  if (!instagramConnected) {
    const demoUser = {
      name: 'Criador Exemplo',
      profile_picture_url: '/images/Colorido-Simbolo.png',
      username: 'criador.exemplo',
      biography: 'Este é um Mídia Kit demonstrativo. Conecte seu Instagram para ver seus dados reais.',
      followers_count: 12300,
      _id: undefined, // evita buscas reais de KPI
    };

    const demoKpis = {
      comparisonPeriod: 'last_30d_vs_previous_30d',
      followerGrowth: { currentValue: 320, previousValue: 250, percentageChange: 28.0 },
      engagementRate: { currentValue: 4.2, previousValue: 3.7, percentageChange: 13.5 },
      totalEngagement: { currentValue: 15200, previousValue: 13400, percentageChange: 13.4 },
      postingFrequency: { currentValue: 4.5, previousValue: 3.8, percentageChange: 18.4 },
      avgViewsPerPost: { currentValue: 8200, previousValue: 7600, percentageChange: 7.9 },
      avgLikesPerPost: { currentValue: 1200, previousValue: 1080, percentageChange: 11.1 },
      avgCommentsPerPost: { currentValue: 85, previousValue: 74, percentageChange: 14.9 },
      avgSharesPerPost: { currentValue: 50, previousValue: 44, percentageChange: 13.6 },
      avgSavesPerPost: { currentValue: 110, previousValue: 96, percentageChange: 14.6 },
      avgReachPerPost: { currentValue: 9100, previousValue: 8300, percentageChange: 9.6 },
      insightSummary: {
        followerGrowth: 'Crescimento consistente puxado por Reels educativos à noite.',
        engagementRate: 'Taxa acima da média em carrosséis com checklist e CTA de salvar.',
      },
    } as any;

    const demoVideos = [
      {
        _id: 'demo1',
        caption: 'Reel • Dica de app de produtividade (18s) — Para criadores; gancho em 2s; CTA de salvar',
        permalink: null,
        thumbnailUrl: '/images/Colorido-Simbolo.png',
        // IDs de classificação para exibir chips de estratégia
        format: ['reel'],
        proposal: ['tips'],
        context: ['technology_digital'],
        tone: ['educational'],
        references: ['professions'],
        stats: { views: 12500, likes: 1380, comments: 95, shares: 71, saves: 150 },
      },
      {
        _id: 'demo2',
        caption: 'Carrossel (7 páginas) • Checklist para iniciantes — passo a passo prático',
        permalink: null,
        thumbnailUrl: '/images/Colorido-Simbolo.png',
        format: ['carousel'],
        proposal: ['tips'],
        context: ['education'],
        tone: ['educational'],
        references: [],
        stats: { views: 9800, likes: 910, comments: 60, shares: 40, saves: 210 },
      },
      {
        _id: 'demo3',
        caption: 'Reel • Review crítica de gadget (22s) — referência musical; opinião direta',
        permalink: null,
        thumbnailUrl: '/images/Colorido-Simbolo.png',
        format: ['reel'],
        proposal: ['review'],
        context: ['technology_digital'],
        tone: ['critical'],
        references: ['pop_culture_music'],
        stats: { views: 8600, likes: 740, comments: 48, shares: 33, saves: 95 },
      },
    ];

    const demoDemographics = {
      follower_demographics: {
        gender: { male: 48, female: 52 },
        age: { '18-24': 30, '25-34': 45, '35-44': 15, '45-54': 7, '55-64': 3 },
        city: { 'São Paulo': 40, 'Rio de Janeiro': 25, 'Belo Horizonte': 10, 'Porto Alegre': 5, Lisboa: 5 },
      },
    } as any;

    const demoSummary = {
      topPerformingFormat: { name: 'Reel 18–22s', metricName: 'Retenção', valueFormatted: '68%' },
      topPerformingContext: { name: 'Tecnologia/Digital • Checklist', metricName: 'Salvamentos', valueFormatted: '+18%' },
    } as any;

    return (
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center justify-between">
            <span>Exemplo de Mídia Kit com dados fictícios para demonstração. Conecte seu Instagram para ver seu Mídia Kit real.</span>
            <button
              onClick={() => signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' })}
              className="px-3 py-1.5 rounded-md text-sm bg-pink-600 text-white hover:bg-pink-700"
            >
              Conectar Instagram
            </button>
          </div>
        </div>
        <MediaKitView
          user={demoUser}
          summary={demoSummary}
          videos={demoVideos as any}
          kpis={demoKpis}
          demographics={demoDemographics}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h1 className="text-xl font-semibold text-brand-dark">Mídia Kit</h1>
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="text-sm text-gray-500">Carregando…</div>
      ) : slug && url ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">Seu link público de Mídia Kit está ativo.</p>
          <div className="flex gap-2 items-center">
            <input className="flex-1 text-xs bg-gray-50 border border-gray-300 rounded px-3 py-2" value={url} readOnly />
            <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-md text-xs bg-black text-white">Abrir</a>
            <button onClick={copy} className="px-3 py-2 rounded-md text-xs bg-gray-100 border border-gray-300">Copiar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Gere seu link público para compartilhar com marcas e parceiros.</p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50"
          >
            Gerar Link do Mídia Kit
          </button>
        </div>
      )}
    </div>
  );
}
