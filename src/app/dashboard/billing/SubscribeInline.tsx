"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { track } from '@/lib/track';
import { useSession } from 'next-auth/react';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { buildCheckoutUrl } from '@/app/lib/checkoutRedirect';

type Plan = 'monthly'|'annual';
type Cur = 'brl'|'usd';

interface PricesShape {
  monthly: { brl: number; usd: number };
  annual: { brl: number; usd: number };
}

export default function SubscribeInline({ prices }: { prices: PricesShape }) {
  const router = useRouter();
  const { data: session } = useSession();
  const creatorId = (session?.user as { id?: string | null } | undefined)?.id ?? null;
  const [plan, setPlan] = useState<Plan>('monthly');
  const [currency, setCurrency] = useState<Cur>('brl');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [codeError, setCodeError] = useState<string|null>(null);
  const {
    isLoading: billingStatusLoading,
    hasPremiumAccess,
    needsPaymentAction,
  } = useBillingStatus();

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
      if (!res.ok && body?.code === 'PAYMENT_ISSUE') {
        setError(body?.message ?? 'Pagamento pendente. Atualize o método de pagamento no Billing.');
        setLoading(false);
        return;
      }
      if (!res.ok && (body?.code === 'BILLING_BLOCKED_PENDING_OR_INCOMPLETE' || body?.code === 'SUBSCRIPTION_INCOMPLETE')) {
        setError(body?.message ?? 'Existe um pagamento pendente. Retome o checkout ou aborte a tentativa.');
        setLoading(false);
        return;
      }
      if (!res.ok && (body?.code === 'SUBSCRIPTION_ACTIVE_DB' || body?.code === 'SUBSCRIPTION_ACTIVE' || body?.code === 'SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN')) {
        setError(body?.message ?? 'Você já possui um plano ativo.');
        setLoading(false);
        return;
      }
      if (!res.ok && (body?.code === 'SUBSCRIPTION_NON_RENEWING' || body?.code === 'SUBSCRIPTION_NON_RENEWING_DB')) {
        setError(body?.message ?? 'Sua assinatura está com cancelamento agendado. Reative antes de assinar novamente.');
        setLoading(false);
        return;
      }
      if (!res.ok && body?.code === 'BILLING_IN_PROGRESS') {
        setError(body?.message ?? 'Já existe uma tentativa em andamento. Aguarde alguns segundos.');
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(body?.error || body?.message || 'Falha ao iniciar assinatura');
      const planLabel = plan === 'annual' ? 'anual' : 'mensal';
      const eventCurrency = currency.toUpperCase();
      const planValue = typeof priceShown === 'number' ? priceShown : null;
      track('subscription_started', {
        creator_id: creatorId,
        plan: planLabel,
        currency: eventCurrency,
        value: planValue,
      });

      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      if (body?.clientSecret) {
        router.push(buildCheckoutUrl(body.clientSecret, body.subscriptionId));
        return;
      }
      throw new Error('Resposta da API inválida. Faltando clientSecret/checkoutUrl.');
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
        <p className="text-xs text-gray-600 text-center">Você já possui um plano ativo.</p>
      )}
      {needsPaymentAction && !billingStatusLoading && (
        <p className="text-xs text-amber-700 text-center">
          Existe um pagamento pendente. Atualize o método de pagamento em Billing.
        </p>
      )}

      {/* Ações */}
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={handleStart}
          disabled={loading || hasPremiumAccess || needsPaymentAction || billingStatusLoading}
          className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-3 text-white font-semibold disabled:opacity-50"
        >
          {loading ? 'Processando…' : 'Assinar agora'}
        </button>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
          <Lock className="h-3 w-3" aria-hidden />
          Só leitura: analisamos seu Instagram, não publicamos nada e você pode cancelar quando quiser.
        </p>
      </div>
    </div>
  );
}
