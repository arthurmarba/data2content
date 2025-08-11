"use client";

import React, { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { stripePromise } from "@/app/lib/stripe-browser";
import CheckoutForm from "./CheckoutForm";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

export default function CheckoutPage() {
  const [step, setStep] = useState<"config" | "pay">("config");
  const [plan, setPlan] = useState<Plan>("monthly");
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [affiliateCode, setAffiliateCode] = useState<string>("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const aff = document.cookie.match(/(?:^|;\s*)aff_code=([^;]+)/)?.[1];
      if (aff) setAffiliateCode(aff);
    }
  }, []);

  async function startCheckout() {
    try {
      setLoading(true);
      setErr(null);

      const cookieAff = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|;\s*)aff_code=([^;]+)/)?.[1]
        : undefined;
      const effectiveCode = affiliateCode.trim() || cookieAff;

      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          currency,
          affiliateCode: effectiveCode || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao iniciar assinatura");

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
    ? {
        clientSecret,
        appearance: { theme: "stripe" },
        locale: "auto",
      }
    : undefined;

  return (
    <div className="max-w-xl w-full space-y-6">
      <h1 className="text-2xl font-semibold">Assinar Plano</h1>

      {step === "config" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Plano</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPlan("monthly")}
                className={`px-3 py-2 rounded border ${plan === "monthly" ? "bg-gray-100" : ""}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setPlan("annual")}
                className={`px-3 py-2 rounded border ${plan === "annual" ? "bg-gray-100" : ""}`}
              >
                Anual
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              O anual é cobrado à vista e renova automaticamente a cada 12 meses.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Moeda</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrency("BRL")}
                className={`px-3 py-2 rounded border ${currency === "BRL" ? "bg-gray-100" : ""}`}
              >
                BRL (R$)
              </button>
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-2 rounded border ${currency === "USD" ? "bg-gray-100" : ""}`}
              >
                USD ($)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Código de afiliado (opcional)</label>
            <input
              value={affiliateCode}
              onChange={(e) => setAffiliateCode(e.target.value)}
              placeholder="EX: ABC123"
              className="w-full px-3 py-2 border rounded"
            />
            {affiliateCode && (
              <p className="text-xs text-green-600 mt-1">Cupom de 10% aplicado na primeira cobrança</p>
            )}
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            onClick={startCheckout}
            disabled={loading}
            className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? "Preparando..." : "Continuar para pagamento"}
          </button>
        </div>
      )}

      {step === "pay" && clientSecret && options && (
        <Elements stripe={stripePromise} options={options} key={clientSecret}>
          <CheckoutForm subscriptionId={subscriptionId} onBack={() => setStep("config")} />
        </Elements>
      )}
    </div>
  );
}

