'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from 'use-debounce';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { isPlanActiveLike } from '@/utils/planStatus';

type Plan = 'monthly' | 'annual';
type Currency = 'BRL' | 'USD';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type InvoicePreview = {
  currency: string;
  subtotal: number;        // centavos
  discountsTotal: number;  // centavos
  tax: number;             // centavos
  total: number;           // centavos
  nextCycleAmount: number; // centavos
  affiliateApplied: boolean;
};

const formatCurrency = (amount: number, currency: Currency | string) =>
  new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: typeof currency === 'string' ? currency : (currency as Currency),
  }).format((amount ?? 0) / 100);

function PlanTeaserContent() {

  const router = useRouter();
  const sp = useSearchParams();

  // Preços base (para economia e fallback)
  const { data, isLoading } = useSWR('/api/billing/prices', fetcher, { revalidateOnFocus: false });
  const prices = useMemo(() => {
    const raw = Array.isArray(data?.prices)
      ? (data?.prices as { plan: Plan; currency: Currency; unitAmount: number | null }[])
      : [];
    return raw;
  }, [data?.prices]);

  const [currency, setCurrency] = useState<Currency>('BRL');
  const [plan, setPlan] = useState<Plan>('monthly');

  // Afiliado / cupom/promotion (mantém compatibilidade do seu subscribe)
  const [affiliate, setAffiliate] = useState('');
  const [debouncedAffiliate] = useDebounce(affiliate, 400);
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [promotion, setPromotion] = useState('');

  // Estados de validação/aplicação
  const [applyLoading, setApplyLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);

  // Prévia (preço “real” com/sem afiliado) e loading
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pré-preenche afiliado por ?ref=
  useEffect(() => {
    const ref = sp.get('ref');
    if (ref) setAffiliate(ref.toUpperCase());
  }, [sp]);

  // Util para buscar preview (com/sem código)
  const fetchPreview = useCallback(
    async (p: Plan, c: Currency, code: string) => {
      const res = await fetch('/api/billing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p, currency: c, affiliateCode: code }),
      });
      const data = await res.json();
      return { ok: res.ok, data };
    },
    []
  );

  // Carrega prévia sempre que plano/moeda/código mudam (c/ debounce no código)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsPreviewLoading(true);
      setErrorMsg(null);
      setAffiliateError(null);
      try {
        const { ok, data } = await fetchPreview(plan, currency, debouncedAffiliate || '');
        if (!ok) {
          // Se erro for de código inválido/self-referral, trata como erro de input e restaura preview sem código
          const msg: string = data?.message || data?.error || '';
          const lower = (msg || '').toLowerCase();
          if (data?.code === 'SELF_REFERRAL') {
            if (!cancelled) setAffiliateError('Você não pode usar seu próprio código.');
          } else if (data?.code === 'INVALID_CODE' || lower.includes('inválido')) {
            if (!cancelled) setAffiliateError(data?.message || 'Código inválido ou expirado.');
          } else {
            if (!cancelled) setErrorMsg(msg || 'Erro ao calcular o valor.');
          }
          const fb = await fetchPreview(plan, currency, '');
          if (!cancelled) setPreview(fb.data ?? null);
        } else {
          if (!cancelled) setPreview(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message || 'Erro ao calcular o valor.');
          setPreview(null);
        }
      } finally {
        if (!cancelled) setIsPreviewLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [plan, currency, debouncedAffiliate, fetchPreview]);

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
    if (save <= 0) return null;
    return Math.round(save * 100);
  }, [priceMonthly, priceAnnual]);

  const savingsAbs = useMemo(() => {
    if (!priceMonthly || !priceAnnual) return null;
    const econ = priceMonthly * 12 - priceAnnual;
    return econ > 0 ? econ : null;
  }, [priceMonthly, priceAnnual]);

  // Aplicar manualmente (sem esperar debounce)
  const handleApplyAffiliate = useCallback(async () => {
    const trimmed = affiliate.trim().toUpperCase();
    if (!trimmed) return;
    setApplyLoading(true);
    setAffiliateError(null);
    setErrorMsg(null);
    try {
      const { ok, data } = await fetchPreview(plan, currency, trimmed);
      if (!ok) {
        if (data?.code === 'SELF_REFERRAL') {
          setAffiliateError('Você não pode usar seu próprio código.');
        } else if (data?.code === 'INVALID_CODE' || (data?.error || '').toLowerCase().includes('inválido')) {
          setAffiliateError(data?.message || data?.error || 'Código inválido ou expirado.');
          // restaura preview sem código
          const fb = await fetchPreview(plan, currency, '');
          setPreview(fb.data ?? null);
        } else {
          setErrorMsg(data?.message || data?.error || 'Não foi possível validar o código.');
        }
      } else {
        setPreview(data);
        setAffiliate(trimmed); // normaliza
      }
    } catch {
      setErrorMsg('Falha de rede. Tente novamente.');
    } finally {
      setApplyLoading(false);
    }
  }, [affiliate, plan, currency, fetchPreview]);

  async function handleSubscribe() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const body: any = { plan, currency };
      if (affiliate.trim()) body.affiliateCode = affiliate.trim().toUpperCase();
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
        // Reflete erros de código no input
        if (json?.code === 'SELF_REFERRAL') {
          setAffiliateError('Você não pode usar seu próprio código.');
        } else if (json?.code === 'INVALID_CODE' || (json?.message || '').toLowerCase().includes('inválido')) {
          setAffiliateError(json?.message || 'Código inválido ou expirado.');
        } else {
          setErrorMsg(json?.error || json?.message || 'Falha ao iniciar assinatura.');
        }
        return;
      }
      if (json?.clientSecret) {
        router.push(
          `/dashboard/billing/checkout?cs=${encodeURIComponent(json.clientSecret)}&sid=${encodeURIComponent(
            json.subscriptionId
          )}`
        );
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
          <button
            key={c}
            onClick={() => setCurrency(c)}
            aria-pressed={currency===c}
            className={`rounded-full px-3 py-1 text-sm transition ${currency===c?'bg-black text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {c}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {(['monthly','annual'] as Plan[]).map(p => (
          <button
            key={p}
            onClick={() => setPlan(p)}
            aria-pressed={plan===p}
            className={`rounded-full px-3 py-1 text-sm transition ${plan===p?'bg-black text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {p==='monthly' ? 'Mensal' : 'Anual'}
          </button>
        ))}
      </div>

      {/* Preço (usa preview para refletir afiliado; fallback para prices) */}
      <div className="mb-6 text-center min-h-[3.25rem] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={isPreviewLoading ? 'loading' : `${plan}-${currency}-${preview?.total}-${preview?.affiliateApplied}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-baseline justify-center gap-2"
          >
            {isPreviewLoading ? (
              <span className="text-gray-400">—</span>
            ) : preview ? (
              <>
                {preview.affiliateApplied && (
                  <span className="text-2xl text-gray-400 line-through">
                    {formatCurrency(preview.subtotal, preview.currency)}
                  </span>
                )}
                <span className="text-4xl font-extrabold tracking-tight">
                  {formatCurrency(preview.total, preview.currency)}
                </span>
                <span className="text-lg text-gray-500">/{plan === 'monthly' ? 'mês' : 'ano'}</span>
              </>
            ) : (
              <span className="text-4xl font-extrabold tracking-tight">
                {current?.unitAmount ? formatCurrency(current.unitAmount, currency) : '—'}
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Economia no anual */}
        {plan==='annual' && savingsAbs && (
          <p className="mt-1 text-xs text-gray-500">
            Economize ~{formatCurrency(savingsAbs, currency)} / ano no plano anual
          </p>
        )}
      </div>

      {/* Benefícios */}
      <ul className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <li>✅ Ideias de conteúdo geradas por IA</li>
        <li>✅ Análises automáticas do Instagram</li>
        <li>✅ Sugestões personalizadas por nicho</li>
        <li>✅ Relatórios e alertas de performance</li>
        <li>✅ Participação no grupo VIP com mentorias estratégicas semanais exclusivas</li>
      </ul>

      {/* Afiliado */}
      <div className="mb-3">
        <label htmlFor="aff" className="mb-1 block text-sm font-medium">Cupom ou Código de afiliado (opcional)</label>
        <div className={`relative ${preview?.affiliateApplied && !affiliateError ? 'ring-2 ring-indigo-500/30 rounded-lg' : ''}`}>
          <input
            id="aff"
            value={affiliate}
            onChange={(e) => setAffiliate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyAffiliate()}
            placeholder="Ex: JLS29D"
            className={`w-full rounded-lg border px-3 py-2 pr-24 text-sm tracking-widest outline-none ${affiliateError ? 'border-red-500' : 'border-gray-300 focus:border-black'}`}
            maxLength={12}
            aria-invalid={!!affiliateError}
            aria-describedby={affiliateError ? 'aff-error' : undefined}
          />
          <div className="absolute right-1.5 top-1.5">
            <button
              type="button"
              onClick={handleApplyAffiliate}
              disabled={applyLoading || !affiliate.trim()}
              className={`h-8 rounded-md border bg-white px-3 text-sm ${applyLoading ? 'opacity-60' : 'hover:bg-gray-50'}`}
            >
              {applyLoading ? '...' : 'Aplicar'}
            </button>
          </div>
        </div>
        <div role="status" aria-live="polite" className="min-h-[1.25rem]">
          {affiliateError && <p id="aff-error" className="mt-1 text-xs text-red-600">{affiliateError}</p>}
          {!affiliateError && preview?.affiliateApplied && (
            <p className="mt-1 text-xs text-green-600">✓ Desconto de 10% aplicado na primeira cobrança!</p>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Use o código de quem te indicou. Só pode ser aplicado uma vez e não pode ser o seu próprio.
        </p>
      </div>

      {/* Cupom / promotion — opcional, como no seu original */}
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
        disabled={loading || (!current && !preview) || isPreviewLoading}
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

export default function PlanTeaser() {
  const { data: session } = useSession();
  const billingStatus = useBillingStatus();
  const sessionActive = isPlanActiveLike(session?.user?.planStatus);
  const shouldHide = billingStatus.hasPremiumAccess || sessionActive;
  const stillLoading = billingStatus.isLoading && sessionActive;

  if (shouldHide || stillLoading) {
    return null;
  }

  return <PlanTeaserContent />;
}
