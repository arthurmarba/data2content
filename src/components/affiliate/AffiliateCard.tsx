'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { track } from '@/lib/track';
import {
  useAffiliateSummary,
  canRedeem,
  getRedeemBlockReason,
} from '@/hooks/useAffiliateSummary';
import { useConnectStatus } from '@/hooks/useConnectStatus';
import { REDEEM_BLOCK_MESSAGES, REDEEM_ERROR_MESSAGES } from '@/copy/affiliates';
import RedeemModal from '@/components/affiliate/RedeemModal';
import StripeStatusPanel from '@/components/payments/StripeStatusPanel';
import ErrorState from '@/components/ui/ErrorState';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Info,
  Link2,
  RefreshCcw,
  Share2,
  Sparkles,
  Stars,
  Target,
  Users,
  Wallet,
} from 'lucide-react';

type CopyKind = 'code' | 'link' | 'tip';

const copyLabels: Record<CopyKind, string> = {
  code: 'Código',
  link: 'Link',
  tip: 'Texto',
};

type ReferralStats = {
  total: number;
  converted: number;
  pending: number;
};

const HOW_IT_WORKS = [
  {
    icon: Users,
    title: 'Gere seu link exclusivo',
    description:
      'Copie o link acima; ele já aplica o desconto e associa a venda automaticamente.',
  },
  {
    icon: Share2,
    title: 'Compartilhe onde confiam em você',
    description: 'Stories, grupos e mentorias funcionam melhor quando você traz seu contexto.',
  },
  {
    icon: Wallet,
    title: 'Receba 50% da primeira fatura',
    description:
      'Assim que o pagamento maturar, o saldo cai como disponível e você pode resgatar via Stripe.',
  },
] as const;

const useReferralStats = () => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoints = [
        { key: 'total', query: '' },
        { key: 'available', query: '&status=available' },
        { key: 'pending', query: '&status=pending' },
        { key: 'paid', query: '&status=paid' },
      ] as const;

      const responses = await Promise.all(
        endpoints.map(async ({ key, query }) => {
          const res = await fetch(`/api/affiliate/commission-log?limit=1${query}`, {
            cache: 'no-store',
          });
          if (!res.ok) {
            let message = 'Falha ao carregar estatísticas de indicações.';
            try {
              const body = await res.json();
              message = body?.error || body?.message || message;
            } catch {
              /* ignore parse errors */
            }
            throw new Error(message);
          }
          const data = await res.json();
          return { key, data };
        }),
      );

      const getTotal = (key: typeof endpoints[number]['key']) =>
        responses.find((r) => r.key === key)?.data?.total ?? 0;

      const converted = getTotal('available') + getTotal('paid');
      const pending = getTotal('pending');
      const total = getTotal('total');

      const payload: ReferralStats = { total, converted, pending };
      setStats(payload);
      return payload;
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar estatísticas.');
      setStats(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
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

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diff > 0 ? diff : null;
}

