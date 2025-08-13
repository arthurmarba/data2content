'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck } from 'react-icons/fa';
import { useDebounce } from 'use-debounce';

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type Plan = 'monthly' | 'annual';
type Currency = 'BRL' | 'USD';

interface PlanCardProProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCurrency?: Currency;
}

interface InvoicePreview {
  currency: string;
  subtotal: number;
  discountsTotal: number;
  tax: number;
  total: number;
  nextCycleAmount: number;
  affiliateApplied: boolean;
}

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100);
};

const Spinner = () => <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>;


export default function PlanCardPro({ defaultCurrency = 'BRL', className, ...props }: PlanCardProProps) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [plan, setPlan] = useState<Plan>('monthly');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [debouncedAffiliateCode] = useDebounce(affiliateCode, 400);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);

  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = sp.get('ref');
    if (ref) setAffiliateCode(ref.toUpperCase());
  }, [sp]);

  // Efeito para buscar a prévia da fatura no backend
  useEffect(() => {
    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      setError(null);
      setAffiliateError(null);
      try {
        const res = await fetch("/api/billing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, currency, affiliateCode: debouncedAffiliateCode }),
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.error?.includes("inválido")) {
                setAffiliateError(data.error);
            } else {
                setError(data.error || "Erro ao buscar prévia.");
            }
            // Busca a prévia sem o código em caso de erro para resetar o preço
            const fallbackRes = await fetch("/api/billing/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, currency, affiliateCode: '' }),
            });
            const fallbackData = await fallbackRes.json();
            setPreview(fallbackData);
        } else {
            setPreview(data);
        }
      } catch (error: any) {
        setError("Não foi possível verificar o código.");
        setPreview(null);
      } finally {
        setIsPreviewLoading(false);
      }
    };
    fetchPreview();
  }, [plan, currency, debouncedAffiliateCode]);


  async function handleSubscribe() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, currency, affiliateCode: affiliateCode || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || json?.error || 'Falha ao iniciar assinatura.');
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

      <div className="mb-6 text-center h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={preview ? preview.total : 'loading'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-baseline justify-center gap-2"
          >
            {isPreviewLoading ? (
              <Spinner />
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
                <span className="text-lg text-gray-500">
                  /{plan === 'monthly' ? 'mês' : 'ano'}
                </span>
              </>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
        {['Ideias de conteúdo geradas por IA', 'Análises automáticas do Instagram', 'Sugestões personalizadas por nicho', 'Relatórios e alertas de performance'].map(b => (
          <li key={b} className="flex items-start gap-2"><FaCheck className="mt-1 h-4 w-4 text-green-600" /><span>{b}</span></li>
        ))}
      </ul>

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium">Código de Afiliado (opcional)</label>
        <input
          value={affiliateCode}
          onChange={e => setAffiliateCode(e.target.value.toUpperCase())}
          placeholder="Ex: JLS29D"
          className={cn("w-full rounded-lg border px-3 py-2 text-sm tracking-widest outline-none focus:border-black", affiliateError ? "border-red-500" : "border-gray-300")}
          maxLength={10}
        />
        {affiliateError && <p className="mt-1 text-xs text-red-600">{affiliateError}</p>}
        {!affiliateError && preview?.affiliateApplied && <p className="mt-1 text-xs text-green-600">✓ Desconto de 10% aplicado na primeira cobrança!</p>}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubscribe}
        disabled={loading || isPreviewLoading || !preview}
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
