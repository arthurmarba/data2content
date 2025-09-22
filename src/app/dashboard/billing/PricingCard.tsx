"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PricingCardProps = {
  onSubscriptionCreated: (data: { clientSecret: string; subscriptionId: string }) => void;
  affiliateCode?: string;
};

export default function PricingCard({ onSubscriptionCreated, affiliateCode }: PricingCardProps) {
  const { data, isLoading } = useSWR("/api/billing/prices", fetcher, { revalidateOnFocus: false });
  const prices = (data?.prices ?? []) as {
    plan: Plan;
    currency: Currency;
    unitAmount: number | null;
    priceId: string;
  }[];

  const [currency, setCurrency] = useState<Currency>("BRL");
  const [plan, setPlan] = useState<Plan>("monthly");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const current = useMemo(() => {
    return prices.find((p) => p.plan === plan && p.currency === currency) || null;
  }, [prices, plan, currency]);

  const priceLabel = useMemo(() => {
    if (!current?.unitAmount) return "—";
    const fmt = new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    });
    return fmt.format(current.unitAmount / 100) + (plan === "monthly" ? "/mês" : "/ano");
  }, [current, currency, plan]);

  async function handleSubscribe() {
    if (!current) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const code = (affiliateCode || "").trim();

      const body: any = {
        plan,
        currency,
        priceId: current.priceId,
      };

      // Envie apenas affiliateCode; backend decide cupom/afiliado
      if (code) {
        body.affiliateCode = code;
      }

      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Falha ao iniciar assinatura.");
      }

      if (json?.clientSecret && json?.subscriptionId) {
        onSubscriptionCreated({
          clientSecret: json.clientSecret,
          subscriptionId: json.subscriptionId,
        });
      } else {
        throw new Error("Resposta da API inválida. Faltando clientSecret ou subscriptionId.");
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  // NOVO — inicia Checkout do Stripe com 7 dias de teste
  async function handleStartTrial() {
    if (!current) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const body: any = {
        priceId: current.priceId,
        interval: plan === "annual" ? "year" : "month",
      };
      if (affiliateCode?.trim()) {
        body.affiliateCode = affiliateCode.trim().toUpperCase();
      }

      const res = await fetch("/api/billing/checkout/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.message || json?.error || "Falha ao iniciar teste gratuito.");
      }

      window.location.href = json.url;
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="mb-2 text-center text-lg sm:text-xl font-semibold">Plano Data2Content</h2>

      <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setCurrency("BRL")}
          className={`rounded-full px-3 py-1 text-sm ${currency === "BRL" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >
          BRL
        </button>
        <button
          type="button"
          onClick={() => setCurrency("USD")}
          className={`rounded-full px-3 py-1 text-sm ${currency === "USD" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >
          USD
        </button>
        <span className="mx-2 h-5 w-px bg-gray-200" />
        <button
          type="button"
          onClick={() => setPlan("monthly")}
          className={`rounded-full px-3 py-1 text-sm ${plan === "monthly" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => setPlan("annual")}
          className={`rounded-full px-3 py-1 text-sm ${plan === "annual" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Anual
        </button>
      </div>

      <div className="mb-3 sm:mb-4 text-center">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight">{isLoading ? "—" : priceLabel}</div>
        {!current && !isLoading && (
          <p className="mt-1 text-xs text-gray-500">
            Plano não disponível para {plan.toLocaleLowerCase()}/{currency}.
          </p>
        )}
      </div>

      {errorMsg && <p className="mb-3 text-center text-sm text-red-600">{errorMsg}</p>}

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={handleStartTrial}
          disabled={loading || !current}
          className="w-full rounded-xl border border-black px-4 py-2 sm:py-3 text-black hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Iniciando…" : "Iniciar teste gratuito (7 dias)"}
        </button>

        <button
          onClick={handleSubscribe}
          disabled={loading || !current}
          className="w-full rounded-xl bg-black px-4 py-2 sm:py-3 text-white disabled:opacity-50"
        >
          {loading ? "Iniciando…" : "Assinar agora"}
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
      </p>
    </div>
  );
}
