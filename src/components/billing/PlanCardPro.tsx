'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck } from 'react-icons/fa';

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type Plan = 'monthly' | 'annual';
type Currency = 'BRL' | 'USD';

interface PlanCardProProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCurrency?: Currency;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PlanCardPro({ defaultCurrency = 'BRL', className, ...props }: PlanCardProProps) {
  const { data, isLoading } = useSWR('/api/billing/prices', fetcher, { revalidateOnFocus: false });
  const prices = (data?.prices ?? []) as { plan: Plan; currency: Currency; unitAmount: number | null }[];

  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [plan, setPlan] = useState<Plan>('monthly');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = sp.get('ref');
    if (ref) setAffiliateCode(ref.toUpperCase());
  }, [sp]);

  const current = useMemo(() => prices.find(p => p.plan === plan && p.currency === currency) || null, [prices, plan, currency]);
  const priceMonthly = useMemo(() => prices.find(p => p.plan === 'monthly' && p.currency === currency)?.unitAmount ?? null, [prices, currency]);
  const priceAnnual = useMemo(() => prices.find(p => p.plan === 'annual' && p.currency === currency)?.unitAmount ?? null, [prices, currency]);

  const savingsPct = useMemo(() => {
    if (!priceMonthly || !priceAnnual) return null;
    const fullYear = priceMonthly * 12;
    const save = (fullYear - priceAnnual) / fullYear;
    return Math.round(save * 100);
  }, [priceMonthly, priceAnnual]);

  const priceLabel = useMemo(() => {
    if (!current?.unitAmount) return '—';
    const fmt = new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
    return fmt.format(current.unitAmount / 100) + (plan === 'monthly' ? '/mês' : '/ano');
  }, [current, currency, plan]);

  async function handleSubscribe() {
    try {
      setLoading(true);
      setError(null);
      const body: any = { plan, currency, affiliateCode: affiliateCode || undefined };
      if (showCoupon && coupon.trim()) body.coupon = coupon.trim();
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Falha ao iniciar assinatura.');
        return;
      }
      if (json?.clientSecret) {
        router.push(`/dashboard/billing/checkout?cs=${encodeURIComponent(json.clientSecret)}&sid=${encodeURIComponent(json.subscriptionId)}`);
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div {...props} className={cn('rounded-2xl border bg-white p-6 shadow-sm w-full', className)}>
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Sem fidelidade</span>
        {savingsPct ? (
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">{savingsPct}% mais barato no anual</span>
        ) : null}
      </div>

      <h2 className="mb-3 text-center text-2xl font-semibold">Plano Data2Content</h2>

      <div className="mb-5 flex items-center justify-center gap-2">
        {(['BRL', 'USD'] as Currency[]).map(c => (
          <button key={c} onClick={() => setCurrency(c)} className={`rounded-full px-3 py-1 text-sm ${currency === c ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>{c}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {(['monthly', 'annual'] as Plan[]).map(p => (
          <button key={p} onClick={() => setPlan(p)} className={`rounded-full px-3 py-1 text-sm ${plan === p ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>{p === 'monthly' ? 'Mensal' : 'Anual'}</button>
        ))}
      </div>

      <div className="mb-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={priceLabel}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-4xl font-extrabold tracking-tight"
          >
            {isLoading ? '—' : priceLabel}
          </motion.div>
        </AnimatePresence>
        {plan === 'annual' && priceMonthly && priceAnnual && (
          <p className="mt-1 text-xs text-gray-500">
            Equivalente a {(priceAnnual / (priceMonthly * 12) * 100).toFixed(0)}% do preço mensal no ano.
          </p>
        )}
      </div>

      <ul className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
        {[
          'Ideias de conteúdo geradas por IA',
          'Análises automáticas do Instagram',
          'Sugestões personalizadas por nicho',
          'Relatórios e alertas de performance',
        ].map(b => (
          <li key={b} className="flex items-start gap-2">
            <FaCheck className="mt-1 h-4 w-4 text-green-600" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">Código de Afiliado (opcional)</label>
        <input
          value={affiliateCode}
          onChange={e => setAffiliateCode(e.target.value.toUpperCase())}
          placeholder="Ex: JLS29D"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-black"
          maxLength={10}
        />
        <p className="mt-1 text-xs text-gray-500">Não use o seu próprio código.</p>
      </div>

      <button className="mb-2 text-left text-xs text-gray-600 underline" onClick={() => setShowCoupon(v => !v)}>
        {showCoupon ? 'Ocultar cupom' : 'Tenho um cupom?'}
      </button>
      {showCoupon && (
        <div className="mb-4">
          <input
            value={coupon}
            onChange={e => setCoupon(e.target.value)}
            placeholder="Cupom"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubscribe}
        disabled={loading || !current}
        className="w-full rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {loading ? 'Iniciando…' : 'Assinar agora'}
      </button>

      <p className="mt-2 text-center text-xs text-gray-500">
        Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
      </p>

      <div className="mt-4 space-y-2 text-sm">
        <details className="group">
          <summary className="cursor-pointer font-medium text-gray-700">Posso cancelar quando quiser?</summary>
          <p className="mt-1 text-xs text-gray-600">Sim, direto no painel, sem multa.</p>
        </details>
        <details className="group">
          <summary className="cursor-pointer font-medium text-gray-700">Como funciona o código de afiliado?</summary>
          <p className="mt-1 text-xs text-gray-600">Você só pode usar o código de quem te indicou. Uma única vez.</p>
        </details>
        <details className="group">
          <summary className="cursor-pointer font-medium text-gray-700">Quais formas de pagamento?</summary>
          <p className="mt-1 text-xs text-gray-600">Cartão de crédito via Stripe (BRL ou USD).</p>
        </details>
      </div>
    </div>
  );
}

