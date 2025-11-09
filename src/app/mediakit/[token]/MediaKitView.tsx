// src/app/mediakit/[token]/MediaKitView.tsx
'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback, useId } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  CalendarDays,
  Users,
  MapPin,
  Heart,
  Eye,
  MessageSquare,
  Share2,
  Bookmark,
  Calendar,
  Mail,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Lock,
  Send,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/app/components/UserAvatar';
import AverageMetricRow from '@/app/dashboard/components/AverageMetricRow';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';
import { MediaKitViewProps, VideoListItem } from '@/types/mediakit';
import { useGlobalTimePeriod, GlobalTimePeriodProvider } from '@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext';
import { getCategoryById, commaSeparatedIdsToLabels } from '@/app/lib/classification';
import SubscribeCtaBanner from '@/app/mediakit/components/SubscribeCtaBanner';
import { useSession } from 'next-auth/react';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { isPlanActiveLike } from '@/utils/planStatus';
import { track } from '@/lib/track';
import { PRO_PLAN_FLEXIBILITY_COPY } from '@/app/constants/trustCopy';
import { useUtmAttribution } from '@/hooks/useUtmAttribution';
import type { UtmContext } from '@/lib/analytics/utm';

/**
 * UTILS & CONSTANTS
 */

// Extrai bio de vários caminhos comuns
function extractIgBio(obj: any): string | null {
  if (!obj) return null;
  const tryPaths = [
    'biography', 'bio',
    'instagram.biography', 'instagram.bio',
    'ig.biography', 'ig.bio',
    'profile.biography', 'profile.bio',
    'social.instagram.biography', 'social.instagram.bio',
    'accountData.biography', 'account.biography',
    'instagram_user.biography', 'instagram_user.bio',
  ];
  for (const path of tryPaths) {
    const val = path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    if (typeof val === 'string' && val.trim().length) return val.trim();
  }
  return null;
}

const AFFILIATE_LANDING_PATH = '/';

const resolveAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  const fallback = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return fallback ? fallback.replace(/\/$/, '') : '';
};

const buildAffiliateSignupLink = ({
  affiliateCode,
  mediaKitSlug,
  affiliateHandle,
}: {
  affiliateCode: string;
  mediaKitSlug?: string | null;
  affiliateHandle?: string | null;
}) => {
  const origin = resolveAppOrigin();
  if (!origin) return null;
  try {
    const url = new URL(`${origin}${AFFILIATE_LANDING_PATH}`);
    url.searchParams.set('aff', affiliateCode);
    url.searchParams.set('utm_source', 'mediakit');
    url.searchParams.set('utm_medium', 'affiliate_cta');
    url.searchParams.set('utm_campaign', mediaKitSlug || 'public');
    url.searchParams.set('origin_affiliate', affiliateCode);
    if (mediaKitSlug) url.searchParams.set('origin_slug', mediaKitSlug);
    if (affiliateHandle) url.searchParams.set('origin_handle', affiliateHandle);
    return url.toString();
  } catch {
    return null;
  }
};

const COMPARISON_TO_TIME_PERIOD = {
  month_vs_previous: 'last_30_days',
  last_7d_vs_previous_7d: 'last_7_days',
  last_30d_vs_previous_30d: 'last_30_days',
  last_60d_vs_previous_60d: 'last_60_days',
  last_90d_vs_previous_90d: 'last_90_days',
} as const;

type ComparisonPeriodKey = keyof typeof COMPARISON_TO_TIME_PERIOD;
type TrendPeriod = (typeof COMPARISON_TO_TIME_PERIOD)[ComparisonPeriodKey];
const DEFAULT_COMPARISON_PERIOD: ComparisonPeriodKey = 'last_30d_vs_previous_30d';

const normalizeComparisonPeriod = (period?: string): ComparisonPeriodKey => {
  if (period && period in COMPARISON_TO_TIME_PERIOD) {
    return period as ComparisonPeriodKey;
  }
  return DEFAULT_COMPARISON_PERIOD;
};

/**
 * COMPONENTES: Destaques / Rankings
 */
const PerformanceHighlightsCarousel = ({ userId }: { userId: string }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { timePeriod } = useGlobalTimePeriod();

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/users/${userId}/highlights/performance-summary?timePeriod=${timePeriod}`
        );
        const result = await response.json();
        setSummary(result);
      } catch (error) {
        console.error('Failed to fetch performance highlights', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, timePeriod]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!summary) return <p className="text-gray-500">Não foi possível carregar os destaques.</p>;

  const getPortugueseWeekdayName = (dow0to6: number): string =>
    ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][((dow0to6 % 7) + 7) % 7] || '';

  const highlightItems = [
    {
      key: 'format',
      title: 'Melhor formato',
      icon: <TrendingUp className="h-4 w-4" />,
      data: summary.topPerformingFormat,
    },
    {
      key: 'context',
      title: 'Contexto vencedor',
      icon: <Sparkles className="h-4 w-4" />,
      data: summary.topPerformingContext,
    },
    {
      key: 'proposal',
      title: 'Proposta em alta',
      icon: <Sparkles className="h-4 w-4" />,
      data: summary.topPerformingProposal,
    },
    {
      key: 'tone',
      title: 'Tom que engaja',
      icon: <MessageSquare className="h-4 w-4" />,
      data: summary.topPerformingTone,
    },
    {
      key: 'reference',
      title: 'Referência que inspira',
      icon: <Sparkles className="h-4 w-4" />,
      data: summary.topPerformingReference,
    },
    {
      key: 'day',
      title: 'Dia mais quente',
      icon: <CalendarDays className="h-4 w-4" />,
      data: summary.bestDay
        ? {
            name: getPortugueseWeekdayName(summary.bestDay.dayOfWeek),
            metricName: 'Interações médias',
            valueFormatted: summary.bestDay.average?.toFixed?.(1) ?? '—',
          }
        : null,
    },
  ].filter((item) => item.data);

  const narrative =
    summary?.headline ||
    summary?.insightSummary?.topHighlight ||
    (summary?.topPerformingFormat?.name && summary?.topPerformingContext?.name
      ? `Conteúdos em ${summary.topPerformingFormat.name} com foco em ${summary.topPerformingContext.name} lideram as interações recentes.`
      : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {highlightItems.map((item, index) => {
          const isAccent = index === 0;
          return (
            <div
              key={item.key}
              className={`flex min-w-[140px] flex-1 basis-[45%] items-start gap-2 rounded-xl p-3 ${
                isAccent ? 'bg-gradient-to-br from-[#FFE1EA] via-white to-[#FFF8FA]' : 'bg-[#FAFAFB]'
              }`}
            >
              <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${isAccent ? 'bg-white text-[#D62E5E]' : 'bg-white text-[#6E1F93]'}`}>
                {item.icon}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.title}</p>
                <p className="text-sm font-bold text-[#1C1C1E] leading-tight">{item.data.name}</p>
                <p className="text-xs text-gray-500">
                  {item.data.metricName}: {item.data.valueFormatted}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {narrative ? (
        <p className="rounded-xl bg-white p-4 text-center text-sm font-medium text-[#6E1F93] shadow-sm">
          {narrative}
        </p>
      ) : null}
    </div>
  );
};

