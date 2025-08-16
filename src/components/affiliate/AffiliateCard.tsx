'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { track } from '@/lib/track';
import {
  useAffiliateSummary,
  canRedeem,
  getRedeemBlockReason,
} from '@/hooks/useAffiliateSummary';
import { REDEEM_BLOCK_MESSAGES, REDEEM_ERROR_MESSAGES } from '@/copy/affiliates';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';
import StripeStatusPanel from '@/components/payments/StripeStatusPanel';
import RedeemModal from '@/components/affiliate/RedeemModal';
import { useConnectStatus } from '@/hooks/useConnectStatus';
import { FaWallet, FaClock, FaExclamationTriangle, FaTrophy, FaCopy, FaCheckCircle } from 'react-icons/fa';

function fmt(amountCents: number, cur: string) {
  const n = (amountCents || 0) / 100;
  const currency = (cur || 'BRL').toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(n);
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
  const [copyState, setCopyState] = useState<'code' | 'link' | null>(null);

  const haveCode = !!session?.user?.affiliateCode;
  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), []);
  const referralLink = useMemo(() => {
    if (!haveCode) return null;
    return `${origin}/?ref=${session!.user!.affiliateCode}`;
  }, [origin, haveCode, session]);

  const handleCopy = useCallback((textToCopy: string | null, type: 'code' | 'link') => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success(`${type === 'code' ? 'Código' : 'Link'} copiado!`);
      setCopyState(type);
      setTimeout(() => setCopyState(null), 2000);
      track(`affiliate_copy_${type}`);
    }).catch(() => toast.error('Falha ao copiar.'));
  }, []);

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
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
        <SkeletonRow count={5} />
      </div>
    );
  }

  if (error || !summary || !status) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
        <ErrorState message="Erro ao carregar dados do afiliado." onRetry={refresh} />
      </div>
    );
  }

  const currencies = Object.keys(summary.byCurrency ?? {});

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-brand-pink space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-brand-dark">Painel de Afiliado</h2>
          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
            <FaTrophy className="w-4 h-4" />
            <span className="text-xs font-bold">Rank {session?.user?.affiliateRank ?? 1}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Balanço Financeiro</h3>
          {currencies.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg">
              Suas comissões aparecerão aqui assim que sua primeira indicação assinar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {currencies.map(cur => {
                const info = summary.byCurrency?.[cur];
                if (!info) return null;
                const days = daysUntil(info.nextMatureAt ?? null);
                
                return (
                  <React.Fragment key={cur}>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <FaWallet className="w-4 h-4" />
                        <span className="text-xs font-semibold">Disponível</span>
                      </div>
                      <p className="text-xl font-bold text-green-800 mt-1">{fmt(info.availableCents, cur)}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-amber-700">
                        <FaClock className="w-4 h-4" />
                        <span className="text-xs font-semibold">Pendente</span>
                      </div>
                      <p className="text-xl font-bold text-amber-800 mt-1">{fmt(info.pendingCents, cur)}</p>
                      {days && <p className="text-[11px] text-amber-600 mt-0.5">libera em {days}d</p>}
                    </div>
                    {(info.debtCents ?? 0) > 0 &&
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-red-700">
                          <FaExclamationTriangle className="w-4 h-4" />
                          <span className="text-xs font-semibold">Dívida</span>
                        </div>
                        <p className="text-xl font-bold text-red-800 mt-1">{fmt(info.debtCents, cur)}</p>
                      </div>
                    }
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Ferramentas de Divulgação</h3>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Seu Código</label>
            <div className="flex items-center gap-2">
              <div className="flex-grow font-mono text-sm bg-gray-100 px-3 py-2 rounded-md border border-gray-300">
                {haveCode ? session?.user?.affiliateCode : '...'}
              </div>
              <button onClick={() => handleCopy(session?.user?.affiliateCode || '', 'code')} disabled={!haveCode} className="p-2.5 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors disabled:opacity-50">
                {copyState === 'code' ? <FaCheckCircle className="text-green-600" /> : <FaCopy />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Seu Link de Indicação</label>
            <div className="flex items-center gap-2">
              <div className="flex-grow font-mono text-xs sm:text-sm bg-gray-100 px-3 py-2 rounded-md border border-gray-300 truncate">
                {referralLink || '...'}
              </div>
              <button onClick={() => handleCopy(referralLink || '', 'link')} disabled={!referralLink} className="p-2.5 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors disabled:opacity-50">
                {copyState === 'link' ? <FaCheckCircle className="text-green-600" /> : <FaCopy />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-500">Status do Pagamento e Resgate</h3>
          <StripeStatusPanel status={status} summary={summary} onRefresh={refreshStatus} onOnboard={handleOnboard} />

          {currencies.map((cur) => {
            const info = summary.byCurrency?.[cur];
            if (!info) return null;
            const isRedeemable = canRedeem(status, summary, cur);
            const reason = getRedeemBlockReason(status, summary, cur);
            
            let reasonText: string | null = null;
            if (reason) {
              const messageTemplate = REDEEM_BLOCK_MESSAGES[reason as keyof typeof REDEEM_BLOCK_MESSAGES];
              
              if (typeof messageTemplate === 'string') {
                reasonText = messageTemplate;
              } else if (typeof messageTemplate === 'function') {
                switch (reason) {
                  case 'below_min':
                    reasonText = (messageTemplate as (min: string) => string)(fmt(info.minRedeemCents, cur));
                    break;
                  case 'has_debt':
                    reasonText = (messageTemplate as (amount: string) => string)(fmt(info.debtCents, cur));
                    break;
                  case 'currency_mismatch':
                    reasonText = (messageTemplate as (dst: string, cur: string) => string)(status.defaultCurrency?.toUpperCase() || '', cur.toUpperCase());
                    break;
                  default:
                    reasonText = 'Não é possível resgatar no momento por um motivo desconhecido.';
                }
              } else {
                reasonText = 'Não é possível resgatar no momento. Verifique o status da sua conta.';
              }
            }

            return (
              <div key={`redeem-${cur}`} className="mt-2">
                <button
                  onClick={() => openRedeem(cur)}
                  disabled={!isRedeemable}
                  className="w-full px-4 py-3 rounded-lg bg-brand-pink text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  Resgatar {fmt(info.availableCents, cur)}
                </button>
                {reasonText && (
                  <p className="mt-2 text-xs text-center text-gray-600">
                    {reasonText}
                  </p>
                )}
              </div>
            );
          })}
        </div>
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
    </>
  );
}