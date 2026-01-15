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
  Search,
  Download,
  Share2,
  Bookmark,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Lock,
  Send,
  Globe,
  Volume2,
  Trash2,
  Pencil,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/app/components/UserAvatar';
import AverageMetricRow from '@/app/dashboard/components/AverageMetricRow';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';
import { MediaKitViewProps, VideoListItem, MediaKitPricing, MediaKitPackage } from '@/types/mediakit';
import { useGlobalTimePeriod, GlobalTimePeriodProvider } from '@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext';
import { getCategoryById, commaSeparatedIdsToLabels } from '@/app/lib/classification';
import SubscribeCtaBanner from '@/app/mediakit/components/SubscribeCtaBanner';
import ButtonPrimary from '@/app/landing/components/ButtonPrimary';
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

const currencyFormatterBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const formatCurrencyLabel = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return currencyFormatterBRL.format(value);
};

const TOP_POSTS_MAX_ITEMS = 10;
const LOCKED_TOP_POSTS_PREVIEW_COUNT = 3;
const HERO_METRIC_ACCENTS: Record<string, string> = {
  followers: '#6E1F93',
  reach: '#1C4FD7',
  engagement: '#D62E5E',
  frequency: '#9446B0',
};
const landingSunriseBackground = '#FFFFFF';
const glassCardBaseClass = 'backdrop-blur-xl bg-white/70 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)]';
const highlightCardClass = 'rounded-[28px] border border-white/60 bg-white/95 shadow-[0_2px_10px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(15,23,42,0.16)]';
const chipHighlightClass = 'landing-chip text-brand-primary border-brand-primary/20 bg-white/80';
const textSecondaryClass = 'text-[#475569]';
const textMutedClass = 'text-slate-500';
const formLabelClass = 'text-xs font-semibold uppercase tracking-[0.2em] text-[#94A3B8]';
const formHelperTextClass = 'text-[11px] text-[#94A3B8]';
const formInputClass =
  'mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-sm text-[#0F172A] shadow-inner focus:border-[#6E1F93] focus:outline-none focus:ring-1 focus:ring-[#6E1F93]/30';

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
  pricing?: MediaKitPricing | null;
  onClearPricing?: () => void;
  packages?: MediaKitPackage[];
};

const PublicProposalForm = ({
  mediaKitSlug,
  onSubmitSuccess,
  onSubmitError,
  utmContext,
  pricing,
  onClearPricing,
  packages = [],
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

  // Helper to select a package
  const handleSelectPackage = (pkg: MediaKitPackage) => {
    setForm(prev => ({
      ...prev,
      deliverables: pkg.deliverables.join(', '),
      budget: pkg.price.toString(),
      currency: pkg.currency || 'BRL',
      campaignDescription: prev.campaignDescription ? prev.campaignDescription : `Interesse no pacote: ${pkg.name}`,
    }));
  };

  const pricingChips = useMemo(() => {
    if (!pricing) return [];
    const chips = [
      {
        key: 'justo',
        label: 'Valor Justo (Sugerido)',
        value: formatCurrencyLabel(pricing.justo),
        dot: 'bg-emerald-500',
        badgeClass: 'bg-emerald-50 text-emerald-700',
      },
      {
        key: 'estrategico',
        label: 'Estratégico (Mínimo)',
        value: formatCurrencyLabel(pricing.estrategico),
        dot: 'bg-blue-500',
        badgeClass: 'bg-blue-50 text-blue-700',
      },
      {
        key: 'premium',
        label: 'Premium (Alto Valor)',
        value: formatCurrencyLabel(pricing.premium),
        dot: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-700',
      },
    ];
    return chips.filter((chip) => Boolean(chip.value));
  }, [pricing]);

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
          <label htmlFor={`${formId}-brand`} className={formLabelClass}>
            Nome da marca*
          </label>
          <input
            id={`${formId}-brand`}
            required
            value={form.brandName}
            onChange={handleChange('brandName')}
            placeholder="Ex.: Natura"
            className={formInputClass}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className={formLabelClass}>
            E-mail comercial*
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            required
            value={form.contactEmail}
            onChange={handleChange('contactEmail')}
            placeholder="nome@empresa.com"
            className={formInputClass}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-whatsapp`} className={formLabelClass}>
            WhatsApp (opcional)
          </label>
          <input
            id={`${formId}-whatsapp`}
            value={form.contactWhatsapp}
            onChange={handleChange('contactWhatsapp')}
            placeholder="+55 11 90000-0000"
            className={formInputClass}
          />
        </div>

        {/* Packages Selection */}
        {packages.length > 0 ? (
          <div className="sm:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <p className={formLabelClass}>Investimento Sugerido (Pacotes)</p>
              {onClearPricing && (
                <button
                  type="button"
                  onClick={onClearPricing}
                  className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                  title="Remover valores do Mídia Kit"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <button
                  key={pkg._id || pkg.name}
                  type="button"
                  onClick={() => handleSelectPackage(pkg)}
                  className="group relative flex flex-col items-start gap-2 rounded-xl border border-white/60 bg-white/70 p-4 text-left shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#6E1F93]/50"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 line-clamp-1">{pkg.name}</span>
                    <div className="opacity-0 transition group-hover:opacity-100">
                      <span className="inline-flex items-center rounded-full bg-[#6E1F93]/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-[#6E1F93]">
                        Selecionar
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#6E1F93]">
                    {formatCurrencyLabel(pkg.price)}
                  </span>
                  {pkg.deliverables.length > 0 && (
                    <ul className="text-xs text-slate-500 list-disc list-inside">
                      {pkg.deliverables.slice(0, 2).map((d, i) => (
                        <li key={i} className="line-clamp-1">{d}</li>
                      ))}
                      {pkg.deliverables.length > 2 && <li>...</li>}
                    </ul>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : pricingChips.length ? (
          <div className="sm:col-span-2 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-inner relative group">
            <div className="flex items-center justify-between">
              <p className={formLabelClass}>Investimento Sugerido</p>
              {onClearPricing && (
                <button
                  type="button"
                  onClick={onClearPricing}
                  className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                  title="Remover valores do Mídia Kit"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {pricingChips.map((chip) => (
                <span
                  key={chip.key}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${chip.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${chip.dot}`} aria-hidden />
                  {chip.label}: {chip.value}
                </span>
              ))}
            </div>
            {pricing?.reach ? (
              <p className="mt-2 text-[11px] text-[#94A3B8]">
                Baseado no alcance médio de {pricing.reach.toLocaleString('pt-BR')} pessoas.
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label htmlFor={`${formId}-budget`} className={formLabelClass}>
            Orçamento disponível
          </label>
          <div className="mt-1 flex rounded-2xl border border-white/60 bg-white/70 shadow-inner focus-within:border-[#6E1F93] focus-within:ring-1 focus-within:ring-[#6E1F93]/30">
            <input
              id={`${formId}-budget`}
              value={form.budget}
              onChange={handleChange('budget')}
              placeholder="Ex.: 5000"
              className="w-full rounded-l-2xl border-r border-white/40 bg-transparent px-4 py-2 text-sm text-[#0F172A] focus:outline-none"
            />
            <input
              value={form.currency}
              onChange={handleChange('currency')}
              className="w-20 rounded-r-2xl bg-white/70 px-3 py-2 text-center text-sm font-semibold uppercase text-[#6E1F93] focus:outline-none"
            />
          </div>
          <p className={formHelperTextClass}>Informe números; moeda padrão BRL.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-title`} className={formLabelClass}>
            Título da campanha*
          </label>
          <input
            id={`${formId}-title`}
            required
            value={form.campaignTitle}
            onChange={handleChange('campaignTitle')}
            placeholder="Ex.: Lançamento coleção verão"
            className={formInputClass}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-deliverables`} className={formLabelClass}>
            Entregáveis desejados
          </label>
          <textarea
            id={`${formId}-deliverables`}
            value={form.deliverables}
            onChange={handleChange('deliverables')}
            placeholder="Stories, Reels, UGC..."
            rows={3}
            className={formInputClass}
          />
          <p className={formHelperTextClass}>Separe por vírgulas ou quebra de linha.</p>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-description`} className={formLabelClass}>
          Descrição / briefing
        </label>
        <textarea
          id={`${formId}-description`}
          value={form.campaignDescription}
          onChange={handleChange('campaignDescription')}
          placeholder="Compartilhe objetivos, público e principais mensagens da campanha."
          rows={4}
          className={formInputClass}
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
        className="inline-flex w-full justify-center rounded-full bg-[#6E1F93] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-[#5b1a7a] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {submitting ? 'Enviando...' : 'Enviar proposta'}
        <Send className="h-4 w-4" />
      </button>
      <p className={formHelperTextClass}>
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
  badgeLabel = "Modo Agência",
  showBadge = true,
  onAction,
  peek,
}: LockedPremiumSectionProps) => {
  const disabled = typeof onAction !== "function";

  return (
    <div className={`${glassCardBaseClass} space-y-4 p-6`}>
      {showBadge ? (
        <span className={`${chipHighlightClass} text-[0.62rem]`}>
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {badgeLabel}
        </span>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-[clamp(1.4rem,2vw,2rem)] font-bold text-[#0F172A]">{title}</h2>
        <p className={textSecondaryClass}>{description}</p>
      </div>
      <div>{peek}</div>
      <div>
        <button
          type="button"
          onClick={disabled ? undefined : () => onAction?.()}
          disabled={disabled}
          className="inline-flex w-full justify-center rounded-full bg-gradient-to-r from-[#6E1F93] to-[#FF2C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {ctaLabel}
          <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {subtitle ? <p className="text-xs text-[#94A3B8]">{subtitle}</p> : null}
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
    'group flex w-full flex-col items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold shadow-[0_16px_36px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const primaryButtonClasses =
    'bg-gradient-to-r from-[#6E1F93] to-[#FF2C7E] text-white focus-visible:outline-[#6E1F93]';
  const secondaryButtonClasses =
    'border border-white/50 bg-white/90 text-[#6E1F93] focus-visible:outline-[#6E1F93]';

  return (
    <div
      className={`sticky-cta-bar ${visible ? '' : 'sticky-cta-bar--hidden'}`}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => onProposalClick()}
          className={`${baseButtonClasses} ${primaryButtonClasses}`}
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
            className={`${baseButtonClasses} ${secondaryButtonClasses}`}
            rel="noopener noreferrer"
          >
            <span className="flex items-center gap-2 text-base">
              <span role="img" aria-hidden="true">
                🚀
              </span>
              Criar meu Mídia Kit
            </span>
            <span className="mt-1 text-xs font-medium text-[#6E1F93]">
              Comece agora com seu link afiliado
            </span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className={`${baseButtonClasses} cursor-not-allowed border border-white/40 bg-white/70 text-slate-500 shadow-none`}
          >
            <span className="flex items-center gap-2 text-base">
              <span role="img" aria-hidden="true">
                🚀
              </span>
              Criar meu Mídia Kit
            </span>
            <span className="mt-1 text-xs font-medium text-slate-500">
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
type CategoryKey = 'format' | 'proposal' | 'context' | 'tone' | 'references';

// Fallback robusto: tenta classification -> commaSeparatedIdsToLabels -> Title Case do id
const idToLabel = (id: string | number, type: CategoryKey) => {
  const rawId = String(id ?? '').trim();
  if (!rawId) return '—';

  // Tenta encontrar pelo ID exato
  try {
    const found = (getCategoryById as any)?.(rawId, type);
    if (found?.label) return String(found.label);
  } catch { }

  // Se tiver ponto (ex: lifestyle_and_wellbeing.food_culinary), tenta pelo último segmento
  if (rawId.includes('.')) {
    const parts = rawId.split('.');
    const lastPart = parts[parts.length - 1];
    try {
      const foundSub = (getCategoryById as any)?.(lastPart, type);
      if (foundSub?.label) return String(foundSub.label);
    } catch { }
  }

  try {
    const viaComma = (commaSeparatedIdsToLabels as any)?.(rawId, type);
    if (viaComma && String(viaComma).length > 0) return String(viaComma);
  } catch { }

  return rawId
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

type CategoryRankingsMap = {
  fp?: RankItem[];
  fa?: RankItem[];
  pp?: RankItem[];
  pa?: RankItem[];
  cp?: RankItem[];
  ca?: RankItem[];
  tp?: RankItem[];
  ta?: RankItem[];
  rp?: RankItem[];
  ra?: RankItem[];
} | null;
const categoryKeys: CategoryKey[] = ['format', 'proposal', 'context', 'tone', 'references'];
const categoryToAvgKey: Record<CategoryKey, keyof NonNullable<CategoryRankingsMap>> = {
  format: 'fa',
  proposal: 'pa',
  context: 'ca',
  tone: 'ta',
  references: 'ra',
};
const categoryToPostsKey: Record<CategoryKey, keyof NonNullable<CategoryRankingsMap>> = {
  format: 'fp',
  proposal: 'pp',
  context: 'cp',
  tone: 'tp',
  references: 'rp',
};
const hasCategoryRankingData = (data?: CategoryRankingsMap | null) =>
  Boolean(
    data &&
    ['fa', 'pa', 'ca', 'ta', 'ra'].some(
      (key) => Array.isArray((data as any)[key]) && (data as any)[key]?.length > 0
    )
  );

const useCategoryRankings = (userId?: string | null, enabled = true) => {
  const [state, setState] = useState<{
    data: CategoryRankingsMap;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!userId || !enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;
    const fetchAllRankings = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const fetchCategoryRanking = async (category: CategoryKey, metric: string) => {
        const qs = new URLSearchParams({ category, metric, startDate, endDate, limit: '5', userId });
        const res = await fetch(`/api/admin/dashboard/rankings/categories?${qs.toString()}`);
        if (!res.ok) return [];
        return res.json();
      };

      try {
        const [fp, fa, pp, pa, cp, ca, tp, ta, rp, ra] = await Promise.all([
          fetchCategoryRanking('format', 'posts'),
          fetchCategoryRanking('format', 'avg_total_interactions'),
          fetchCategoryRanking('proposal', 'posts'),
          fetchCategoryRanking('proposal', 'avg_total_interactions'),
          fetchCategoryRanking('context', 'posts'),
          fetchCategoryRanking('context', 'avg_total_interactions'),
          fetchCategoryRanking('tone', 'posts'),
          fetchCategoryRanking('tone', 'avg_total_interactions'),
          fetchCategoryRanking('references', 'posts'),
          fetchCategoryRanking('references', 'avg_total_interactions'),
        ]);
        if (!cancelled) {
          setState({ data: { fp, fa, pp, pa, cp, ca, tp, ta, rp, ra }, loading: false, error: null });
        }
      } catch (error) {
        console.error('Failed to fetch rankings', error);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error : new Error('Failed to fetch rankings'),
          }));
        }
      }
    };

    fetchAllRankings();
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return state;
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

const DeltaPill = ({
  value,
  label,
}: {
  value: number | null | undefined;
  label?: string;
}) => {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/50 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#475569]">
        Estável
        {label ? <span className={`ml-1 font-normal ${textMutedClass}`}>{label}</span> : null}
      </span>
    );
  }
  const isPositive = value >= 0;
  const sign = isPositive ? '+' : '−';
  const magnitude = Math.abs(value);
  const formatted = Number.isFinite(magnitude)
    ? `${sign}${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`
    : `${sign}∞`;
  const pillClass = isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pillClass}`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {formatted}
      {label ? <span className={`font-normal ${textMutedClass}`}>{label}</span> : null}
    </span>
  );
};


