'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Info,
  Lightbulb,
  Link2,
  RefreshCcw,
  Share2,
  Wallet,
} from 'lucide-react';
import { track } from '@/lib/track';
import {
  useAffiliateSummary,
  canRedeem,
  getRedeemBlockReason,
} from '@/hooks/useAffiliateSummary';
import { useConnectStatus } from '@/hooks/useConnectStatus';
import ErrorState from '@/components/ui/ErrorState';
import { AFFILIATE_TIP_TEMPLATES } from '@/data/affiliateTips';

type CopyKind = 'code' | 'link' | 'tip';

const copyLabels: Record<CopyKind, string> = {
  code: 'Código',
  link: 'Link',
  tip: 'Texto',
};

function fmt(amountCents: number, cur: string) {
  const n = (amountCents || 0) / 100;
  const currency = (cur || 'BRL').toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export default function AffiliateCard() {
  const { data: session } = useSession();
  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
    refresh: refreshSummary,
  } = useAffiliateSummary();
  const {
    status,
    isLoading: statusLoading,
    error: statusError,
    refresh: refreshStatus,
  } = useConnectStatus();
  const [a11yMsg, setA11yMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedTipId, setCopiedTipId] = useState<string | null>(null);

  const loading = summaryLoading || statusLoading;
  const error = summaryError || statusError;

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshStatus()]);
  }, [refreshSummary, refreshStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const handleCopy = useCallback(
    async (textToCopy: string | null, type: CopyKind, successMessage?: string) => {
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        const label = successMessage || `${copyLabels[type]} copiado!`;
        toast.success(label);
        setA11yMsg(`${copyLabels[type]} copiado para a área de transferência.`);
        track(`affiliate_copy_${type}`);
      } catch {
        toast.error('Falha ao copiar.');
      }
    },
    [],
  );

  const handleShare = useCallback(
    async (url: string | null) => {
      if (!url) return;
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
          await (navigator as any).share({ title: 'Meu link de afiliado', url });
          track('affiliate_share_native');
        } else {
          await navigator.clipboard.writeText(url);
          toast.success('Link copiado para compartilhar!');
          setA11yMsg('Link pronto para compartilhamento.');
          track('affiliate_share_fallback_copy');
        }
      } catch {
        /* usuário cancelou o compartilhamento */
      }
    },
    [],
  );

  const openStripe = useCallback(async () => {
    try {
      const createRes = await fetch('/api/affiliate/connect/create', { method: 'POST' });
      const createBody = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createBody?.error || 'Falha ao preparar conta Stripe');

      const linkRes = await fetch('/api/affiliate/connect/link', { method: 'POST' });
      const data = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok || !data?.url) throw new Error(data?.error || 'Falha ao gerar link do Stripe');
      window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível abrir o Stripe agora.');
      refreshStatus();
    }
  }, [refreshStatus]);

  const fallbackOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://data2content.ai';
  const userCode = session?.user?.affiliateCode || null;
  const origin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return fallbackOrigin;
  }, [fallbackOrigin]);

  const referralLink = useMemo(() => {
    if (!userCode) return null;
    return `${origin}/?ref=${userCode}`;
  }, [origin, userCode]);

  const displayLink = referralLink ?? `${fallbackOrigin}/?ref=${userCode ?? 'SEULINK'}`;
  const quickTips = useMemo(
    () =>
      AFFILIATE_TIP_TEMPLATES.map((tip) => ({
        ...tip,
        copy: tip.buildCopy(displayLink, userCode),
      })),
    [displayLink, userCode],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-44 animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (error || !summary || !status) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <ErrorState message="Erro ao carregar dados do afiliado." onRetry={refreshAll} />
      </div>
    );
  }

  const currencies = Object.keys(summary.byCurrency ?? {});
  const primaryCur = (status.defaultCurrency || currencies[0] || 'BRL').toUpperCase();
  const primaryInfo = summary.byCurrency?.[primaryCur];
  const availableCents = primaryInfo?.availableCents ?? 0;
  const pendingCents = primaryInfo?.pendingCents ?? 0;
  const totalCents = availableCents + pendingCents;
  const minRedeem = primaryInfo?.minRedeemCents ?? 0;
  const debtCents = primaryInfo?.debtCents ?? 0;
  const progressPct =
    totalCents > 0 ? Math.min(100, Math.max(0, Math.round((availableCents / totalCents) * 100))) : 0;

  const reason = getRedeemBlockReason(status, summary, primaryCur);
  const payoutsReady = canRedeem(status, summary, primaryCur);

  const payoutCard = (() => {
    if (!status.payoutsEnabled || reason === 'needsOnboarding' || reason === 'payouts_disabled') {
      return {
        tone: 'warning' as const,
        title: '⚠️ Ação necessária',
        message: 'Conecte sua conta Stripe para liberar ganhos.',
        actionLabel: 'Conectar Stripe',
        action: openStripe,
      };
    }
    if (reason === 'currency_mismatch') {
      return {
        tone: 'info' as const,
        title: 'Atualize seu cadastro',
        message: `Sua conta Stripe precisa operar em ${status.defaultCurrency?.toUpperCase() || primaryCur}.`,
        actionLabel: 'Abrir Stripe',
        action: openStripe,
      };
    }
    if (reason === 'has_debt') {
      return {
        tone: 'danger' as const,
        title: 'Resolva pendências',
        message: `Existe uma pendência de ${fmt(debtCents, primaryCur)} antes de liberar novos pagamentos.`,
      };
    }
    if (reason === 'below_min') {
      const missing = Math.max(0, minRedeem - availableCents);
      return {
        tone: 'info' as const,
        title: 'Aguardando liberação',
        message: missing
          ? `Faltam ${fmt(missing, primaryCur)} para atingir o mínimo de ${fmt(minRedeem, primaryCur)}.`
          : `É preciso atingir ${fmt(minRedeem, primaryCur)} liberados para receber.`,
      };
    }
    return {
      tone: 'success' as const,
      title: 'Tudo pronto para receber',
      message: payoutsReady
        ? 'Seus ganhos liberados serão processados automaticamente.'
        : 'Seus dados estão configurados e os próximos ganhos serão liberados aqui.',
    };
  })();

  const toneMap = {
    warning: {
      classes: 'border-amber-200 bg-amber-50 text-amber-900',
      Icon: AlertTriangle,
    },
    info: {
      classes: 'border-blue-200 bg-blue-50 text-blue-900',
      Icon: Info,
    },
    success: {
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      Icon: CheckCircle2,
    },
    danger: {
      classes: 'border-rose-200 bg-rose-50 text-rose-900',
      Icon: AlertTriangle,
    },
  } as const;

  return (
    <>
      <span aria-live="polite" className="sr-only">
        {a11yMsg}
      </span>

      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <h1 className="sr-only">Programa de afiliados</h1>
        <section className="rounded-3xl border border-brand-purple/10 bg-white p-6 text-brand-dark shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-purple">
                🤝 Programa de Afiliados
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Ganhe 50% da primeira fatura de cada criador indicado.
              </h1>
              <p className="mt-3 max-w-xl text-sm text-brand-text-secondary">
                Compartilhe seu link exclusivo e acompanhe quanto já foi liberado aqui mesmo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleShare(referralLink)}
              disabled={!referralLink}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E4224D] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#E4224D]/40 transition hover:bg-[#cc1c40] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar link
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">💰 Saldo</p>
              <p className="text-xs text-slate-500">Total, liberado e aguardando em {primaryCur}.</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar dados
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Wallet className="h-4 w-4 text-brand-purple" />
                Total
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{fmt(totalCents, primaryCur)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Liberado
              </div>
              <p className="mt-3 text-2xl font-semibold text-emerald-600">{fmt(availableCents, primaryCur)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Clock className="h-4 w-4 text-amber-500" />
                Aguardando
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{fmt(pendingCents, primaryCur)}</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>% liberado</span>
              <span>{progressPct}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-900">🔗 Seu link de afiliado</p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link2 className="h-4 w-4" />
              {displayLink}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleCopy(displayLink, 'link')}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Copy className="h-4 w-4" />
                Copiar link
              </button>
              <button
                type="button"
                onClick={() => handleShare(referralLink)}
                disabled={!referralLink}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar
              </button>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>
                  Código:{' '}
                  <strong className="font-semibold text-slate-900">{userCode ?? '---'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(userCode, 'code')}
                  disabled={!userCode}
                  className="text-xs font-semibold text-brand-purple transition hover:text-brand-magenta disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </section>

        {payoutCard && (
          <section
            className={`rounded-3xl border p-6 shadow-sm sm:p-7 ${toneMap[payoutCard.tone].classes}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {React.createElement(toneMap[payoutCard.tone].Icon, { className: 'mt-1 h-5 w-5' })}
                <div>
                  <p className="text-sm font-semibold">{payoutCard.title}</p>
                  <p className="mt-1 text-sm leading-relaxed">{payoutCard.message}</p>
                </div>
              </div>
              {payoutCard.actionLabel && payoutCard.action && (
                <button
                  type="button"
                  onClick={payoutCard.action}
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/90"
                >
                  {payoutCard.actionLabel}
                </button>
              )}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center gap-2 text-slate-900">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <p className="text-sm font-semibold">💡 Dicas rápidas de divulgação</p>
          </div>
          <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {quickTips.map((tip) => (
              <div key={tip.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-lg">
                    {tip.emoji}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{tip.title}</p>
                    <p className="text-sm text-slate-600">{tip.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleCopy(tip.copy, 'tip', 'Texto copiado!');
                    setCopiedTipId(tip.id);
                    setTimeout(() => setCopiedTipId((current) => (current === tip.id ? null : current)), 2000);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {copiedTipId === tip.id ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-500" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar copy
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
