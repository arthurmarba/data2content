'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck } from 'react-icons/fa';
import { useDebounce } from 'use-debounce';

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

type Plan = 'monthly' | 'annual';
type Currency = 'BRL' | 'USD';

interface PlanCardProProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCurrency?: Currency;
}

interface InvoicePreview {
  currency?: string | null;
  subtotal?: number | null;
  discountsTotal?: number | null;
  tax?: number | null;
  total?: number | null;
  nextCycleAmount?: number | null;
  affiliateApplied?: boolean | null;
}

const toNumberOrNull = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
};

// Normaliza payloads diferentes do backend (ex.: total/totalCents/amountDue etc.)
function normalizePreview(input: any, fallbackCurrency: string): InvoicePreview | null {
  if (!input || typeof input !== 'object') return null;

  const currencyRaw =
    input.currency ??
    input.currencyCode ??
    input.currency_code ??
    input.curr ??
    null;

  const currency =
    typeof currencyRaw === 'string' && currencyRaw.trim()
      ? currencyRaw.trim().toUpperCase()
      : (fallbackCurrency || 'BRL');

  const subtotal =
    toNumberOrNull(input.subtotal) ??
    toNumberOrNull(input.subtotalAmount) ??
    toNumberOrNull(input.subtotalCents) ??
    toNumberOrNull(input.subtotal_price);

  const total =
    toNumberOrNull(input.total) ??
    toNumberOrNull(input.totalAmount) ??
    toNumberOrNull(input.totalCents) ??
    toNumberOrNull(input.amount_due) ??
    toNumberOrNull(input.amountDue);

  const discountsTotal =
    toNumberOrNull(input.discountsTotal) ??
    toNumberOrNull(input.discount) ??
    toNumberOrNull(input.discounts);

  const tax =
    toNumberOrNull(input.tax) ??
    toNumberOrNull(input.taxAmount) ??
    toNumberOrNull(input.taxCents);

  const nextCycleAmount =
    toNumberOrNull(input.nextCycleAmount) ??
    toNumberOrNull(input.upcoming_total) ??
    toNumberOrNull(input.upcomingTotal);

  const affiliateApplied =
    typeof input.affiliateApplied === 'boolean'
      ? input.affiliateApplied
      : undefined;

  // É importante que pelo menos total exista para exibir o preço
  if (total === null) return null;

  return { currency, subtotal, discountsTotal, tax, total, nextCycleAmount, affiliateApplied };
}

const formatCurrency = (amount?: number | null, currency?: string | null) => {
  const cur = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'BRL';
  const locale = cur === 'BRL' ? 'pt-BR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(((amount ?? 0) as number) / 100);
  } catch {
    const val = (((amount ?? 0) as number) / 100).toFixed(2);
    const symbol = cur === 'BRL' ? 'R$' : '$';
    return `${symbol} ${val}`;
  }
};

const Spinner = () => (
  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
);

function setReferralCookie(code?: string) {
  try {
    if (code && code.trim()) {
      const v = encodeURIComponent(code.trim().toUpperCase());
      document.cookie = `d2c_ref=${v}; Max-Age=${60 * 60 * 24 * 90}; Path=/; SameSite=Lax`;
    } else {
      document.cookie = 'd2c_ref=; Max-Age=0; Path=/; SameSite=Lax';
    }
  } catch { /* noop */ }
}