function formatShortDate(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function AffiliateCard() {
  const { data: session, update: updateSession } = useSession();
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
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refetch: refreshStats,
  } = useReferralStats();

  const loading = summaryLoading || statusLoading;
  const error = summaryError || statusError;

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshStatus(), refreshStats()]);
  }, [refreshSummary, refreshStatus, refreshStats]);

  const [redeemCur, setRedeemCur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<CopyKind | null>(null);
  const [a11yMsg, setA11yMsg] = useState('');

  const haveCode = !!session?.user?.affiliateCode;
  const origin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  );
  const referralLink = useMemo(() => {
    if (!haveCode) return null;
    return `${origin}/?ref=${session!.user!.affiliateCode}`;
  }, [origin, haveCode, session]);

  const handleCopy = useCallback(
    async (textToCopy: string | null, type: CopyKind, successMessage?: string) => {
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        const label = successMessage || `${copyLabels[type]} copiado!`;
        toast.success(label);
        setA11yMsg(`${copyLabels[type]} copiado para a área de transferência.`);
        setCopyState(type);
        setTimeout(() => setCopyState(null), 1200);
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
          setCopyState('link');
          setTimeout(() => setCopyState(null), 1200);
          track('affiliate_share_fallback_copy');
        }
      } catch {
        /* usuário cancelou o share, ok */
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

  const openRedeem = (cur: string) => {
    setRedeemCur(cur);
    track('affiliate_redeem_click', {
      currency: cur,
      enabled: canRedeem(status, summary, cur),
      reason: getRedeemBlockReason(status, summary, cur) || undefined,
    });
  };

  const confirmRedeem = async () => {
    if (!redeemCur || !summary?.byCurrency) return;
    const amount = summary.byCurrency[redeemCur]?.availableCents ?? 0;
    track('affiliate_redeem_confirm', { currency: redeemCur, amountCents: amount });
    setSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/redeem', {
        method: 'POST',
        body: JSON.stringify({ currency: redeemCur, amountCents: null, clientToken: uuidv4() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        track('affiliate_redeem_error', { currency: redeemCur, code: data.code });
        const msg =
          REDEEM_ERROR_MESSAGES[data.code as keyof typeof REDEEM_ERROR_MESSAGES] ||
          data.message ||
          'Falha ao solicitar resgate.';
        toast.error(msg);
      } else {
        track('affiliate_redeem_success', { currency: redeemCur, amountCents: amount });
        toast.success('Transferência criada');
        await refreshAll();
        await updateSession?.();
      }
    } catch {
      toast.error('Falha ao solicitar resgate. Tente novamente.');
    } finally {
      setSubmitting(false);
      setRedeemCur(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !summary || !status) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ErrorState message="Erro ao carregar dados do afiliado." onRetry={refreshAll} />
      </div>
    );
  }

  const currencies = Object.keys(summary.byCurrency ?? {});
  const primaryCur = (status?.defaultCurrency || currencies[0] || 'brl').toUpperCase();
  const primaryInfo = summary.byCurrency?.[primaryCur];
  const availableCents = primaryInfo?.availableCents ?? 0;
  const pendingCents = primaryInfo?.pendingCents ?? 0;
  const totalCents = availableCents + pendingCents;
  const minRedeem = primaryInfo?.minRedeemCents ?? 0;
  const debtCents = primaryInfo?.debtCents ?? 0;

  const reason = getRedeemBlockReason(status, summary, primaryCur) || null;
  let reasonText: string | null = null;
  if (reason) {
    const tpl = REDEEM_BLOCK_MESSAGES[reason as keyof typeof REDEEM_BLOCK_MESSAGES];
    if (typeof tpl === 'string') {
      reasonText = tpl;
    } else if (typeof tpl === 'function') {
      switch (reason) {
        case 'below_min':
          reasonText = (tpl as any)(fmt(minRedeem, primaryCur));
          break;
        case 'has_debt':
          reasonText = (tpl as any)(fmt(debtCents, primaryCur));
          break;
        case 'currency_mismatch':
          reasonText = (tpl as any)(
            (status.defaultCurrency || '').toUpperCase(),
            primaryCur.toUpperCase(),
          );
          break;
        default:
          reasonText = 'Não é possível resgatar no momento.';
      }
    }
  }

  const isRedeemable = canRedeem(status, summary, primaryCur);
  const pendingDays = daysUntil(primaryInfo?.nextMatureAt ?? null);
  const pendingDate = formatShortDate(primaryInfo?.nextMatureAt ?? null);
  const progressPct =
    totalCents > 0 ? Math.min(100, Math.max(0, Math.round((availableCents / totalCents) * 100))) : 0;

  const userFirstName = session?.user?.name?.split(' ')?.[0] || 'Você';
  const secondaryCurrencies = currencies
    .map((cur) => cur.toUpperCase())
    .filter((cur) => cur !== primaryCur);

  const tipSuggestions = [
    {
      title: 'Mostre um resultado real',
      description:
        'Compartilhe um print do dashboard e explique em uma frase o ganho concreto que você teve.',
      suggestion: `💬 Olha como o Mobi me ajuda a planejar conteúdos: organizei a semana em minutos! Usa meu link ${referralLink ?? 'seu link de afiliado'} e garante 50% na 1ª fatura.`,
    },
    {
      title: 'Contextualize nos grupos',
      description:
        'Envie o link junto de uma dica prática que faça sentido para quem está no grupo.',
      suggestion: `📲 Dica rápida: entre no Mobi com ${referralLink ?? 'seu link de afiliado'} e comece com 50% off. Posso te mostrar como uso na próxima mentoria.`,
    },
    {
      title: 'Convite direto nas mentorias',
      description:
        'Quando alguém pede ajuda, ofereça o link e se coloque à disposição para acompanhar a ativação.',
      suggestion: `🤝 Quer testar o Mobi comigo? É só entrar com ${referralLink ?? 'seu link de afiliado'} que já vem com 50% de desconto e o painel completo.`,
    },
  ];

  let redeemLabel = 'Resgatar ganhos';
  if (submitting) redeemLabel = 'Processando…';
  else if (isRedeemable) redeemLabel = `Resgatar ${fmt(availableCents, primaryCur)}`;
  else if (reason === 'needsOnboarding' || reason === 'payouts_disabled')
    redeemLabel = 'Conectar Stripe e liberar ganhos';
  else if (reason === 'below_min') redeemLabel = 'Aguardando liberação';

  return (
    <>
      <span aria-live="polite" className="sr-only">
        {a11yMsg}
      </span>

      <div className="mx-auto w-full max-w-3xl space-y-8 bg-[#FAFAFB] px-4 pb-20 pt-6 sm:rounded-[28px] sm:px-8">
        <section className="rounded-2xl bg-gradient-to-r from-brand-purple to-brand-magenta p-7 text-white shadow-sm">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <Stars className="h-3.5 w-3.5" />
              Programa de afiliados
            </div>
            <h1 className="text-2xl font-bold">Transforme seu alcance em receita</h1>
            <p className="text-sm leading-relaxed text-white/85 sm:text-base">
              {session?.user?.name
                ? `${userFirstName}, cada criador que ativa o Mobi com seu link garante 50% da primeira fatura direto para você.`
                : 'Compartilhe o Mobi e receba 50% da primeira fatura de cada criador indicado.'}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => handleShare(referralLink)}
                disabled={!referralLink}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-purple transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar meu link
              </button>
              <div className="flex items-center gap-2 text-sm text-white/85">
                <Sparkles className="h-4 w-4" />
                Foque nos canais onde já confiam em você.
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
                  <p className="text-[15px] font-semibold text-[#1C1C1E]">Visão rápida do saldo</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                  Veja quanto pode sacar e o que ainda está em análise.
                </p>
              </div>
              <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-purple">
                {primaryCur}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#F8F8FC] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-purple shadow-sm">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777777]">Total</p>
                </div>
                <p className="mt-3 text-[17px] font-semibold text-[#1C1C1E] tabular-nums">
                  {fmt(totalCents, primaryCur)}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F8FC] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-purple shadow-sm">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777777]">Liberado</p>
                </div>
                <p className="mt-3 text-[17px] font-semibold text-[#1C1C1E] tabular-nums">
                  {fmt(availableCents, primaryCur)}
                </p>
                {!!minRedeem && (
                  <p className="mt-1 text-[11px] text-[#666666]">Mínimo {fmt(minRedeem, primaryCur)}</p>
                )}
              </div>
              <div className="rounded-xl bg-[#F8F8FC] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-purple shadow-sm">
                    <Clock className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777777]">Aguardando</p>
                </div>
                <p className="mt-3 text-[17px] font-semibold text-[#1C1C1E] tabular-nums">
                  {fmt(pendingCents, primaryCur)}
                </p>
                {(pendingDays || pendingDate) && (
                  <p className="mt-1 text-[11px] text-[#666666]">
                    Libera {pendingDays ? `em ${pendingDays} dias` : ''}
                    {pendingDays && pendingDate ? ' · ' : ''}
                    {pendingDate || ''}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm text-[#4c4c4c]">
                <span>Progresso das comissões</span>
                <span className="font-semibold text-[#1C1C1E]">{progressPct}% liberado</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#E5E5E9]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D62E5E] to-[#6E1F93] transition-all"
                  style={{ width: `${progressPct}%` }}
                  aria-label={`Progresso do ciclo de comissão: ${progressPct}% disponível`}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={refreshAll}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar dados
              </button>
              <button
                onClick={() => openRedeem(primaryCur)}
                disabled={!isRedeemable || submitting}
                title={!isRedeemable && !submitting ? reasonText || undefined : undefined}
                className={[
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-magenta/60 focus:ring-offset-2',
                  isRedeemable && !submitting
                    ? 'bg-brand-magenta text-white transition hover:bg-brand-purple'
                    : 'bg-slate-200 text-slate-600 cursor-not-allowed',
                ].join(' ')}
              >
                {redeemLabel}
              </button>
            </div>

            {(!isRedeemable || reasonText || debtCents > 0) && (
              <p className="mt-4 rounded-xl border border-brand-magenta/30 bg-brand-magenta/10 px-3 py-2 text-xs text-brand-magenta">
                {reasonText ||
                  (debtCents > 0
                    ? `Há ${fmt(debtCents, primaryCur)} em ajustes a compensar antes do próximo resgate.`
                    : 'Finalize a configuração da sua conta Stripe para liberar os resgates.')}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-8 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
              <p className="text-[15px] font-semibold text-[#1C1C1E]">Seu link e código</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#666666]">
              Copie e cole onde sua audiência espera novidades do Mobi.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#F7F7F9] px-4 py-3 font-mono text-[13px] text-brand-dark">
                <Link2 className="h-4 w-4 text-brand-purple" />
                <span className="truncate">
                  {referralLink || `${origin || 'https://data2content.ai'}/?ref=—`}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleCopy(referralLink, 'link')}
                  disabled={!referralLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copyState === 'link' ? <CheckCircle2 className="h-4 w-4 text-brand-purple" /> : <Copy className="h-4 w-4" />}
                  Copiar link
                </button>
                <button
                  onClick={() => handleShare(referralLink)}
                  disabled={!referralLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  readOnly
                  value={haveCode ? session?.user?.affiliateCode || '' : ''}
                  placeholder="—"
                  className="flex-1 rounded-xl border border-slate-200 bg-[#F7F7F9] px-3 py-3 font-mono text-[13px] text-brand-dark shadow-sm"
                />
                <button
                  onClick={() => handleCopy(session?.user?.affiliateCode || '', 'code')}
                  disabled={!haveCode}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copyState === 'code' ? <CheckCircle2 className="h-4 w-4 text-brand-purple" /> : <Copy className="h-4 w-4" />}
                  Copiar código
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="space-y-4">
          <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[#1C1C1E] leading-relaxed">
              <span className="flex items-center gap-2">
                <span className="h-6 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
                Desempenho das indicações
              </span>
              <span className="text-xs font-medium text-gray-500">ver detalhes</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-[#666666]">
              Indicadores atualizados sempre que você toca em “Atualizar dados”.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-purple">Convertidas</p>
                <p className="mt-2 text-lg font-semibold text-brand-dark tabular-nums">
                  {statsLoading ? '—' : stats?.converted ?? 0}
                </p>
                <p className="mt-1 text-xs text-gray-500">Já liberadas para sua comissão.</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-purple">Aguardando</p>
                <p className="mt-2 text-lg font-semibold text-brand-dark tabular-nums">
                  {statsLoading ? '—' : stats?.pending ?? 0}
                </p>
                <p className="mt-1 text-xs text-gray-500">Entram no saldo quando o pagamento maturar.</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-purple">Convites</p>
                <p className="mt-2 text-lg font-semibold text-brand-dark tabular-nums">
                  {statsLoading ? '—' : stats?.total ?? 0}
                </p>
                <p className="mt-1 text-xs text-gray-500">Inclui convites em andamento e convertidos.</p>
              </div>
            </div>
            {statsError && (
              <p className="mt-3 text-xs text-brand-magenta">
                Não foi possível carregar suas indicações agora. Tente novamente em instantes.
              </p>
            )}
          </details>

          <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[#1C1C1E] leading-relaxed">
              <span className="flex items-center gap-2">
                <span className="h-6 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
                Pagamentos via Stripe
              </span>
              <span className="text-xs font-medium text-gray-500">abrir painel</span>
            </summary>
            <div className="mt-4 space-y-4">
              <StripeStatusPanel
                status={status}
                summary={summary}
                onRefresh={refreshStatus}
                onOnboard={openStripe}
              />
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[#1C1C1E] leading-relaxed">
              <span className="flex items-center gap-2">
                <span className="h-6 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
                Como funciona
              </span>
              <span className="text-xs font-medium text-gray-500">clique para revisar</span>
            </summary>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#666666]">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.title} className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-brand-purple/10 p-2 text-brand-purple">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-dark">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#666666]">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[#1C1C1E] leading-relaxed">
              <span className="flex items-center gap-2">
                <span className="h-6 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
                Dicas do Mobi
              </span>
              <span className="text-xs font-medium text-gray-500">copiar sugestões</span>
            </summary>
            <div className="mt-4 space-y-4">
              {tipSuggestions.map((tip) => (
                <div
                  key={tip.title}
                  className="rounded-xl border border-[#FFD7E0] bg-gradient-to-br from-[#FFF6F8] to-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-purple shadow-sm">
                      <Bot className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-brand-dark">{tip.title}</p>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#666666]">{tip.description}</p>
                  <button
                    onClick={() => handleCopy(tip.suggestion, 'tip', 'Sugestão copiada!')}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-magenta px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-purple"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Copiar sugestão
                  </button>
                </div>
              ))}
            </div>
          </details>

          {secondaryCurrencies.length > 0 && (
            <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[#1C1C1E] leading-relaxed">
                <span className="flex items-center gap-2">
                  <span className="h-6 w-[3px] rounded-full bg-[#D62E5E]" aria-hidden />
                  Outros saldos em moeda
                </span>
                <span className="text-xs font-medium text-gray-500">abrir</span>
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {secondaryCurrencies.map((cur) => {
                  const info = summary.byCurrency?.[cur];
                  if (!info) return null;
                  const d = daysUntil(info.nextMatureAt ?? null);
                  const dt = formatShortDate(info.nextMatureAt ?? null);
                  return (
                    <div key={cur} className="rounded-xl bg-slate-50 p-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-brand-purple">
                        <span>{cur}</span>
                        <span>Disponível</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-brand-dark">
                        {fmt(info.availableCents ?? 0, cur)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Aguardando {fmt(info.pendingCents ?? 0, cur)}
                      </p>
                      {(d || dt) && (
                        <p className="mt-1 text-xs text-gray-500">
                          Libera {d ? `em ${d} dias` : ''}
                          {d && dt ? ' · ' : ''}
                          {dt || ''}
                        </p>
                      )}
                      <button
                        onClick={() => openRedeem(cur)}
                        disabled={!canRedeem(status, summary, cur)}
                        className="mt-3 w-full rounded-xl bg-brand-purple px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-magenta disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Resgatar {fmt(info.availableCents ?? 0, cur)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </section>
      </div>

      {redeemCur && summary.byCurrency && (
        <RedeemModal
          open={!!redeemCur}
          currency={redeemCur}
          amountCents={summary.byCurrency[redeemCur]?.availableCents ?? 0}
          onConfirm={confirmRedeem}
          onClose={() => setRedeemCur(null)}
          loading={submitting}
        />
      )}
    </>
  );
}