const SparklineChart = ({ values, color = '#6E1F93' }: { values: number[]; color?: string }) => {
  const gradientId = useId();
  if (!values || values.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] font-medium text-[#94A3B8]">
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

const DemographicBarList = ({
  data,
  maxItems = 4,
  accentClass = 'from-[#D62E5E] to-[#6E1F93]',
}: {
  data: Array<{ label: string; percentage: number }>;
  maxItems?: number;
  accentClass?: string;
}) => {
  if (!data?.length) return null;
  return (
    <div className="space-y-4">
      {data.slice(0, maxItems).map((item) => (
        <div key={`${item.label}-${item.percentage}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-900">{Math.round(item.percentage)}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${accentClass}`}
              style={{ width: `${Math.min(item.percentage, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

type InsightMetricCard = {
  key: string;
  title: string;
  icon: React.ReactNode;
  accent: string;
  value: string;
  helper?: string | null;
  change?: number | null | undefined;
};

type CategoryRankingsSummaryProps = {
  rankings: CategoryRankingsMap;
  loading: boolean;
  locked: boolean;
  lockedDescription: string;
  lockedCtaLabel: string;
  lockedSubtitle?: string;
  onLockedAction?: () => void;
  isPublicView?: boolean;
};

const CategoryRankingsSummary = ({
  rankings,
  loading,
  locked,
  lockedDescription,
  lockedCtaLabel,
  lockedSubtitle,
  onLockedAction,
  isPublicView,
}: CategoryRankingsSummaryProps) => {
  const summaryCards = [
    {
      key: 'format',
      title: 'Formato destaque',
      icon: <TrendingUp className="h-4 w-4" />,
      accent: '#6E1F93',
      item: rankings?.fa?.[0],
      type: 'format' as const,
      helper: 'Maior média de interações',
    },
    {
      key: 'proposal',
      title: 'Proposta forte',
      icon: <Sparkles className="h-4 w-4" />,
      accent: '#D62E5E',
      item: rankings?.pa?.[0],
      type: 'proposal' as const,
      helper: 'Maior média de interações',
    },
    {
      key: 'context',
      title: 'Contexto que engaja',
      icon: <MessageSquare className="h-4 w-4" />,
      accent: '#9446B0',
      item: rankings?.ca?.[0],
      type: 'context' as const,
      helper: 'Maior média de interações',
    },
    {
      key: 'tone',
      title: 'Tom em destaque',
      icon: <Volume2 className="h-4 w-4" />,
      accent: '#1C4FD7',
      item: rankings?.ta?.[0],
      type: 'tone' as const,
      helper: 'Maior média de interações',
    },
    {
      key: 'reference',
      title: 'Referência em alta',
      icon: <Bookmark className="h-4 w-4" />,
      accent: '#F97316',
      item: rankings?.ra?.[0],
      type: 'references' as const,
      helper: 'Maior média de interações',
    },
  ] as const;

  if (locked) {
    return (
      <div className="rounded-3xl border border-dashed border-[#F5D2E3] bg-[#FFF5F9]/50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1F4] text-[#D62E5E]">
          <Lock className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Modo Agência Bloqueado</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{lockedDescription}</p>
        <button
          type="button"
          onClick={() => onLockedAction?.()}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#D62E5E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c12652] hover:shadow-md"
        >
          {lockedCtaLabel}
          <ArrowUpRight className="h-4 w-4" />
        </button>
        {lockedSubtitle ? <p className="mt-3 text-xs text-slate-500">{lockedSubtitle}</p> : null}
      </div>
    );
  }

  const renderableCategoryCards = summaryCards
    .map((card) => {
      if (!card.item) return null;
      return {
        kind: 'category' as const,
        key: card.key,
        title: card.title,
        icon: card.icon,
        accent: card.accent,
        primary: idToLabel(card.item.category, card.type),
        secondary: `${card.helper}: ${new Intl.NumberFormat('pt-BR').format(card.item.value)}`,
      };
    })
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const hasData = renderableCategoryCards.length > 0;
  const skeletonCount = 3;
  const cardShellClass = `${highlightCardClass} flex flex-col justify-between p-5`;
  const titleClass = 'text-xs font-bold uppercase tracking-wider text-slate-500';
  const valueClass = 'mt-4 text-xl font-bold text-slate-900';
  const helperClass = 'mt-1 text-xs text-slate-500';

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isPublicView ? '' : 'lg:grid-cols-3'}`}>
      {loading
        ? Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={`insight-skeleton-${index}`}
            className="h-40 animate-pulse rounded-3xl bg-slate-100"
          />
        ))
        : hasData
          ? renderableCategoryCards.map((card) => (
            <div key={card.key} className={cardShellClass}>
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
                    style={{ color: card.accent }}
                  >
                    {card.icon}
                  </span>
                  <p className={titleClass}>{card.title}</p>
                </div>
                <p className={valueClass}>{card.primary}</p>
              </div>
              <p className={helperClass}>{card.secondary}</p>
            </div>
          ))
          : (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Não encontramos dados suficientes para destacar categorias neste período.
            </div>
          )}
    </div>
  );
};

const TopPostChip = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
    {label}
    <span className="text-xs font-bold">{value}</span>
  </span>
);

const genderLabelMap: { [key: string]: string } = { f: 'Feminino', m: 'Masculino', u: 'Desconhecido' };
type DemographicBreakdownEntry = { label: string; percentage: number };
type DemographicBreakdowns = {
  gender: DemographicBreakdownEntry[];
  age: DemographicBreakdownEntry[];
  location: DemographicBreakdownEntry[];
};
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
  showOwnerCtas = false,
  belowAffiliateSlot,
  compactPadding = false,
  publicUrlForCopy,
  mediaKitSlug,
  premiumAccess,
  pricing,
  onClearPricing,
  packages = [],
  pricingPublished = false,
  onTogglePricingPublish,
  onEditName,
}: MediaKitViewProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' } }),
  } as const;

  const isPublicView = !showOwnerCtas;
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

  const cardStyle = 'space-y-6';
  const innerCardStyle = 'space-y-6';
  const containerClass = isPublicView
    ? 'mx-auto w-full max-w-3xl px-4 py-8'
    : `dashboard-page-shell ${compactPadding ? 'py-6' : 'py-8'}`;
  const sectionsWrapperClass = 'flex flex-col space-y-10';
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
  const canDisplayPricing = Boolean(pricing && (!isPublicView || pricingPublished));
  const pricingCards = useMemo(() => {
    if (!canDisplayPricing || !pricing) return [];

    const calculateCpm = (val: number) => {
      if (!pricing.reach || pricing.reach <= 0) return 0;
      return (val / pricing.reach) * 1000;
    };

    const cards = [
      {
        key: 'estrategico',
        label: 'Estratégico (Mínimo)',
        value: formatCurrencyLabel(pricing.estrategico),
        cpm: formatCurrencyLabel(calculateCpm(pricing.estrategico)),
        badgeClass: 'bg-blue-50 text-blue-700',
        accentDot: 'bg-blue-500',
      },
      {
        key: 'justo',
        label: 'Valor Justo (Sugerido)',
        value: formatCurrencyLabel(pricing.justo),
        cpm: formatCurrencyLabel(calculateCpm(pricing.justo)),
        badgeClass: 'bg-emerald-50 text-emerald-700',
        accentDot: 'bg-emerald-500',
      },
      {
        key: 'premium',
        label: 'Premium (Alto Valor)',
        value: formatCurrencyLabel(pricing.premium),
        cpm: formatCurrencyLabel(calculateCpm(pricing.premium)),
        badgeClass: 'bg-amber-50 text-amber-700',
        accentDot: 'bg-amber-500',
      },
    ] as const;
    return cards.filter((card) => Boolean(card.value));
  }, [pricing, canDisplayPricing]);
  const pricingReachLabel = useMemo(() => {
    if (!canDisplayPricing) return null;
    if (typeof pricing?.reach === 'number' && Number.isFinite(pricing.reach) && pricing.reach > 0) {
      return `${pricing.reach.toLocaleString('pt-BR')} de alcance médio por post`;
    }
    return null;
  }, [pricing, canDisplayPricing]);
  const pricingUpdatedLabel = useMemo(() => {
    if (!canDisplayPricing) return null;
    if (!pricing?.createdAt) return null;
    const parsed = new Date(pricing.createdAt);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }, [pricing?.createdAt, canDisplayPricing]);
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
  const engagementRateColor = engagementRateValue !== null ? 'text-[#D62E5E]' : 'text-[#CBD2F5]';
  const followerCountDisplay =
    typeof user.followers_count === 'number' ? user.followers_count.toLocaleString('pt-BR') : '—';
  const followersCountRaw =
    (user as any)?.followers_count ??
    (user as any)?.followersCount ??
    (user as any)?.instagram?.followers_count ??
    (user as any)?.instagram?.followersCount ??
    (user as any)?.instagram?.followers ??
    null;
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
  const heroPeriodLabel = useMemo(() => selectedPeriodLabel.toLocaleLowerCase('pt-BR'), [selectedPeriodLabel]);
  const heroKpiCards = useMemo(() => {
    const followerGain = displayKpis?.followerGrowth?.currentValue ?? null;
    const followerGainLabel =
      typeof followerGain === 'number' && Number.isFinite(followerGain)
        ? `${followerGain > 0 ? '+' : ''}${followerGain.toLocaleString('pt-BR')} no período`
        : null;
    const postingFrequencyValue = displayKpis?.postingFrequency?.currentValue ?? null;
    const postingFrequencyLabel =
      typeof postingFrequencyValue === 'number' && Number.isFinite(postingFrequencyValue)
        ? `${postingFrequencyValue.toFixed(postingFrequencyValue % 1 === 0 ? 0 : 1)} posts/semana`
        : null;
    const totalFollowersValue = followersDisplay ?? followerCountDisplay ?? '—';
    return [
      {
        key: 'followers',
        icon: <Users className="h-5 w-5" />,
        label: 'Total de seguidores',
        value: totalFollowersValue,
        change: displayKpis?.followerGrowth?.percentageChange ?? null,
        helper: followerGainLabel,
      },
      avgReachDisplay
        ? {
          key: 'reach',
          icon: <Eye className="h-5 w-5" />,
          label: 'Alcance por post',
          value: avgReachDisplay,
          change: displayKpis?.avgReachPerPost?.percentageChange ?? displayKpis?.avgViewsPerPost?.percentageChange ?? null,
          helper: `Média dos ${heroPeriodLabel}`,
        }
        : null,
      engagementRateHeroDisplay
        ? {
          key: 'engagement',
          icon: <Heart className="h-5 w-5" />,
          label: 'Taxa de engajamento',
          value: engagementRateHeroDisplay,
          change: displayKpis?.engagementRate?.percentageChange ?? null,
          helper: `Média dos ${heroPeriodLabel}`,
        }
        : null,
      postingFrequencyLabel
        ? {
          key: 'frequency',
          icon: <CalendarDays className="h-5 w-5" />,
          label: 'Ritmo de publicação',
          value: postingFrequencyLabel,
          change: displayKpis?.postingFrequency?.percentageChange ?? null,
          helper: `vs ${heroPeriodLabel}`,
        }
        : null,
    ].filter(Boolean) as Array<{
      key: string;
      icon: React.ReactNode;
      label: string;
      value: string;
      change: number | null | undefined;
      helper?: string | null;
    }>;
  }, [
    avgReachDisplay,
    displayKpis?.avgReachPerPost?.percentageChange,
    displayKpis?.avgViewsPerPost?.percentageChange,
    displayKpis?.engagementRate?.percentageChange,
    displayKpis?.followerGrowth?.percentageChange,
    displayKpis?.followerGrowth?.currentValue,
    displayKpis?.postingFrequency?.currentValue,
    displayKpis?.postingFrequency?.percentageChange,
    engagementRateHeroDisplay,
    followersDisplay,
    followerCountDisplay,
    heroPeriodLabel,
  ]);
  const heroMetricCardsData = useMemo<InsightMetricCard[]>(
    () =>
      heroKpiCards.map((metric) => ({
        key: `metric-${metric.key}`,
        title: metric.label,
        icon: metric.icon,
        accent: HERO_METRIC_ACCENTS[metric.key] ?? '#6E1F93',
        value: metric.value,
        helper: metric.helper,
        change: metric.change,
      })),
    [heroKpiCards]
  );



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

  const visibilityMode = premiumAccess?.visibilityMode ?? 'lock';
  const canViewPremiumSections = premiumAccess?.canViewCategories ?? true;
  const canViewCategories = canViewPremiumSections;
  const shouldLockPremiumSections = !canViewPremiumSections && visibilityMode === 'lock';
  const shouldHidePremiumSections = !canViewPremiumSections && visibilityMode === 'hide';
  const lockedCtaLabel = premiumAccess?.ctaLabel ?? "Ver categorias do meu perfil (Assinar Plano Agência)";
  const lockedSubtitle = premiumAccess?.subtitle ?? PRO_PLAN_FLEXIBILITY_COPY;
  const categoryCtaLabel = premiumAccess?.categoryCtaLabel ?? lockedCtaLabel;
  const categorySubtitle = premiumAccess?.categorySubtitle ?? lockedSubtitle;
  const premiumTrialState = premiumAccess?.trialState ?? null;
  const lockedCategoriesDescription =
    premiumTrialState === "expired"
      ? "Seus dados ficaram congelados. Assine para continuar recebendo atualizações semanais."
      : "Ative o modo Agência para ver os formatos, propostas e contextos que mais puxam crescimento.";
  const lockedViewTrackedRef = useRef(false);
  const topPostsLockedViewTrackedRef = useRef(false);
  const topPostsScrollRef = useRef<HTMLDivElement | null>(null);
  const topPostsScrollTrackedRef = useRef(false);
  const [topPostsScrollIndicators, setTopPostsScrollIndicators] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [topPostsSort, setTopPostsSort] = useState<'views' | 'engagementRate' | 'saves'>('views');
  const topPostSortOptions = [
    { value: 'views', label: 'Visualizações' },
    { value: 'engagementRate', label: 'Taxa de engajamento' },
    { value: 'saves', label: 'Salvos' },
  ] as const;
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

  const demographicBreakdowns = useMemo<DemographicBreakdowns | null>(() => {
    if (!demographics?.follower_demographics) return null;
    const { gender, age, city } = demographics.follower_demographics;
    const calculatePercentages = (data: Record<string, number> | undefined): DemographicBreakdownEntry[] => {
      if (!data) return [];
      const total = Object.values(data).reduce((sum: number, count: number) => sum + count, 0);
      return Object.entries(data)
        .map(([label, count]) => ({ label, percentage: ((count as number) / total) * 100 }))
        .sort((a, b) => b.percentage - a.percentage);
    };
    return {
      gender: calculatePercentages(gender),
      age: calculatePercentages(age),
      location: calculatePercentages(city), // lista completa; exibimos top 3 no card
    };
  }, [demographics]);
  const fullGenderBreakdown = useMemo<DemographicBreakdownEntry[]>(
    () => demographicBreakdowns?.gender ?? [],
    [demographicBreakdowns]
  );
  const fullAgeBreakdown = useMemo<DemographicBreakdownEntry[]>(
    () => demographicBreakdowns?.age ?? [],
    [demographicBreakdowns]
  );
  const fullLocationBreakdown = useMemo<DemographicBreakdownEntry[]>(
    () => demographicBreakdowns?.location ?? [],
    [demographicBreakdowns]
  );
  const topGenderBreakdown = useMemo<DemographicBreakdownEntry[]>(
    () => fullGenderBreakdown.slice(0, 3),
    [fullGenderBreakdown]
  );
  const topAgeBreakdown = useMemo<DemographicBreakdownEntry[]>(
    () => fullAgeBreakdown.slice(0, 3),
    [fullAgeBreakdown]
  );
  const topLocationBreakdown = useMemo<DemographicBreakdownEntry[]>(
    () => fullLocationBreakdown.slice(0, 3),
    [fullLocationBreakdown]
  );
  const genderBarData = useMemo(
    () =>
      topGenderBreakdown.map((item) => ({
        label: genderLabelMap[item.label.toLowerCase()] || item.label,
        percentage: item.percentage,
      })),
    [topGenderBreakdown]
  );
  const ageBarData = useMemo(
    () =>
      topAgeBreakdown.map((item) => ({
        label: item.label,
        percentage: item.percentage,
      })),
    [topAgeBreakdown]
  );
  const hasMoreCities = fullLocationBreakdown.length > 3;
  const hasMoreGender = fullGenderBreakdown.length > topGenderBreakdown.length;
  const hasMoreAgeGroups = fullAgeBreakdown.length > topAgeBreakdown.length;
  const demographySourceCopy = 'Fonte: Instagram API + Data2Content';
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
  const fallbackCategoryRankings = useMemo<CategoryRankingsMap>(() => {
    if (!videosWithCorrectStats.length) return null;

    const aggregates: Record<CategoryKey, Map<string, { sum: number; count: number }>> = {
      format: new Map(),
      proposal: new Map(),
      context: new Map(),
      tone: new Map(),
      references: new Map(),
    };

    const toArray = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
          .filter(Boolean);
      }
      if (typeof value === 'string' && value.trim().length) return [value.trim()];
      return [];
    };

    const getScore = (video: VideoListItem) => {
      const derived = ((video as any)?.derivedStats ?? {}) as Record<string, unknown>;
      const stats = (video.stats ?? {}) as Record<string, unknown>;
      const interactionSum =
        (typeof stats.likes === 'number' ? stats.likes : 0) +
        (typeof stats.comments === 'number' ? stats.comments : 0) +
        (typeof stats.shares === 'number' ? stats.shares : 0) +
        (typeof stats.saves === 'number' ? stats.saves : 0);
      const candidates = [
        derived.interactions,
        derived.views,
        stats.views,
        stats.reach,
        interactionSum,
      ];
      const positive = candidates.find(
        (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
      );
      if (typeof positive === 'number') return positive;
      return 1;
    };

    videosWithCorrectStats.forEach((video) => {
      const baseScore = getScore(video);
      categoryKeys.forEach((type) => {
        const rawValues = (video as any)?.[type];
        const values = toArray(rawValues);
        if (!values.length) return;
        values.forEach((value) => {
          const existing = aggregates[type].get(value) ?? { sum: 0, count: 0 };
          existing.sum += baseScore;
          existing.count += 1;
          aggregates[type].set(value, existing);
        });
      });
    });

    const result: Record<string, RankItem[]> = {};
    categoryKeys.forEach((type) => {
      const map = aggregates[type];
      if (!map.size) return;
      const sorted = Array.from(map.entries())
        .map(([category, stats]) => ({
          category,
          value: stats.sum > 0 ? stats.sum : stats.count,
          posts: stats.count,
        }))
        .sort((a, b) => b.value - a.value || b.posts - a.posts);
      if (!sorted.length) return;
      result[categoryToAvgKey[type]] = sorted.map(({ category, value }) => ({
        category,
        value,
      }));
      result[categoryToPostsKey[type]] = sorted.map(({ category, posts }) => ({
        category,
        value: posts,
      }));
    });

    return Object.keys(result).length ? (result as CategoryRankingsMap) : null;
  }, [videosWithCorrectStats]);

  const categorySummaryViewedRef = useRef(false);
  const categoryRankingsEnabled =
    Boolean(user?._id) && !shouldHidePremiumSections && !shouldLockPremiumSections;
  const { data: categoryRankingsData, loading: categoryRankingsLoading } = useCategoryRankings(
    user?._id ? String(user._id) : null,
    categoryRankingsEnabled
  );
  const effectiveCategoryRankings = useMemo<CategoryRankingsMap>(() => {
    if (hasCategoryRankingData(categoryRankingsData)) return categoryRankingsData;
    if (hasCategoryRankingData(fallbackCategoryRankings)) return fallbackCategoryRankings;
    return categoryRankingsData ?? fallbackCategoryRankings;
  }, [categoryRankingsData, fallbackCategoryRankings]);
  const hasCategorySummaryData = useMemo(
    () => hasCategoryRankingData(effectiveCategoryRankings),
    [effectiveCategoryRankings]
  );
  const categoryRankingsLoadingState =
    categoryRankingsEnabled &&
    categoryRankingsLoading &&
    !hasCategoryRankingData(categoryRankingsData) &&
    !hasCategoryRankingData(fallbackCategoryRankings);

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

  const tryCopyShareUrl = useCallback(
    async (shareUrl: string): Promise<'clipboard' | 'execCommand' | null> => {
      // Tenta API moderna
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && typeof window !== 'undefined' && window.isSecureContext) {
          await navigator.clipboard.writeText(shareUrl);
          return 'clipboard';
        }
      } catch {
        // Continua para fallback
      }

      // Fallback compatível com Safari
      try {
        if (typeof document === 'undefined') return null;
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) return 'execCommand';
      } catch {
        // Ignora erros de fallback
      }
      return null;
    },
    []
  );

  const handleShareClick = useCallback(async () => {
    const shareUrl = publicUrlForCopy || (typeof window !== 'undefined' ? window.location.href : '');
    if (!shareUrl || typeof navigator === 'undefined') return;
    const creatorId = (user as any)?._id ? String((user as any)._id) : null;
    const mediaKitId =
      typeof mediaKitSlug === 'string' && mediaKitSlug.length > 0
        ? mediaKitSlug
        : (user as any)?.mediaKitSlug ?? null;
    const copyMethod = await tryCopyShareUrl(shareUrl);
    if (copyMethod) {
      setHasCopiedLink(true);
      if (copyFeedbackTimeout.current) clearTimeout(copyFeedbackTimeout.current);
      copyFeedbackTimeout.current = setTimeout(() => setHasCopiedLink(false), 2000);
      if (creatorId && mediaKitId) {
        track('copy_media_kit_link', {
          creator_id: creatorId,
          media_kit_id: mediaKitId,
          origin: copyMethod,
        });
      }
      return;
    }

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
      }
    } catch {
      // Se share falhar também, apenas silencie; UX mostra botão novamente
    }
  }, [mediaKitSlug, publicUrlForCopy, tryCopyShareUrl, user]);
  useEffect(
    () => () => {
      if (copyFeedbackTimeout.current) clearTimeout(copyFeedbackTimeout.current);
    },
    []
  );
  const isTopPostsLocked = !canViewCategories && visibilityMode === 'lock';
  const topPostsIntro = useMemo<string | null>(() => {
    if (isTopPostsLocked) {
      return 'Prévia dos posts mais recentes. Ative o modo Agência para destravar a análise completa.';
    }
    if (!canViewCategories && visibilityMode === 'hide') {
      return 'Os posts com melhor desempenho aparecem, mas as categorias detalhadas estão ocultas nesta visualização.';
    }
    return null;
  }, [isTopPostsLocked, canViewCategories, visibilityMode]);
  const decoratedTopPosts = useMemo(() => {
    if (!Array.isArray(videosWithCorrectStats)) return [];
    return videosWithCorrectStats.map((video, index) => {
      const stats = (video.stats ?? {}) as Record<string, any>;
      const likes = Number(stats.likes ?? stats.like_count ?? 0);
      const comments = Number(stats.comments ?? stats.comment_count ?? 0);
      const shares = Number(stats.shares ?? stats.share_count ?? 0);
      const saves = Number(stats.saves ?? stats.save_count ?? 0);
      const views = Number(
        stats.views ?? stats.view_count ?? stats.reach ?? stats.impressions ?? 0
      );
      const interactions = likes + comments + shares + saves;
      const engagementRate =
        views > 0 && Number.isFinite(interactions) ? (interactions / views) * 100 : null;
      return {
        ...video,
        derivedStats: {
          views,
          likes,
          comments,
          shares,
          saves,
          interactions,
          engagementRate,
        },
        originalIndex: index,
      };
    });
  }, [videosWithCorrectStats]);
  const topPostSortLabelMap: Record<'views' | 'engagementRate' | 'saves', string> = {
    views: 'visualizações',
    engagementRate: 'taxa de engajamento',
    saves: 'salvos',
  };
  const sortedTopPosts = useMemo(() => {
    const getter = (video: (typeof decoratedTopPosts)[number]) => {
      const derived = video.derivedStats ?? {};
      if (topPostsSort === 'engagementRate') return derived.engagementRate ?? -Infinity;
      if (topPostsSort === 'saves') return derived.saves ?? 0;
      return derived.views ?? 0;
    };
    return [...decoratedTopPosts].sort((a, b) => {
      const diff = (getter(b) ?? 0) - (getter(a) ?? 0);
      if (diff !== 0) return diff;
      return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
    });
  }, [decoratedTopPosts, topPostsSort]);
  const topPostsForCarousel = useMemo(() => {
    const maxItems = Math.min(TOP_POSTS_MAX_ITEMS, sortedTopPosts.length);
    return sortedTopPosts.slice(0, maxItems);
  }, [sortedTopPosts]);
  const visibleTopPosts = useMemo(
    () =>
      isTopPostsLocked
        ? topPostsForCarousel.slice(0, LOCKED_TOP_POSTS_PREVIEW_COUNT)
        : topPostsForCarousel,
    [isTopPostsLocked, topPostsForCarousel]
  );
  const groupedTopPosts = useMemo(() => {
    const groups: typeof visibleTopPosts[] = [];
    for (let i = 0; i < visibleTopPosts.length; i += 2) {
      groups.push(visibleTopPosts.slice(i, i + 2));
    }
    return groups;
  }, [visibleTopPosts]);
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
  const handleTopPostSortChange = useCallback(
    (value: typeof topPostSortOptions[number]['value']) => {
      if (value === topPostsSort) return;
      setTopPostsSort(value);
      track('media_kit_top_posts_sort_changed', {
        slug: mediaKitSlug ?? null,
        handle: affiliateHandle ?? null,
        sort: value,
      });
    },
    [affiliateHandle, mediaKitSlug, topPostsSort]
  );
  const handleTopPostsBriefingClick = useCallback(() => {
    track('media_kit_top_posts_briefing_clicked', {
      slug: mediaKitSlug ?? null,
      handle: affiliateHandle ?? null,
      sort: topPostsSort,
    });
  }, [affiliateHandle, mediaKitSlug, topPostsSort]);
  useEffect(() => {
    const container = topPostsScrollRef.current;
    if (!container) return;
    const updateScrollState = () => {
      const canScrollLeft = container.scrollLeft > 8;
      const canScrollRight = container.scrollWidth - container.clientWidth - container.scrollLeft > 8;
      setTopPostsScrollIndicators({ canScrollLeft, canScrollRight });
      if (!topPostsScrollTrackedRef.current && canScrollLeft) {
        track('media_kit_top_posts_scrolled', {
          slug: mediaKitSlug ?? null,
          handle: affiliateHandle ?? null,
        });
        topPostsScrollTrackedRef.current = true;
      }
    };
    updateScrollState();
    container.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      container.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [affiliateHandle, mediaKitSlug, visibleTopPosts]);
  const instagramProfileUrl = useMemo(() => {
    if (!affiliateHandle) return null;
    const normalizedHandle = affiliateHandle.replace(/^@+/, '').trim();
    if (!normalizedHandle) return null;
    return `https://www.instagram.com/${normalizedHandle}`;
  }, [affiliateHandle]);
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
  const [isGenderModalOpen, setGenderModalOpen] = useState(false);
  const [isAgeModalOpen, setAgeModalOpen] = useState(false);
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
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const lastScrollYRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScrollDirection = () => {
      const currentY = window.scrollY || 0;
      const lastY = lastScrollYRef.current;
      const delta = currentY - lastY;
      if (delta < -5 && !isScrollingUp) {
        setIsScrollingUp(true);
      } else if (delta > 5 && isScrollingUp) {
        setIsScrollingUp(false);
      }
      lastScrollYRef.current = currentY;
    };
    window.addEventListener('scroll', handleScrollDirection, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollDirection);
  }, [isScrollingUp]);
  const stickyEligible = Boolean(isPublicView && mediaKitSlug) && !isCitiesModalOpen && selectedPostId === null;
  const stickyVisible =
    stickyEligible &&
    hasPassedStickyStart &&
    !isStickyEndVisible &&
    !isProposalDrawerOpen &&
    isScrollingUp;
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
  const handlePricingPublishChange = useCallback(
    (nextPublished: boolean) => {
      onTogglePricingPublish?.(nextPublished);
    },
    [onTogglePricingPublish],
  );
  useEffect(() => {
    if (shouldHidePremiumSections || shouldLockPremiumSections) return;
    if (!hasCategorySummaryData) return;
    if (categorySummaryViewedRef.current) return;
    track('media_kit_category_summary_viewed', {
      slug: mediaKitSlug ?? null,
      handle: affiliateHandle ?? null,
      affiliateCode: affiliateCode ?? null,
    });
    categorySummaryViewedRef.current = true;
  }, [
    affiliateCode,
    affiliateHandle,
    hasCategorySummaryData,
    mediaKitSlug,
    shouldHidePremiumSections,
    shouldLockPremiumSections,
  ]);

  return (
    <GlobalTimePeriodProvider>
      <div
        id="media-kit-content"
        className="min-h-screen font-sans text-[#0F172A]"
        style={{ background: landingSunriseBackground }}
      >
        <div className={mainContainerClass}>
          <div className={sectionsWrapperClass}>
            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              className="flex flex-col items-center text-center sm:items-start sm:text-left"
            >
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
                <div className="relative">
                  <div className="rounded-full bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5">
                    <UserAvatar name={user.name || 'Criador'} src={user.profile_picture_url} size={160} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 drop-shadow-[0_6px_20px_rgba(12,12,16,0.12)] sm:text-5xl">
                      {user.name || 'Criador'}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                      {affiliateHandleLabel && (
                        <a
                          href={instagramProfileUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lg font-medium text-slate-600 transition hover:text-[#6E1F93]"
                        >
                          {affiliateHandleLabel}
                        </a>
                      )}

                      {heroLocationLabel && (
                        <>
                          <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
                          <span className="text-sm font-medium text-slate-500">
                            {heroLocationLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {heroBio && (
                    <p className="max-w-2xl text-lg leading-relaxed text-slate-700">
                      {heroBio}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2 sm:justify-start">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      <Sparkles className="h-3.5 w-3.5 text-[#6E1F93]" />
                      Parceiro Data2Content
                    </span>
                    {heroDescriptor && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                        {heroDescriptor}
                      </span>
                    )}
                  </div>
                  <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <ButtonPrimary
                      onClick={handleShareClick}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center rounded-full border-slate-200 px-4 py-2 shadow-sm hover:bg-slate-50 sm:w-auto"
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Compartilhar
                    </ButtonPrimary>
                    <ButtonPrimary
                      onClick={async () => {
                        const element = document.getElementById('media-kit-content');
                        if (!element) return;

                        const canvas = await html2canvas(element, {
                          scale: 2,
                          useCORS: true,
                          logging: false,
                          windowWidth: element.scrollWidth,
                          windowHeight: element.scrollHeight,
                        });

                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF({
                          orientation: 'p',
                          unit: 'px',
                          format: [canvas.width, canvas.height],
                        });

                        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                        pdf.save(`media-kit-${mediaKitSlug || 'export'}.pdf`);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center rounded-full border-slate-200 px-4 py-2 shadow-sm hover:bg-slate-50 sm:w-auto"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Salvar PDF
                    </ButtonPrimary>
                    {onEditName && showOwnerCtas && (
                      <ButtonPrimary
                        onClick={onEditName}
                        variant="outline"
                        size="sm"
                        className="w-full justify-center rounded-full border-slate-200 px-4 py-2 shadow-sm hover:bg-slate-50 sm:w-auto"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar nome
                      </ButtonPrimary>
                    )}
                    {hasCopiedLink && (
                      <span className="animate-fade-in ml-3 flex items-center text-xs font-medium text-emerald-600">
                        Link copiado!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Hero Metrics Grid */}
            {heroMetricCardsData.length > 0 && (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.1}
                className="mt-12 grid grid-cols-2 gap-4"
              >
                {heroMetricCardsData.map((metric) => (
                  <div
                    key={metric.key}
                    className={`${highlightCardClass} flex flex-col p-5`}
                    style={{ borderLeftColor: `${metric.accent}40`, borderLeftWidth: '1px' }}
                  >
                    <div className="mb-4 flex items-center gap-3 text-slate-500">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-[#6E1F93]">
                        {metric.icon}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">{metric.title}</span>
                    </div>
                    <div className="mt-auto">
                      <span className="block text-2xl font-bold leading-tight text-slate-900 break-words">{metric.value}</span>
                      {metric.change !== undefined && metric.change !== null && (
                        <div className="mt-2">
                          <DeltaPill value={metric.change} />
                        </div>
                      )}
                      {metric.helper && (
                        <p className="mt-2 text-xs text-slate-400">{metric.helper}</p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.section>
            )}

            {/* Pricing Section - Shows EITHER Packages OR Calculated Cards */}
            {(packages && packages.length > 0) ? (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.15}
                className="mt-10 space-y-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <h2 className="text-2xl font-bold text-slate-900">Investimento sugerido</h2>
                      {showOwnerCtas && onClearPricing && (
                        <button
                          type="button"
                          onClick={onClearPricing}
                          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                          title="Remover valores do Mídia Kit"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir valores
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      Pacotes especiais para sua marca.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {packages.map((pkg) => (
                    <div key={pkg._id || pkg.name} className={`${highlightCardClass} flex flex-col p-6`}>
                      <div className="mb-4">
                        <div className="flex items-start justify-between">
                          <h3 className="text-xl font-bold text-slate-900">{pkg.name}</h3>
                          {pkg.type === 'ai_generated' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                              <Sparkles className="h-3 w-3" />
                              IA
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-3xl font-bold text-[#6E1F93]">
                          {formatCurrencyLabel(pkg.price)}
                        </p>
                      </div>

                      <div className="flex-1 space-y-4">
                        {pkg.deliverables.length > 0 && (
                          <ul className="space-y-2">
                            {pkg.deliverables.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6E1F93]/40" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                        {pkg.description && (
                          <p className="border-t border-slate-100 pt-3 text-sm text-slate-500">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : pricingCards.length > 0 && (
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.15}
                className="mt-10 space-y-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <h2 className="text-2xl font-bold text-slate-900">Investimento sugerido</h2>
                      {showOwnerCtas && onClearPricing && (
                        <button
                          type="button"
                          onClick={onClearPricing}
                          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                          title="Remover valores do Mídia Kit"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir valores
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      Valores de referência calculados pela IA para propostas rápidas.
                    </p>
                    {pricingReachLabel ? (
                      <p className="text-xs text-slate-500">{pricingReachLabel}</p>
                    ) : null}
                    {showOwnerCtas ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${pricingPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {pricingPublished ? 'Publicado no Mídia Kit público' : 'Oculto no Mídia Kit público'}
                        </span>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-[#6E1F93] focus:ring-[#6E1F93]"
                            checked={pricingPublished}
                            onChange={(event) => handlePricingPublishChange(event.target.checked)}
                            disabled={!onTogglePricingPublish}
                          />
                          <span>{pricingPublished ? 'Não exibir no público' : 'Exibir no Mídia Kit público'}</span>
                        </label>
                      </div>
                    ) : null}
                  </div>
                  {pricingUpdatedLabel ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-white/60">
                      Atualizado {pricingUpdatedLabel}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {pricingCards.map((card) => (
                    <div key={card.key} className={`${highlightCardClass} flex flex-col justify-between p-5`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${card.badgeClass}`}>
                          <span className={`h-2 w-2 rounded-full ${card.accentDot}`} aria-hidden />
                          {card.label}
                        </span>
                        {card.cpm ? (
                          <span className="text-xs font-semibold text-slate-500">
                            CPM aprox. {card.cpm}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-3xl font-bold text-slate-900 leading-tight">{card.value}</p>
                      </div>
                      {/* ... legacy cards ... */}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {(user?._id && !shouldHidePremiumSections) ? (
              <div className="pt-12">
                <motion.section
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={0.2}
                  className="space-y-6"
                >
                  <div className="flex items-end justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Destaques Estratégicos</h2>
                      <p className="mt-1 text-slate-500">{categorySubtitle}</p>
                    </div>
                  </div>

                  <CategoryRankingsSummary
                    rankings={effectiveCategoryRankings}
                    loading={categoryRankingsLoadingState}
                    locked={shouldLockPremiumSections}
                    lockedDescription={lockedCategoriesDescription}
                    lockedCtaLabel={categoryCtaLabel}
                    lockedSubtitle={lockedSubtitle}
                    onLockedAction={() => handleLockedCtaClick('media_kit_categories_summary')}
                    isPublicView={isPublicView}
                  />
                </motion.section>
              </div>
            ) : null}

            {isPublicView ? (
              <div ref={stickyStartRef} className="absolute h-px w-px opacity-0 pointer-events-none" aria-hidden="true" />
            ) : null}

            {isOwner && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.1}>
                <SubscribeCtaBanner
                  isSubscribed={isSubscribed}
                  className={`${glassCardBaseClass} p-6`}
                />
              </motion.div>
            )}

            {demographics && demographicBreakdowns && (
              <div className="pt-12">
                <motion.section
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={0.2}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Audiência & Demografia</h2>
                    <p className="mt-1 text-slate-500">{demographicSummary}</p>
                  </div>

                  <div className={`grid gap-6 sm:grid-cols-2 ${isPublicView ? '' : 'lg:grid-cols-3'}`}>
                    {genderBarData.length ? (
                      <div className={`${highlightCardClass} p-6`}>
                        <div className="mb-6 flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <Users className="h-5 w-5 text-[#D62E5E]" />
                            Gênero
                          </div>
                        </div>
                        <DemographicBarList data={genderBarData} maxItems={3} accentClass="from-[#D62E5E] to-[#F97316]" />
                        {hasMoreGender && (
                          <button
                            type="button"
                            className="mt-6 text-sm font-medium text-[#D62E5E] hover:underline"
                            onClick={() => setGenderModalOpen(true)}
                          >
                            Ver todos
                          </button>
                        )}
                      </div>
                    ) : null}

                    {ageBarData.length ? (
                      <div className={`${highlightCardClass} p-6`}>
                        <div className="mb-6 flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <CalendarDays className="h-5 w-5 text-[#6E1F93]" />
                            Idade
                          </div>
                        </div>
                        <DemographicBarList data={ageBarData} maxItems={4} accentClass="from-[#6E1F93] to-[#D62E5E]" />
                        {hasMoreAgeGroups && (
                          <button
                            type="button"
                            className="mt-6 text-sm font-medium text-[#6E1F93] hover:underline"
                            onClick={() => setAgeModalOpen(true)}
                          >
                            Ver todas
                          </button>
                        )}
                      </div>
                    ) : null}

                    {topLocationBreakdown.length ? (
                      <div className={`${highlightCardClass} p-6`}>
                        <div className="mb-6 flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <MapPin className="h-5 w-5 text-[#D62E5E]" />
                            Localização
                          </div>
                        </div>
                        <DemographicBarList data={topLocationBreakdown} maxItems={3} accentClass="from-[#D62E5E] to-[#6E1F93]" />
                        {hasMoreCities && (
                          <button
                            type="button"
                            className="mt-6 text-sm font-medium text-[#D62E5E] hover:underline"
                            onClick={() => setCitiesModalOpen(true)}
                          >
                            Ver todas
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Globe className="h-3.5 w-3.5" />
                    {demographySourceCopy}
                  </div>
                </motion.section>
              </div>
            )}

            <div className="pt-12">
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.3}
                className="space-y-8"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Performance Geral</h2>
                    <p className="mt-1 text-slate-500">Resumo dos {selectedPeriodLabel.toLocaleLowerCase('pt-BR')}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      id="comparisonPeriod"
                      value={comparisonPeriod}
                      onChange={(event) => setComparisonPeriod(normalizeComparisonPeriod(event.target.value))}
                      className="cursor-pointer rounded-full border-0 bg-slate-100 py-2 pl-4 pr-10 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#6E1F93]"
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
                  <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
                    {kpiError}
                  </div>
                )}

                {isLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Skeleton className="h-64 w-full rounded-3xl" />
                    <Skeleton className="h-64 w-full rounded-3xl" />
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className={`${highlightCardClass} p-8`}>
                      <h3 className="mb-6 text-lg font-bold text-slate-900">Médias por post</h3>
                      <div className="space-y-4">
                        <AverageMetricRow
                          icon={<Eye className="h-5 w-5 text-slate-400" />}
                          label="Visualizações"
                          value={displayKpis?.avgViewsPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<Heart className="h-5 w-5 text-slate-400" />}
                          label="Curtidas"
                          value={displayKpis?.avgLikesPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<MessageSquare className="h-5 w-5 text-slate-400" />}
                          label="Comentários"
                          value={displayKpis?.avgCommentsPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<Share2 className="h-5 w-5 text-slate-400" />}
                          label="Compartilhamentos"
                          value={displayKpis?.avgSharesPerPost?.currentValue}
                        />
                        <AverageMetricRow
                          icon={<Bookmark className="h-5 w-5 text-slate-400" />}
                          label="Salvos"
                          value={displayKpis?.avgSavesPerPost?.currentValue}
                        />
                      </div>
                    </div>

                    <div className={`${highlightCardClass} p-8`}>
                      <div className="mb-6 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Taxa de engajamento</h3>
                          <div className="mt-2 flex items-baseline gap-3">
                            <span className={`text-4xl font-bold ${engagementRateColor}`}>
                              {engagementRateDisplay}
                            </span>
                            <TrendIndicator value={displayKpis?.engagementRate?.percentageChange ?? null} />
                          </div>
                        </div>
                      </div>

                      <div className="h-64 w-full overflow-hidden rounded-2xl bg-white pt-4 pr-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={engagementSparklineData} margin={{ top: 5, right: 0, left: -24, bottom: 0 }}>
                            <defs>
                              <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6E1F93" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6E1F93" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: '#94a3b8', fontSize: 11 }}
                              tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: '#94a3b8', fontSize: 11 }}
                              tickFormatter={(val) => `${val.toFixed(1)}%`}
                            />
                            <Tooltip
                              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Engajamento']}
                              labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                            />
                            <Area
                              type="monotone"
                              dataKey="rate"
                              stroke="#6E1F93"
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#engagementGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <p className="mt-4 text-sm text-slate-500">
                        {engagementTrendNarrative}
                      </p>
                    </div>
                  </div>
                )}
              </motion.section>
            </div>

            <div className="pt-12 pb-20">
              <motion.section
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0.4}
                className="space-y-8"
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Conteúdo em Destaque</h2>
                    <p className="mt-1 text-slate-500">
                      {topPostsIntro || `Top posts dos ${selectedPeriodLabel.toLocaleLowerCase('pt-BR')}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                    {topPostSortOptions.map((option) => {
                      const isActive = topPostsSort === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleTopPostSortChange(option.value)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${isActive
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {videosWithCorrectStats.length === 0 ? (
                  <div className={`grid gap-6 sm:grid-cols-2 ${isPublicView ? '' : 'lg:grid-cols-4'}`}>
                    <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
                    <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
                    <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
                    <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="overflow-hidden p-0">
                      <div
                        ref={topPostsScrollRef}
                        onWheel={handleTopPostsWheel}
                        className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-6 sm:pr-8 lg:pr-12 transition ${isTopPostsLocked ? 'opacity-60 blur-[1px]' : ''
                          }`}
                      >
                        {groupedTopPosts.map((group, groupIndex) => (
                          <div
                            key={`top-post-group-${groupIndex}`}
                            className={`flex min-w-[65%] flex-none snap-start gap-2 sm:min-w-[45%] ${isPublicView ? '' : 'lg:min-w-[35%]'}`}
                          >
                            {group.map((video, groupOffset) => {
                              const index = groupIndex * 2 + groupOffset;
                              const captionPreview = truncateCaption(video.caption, 140) ?? 'Conteúdo em destaque';
                              const dateLabel = formatDateLabel(video.postDate);
                              const formattedViews = formatMetricValue(
                                (video.stats?.views ?? (video.stats as any)?.reach ?? null) as number | null | undefined
                              );
                              const formattedLikes = formatMetricValue((video.stats as any)?.likes ?? (video.stats as any)?.like_count);
                              const formattedComments = formatMetricValue(video.stats?.comments);
                              const formattedShares = formatMetricValue((video.stats as any)?.shares ?? (video.stats as any)?.share_count);
                              const formattedSaves = formatMetricValue(video.stats?.saves);
                              const derivedStats = (video as any).derivedStats ?? {};
                              const highlightViews =
                                typeof derivedStats.views === 'number' && derivedStats.views > 0
                                  ? formatMetricValue(derivedStats.views)
                                  : null;
                              const highlightSaves =
                                typeof derivedStats.saves === 'number' && derivedStats.saves > 0
                                  ? formatMetricValue(derivedStats.saves)
                                  : null;
                              const highlightEr =
                                typeof derivedStats.engagementRate === 'number' && Number.isFinite(derivedStats.engagementRate)
                                  ? `${derivedStats.engagementRate >= 10 ? derivedStats.engagementRate.toFixed(1) : derivedStats.engagementRate.toFixed(2)}%`
                                  : null;
                              const normalizeTagValues = (input: unknown): string[] => {
                                const result: string[] = [];
                                const pushValue = (value: unknown) => {
                                  if (value == null) return;
                                  if (Array.isArray(value)) {
                                    value.forEach(pushValue);
                                    return;
                                  }
                                  if (typeof value === 'string') {
                                    const trimmed = value.trim();
                                    if (trimmed) result.push(trimmed);
                                    return;
                                  }
                                  if (typeof value === 'number' || typeof value === 'boolean') {
                                    result.push(String(value));
                                  }
                                };
                                pushValue(input);
                                return result;
                              };

                              const buildTagEntries = <T extends 'format' | 'context' | 'proposal' | 'tone' | 'references'>(
                                value: unknown,
                                type: T
                              ) => normalizeTagValues(value).map((v) => ({ type, value: v }));

                              const tagMetaRaw = [
                                ...buildTagEntries(video.format, 'format'),
                                ...buildTagEntries(video.context, 'context'),
                                ...buildTagEntries(video.proposal, 'proposal'),
                                ...buildTagEntries(video.tone, 'tone'),
                                ...buildTagEntries(video.references, 'references'),
                              ];

                              const tagMeta = tagMetaRaw.reduce(
                                (acc, entry) => {
                                  const key = `${entry.type}-${entry.value}`;
                                  if (!acc.seen.has(key)) {
                                    acc.seen.add(key);
                                    acc.list.push(entry);
                                  }
                                  return acc;
                                },
                                { seen: new Set<string>(), list: [] as { type: 'format' | 'context' | 'proposal' | 'tone' | 'references'; value: string }[] }
                              ).list;
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
                                    mainClass: 'text-base font-semibold text-[#0F172A]',
                                    secondaryClass: `text-xs ${textMutedClass}`,
                                  }
                                  : null,
                                formattedLikes !== '—'
                                  ? {
                                    key: 'likes',
                                    main: formattedLikes,
                                    secondary: 'curtidas',
                                    arrangement: 'postfix',
                                    mainClass: 'text-sm font-semibold text-[#475569]',
                                    secondaryClass: `text-xs ${textMutedClass}`,
                                  }
                                  : null,
                                formattedComments !== '—'
                                  ? {
                                    key: 'comments',
                                    main: formattedComments,
                                    secondary: 'comentários',
                                    arrangement: 'postfix',
                                    mainClass: 'text-sm font-semibold text-[#475569]',
                                    secondaryClass: `text-xs ${textMutedClass}`,
                                  }
                                  : null,
                                formattedShares !== '—'
                                  ? {
                                    key: 'shares',
                                    main: formattedShares,
                                    secondary: 'compartilhamentos',
                                    arrangement: 'postfix',
                                    mainClass: 'text-sm font-semibold text-[#475569]',
                                    secondaryClass: `text-xs ${textMutedClass}`,
                                  }
                                  : null,
                                formattedSaves !== '—'
                                  ? {
                                    key: 'saves',
                                    main: formattedSaves,
                                    secondary: 'salvos',
                                    arrangement: 'postfix',
                                    mainClass: 'text-sm font-semibold text-[#475569]',
                                    secondaryClass: `text-xs ${textMutedClass}`,
                                  }
                                  : null,
                                dateLabel
                                  ? {
                                    key: 'date',
                                    main: dateLabel,
                                    secondary: 'Publicado em',
                                    arrangement: 'prefix',
                                    mainClass: `text-xs font-medium ${textMutedClass}`,
                                    secondaryClass: 'text-[11px] text-[#CBD5F5]',
                                  }
                                  : null,
                              ].filter(Boolean) as MetricItem[];
                              const primaryMetric =
                                metrics.find((metric) => metric.key === 'views') ??
                                metrics.find((metric) => metric.key !== 'date');
                              const supportingMetrics = metrics.filter(
                                (metric) => metric !== primaryMetric && metric.key !== 'date'
                              );
                              const primaryMetricLabel = primaryMetric?.secondary ?? 'Desempenho';
                              const formattedInteractions =
                                typeof derivedStats.interactions === 'number' && derivedStats.interactions > 0
                                  ? formatMetricValue(derivedStats.interactions)
                                  : null;
                              const summaryMetrics = [
                                primaryMetric ? { ...primaryMetric, secondary: primaryMetricLabel } : null,
                                highlightEr
                                  ? {
                                    key: 'engagementRate',
                                    main: highlightEr,
                                    secondary: 'Taxa de engajamento',
                                    arrangement: 'postfix',
                                    mainClass: 'text-sm font-semibold text-[#0F172A]',
                                    secondaryClass: `text-[11px] ${textMutedClass}`,
                                  }
                                  : null,
                              ].filter((item): item is MetricItem => Boolean(item));
                              const interactionsSummaryMetric = formattedInteractions
                                ? {
                                  key: 'interactions',
                                  main: formattedInteractions,
                                  secondary: 'Interações',
                                  arrangement: 'postfix',
                                  mainClass: 'text-sm font-semibold text-[#0F172A]',
                                  secondaryClass: `text-[11px] ${textMutedClass}`,
                                }
                                : null;
                              const interactionBreakdownMetrics = [
                                ...supportingMetrics.filter((metric) =>
                                  ['likes', 'comments', 'shares', 'saves'].includes(metric.key)
                                ),
                                !supportingMetrics.some((metric) => metric.key === 'saves') && highlightSaves
                                  ? {
                                    key: 'saves',
                                    main: highlightSaves!,
                                    secondary: 'Salvos',
                                    arrangement: 'postfix',
                                    mainClass: 'text-sm font-semibold text-[#0F172A]',
                                    secondaryClass: `text-[11px] ${textMutedClass}`,
                                  }
                                  : null,
                              ].filter((item): item is MetricItem => Boolean(item));
                              const additionalDetailMetrics = supportingMetrics.filter(
                                (metric) => !['likes', 'comments', 'shares', 'saves'].includes(metric.key)
                              );
                              const hasSummaryMetrics = summaryMetrics.length > 0;
                              const hasInteractionBreakdown = interactionBreakdownMetrics.length > 0;
                              const hasAdditionalDetailMetrics = additionalDetailMetrics.length > 0;
                              const hasDetailMetrics =
                                hasSummaryMetrics || Boolean(interactionsSummaryMetric) || hasInteractionBreakdown || hasAdditionalDetailMetrics;

                              const hasThumbnail = Boolean(video.thumbnailUrl);
                              const isTopHighlight = index === 0;
                              const isClickable = (canViewCategories || isPublicView) && !isTopPostsLocked;

                              return (
                                <article
                                  key={video._id}
                                  className={`relative flex min-w-[220px] max-w-[260px] flex-1 basis-1/2 flex-col gap-2 rounded-[28px] border border-white/60 bg-white/95 px-3 pt-3 pb-2 text-xs shadow-[0_2px_10px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(15,23,42,0.16)] ${isClickable ? 'cursor-pointer' : ''
                                    } ${isTopHighlight ? '!border-[#FF2C7E]/40' : ''}`}
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
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    {isTopHighlight ? (
                                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#6E1F93] to-[#FF2C7E] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-inner">
                                        Top 1 do período
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full border border-white/50 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#475569]">
                                        #{index + 1}
                                      </span>
                                    )}
                                    {dateLabel ? (
                                      <div className="text-right text-xs text-slate-500">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide">Publicado</p>
                                        <p className="font-semibold text-[#475569]">{dateLabel}</p>
                                      </div>
                                    ) : null}
                                  </div>
                                  {hasThumbnail ? (
                                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/50 bg-white/70">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={video.thumbnailUrl!}
                                        alt={captionPreview}
                                        className="h-full w-full object-cover"
                                      />
                                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    </div>
                                  ) : (
                                    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl border border-dashed border-white/60 bg-white/70 text-[11px] font-semibold text-slate-500">
                                      Sem prévia disponível
                                    </div>
                                  )}
                                  {tagMeta.length > 0 ? (
                                    <div className="rounded-2xl border border-white/55 bg-white/95 p-3 space-y-2">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                        Categorias mapeadas
                                      </p>
                                      <div className="space-y-1.5">
                                        {tagMeta.map(({ type, value }) => (
                                          <p
                                            key={`${video._id}-${type}-${value}`}
                                            className={`text-[10px] uppercase tracking-[0.08em] ${textMutedClass}`}
                                          >
                                            {value}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  {tagMeta.length > 0 && hasDetailMetrics ? (
                                    <div className="h-px bg-[#EFEDF6]" />
                                  ) : null}
                                  {hasDetailMetrics ? (
                                    <div className="rounded-2xl border border-white/55 bg-white/95 p-3">
                                      <div className="space-y-4">
                                        {hasSummaryMetrics ? (
                                          <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                              Indicadores principais
                                            </p>
                                            <div className="mt-1.5 space-y-1.5">
                                              {summaryMetrics.map((metric) => (
                                                <div
                                                  key={`${video._id}-${metric.key}-summary`}
                                                  className="flex items-baseline justify-between text-sm"
                                                >
                                                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{metric.secondary}</p>
                                                  <p className="text-sm font-semibold text-[#0F172A]">{metric.main}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}

                                        {interactionsSummaryMetric || hasInteractionBreakdown ? (
                                          <div className="space-y-2">
                                            {hasSummaryMetrics ? <div className="h-px bg-[#EFEDF6]" /> : null}
                                            <div className="flex items-center justify-between">
                                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Interações</p>
                                              {interactionsSummaryMetric ? (
                                                <p className="text-sm font-semibold text-[#0F172A]">{interactionsSummaryMetric.main}</p>
                                              ) : null}
                                            </div>
                                            {hasInteractionBreakdown ? (
                                              <div className="space-y-1.5">
                                                {interactionBreakdownMetrics.map((metric) => (
                                                  <div
                                                    key={`${video._id}-${metric.key}-breakdown`}
                                                    className="flex items-baseline justify-between text-sm"
                                                  >
                                                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{metric.secondary}</p>
                                                    <p className="text-sm font-semibold text-[#0F172A]">{metric.main}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : null}

                                        {hasAdditionalDetailMetrics ? (
                                          <div className="space-y-2">
                                            {(hasSummaryMetrics || interactionsSummaryMetric || hasInteractionBreakdown) ? (
                                              <div className="h-px bg-[#EFEDF6]" />
                                            ) : null}
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Outros sinais</p>
                                            <div className="space-y-1.5">
                                              {additionalDetailMetrics.map((metric) => (
                                                <div
                                                  key={`${video._id}-${metric.key}-additional`}
                                                  className="flex items-baseline justify-between text-sm"
                                                >
                                                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{metric.secondary}</p>
                                                  <p className="text-sm font-semibold text-[#0F172A]">{metric.main}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B]">
                                    {isClickable ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedPostId(video._id);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/80 px-2.5 py-1 font-semibold text-[#0F172A] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Ver detalhes
                                      </button>
                                    ) : null}
                                    {video.permalink ? (
                                      <a
                                        href={video.permalink}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 font-semibold text-[#1C4FD7] transition hover:text-[#153fae]"
                                      >
                                        Ver no Instagram
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                      </a>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    {isTopPostsLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 p-6 text-center backdrop-blur-sm">
                        <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                          <Lock className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-lg font-bold text-slate-900">Análise Bloqueada</h3>
                        <p className="mt-2 max-w-sm text-sm text-slate-500">
                          Desbloqueie para ver os insights completos e baixar o briefing pronto para marcas.
                        </p>
                        <ButtonPrimary
                          onClick={handleTopPostsCtaClick}
                          variant="brand"
                          size="md"
                          className="mt-6"
                        >
                          {categoryCtaLabel}
                        </ButtonPrimary>
                      </div>
                    )}

                    {!isTopPostsLocked && visibleTopPosts.length > 1 && (
                      <div className="mt-6 flex justify-center gap-2">
                        {visibleTopPosts.map((video, index) => (
                          <span
                            key={`dot-${video._id}`}
                            className={`h-1.5 rounded-full transition-all ${index === 0 ? 'w-6 bg-[#6E1F93]' : 'w-1.5 bg-slate-200'
                              }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.section>

              {isPublicView ? <div ref={stickyEndRef} className="h-px w-full" aria-hidden="true" /> : null}

              {!isPublicView && (
                <footer className={`${glassCardBaseClass} mt-10 px-6 py-6 text-center`}>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    Dados e análise por <span className="text-[#D62E5E]">Data2Content AI</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Atualizado automaticamente via Instagram API e inteligência proprietária.
                  </p>
                  {contactEmail ? (
                    <a
                      href={`mailto:${contactEmail}`}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6E1F93] to-[#FF2C7E] px-5 py-2 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
                    >
                      Contatar para parceria
                    </a>
                  ) : null}
                </footer>
              )}
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

          {
            isProposalDrawerOpen ? (
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
                  <div className="flex max-h-[calc(100vh-1.5rem)] flex-col sm:max-h-none">
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
                        className="rounded-full p-2 text-[#94A3B8] transition hover:text-[#0F172A]"
                        aria-label="Fechar formulário de proposta"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-6 sm:flex-none sm:overflow-visible sm:px-8">
                      <PublicProposalForm
                        mediaKitSlug={mediaKitSlug}
                        onSubmitSuccess={handleProposalSuccess}
                        utmContext={utm}
                        pricing={pricing}
                        onClearPricing={showOwnerCtas ? onClearPricing : undefined}
                        packages={packages}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null
          }

          {
            isCitiesModalOpen && fullLocationBreakdown.length > 0 && (
              <div
                className="fixed inset-0 z-[200] bg-black/40"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cities-modal-title"
              >
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-4">
                      <h3 id="cities-modal-title" className="text-sm font-semibold text-[#0F172A]">
                        Todas as cidades
                      </h3>
                      <button
                        className="rounded-full p-1.5 text-[#94A3B8] transition hover:text-[#0F172A]"
                        aria-label="Fechar"
                        onClick={() => setCitiesModalOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                      <div className="space-y-3">
                        {fullLocationBreakdown.map((item) => (
                          <div key={item.label} className="text-sm font-medium text-[#475569]">
                            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                              <span>{item.label}</span>
                              <span className="font-semibold text-[#0F172A]">{Math.round(item.percentage)}%</span>
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
                        className="inline-flex items-center rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-[#475569] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                        onClick={() => setCitiesModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          }
          {
            isGenderModalOpen && fullGenderBreakdown.length > 0 && (
              <div
                className="fixed inset-0 z-[200] bg-black/40"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gender-modal-title"
              >
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-4">
                      <h3 id="gender-modal-title" className="text-sm font-semibold text-[#0F172A]">
                        Distribuição por gênero
                      </h3>
                      <button
                        className="rounded-full p-1.5 text-[#94A3B8] transition hover:text-[#0F172A]"
                        aria-label="Fechar"
                        onClick={() => setGenderModalOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                      <div className="space-y-3">
                        {fullGenderBreakdown.map((item) => {
                          const label = genderLabelMap[item.label.toLowerCase()] || item.label;
                          return (
                            <div key={item.label} className="text-sm font-medium text-[#475569]">
                              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                                <span>{label}</span>
                                <span className="font-semibold text-[#0F172A]">{Math.round(item.percentage)}%</span>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-[#F1F2F4]">
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-[#D62E5E] to-[#F97316]"
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="border-t border-[#EAEAEA] px-5 py-3 text-right">
                      <button
                        className="inline-flex items-center rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-[#475569] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                        onClick={() => setGenderModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          }
          {
            isAgeModalOpen && fullAgeBreakdown.length > 0 && (
              <div
                className="fixed inset-0 z-[200] bg-black/40"
                role="dialog"
                aria-modal="true"
                aria-labelledby="age-modal-title"
              >
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-4">
                      <h3 id="age-modal-title" className="text-sm font-semibold text-[#0F172A]">
                        Distribuição por idade
                      </h3>
                      <button
                        className="rounded-full p-1.5 text-[#94A3B8] transition hover:text-[#0F172A]"
                        aria-label="Fechar"
                        onClick={() => setAgeModalOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                      <div className="space-y-3">
                        {fullAgeBreakdown.map((item) => (
                          <div key={item.label} className="text-sm font-medium text-[#475569]">
                            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                              <span>{item.label}</span>
                              <span className="font-semibold text-[#0F172A]">{Math.round(item.percentage)}%</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-[#F1F2F4]">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-[#6E1F93] to-[#D62E5E]"
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-[#EAEAEA] px-5 py-3 text-right">
                      <button
                        className="inline-flex items-center rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-[#475569] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                        onClick={() => setAgeModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          <PostDetailModal
            isOpen={selectedPostId !== null}
            onClose={() => setSelectedPostId(null)}
            postId={selectedPostId}
            publicMode
          />
        </div>
      </div>
    </GlobalTimePeriodProvider>
  );
}
