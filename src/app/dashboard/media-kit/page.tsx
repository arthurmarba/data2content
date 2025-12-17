// src/app/dashboard/media-kit/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import MediaKitView from '@/app/mediakit/[token]/MediaKitView';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWhatsapp, FaTimes } from 'react-icons/fa';
import { useHeaderSetup } from '../context/HeaderContext';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { normalizePlanStatus, isPlanActiveLike } from '@/utils/planStatus';
import type {
  MediaKitViewProps,
  MediaKitPricing,
  MediaKitPackage,
  MediaKitPremiumAccessConfig,
} from '@/types/mediakit';
import { notFound } from 'next/navigation';
import { openPaywallModal } from '@/utils/paywallModal';
import { INSTAGRAM_READ_ONLY_COPY, PRO_PLAN_FLEXIBILITY_COPY } from '@/app/constants/trustCopy';

type Summary = any;
type VideoListItem = any;
type Kpis = any;
type Demographics = any;

const skeletonPulse = 'animate-pulse bg-gray-200/70';

const SkeletonLine = ({ className = 'w-full h-3' }: { className?: string }) => (
  <div className={`${skeletonPulse} rounded-full ${className}`} aria-hidden="true" />
);

const MediaKitSkeleton = ({ compactPadding }: { compactPadding?: boolean }) => {
  const containerClass = compactPadding
    ? 'mx-auto w-full max-w-5xl px-4 py-6'
    : 'mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8';
  const sectionsWrapperClass = 'flex flex-col gap-4 sm:gap-3 lg:gap-2';
  const cardClass = 'rounded-3xl border border-[#EAEAEA] bg-white shadow-sm p-5 sm:p-6';

  return (
    <div className="bg-[#FAFAFB] min-h-screen">
      <div
        className={`${containerClass} ${sectionsWrapperClass}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Carregando Mídia Kit"
      >
        <span className="sr-only">Carregando Mídia Kit...</span>

        <div className="px-0 py-6 sm:px-0 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className={`${skeletonPulse} h-28 w-28 rounded-full sm:h-32 sm:w-32`} />
              <div className="w-full space-y-3 text-center sm:text-left">
                <div className="space-y-2">
                  <SkeletonLine className="mx-auto h-6 w-48 sm:mx-0" />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <SkeletonLine className="h-3 w-32" />
                    <SkeletonLine className="h-3 w-24 sm:w-36" />
                  </div>
                </div>
                <SkeletonLine className="h-3 w-full sm:w-2/3" />
                <SkeletonLine className="h-3 w-5/6 sm:w-1/2" />
                <SkeletonLine className="h-3 w-2/3" />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className={`${skeletonPulse} h-10 w-10 rounded-full`} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`hero-metric-${index}`}
                className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm backdrop-blur"
              >
                <SkeletonLine className="h-3 w-24" />
                <SkeletonLine className="mt-3 h-4 w-32" />
                <SkeletonLine className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="space-y-2">
            <SkeletonLine className="h-3 w-40" />
            <SkeletonLine className="h-3 w-full" />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className={`${skeletonPulse} h-10 w-full rounded-full sm:w-40`} />
            <SkeletonLine className="h-3 w-40" />
          </div>
        </div>

        <div className={`${cardClass} bg-gradient-to-br from-[#FDF5FF] via-white to-white`}>
          <SkeletonLine className="h-3 w-52" />
          <SkeletonLine className="mt-2 h-3 w-72" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`cta-${index}`} className="space-y-2 rounded-2xl border border-[#F3E6FF] p-4">
                <SkeletonLine className="h-3 w-32" />
                <SkeletonLine className="h-4 w-24" />
                <div className={`${skeletonPulse} mt-3 h-10 rounded-full`} />
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <SkeletonLine className="h-3 w-48" />
          <SkeletonLine className="mt-2 h-3 w-64" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`highlight-${index}`} className="rounded-2xl border border-gray-100 p-4 shadow-sm">
                <SkeletonLine className="h-3 w-24" />
                <SkeletonLine className="mt-3 h-4 w-32" />
                <SkeletonLine className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <SkeletonLine className="h-3 w-48" />
          <SkeletonLine className="mt-2 h-3 w-56" />
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`kpi-${index}`} className="rounded-2xl border border-gray-100 p-4">
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="mt-3 h-5 w-24" />
                <SkeletonLine className="mt-2 h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <SkeletonLine className="h-3 w-48" />
          <SkeletonLine className="mt-2 h-3 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`video-${index}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                <div className={`${skeletonPulse} h-16 w-20 rounded-2xl`} />
                <div className="flex-1 space-y-2">
                  <SkeletonLine className="h-3 w-3/4" />
                  <SkeletonLine className="h-3 w-1/2" />
                </div>
                <SkeletonLine className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <SkeletonLine className="h-3 w-48" />
          <SkeletonLine className="mt-2 h-3 w-60" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`demo-${index}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <SkeletonLine className="h-3 w-32" />
                    <SkeletonLine className="h-3 w-10" />
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className={`${skeletonPulse} h-2 rounded-full`}
                      style={{ width: `${80 - index * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`pie-${index}`} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${skeletonPulse} h-12 w-12 rounded-full`} />
                    <div className="space-y-2">
                      <SkeletonLine className="h-3 w-24" />
                      <SkeletonLine className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <SkeletonLine className="h-3 w-48" />
          <SkeletonLine className="mt-2 h-3 w-72" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`category-${index}`} className="space-y-2 rounded-2xl border border-gray-100 p-4">
                <SkeletonLine className="h-3 w-32" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((__, tagIdx) => (
                    <div key={`chip-${index}-${tagIdx}`} className={`${skeletonPulse} h-8 w-20 rounded-full`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [pricing, setPricing] = useState<MediaKitPricing | null>(null);
  const [pricingPublished, setPricingPublished] = useState(false);
  const [packages, setPackages] = useState<MediaKitPackage[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);

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

      const [summaryData, videosPayload, kpisData, demographicsData, engagementTrendData, ownerProfileData, pricingData, packagesData] = await Promise.all([
        safeFetch(`/api/v1/users/${userId}/highlights/performance-summary`),
        safeFetch(`/api/v1/users/${userId}/videos/list?sortBy=views&limit=10`),
        safeFetch(`/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=last_30d_vs_previous_30d`),
        safeFetch(`/api/demographics/${userId}`),
        safeFetch(`/api/v1/users/${userId}/trends/reach-engagement?timePeriod=last_30_days&granularity=daily`),
        safeFetch(`/api/mediakit/self/user`),
        safeFetch(`/api/mediakit/self/pricing`),
        safeFetch(`/api/mediakit/self/packages`),
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
      setPricing(pricingData?.pricing ?? null);
      setPricingPublished(Boolean(pricingData?.published));
      setPackages(Array.isArray(packagesData?.packages) ? packagesData.packages : []);

      if (!summaryData && videosList.length === 0 && !kpisData && !demographicsData && !engagementTrendData) {
        setError('Não foi possível carregar dados recentes do Mídia Kit. Tente novamente em instantes.');
      }

      setLoading(false);
    };

    loadCoreData();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const resolvedName =
      (ownerProfile?.mediaKitDisplayName as string | undefined) ??
      (ownerProfile?.name as string | undefined) ??
      (fallbackName as string | undefined) ??
      '';
    setNameInput(resolvedName);
  }, [ownerProfile?.mediaKitDisplayName, ownerProfile?.name, fallbackName]);

  useEffect(() => {
    if (nameError) {
      setNameError(null);
    }
  }, [nameInput, nameError]);

  useEffect(() => {
    if (!showNameModal) {
      setNameError(null);
      setNameSuccess(null);
    }
  }, [showNameModal]);

  const user = useMemo(() => {
    const profile = ownerProfile ?? {};
    const picture =
      profile.profile_picture_url ||
      profile?.instagram?.profile_picture_url ||
      fallbackImage ||
      undefined;
    const followersCount =
      typeof profile.followers_count === 'number'
        ? profile.followers_count
        : typeof profile.followersCount === 'number'
          ? profile.followersCount
          : typeof profile?.instagram?.followers_count === 'number'
            ? profile.instagram.followers_count
            : typeof profile?.instagram?.followersCount === 'number'
              ? profile.instagram.followersCount
              : null;

    return {
      _id: profile._id || userId,
      name: profile.mediaKitDisplayName ?? profile.name ?? fallbackName ?? 'Criador',
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
      followers_count: followersCount ?? undefined,
      followersCount: followersCount ?? undefined,
    } as any;
  }, [ownerProfile, userId, fallbackName, fallbackEmail, fallbackImage]);

  const handleSaveDisplayName = useCallback(
    async (forcedName?: string, opts?: { closeAfter?: boolean }) => {
      const rawValue = typeof forcedName === 'string' ? forcedName : nameInput;
      const normalized = rawValue.replace(/\s+/g, ' ').trim();

      if (normalized && (normalized.length < 2 || normalized.length > 80)) {
        setNameError('Use entre 2 e 80 caracteres.');
        setNameSuccess(null);
        return;
      }

      setSavingName(true);
      setNameError(null);
      setNameSuccess(null);

      try {
        const res = await fetch('/api/mediakit/self/user', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaKitDisplayName: normalized || null }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || 'Não foi possível salvar o nome.');
        }

        const updatedUser = payload?.user ?? null;
        setOwnerProfile((prev: any) => {
          const merged = { ...(prev ?? {}), ...(updatedUser ?? {}) };
          merged.mediaKitDisplayName = updatedUser?.mediaKitDisplayName ?? (normalized ? normalized : null);
          if (!merged.name && (prev?.name || fallbackName)) {
            merged.name = merged.name ?? prev?.name ?? fallbackName ?? null;
          }
          merged.biography = updatedUser?.biography ?? prev?.biography ?? null;
          merged.profile_picture_url = updatedUser?.profile_picture_url ?? prev?.profile_picture_url ?? null;
          return merged;
        });
        setNameInput(normalized);
        setNameSuccess('Nome atualizado no mídia kit.');
        if (opts?.closeAfter) {
          setShowNameModal(false);
        }
      } catch (err: any) {
        setNameError(err?.message || 'Não foi possível salvar o nome.');
      } finally {
        setSavingName(false);
      }
    },
    [fallbackName, nameInput],
  );

  const handleResetDisplayName = useCallback(() => {
    setNameInput('');
    void handleSaveDisplayName('', { closeAfter: true });
  }, [handleSaveDisplayName]);

  if (loading) {
    return <MediaKitSkeleton compactPadding={compactPadding} />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-md w-full border border-yellow-200 bg-yellow-50 text-yellow-900 rounded-lg p-3 text-sm">{error}</div>
      </div>
    );
  }

  const savedDisplayName = (ownerProfile?.mediaKitDisplayName as string | undefined) ?? '';
  const savedDisplayNameNormalized = savedDisplayName.replace(/\s+/g, ' ').trim();
  const normalizedInput = nameInput.replace(/\s+/g, ' ').trim();
  const isNameDirty = normalizedInput !== savedDisplayNameNormalized;
  const googleName = (fallbackName as string | undefined) ?? (ownerProfile?.name as string | undefined) ?? '';
  const effectiveDisplayNamePreview = normalizedInput || savedDisplayName || googleName || 'Criador';
  const canResetToGoogle = Boolean(savedDisplayNameNormalized || normalizedInput);

  const handleClearPricing = async () => {
    if (!window.confirm('Tem certeza que deseja excluir os valores sugeridos do seu Mídia Kit? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const resPricing = await fetch('/api/mediakit/self/pricing', { method: 'DELETE' });

      if (resPricing.ok) {
        setPricing(null);
        setPricingPublished(false);
      } else {
        console.error('Falha ao limpar pricing');
      }
    } catch (e) {
      console.error('Erro ao limpar pricing', e);
    }
  };

  const handleTogglePricingPublish = async (nextPublished: boolean) => {
    try {
      const res = await fetch('/api/mediakit/self/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: nextPublished }),
      });

      if (!res.ok) {
        console.error('Falha ao atualizar publicação do pricing');
        return;
      }

      setPricingPublished(nextPublished);
    } catch (e) {
      console.error('Erro ao atualizar publicação do pricing', e);
    }
  };

  return (
    <>
      <MediaKitView
        user={user}
        summary={summary}
        videos={videos}
        kpis={kpis}
        demographics={demographics}
        engagementTrend={engagementTrend}
        showOwnerCtas={true}
        compactPadding={compactPadding}
        publicUrlForCopy={publicUrlForCopy || undefined}
        premiumAccess={premiumAccess}
        pricing={pricing}
        onClearPricing={handleClearPricing}
        pricingPublished={pricingPublished}
        onTogglePricingPublish={handleTogglePricingPublish}
        packages={packages}
        onEditName={() => setShowNameModal(true)}
      />

      <AnimatePresence>
        {showNameModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-[2px]"
              onClick={() => setShowNameModal(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Nome exibido no mídia kit</p>
                    <p className="text-xs text-slate-500">
                      Mostrado no topo do seu mídia kit. Deixe vazio para usar o nome da sua conta Google
                      {googleName ? ` (${googleName})` : ''}.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNameModal(false)}
                    className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Fechar"
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={googleName || 'Nome da sua conta Google'}
                    maxLength={80}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]/40"
                  />
                  <p className="text-xs text-slate-500">
                    Pré-visualização: <span className="font-semibold text-slate-800">{effectiveDisplayNamePreview}</span>
                  </p>
                </div>

                {nameError && <p className="mt-2 text-xs text-red-600">{nameError}</p>}
                {nameSuccess && <p className="mt-2 text-xs text-emerald-600">{nameSuccess}</p>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleSaveDisplayName(undefined, { closeAfter: true })}
                    disabled={savingName || !isNameDirty}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                      savingName || !isNameDirty
                        ? 'cursor-not-allowed bg-slate-300'
                        : 'bg-[#6E1F93] hover:bg-[#5B167B]'
                    }`}
                  >
                    {savingName ? 'Salvando...' : 'Salvar nome'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDisplayName}
                    disabled={savingName || !canResetToGoogle}
                    className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      savingName || !canResetToGoogle
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Usar nome do Google
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNameModal(false)}
                    className="inline-flex items-center justify-center rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    disabled={savingName}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function MediaKitSelfServePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const fetchedOnce = useRef(false);

  // Gate: impedir acesso ao Mídia Kit antes de conectar Instagram

  // Lógica do Modal de Pagamento
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
  const isGracePeriod = billingStatus.isGracePeriod || effectivePlanStatus === "non_renewing";
  const hasPremiumAccess =
    billingStatus.hasPremiumAccess || isPlanActiveLike(effectivePlanStatus) || isGracePeriod;
  const trialState = billingStatus.trial?.state ?? null;
  const trialExpired = trialState === "expired";
  const canViewCategories = hasPremiumAccess;
  const categoriesCtaLabel = trialExpired
    ? "Assinar e continuar de onde parei"
    : "Ver categorias do meu perfil (Assinar Plano Agência)";
  const categoriesSubtitle = trialExpired ? PRO_PLAN_FLEXIBILITY_COPY : INSTAGRAM_READ_ONLY_COPY;
  const handleUpgrade = useCallback(() => {
    openPaywallModal({ context: 'planning', source: 'media_kit_upgrade' });
  }, []);
  const premiumAccessConfig = useMemo<MediaKitPremiumAccessConfig | undefined>(() => {
    if (hasPremiumAccess) return undefined;
    return {
      canViewCategories: false,
      ctaLabel: categoriesCtaLabel,
      subtitle: categoriesSubtitle,
      categoryCtaLabel: categoriesCtaLabel,
      categorySubtitle: categoriesSubtitle,
      onRequestUpgrade: handleUpgrade,
      trialState,
      visibilityMode: 'lock',
    };
  }, [hasPremiumAccess, categoriesCtaLabel, categoriesSubtitle, handleUpgrade, trialState]);

  const [showCommunityModal, setShowCommunityModal] = useState(false);

  useHeaderSetup(
    {
      variant: 'compact',
      showSidebarToggle: true,
      showUserMenu: true,
      sticky: true,
      mobileDocked: false,
      title: undefined,
      subtitle: undefined,
      extraContent: undefined,
      cta: undefined,
      condensedOnScroll: false,
    },
    []
  );

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

      <section className="w-full bg-white pb-10 px-6 border-t border-l border-slate-200 lg:rounded-tl-3xl" aria-label="Mídia Kit">
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
      <AnimatePresence>
        {showCommunityModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCommunityModal(false)}
              className="fixed inset-0 z-[520] bg-black/45 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-0 z-[530] flex items-center justify-center px-4"
            >
              <div className="mx-auto w-full max-w-lg">
                <div className="rounded-2xl bg-white shadow-2xl border border-emerald-100 overflow-hidden">
                  <div className="flex justify-between items-start px-5 pt-5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <FaWhatsapp className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Entre na Comunidade VIP
                        </h3>
                        <p className="text-xs text-gray-500">Networking, mentorias e alertas exclusivos no WhatsApp.</p>
                      </div>
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
                    Acesse o grupo VIP no WhatsApp para receber materiais avançados, mentorias semanais e troca direta com outros criadores.
                  </div>
                  <div className="bg-gray-50 px-5 py-5">
                    <a
                      href="https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition-colors"
                      onClick={() => setShowCommunityModal(false)}
                    >
                      Acessar Comunidade VIP no WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </>
  );
}
