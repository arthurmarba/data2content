"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { stripePromise } from "@/app/lib/stripe-browser";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useBillingStatus } from "@/app/hooks/useBillingStatus";

type Plan = "monthly" | "annual";
type When = "now" | "period_end";

export default function ChangePlanCard() {
  const { data: session, update } = useSession();
  const { refetch } = useBillingStatus({ auto: false });
  const { toast } = useToast();
  const [currentPlan, setCurrentPlan] = useState<Plan | undefined>(undefined);
  const [newPlan, setNewPlan] = useState<Plan>("monthly");

  useEffect(() => {
    fetch('/api/plan/status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const plan = d.interval === 'year' ? 'annual' : 'monthly';
        setCurrentPlan(plan);
        setNewPlan(plan === 'annual' ? 'monthly' : 'annual');
      })
      .catch(() => {});
  }, [refetch]);

  const [when, setWhen] = useState<When>("now");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  // --- New states for confirmation modal ---
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ amountDue: number; currency: string } | null>(null);

  const elementsOptions: StripeElementsOptions | undefined = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: "stripe" } } : undefined),
    [clientSecret]
  );

  const currentPlanText = currentPlan === 'annual' ? 'Anual' : currentPlan === 'monthly' ? 'Mensal' : '—';
  const newPlanText = newPlan === 'annual' ? 'Anual' : 'Mensal';
  const disabled = loading || isPreviewing || !currentPlan || currentPlan === newPlan;

  // This function now only performs the final plan change
  async function handleSubmit() {
    try {
      setLoading(true);
      setErr(null);
      setOkMsg(null);

      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: newPlan,
          when,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao mudar de plano");
      
      if (when === "period_end") {
        setOkMsg("Plano agendado para trocar no fim do ciclo atual.");
        toast({ variant: "success", title: "Mudança agendada" });
        await update();
        refetch();
        return;
      }
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setSubscriptionId(data.subscriptionId || null);
        return;
      }
      
      setOkMsg("Seu plano foi alterado com sucesso.");
      toast({ variant: "success", title: "Plano atualizado" });
      await update();
      refetch();

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

  // New function to handle the preview and open the confirmation modal
  async function handlePreviewAndConfirm() {
    if (when === 'period_end') {
      return handleSubmit();
    }

    setIsPreviewing(true);
    setErr(null);
    try {
      const res = await fetch('/api/billing/preview-plan-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPlan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao pré-visualizar cobrança.');

      setPreviewData(data);
      setIsConfirmModalOpen(true);
    } catch (e: any) {
      setErr(e.message);
      toast({
        variant: "error",
        title: "Erro ao calcular",
        description: String(e.message),
      });
    } finally {
      setIsPreviewing(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-4">
      <h2 className="text-lg font-semibold">Mudar de plano</h2>

      <div className="text-sm text-gray-600">
        Plano atual: <strong>{currentPlanText}</strong>
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
        onClick={handlePreviewAndConfirm}
        disabled={disabled}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {isPreviewing ? "Calculando..." : "Aplicar mudança"}
      </button>

      {/* --- Confirmation Modal --- */}
      {isConfirmModalOpen && previewData && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl m-4">
            <h3 className="text-lg font-bold">Confirmar Mudança de Plano</h3>
            <p className="mt-2 text-sm text-gray-600">
              Você está prestes a mudar do plano <strong>{currentPlanText}</strong> para o plano <strong>{newPlanText}</strong>.
            </p>
            
            {previewData.amountDue > 0 ? (
              <p className="mt-4 font-semibold text-gray-800">
                Será feita uma cobrança imediata de{' '}
                <strong>
                  {(previewData.amountDue / 100).toLocaleString('pt-BR', { style: 'currency', currency: previewData.currency.toUpperCase() })}
                </strong>.
              </p>
            ) : (
              <p className="mt-4 font-semibold text-gray-800">
                Não haverá cobrança imediata para esta alteração.
              </p>
            )}
            <p className="text-xs text-gray-500">Este valor considera o crédito pelo tempo não utilizado do seu plano atual.</p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded border text-sm"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  handleSubmit();
                }}
                disabled={loading}
              >
                {loading ? "Aguarde..." : "Confirmar e Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Stripe Payment Modal --- */}
      {clientSecret && elementsOptions && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-white rounded-lg p-4 shadow-lg m-4">
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
                    await update();
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
      onClose(false); // Indicate failure on close
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
      <div className="flex gap-2 justify-end">
        <button
          className="px-3 py-2 rounded border text-sm"
          onClick={() => onClose(false)}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          onClick={confirm}
          disabled={submitting || !stripe || !elements}
        >
          {submitting ? "Confirmando..." : "Confirmar pagamento"}
        </button>
      </div>
    </div>
  );
}
