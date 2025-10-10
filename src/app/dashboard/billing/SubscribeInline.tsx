"use client";

import { useState } from 'react';
import PaymentStep from '@/components/billing/PaymentStep';
import useBillingStatus from '@/app/hooks/useBillingStatus';

type Plan = 'monthly'|'annual';
type Cur = 'brl'|'usd';

interface PricesShape {
  monthly: { brl: number; usd: number };
  annual: { brl: number; usd: number };
}

export default function SubscribeInline({ prices }: { prices: PricesShape }) {
  const [plan, setPlan] = useState<Plan>('monthly');
  const [currency, setCurrency] = useState<Cur>('brl');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [codeError, setCodeError] = useState<string|null>(null);
  const { isLoading: billingStatusLoading, hasPremiumAccess } = useBillingStatus();

  const priceShown = plan === 'monthly' ? prices.monthly[currency] : prices.annual[currency];

  async function handleStart() {
    setLoading(true);
    setError(null);
    setCodeError(null);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ plan, currency: currency.toUpperCase(), affiliateCode: affiliateCode.trim() || undefined })
      });
      const body = await res.json();

      if (res.status === 422 || body?.code === 'INVALID_CODE') {
        setCodeError(body?.message ?? 'Código inválido ou expirado.');
        setLoading(false);
        return;
      }
      if (!res.ok && body?.code === 'SELF_REFERRAL') {
        setCodeError(body?.message ?? 'Você não pode usar seu próprio código.');
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(body?.error || body?.message || 'Falha ao iniciar assinatura');
      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      if (body?.clientSecret) {
        setClientSecret(body.clientSecret);
        return;
      }
      throw new Error('Resposta da API inválida. Faltando clientSecret/checkoutUrl.');
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartTrial() {
    if (hasPremiumAccess) {
      setError('Você já possui um plano ativo ou em teste.');
      return;
    }
    setLoading(true);
    setError(null);
    setCodeError(null);
    try {
      const res = await fetch('/api/billing/checkout/trial', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ plan, currency: currency.toUpperCase(), affiliateCode: affiliateCode.trim() || undefined })
      });
      const body = await res.json();
      if (res.status === 409) {
        throw new Error(body?.message || 'Você já possui um plano ativo ou em teste.');
      }
      if (!res.ok || !body?.url) {
        if (body?.code === 'SELF_REFERRAL') { setCodeError(body?.message ?? 'Você não pode usar seu próprio código.'); return; }
        if (body?.code === 'INVALID_CODE') { setCodeError(body?.message ?? 'Código inválido ou expirado.'); return; }
        throw new Error(body?.error || body?.message || 'Falha ao iniciar teste gratuito');
      }
      window.location.href = body.url;
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full grid gap-5">
      {/* Seletor Plano/Moeda */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-300 p-1 bg-gray-50">
          <button
            type="button"
            onClick={() => setPlan('monthly')}
            className={`px-3 py-1.5 text-sm rounded-lg ${plan==='monthly' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
          >Mensal</button>
          <button
            type="button"
            onClick={() => setPlan('annual')}
            className={`px-3 py-1.5 text-sm rounded-lg ${plan==='annual' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
          >Anual</button>
        </div>
        <div className="inline-flex rounded-xl border border-gray-300 p-1 bg-gray-50">
          <button
            type="button"
            onClick={() => setCurrency('brl')}
            className={`px-3 py-1.5 text-sm rounded-lg ${currency==='brl' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
          >BRL</button>
          <button
            type="button"
            onClick={() => setCurrency('usd')}
            className={`px-3 py-1.5 text-sm rounded-lg ${currency==='usd' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
          >USD</button>
        </div>
      </div>

      {/* Valor */}
      <div className="text-center">
        <div className="text-3xl font-extrabold tracking-tight">
          {currency === 'brl' ? 'R$ ' : '$ '}{Number(priceShown || 0).toFixed(2)} <span className="text-base font-medium text-gray-500">/{plan==='monthly'?'mês':'ano'}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.</p>
      </div>

      {/* Código de afiliado */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cupom / Código de Afiliado (opcional)</label>
        <input
          value={affiliateCode}
          onChange={e=>setAffiliateCode(e.target.value)}
          placeholder="Ex.: ABC123"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
        {codeError && <p className="text-sm text-red-600 mt-1">{codeError}</p>}
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      {hasPremiumAccess && !billingStatusLoading && (
        <p className="text-xs text-gray-600 text-center">Você já possui um plano ativo ou em período de teste.</p>
      )}

      {/* Ações */}
      {!clientSecret && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleStartTrial}
            disabled={loading || hasPremiumAccess || billingStatusLoading}
            className="w-full rounded-xl border border-gray-900 px-4 py-3 text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Preparando…' : 'Teste gratuito (7 dias)'}
          </button>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-3 text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Processando…' : 'Assinar agora'}
          </button>
        </div>
      )}

      {/* Pagamento inline */}
      {clientSecret && (
        <div className="rounded-xl border border-gray-200 p-4">
          <PaymentStep clientSecret={clientSecret} onClose={() => { /* no close; stay on page */ }} />
        </div>
      )}
    </div>
  );
}
