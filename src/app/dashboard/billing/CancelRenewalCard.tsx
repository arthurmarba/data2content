"use client";

import React, { useState } from "react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  planStatus: string | null;
  planExpiresAt: string | null;
};

export default function CancelRenewalCard({ planStatus, planExpiresAt }: Props) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canCancel = planStatus === "active" || planStatus === "trialing";
  const isTrial = planStatus === "trialing";
  const alreadyCancelled = planStatus === "canceled";

  // <<< INÍCIO DA CORREÇÃO >>>
  async function cancelRenewal() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao cancelar a renovação");
      }

      toast({
        variant: "success",
        title: "Renovação cancelada",
        description: "Atualizando o status da sua assinatura...",
      });

      // Força a recarga da página para buscar a sessão e o status mais recentes.
      // Esta é a forma mais robusta de garantir a sincronia da UI.
      window.location.reload();

    } catch (e: any) {
      const msg = e?.message || "Ocorreu um erro inesperado";
      setErr(msg);
      toast({
        variant: "error",
        title: "Falha ao cancelar",
        description: String(msg),
      });
      setLoading(false); // Desativa o loading apenas em caso de erro
    }
  }
  // <<< FIM DA CORREÇÃO >>>

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "canceled":
        return "Cancelado (não renovará)";
      case "past_due":
        return "Pagamento pendente";
      case "trial":
      case "trialing":
        return "Período de teste";
      default:
        return "Inativo";
    }
  };

  return (
    <div className="border rounded-lg p-4 sm:p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Renovação Automática</h2>
        <p className="text-sm text-gray-600">
          Gerencie a renovação automática da sua assinatura.
        </p>
      </div>

      <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md space-y-1">
        <p>
          Status atual:{" "}
          <strong className="font-medium">{getStatusLabel(planStatus)}</strong>
        </p>
        {planExpiresAt && (
          <p>
            Seu acesso termina em:{" "}
            <strong className="font-medium">
              {format(new Date(planExpiresAt), "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
            </strong>
          </p>
        )}
      </div>

      {err && <p className="text-sm text-red-600 font-medium">{err}</p>}

      {alreadyCancelled && (
        <p className="text-sm text-green-700 bg-green-50 p-3 rounded-md font-medium">
          A renovação automática já está cancelada.
        </p>
      )}

      {canCancel && (
        <>
          <button
            onClick={cancelRenewal}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Cancelando..." : isTrial ? "Cancelar pagamento" : "Cancelar recorrência"}
          </button>
          <p className="text-xs text-gray-500">
            {isTrial
              ? "Ao cancelar, você não será cobrado ao final do período de teste."
              : "Ao cancelar, você poderá continuar usando o produto até a data de expiração do período já pago."}
          </p>
        </>
      )}
    </div>
  );
}