export default function PlanCardPro({ defaultCurrency = 'BRL', className, ...props }: PlanCardProProps) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [plan, setPlan] = useState<Plan>('monthly');

  const [affiliateCode, setAffiliateCode] = useState('');
  const [debouncedAffiliateCode] = useDebounce(affiliateCode, 400);
  const [applyLoading, setApplyLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);

  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [baseline, setBaseline] = useState<{ monthly?: number; annual?: number } | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);

  const sp = useSearchParams();
  const router = useRouter();

  // Hidrata código salvo (localStorage/cookie)
  useEffect(() => {
    const savedCode =
      localStorage.getItem('d2c_ref') ||
      document.cookie.match(/(?:^|; )d2c_ref=([^;]+)/)?.[1] ||
      '';
    if (savedCode) {
      setAffiliateCode(decodeURIComponent(savedCode).toUpperCase());
    }
  }, []);

  // Prefill via querystring (?ref= / ?aff=)
  useEffect(() => {
    const ref = sp.get('ref') || sp.get('aff');
    if (ref) setAffiliateCode(ref.toUpperCase());
  }, [sp]);

  // Persiste código localmente
  useEffect(() => {
    try {
      if (affiliateCode?.trim()) {
        const val = affiliateCode.trim().toUpperCase();
        localStorage.setItem('d2c_ref', val);
        setReferralCookie(val);
      } else {
        localStorage.removeItem('d2c_ref');
        setReferralCookie('');
      }
    } catch { /* noop */ }
  }, [affiliateCode]);

  // Envia também "toPlan" para compat com o backend atual
  const fetchPreview = useCallback(
    async (p: Plan, c: Currency, code: string) => {
      const res = await fetch('/api/billing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p, toPlan: p, currency: c, affiliateCode: code }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    },
    []
  );

  // Carrega a prévia atual (depende do plano, moeda e código - com debounce)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsPreviewLoading(true);
      setError(null);
      setAffiliateError(null);
      try {
        const { ok, data } = await fetchPreview(plan, currency, debouncedAffiliateCode || '');
        if (!ok) {
          const msg = (data?.message ?? data?.error ?? '').toString().toLowerCase();
          if (data?.code === 'SELF_REFERRAL') {
            if (!cancelled) setAffiliateError('Você não pode usar seu próprio código.');
          } else if (data?.code === 'INVALID_CODE' || msg.includes('inválido')) {
            if (!cancelled) setAffiliateError(data?.message || 'Código inválido ou expirado.');
          } else {
            if (!cancelled) setError(data?.message || data?.error || 'Erro ao buscar prévia.');
          }
          // fallback SEM código
          const fb = await fetchPreview(plan, currency, '');
          if (!cancelled) {
            const n = normalizePreview(fb.data, currency);
            setPreview(fb.ok ? n : null);
          }
        } else {
          if (!cancelled) {
            const n = normalizePreview(data, currency);
            setPreview(n);
          }
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível verificar a prévia.');
          setPreview(null);
        }
      } finally {
        if (!cancelled) setIsPreviewLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [plan, currency, debouncedAffiliateCode, fetchPreview]);

  // Carrega baseline (sem código) para calcular economia anual
  useEffect(() => {
    let cancelled = false;
    const loadBaseline = async () => {
      setBaselineLoading(true);
      try {
        const [m, a] = await Promise.all([
          fetchPreview('monthly', currency, ''),
          fetchPreview('annual', currency, ''),
        ]);
        if (!cancelled) {
          const nm = normalizePreview(m.data, currency);
          const na = normalizePreview(a.data, currency);
          setBaseline({
            monthly: m.ok ? nm?.total ?? undefined : undefined,
            annual: a.ok ? na?.total ?? undefined : undefined,
          });
        }
      } catch {
        if (!cancelled) setBaseline(null);
      } finally {
        if (!cancelled) setBaselineLoading(false);
      }
    };
    loadBaseline();
  }, [currency, fetchPreview]);

  const economyCents = useMemo(() => {
    const m = baseline?.monthly ?? 0;
    const a = baseline?.annual ?? 0;
    const econ = m * 12 - a;
    return econ > 0 ? econ : 0;
  }, [baseline]);

  async function handleSubscribe() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Envia toPlan também, por simetria/compat
        body: JSON.stringify({ plan, toPlan: plan, currency, affiliateCode: affiliateCode || undefined }),
      });
      const json = await res.json();

      if (!res.ok) {
        const msg = json?.message || json?.error || 'Falha ao iniciar assinatura.';
        if (json?.code === 'INVALID_CODE' || (json?.message && String(json.message).toLowerCase().includes('inválido'))) {
          setAffiliateError(json?.message || 'Código inválido ou expirado.');
        } else if (json?.code === 'SELF_REFERRAL') {
          setAffiliateError('Você não pode usar seu próprio código.');
        } else {
          setError(msg);
        }
        return;
      }

      if (json?.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      if (json?.clientSecret) {
        router.push(
          `/dashboard/billing/checkout?cs=${encodeURIComponent(json.clientSecret)}&sid=${encodeURIComponent(json.subscriptionId)}`
        );
        return;
      }

      setError('Não foi possível preparar o pagamento.');
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  const handleApplyAffiliate = async () => {
    const trimmed = affiliateCode.trim().toUpperCase();
    if (!trimmed) return;
    setApplyLoading(true);
    setAffiliateError(null);
    setError(null);
    try {
      const { ok, data } = await fetchPreview(plan, currency, trimmed);
      if (!ok) {
        const msg = (data?.message ?? data?.error ?? '').toString().toLowerCase();
        if (data?.code === 'SELF_REFERRAL') {
          setAffiliateError('Você não pode usar seu próprio código.');
        } else if (data?.code === 'INVALID_CODE' || msg.includes('inválido')) {
          setAffiliateError(data?.message || 'Código inválido ou expirado.');
          const fb = await fetchPreview(plan, currency, '');
          const n = normalizePreview(fb.data, currency);
          setPreview(fb.ok ? n : null);
        } else {
          setError(data?.message || data?.error || 'Não foi possível validar o código.');
        }
      } else {
        const n = normalizePreview(data, currency);
        setPreview(n);
      }
    } catch {
      setError('Falha de rede. Tente novamente.');
    } finally {
      setApplyLoading(false);
    }
  };

  const hasDiscount = (preview?.discountsTotal ?? 0) > 0;
  const displayCurrency = (preview?.currency ?? currency) as string;
  const displayTotal = preview?.total ?? null;
  const displaySubtotal = preview?.subtotal ?? null;

  return (
    <div {...props} className={cn('rounded-2xl border bg-white p-6 shadow-sm w-full', className)}>
      <h2 className="mb-3 text-center text-2xl font-semibold">Plano Data2Content</h2>

      <div className="mb-5 flex items-center justify-center gap-2">
        {(['BRL', 'USD'] as Currency[]).map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            aria-pressed={currency === c}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition',
              currency === c ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {c}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {(['monthly', 'annual'] as Plan[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlan(p)}
            aria-pressed={plan === p}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition',
              plan === p ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {p === 'monthly' ? 'Mensal' : 'Anual'}
          </button>
        ))}
      </div>

      <div className="mb-2 text-center h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={displayTotal ? `${displayTotal}-${plan}-${currency}-${hasDiscount}` : isPreviewLoading ? 'loading' : 'empty'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-center"
          >
            <div className="flex items-baseline justify-center gap-2">
              {isPreviewLoading ? (
                <Spinner />
              ) : displayTotal !== null ? (
                <>
                  {hasDiscount && displaySubtotal !== null && (
                    <span className="text-2xl text-gray-400 line-through">
                      {formatCurrency(displaySubtotal, displayCurrency)}
                    </span>
                  )}
                  <span className="text-4xl font-extrabold tracking-tight">
                    {formatCurrency(displayTotal, displayCurrency)}
                  </span>
                  <span className="text-lg text-gray-500">/{plan === 'monthly' ? 'mês' : 'ano'}</span>
                </>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </div>

            {!baselineLoading && economyCents > 0 && plan === 'annual' && (
              <div className="mt-1 text-xs text-gray-500">
                Economize ~{formatCurrency(economyCents, currency)} / ano no plano anual
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
        {[
          'Ideias de conteúdo geradas por IA',
          'Análises automáticas do Instagram',
          'Sugestões personalizadas por nicho',
          'Relatórios e alertas de performance',
        ].map((b) => (
          <li key={b} className="flex items-start gap-2">
            <FaCheck className="mt-1 h-4 w-4 text-green-600" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mb-3">
        <label htmlFor="aff" className="mb-1 block text-sm font-medium">
          Cupom ou Código de afiliado (opcional)
        </label>

        <div
          className={cn(
            'relative',
            hasDiscount && !affiliateError && 'ring-2 ring-indigo-500/30 rounded-lg'
          )}
        >
          <input
            id="aff"
            value={affiliateCode}
            onChange={(e) => setAffiliateCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyAffiliate()}
            placeholder="Ex: JLS29D"
            maxLength={12}
            aria-invalid={!!affiliateError}
            aria-describedby={affiliateError ? 'aff-error' : undefined}
            className={cn(
              'w-full rounded-lg border px-3 py-2 pr-24 text-sm tracking-widest outline-none focus:border-black',
              affiliateError ? 'border-red-500' : 'border-gray-300'
            )}
          />

          <div className="absolute right-1.5 top-1.5">
            <button
              type="button"
              onClick={handleApplyAffiliate}
              disabled={applyLoading || !affiliateCode.trim()}
              className={cn(
                'h-8 rounded-md border bg-white px-3 text-sm',
                applyLoading ? 'opacity-60' : 'hover:bg-gray-50'
              )}
            >
              {applyLoading ? <Spinner /> : 'Aplicar'}
            </button>
          </div>
        </div>

        <div role="status" aria-live="polite" className="min-h-[1.25rem]">
          {affiliateError && (
            <p id="aff-error" className="mt-1 text-xs text-red-600">
              {affiliateError}
            </p>
          )}
          {!affiliateError && hasDiscount && (
            <p className="mt-1 text-xs text-green-600">✓ Desconto aplicado!</p>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubscribe}
        aria-busy={loading}
        disabled={loading || isPreviewLoading || !preview || preview.total == null}
        className="w-full rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {loading ? 'Iniciando…' : 'Assinar agora'}
      </button>

      <p className="mt-2 text-center text-xs text-gray-500">
        Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
      </p>
    </div>
  );
}
