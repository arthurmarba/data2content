"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PricingCard() {
  const { data, isLoading } = useSWR("/api/billing/prices", fetcher, { revalidateOnFocus: false });
  const prices = (data?.prices ?? []) as {
    plan: Plan; currency: Currency; unitAmount: number | null; priceId: string; displayCurrency: string;
  }[];

  // estado de UI
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [plan, setPlan] = useState<Plan>("monthly");
  const [coupon, setCoupon] = useState("");
  const [promotion, setPromotion] = useState("");
  const [affiliate, setAffiliate] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sp = useSearchParams();
  const router = useRouter();

  // auto-preencher código de afiliado se veio por ?ref=
  useEffect(() => {
    const ref = sp.get("ref");
    if (ref) setAffiliate(ref.toUpperCase());
  }, [sp]);

  const current = useMemo(() => {
    return prices.find(p => p.plan === plan && p.currency === currency) || null;
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
    try {
      setLoading(true);
      setErrorMsg(null);

      const body: any = {
        plan,
        currency,
      };
      if (coupon.trim()) body.coupon = coupon.trim();
      if (promotion.trim()) body.promotion_code = promotion.trim();
      if (affiliate.trim()) body.affiliateCode = affiliate.trim();

      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json?.error || "Falha ao iniciar assinatura.");
        return;
      }

      // Se você já tem uma tela/element para confirmar o pagamento, redirecione com o client secret:
      if (json?.clientSecret) {
        router.push(`/dashboard/billing/checkout?cs=${encodeURIComponent(json.clientSecret)}&sid=${encodeURIComponent(json.subscriptionId)}`);
      } else {
        // fallback: recarrega (ou mostre toast de sucesso e aguarde webhook)
        router.refresh();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-center text-xl font-semibold">Plano Data2Content</h2>

      {/* Alternadores */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setCurrency("BRL")}
          className={`rounded-full px-3 py-1 text-sm ${currency === "BRL" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >BRL</button>
        <button
          type="button"
          onClick={() => setCurrency("USD")}
          className={`rounded-full px-3 py-1 text-sm ${currency === "USD" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >USD</button>

        <span className="mx-2 h-5 w-px bg-gray-200" />

        <button
          type="button"
          onClick={() => setPlan("monthly")}
          className={`rounded-full px-3 py-1 text-sm ${plan === "monthly" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >Mensal</button>
        <button
          type="button"
          onClick={() => setPlan("annual")}
          className={`rounded-full px-3 py-1 text-sm ${plan === "annual" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
        >Anual</button>
      </div>

      {/* Valor */}
      <div className="mb-4 text-center">
        <div className="text-3xl font-bold tracking-tight">
          {isLoading ? "—" : priceLabel}
        </div>
        {!current && (
          <p className="mt-1 text-xs text-gray-500">
            Configure os IDs de price nas envs para {plan}/{currency}.
          </p>
        )}
      </div>

      {/* Cupom / Promo */}
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={coupon}
          onChange={e => setCoupon(e.target.value)}
          placeholder="Cupom (opcional)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
        />
        <input
          value={promotion}
          onChange={e => setPromotion(e.target.value)}
          placeholder="Promotion code (opcional)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
        />
      </div>

      {/* Afiliado (novo) */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Código de Afiliado (opcional)</label>
        <input
          value={affiliate}
          onChange={e => setAffiliate(e.target.value.toUpperCase())}
          placeholder="Ex: JLS29D"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-black"
          maxLength={10}
        />
        <p className="mt-1 text-xs text-gray-500">
          Use o código de quem te indicou. Só pode ser aplicado uma vez e não pode ser o seu próprio.
        </p>
      </div>

      {/* CTA */}
      {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}

      <button
        onClick={handleSubscribe}
        disabled={loading || !current}
        className="w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {loading ? "Iniciando…" : "Assinar agora"}
      </button>

      <p className="mt-2 text-center text-xs text-gray-500">
        Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
      </p>
    </div>
  );
}
