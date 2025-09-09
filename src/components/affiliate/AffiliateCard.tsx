'use client';

import React, { useMemo, useState, useCallback } from 'react';
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
import ErrorState from '@/components/ui/ErrorState';
import StripeStatusPanel from '@/components/payments/StripeStatusPanel';
import RedeemModal from '@/components/affiliate/RedeemModal';
import { useConnectStatus } from '@/hooks/useConnectStatus';
import {
  FaCopy,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaShareAlt,
  FaInfoCircle,
} from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';

type Variant = 'default' | 'mediakit';
interface AffiliateCardProps {
  variant?: Variant;
}

/* helpers */
function fmt(amountCents: number, cur: string) {
  const n = (amountCents || 0) / 100;
  const currency = (cur || 'BRL').toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
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

export default function AffiliateCard({ variant = 'mediakit' }: AffiliateCardProps) {
  const { data: session, update: updateSession } = useSession();
  const { summary, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useAffiliateSummary();
  const { status, isLoading: statusLoading, error: statusError, refresh: refreshStatus } = useConnectStatus();

  const loading = summaryLoading || statusLoading;
  const error = summaryError || statusError;
  const refresh = async () => { await Promise.all([refreshSummary(), refreshStatus()]); };

  const [redeemCur, setRedeemCur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<'code' | 'link' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [a11yMsg, setA11yMsg] = useState<string>('');

  const haveCode = !!session?.user?.affiliateCode;
  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), []);
  const referralLink = useMemo(() => {
    if (!haveCode) return null;
    return `${origin}/?ref=${session!.user!.affiliateCode}`;
  }, [origin, haveCode, session]);

  const handleCopy = useCallback((textToCopy: string | null, type: 'code' | 'link') => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const what = type === 'code' ? 'Código' : 'Link';
      toast.success(`${what} copiado!`);
      setA11yMsg(`${what} copiado para a área de transferência.`);
      setCopyState(type);
      setTimeout(() => setCopyState(null), 1200);
      track(`affiliate_copy_${type}`);
    }).catch(() => toast.error('Falha ao copiar.'));
  }, []);

  const handleShare = useCallback(async (url: string | null) => {
    if (!url) return;
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: 'Meu link de afiliado', url });
        track('affiliate_share_native');
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado para compartilhar!');
        track('affiliate_share_fallback_copy');
      }
    } catch {
      // cancelado/erro — ignora
    }
  }, []);

  const openStripe = useCallback(async () => {
    try {
      const createRes = await fetch('/api/affiliate/connect/create', { method: 'POST' });
      const _c = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(_c?.error || 'Falha ao preparar conta Stripe');
      const linkRes = await fetch('/api/affiliate/connect/link', { method: 'POST' });
      const data = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok || !data?.url) throw new Error(data?.error || 'Falha ao gerar link do Stripe');
      window.open(data.url, '_blank');
    } catch (e:any) {
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
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] items-center">
          <div className="h-7 bg-gray-100 rounded w-36" />
          <div className="h-10 bg-gray-100 rounded-full" />
          <div className="h-10 bg-gray-100 rounded-md w-full sm:w-[160px] justify-self-end" />
        </div>
      </div>
    );
  }

  if (error || !summary || !status) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
        <ErrorState message="Erro ao carregar dados do afiliado." onRetry={refresh} />
      </div>
    );
  }

  const currencies = Object.keys(summary.byCurrency ?? {});
  const primaryCur = (status?.defaultCurrency || currencies[0] || 'brl').toLowerCase();
  const primaryInfo = summary.byCurrency?.[primaryCur];

  // valores com fallback zero
  const availableCents = primaryInfo?.availableCents ?? 0;
  const pendingCents = primaryInfo?.pendingCents ?? 0;

  // motivo de bloqueio (se houver)
  const reason = primaryCur ? getRedeemBlockReason(status, summary, primaryCur) : null;
  let reasonText: string | null = null;
  if (reason) {
    const tpl = REDEEM_BLOCK_MESSAGES[reason as keyof typeof REDEEM_BLOCK_MESSAGES];
    if (typeof tpl === 'string') {
      reasonText = tpl;
    } else if (typeof tpl === 'function') {
      switch (reason) {
        case 'below_min':
          reasonText = (tpl as any)(fmt(primaryInfo?.minRedeemCents ?? 0, primaryCur));
          break;
        case 'has_debt':
          reasonText = (tpl as any)(fmt(primaryInfo?.debtCents ?? 0, primaryCur));
          break;
        case 'currency_mismatch':
          reasonText = (tpl as any)(
            (status.defaultCurrency || '').toUpperCase(),
            primaryCur.toUpperCase()
          );
          break;
        default:
          reasonText = 'Não é possível resgatar no momento.';
      }
    }
  }
  const isRedeemable = primaryCur ? canRedeem(status, summary, primaryCur) : false;

  // pendências
  const pendingDays = daysUntil(primaryInfo?.nextMatureAt ?? null);
  const pendingDate = formatShortDate(primaryInfo?.nextMatureAt ?? null);
  const totalCycle = Math.max(availableCents + pendingCents, 1);
  const progressPct = Math.min(100, Math.max(0, Math.round((availableCents / totalCycle) * 100)));

  return (
    <>
      <span aria-live="polite" className="sr-only">{a11yMsg}</span>

      {/* CARD — colapsado (todo branco / neutro) */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] items-center">
          {/* Saldo */}
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-none tracking-tight tabular-nums">
              {fmt(availableCents, primaryCur)}
            </span>
            <span className="hidden sm:inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700">
              {primaryCur.toUpperCase()}
            </span>
          </div>

          {/* Link (pill) com divisória neutra */}
          <div className="min-w-0 border-t border-gray-200 pt-2 mt-1 sm:mt-0 sm:pt-0 sm:border-t-0 sm:border-l sm:border-gray-200 sm:pl-3">
            <div
              className="group flex w-full items-center rounded-full border border-gray-300 bg-gray-50 pl-3 pr-1.5 h-10 hover:bg-gray-100 cursor-pointer focus-within:ring-2 focus-within:ring-gray-300"
              onClick={() => handleCopy(referralLink || '', 'link')}
              title={copyState === 'link' ? 'Copiado!' : 'Clique para copiar'}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCopy(referralLink || '', 'link')}
              aria-label="Link de indicação (clique para copiar)"
            >
              <span className="flex-1 min-w-0 font-mono text-[11px] sm:text-xs truncate text-gray-900">
                {referralLink || `${origin || 'https://seusite.com'}/?ref=—`}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleShare(referralLink || ''); }}
                disabled={!referralLink}
                className="mr-1.5 sm:hidden grid place-items-center w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                aria-label="Compartilhar link"
              >
                <FaShareAlt />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(referralLink || '', 'link'); }}
                disabled={!referralLink}
                className="grid place-items-center w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                aria-label="Copiar link de indicação"
                title={copyState === 'link' ? 'Copiado!' : 'Copiar'}
              >
                {copyState === 'link' ? <FaCheckCircle className="text-gray-700" /> : <FaCopy />}
              </button>
            </div>
          </div>

          {/* CTA resgate — neutro; preto quando habilitado */}
          <div className="w-full sm:w-[160px] sm:justify-self-end">
            <button
              onClick={() => primaryCur && openRedeem(primaryCur)}
              disabled={!isRedeemable || submitting}
              title={!isRedeemable && reasonText ? reasonText : undefined}
              className={[
                'w-full h-10 rounded-md px-4 text-sm font-semibold transition-colors',
                isRedeemable && !submitting
                  ? 'bg-black text-white hover:bg-gray-900'
                  : 'bg-white text-gray-600 border border-gray-300 cursor-not-allowed',
              ].join(' ')}
            >
              {submitting ? 'Processando…' : `Resgatar ${fmt(availableCents, primaryCur)}`}
            </button>
          </div>
        </div>

        {/* Informativo visível (neutro) */}
        <div className="mt-2 sm:mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] sm:text-xs text-gray-800 flex items-start gap-2">
          <FaInfoCircle className="mt-[2px] shrink-0 text-gray-500" />
          <p className="leading-snug">
            <span className="font-semibold">Comissão:</span> você recebe <span className="font-semibold">50% na 1ª fatura</span> de quem assinar com seu <span className="font-medium">link</span> ou <span className="font-medium">código</span>. Compartilhar o link é a forma mais fácil.
          </p>
        </div>

        {/* Toggle de detalhes */}
        <div className="mt-1.5 flex justify-end">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-800"
          >
            {expanded ? <>Ocultar detalhes <FaChevronUp className="w-3 h-3" /></> : <>Ver detalhes <FaChevronDown className="w-3 h-3" /></>}
          </button>
        </div>

        {/* EXPANDIDO — branco/neutro */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3"
            >
              <div className="rounded-xl bg-white border border-gray-200 p-4 sm:p-5 shadow-sm space-y-5">
                {/* Header + Stripe */}
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Indique e Ganhe</h3>
                  <button
                    onClick={openStripe}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50"
                  >
                    {status.payoutsEnabled ? 'Abrir Stripe' : 'Configurar Stripe'}
                  </button>
                </div>

                {/* Destaque do Link (neutro) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Link de indicação</label>
                  <div className="rounded-lg border-2 border-gray-300 bg-white p-2.5 sm:p-3">
                    <div
                      className="group flex items-center rounded-full ring-1 ring-gray-300 bg-gray-50 pl-3 pr-2 h-11 focus-within:ring-2 focus-within:ring-gray-400"
                      onClick={() => handleCopy(referralLink || '', 'link')}
                      title={copyState === 'link' ? 'Copiado!' : 'Clique para copiar'}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCopy(referralLink || '', 'link')}
                      aria-label="Link de indicação (clique para copiar)"
                    >
                      <span className="flex-1 min-w-0 font-mono text-[12px] sm:text-[13px] truncate text-gray-900">
                        {referralLink || `${origin || 'https://seusite.com'}/?ref=—`}
                      </span>
                      <div className="ml-2 flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShare(referralLink || ''); }}
                          disabled={!referralLink}
                          className="grid place-items-center w-9 h-9 rounded-full bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
                          aria-label="Compartilhar link"
                          title="Compartilhar"
                        >
                          <FaShareAlt />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(referralLink || '', 'link'); }}
                          disabled={!referralLink}
                          className="grid place-items-center w-9 h-9 rounded-full bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
                          aria-label="Copiar link"
                          title={copyState === 'link' ? 'Copiado!' : 'Copiar'}
                        >
                          {copyState === 'link' ? <FaCheckCircle className="text-gray-700" /> : <FaCopy />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pendências + progresso (cinza) */}
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-800">
                      <span className="text-gray-500 mr-2">Pendente:</span>
                      <span className="font-semibold tabular-nums">{fmt(pendingCents, primaryCur)}</span>
                    </div>
                    {(pendingDays || pendingDate) && (
                      <div className="text-[12px] text-gray-600">
                        Libera {pendingDays ? `em ${pendingDays} dias` : ''}{pendingDays && pendingDate ? ' · ' : ''}{pendingDate || ''}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2 bg-gray-400"
                      style={{ width: `${progressPct}%` }}
                      aria-label={`Progresso do ciclo de comissão: ${progressPct}% disponível`}
                    />
                  </div>
                </div>

                {/* Código (neutro) */}
                <div>
                  <label htmlFor="affiliate-code" className="text-xs font-semibold text-gray-700 mb-1 block">Código</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="affiliate-code"
                      type="text"
                      readOnly
                      value={haveCode ? (session?.user?.affiliateCode || '') : ''}
                      placeholder="—"
                      className="flex-grow font-mono text-xs bg-white px-3 py-2 rounded-md border border-gray-300 text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                      onClick={() => handleCopy(session?.user?.affiliateCode || '', 'code')}
                      disabled={!haveCode}
                      className="p-2.5 rounded-md bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      aria-label="Copiar código"
                      title={copyState === 'code' ? 'Copiado!' : 'Copiar'}
                    >
                      {copyState === 'code' ? <FaCheckCircle className="text-gray-700" /> : <FaCopy />}
                    </button>
                  </div>
                </div>

                {/* Outras moedas (se houver) */}
                {currencies.length > 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {currencies.map((cur) => {
                      const info = summary.byCurrency?.[cur];
                      if (!info || cur === primaryCur) return null;
                      const d = daysUntil(info.nextMatureAt ?? null);
                      const dt = formatShortDate(info.nextMatureAt ?? null);
                      return (
                        <div key={cur} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 mb-1">
                            Moeda: <span className="font-semibold text-gray-900">{cur.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Disponível</span>
                            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt(info.availableCents ?? 0, cur)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-gray-600">Pendente</span>
                            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt(info.pendingCents ?? 0, cur)}</span>
                          </div>
                          {(d || dt) && (
                            <div className="mt-1 text-[11px] text-gray-600">
                              Libera {d ? `em ${d} dias` : ''}{d && dt ? ' · ' : ''}{dt || ''}
                            </div>
                          )}
                          <div className="mt-3">
                            <button
                              onClick={() => openRedeem(cur)}
                              disabled={!canRedeem(status, summary, cur)}
                              className="w-full rounded-md bg-black px-3 py-2 text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-60"
                            >
                              Resgatar {fmt(info.availableCents ?? 0, cur)}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Status / Stripe */}
                <StripeStatusPanel status={status} summary={summary} onRefresh={refreshStatus} onOnboard={openStripe} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de resgate */}
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
