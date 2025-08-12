"use client";

import React, { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Props = {
  subscriptionId: string | null;
  onBack: () => void;
};

export default function CheckoutForm({ subscriptionId, onBack }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { update } = useSession();

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    try {
      setSubmitting(true);
      setErr(null);

      const returnUrl = `${window.location.origin}/dashboard/billing/success`;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (error) {
        setErr(error.message || "Falha ao confirmar pagamento");
        setSubmitting(false);
        return;
      }

      try {
        await update();
      } catch {}

      if (paymentIntent?.status === "succeeded") {
        router.push("/dashboard/billing/success?ok=1");
        return;
      }

      router.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm underline">
          Voltar
        </button>
        {subscriptionId && (
          <span className="text-xs text-gray-500">Sub: {subscriptionId}</span>
        )}
      </div>

      <PaymentElement />

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {submitting ? "Processando..." : "Pagar e ativar assinatura"}
      </button>

      <p className="text-xs text-gray-500">
        Ao confirmar, você concorda com a renovação automática conforme o plano
        selecionado. Você pode cancelar a renovação em Configurações &gt; Assinatura.
      </p>
    </form>
  );
}

