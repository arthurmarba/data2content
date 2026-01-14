import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useBillingStatus } from "@/app/hooks/useBillingStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { track } from "@/lib/track";
import CancelSubscriptionModal from "@/components/billing/CancelSubscriptionModal";

export default function CancelRenewalCard() {
  const { data: session } = useSession();
  const { planStatus, planExpiresAt, refetch } = useBillingStatus();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const canCancel = planStatus === "active";
  const alreadyCancelled = (planStatus as string) === "canceled";

  async function cancelRenewal({
    reasons,
    comment,
  }: {
    reasons: string[];
    comment: string;
  }) {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons, comment }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao cancelar a renovação");
      }

      toast({
        variant: "success",
        title: "Renovação cancelada",
        description: "Atualizando o status da sua assinatura...",
      });

      const planInterval = session?.user?.planInterval === "year" ? "anual" : "mensal";
      if (session?.user?.id) {
        track("subscription_canceled", {
          creator_id: session.user.id,
          plan: planInterval,
          currency: null,
          value: null,
        });
      }

      window.location.reload();

    } catch (e: any) {
      const msg = e?.message || "Ocorreu um erro inesperado";
      toast({
        variant: "error",
        title: "Falha ao cancelar",
        description: String(msg),
      });
      setLoading(false);
    }
  }

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "canceled":
        return "Cancelado (não renovará)";
      case "past_due":
        return "Pagamento pendente";
      case "trial":
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

      {alreadyCancelled && (
        <p className="text-sm text-green-700 bg-green-50 p-3 rounded-md font-medium">
          A renovação automática já está cancelada.
        </p>
      )}

      {canCancel && (
        <>
          <button
            onClick={() => setShowModal(true)}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Cancelando..." : "Cancelar Renovação"}
          </button>
          <p className="text-xs text-gray-500">
            Ao cancelar, você poderá continuar usando o produto até a data de
            expiração do período já pago.
          </p>
        </>
      )}

      <CancelSubscriptionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={(data) => {
          cancelRenewal(data);
          setShowModal(false);
        }}
        currentPeriodEnd={
          planExpiresAt instanceof Date
            ? planExpiresAt.toISOString()
            : (planExpiresAt as string | null)
        }
      />
    </div>
  );
}
