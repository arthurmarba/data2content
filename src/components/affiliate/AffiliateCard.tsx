'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAffiliateSummary, canRedeem } from '@/hooks/useAffiliateSummary';

function fmt(amountCents: number, cur: string) {
  const n = amountCents / 100;
  const locale = cur === 'brl' ? 'pt-BR' : 'en-US';
  const currency = cur.toUpperCase();
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

export default function AffiliateCard() {
  const { data: session } = useSession();
  const { summary, status, loading, refresh } = useAffiliateSummary();
  const [redeemCur, setRedeemCur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const track = (event: string, props?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, props);
    }
  };

  const handleCopyCode = () => {
    if (session?.user?.affiliateCode) {
      navigator.clipboard.writeText(session.user.affiliateCode);
      track('affiliate_copy_code', { userId: session.user.id });
    }
  };

  const handleCopyLink = () => {
    if (session?.user?.affiliateCode) {
      const link = `${window.location.origin}/?ref=${session.user.affiliateCode}`;
      navigator.clipboard.writeText(link);
      track('affiliate_copy_link', { userId: session.user.id });
    }
  };

  const handleOnboard = async () => {
    track('affiliate_open_onboarding', { userId: session?.user?.id });
    try {
      await fetch('/api/affiliate/connect/create', { method: 'POST' });
      const res = await fetch('/api/affiliate/connect/link', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    }
  };

  const openRedeem = (cur: string) => {
    setRedeemCur(cur);
    track('affiliate_redeem_click', {
      userId: session?.user?.id,
      currency: cur,
      balanceCents: summary?.balances?.[cur] ?? 0,
    });
  };

  const confirmRedeem = async () => {
    if (!redeemCur) return;
    const amount = summary?.balances?.[redeemCur] ?? 0;
    track('affiliate_redeem_confirm', {
      userId: session?.user?.id,
      currency: redeemCur,
      amountCents: amount,
    });
    setSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/redeem', {
        method: 'POST',
        body: JSON.stringify({ currency: redeemCur }),
      });
      const data = await res.json();
      if (!res.ok) {
        track('affiliate_redeem_error', {
          userId: session?.user?.id,
          currency: redeemCur,
          code: res.status,
          message: data.error || data.message,
        });
        toast.error(data.error || data.message || 'Falha ao solicitar resgate.');
      } else {
        track('affiliate_redeem_success', {
          userId: session?.user?.id,
          currency: redeemCur,
          mode: data.mode,
          transactionId: data.transactionId,
        });
        toast.success(data.mode === 'auto' ? 'Transferência criada' : 'Solicitação registrada');
        await refresh();
      }
    } catch (e) {
      toast.error('Falha ao solicitar resgate. Tente novamente.');
    } finally {
      setSubmitting(false);
      setRedeemCur(null);
    }
  };

  if (loading || !summary || !status) {
    return (
      <div className="rounded-2xl border p-4">
        <p className="text-sm text-gray-500">Carregando dados do afiliado...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="mb-3 text-lg font-semibold">Programa de Afiliados</h3>
      <div className="space-y-2">
        <div className="rounded-xl bg-gray-50 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600">Cód. Afiliado</p>
            <p className="font-mono text-sm">{session?.user?.affiliateCode || '—'}</p>
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
              <p className="text-sm text-gray-500">Seu código será gerado após o primeiro login.</p>
            )}
          </div>
          {session?.user?.affiliateCode && (
            <button onClick={handleCopyLink} className="text-xs underline ml-2">
              Copiar
            </button>
          )}
        </div>

        <div className="rounded-xl bg-gray-50 p-3 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span>Status Stripe Connect:</span>
            <span className="font-medium">
              {status.payouts_enabled ? 'Verificada' : status.needsOnboarding ? 'Pendente' : 'Desabilitada'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Moeda destino:</span>
            <span className="uppercase">{status.default_currency}</span>
          </div>
          {status.disabled_reason && (
            <p className="text-xs text-red-600">{status.disabled_reason}</p>
          )}
          {status.needsOnboarding && (
            <button
              onClick={handleOnboard}
              className="mt-1 w-full rounded bg-brand-pink px-3 py-1.5 text-white text-xs font-medium hover:opacity-90"
            >
              Configurar Stripe
            </button>
          )}
          <button
            onClick={() => {
              refresh();
              track('affiliate_refresh_status', { userId: session?.user?.id });
            }}
            className="w-full rounded border px-3 py-1.5 text-xs font-medium"
          >
            Atualizar status
          </button>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="mb-2 text-xs text-gray-600">Saldos</p>
          {!Object.keys(summary.balances || {}).length && (
            <p className="text-sm text-gray-500">Sem saldo ainda.</p>
          )}
          {!!Object.keys(summary.balances || {}).length && (
            <ul className="space-y-2">
              {Object.entries(summary.balances).map(([cur, cents]) => {
                const debt = summary.debt?.[cur] ?? 0;
                const incompatible = cur !== status.default_currency;
                return (
                  <li key={cur} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="uppercase text-xs text-gray-500">{cur}</span>
                      <span className="font-medium">{fmt(cents, cur)}</span>
                    </div>
                    {debt > 0 && (
                      <p className="text-xs text-red-600">Dívida: {fmt(debt, cur)}</p>
                    )}
                    {incompatible && (
                      <p className="text-xs text-amber-600">
                        Sua conta Stripe recebe em {status.default_currency.toUpperCase()}. Saldos em {cur.toUpperCase()} não podem ser sacados.
                      </p>
                    )}
                    <button
                      onClick={() => openRedeem(cur)}
                      disabled={!canRedeem(status, summary, cur)}
                      title={
                        !status.payouts_enabled
                          ? 'Conecte sua conta Stripe para sacar.'
                          : debt > 0
                          ? `Você possui dívida de ${fmt(debt, cur)} por reembolsos.`
                          : cents < (summary.min[cur] || 0)
                          ? `Mínimo para saque: ${fmt(summary.min[cur] || 0, cur)}.`
                          : incompatible
                          ? `Sua conta recebe em ${status.default_currency.toUpperCase()}; converta ou use outra conta.`
                          : ''
                      }
                      className="mt-1 w-full rounded bg-brand-pink px-3 py-1.5 text-white text-xs font-medium disabled:opacity-50"
                    >
                      Resgatar {cur.toUpperCase()}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {redeemCur && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-4 w-80 space-y-3">
            <h4 className="font-medium text-sm">
              Resgatar {fmt(summary.balances[redeemCur], redeemCur)} {redeemCur.toUpperCase()}
            </h4>
            <p className="text-xs text-gray-600">
              Você vai transferir todo o saldo disponível em {redeemCur.toUpperCase()} para sua conta Stripe Connect.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setRedeemCur(null)} className="px-3 py-1 text-sm">
                Cancelar
              </button>
              <button
                disabled={submitting}
                onClick={confirmRedeem}
                className="px-3 py-1 rounded bg-brand-pink text-white text-sm disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
