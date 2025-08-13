"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { stripePromise } from "@/app/lib/stripe-browser";
import CheckoutForm from "./CheckoutForm";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";

// --- Tipos e Constantes ---
type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

interface InvoicePreview {
  currency: string;
  subtotal: number;
  discountsTotal: number;
  tax: number;
  total: number;
  nextCycleAmount: number;
  affiliateApplied: boolean;
}

// --- Ícones e Componentes de UI ---
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const Spinner = () => <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>;

// --- Função para formatar valores monetários ---
const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amount / 100);
};

// --- Props do Componente Principal ---
type Props = {
  affiliateCode: string | null;
};

// --- Componente Principal ---
export default function CheckoutPage({ affiliateCode: initialAffiliateCode }: Props) {
  const params = useSearchParams();
  const [step, setStep] = useState<"config" | "pay">("config");
  const [plan, setPlan] = useState<Plan>("monthly");
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [affiliateCode, setAffiliateCode] = useState<string>(initialAffiliateCode || "");
  const [debouncedAffiliateCode] = useDebounce(affiliateCode, 400);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);

  // --- Fallback: busca código no localStorage se não vier do servidor ---
  useEffect(() => {
    if (!initialAffiliateCode) {
      try {
        const stored = localStorage.getItem("d2c_ref");
        if (stored) {
          setAffiliateCode(stored);
        }
      } catch {
        // Ignora se localStorage não estiver disponível
      }
    }
  }, [initialAffiliateCode]);

  // --- Efeito para buscar a prévia da fatura ---
  useEffect(() => {
    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/billing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, currency, affiliateCode: debouncedAffiliateCode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao buscar prévia.");
        setPreview(data);
      } catch (error: any) {
        console.error("Failed to fetch preview:", error);
        setPreview(null);
        setErr(error.message);
      } finally {
        setIsPreviewLoading(false);
      }
    };
    fetchPreview();
  }, [plan, currency, debouncedAffiliateCode]);

  // --- Efeito para lidar com redirecionamentos do Stripe ---
  useEffect(() => {
    const cs = params.get("cs");
    const sid = params.get("sid");
    if (cs) {
      setClientSecret(cs);
      if (sid) setSubscriptionId(sid);
      setStep("pay");
    }
  }, [params]);

  // --- Função para iniciar o pagamento ---
  async function startCheckout() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          currency,
          affiliateCode: affiliateCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Falha ao iniciar assinatura");
      if (!data.clientSecret) throw new Error("clientSecret ausente");
      setClientSecret(data.clientSecret);
      setSubscriptionId(data.subscriptionId || null);
      setStep("pay");
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  const options: StripeElementsOptions | undefined = clientSecret
    ? { clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: '#1f2937' } }, locale: "auto" }
    : undefined;

  return (
    <div className="w-full bg-gray-50 py-12 px-4">
      {step === "pay" && clientSecret && options ? (
        <div className="max-w-md mx-auto">
          <Elements stripe={stripePromise} options={options} key={clientSecret}>
            <CheckoutForm subscriptionId={subscriptionId} onBack={() => setStep("config")} />
          </Elements>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Coluna de Configuração */}
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Finalize sua Assinatura</h1>
            <div className="space-y-4 p-6 border rounded-lg bg-white shadow-sm">
              <div>
                <label className="block text-sm font-medium mb-2">Plano</label>
                <div className="flex gap-2">
                  <button onClick={() => setPlan("monthly")} className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${plan === "monthly" ? "bg-gray-800 text-white" : "hover:bg-gray-100"}`}>Mensal</button>
                  <button onClick={() => setPlan("annual")} className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${plan === "annual" ? "bg-gray-800 text-white" : "hover:bg-gray-100"}`}>Anual</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Moeda</label>
                <div className="flex gap-2">
                  <button onClick={() => setCurrency("BRL")} className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${currency === "BRL" ? "bg-gray-800 text-white" : "hover:bg-gray-100"}`}>BRL (R$)</button>
                  <button onClick={() => setCurrency("USD")} className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${currency === "USD" ? "bg-gray-800 text-white" : "hover:bg-gray-100"}`}>USD ($)</button>
                </div>
              </div>
              <div>
                <label htmlFor="affiliate-code" className="block text-sm font-medium mb-2">Código de Afiliado (Opcional)</label>
                <input id="affiliate-code" value={affiliateCode} onChange={(e) => setAffiliateCode(e.target.value)} placeholder="EX: ABC123" className="w-full px-3 py-2 border rounded-md"/>
              </div>
            </div>
          </div>

          {/* Coluna de Resumo do Pedido */}
          <div className="space-y-4">
             <div className="p-6 border rounded-lg bg-white shadow-sm space-y-4 sticky top-12">
                <h2 className="text-xl font-bold border-b pb-3">Resumo do Pedido</h2>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isPreviewLoading ? 'loading' : 'loaded'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2 text-sm"
                  >
                    {isPreviewLoading ? (
                      <div className="flex justify-center items-center h-24">
                        <Spinner />
                      </div>
                    ) : preview ? (
                      <>
                        <div className="flex justify-between"><span>Valor do plano</span><span>{formatCurrency(preview.subtotal, preview.currency)}</span></div>
                        {preview.affiliateApplied && preview.discountsTotal > 0 && (
                           <div className="flex justify-between text-green-600 font-semibold">
                             <span>Desconto de Afiliado</span>
                             <span>- {formatCurrency(preview.discountsTotal, preview.currency)}</span>
                           </div>
                        )}
                         <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg">
                           <span>Total hoje</span>
                           <span>{formatCurrency(preview.total, preview.currency)}</span>
                         </div>
                         <p className="text-xs text-gray-500 pt-2">
                           Próximas cobranças: {formatCurrency(preview.nextCycleAmount, preview.currency)} por {plan === 'monthly' ? 'mês' : 'ano'}.
                         </p>
                      </>
                    ) : (
                      <p className="text-center text-red-600">Não foi possível calcular o valor.</p>
                    )}
                  </motion.div>
                </AnimatePresence>
                
                {err && <p className="text-sm text-red-600 text-center pt-2">{err}</p>}
                <button onClick={startCheckout} disabled={loading || isPreviewLoading || !preview} className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
                  <LockIcon />
                  {loading ? "Preparando..." : "Pagar com Segurança"}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
