'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

type Plan = 'monthly' | 'annual';
type Currency = 'BRL' | 'USD';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PlanTeaser() {
  const { data: session } = useSession();
  const isActive = session?.user?.planStatus === 'active';

  // Se já é ativo, não mostra o card (fica invisível)
  if (isActive) return null;

  const { data, isLoading } = useSWR('/api/billing/prices', fetcher, { revalidateOnFocus: false });
  const prices = (data?.prices ?? []) as {
    plan: Plan; currency: Currency; unitAmount: number | null;
  }[];

  const [currency, setCurrency] = useState<Currency>('BRL');
  const [plan, setPlan] = useState<Plan>('monthly');
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [promotion, setPromotion] = useState('');
  const [affiliate, setAffiliate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sp = useSearchParams();
  const router = useRouter();

  // Pré-preenche afiliado por ?ref=
  useEffect(() => {
    const ref = sp.get('ref');
    if (ref) setAffiliate(ref.toUpperCase());
  }, [sp]);

  const current = useMemo(
    () => prices.find(p => p.plan === plan && p.currency === currency) || null,
    [prices, plan, currency]
  );

  const priceMonthly = useMemo(
    () => prices.find(p => p.plan === 'monthly' && p.currency === currency)?.unitAmount ?? null,
    [prices, currency]
  );
  const priceAnnual = useMemo(
    () => prices.find(p => p.plan === 'annual' && p.currency === currency)?.unitAmount ?? null,
    [prices, currency]
  );

  const savingsPct = useMemo(() => {
    if (!priceMonthly || !priceAnnual) return null;
    const fullYear = priceMonthly * 12;
    const save = (fullYear - priceAnnual) / fullYear;
    return Math.round(save * 100);
  }, [priceMonthly, priceAnnual]);

  const priceLabel = useMemo(() => {
    if (!current?.unitAmount) return '—';
    const fmt = new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency', currency, minimumFractionDigits: 2
    });
    return fmt.format(current.unitAmount / 100) + (plan === 'monthly' ? '/mês' : '/ano');
  }, [current, currency, plan]);

  async function handleSubscribe() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const body: any = { plan, currency };
      if (affiliate.trim()) body.affiliateCode = affiliate.trim();
      if (showCoupon) {
        if (coupon.trim()) body.coupon = coupon.trim();
        if (promotion.trim()) body.promotion_code = promotion.trim();
      }

      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json?.error || 'Falha ao iniciar assinatura.');
        return;
      }
      // você pode ter uma página de checkout; se tiver, redirecione:
      if (json?.clientSecret) {
        router.push(`/dashboard/billing/checkout?cs=${encodeURIComponent(json.clientSecret)}&sid=${encodeURIComponent(json.subscriptionId)}`);
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          Sem fidelidade
        </span>
        {savingsPct ? (
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
            {savingsPct}% mais barato no anual
          </span>
        ) : null}
      </div>

      <h2 className="mb-3 text-center text-2xl font-semibold">Plano Data2Content</h2>

      {/* Alternadores */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {(['BRL','USD'] as Currency[]).map(c => (
          <button key={c}
            onClick={() => setCurrency(c)}
            className={`rounded-full px-3 py-1 text-sm ${currency===c?'bg-black text-white':'bg-gray-100 text-gray-700'}`}>{c}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {(['monthly','annual'] as Plan[]).map(p => (
          <button key={p}
            onClick={() => setPlan(p)}
            className={`rounded-full px-3 py-1 text-sm ${plan===p?'bg-black text-white':'bg-gray-100 text-gray-700'}`}>
            {p==='monthly' ? 'Mensal' : 'Anual'}
          </button>
        ))}
      </div>

      {/* Preço */}
      <div className="mb-6 text-center">
        <div className="text-4xl font-extrabold tracking-tight">
          {isLoading ? '—' : priceLabel}
        </div>
        {plan==='annual' && priceMonthly && priceAnnual && (
          <p className="mt-1 text-xs text-gray-500">
            Equivalente a {(priceAnnual/(priceMonthly*12) * 100).toFixed(0)}% do preço mensal no ano.
          </p>
        )}
      </div>

      {/* Benefícios */}
      <ul className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <li>✅ Ideias de conteúdo geradas por IA</li>
        <li>✅ Análises automáticas do Instagram</li>
        <li>✅ Sugestões personalizadas por nicho</li>
        <li>✅ Relatórios e alertas de performance</li>
      </ul>

      {/* Afiliado */}
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">Código de Afiliado (opcional)</label>
        <input
          value={affiliate}
          onChange={(e) => setAffiliate(e.target.value.toUpperCase())}
          placeholder="Ex: JLS29D"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-black"
          maxLength={10}
        />
        <p className="mt-1 text-xs text-gray-500">
          Use o código de quem te indicou. Só pode ser aplicado uma vez e não pode ser o seu próprio.
        </p>
      </div>

      {/* Cupom / promotion — escondido por padrão */}
      <button
        className="mb-2 text-left text-xs text-gray-600 underline"
        onClick={() => setShowCoupon(v => !v)}
      >
        {showCoupon ? 'Ocultar cupom' : 'Tenho um cupom'}
      </button>
      {showCoupon && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder="Cupom (opcional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
          <input
            value={promotion}
            onChange={(e) => setPromotion(e.target.value)}
            placeholder="Promotion code (opcional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
        </div>
      )}

      {/* CTA */}
      {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}
      <button
        onClick={handleSubscribe}
        disabled={loading || !current}
        className="w-full rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {loading ? 'Iniciando…' : 'Assinar agora'}
      </button>

      <p className="mt-2 text-center text-xs text-gray-500">
        Pagamento seguro via Stripe. Cancele quando quiser.
      </p>
    </div>
  );
}