const LockedCategoriesPeek = () => {
  const sections = [
    { label: "Formato", items: ["Reels", "Stories", "Carrossel"] },
    { label: "Proposta", items: ["Bastidores", "Educação", "Review"] },
    { label: "Contexto", items: ["Tutorial", "Diário", "Entrevista"] },
  ];
  return (
    <div className="space-y-3" aria-hidden="true">
      {sections.map((section) => (
        <div key={section.label} className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500">{section.label}</h4>
          <div className="flex flex-wrap gap-2">
            {section.items.map((item) => (
              <span
                key={`${section.label}-${item}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700/90 blur-[1px]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const LockedHighlightsPeek = () => {
  const samples = [
    { title: "Melhor formato", detail: "+22% interações" },
    { title: "Contexto vencedor", detail: "+18% alcance" },
    { title: "Horário quente", detail: "19h – 21h" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
      {samples.map((item) => (
        <div
          key={item.title}
          className="rounded-lg border border-pink-100 bg-white/80 p-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-gray-800">{item.title}</p>
          <p className="text-xs text-gray-500 mt-2 blur-[1px]">{item.detail}</p>
        </div>
      ))}
    </div>
  );
};

interface ProposalFormState {
  brandName: string;
  contactEmail: string;
  contactWhatsapp: string;
  campaignTitle: string;
  campaignDescription: string;
  deliverables: string;
  budget: string;
  currency: string;
}

type PublicProposalFormProps = {
  mediaKitSlug?: string;
  onSubmitSuccess?: () => void;
  onSubmitError?: (error: Error) => void;
  utmContext?: UtmContext | null;
};

const PublicProposalForm = ({
  mediaKitSlug,
  onSubmitSuccess,
  onSubmitError,
  utmContext,
}: PublicProposalFormProps) => {
  const formId = useId();
  const [form, setForm] = useState<ProposalFormState>({
    brandName: '',
    contactEmail: '',
    contactWhatsapp: '',
    campaignTitle: '',
    campaignDescription: '',
    deliverables: '',
    budget: '',
    currency: 'BRL',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [utmSnapshot, setUtmSnapshot] = useState<UtmContext | null>(utmContext ?? null);

  useEffect(() => {
    setUtmSnapshot(utmContext ?? null);
  }, [utmContext]);

  if (!mediaKitSlug) return null;

  const handleChange =
    (field: keyof ProposalFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = event.target.value;
      if (field === 'currency') {
        value = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      }
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const resetForm = () => {
    setForm({
      brandName: '',
      contactEmail: '',
      contactWhatsapp: '',
      campaignTitle: '',
      campaignDescription: '',
      deliverables: '',
      budget: '',
      currency: 'BRL',
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setSuccess(false);
    setError(null);

    const deliverables = form.deliverables
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      brandName: form.brandName.trim(),
      contactEmail: form.contactEmail.trim(),
      campaignTitle: form.campaignTitle.trim(),
    };

    if (form.contactWhatsapp.trim()) payload.contactWhatsapp = form.contactWhatsapp.trim();
    if (form.campaignDescription.trim()) payload.campaignDescription = form.campaignDescription.trim();
    if (deliverables.length) payload.deliverables = deliverables;
    if (form.budget.trim()) payload.budget = form.budget.trim();
    if (form.currency.trim()) payload.currency = form.currency.trim().toUpperCase();

    const utmPayload = utmSnapshot;
    if (utmPayload?.utm_source) payload.utmSource = utmPayload.utm_source;
    if (utmPayload?.utm_medium) payload.utmMedium = utmPayload.utm_medium;
    if (utmPayload?.utm_campaign) payload.utmCampaign = utmPayload.utm_campaign;
    if (utmPayload?.utm_term) payload.utmTerm = utmPayload.utm_term;
    if (utmPayload?.utm_content) payload.utmContent = utmPayload.utm_content;
    if (utmPayload?.referrer) payload.referrer = utmPayload.referrer;
    if (utmPayload?.first_touch_at) payload.utmFirstTouchAt = utmPayload.first_touch_at;
    if (utmPayload?.last_touch_at) payload.utmLastTouchAt = utmPayload.last_touch_at;
    if (!payload.referrer && typeof document !== 'undefined' && document.referrer) {
      payload.referrer = document.referrer;
    }

    try {
      const response = await fetch(`/api/mediakit/${mediaKitSlug}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Não foi possível enviar sua proposta agora.');
      }
      const result = body?.data ?? {};
      const creatorId = typeof result?.creatorId === 'string' ? result.creatorId : null;
      const proposalId = typeof result?.proposalId === 'string' ? result.proposalId : null;
      const deliverablesCount =
        typeof result?.deliverablesCount === 'number'
          ? result.deliverablesCount
          : Array.isArray(payload.deliverables)
          ? payload.deliverables.length
          : 0;
      const responseBudget = typeof result?.budget === 'number' ? result.budget : null;

      setSuccess(true);
      resetForm();
      track('proposal_submitted', {
        creator_id: creatorId,
        proposal_id: proposalId,
        budget: typeof responseBudget === 'number' ? Math.round(responseBudget) : null,
        deliverables_count: deliverablesCount,
        timeline_days: result?.timelineDays ?? null,
        utm_source: utmPayload?.utm_source ?? null,
        utm_medium: utmPayload?.utm_medium ?? null,
        utm_campaign: utmPayload?.utm_campaign ?? null,
        utm_content: utmPayload?.utm_content ?? null,
        utm_term: utmPayload?.utm_term ?? null,
      });
      track('proposal_received', {
        creator_id: creatorId,
        proposal_id: proposalId,
        source: 'media_kit',
      });
      onSubmitSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado. Tente novamente mais tarde.');
      const normalizedError = err instanceof Error ? err : new Error(err?.message || 'submission_failed');
      track('proposal_submission_failed', {
        creator_id: null,
        proposal_id: null,
        message: normalizedError.message,
        media_kit_id: mediaKitSlug ?? null,
        utm_source: utmPayload?.utm_source ?? null,
        utm_medium: utmPayload?.utm_medium ?? null,
        utm_campaign: utmPayload?.utm_campaign ?? null,
      });
      onSubmitError?.(normalizedError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-brand`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Nome da marca*
          </label>
          <input
            id={`${formId}-brand`}
            required
            value={form.brandName}
            onChange={handleChange('brandName')}
            placeholder="Ex.: Natura"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            E-mail comercial*
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            required
            value={form.contactEmail}
            onChange={handleChange('contactEmail')}
            placeholder="nome@empresa.com"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-whatsapp`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            WhatsApp (opcional)
          </label>
          <input
            id={`${formId}-whatsapp`}
            value={form.contactWhatsapp}
            onChange={handleChange('contactWhatsapp')}
            placeholder="+55 11 90000-0000"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-budget`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Orçamento disponível
          </label>
          <div className="mt-1 flex rounded-xl border border-gray-200 shadow-sm focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500">
            <input
              id={`${formId}-budget`}
              value={form.budget}
              onChange={handleChange('budget')}
              placeholder="Ex.: 5000"
              className="w-full rounded-l-xl border-r border-gray-200 px-4 py-2 text-sm text-gray-800 focus:outline-none"
            />
            <input
              value={form.currency}
              onChange={handleChange('currency')}
              className="w-20 rounded-r-xl bg-gray-50 px-3 py-2 text-center text-sm font-semibold uppercase text-gray-600 focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">Informe números; moeda padrão BRL.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-title`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Título da campanha*
          </label>
          <input
            id={`${formId}-title`}
            required
            value={form.campaignTitle}
            onChange={handleChange('campaignTitle')}
            placeholder="Ex.: Lançamento coleção verão"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-deliverables`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Entregáveis desejados
          </label>
          <textarea
            id={`${formId}-deliverables`}
            value={form.deliverables}
            onChange={handleChange('deliverables')}
            placeholder="Stories, Reels, UGC..."
            rows={3}
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
          <p className="mt-1 text-xs text-gray-400">Separe por vírgulas ou quebra de linha.</p>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-description`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Descrição / briefing
        </label>
        <textarea
          id={`${formId}-description`}
          value={form.campaignDescription}
          onChange={handleChange('campaignDescription')}
          placeholder="Compartilhe objetivos, público e principais mensagens da campanha."
          rows={4}
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Proposta enviada! O criador vai entrar em contato em breve.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D62E5E] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#c12652] disabled:cursor-not-allowed disabled:bg-[#d28aa2]"
      >
        {submitting ? 'Enviando...' : 'Enviar proposta'}
        <Send className="h-4 w-4" />
      </button>
      <p className="text-xs text-gray-400">
        Ao enviar, você concorda em ser contatado pelo criador. Guardamos seu IP para evitar spam.
      </p>
    </form>
  );
};

type LockedPremiumSectionProps = {
  title: string;
  description: string;
  ctaLabel: string;
  subtitle?: string;
  badgeLabel?: string;
  showBadge?: boolean;
  onAction?: () => void;
  peek: React.ReactNode;
};

const LockedPremiumSection = ({
  title,
  description,
  ctaLabel,
  subtitle,
  badgeLabel = "Modo PRO",
  showBadge = true,
  onAction,
  peek,
}: LockedPremiumSectionProps) => {
  const disabled = typeof onAction !== "function";

  return (
    <div className="space-y-4">
      {showBadge ? (
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-pink-600">
          <Lock className="h-4 w-4" aria-hidden="true" />
          {badgeLabel}
        </span>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
      <div>{peek}</div>
      <div>
        <button
          type="button"
          onClick={disabled ? undefined : () => onAction?.()}
          disabled={disabled}
          className={`inline-flex items-center justify-center rounded-md bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 ${
            disabled ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {ctaLabel}
          <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
    </div>
  );
};

type StickyCtaBarProps = {
  visible: boolean;
  onProposalClick: () => void;
  onAffiliateClick: () => void;
  affiliateLink: string | null;
  affiliateAvailable: boolean;
  affiliateHandleLabel: string;
};

const StickyCtaBar = ({
  visible,
  onProposalClick,
  onAffiliateClick,
  affiliateLink,
  affiliateAvailable,
  affiliateHandleLabel,
}: StickyCtaBarProps) => {
  const baseButtonClasses =
    'group flex w-full flex-col items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

  return (
    <div
      className={`sticky-cta-bar ${visible ? '' : 'sticky-cta-bar--hidden'}`}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => onProposalClick()}
          className={`${baseButtonClasses} bg-[#1C4FD7] hover:bg-[#1a46c3] focus-visible:outline-[#1C4FD7]`}
        >
          <span className="flex items-center gap-2 text-base">
            <span role="img" aria-hidden="true">
              💼
            </span>
            Enviar proposta
          </span>
          <span className="mt-1 text-xs font-medium text-white/80">Receba resposta rápida do criador</span>
        </button>

        {affiliateAvailable && affiliateLink ? (
          <a
            href={affiliateLink}
            onClick={() => onAffiliateClick()}
            className={`${baseButtonClasses} bg-[#6E1F93] hover:bg-[#5a1a78] focus-visible:outline-[#6E1F93]`}
            rel="noopener noreferrer"
          >
            <span className="flex items-center gap-2 text-base">
              <span role="img" aria-hidden="true">
                🚀
              </span>
              Criar meu Mídia Kit
            </span>
            <span className="mt-1 text-xs font-medium text-white/80">
              Comece agora com seu link afiliado
            </span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className={`${baseButtonClasses} cursor-not-allowed bg-gray-200 text-gray-500 shadow-none`}
          >
            <span className="flex items-center gap-2 text-base">
              <span role="img" aria-hidden="true">
                🚀
              </span>
              Criar meu Mídia Kit
            </span>
            <span className="mt-1 text-xs font-medium text-gray-500/80">
              Link disponível em breve para {affiliateHandleLabel}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

interface RankItem {
  category: string;
  value: number;
}
type CategoryKey = 'format' | 'proposal' | 'context';

interface MetricListProps {
  items: RankItem[];
  type: CategoryKey;
}

// Fallback robusto: tenta classification -> commaSeparatedIdsToLabels -> Title Case do id
const idToLabel = (id: string | number, type: CategoryKey) => {
  const rawId = String(id ?? '').trim();
  if (!rawId) return '—';
  try {
    const found = (getCategoryById as any)?.(rawId, type);
    if (found?.label) return String(found.label);
  } catch {}
  try {
    const viaComma = (commaSeparatedIdsToLabels as any)?.(rawId, type);
    if (viaComma && String(viaComma).length > 0) return String(viaComma);
  } catch {}
  return rawId
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const MetricList = ({ items, type }: MetricListProps) => (
  <ul className="space-y-1 text-sm text-gray-600">
    {items.map((it, idx) => (
      <li key={`${it.category}-${idx}`} className="flex justify-between border-b border-gray-100 pb-1 last:border-b-0">
        <span className="truncate pr-2 font-medium text-gray-700" title={String(it.category)}>
          {idToLabel(it.category, type)}
        </span>
        <span className="tabular-nums text-gray-500">{new Intl.NumberFormat('pt-BR').format(it.value)}</span>
      </li>
    ))}
  </ul>
);

const CategoryRankingsCarousel = ({ userId }: { userId: string }) => {
  const [rankings, setRankings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchAllRankings = async () => {
      if (!userId) return;
      setLoading(true);

      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const fetchCategoryRanking = async (category: CategoryKey, metric: string) => {
        const qs = new URLSearchParams({ category, metric, startDate, endDate, limit: '5', userId });
        const res = await fetch(`/api/admin/dashboard/rankings/categories?${qs.toString()}`);
        return res.ok ? res.json() : [];
      };

      try {
        const [fp, fa, pp, pa, cp, ca] = await Promise.all([
          fetchCategoryRanking('format', 'posts'),
          fetchCategoryRanking('format', 'avg_total_interactions'),
          fetchCategoryRanking('proposal', 'posts'),
          fetchCategoryRanking('proposal', 'avg_total_interactions'),
          fetchCategoryRanking('context', 'posts'),
          fetchCategoryRanking('context', 'avg_total_interactions'),
        ]);
        setRankings({ fp, fa, pp, pa, cp, ca });
      } catch (error) {
        console.error('Failed to fetch rankings', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllRankings();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!Object.keys(rankings).length)
    return <p className="text-gray-500">Não foi possível carregar os rankings.</p>;

  const summaryRows = [
    rankings.fa?.[0]
      ? `Formato destaque: ${idToLabel(rankings.fa[0].category, 'format')}`
      : null,
    rankings.pa?.[0]
      ? `Proposta forte: ${idToLabel(rankings.pa[0].category, 'proposal')}`
      : null,
    rankings.ca?.[0]
      ? `Contexto de impacto: ${idToLabel(rankings.ca[0].category, 'context')}`
      : null,
  ].filter(Boolean) as string[];

  const detailSections = [
    {
      key: 'formats',
      title: 'Formatos',
      items: [
        { label: 'Mais publicados', data: rankings.fp, type: 'format' as const },
        { label: 'Maior média de interações', data: rankings.fa, type: 'format' as const },
      ],
    },
    {
      key: 'proposals',
      title: 'Propostas',
      items: [
        { label: 'Mais publicadas', data: rankings.pp, type: 'proposal' as const },
        { label: 'Maior média de interações', data: rankings.pa, type: 'proposal' as const },
      ],
    },
    {
      key: 'contexts',
      title: 'Contextos',
      items: [
        { label: 'Mais recorrentes', data: rankings.cp, type: 'context' as const },
        { label: 'Maior média de interações', data: rankings.ca, type: 'context' as const },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {summaryRows.length > 0 ? (
        <div className="space-y-2 text-sm text-gray-700">
          {summaryRows.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-2xl border border-[#EAEAEA] bg-[#FAFAFB] px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-[#D62E5E]"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span>Ver comparativos detalhados</span>
        <ArrowDownRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded ? (
        <div className="space-y-5 rounded-2xl border border-[#EAEAEA] bg-white p-4">
          {detailSections.map((section) => (
            <div key={section.key} className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
              {section.items.map(
                (block) =>
                  Array.isArray(block.data) && block.data.length > 0 ? (
                    <div key={`${section.key}-${block.label}`} className="rounded-xl bg-[#FAFAFB] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{block.label}</p>
                      <MetricList items={block.data.slice(0, 5)} type={block.type} />
                    </div>
                  ) : null
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * MISC UI
 */
interface TrendIndicatorProps {
  value: number | null | undefined;
}
const TrendIndicator = ({ value, showValue = true }: TrendIndicatorProps & { showValue?: boolean }) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const titleText = Number.isFinite(value)
    ? `Variação de ${value.toFixed(1)}% em relação ao período anterior`
    : 'Variação muito alta';
  const shown = Number.isFinite(value) ? `${Math.abs(value).toFixed(1)}%` : '∞';
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${showValue ? 'ml-2' : ''}`}
      title={titleText}
    >
      <Icon className={colorClass} size={14} />
      {showValue ? <span className={colorClass}>{shown}</span> : null}
    </span>
  );
};

const tagStyleMap: Record<
  'format' | 'context' | 'proposal' | 'tone',
  { bgClass: string; textClass: string; labelPrefix: string }
> = {
  format: { bgClass: 'bg-[#EEF2FF]', textClass: 'text-[#3C4B9B]', labelPrefix: 'Formato' },
  context: { bgClass: 'bg-[#FFF5E6]', textClass: 'text-[#C9721A]', labelPrefix: 'Contexto' },
  proposal: { bgClass: 'bg-[#FEE9F1]', textClass: 'text-[#B83268]', labelPrefix: 'Proposta' },
  tone: { bgClass: 'bg-[#E8FBF1]', textClass: 'text-[#2F8E5B]', labelPrefix: 'Tom' },
};

const SparklineChart = ({ values, color = '#D62E5E' }: { values: number[]; color?: string }) => {
  const gradientId = useId();
  if (!values || values.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] font-medium text-gray-400">
        Sem dados recentes
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const normalized = values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * 100 : 50;
    const y = 90 - ((value - min) / range) * 70;
    return { x, y, value };
  });
  const firstPoint = normalized[0]!;
  const lastPoint = normalized[normalized.length - 1]!;
  const linePath = normalized.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ');
  const areaPath = `${linePath} L ${lastPoint.x},90 L ${firstPoint.x},90 Z`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {normalized.map((point, idx) => (
        <circle
          key={idx}
          cx={point.x}
          cy={point.y}
          r={idx === normalized.length - 1 ? 1.8 : 1.2}
          fill={color}
          opacity={idx === normalized.length - 1 ? 1 : 0.7}
        />
      ))}
    </svg>
  );
};

const genderLabelMap: { [key: string]: string } = { f: 'Feminino', m: 'Masculino', u: 'Desconhecido' };
const getTopEntry = (data: { [key: string]: number } | undefined) =>
  !data || Object.keys(data).length === 0 ? null : Object.entries(data).reduce((a, b) => (a[1] > b[1] ? a : b));
const generateDemographicSummary = (demographics: any) => {
  if (!demographics?.follower_demographics) return 'Dados demográficos não disponíveis.';
  const { gender, age, city, country } = demographics.follower_demographics;
  const topGenderEntry = getTopEntry(gender);
  const topAgeEntry = getTopEntry(age);
  const topCityEntry = getTopEntry(city);
  const topCountryEntry = getTopEntry(country);
  const topLocation = topCityEntry?.[0] || topCountryEntry?.[0];
  if (!topGenderEntry || !topAgeEntry || !topLocation) return 'Perfil de público diversificado.';
  const dominantGender = (
    { f: 'feminino', m: 'masculino', u: 'desconhecido' } as { [key: string]: string }
  )[topGenderEntry[0].toLowerCase()] || topGenderEntry[0];
  return `Mais popular entre o público ${dominantGender}, ${topAgeEntry[0]} anos, em ${topLocation}.`;
};

const formatDateLabel = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const dateObj = typeof value === 'string' ? new Date(value) : value;
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);
};

const truncateCaption = (caption?: string | null, maxLength = 120) => {
  if (!caption) return null;
  const clean = caption.trim();
  if (!clean.length) return null;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
};

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);
const MetricSkeletonRow = () => (
  <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2 rounded-lg">
    <div className="flex flex-col items-center">
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
    <div className="flex flex-col items-center">
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
    <div className="flex flex-col items-center">
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
  </div>
);

/**
 * MAIN COMPONENT
 */
export default function MediaKitView({
  user,
  summary,
  videos,
  kpis: initialKpis,
  demographics,
  engagementTrend,
  showSharedBanner = false,
  showOwnerCtas = false,
  belowAffiliateSlot,
  compactPadding = false,
  publicUrlForCopy,
  mediaKitSlug,
  premiumAccess,
}: MediaKitViewProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' } }),
  } as const;
  const comparisonToTimePeriod = COMPARISON_TO_TIME_PERIOD;
  const normalizedInitialComparisonPeriod = normalizeComparisonPeriod(initialKpis?.comparisonPeriod);
  const PERIOD_OPTIONS = useMemo<Array<{ value: ComparisonPeriodKey; label: string }>>(
    () => [
      { value: 'last_7d_vs_previous_7d', label: 'Últimos 7 dias' },
      { value: 'last_30d_vs_previous_30d', label: 'Últimos 30 dias' },
      { value: 'last_60d_vs_previous_60d', label: 'Últimos 60 dias' },
      { value: 'last_90d_vs_previous_90d', label: 'Últimos 90 dias' },
    ],
    []
  );
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriodKey>(
    normalizedInitialComparisonPeriod
  );
  const [kpiData, setKpiData] = useState(initialKpis as any);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialKpis);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const { data: session } = useSession();
  const billingStatus = useBillingStatus({ auto: showOwnerCtas });
  const stickyStartRef = useRef<HTMLDivElement | null>(null);
  const stickyEndRef = useRef<HTMLDivElement | null>(null);
  const [hasPassedStickyStart, setHasPassedStickyStart] = useState(false);
  const [isStickyEndVisible, setIsStickyEndVisible] = useState(false);
  const { utm } = useUtmAttribution({ captureReferrer: true });
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    async function fetchData() {
      if (!user?._id) return;
      setIsLoading(true);
      setKpiError(null);
      try {
        const res = await fetch(
          `/api/v1/users/${user._id}/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          setKpiData(data);
        } else {
          setKpiError('Não foi possível atualizar os KPIs agora.');
        }
      } catch {
        setKpiError('Não foi possível atualizar os KPIs agora.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [comparisonPeriod, user?._id]);

  const selectedPeriodLabel = useMemo(() => {
    const option = PERIOD_OPTIONS.find((item) => item.value === comparisonPeriod);
    return option?.label ?? 'Últimos 30 dias';
  }, [PERIOD_OPTIONS, comparisonPeriod]);

  const cardStyle = 'bg-white rounded-3xl border border-[#EAEAEA] shadow-sm p-5 sm:p-6';
  const containerClass = compactPadding
    ? 'mx-auto w-full max-w-5xl px-4 py-6'
    : 'mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8';
  const sectionsWrapperClass = 'flex flex-col gap-4 sm:gap-3 lg:gap-2';
  const compactNumberFormat = (num: number | null | undefined) =>
    num?.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) ?? '...';
  const formatQuickStatValue = (value: number | null | undefined, type: 'number' | 'percent') => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    if (type === 'percent') {
      const precision = Math.abs(value) >= 10 ? 0 : 1;
      return `${value.toFixed(precision)}%`;
    }
    return compactNumberFormat(value);
  };
  const formatMetricValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toLocaleString('pt-BR');
  };
  const displayKpis = kpiData as any;
  const initialTrendPeriod =
    comparisonToTimePeriod[normalizedInitialComparisonPeriod] ?? 'last_30_days';
  const [engagementTrendState, setEngagementTrendState] = useState(engagementTrend);
  const [currentTrendPeriod, setCurrentTrendPeriod] = useState<TrendPeriod>(initialTrendPeriod);

  useEffect(() => {
    const targetPeriod = comparisonToTimePeriod[comparisonPeriod] ?? initialTrendPeriod;
    if (!user?._id || targetPeriod === currentTrendPeriod) return;

    let cancelled = false;
    async function fetchTrend() {
      try {
        const res = await fetch(
          `/api/v1/users/${user._id}/trends/reach-engagement?timePeriod=${targetPeriod}&granularity=daily`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          console.error('Failed to fetch engagement trend', res.status);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setEngagementTrendState(data);
          setCurrentTrendPeriod(targetPeriod);
        }
      } catch (error) {
        console.error('Erro ao buscar engagement trend', error);
      }
    }

    fetchTrend();
    return () => {
      cancelled = true;
    };
  }, [comparisonPeriod, user?._id, currentTrendPeriod, initialTrendPeriod, comparisonToTimePeriod]);

  const demographicSummary = useMemo(() => generateDemographicSummary(demographics), [demographics]);
  const engagementSparklineData = useMemo(() => {
    if (!engagementTrendState?.chartData) return [] as { date: string; rate: number }[];
    const sanitized = engagementTrendState.chartData
      .map((point) => {
        const reachRaw = point?.reach;
        const interactionsRaw = point?.totalInteractions;
        const reach = typeof reachRaw === 'number' ? reachRaw : Number(reachRaw ?? 0);
        const interactions = typeof interactionsRaw === 'number' ? interactionsRaw : Number(interactionsRaw ?? 0);
        if (!Number.isFinite(reach) || reach <= 0) return null;
        const safeInteractions = Number.isFinite(interactions) ? interactions : 0;
        const rate = (safeInteractions / reach) * 100;
        if (!Number.isFinite(rate)) return null;
        return { date: point.date, rate: Math.max(rate, 0) };
      })
      .filter((item): item is { date: string; rate: number } => Boolean(item));
    const maxPoints = 30;
    return sanitized.length > maxPoints ? sanitized.slice(-maxPoints) : sanitized;
  }, [engagementTrendState]);
  const engagementSparklineValues = useMemo(
    () => engagementSparklineData.map((point) => point.rate),
    [engagementSparklineData]
  );
  const engagementTrendNarrative = useMemo(() => {
    if (engagementTrendState?.insightSummary) return engagementTrendState.insightSummary;
    const periodLabelLower = selectedPeriodLabel.toLocaleLowerCase('pt-BR');
    if (engagementSparklineData.length === 0) {
      return displayKpis?.insightSummary?.engagementRate ?? `${selectedPeriodLabel} via Data2Content AI.`;
    }
    const firstPoint = engagementSparklineData[0];
    const lastPoint = engagementSparklineData[engagementSparklineData.length - 1];
    if (!firstPoint || !lastPoint) {
      return displayKpis?.insightSummary?.engagementRate ?? `${selectedPeriodLabel} via Data2Content AI.`;
    }
    const first = firstPoint.rate;
    const last = lastPoint.rate;
    const avg =
      engagementSparklineData.reduce((sum, point) => sum + point.rate, 0) / engagementSparklineData.length;
    const diff = last - first;
    if (Math.abs(diff) < 0.15) {
      return `A taxa de engajamento manteve-se estável (${avg.toFixed(1)}% de média) nos ${periodLabelLower}.`;
    }
    return `A taxa de engajamento ${diff > 0 ? 'subiu' : 'caiu'} ${Math.abs(diff).toFixed(
      1
    )} p.p. nos ${periodLabelLower} (média de ${avg.toFixed(1)}%).`;
  }, [
    engagementTrendState?.insightSummary,
    engagementSparklineData,
    displayKpis?.insightSummary?.engagementRate,
    selectedPeriodLabel,
  ]);
  const engagementRateValue = displayKpis?.engagementRate?.currentValue ?? null;
  const engagementRateDisplay = formatQuickStatValue(engagementRateValue, 'percent');
  const engagementRateColor = engagementRateValue !== null ? 'text-[#D62E5E]' : 'text-gray-400';
  const followerCountDisplay =
    typeof user.followers_count === 'number' ? user.followers_count.toLocaleString('pt-BR') : '—';
  const followersCountRaw = (user as any)?.followers_count;
  const followersDisplay = useMemo(() => {
    if (typeof followersCountRaw !== 'number' || !Number.isFinite(followersCountRaw) || followersCountRaw <= 0) {
      return null;
    }
    return followersCountRaw.toLocaleString('pt-BR');
  }, [followersCountRaw]);
  const engagementRateHeroDisplay = useMemo(() => {
    if (typeof engagementRateValue !== 'number' || !Number.isFinite(engagementRateValue)) return null;
    const precision = Math.abs(engagementRateValue) >= 10 ? 0 : 1;
    return `${engagementRateValue.toFixed(precision)}%`;
  }, [engagementRateValue]);
  const avgReachValue =
    displayKpis?.avgReachPerPost?.currentValue ??
    displayKpis?.avgViewsPerPost?.currentValue ??
    null;
  const avgReachDisplay = useMemo(() => {
    if (typeof avgReachValue !== 'number' || !Number.isFinite(avgReachValue) || avgReachValue < 0) return null;
    return new Intl.NumberFormat('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: avgReachValue >= 1000 ? 1 : 0,
    }).format(avgReachValue);
  }, [avgReachValue]);
  const heroMetrics = useMemo(
    () =>
      [
        followersDisplay
          ? {
              key: 'followers',
              icon: <Users className="h-4 w-4" />,
              label: 'Seguidores',
              value: followersDisplay,
            }
          : null,
        engagementRateHeroDisplay
          ? {
              key: 'engagement',
              icon: <Heart className="h-4 w-4" />,
              label: 'Engajamento médio',
              value: engagementRateHeroDisplay,
            }
          : null,
        avgReachDisplay
          ? {
              key: 'reach',
              icon: <Eye className="h-4 w-4" />,
              label: 'Alcance por post',
              value: avgReachDisplay,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; label: string; value: string }>,
    [avgReachDisplay, engagementRateHeroDisplay, followersDisplay]
  );

  const isPublicView = !showOwnerCtas;
  useEffect(() => {
    if (!isPublicView) {
      setHasPassedStickyStart(false);
      return;
    }
    const target = stickyStartRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setHasPassedStickyStart(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-40% 0px 0px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isPublicView]);

  useEffect(() => {
    if (!isPublicView) {
      setIsStickyEndVisible(false);
      return;
    }
    const target = stickyEndRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setIsStickyEndVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isPublicView]);

  const baseVisibilityMode = premiumAccess?.visibilityMode ?? 'lock';
  const visibilityMode = isPublicView ? 'hide' : baseVisibilityMode;
  const canViewPremiumSections = premiumAccess?.canViewCategories ?? true;
  const canViewCategories = canViewPremiumSections;
  const shouldLockPremiumSections = !canViewPremiumSections && visibilityMode === 'lock';
  const shouldHidePremiumSections = !canViewPremiumSections && visibilityMode === 'hide';
  const lockedCtaLabel = premiumAccess?.ctaLabel ?? "Ver categorias do meu perfil (Ativar trial 48h)";
  const lockedSubtitle = premiumAccess?.subtitle ?? PRO_PLAN_FLEXIBILITY_COPY;
  const categoryCtaLabel = premiumAccess?.categoryCtaLabel ?? lockedCtaLabel;
  const categorySubtitle = premiumAccess?.categorySubtitle ?? lockedSubtitle;
  const highlightDefaultCta = "Descobrir o que mais faz meu conteúdo crescer (Ativar trial 48h)";
  const highlightCtaLabel = premiumAccess?.highlightCtaLabel ?? highlightDefaultCta;
  const highlightSubtitle = premiumAccess?.highlightSubtitle ?? lockedSubtitle;
  const premiumTrialState = premiumAccess?.trialState ?? null;
  const lockedCategoriesDescription =
    premiumTrialState === "expired"
      ? "Seus dados ficaram congelados. Assine para continuar recebendo atualizações semanais."
      : "Ative o modo PRO para ver os formatos, propostas e contextos que mais puxam crescimento.";
  const lockedHighlightsDescription =
    premiumTrialState === "expired"
      ? "Retome o modo PRO para seguir recebendo os destaques automáticos da semana."
      : "Ative o modo PRO para destravar os principais insights sobre formatos, contextos e horários.";
  const lockedViewTrackedRef = useRef(false);
  const topPostsLockedViewTrackedRef = useRef(false);
  const topPostsScrollRef = useRef<HTMLDivElement | null>(null);

  // ✅ Bio com a mesma regra do componente antigo + fallbacks
  const bioText = useMemo(() => {
    const directUser = typeof (user as any)?.biography === 'string' ? (user as any).biography.trim() : '';
    const directSummary = typeof (summary as any)?.biography === 'string' ? (summary as any).biography.trim() : '';
    return directUser || directSummary || extractIgBio(user) || extractIgBio(summary) || '';
  }, [user, summary]);
  const heroBio = useMemo(() => {
    if (!bioText) return null;
    const normalized = bioText.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.length > 180 ? `${normalized.slice(0, 177).trim()}…` : normalized;
  }, [bioText]);
  const heroTagline = useMemo(() => {
    const candidates = [
      (user as any)?.headline,
      (user as any)?.mission,
      (user as any)?.valueProp,
      (user as any)?.title,
      (user as any)?.occupation,
    ];
    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (!found) return null;
    const cleaned = found.trim().replace(/^["“]+|["”]+$/g, '');
    if (heroBio && cleaned.toLowerCase() === heroBio.toLowerCase()) {
      return null;
    }
    return cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}…` : cleaned;
  }, [heroBio, user]);

  const demographicBreakdowns = useMemo(() => {
    if (!demographics?.follower_demographics) return null as any;
    const { gender, age, city } = demographics.follower_demographics;
    const calculatePercentages = (data: Record<string, number> | undefined) => {
      if (!data) return [] as { label: string; percentage: number }[];
      const total = Object.values(data).reduce((sum: number, count: number) => sum + count, 0);
      return Object.entries(data)
        .map(([label, count]) => ({ label, percentage: ((count as number) / total) * 100 }))
        .sort((a, b) => b.percentage - a.percentage);
    };
    return {
      gender: calculatePercentages(gender),
      age: calculatePercentages(age).slice(0, 5),
      location: calculatePercentages(city), // lista completa; exibimos top 3 no card
    };
  }, [demographics]);
  const topGenderBreakdown = useMemo(
    () => (demographicBreakdowns?.gender ? demographicBreakdowns.gender.slice(0, 3) : []),
    [demographicBreakdowns]
  );
  const topAgeBreakdown = useMemo(
    () => (demographicBreakdowns?.age ? demographicBreakdowns.age.slice(0, 3) : []),
    [demographicBreakdowns]
  );
  const topLocationBreakdown = useMemo(
    () => (demographicBreakdowns?.location ? demographicBreakdowns.location.slice(0, 3) : []),
    [demographicBreakdowns]
  );
  const demographicHighlights = useMemo(() => {
    const entries: Array<{ key: string; icon: React.ReactNode; title: string; value: string }> = [];
    if (topGenderBreakdown[0]) {
      const label = genderLabelMap[topGenderBreakdown[0].label.toLowerCase()] || topGenderBreakdown[0].label;
      entries.push({
        key: 'gender-primary',
        icon: <Users className="h-4 w-4 text-[#D62E5E]" />,
        title: label,
        value: `${Math.round(topGenderBreakdown[0].percentage)}% do público`,
      });
    }
    if (topGenderBreakdown[1]) {
      const label = genderLabelMap[topGenderBreakdown[1].label.toLowerCase()] || topGenderBreakdown[1].label;
      entries.push({
        key: 'gender-secondary',
        icon: <Users className="h-4 w-4 text-[#6E1F93]" />,
        title: label,
        value: `${Math.round(topGenderBreakdown[1].percentage)}%`,
      });
    }
    if (topLocationBreakdown[0]) {
      const second = topLocationBreakdown[1]?.label;
      const locationLabel = second
        ? `${topLocationBreakdown[0].label} & ${second}`
        : topLocationBreakdown[0].label;
      entries.push({
        key: 'location',
        icon: <MapPin className="h-4 w-4 text-[#D62E5E]" />,
        title: locationLabel,
        value: `${Math.round(topLocationBreakdown[0].percentage)}% do público`,
      });
    }
    if (topAgeBreakdown[0]) {
      entries.push({
        key: 'age',
        icon: <CalendarDays className="h-4 w-4 text-[#6E1F93]" />,
        title: topAgeBreakdown[0].label,
        value: `${Math.round(topAgeBreakdown[0].percentage)}% dos seguidores`,
      });
    }
    return entries;
  }, [topAgeBreakdown, topGenderBreakdown, topLocationBreakdown]);

  const videosWithCorrectStats = useMemo(() => {
    if (!Array.isArray(videos)) return [] as VideoListItem[];
    return videos.map((video) => {
      const newVideo: VideoListItem = JSON.parse(JSON.stringify(video));
      type StatsType = NonNullable<typeof newVideo.stats> & { reach?: number | null | undefined } & Record<string, any>;
      const stats = (newVideo.stats ?? (newVideo.stats = {} as any)) as StatsType;
      if (stats.views == null || stats.views === 0) {
        const reachVal = (stats as any).reach;
        if (typeof reachVal === 'number' && isFinite(reachVal) && reachVal > 0) {
          (stats as any).views = reachVal;
        } else if (stats.views == null) {
          delete (stats as any).views;
        }
      }
      return newVideo;
    });
  }, [videos]);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const copyFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroDescriptor = useMemo(() => {
    const candidates = [
      (user as any)?.headline,
      (user as any)?.title,
      (user as any)?.occupation,
      (user as any)?.profession,
      (user as any)?.category,
      (user as any)?.bioTitle,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length) {
        return candidate.trim();
      }
    }
    return '';
  }, [user]);

  useEffect(() => {
    if (hasTrackedViewRef.current) return;
    const creatorId = (user as any)?._id ? String((user as any)._id) : null;
    const mediaKitId =
      typeof mediaKitSlug === 'string' && mediaKitSlug.length > 0
        ? mediaKitSlug
        : (user as any)?.mediaKitSlug ?? null;
    if (!creatorId || !mediaKitId) return;
    hasTrackedViewRef.current = true;
    const browserReferrer =
      typeof document !== 'undefined' && document.referrer ? document.referrer : null;
    track('media_kit_viewed', {
      creator_id: creatorId,
      media_kit_id: mediaKitId,
      referrer: utm.referrer ?? browserReferrer,
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
    });
  }, [mediaKitSlug, user, utm]);
  const heroLocationLabel = useMemo(() => {
    const locationParts = [
      (user as any)?.city,
      (user as any)?.state,
      (user as any)?.country,
    ].filter((part) => typeof part === 'string' && part.trim().length) as string[];
    return locationParts.length ? locationParts.join(', ') : '';
  }, [user]);
  const contactEmail = useMemo(() => {
    const email = (user as any)?.email;
    if (typeof email === 'string' && email.includes('@')) return email;
    return null;
  }, [user]);
  const handleShareClick = useCallback(async () => {
    const shareUrl = publicUrlForCopy || (typeof window !== 'undefined' ? window.location.href : '');
    if (!shareUrl || typeof navigator === 'undefined') return;
    const creatorId = (user as any)?._id ? String((user as any)._id) : null;
    const mediaKitId =
      typeof mediaKitSlug === 'string' && mediaKitSlug.length > 0
        ? mediaKitSlug
        : (user as any)?.mediaKitSlug ?? null;
    try {
      if (navigator.share) {
        await navigator.share({
          title: user?.name ? `Media Kit de ${user.name}` : 'Media Kit',
          url: shareUrl,
        });
        if (creatorId && mediaKitId) {
          track('copy_media_kit_link', {
            creator_id: creatorId,
            media_kit_id: mediaKitId,
            origin: 'web_share',
          });
        }
        return;
      }
    } catch {
      // fallback to clipboard copy
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setHasCopiedLink(true);
        if (copyFeedbackTimeout.current) clearTimeout(copyFeedbackTimeout.current);
        copyFeedbackTimeout.current = setTimeout(() => setHasCopiedLink(false), 2000);
        if (creatorId && mediaKitId) {
          track('copy_media_kit_link', {
            creator_id: creatorId,
            media_kit_id: mediaKitId,
            origin: 'clipboard',
          });
        }
      } catch {
        // ignore clipboard errors silently
      }
    }
  }, [mediaKitSlug, publicUrlForCopy, user]);
  useEffect(
    () => () => {
      if (copyFeedbackTimeout.current) clearTimeout(copyFeedbackTimeout.current);
    },
    []
  );
  const isTopPostsLocked = !canViewCategories && visibilityMode === 'lock';
  const quickStats = useMemo(
    () => [
      {
        key: 'reach',
        label: 'Alcance médio',
        icon: <Eye className="h-5 w-5" />,
        value: displayKpis?.avgReachPerPost?.currentValue ?? displayKpis?.avgViewsPerPost?.currentValue ?? null,
        change: displayKpis?.avgReachPerPost?.percentageChange ?? displayKpis?.avgViewsPerPost?.percentageChange ?? null,
        type: 'number' as const,
        detail: 'por post',
      },
      {
        key: 'engagement',
        label: 'Taxa de engajamento',
        icon: <Heart className="h-5 w-5" />,
        value: displayKpis?.engagementRate?.currentValue ?? null,
        change: displayKpis?.engagementRate?.percentageChange ?? null,
        type: 'percent' as const,
        detail: 'média do período',
      },
      {
        key: 'frequency',
        label: 'Posts semanais',
        icon: <CalendarDays className="h-5 w-5" />,
        value: displayKpis?.postingFrequency?.currentValue ?? null,
        change: displayKpis?.postingFrequency?.percentageChange ?? null,
        type: 'number' as const,
        detail: 'ritmo de publicação',
      },
      {
        key: 'followers',
        label: 'Crescimento',
        icon: <Users className="h-5 w-5" />,
        value: displayKpis?.followerGrowth?.currentValue ?? null,
        change: displayKpis?.followerGrowth?.percentageChange ?? null,
        type: 'number' as const,
        detail: 'seguidores',
      },
    ],
    [displayKpis]
  );
  const topPostsIntro = useMemo(() => {
    if (isTopPostsLocked) {
      return 'Prévia dos posts mais recentes. Ative o modo PRO para destravar a análise completa.';
    }
    if (!canViewCategories && visibilityMode === 'hide') {
      return 'Os posts com melhor desempenho aparecem, mas as categorias detalhadas estão ocultas nesta visualização.';
    }
    return 'Os posts que mais engajaram no período, com métricas prontas para apresentar.';
  }, [isTopPostsLocked, canViewCategories, visibilityMode]);
  const topPostsForCarousel = useMemo(() => {
    if (!Array.isArray(videosWithCorrectStats)) return [];
    const maxItems = Math.min(5, videosWithCorrectStats.length);
    return videosWithCorrectStats.slice(0, maxItems);
  }, [videosWithCorrectStats]);
  const visibleTopPosts = useMemo(
    () => (isTopPostsLocked ? topPostsForCarousel.slice(0, 3) : topPostsForCarousel),
    [isTopPostsLocked, topPostsForCarousel]
  );
  const handleTopPostsWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = topPostsScrollRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;

    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (dominantDelta === 0) return;

    const previousScrollLeft = container.scrollLeft;
    container.scrollLeft += dominantDelta;
    const scrolled = container.scrollLeft !== previousScrollLeft;

    if (scrolled && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (showOwnerCtas && shouldLockPremiumSections && !lockedViewTrackedRef.current) {
      track('media_kit_categories_locked_viewed', { surface: 'media_kit' });
      lockedViewTrackedRef.current = true;
    }
    if (showOwnerCtas && canViewPremiumSections) {
      lockedViewTrackedRef.current = false;
    }
  }, [showOwnerCtas, canViewPremiumSections, shouldLockPremiumSections]);

  useEffect(() => {
    if (showOwnerCtas && !canViewCategories && visibilityMode === 'lock' && !topPostsLockedViewTrackedRef.current) {
      track('media_kit_top_posts_locked_viewed', { surface: 'media_kit' });
      topPostsLockedViewTrackedRef.current = true;
    }
    if (showOwnerCtas && canViewCategories) {
      topPostsLockedViewTrackedRef.current = false;
    }
  }, [showOwnerCtas, canViewCategories, visibilityMode]);
  // Dono do Mídia Kit: considera o planStatus da sessão para esconder o CTA de assinatura
  const affiliateCode = useMemo(() => {
    const raw = (user as any)?.affiliateCode;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  }, [user]);
  const affiliateHandle = useMemo(() => {
    const candidates = [
      (user as any)?.username,
      (user as any)?.instagramUsername,
      (user as any)?.instagram?.username,
      (user as any)?.handle,
    ];
    const firstValid = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return firstValid ? firstValid.trim() : null;
  }, [user]);
  const affiliateHandleLabel = useMemo(() => {
    if (!affiliateHandle) return '@criador';
    return affiliateHandle.startsWith('@') ? affiliateHandle : `@${affiliateHandle}`;
  }, [affiliateHandle]);
  const affiliateLink = useMemo(() => {
    if (!affiliateCode) return null;
    return buildAffiliateSignupLink({
      affiliateCode,
      mediaKitSlug,
      affiliateHandle,
    });
  }, [affiliateCode, affiliateHandle, mediaKitSlug]);
  const multiCampaignLink = useMemo(() => {
    const params = new URLSearchParams({
      utm_source: 'mediakit',
      utm_medium: 'multi_campaign_cta',
      utm_campaign: mediaKitSlug || 'public',
    });
    if (affiliateHandle) params.set('origin_handle', affiliateHandle);
    if (mediaKitSlug) params.set('origin_slug', mediaKitSlug);
    if (affiliateCode) params.set('origin_affiliate', affiliateCode);
    return `/campaigns/new?${params.toString()}`;
  }, [affiliateCode, affiliateHandle, mediaKitSlug]);
  const instagramProfileUrl = useMemo(() => {
    if (!affiliateHandle) return null;
    const normalizedHandle = affiliateHandle.replace(/^@+/, '').trim();
    if (!normalizedHandle) return null;
    return `https://www.instagram.com/${normalizedHandle}`;
  }, [affiliateHandle]);
  const handleMultiCampaignCtaClick = useCallback(() => {
    track('media_kit_multi_campaign_cta_clicked', {
      slug: mediaKitSlug ?? null,
      handle: affiliateHandle ?? null,
      affiliateCode: affiliateCode ?? null,
    });
  }, [affiliateCode, affiliateHandle, mediaKitSlug]);
  const isSubscribed = useMemo(() => {
    if (billingStatus.hasPremiumAccess) return true;
    return isPlanActiveLike((session?.user as any)?.planStatus);
  }, [billingStatus.hasPremiumAccess, session?.user]);

  const isOwner = useMemo(() => {
    const su = (session?.user as any) || {};
    const uid = String((user as any)?._id || (user as any)?.id || '');
    const sid = String(su?._id || su?.id || '');
    return !!uid && !!sid && uid === sid;
  }, [session?.user, user]);

  const [isCitiesModalOpen, setCitiesModalOpen] = useState(false);
  const handleLockedCtaClick = useCallback(
    (surface: string) => {
      track('media_kit_trial_cta_clicked', { surface });
      premiumAccess?.onRequestUpgrade?.();
    },
    [premiumAccess]
  );
  const handleTopPostsCtaClick = useCallback(() => {
    track('media_kit_top_posts_trial_cta_clicked', { surface: 'media_kit_top_posts' });
    premiumAccess?.onRequestUpgrade?.();
  }, [premiumAccess]);
  const [isProposalDrawerOpen, setProposalDrawerOpen] = useState(false);
  const proposalDrawerTitleId = useId();
  const openProposalDrawer = useCallback(() => {
    setProposalDrawerOpen(true);
    track('media_kit_proposal_cta_opened', {
      slug: mediaKitSlug ?? null,
      handle: affiliateHandle ?? null,
    });
  }, [affiliateHandle, mediaKitSlug]);
  const closeProposalDrawer = useCallback(() => {
    setProposalDrawerOpen(false);
    track('media_kit_proposal_drawer_closed', {
      slug: mediaKitSlug ?? null,
    });
  }, [mediaKitSlug]);
  const handleProposalSuccess = useCallback(() => {
    // Mantém o drawer aberto para exibir a mensagem de sucesso na própria UI.
  }, []);
  useEffect(() => {
    if (!isProposalDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProposalDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeProposalDrawer, isProposalDrawerOpen]);
  const stickyEligible = Boolean(isPublicView && mediaKitSlug) && !isCitiesModalOpen && selectedPostId === null;
  const stickyVisible = stickyEligible && hasPassedStickyStart && !isStickyEndVisible && !isProposalDrawerOpen;
  const mainContainerClass = `${containerClass} ${stickyVisible ? 'pb-28 sm:pb-36' : ''}`;
  const handleStickyProposalClick = useCallback(() => {
    track('media_kit_proposal_sticky_clicked', {
      slug: mediaKitSlug ?? null,
      handle: affiliateHandle ?? null,
    });
    openProposalDrawer();
  }, [affiliateHandle, mediaKitSlug, openProposalDrawer]);
  const handleStickyAffiliateClick = useCallback(() => {
    if (!affiliateLink) return;
    track('media_kit_affiliate_sticky_clicked', {
      slug: mediaKitSlug ?? null,
      handle: affiliateHandle ?? null,
      affiliateCode,
    });
  }, [affiliateCode, affiliateHandle, affiliateLink, mediaKitSlug]);

  return (
    <GlobalTimePeriodProvider>
      <div className="bg-[#FAFAFB] min-h-screen font-sans text-gray-900">
        <div className={mainContainerClass}>
          <div className={sectionsWrapperClass}>
            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              className="relative overflow-hidden rounded-3xl border border-[#E6E2F3] bg-gradient-to-b from-[#F9F9FB] via-white to-white px-6 py-6 text-[#1C1C1E] shadow-md sm:px-8 sm:py-8"
            >
              <button
                type="button"
                onClick={handleShareClick}
                className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-[#6E1F93] shadow-sm transition hover:bg-white"
                aria-label="Compartilhar mídia kit"
              >
                <Share2 className="h-5 w-5" />
              </button>
              {hasCopiedLink && (
                <span className="absolute right-20 top-5 rounded-full bg-white px-3 py-1 text-xs font-medium text-[#6E1F93] shadow-sm">
                  Link copiado!
                </span>
              )}

              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="rounded-full border-2 border-white bg-white p-1 shadow-md">
                    <UserAvatar name={user.name || 'Criador'} src={user.profile_picture_url} size={128} />
                  </div>
                  <div className="space-y-3 text-center sm:text-left">
                    <div className="space-y-1">
                      <h1 className="text-2xl font-bold sm:text-3xl">{user.name || 'Criador'}</h1>
                      <div className="flex flex-col items-center gap-1 text-sm text-gray-500 sm:flex-row sm:items-center sm:gap-2">
                        {affiliateHandleLabel ? (
                          instagramProfileUrl ? (
                            <a
                              href={instagramProfileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#6E1F93] hover:text-[#4A1370] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A3E8] rounded"
                            >
                              {affiliateHandleLabel}
                            </a>
                          ) : (
                            <span>{affiliateHandleLabel}</span>
                          )
                        ) : null}
                        <span className={`${affiliateHandleLabel ? 'hidden sm:inline' : 'hidden'} text-gray-300`}>•</span>
                        <span className="font-semibold text-[#6E1F93]">Parceiro Data2Content</span>
                      </div>
                      <p className="text-xs text-gray-500 sm:text-sm">Análises e campanhas com IA.</p>
                      {heroDescriptor ? (
                        <p className="text-xs text-gray-400 sm:text-sm">{heroDescriptor}</p>
                      ) : null}
                      {heroLocationLabel ? (
                        <p className="text-xs text-gray-400 sm:text-sm">{heroLocationLabel}</p>
                      ) : null}
                    </div>
                    {heroBio ? (
                      <p className="text-sm leading-relaxed text-gray-600">{heroBio}</p>
                    ) : null}
                    {heroTagline ? (
                      <p className="text-sm italic text-[#4A3C65]">
                        “{heroTagline}”
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {heroMetrics.length ? (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {heroMetrics.map((metric) => (
                    <div
                      key={metric.key}
                      className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6E1F93]/10 text-[#6E1F93]">
                        {metric.icon}
                      </span>
                      <div className="text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{metric.label}</p>
                        <p className="text-sm font-semibold text-[#1C1C1E]">{metric.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.section>

            {showOwnerCtas && publicUrlForCopy ? (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.05}
                className={`${cardStyle} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">
                    Link do mídia kit
                  </p>
                  <p className="mt-1 break-all text-sm text-gray-700">{publicUrlForCopy}</p>
                </div>
                <div className="flex sm:flex-col sm:items-end gap-2">
                  <button
                    type="button"
                    onClick={handleShareClick}
                    className="inline-flex items-center gap-2 rounded-full bg-[#6E1F93]/10 px-4 py-2 text-xs font-semibold text-[#5a1a78] transition hover:bg-[#6E1F93]/15"
                  >
                    Copiar link
                  </button>
                  <span className="text-xs text-gray-500 sm:text-right">
                    Compartilhe este link com marcas e parceiros.
                  </span>
                </div>
              </motion.section>
            ) : null}

            {isPublicView ? (
              <div ref={stickyStartRef} className="h-px w-full" aria-hidden="true" />
            ) : null}

            {isOwner && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.1}>
                <SubscribeCtaBanner
                  isSubscribed={isSubscribed}
                  className="rounded-3xl border border-[#EAEAEA] bg-white shadow-sm"
                />
              </motion.div>
            )}

            {demographics && demographicBreakdowns && (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.2}
                className={`${cardStyle} space-y-5`}
              >
                <div className="space-y-2 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">Quem é o público</p>
                  <h2 className="text-2xl font-bold text-gray-900">Audiência & demografia</h2>
                  <p className="text-sm leading-relaxed text-gray-600">{demographicSummary}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {demographicHighlights.map((item) => (
                    <div key={item.key} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFAFB]">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#1C1C1E]">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {topLocationBreakdown.length > 0 ? (
                  <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <MapPin className="h-4 w-4 text-[#D62E5E]" />
                      Principais cidades
                    </div>
                    <ul className="mt-3 space-y-2 text-xs text-gray-600">
                      {topLocationBreakdown.map((item: { label: string; percentage: number }) => (
                        <li key={item.label} className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{item.label}</span>
                          <span className="font-semibold text-gray-800">{Math.round(item.percentage)}%</span>
                        </li>
                      ))}
                    </ul>
                    {demographicBreakdowns.location.length > 3 ? (
                      <button
                        type="button"
                        className="mt-3 text-xs font-semibold text-[#D62E5E] underline underline-offset-2"
                        onClick={() => setCitiesModalOpen(true)}
                      >
                        Ver mais cidades ▸
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </motion.section>
            )}

            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0.3}
              className={`${cardStyle} space-y-6`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">Como ele performa</p>
                  <h2 className="text-2xl font-bold text-gray-900">Performance geral</h2>
                  <p className="text-sm text-gray-600">
                    Resumo dos {selectedPeriodLabel.toLocaleLowerCase('pt-BR')}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="comparisonPeriod"
                    className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Período
                  </label>
                  <select
                    id="comparisonPeriod"
                    value={comparisonPeriod}
                    onChange={(event) => setComparisonPeriod(normalizeComparisonPeriod(event.target.value))}
                    className="rounded-full border border-[#EAEAEA] bg-[#FAFAFB] px-4 py-2 text-xs font-semibold text-gray-700 focus:border-[#6E1F93] focus:outline-none"
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {kpiError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {kpiError}
                </div>
              )}

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <MetricSkeletonRow />
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-[#FAFAFB] p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {quickStats.map((metric) => (
                        <div key={metric.key} className="rounded-xl bg-white p-4 text-center shadow-sm">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#FFE7EC] text-[#D62E5E]">
                            {metric.icon}
                          </div>
                          <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {metric.label}
                          </span>
                          <p className="mt-1 text-xl font-semibold text-[#D62E5E]">
                            {formatQuickStatValue(metric.value, metric.type)}
                          </p>
                          <div className="mt-1 flex items-center justify-center">
                            <TrendIndicator value={metric.change} showValue={false} />
                          </div>
                          <p className="mt-1 text-xs text-gray-400">{metric.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-800">Médias por post</h3>
                      <div className="mt-3 space-y-2">
                        <AverageMetricRow
                          icon={<Eye className="h-4 w-4 text-[#6E1F93]" />}
                          label="Visualizações"
                          value={displayKpis?.avgViewsPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<Heart className="h-4 w-4 text-[#6E1F93]" />}
                          label="Curtidas"
                          value={displayKpis?.avgLikesPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<MessageSquare className="h-4 w-4 text-[#6E1F93]" />}
                          label="Comentários"
                          value={displayKpis?.avgCommentsPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<Share2 className="h-4 w-4 text-[#6E1F93]" />}
                          label="Compartilhamentos"
                          value={displayKpis?.avgSharesPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<Bookmark className="h-4 w-4 text-[#6E1F93]" />}
                          label="Salvos"
                          value={displayKpis?.avgSavesPerPost?.currentValue}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">Taxa de engajamento</h3>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className={`text-3xl font-bold ${engagementRateColor}`}>
                              {engagementRateDisplay}
                            </span>
                            <TrendIndicator value={displayKpis?.engagementRate?.percentageChange ?? null} />
                          </div>
                        </div>
                        <span className="rounded-full bg-[#FFF1F4] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#D62E5E]">
                          {selectedPeriodLabel}
                        </span>
                      </div>
                      <div className="mt-4 h-[70px] w-full overflow-hidden rounded-xl bg-[#FAFAFB]">
                        <SparklineChart values={engagementSparklineValues} />
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                        {engagementTrendNarrative}
                      </p>
                      <div className="mt-4 rounded-xl bg-[#FAFAFB] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Base atual</p>
                        <p className="mt-1 text-sm font-semibold text-[#1C1C1E]">{followerCountDisplay}</p>
                        <p className="text-[11px] text-gray-400">Seguidores totais no Instagram</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <p className="text-xs text-gray-500">
                Média dos {selectedPeriodLabel.toLocaleLowerCase('pt-BR')} via Data2Content AI.
              </p>
            </motion.section>

            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0.4}
              className={`${cardStyle} space-y-5`}
            >
              <div className="space-y-2 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">
                  Conteúdo real em destaque
                </p>
                <h2 className="text-2xl font-bold text-gray-900">Top posts</h2>
                <p className="text-sm text-gray-600">{topPostsIntro}</p>
              </div>

              {videosWithCorrectStats.length === 0 ? (
                <div className="space-y-3">
                  <Skeleton className="h-64 w-full rounded-3xl" />
                  <Skeleton className="h-64 w-full rounded-3xl" />
                </div>
              ) : (
                <div className="relative">
                  <p className="mb-3 text-xs font-medium text-gray-500">
                    Os conteúdos abaixo tiveram desempenho acima da média — ótimos para apresentar em propostas comerciais.
                  </p>
                  <div
                    ref={topPostsScrollRef}
                    onWheel={handleTopPostsWheel}
                    className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-6 sm:pr-8 lg:pr-12 ${
                      isTopPostsLocked ? 'opacity-60 blur-[1px]' : ''
                    }`}
                  >
                    {visibleTopPosts.map((video, index) => {
                      const captionPreview = truncateCaption(video.caption, 140) ?? 'Conteúdo em destaque';
                      const dateLabel = formatDateLabel(video.postDate);
                      const formatLabel = Array.isArray(video.format) ? video.format[0] : undefined;
                      const contextLabel = Array.isArray(video.context) ? video.context[0] : undefined;
                      const proposalLabel = Array.isArray(video.proposal) ? video.proposal[0] : undefined;
                      const toneLabel = Array.isArray(video.tone) ? video.tone[0] : undefined;
                      const formattedViews = formatMetricValue(
                        (video.stats?.views ?? (video.stats as any)?.reach ?? null) as number | null | undefined
                      );
                      const formattedLikes = formatMetricValue((video.stats as any)?.likes ?? (video.stats as any)?.like_count);
                      const formattedComments = formatMetricValue(video.stats?.comments);
                      const formattedShares = formatMetricValue((video.stats as any)?.shares ?? (video.stats as any)?.share_count);
                      const formattedSaves = formatMetricValue(video.stats?.saves);
                      const tagMeta = [
                        formatLabel ? { type: 'format' as const, value: formatLabel } : null,
                        contextLabel ? { type: 'context' as const, value: contextLabel } : null,
                        proposalLabel ? { type: 'proposal' as const, value: proposalLabel } : null,
                        toneLabel ? { type: 'tone' as const, value: toneLabel } : null,
                      ].filter(
                        (item): item is { type: 'format' | 'context' | 'proposal' | 'tone'; value: string } => Boolean(item)
                      );
                      type MetricItem = {
                        key: string;
                        main: string;
                        secondary: string;
                        arrangement: 'prefix' | 'postfix';
                        mainClass: string;
                        secondaryClass: string;
                      };
                      const metrics = [
                        formattedViews !== '—'
                          ? {
                              key: 'views',
                              main: formattedViews,
                              secondary: 'visualizações',
                              arrangement: 'postfix',
                              mainClass: 'text-base font-semibold text-[#D62E5E]',
                              secondaryClass: 'text-[12px] text-[#777777]',
                            }
                          : null,
                        formattedLikes !== '—'
                          ? {
                              key: 'likes',
                              main: formattedLikes,
                              secondary: 'curtidas',
                              arrangement: 'postfix',
                              mainClass: 'text-sm font-semibold text-[#555555]',
                              secondaryClass: 'text-[12px] text-[#777777]',
                            }
                          : null,
                        formattedComments !== '—'
                          ? {
                              key: 'comments',
                              main: formattedComments,
                              secondary: 'comentários',
                              arrangement: 'postfix',
                              mainClass: 'text-sm font-semibold text-[#555555]',
                              secondaryClass: 'text-[12px] text-[#777777]',
                            }
                          : null,
                        formattedShares !== '—'
                          ? {
                              key: 'shares',
                              main: formattedShares,
                              secondary: 'compartilhamentos',
                              arrangement: 'postfix',
                              mainClass: 'text-sm font-semibold text-[#555555]',
                              secondaryClass: 'text-[12px] text-[#777777]',
                            }
                          : null,
                        formattedSaves !== '—'
                          ? {
                              key: 'saves',
                              main: formattedSaves,
                              secondary: 'salvos',
                              arrangement: 'postfix',
                              mainClass: 'text-sm font-semibold text-[#555555]',
                              secondaryClass: 'text-[12px] text-[#777777]',
                            }
                          : null,
                        dateLabel
                          ? {
                              key: 'date',
                              main: dateLabel,
                              secondary: 'Publicado em',
                              arrangement: 'prefix',
                              mainClass: 'text-xs font-medium text-[#999999]',
                              secondaryClass: 'text-[12px] text-[#999999]',
                            }
                          : null,
                      ].filter(Boolean) as MetricItem[];

                      const isClickable = canViewCategories && !isTopPostsLocked;
                      return (
                        <article
                          key={video._id}
                          className={`relative flex w-[82%] flex-none snap-start flex-col overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-sm transition hover:shadow-md sm:w-[60%] md:w-[50%] lg:w-[360px] xl:w-[400px] 2xl:w-[440px] ${
                            isClickable ? 'cursor-pointer' : ''
                          }`}
                          role={isClickable ? 'button' : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={isClickable ? () => setSelectedPostId(video._id) : undefined}
                          onKeyDown={
                            isClickable
                              ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedPostId(video._id);
                                  }
                                }
                              : undefined
                          }
                        >
                          <div className="aspect-[1/1] w-full overflow-hidden rounded-lg bg-[#F4F4F6]">
                            {video.thumbnailUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={video.thumbnailUrl}
                                alt={captionPreview}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                                Sem prévia disponível
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex flex-1 flex-col gap-3 text-left">
                            {index === 0 && !isTopPostsLocked ? (
                              <span className="inline-block rounded-md bg-[#D62E5E] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                                Top 1
                              </span>
                            ) : null}
                            <p className="text-sm font-semibold text-[#1C1C1E] leading-snug line-clamp-2">{captionPreview}</p>
                            {tagMeta.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {tagMeta.map(({ type, value }) => {
                                  const styles = tagStyleMap[type];
                                  return (
                                    <span
                                      key={`${video._id}-${type}-${value}`}
                                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles.bgClass} ${styles.textClass}`}
                                    >
                                      {styles.labelPrefix}: {value}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                            {metrics.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {metrics.map(({ key, main, secondary, arrangement, mainClass, secondaryClass }) => (
                                  <div key={`${video._id}-${key}`} className="flex flex-wrap items-baseline gap-1">
                                    {arrangement === 'prefix' ? (
                                      <>
                                        <span className={secondaryClass}>{secondary}</span>
                                        <span className={mainClass}>{main}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className={mainClass}>{main}</span>
                                        <span className={secondaryClass}>{secondary}</span>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {video.permalink && (
                              <div className="mt-auto pt-5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-gray-500">Detalhes completos</span>
                                  <a
                                    href={video.permalink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#D62E5E] transition hover:underline"
                                  >
                                    Ver post
                                    <ArrowUpRight className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {isTopPostsLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white/90 px-6 text-center">
                      <Lock className="h-6 w-6 text-[#6E1F93]" />
                      <p className="mt-3 text-sm text-gray-700">
                        Veja o porquê desses posts performarem melhor destravando o modo PRO.
                      </p>
                      <button
                        type="button"
                        onClick={handleTopPostsCtaClick}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#D62E5E] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c12652]"
                      >
                        {categoryCtaLabel}
                      </button>
                      {categorySubtitle && <p className="mt-2 text-xs text-gray-500">{categorySubtitle}</p>}
                    </div>
                  )}
                  {!isTopPostsLocked && visibleTopPosts.length > 1 ? (
                    <div className="mt-3 flex justify-center gap-2">
                      {visibleTopPosts.map((video, index) => (
                        <span
                          key={`dot-${video._id}`}
                          className={`h-1.5 w-5 rounded-full ${index === 0 ? 'bg-[#D62E5E]' : 'bg-gray-300'}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </motion.section>

            {user?._id && !shouldHidePremiumSections && (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.5}
                className={`${cardStyle} space-y-5`}
              >
                {canViewPremiumSections ? (
                  <>
                    <div className="space-y-2 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">
                        Insights que reforçam o valor
                      </p>
                      <h2 className="text-2xl font-bold text-gray-900">Destaques & insights</h2>
                      <p className="text-sm text-gray-600">Arraste para descobrir os pontos fortes recentes.</p>
                    </div>
                    <PerformanceHighlightsCarousel userId={String(user._id)} />
                  </>
                ) : shouldLockPremiumSections ? (
                  <LockedPremiumSection
                    title="Destaques de performance disponíveis no modo PRO"
                    description={lockedHighlightsDescription}
                    ctaLabel={highlightCtaLabel}
                    subtitle={highlightSubtitle}
                    onAction={() => handleLockedCtaClick('media_kit_highlights')}
                    peek={<LockedHighlightsPeek />}
                  />
                ) : null}
              </motion.section>
            )}

            {user?._id && !shouldHidePremiumSections && (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.6}
                className={`${cardStyle} space-y-5`}
              >
                {canViewPremiumSections ? (
                  <>
                    <div className="space-y-2 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">
                        Comparativos rápidos
                      </p>
                      <h2 className="text-2xl font-bold text-gray-900">Rankings por categoria</h2>
                      <p className="text-sm text-gray-600">
                        Veja onde o criador se destaca em formatos, propostas e contextos.
                      </p>
                    </div>
                    <CategoryRankingsCarousel userId={String(user._id)} />
                  </>
                ) : shouldLockPremiumSections ? (
                  <LockedPremiumSection
                    title="Categorias disponíveis no modo PRO"
                    description={lockedCategoriesDescription}
                    ctaLabel={categoryCtaLabel}
                    subtitle={categorySubtitle}
                    showBadge={false}
                    onAction={() => handleLockedCtaClick('media_kit_categories')}
                    peek={<LockedCategoriesPeek />}
                  />
                ) : null}
              </motion.section>
            )}

            {showSharedBanner && (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.9}
                className="rounded-3xl bg-gradient-to-br from-[#6E1F93] via-[#9446B0] to-[#D62E5E] px-6 py-10 text-center text-white shadow-lg"
              >
                <Mail className="mx-auto h-10 w-10" />
                <h3 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Inteligência criativa para marcas que querem resultado.
                </h3>
                <p className="mt-3 text-sm text-white/80 sm:text-base">
                  Nós decodificamos o DNA da audiência de cada criador para construir campanhas que convertem.
                </p>
                <a
                  href="mailto:arthur@data2content.ai?subject=Desenho de Campanha Inteligente"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#6E1F93] shadow-sm transition hover:bg-white/90"
                >
                  Desenhar campanha inteligente
                </a>
              </motion.section>
            )}

            {isPublicView && mediaKitSlug ? (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.85}
                className={`${cardStyle} space-y-5`}
              >
                <div className="space-y-2 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">
                    Marcas
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900">Envie sua proposta</h2>
                  <p className="text-sm text-gray-600">
                    Preencha o briefing e fale direto com o criador. Você recebe resposta por e-mail ou WhatsApp.
                  </p>
                </div>
                <div className="space-y-4 rounded-2xl border border-[#E8DAFF] bg-white p-6 shadow-sm">
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <Send className="mt-0.5 h-4 w-4 text-[#6E1F93]" />
                      <span>Formulário inteligente com briefing completo para acelerar o retorno do criador.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 text-[#6E1F93]" />
                      <span>O criador recebe sua proposta em tempo real por e-mail e pela plataforma.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 text-[#6E1F93]" />
                      <span>Combine entregas, orçamento e cronograma em um único lugar.</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={openProposalDrawer}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D62E5E] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#c12652]"
                  >
                    💼 Enviar proposta para {affiliateHandleLabel}
                  </button>
                  <p className="text-xs text-gray-500">
                    Precisa de ajuda? Nossa equipe acompanha todas as propostas para garantir o melhor match.
                  </p>
                </div>
              </motion.section>
            ) : null}

            {isPublicView ? <div ref={stickyEndRef} className="h-px w-full" aria-hidden="true" /> : null}

            {isPublicView ? (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.9}
                className={`${cardStyle} space-y-4 bg-gradient-to-br from-[#F9F7FF] via-white to-[#FFF9F0]`}
              >
                <div className="flex flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">
                      Campanhas inteligentes
                    </p>
                    <h2 className="text-2xl font-bold text-gray-900">Planeje com vários criadores</h2>
                    <p className="text-sm text-gray-600">
                      Preencha um briefing único e deixe nossa IA indicar os melhores perfis para a sua campanha.
                    </p>
                  </div>
                  <Sparkles className="hidden h-10 w-10 text-[#D62E5E] sm:block" />
                </div>
                <div className="rounded-2xl border border-[#F0D9FF] bg-white/80 p-6 shadow-sm backdrop-blur">
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <Users className="mt-0.5 h-4 w-4 text-[#6E1F93]" />
                      <span>Combine criadores de moda, beleza, tech e mais em uma única estratégia.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 text-[#6E1F93]" />
                      <span>Defina orçamento total, prazos e entregáveis para campanhas completas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 text-[#6E1F93]" />
                      <span>Match automático com os criadores mais aderentes às suas metas.</span>
                    </li>
                  </ul>
                  <a
                    href={multiCampaignLink}
                    onClick={handleMultiCampaignCtaClick}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6E1F93] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#5a1a78]"
                  >
                    🎯 Criar campanha com vários criadores
                  </a>
                  <p className="mt-3 text-xs text-gray-500">
                    Deixe nossa IA encontrar os perfis ideais pra sua marca. Você recebe uma confirmação por e-mail.
                  </p>
                </div>
              </motion.section>
            ) : null}

            <footer className="mt-10 rounded-3xl border border-[#EAEAEA] bg-white px-6 py-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-[#1C1C1E]">
                Dados e análise por <span className="text-[#D62E5E]">Data2Content AI</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Atualizado automaticamente via Instagram API e inteligência proprietária.
              </p>
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#D62E5E] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Contatar para parceria
                </a>
              ) : null}
            </footer>
          </div>
        </div>

        <StickyCtaBar
          visible={stickyVisible}
          onProposalClick={handleStickyProposalClick}
          onAffiliateClick={handleStickyAffiliateClick}
          affiliateLink={affiliateLink}
          affiliateAvailable={Boolean(affiliateLink)}
          affiliateHandleLabel={affiliateHandleLabel}
        />

        {isProposalDrawerOpen ? (
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={proposalDrawerTitleId}
          >
            <div
              className="absolute inset-0"
              onClick={closeProposalDrawer}
              aria-hidden="true"
            />
            <div className="relative z-[201] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="flex items-start justify-between border-b border-[#F0F0F5] px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6E1F93]">Propostas</p>
                  <h3 id={proposalDrawerTitleId} className="text-xl font-bold text-[#1C1C1E]">
                    💼 Enviar proposta para {affiliateHandleLabel}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeProposalDrawer}
                  className="rounded-full p-2 text-gray-400 transition hover:text-gray-600"
                  aria-label="Fechar formulário de proposta"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto px-6 py-6 sm:px-8">
                <PublicProposalForm
                  mediaKitSlug={mediaKitSlug}
                  onSubmitSuccess={handleProposalSuccess}
                  utmContext={utm}
                />
              </div>
            </div>
          </div>
        ) : null}

        {isCitiesModalOpen && demographicBreakdowns?.location && (
          <div
            className="fixed inset-0 z-[200] bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cities-modal-title"
          >
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-4">
                  <h3 id="cities-modal-title" className="text-sm font-semibold text-gray-800">
                    Todas as cidades
                  </h3>
                  <button
                    className="rounded-full p-1.5 text-gray-400 transition hover:text-gray-600"
                    aria-label="Fechar"
                    onClick={() => setCitiesModalOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                  <div className="space-y-3">
                    {demographicBreakdowns.location.map((item: any) => (
                      <div key={item.label} className="text-sm font-medium text-gray-700">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{item.label}</span>
                          <span className="font-semibold text-gray-800">{Math.round(item.percentage)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[#F1F2F4]">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-[#D62E5E] to-[#6E1F93]"
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[#EAEAEA] px-5 py-3 text-right">
                  <button
                    className="inline-flex items-center rounded-full border border-[#EAEAEA] px-4 py-2 text-xs font-semibold text-gray-600 transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                    onClick={() => setCitiesModalOpen(false)}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <PostDetailModal
          isOpen={selectedPostId !== null}
          onClose={() => setSelectedPostId(null)}
          postId={selectedPostId}
          publicMode
        />
      </div>
    </GlobalTimePeriodProvider>
  );
}
