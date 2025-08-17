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
          <h2 className="text-xl font-semibold text-brand-dark">Indique e Ganhe</h2>
          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
            <FaTrophy className="w-4 h-4" />
            <span className="text-xs font-bold">Rank {session?.user?.affiliateRank ?? 1}</span>
          </div>
        </div>

        {/* Seção Balanço Financeiro (Refinada) */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Balanço Financeiro</h3>
          {currencies.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 bg-gray-50 rounded-lg">
              <p>Suas comissões aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currencies.map(cur => {
                const info = summary.byCurrency?.[cur];
                if (!info) return null;
                const days = daysUntil(info.nextMatureAt ?? null);
                
                return (
                  <React.Fragment key={cur}>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between min-h-[110px]">
                      <div>
                        <div className="flex items-center gap-3 text-green-700">
                          <FaWallet className="w-6 h-6" />
                          <span className="text-sm font-semibold">Disponível</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-800 mt-2">{fmt(info.availableCents, cur)}</p>
                      </div>
                    </div>
                     <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between min-h-[110px]">
                      <div>
                        <div className="flex items-center gap-3 text-amber-700">
                          <FaClock className="w-6 h-6" />
                          <span className="text-sm font-semibold">Pendente</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-800 mt-2">{fmt(info.pendingCents, cur)}</p>
                      </div>
                      {days && <p className="text-xs text-amber-600 mt-1 whitespace-nowrap">Libera em {days} dias</p>}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Seção Ferramentas de Divulgação (Refinada) */}
        <div className="space-y-4 pt-6 border-t border-gray-200/80">
          <h3 className="text-sm font-medium text-gray-500">Compartilhe e Ganhe</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="affiliate-code" className="text-xs font-semibold text-gray-600 mb-1 block">Seu Código de Afiliado</label>
              <div className="flex items-center gap-2">
                <input id="affiliate-code" type="text" readOnly value={haveCode ? (session?.user?.affiliateCode || '') : '...'} className="flex-grow font-mono text-sm bg-gray-100 px-3 py-2 rounded-md border border-gray-300 w-full" />
                <button onClick={() => handleCopy(session?.user?.affiliateCode || '', 'code')} disabled={!haveCode} className="p-2.5 rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                  {copyState === 'code' ? <FaCheckCircle className="text-green-600" /> : <FaCopy />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="affiliate-link" className="text-xs font-semibold text-gray-600 mb-1 block">Seu Link de Indicação</label>
              <div className="flex items-center gap-2">
                <input id="affiliate-link" type="text" readOnly value={referralLink || '...'} className="flex-grow font-mono text-xs sm:text-sm bg-gray-100 px-3 py-2 rounded-md border border-gray-300 truncate w-full" />
                <button onClick={() => handleCopy(referralLink || '', 'link')} disabled={!referralLink} className="p-2.5 rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                  {copyState === 'link' ? <FaCheckCircle className="text-green-600" /> : <FaCopy />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Seção Status e Resgate */}
        <div className="space-y-4 pt-6 border-t border-gray-200/80">
          <h3 className="text-sm font-medium text-gray-500">Situação do Pagamento e Resgate</h3>
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
                  className="w-full rounded-lg bg-gradient-to-r from-brand-red to-brand-pink px-4 py-3 text-white font-semibold
                             transition-all duration-300 ease-in-out
                             hover:shadow-lg hover:shadow-brand-pink/40
                             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink
                             disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
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
