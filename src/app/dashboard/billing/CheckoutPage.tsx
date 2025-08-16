"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  subtotal: number;        // em centavos
  discountsTotal: number;  // em centavos
  tax: number;             // em centavos
  total: number;           // em centavos
  nextCycleAmount: number; // em centavos
  affiliateApplied: boolean;
}

// <<< ALTERAÇÃO 1: Definir a interface de propriedades para o componente >>>
interface CheckoutPageProps {
  affiliateCode: string | null;
}

// --- Ícones e Componentes de UI ---
const LockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Spinner = () => (
  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
);

// --- Helpers ---
const fmt = (amount: number, currencyRaw: string) => {
  const currency = (currencyRaw || "BRL").toUpperCase();
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency,
  }).format((amount ?? 0) / 100);
};

// --- Componente Principal ---
// <<< ALTERAÇÃO 2: Receber a propriedade `affiliateCode` e renomeá-la para evitar conflito >>>
export default function CheckoutPage({ affiliateCode: initialAffiliateCode }: CheckoutPageProps) {
  const params = useSearchParams();
  const [step, setStep] = useState<"config" | "pay">("config");
  const [plan, setPlan] = useState<Plan>("monthly");
  const [currency, setCurrency] = useState<Currency>("BRL");

  // <<< ALTERAÇÃO 3: Usar a propriedade para definir o estado inicial >>>
  const [affiliateCode, setAffiliateCode] = useState<string>(initialAffiliateCode || "");
  const [debouncedAffiliateCode] = useDebounce(affiliateCode, 400);

  // Estados de validação/aplicação do código
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  // Prévia atual e baseline (sem código) para economia anual
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [baseline, setBaseline] = useState<{ monthly?: number; annual?: number } | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);

  // Estados gerais
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // <<< ALTERAÇÃO 4: Remover o useEffect que lia a URL, pois isso agora é feito no Server Component pai >>>
  // O código que estava aqui foi removido para simplificar e evitar lógica duplicada.

  // Persistir no localStorage se o usuário editar
  useEffect(() => {
    try {
      if (affiliateCode?.trim()) localStorage.setItem("d2c_ref", affiliateCode.trim().toUpperCase());
      else localStorage.removeItem("d2c_ref");
    } catch {}
  }, [affiliateCode]);

  // Helper para buscar preview (com/sem código)
  const fetchPreview = useCallback(
    async (p: Plan, c: Currency, code: string) => {
      const res = await fetch("/api/billing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: p, currency: c, affiliateCode: code }),
      });
      const data = await res.json();
      return { ok: res.ok, data };
    },
    []
  );

  // --- Efeito para buscar a prévia da fatura (depende de plano/moeda/código com debounce) ---
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsPreviewLoading(true);
      setErr(null);
      setAffiliateError(null);
      try {
        const { ok, data } = await fetchPreview(plan, currency, debouncedAffiliateCode || "");
        if (!ok) {
          const msg: string = data?.message || data?.error || "";
          const lower = (msg || "").toLowerCase();
          if (data?.code === "SELF_REFERRAL") {
            if (!cancelled) setAffiliateError("Você não pode usar seu próprio código.");
          } else if (lower.includes("inválido") || data?.code === "INVALID_CODE") {
            if (!cancelled) setAffiliateError(data?.message || "Código inválido ou expirado.");
          } else {
            if (!cancelled) setErr(msg || "Erro ao buscar prévia.");
          }
          const fb = await fetchPreview(plan, currency, "");
          if (!cancelled) setPreview(fb.data ?? null);
        } else {
          if (!cancelled) setPreview(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Erro ao buscar prévia.");
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
  }, [plan, currency, debouncedAffiliateCode, fetchPreview]);

  // --- Baseline (sem código) para economia anual: (mensal*12) - anual ---
  useEffect(() => {
    let cancelled = false;
    const loadBaseline = async () => {
      setBaselineLoading(true);
      try {
        const [m, a] = await Promise.all([
          fetchPreview("monthly", currency, ""),
          fetchPreview("annual", currency, ""),
        ]);
        if (!cancelled) {
          setBaseline({
            monthly: m?.data?.total ?? undefined,
            annual: a?.data?.total ?? undefined,
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

  // --- Efeito para lidar com redirecionamentos do Stripe (quando veio ?cs=... do subscribe) ---
  useEffect(() => {
    const cs = params.get("cs");
    const sid = params.get("sid");
    if (cs) {
      setClientSecret(cs);
      if (sid) setSubscriptionId(sid);
      setStep("pay");
    }
  }, [params]);

  // --- Aplicar código manualmente ---
  const handleApplyAffiliate = useCallback(async () => {
    const trimmed = affiliateCode.trim().toUpperCase();
    if (!trimmed) return;
    setApplyLoading(true);
    setAffiliateError(null);
    setErr(null);
    try {
      const { ok, data } = await fetchPreview(plan, currency, trimmed);
      if (!ok) {
        if (data?.code === "SELF_REFERRAL") {
          setAffiliateError("Você não pode usar seu próprio código.");
        } else if (data?.code === "INVALID_CODE" || (data?.error || "").toLowerCase().includes("inválido")) {
          setAffiliateError(data?.message || data?.error || "Código inválido ou expirado.");
          const fb = await fetchPreview(plan, currency, "");
          setPreview(fb.data ?? null);
        } else {
          setErr(data?.message || data?.error || "Não foi possível validar o código.");
        }
      } else {
        setPreview(data);
        setAffiliateCode(trimmed);
      }
    } catch {
      setErr("Falha de rede. Tente novamente.");
    } finally {
      setApplyLoading(false);
    }
  }, [affiliateCode, plan, currency, fetchPreview]);

  // --- Iniciar pagamento ---
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
          affiliateCode: affiliateCode.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.code === "SELF_REFERRAL") {
          setAffiliateError("Você não pode usar seu próprio código.");
          return;
        }
        if (data?.code === "INVALID_CODE" || (data?.message || "").toLowerCase().includes("inválido")) {
          setAffiliateError(data?.message || "Código inválido ou expirado.");
          return;
        }
        throw new Error(data?.message || data?.error || "Falha ao iniciar assinatura");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // Fallback: Stripe Checkout hospedado
        return;
      }
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setSubscriptionId(data.subscriptionId || null);
        setStep("pay");
        return;
      }
      throw new Error("Resposta inesperada do servidor (sem clientSecret/checkoutUrl).");
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  const options: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#1f2937", borderRadius: "12px" }, labels: "floating" },
        loader: "auto",
        locale: "auto",
      }
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
              {/* Plano */}
              <div>
                <label className="block text-sm font-medium mb-2">Plano</label>
                <div className="flex gap-2" role="radiogroup" aria-label="Seleção de plano">
                  <button
                    onClick={() => setPlan("monthly")}
                    aria-pressed={plan === "monthly"}
                    className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${
                      plan === "monthly" ? "bg-gray-800 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setPlan("annual")}
                    aria-pressed={plan === "annual"}
                    className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${
                      plan === "annual" ? "bg-gray-800 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    Anual
                  </button>
                </div>
                {!baselineLoading && plan === "annual" && economyCents > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Economize ~{fmt(economyCents, currency)} / ano no plano anual
                  </p>
                )}
              </div>

              {/* Moeda */}
              <div>
                <label className="block text-sm font-medium mb-2">Moeda</label>
                <div className="flex gap-2" role="radiogroup" aria-label="Seleção de moeda">
                  <button
                    onClick={() => setCurrency("BRL")}
                    aria-pressed={currency === "BRL"}
                    className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${
                      currency === "BRL" ? "bg-gray-800 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    BRL (R$)
                  </button>
                  <button
                    onClick={() => setCurrency("USD")}
                    aria-pressed={currency === "USD"}
                    className={`flex-1 text-center px-3 py-2 rounded-md border text-sm font-semibold transition-all ${
                      currency === "USD" ? "bg-gray-800 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              {/* Código de Afiliado */}
              <div>
                <label htmlFor="affiliate-code" className="block text-sm font-medium mb-2">
                  Cupom ou Código de afiliado (Opcional)
                </label>
                <div
                  className={`relative ${
                    preview?.affiliateApplied && !affiliateError ? "ring-2 ring-indigo-500/30 rounded-md" : ""
                  }`}
                >
                  <input
                    id="affiliate-code"
                    value={affiliateCode}
                    onChange={(e) => setAffiliateCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyAffiliate()}
                    placeholder="EX: ABC123"
                    maxLength={12}
                    aria-invalid={!!affiliateError}
                    aria-describedby={affiliateError ? "aff-error" : undefined}
                    className={`w-full px-3 py-2 border rounded-md pr-24 text-sm tracking-widest outline-none ${
                      affiliateError ? "border-red-500" : "border-gray-300 focus:border-gray-900"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <button
                      type="button"
                      onClick={handleApplyAffiliate}
                      disabled={applyLoading || !affiliateCode.trim()}
                      className={`h-8 rounded-md border bg-white px-3 text-sm ${
                        applyLoading ? "opacity-60" : "hover:bg-gray-50"
                      }`}
                    >
                      {applyLoading ? <Spinner /> : "Aplicar"}
                    </button>
                  </div>
                </div>

                <div role="status" aria-live="polite" className="min-h-[1.25rem]">
                  {affiliateError && (
                    <p id="aff-error" className="mt-1 text-xs text-red-600">
                      {affiliateError}
                    </p>
                  )}
                  {!affiliateError && preview?.affiliateApplied && (
                    <p className="mt-1 text-xs text-green-600">✓ Desconto de 10% aplicado na primeira cobrança!</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna de Resumo do Pedido */}
          <div className="space-y-4">
            <div className="p-6 border rounded-lg bg-white shadow-sm space-y-4 sticky top-12">
              <h2 className="text-xl font-bold border-b pb-3">Resumo do Pedido</h2>

              <AnimatePresence mode="wait">
                <motion.div
                  key={isPreviewLoading ? "loading" : "loaded"}
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
                      {/* --- Preço grande com risco quando houver desconto de afiliado --- */}
                      <div className="flex items-baseline justify-between">
                        {preview.affiliateApplied && preview.discountsTotal > 0 ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl text-gray-400 line-through">
                              {fmt(preview.subtotal, preview.currency)}
                            </span>
                            <span className="text-2xl font-extrabold tracking-tight">
                              {fmt(preview.total, preview.currency)}
                            </span>
                            <span className="text-sm text-gray-500">
                              /{plan === "monthly" ? "mês" : "ano"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold tracking-tight">
                              {fmt(preview.total, preview.currency)}
                            </span>
                            <span className="text-sm text-gray-500">
                              /{plan === "monthly" ? "mês" : "ano"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Breakdown */}
                      <div className="flex justify-between">
                        <span>Valor do plano</span>
                        <span>{fmt(preview.subtotal, preview.currency)}</span>
                      </div>

                      {preview.discountsTotal > 0 && (
                        <div className="flex justify-between text-green-600 font-semibold">
                          <span>Desconto de Afiliado</span>
                          <span>- {fmt(preview.discountsTotal, preview.currency)}</span>
                        </div>
                      )}

                      <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg">
                        <span>Total hoje</span>
                        <span>{fmt(preview.total, preview.currency)}</span>
                      </div>

                      {preview.nextCycleAmount > 0 && (
                        <p className="text-xs text-gray-500 pt-2">
                          Próximas cobranças: {fmt(preview.nextCycleAmount, preview.currency)} por{" "}
                          {plan === "monthly" ? "mês" : "ano"}.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-red-600">Não foi possível calcular o valor.</p>
                  )}
                </motion.div>
              </AnimatePresence>

              {err && <p className="text-sm text-red-600 text-center pt-2">{err}</p>}

              <button
                onClick={startCheckout}
                disabled={loading || isPreviewLoading || !preview}
                className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
              >
                <LockIcon />
                {loading ? "Preparando..." : "Pagar com Segurança"}
              </button>

              {/* Economia destacada quando Anual selecionado */}
              {!baselineLoading && plan === "annual" && economyCents > 0 && (
                <p className="text-[11px] text-gray-500 text-center">
                  Dica: com o anual você economiza ~{fmt(economyCents, preview?.currency || currency)} no ano.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}