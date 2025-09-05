// src/app/dashboard/media-kit/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import MediaKitView from '@/app/mediakit/[token]/MediaKitView';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle, FaShareAlt, FaLink, FaCheck, FaWhatsapp, FaTimes } from 'react-icons/fa';
import BillingSubscribeModal from '../billing/BillingSubscribeModal';
import WhatsAppConnectInline from '../WhatsAppConnectInline';

export default function MediaKitSelfServePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const fetchedOnce = useRef(false);

  // Lógica do Modal de Pagamento
  const [showBillingModal, setShowBillingModal] = useState(false);
  const closeBillingModal = () => setShowBillingModal(false);
  const openedAfterIgRef = useRef(false);
  const showIgConnectSuccess = sp.get("instagramLinked") === "true";

  const planStatus = String((session?.user as any)?.planStatus || "").toLowerCase();
  const isActiveLike = useMemo(
    () => new Set(["active", "trial", "trialing", "non_renewing"]).has(planStatus),
    [planStatus]
  );
  
  // Lógica e Estado para o Modal do WhatsApp
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  
  const handleWhatsAppLink = () => {
    setShowWhatsAppModal(true);
  };

  useEffect(() => {
    const handler = () => setShowBillingModal(true);
    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "");
      router.replace(next, { scroll: false });
    }
  }, [sp, router]);

  useEffect(() => {
    if (showIgConnectSuccess && instagramConnected && !isActiveLike && !openedAfterIgRef.current) {
      openedAfterIgRef.current = true;
      setShowBillingModal(true);
    }
  }, [showIgConnectSuccess, instagramConnected, isActiveLike]);

  // Toolbar sizing
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState<number>(0);
  const TOP_SPACING = 8;
  const BELOW_BAR_GAP = 8;
  const iframeTop = url ? TOP_SPACING + toolbarH + BELOW_BAR_GAP : 0;

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const apply = () => setToolbarH(el.offsetHeight || 0);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
  }, [url]);

  const handleCorrectInstagramLink = async () => {
    try {
      const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST' });
      if (!response.ok) {
        console.error('Falha ao preparar a vinculação da conta.');
        setError('Falha ao preparar a vinculação com o Facebook. Tente novamente.');
        return;
      }
      signIn('facebook', { callbackUrl: '/dashboard/media-kit?instagramLinked=true' });
    } catch (error) {
      console.error('Erro ao iniciar o signIn com o Facebook:', error);
      setError('Ocorreu um erro inesperado ao tentar conectar. Tente novamente.');
    }
  };
  
  useEffect(() => {
    let mounted = true;
    const loadOrCreateLink = async () => {
      if (status !== 'authenticated') return;
      if (!instagramConnected) {
        setLoading(false);
        setUrl(null);
        return;
      }
      if (fetchedOnce.current) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/users/media-kit-token', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        if (res.ok && (data?.url || data?.publicUrl)) {
          setUrl(data?.url ?? data?.publicUrl);
          fetchedOnce.current = true;
        } else {
          const resCreate = await fetch('/api/users/media-kit-token', { method: 'POST' });
          const created = await resCreate.json();
          if (!mounted) return;
          if (!resCreate.ok || !(created?.url || created?.publicUrl)) {
            throw new Error(created?.error || 'Falha ao gerar link do Mídia Kit.');
          }
          setUrl(created?.url ?? created?.publicUrl);
          fetchedOnce.current = true;
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Erro inesperado ao carregar o Mídia Kit.');
        setUrl(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadOrCreateLink();
    return () => { mounted = false; };
  }, [status, instagramConnected]);

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {/* noop */}
  };

  const nativeShare = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Meu Mídia Kit', url });
      } else {
        await copyLink();
      }
    } catch {/* share cancelado */}
  };

  if (status === 'loading') {
    return <div className="p-6">Carregando…</div>;
  }
  if (status === 'unauthenticated') {
    return <div className="p-6"><p className="text-sm text-gray-600">Faça login para visualizar seu Mídia Kit.</p></div>;
  }

  // ===== Estado: IG NÃO conectado → DEMO + CTA =====
  if (!instagramConnected) {
    const demoUser = {
      name: 'Criador Exemplo',
      profile_picture_url: '/images/Colorido-Simbolo.png',
      username: 'criador.exemplo',
      biography: 'Este é um Mídia Kit demonstrativo. Conecte seu Instagram para ver seu Mídia Kit real.',
      followers_count: 12300,
      _id: undefined,
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
              onClick={handleCorrectInstagramLink}
              className="px-3 py-1.5 rounded-md text-sm bg-pink-600 text-white hover:bg-pink-700 flex-shrink-0 ml-4"
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

  // ===== Estado principal (IG conectado) =====
  const safeBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    <>
      <section
        className="relative h-[calc(100svh-var(--header-h,4rem))] w-full bg-white overflow-hidden"
        aria-label="Mídia Kit embutido"
      >
        {url && (
          <div
            ref={toolbarRef}
            className="absolute left-0 right-0 z-20 px-2 sm:px-4"
            style={{ top: TOP_SPACING }}
          >
            <div className="w-full rounded-xl border border-gray-200 bg-white/90 supports-[backdrop-filter]:bg-white/60 backdrop-blur p-2 sm:p-3 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                
                {isActiveLike && (
                  <button
                    onClick={handleWhatsAppLink}
                    className="inline-flex items-center gap-2 rounded-md bg-green-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-green-600 transition-colors"
                  >
                    <FaWhatsapp className="h-3.5 w-3.5" />
                    Vincular WhatsApp
                  </button>
                )}
                
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 font-medium">
                  <FaShareAlt className="h-3.5 w-3.5" />
                  Compartilhar meu Mídia Kit
                </div>
                <div className="flex-1" />
                <div className="flex w-full md:w-auto items-center gap-2">
                  <input
                    value={url}
                    readOnly
                    className="flex-1 md:w-[360px] text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2"
                  />
                  <button
                    onClick={copyLink}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    title="Copiar link"
                  >
                    {copied ? <FaCheck className="h-3.5 w-3.5" /> : <FaLink className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    onClick={nativeShare}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    title="Compartilhar"
                  >
                    <FaShareAlt className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center bg-white z-10"
            >
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
                Carregando Mídia Kit…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="absolute inset-0 grid place-items-center p-4 z-10">
            <div className="max-w-md w-full border border-yellow-200 bg-yellow-50 text-yellow-900 rounded-lg p-3 text-sm flex items-start gap-2">
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível carregar o Mídia Kit</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {url && (
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{ top: iframeTop }}
          >
            <iframe
              key={url}
              src={url}
              className="h-full w-full border-0"
              allow="clipboard-write; fullscreen; accelerometer; gyroscope; encrypted-media"
            />
          </div>
        )}
        <div style={{ height: `calc(${safeBottom})` }} aria-hidden="true" />
      </section>

      <BillingSubscribeModal open={showBillingModal} onClose={closeBillingModal} />

      <AnimatePresence>
        {showWhatsAppModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowWhatsAppModal(false)}
              className="fixed inset-0 bg-black/50 z-50"
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 bg-gray-50 p-4 pt-5 rounded-t-2xl shadow-2xl z-[60] border-t"
              style={{ paddingBottom: `calc(${safeBottom} + 20px)` }}
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Vincular com WhatsApp</h3>
                  <button onClick={() => setShowWhatsAppModal(false)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><FaTimes /></button>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <WhatsAppConnectInline />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
