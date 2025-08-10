"use client";

import React, { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { stripePromise } from "@/app/lib/stripe-browser";
import { useToast } from "@/app/components/ui/ToastProvider";
import { useBillingStatus } from "@/app/hooks/useBillingStatus";

type Plan = "monthly" | "annual";
type When = "now" | "period_end";

export default function ChangePlanCard() {
  const { data: session, update } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const { refetch } = useBillingStatus({ userId, auto: false });
  const { toast } = useToast();
  const currentPlan = (session?.user as any)?.planType as Plan | undefined;
  const [newPlan, setNewPlan] = useState<Plan>(currentPlan === "annual" ? "monthly" : "annual");
  const [when, setWhen] = useState<When>("now");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const elementsOptions: StripeElementsOptions | undefined = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: "stripe" } } : undefined),
    [clientSecret]
  );

  const disabled = loading || !currentPlan || currentPlan === newPlan;

  async function handleSubmit() {
    try {
      setLoading(true);
      setErr(null);
      setOkMsg(null);

      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPlan,
          when, // "now" | "period_end"
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao mudar de plano");

      // Caso "period_end": nenhuma ação de pagamento imediata
      if (when === "period_end" || !data?.clientSecret) {
        setOkMsg(
          when === "period_end"
            ? "Plano agendado para trocar no fim do ciclo atual."
            : "Plano atualizado com sucesso."
        );
        toast({
          variant: "success",
          title: "Plano atualizado",
          description:
            when === "period_end"
              ? "A mudança ocorrerá no fim do ciclo."
              : "Mudança aplicada.",
        });
        await update().catch(() => {});
        refetch();
        return;
      }

      // Caso "now": pode haver cobrança imediata -> precisamos confirmar
      setClientSecret(data.clientSecret);
      setSubscriptionId(data.subscriptionId || null);
    } catch (e: any) {
      const msg = e?.message || "Erro inesperado";
      setErr(msg);
      toast({
        variant: "error",
        title: "Falha ao mudar plano",
        description: String(msg),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-4">
      <h2 className="text-lg font-semibold">Mudar de plano</h2>

      <div className="text-sm text-gray-600">
        Plano atual: <strong>{currentPlan ?? "—"}</strong>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium mb-1">Novo plano</div>
          <div className="flex gap-2">
            <button
              onClick={() => setNewPlan("monthly")}
              className={`px-3 py-2 rounded border ${newPlan === "monthly" ? "bg-gray-100" : ""}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setNewPlan("annual")}
              className={`px-3 py-2 rounded border ${newPlan === "annual" ? "bg-gray-100" : ""}`}
            >
              Anual
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Alterar para anual pode gerar cobrança pró-rata imediata se escolher “agora”.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium mb-1">Quando aplicar</div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer">
              <input
                type="radio"
                name="when"
                value="now"
                checked={when === "now"}
                onChange={() => setWhen("now")}
              />
              <span>Agora (pode haver cobrança pró-rata)</span>
            </label>
            <label className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer">
              <input
                type="radio"
                name="when"
                value="period_end"
                checked={when === "period_end"}
                onChange={() => setWhen("period_end")}
              />
              <span>No fim do ciclo atual (sem cobrança agora)</span>
            </label>
          </div>
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {okMsg && <p className="text-sm text-green-600">{okMsg}</p>}

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? "Aplicando..." : "Aplicar mudança"}
      </button>

      {/* Se a API retornou clientSecret, abrimos um mini fluxo de confirmação */}
      {clientSecret && elementsOptions && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-white rounded-lg p-4 shadow-lg">
            <h3 className="text-base font-semibold mb-3">Confirmar cobrança</h3>
            <Elements stripe={stripePromise} options={elementsOptions} key={clientSecret}>
              <InlineConfirm
                subscriptionId={subscriptionId}
                onClose={async (ok) => {
                  setClientSecret(null);
                  setSubscriptionId(null);
                  if (ok) {
                    setOkMsg("Plano atualizado e pagamento confirmado.");
                    toast({
                      variant: "success",
                      title: "Pagamento confirmado",
                      description: "Seu plano foi atualizado.",
                    });
                    await update().catch(() => {});
                    refetch();
                  }
                }}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}

/** Componente mínimo para confirmar o PaymentIntent retornado pelo change-plan (when=now) */
function InlineConfirm({
  subscriptionId,
  onClose,
}: {
  subscriptionId: string | null;
  onClose: (ok: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast } = useToast();

  async function confirm() {
    if (!stripe || !elements) return;
    try {
      setSubmitting(true);
      setErr(null);

      const { error } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) throw new Error(error.message || "Falha ao confirmar pagamento");
      onClose(true);
    } catch (e: any) {
      const msg = e?.message || "Erro inesperado";
      setErr(msg);
      toast({
        variant: "error",
        title: "Falha ao confirmar",
        description: String(msg),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Sub: {subscriptionId ?? "—"}</span>
      </div>
      <PaymentElement />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded border"
          onClick={() => onClose(false)}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={confirm}
          disabled={submitting || !stripe || !elements}
        >
          {submitting ? "Confirmando..." : "Confirmar pagamento"}
        </button>
      </div>
    </div>
  );
}

