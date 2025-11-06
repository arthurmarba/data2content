// src/app/dashboard/media-kit/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import MediaKitView from '@/app/mediakit/[token]/MediaKitView';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWhatsapp, FaTimes } from 'react-icons/fa';
import BillingSubscribeModal from '../billing/BillingSubscribeModal';
import WhatsAppConnectInline from '../WhatsAppConnectInline';
import { useHeaderSetup } from '../context/HeaderContext';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { normalizePlanStatus, isPlanActiveLike } from '@/utils/planStatus';
import type { MediaKitPremiumAccessConfig } from '@/types/mediakit';
import { INSTAGRAM_READ_ONLY_COPY, PRO_PLAN_FLEXIBILITY_COPY } from '@/app/constants/trustCopy';
import AdDealForm from '../AdDealForm';
import { useToast } from '@/app/components/ui/ToastA11yProvider';

type Summary = any;
type VideoListItem = any;
type Kpis = any;
type Demographics = any;

type SavedCalculation = {
  estrategico: number;
  justo: number;
  premium: number;
  cpm: number;
  params?: {
    format?: string | null;
    exclusivity?: string | null;
    usageRights?: string | null;
    complexity?: string | null;
  };
  metrics: {
    reach: number;
    engagement: number;
    profileSegment: string;
  };
  avgTicket: number | null;
  totalDeals: number;
  calculationId: string;
  explanation: string | null;
  createdAt: string | null;
};

const FORMAT_LABELS: Record<string, string> = {
  reels: 'Reels',
  post: 'Post no feed',
  stories: 'Stories',
  pacote: 'Pacote multiformato',
};

const EXCLUSIVITY_LABELS: Record<string, string> = {
  nenhuma: 'Sem exclusividade',
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
};

