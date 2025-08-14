'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { track } from '@/lib/track';
import {
  useAffiliateSummary,
  canRedeem,
  getRedeemBlockReason,
} from '@/hooks/useAffiliateSummary';
import { REDEEM_BLOCK_MESSAGES, REDEEM_ERROR_MESSAGES, RULES_COPY } from '@/copy/affiliates';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';
import StripeStatusPanel from '@/components/payments/StripeStatusPanel';
import RedeemModal from '@/components/affiliate/RedeemModal';
import { useConnectStatus } from '@/hooks/useConnectStatus';

function fmt(amountCents: number, cur: string) {
  const n = (amountCents || 0) / 100;
  const currency = (cur || 'BRL').toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(n);
  return `${formatted} ${currency}`;
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diff > 0 ? diff : null;
}

export default function AffiliateCard() {
  const { data: session, update: updateSession } = useSession();
  const { summary, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useAffiliateSummary();
  const { status, isLoading: statusLoading, error: statusError, refresh: refreshStatus } = useConnectStatus();
  const loading = summaryLoading || statusLoading;
  const error = summaryError || statusError;
  const refresh = async () => { await Promise.all([refreshSummary(), refreshStatus()]); };
  const [redeemCur, setRedeemCur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (summary?.byCurrency) {
      const currencies = Object.keys(summary.byCurrency ?? {});
      const hasPending = currencies.some(
        (c) => (summary.byCurrency?.[c]?.pendingCents ?? 0) > 0
      );
      const hasDebt = currencies.some(
        (c) => (summary.byCurrency?.[c]?.debtCents ?? 0) > 0
      );
      track('affiliate_view_card', { currencies, hasPending, hasDebt });
    }
  }, [summary]);

  useEffect(() => {
    if (summary?.byCurrency && status) {
      Object.keys(summary.byCurrency ?? {}).forEach((cur) => {
        const reason = getRedeemBlockReason(status, summary, cur);
        if (reason) track('affiliate_tooltip_reason_shown', { reason });
      });
    }
  }, [summary, status]);

  const handleCopyCode = () => {
    if (session?.user?.affiliateCode) {
      navigator.clipboard.writeText(session.user.affiliateCode);
      track('affiliate_copy_code', { userId: (session.user as any)?.id });
    }
  };

  const handleCopyLink = () => {
    if (session?.user?.affiliateCode) {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${origin}/?ref=${session.user.affiliateCode}`;
      navigator.clipboard.writeText(link);
      track('affiliate_copy_link', { userId: (session.user as any)?.id });
    }
  };

  const handleOnboard = async () => {
    track('affiliate_open_onboarding', { userId: (session?.user as any)?.id });
    try {
      const res = await fetch('/api/affiliate/connect/onboard', { method: 'POST' });
      const data = await res.json();
      if (data?.url) window.open(data.url, '_blank');
    } catch (err) {
      console.error(err);
    }
  };

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
    track('affiliate_redeem_confirm', {
      currency: redeemCur,
      amountCents: amount,
    });
    setSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/redeem', {
        method: 'POST',
        body: JSON.stringify({
          currency: redeemCur,
          amountCents: null,
          clientToken: uuidv4(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        track('affiliate_redeem_error', {
          currency: redeemCur,
          code: data.code,
        });
        const msg =
          REDEEM_ERROR_MESSAGES[data.code as keyof typeof REDEEM_ERROR_MESSAGES] ||
          data.message ||
          'Falha ao solicitar resgate.';
        toast.error(msg);
      } else {
        track('affiliate_redeem_success', {
          currency: redeemCur,
          amountCents: amount,
        });
        toast.success('Transferência criada');
        await refresh();
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
      <div className="rounded-2xl border p-4 space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (error || !summary || !status) {
    return (
      <div className="rounded-2xl border p-4">
        <ErrorState message="Erro ao carregar saldos." onRetry={refresh} />
      </div>
    );
  }

  const currencies = Object.keys(summary.byCurrency ?? {});

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <h3 className="text-lg font-semibold">Programa de Afiliados</h3>

      <div className="rounded-xl bg-gray-50 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600">Cód. Afiliado</p>
          <p className="font-mono text-sm">
            {session?.user?.affiliateCode || '—'}
          </p>
        </div>
        {session?.user?.affiliateCode && (
          <button onClick={handleCopyCode} className="text-xs underline">
            Copiar
          </button>
        )}
      </div>

      <div className="rounded-xl bg-gray-50 p-3 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-600">Link de indicação</p>
          {session?.user?.affiliateCode ? (
            <p className="break-all text-sm">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/?ref=${session.user.affiliateCode}`
                : `/?ref=${session.user.affiliateCode}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Seu código será gerado após o primeiro login.
            </p>
          )}
        </div>
        {session?.user?.affiliateCode && (
          <button onClick={handleCopyLink} className="text-xs underline ml-2">
            Copiar
          </button>
        )}
      </div>

      <StripeStatusPanel
        status={status}
        summary={summary}
        onRefresh={() => {
          track('stripe_status_refresh_click');
          refreshStatus();
        }}
        onOnboard={handleOnboard}
      />

      <div className="rounded-xl bg-gray-50 p-3">
        <p className="mb-2 text-xs text-gray-600">Saldos</p>
        {currencies.length === 0 && (
          <EmptyState text="Assim que um indicado fizer o 1º pagamento, sua comissão aparece aqui." />
        )}
        {currencies.map((cur) => {
          const info = summary.byCurrency?.[cur];
          if (!info) {
            // Em caso de inconsistência de dados, evita crash e não renderiza a moeda
            return null;
          }

          const reason = getRedeemBlockReason(status, summary, cur);
          let reasonText: string | null = null;
          if (reason) {
            switch (reason) {
              case 'needsOnboarding':
                reasonText = REDEEM_BLOCK_MESSAGES.needsOnboarding;
                break;
              case 'payouts_disabled':
                reasonText = REDEEM_BLOCK_MESSAGES.payouts_disabled;
                break;
              case 'below_min':
                reasonText = REDEEM_BLOCK_MESSAGES.below_min(
                  fmt(info.minRedeemCents ?? 0, cur)
                );
                break;
              case 'has_debt':
                reasonText = REDEEM_BLOCK_MESSAGES.has_debt(
                  fmt(info.debtCents ?? 0, cur)
                );
                break;
              case 'currency_mismatch':
                reasonText = REDEEM_BLOCK_MESSAGES.currency_mismatch(
                  (status.defaultCurrency || '').toUpperCase(),
                  cur.toUpperCase()
                );
                break;
            }
          }

          const days = daysUntil(info.nextMatureAt ?? null);
          const badge =
            (info.pendingCents ?? 0) > 0 && days
              ? `libera em ${days}d`
              : (info.pendingCents ?? 0) > 0 && info.nextMatureAt
              ? new Date(info.nextMatureAt).toLocaleDateString('pt-BR')
              : null;

          return (
            <div key={cur} className="mb-4 last:mb-0">
              <div className="flex justify-between text-green-600">
                <span>Disponível</span>
                <span>{fmt(info.availableCents ?? 0, cur)}</span>
              </div>
              <div className="flex justify-between text-gray-600 items-center">
                <span>Pendente</span>
                <span className="flex items-center gap-2">
                  {fmt(info.pendingCents ?? 0, cur)}
                  {badge && (
                    <span className="rounded bg-gray-200 px-1 text-[10px]">
                      {badge}
                    </span>
                  )}
                </span>
              </div>
              {(info.debtCents ?? 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Dívida</span>
                  <span>{fmt(info.debtCents ?? 0, cur)}</span>
                </div>
              )}
              <button
                onClick={() => openRedeem(cur)}
                disabled={!canRedeem(status, summary, cur)}
                className="mt-2 w-full rounded bg-brand-pink px-3 py-1.5 text-white text-xs font-medium disabled:opacity-50"
              >
                Resgatar {cur.toUpperCase()}
              </button>
              {reason && (
                <div className="mt-1 flex items-start text-xs text-gray-700">
                  <span className="mr-1">⚠️</span>
                  <span>
                    {reasonText}
                    {reason === 'needsOnboarding' && (
                      <button onClick={handleOnboard} className="ml-1 underline">
                        Configurar Stripe
                      </button>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <ul className="mt-4 list-disc pl-4 text-[11px] text-gray-600 space-y-1">
          {RULES_COPY.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {redeemCur && summary?.byCurrency && (
        <RedeemModal
          open={!!redeemCur}
          currency={redeemCur}
          amountCents={summary.byCurrency[redeemCur]?.availableCents ?? 0}
          onConfirm={confirmRedeem}
          onClose={() => setRedeemCur(null)}
          loading={submitting}
        />
      )}
    </div>
  );
}