const USAGE_LABELS: Record<string, string> = {
  organico: 'Uso orgânico',
  midiapaga: 'Mídia paga',
  global: 'Uso global/perpétuo',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  simples: 'Produção simples',
  roteiro: 'Com roteiro aprovado',
  profissional: 'Produção profissional',
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatSegmentLabel = (segment?: string | null) => {
  if (!segment) return 'Geral';
  return segment
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

function SelfMediaKitContent({
  userId,
  fallbackName,
  fallbackEmail,
  fallbackImage,
  compactPadding,
  publicUrlForCopy,
  premiumAccess,
}: {
  userId: string; fallbackName?: string | null; fallbackEmail?: string | null; fallbackImage?: string | null;
  compactPadding?: boolean; publicUrlForCopy?: string | null;
  premiumAccess?: MediaKitPremiumAccessConfig;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [engagementTrend, setEngagementTrend] = useState<any | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<any | null>(null);
  const [latestCalculation, setLatestCalculation] = useState<SavedCalculation | null>(null);
  const [latestCalculationLoading, setLatestCalculationLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const safeFetch = async (input: RequestInfo | URL) => {
      try {
        const res = await fetch(input, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
      } catch (err) {
        console.warn('[MediaKit] fetch falhou', input, err);
        return null;
      }
    };

    const loadCoreData = async () => {
      setLoading(true);
      setError(null);

      const [summaryData, videosPayload, kpisData, demographicsData, engagementTrendData, ownerProfileData] = await Promise.all([
        safeFetch(`/api/v1/users/${userId}/highlights/performance-summary`),
        safeFetch(`/api/v1/users/${userId}/videos/list?sortBy=views&limit=5`),
        safeFetch(`/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=last_30d_vs_previous_30d`),
        safeFetch(`/api/demographics/${userId}`),
        safeFetch(`/api/v1/users/${userId}/trends/reach-engagement?timePeriod=last_30_days&granularity=daily`),
        safeFetch(`/api/mediakit/self/user`),
      ]);

      if (cancelled) return;

      const videosList = Array.isArray(videosPayload?.posts) ? videosPayload.posts : [];

      setSummary(summaryData);
      setVideos(
        videosList.map((video: any) => ({
          ...video,
          format: video.format ? [video.format] : [],
          proposal: video.proposal ? [video.proposal] : [],
          context: video.context ? [video.context] : [],
          tone: video.tone ? [video.tone] : [],
          references: video.references ? [video.references] : [],
        }))
      );
      setKpis(kpisData);
      setDemographics(demographicsData);
      setEngagementTrend(engagementTrendData);
      setOwnerProfile(ownerProfileData?.user ?? null);

      if (!summaryData && videosList.length === 0 && !kpisData && !demographicsData && !engagementTrendData) {
        setError('Não foi possível carregar dados recentes do Mídia Kit. Tente novamente em instantes.');
      }

      setLoading(false);
    };

    const loadLatestCalculation = async () => {
      setLatestCalculationLoading(true);
      try {
        const response = await fetch('/api/calculator/latest', { cache: 'no-store' });
        if (cancelled) return;
        if (response.ok) {
          const payload = (await response.json()) as SavedCalculation;
          setLatestCalculation(payload);
        } else if (response.status === 404) {
          setLatestCalculation(null);
        } else {
          console.warn('[MediaKit] Falha ao buscar cálculo mais recente:', response.status);
          setLatestCalculation(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[MediaKit] Erro ao carregar cálculo mais recente', error);
          setLatestCalculation(null);
        }
      } finally {
        if (!cancelled) {
          setLatestCalculationLoading(false);
        }
      }
    };

    loadCoreData();
    loadLatestCalculation();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const user = useMemo(() => {
    const profile = ownerProfile ?? {};
    const picture =
      profile.profile_picture_url ||
      profile?.instagram?.profile_picture_url ||
      fallbackImage ||
      undefined;

    return {
      _id: profile._id || userId,
      name: profile.name ?? fallbackName ?? 'Criador',
      username: profile.username ?? profile.instagramUsername ?? undefined,
      handle: profile.handle ?? undefined,
      email: fallbackEmail ?? profile.email ?? undefined,
      profile_picture_url: picture,
      biography: profile.biography ?? undefined,
      headline: profile.headline ?? undefined,
      mission: profile.mission ?? undefined,
      valueProp: profile.valueProp ?? undefined,
      title: profile.title ?? undefined,
      occupation: profile.occupation ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
      country: profile.country ?? undefined,
      instagramUsername: profile.instagramUsername ?? undefined,
      instagram: profile.instagram ?? undefined,
    } as any;
  }, [ownerProfile, userId, fallbackName, fallbackEmail, fallbackImage]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-200 rounded-lg">
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
              <div className="mt-3 h-24 bg-gray-100 rounded animate-pulse" />
              <div className="mt-3 h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-md w-full border border-yellow-200 bg-yellow-50 text-yellow-900 rounded-lg p-3 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <MediaKitView
      user={user}
      summary={summary}
      videos={videos}
      kpis={kpis}
      demographics={demographics}
      engagementTrend={engagementTrend}
      showSharedBanner={false}
      showOwnerCtas={true}
      compactPadding={compactPadding}
      publicUrlForCopy={publicUrlForCopy || undefined}
      premiumAccess={premiumAccess}
    />
  );
}

export default function MediaKitSelfServePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const fromCalc = sp.get("fromCalc");
  const [calcPrefill, setCalcPrefill] = useState<SavedCalculation | null>(null);
  const [calcPrefillLoading, setCalcPrefillLoading] = useState(false);
  const [latestCalculation, setLatestCalculation] = useState<SavedCalculation | null>(null);
  const [latestCalculationLoading, setLatestCalculationLoading] = useState(true);
  
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const showAdDealToast = useCallback(
    (message: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
      toast({ title: message, variant: type });
    },
    [toast]
  );
  
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const fetchedOnce = useRef(false);

  // Gate: impedir acesso ao Mídia Kit antes de conectar Instagram

  // Lógica do Modal de Pagamento
  const [showBillingModal, setShowBillingModal] = useState(false);
  const closeBillingModal = () => setShowBillingModal(false);
  const communityModalShownRef = useRef(false);
  const showIgConnectSuccess = sp.get("instagramLinked") === "true";
  const processingIgLinkRef = useRef(false);

  const billingStatus = useBillingStatus();
  const sessionPlanStatusRaw = (session?.user as any)?.planStatus;
  const normalizedSessionPlanStatus = useMemo(
    () => normalizePlanStatus(sessionPlanStatusRaw),
    [sessionPlanStatusRaw]
  );
  const effectivePlanStatus = useMemo(() => {
    const normalized = billingStatus.normalizedStatus;
    if (normalized && normalized !== "unknown") return normalized;
    return normalizedSessionPlanStatus;
  }, [billingStatus.normalizedStatus, normalizedSessionPlanStatus]);
  const hasPremiumAccess =
    billingStatus.hasPremiumAccess || isPlanActiveLike(effectivePlanStatus);
  const isGracePeriod = billingStatus.isGracePeriod || effectivePlanStatus === "non_renewing";
  const trialState = billingStatus.trial?.state ?? null;
  const trialExpired = trialState === "expired";
  const canViewCategories = Boolean(billingStatus.hasPremiumAccess);
  const categoriesCtaLabel = trialExpired
    ? "Assinar e continuar de onde parei"
    : "Ver categorias do meu perfil (Ativar trial 48h)";
  const categoriesSubtitle = trialExpired ? PRO_PLAN_FLEXIBILITY_COPY : INSTAGRAM_READ_ONLY_COPY;
  const highlightCtaLabel = trialExpired
    ? "Assinar e continuar de onde parei"
    : "Descobrir o que mais faz meu conteúdo crescer (Ativar trial 48h)";
  const highlightSubtitle = categoriesSubtitle;
  const handleUpgrade = useCallback(() => setShowBillingModal(true), [setShowBillingModal]);
  const premiumAccessConfig = useMemo<MediaKitPremiumAccessConfig>(
    () => ({
      canViewCategories,
      ctaLabel: canViewCategories ? undefined : categoriesCtaLabel,
      subtitle: canViewCategories ? undefined : categoriesSubtitle,
      categoryCtaLabel: canViewCategories ? undefined : categoriesCtaLabel,
      categorySubtitle: canViewCategories ? undefined : categoriesSubtitle,
      highlightCtaLabel: canViewCategories ? undefined : highlightCtaLabel,
      highlightSubtitle: canViewCategories ? undefined : highlightSubtitle,
      onRequestUpgrade: handleUpgrade,
      trialState,
      visibilityMode: 'lock',
    }),
    [canViewCategories, categoriesCtaLabel, categoriesSubtitle, handleUpgrade, highlightCtaLabel, highlightSubtitle, trialState]
  );
  
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  // Lógica e Estado para o Modal do WhatsApp
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const handleWhatsAppLink = useCallback(() => {
    if (!hasPremiumAccess) {
      setShowBillingModal(true);
      return;
    }
    setShowWhatsAppModal(true);
  }, [hasPremiumAccess]);

  useEffect(() => {
    if (calcPrefill) {
      setLatestCalculation(calcPrefill);
      setLatestCalculationLoading(false);
    }
  }, [calcPrefill]);

  useEffect(() => {
    if (!fromCalc) return;
    let cancelled = false;

    const applyCalculation = async () => {
      setCalcPrefillLoading(true);
      try {
        const response = await fetch(`/api/calculator/${fromCalc}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          throw new Error((payload as any)?.error || 'Não foi possível carregar o cálculo.');
        }
        setCalcPrefill(payload as SavedCalculation);
        showAdDealToast('Valores importados da Calculadora.', 'success');
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Falha ao recuperar o cálculo.';
          showAdDealToast(message, 'error');
          setCalcPrefill(null);
        }
      } finally {
        if (cancelled) return;
        setCalcPrefillLoading(false);
        if (typeof window !== 'undefined') {
          const current = new URLSearchParams(sp.toString());
          if (current.has('fromCalc')) {
            current.delete('fromCalc');
            const nextUrl = `${window.location.pathname}${current.toString() ? `?${current.toString()}` : ''}`;
            router.replace(nextUrl, { scroll: false });
          }
        }
      }
    };

    applyCalculation();
    return () => {
      cancelled = true;
    };
  }, [fromCalc, router, showAdDealToast, sp]);

  const adDealInitialData = useMemo<ComponentProps<typeof AdDealForm>['initialData']>(() => {
    if (!calcPrefill) return undefined;
    const compensationValue = Number.isFinite(calcPrefill.justo) ? calcPrefill.justo.toFixed(2) : '0.00';

    const summaryParts: string[] = [];
    if (calcPrefill.params?.format) {
      const format = calcPrefill.params.format ?? '';
      summaryParts.push(`Formato: ${FORMAT_LABELS[format] ?? format}`);
    }
    if (calcPrefill.params?.exclusivity) {
      const exclusivity = calcPrefill.params.exclusivity ?? '';
      summaryParts.push(`Exclusividade: ${EXCLUSIVITY_LABELS[exclusivity] ?? exclusivity}`);
    }
    if (calcPrefill.params?.usageRights) {
      const rights = calcPrefill.params.usageRights ?? '';
      summaryParts.push(`Uso de imagem: ${USAGE_LABELS[rights] ?? rights}`);
    }
    if (calcPrefill.params?.complexity) {
      const complexity = calcPrefill.params.complexity ?? '';
      summaryParts.push(`Complexidade: ${COMPLEXITY_LABELS[complexity] ?? complexity}`);
    }
    const reachValue = calcPrefill.metrics?.reach;
    if (typeof reachValue === 'number' && Number.isFinite(reachValue)) {
      summaryParts.push(`Alcance médio: ${integerFormatter.format(Math.round(reachValue))} pessoas`);
    }
    const engagementValue = calcPrefill.metrics?.engagement;
    if (typeof engagementValue === 'number' && Number.isFinite(engagementValue)) {
      summaryParts.push(`Engajamento médio: ${percentFormatter.format(engagementValue)}%`);
    }
    const avgTicketValue = calcPrefill.avgTicket;
    if (typeof avgTicketValue === 'number' && Number.isFinite(avgTicketValue) && avgTicketValue > 0) {
      summaryParts.push(`Ticket médio recente: ${currencyFormatter.format(avgTicketValue)}`);
    }

    const explanation = calcPrefill.explanation?.trim();
    const notes = [explanation, summaryParts.join(' | ')].filter(Boolean).join('\n');

    return {
      compensationType: 'Valor Fixo' as const,
      compensationValue,
      compensationCurrency: 'BRL',
      notes,
    };
  }, [calcPrefill]);

  const calcPrefillSummary = useMemo(() => {
    if (!calcPrefill) return [] as string[];
    const items: string[] = [];
    if (calcPrefill.params?.format) {
      const format = calcPrefill.params.format ?? '';
      items.push(`Formato: ${FORMAT_LABELS[format] ?? format}`);
    }
    if (calcPrefill.params?.exclusivity) {
      const exclusivity = calcPrefill.params.exclusivity ?? '';
      items.push(`Exclusividade: ${EXCLUSIVITY_LABELS[exclusivity] ?? exclusivity}`);
    }
    if (calcPrefill.params?.usageRights) {
      const rights = calcPrefill.params.usageRights ?? '';
      items.push(`Uso de imagem: ${USAGE_LABELS[rights] ?? rights}`);
    }
    if (calcPrefill.params?.complexity) {
      const complexity = calcPrefill.params.complexity ?? '';
      items.push(`Complexidade: ${COMPLEXITY_LABELS[complexity] ?? complexity}`);
    }
    const reachSummary = calcPrefill.metrics?.reach;
    if (typeof reachSummary === 'number' && Number.isFinite(reachSummary)) {
      items.push(`Alcance médio considerado: ${integerFormatter.format(Math.round(reachSummary))} pessoas`);
    }
    const engagementSummary = calcPrefill.metrics?.engagement;
    if (typeof engagementSummary === 'number' && Number.isFinite(engagementSummary)) {
      items.push(`Engajamento médio: ${percentFormatter.format(engagementSummary)}%`);
    }
    const avgTicketSummary = calcPrefill.avgTicket;
    if (typeof avgTicketSummary === 'number' && Number.isFinite(avgTicketSummary) && avgTicketSummary > 0) {
      items.push(`Ticket médio recente: ${currencyFormatter.format(avgTicketSummary)}`);
    }
    return items;
  }, [calcPrefill]);

  const calcPrefillDateLabel = useMemo(() => {
    if (!calcPrefill?.createdAt) return null;
    const parsed = new Date(calcPrefill.createdAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }, [calcPrefill]);

  useHeaderSetup(
    {
      variant: 'compact',
      showSidebarToggle: true,
      showUserMenu: true,
      sticky: true,
      mobileDocked: false,
      contentTopPadding: 48,
      title: undefined,
      subtitle: undefined,
      extraContent: undefined,
      cta: undefined,
      condensedOnScroll: false,
    },
    []
  );

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

  // Após retorno do OAuth: atualiza sessão e finaliza conexão se houver apenas 1 conta IG
  useEffect(() => {
    const run = async () => {
      if (!showIgConnectSuccess) return;
      if (processingIgLinkRef.current) return;
      processingIgLinkRef.current = true;
      try {
        const updated = await update();
        const u = updated?.user as any;
        if (!u) return;
        if (u.instagramConnected) return; // já conectado

        const accounts = Array.isArray(u.availableIgAccounts) ? u.availableIgAccounts : [];
        if (accounts.length === 1 && accounts[0]?.igAccountId) {
          const res = await fetch('/api/instagram/connect-selected-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instagramAccountId: accounts[0].igAccountId }),
          });
          if (res.ok) {
            await update(); // refletir instagramConnected=true na sessão
          } else {
            const err = await res.json().catch(() => ({}));
            setError(err?.error || 'Falha ao finalizar a conexão do Instagram.');
          }
        } else if (accounts.length > 1) {
          // Redireciona para o Chat, que possui o seletor de contas IG
          router.push('/dashboard/chat?instagramLinked=true');
        }
      } catch (e: any) {
        console.error('Erro ao finalizar conexão do Instagram:', e);
      }
    };
    run();
  }, [showIgConnectSuccess, update, router]);

  useEffect(() => {
    if (showIgConnectSuccess && instagramConnected && !hasPremiumAccess && !communityModalShownRef.current) {
      communityModalShownRef.current = true;
      setShowCommunityModal(true);
    }
  }, [showIgConnectSuccess, instagramConnected, hasPremiumAccess]);

  const handleCorrectInstagramLink = async () => {
    try {
      const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST' });
      if (!response.ok) {
        console.error('Falha ao preparar a vinculação da conta.');
        setError('Falha ao preparar a vinculação com o Facebook. Tente novamente.');
        return;
      }
      signIn('facebook', { callbackUrl: '/media-kit?instagramLinked=true' });
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

  if (status === 'loading') {
    return <div className="p-6">Carregando…</div>;
  }
  if (status === 'unauthenticated') {
    return <div className="p-6"><p className="text-sm text-gray-600">Faça login para visualizar seu Mídia Kit.</p></div>;
  }

  // ===== IG não conectado → redireciona para Onboarding =====
  if (!instagramConnected) {
    return (
      <main className="p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-amber-900">
          <h2 className="text-lg font-semibold">Conecte seu Instagram para ativar o Mídia Kit</h2>
          <p className="mt-2 text-sm">
            Precisamos sincronizar seus dados do Instagram para montar o Mídia Kit automaticamente. Você pode fazer isso em poucos passos.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
                  onClick={() => router.push('/dashboard?intent=instagram')}
              className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Ver primeiros passos
            </button>
            <button
              onClick={handleCorrectInstagramLink}
              className="inline-flex items-center justify-center rounded-md border border-amber-500 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Vincular Instagram agora
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ===== Estado principal (IG conectado) =====
  return (
    <>
      {/* 🔥 Removido DiscoverBillingGate e qualquer CTA de assinatura aqui.
          O CTA vive apenas dentro do MediaKitView para evitar duplicação. */}

      <section className="w-full bg-white pb-10" aria-label="Mídia Kit">
        <SelfMediaKitContent
          userId={(session?.user as any)?.id as string}
          fallbackName={session?.user?.name}
          fallbackEmail={session?.user?.email}
          fallbackImage={session?.user?.image}
          publicUrlForCopy={url}
          compactPadding
          premiumAccess={premiumAccessConfig}
        />
      </section>

      <section className="w-full bg-gray-50 pb-12" aria-label="Registro de publis">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">Registre suas publis</h2>
            <p className="text-sm text-gray-600">
              Centralize os acordos fechados com marcas e acompanhe como os valores evoluem no seu MediaKit.
            </p>
          </div>

          {calcPrefillLoading && (
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-700">
              Aplicando valores sugeridos pela Calculadora...
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Faixa de Preço Sugerida 💰</h3>
            {latestCalculationLoading ? (
              <p className="text-sm text-gray-500">Carregando faixa de preço sugerida…</p>
            ) : latestCalculation ? (
              <div className="space-y-3">
                <p className="text-base text-gray-900">
                  Valor justo sugerido:&nbsp;
                  <strong className="text-pink-600">{currencyFormatter.format(latestCalculation.justo)}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  Baseado em dados do segmento {formatSegmentLabel(latestCalculation.metrics?.profileSegment)}.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/calculator")}
                  className="inline-flex items-center justify-center rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
                >
                  Refazer cálculo
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Nenhum cálculo recente.&nbsp;
                <Link href="/dashboard/calculator" className="font-semibold text-pink-600 hover:underline">
                  Calcular agora
                </Link>
              </p>
            )}
          </div>

          {calcPrefill && !calcPrefillLoading && (
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-4 text-sm text-pink-900 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Valores importados da Calculadora</p>
                {calcPrefillDateLabel && (
                  <span className="text-xs font-medium text-pink-700/80">
                    Calculado em {calcPrefillDateLabel}
                  </span>
                )}
              </div>
              <p>
                Faixa justa sugerida:&nbsp;
                <span className="font-semibold">{currencyFormatter.format(calcPrefill.justo)}</span>
                &nbsp;• Nicho: {formatSegmentLabel(calcPrefill.metrics?.profileSegment)}
              </p>
              {calcPrefillSummary.length > 0 && (
                <ul className="list-disc pl-5 space-y-1">
                  {calcPrefillSummary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {calcPrefill && !calcPrefillLoading ? (
              session?.user?.id ? (
                <AdDealForm
                  userId={(session.user as any).id as string}
                  canAccessFeatures={hasPremiumAccess}
                  onActionRedirect={() => setShowBillingModal(true)}
                  showToast={showAdDealToast}
                  onDealAdded={() => showAdDealToast('Parceria registrada com sucesso!', 'success')}
                  initialData={adDealInitialData}
                />
              ) : (
                <p className="text-sm text-gray-600">Carregando formulário…</p>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Gere um cálculo na&nbsp;
                  <Link href="/dashboard/calculator" className="font-semibold text-pink-600 hover:underline">
                    Calculadora de Publi
                  </Link>{" "}
                  e envie para o Media Kit para registrar uma nova publi.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/calculator")}
                  className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-600 shadow-sm transition hover:border-pink-400 hover:bg-pink-50"
                >
                  Abrir Calculadora de Publi
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <BillingSubscribeModal open={showBillingModal} onClose={closeBillingModal} />

      <AnimatePresence>
        {showCommunityModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCommunityModal(false)}
              className="fixed inset-0 bg-black/50 z-[70]"
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-[80]"
            >
              <div className="mx-auto max-w-lg px-4 pb-6">
                <div className="rounded-2xl bg-white shadow-2xl border border-emerald-100 overflow-hidden">
                  <div className="flex justify-between items-start px-5 pt-5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <FaWhatsapp className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Faça parte da nossa comunidade gratuita
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowCommunityModal(false)}
                      className="p-1 rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Fechar convite da comunidade"
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <div className="px-5 pt-3 pb-5 text-sm text-gray-600 leading-relaxed">
                    Acesse o grupo exclusivo no WhatsApp para receber dicas semanais, materiais de apoio e trocar experiências com outros criadores.
                  </div>
                  <div className="bg-gray-50 px-5 py-5">
                    <a
                      href="https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition-colors"
                      onClick={() => setShowCommunityModal(false)}
                    >
                      Acessar comunidade no WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Vincular com WhatsApp</h3>
                  <button onClick={() => setShowWhatsAppModal(false)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><FaTimes /></button>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  {hasPremiumAccess ? (
                    <WhatsAppConnectInline />
                  ) : (
                    <p className="text-sm text-gray-600">
                      Ative ou renove seu plano para gerar o código de verificação do WhatsApp.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
