"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useBillingStatus } from "@/app/hooks/useBillingStatus";

export default function CancelRenewalCard() {
  const { data: session, update } = useSession();
  const { refetch } = useBillingStatus({ auto: false });
  const { toast } = useToast();
  const planStatus = (session?.user as any)?.planStatus as
    | "active"
    | "non_renewing"
    | "inactive"
    | "pending"
    | undefined;
  const planExpiresAt = (session?.user as any)?.planExpiresAt as string | undefined;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canCancel = planStatus === "active";
  const alreadyCancelled = planStatus === "non_renewing";

  async function cancelRenewal() {
    try {
      setLoading(true);
      setErr(null);
      setOkMsg(null);

      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Falha ao cancelar renovação");

      setOkMsg(
        "Renovação cancelada. Seu acesso permanece até o fim do período já pago."
      );
      toast({
        variant: "success",
        title: "Renovação cancelada",
        description: "Você manterá acesso até expirar.",
      });
      await update().catch(() => {});
      refetch();
    } catch (e: any) {
      const msg = e?.message || "Erro inesperado";
      setErr(msg);
      toast({
        variant: "error",
        title: "Falha ao cancelar",
        description: String(msg),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <h2 className="text-lg font-semibold">Cancelar renovação</h2>

      <div className="text-sm text-gray-600">
        Status atual: <strong>{planStatus ?? "—"}</strong>
      </div>
      {planExpiresAt && (
        <div className="text-sm text-gray-600">
          Expira em: <strong>{new Date(planExpiresAt).toLocaleString()}</strong>
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
      {okMsg && <p className="text-sm text-green-600">{okMsg}</p>}

      <button
        onClick={cancelRenewal}
        disabled={!canCancel || loading}
        title={alreadyCancelled ? "A renovação já foi cancelada" : ""}
        className={`px-4 py-2 rounded ${
          canCancel ? "bg-black text-white" : "bg-gray-200 text-gray-500"
        } disabled:opacity-50`}
      >
        {loading ? "Cancelando..." : "Cancelar renovação"}
      </button>

      <p className="text-xs text-gray-500">
        Você poderá continuar usando o produto até a data de expiração.
      </p>
    </div>
  );
}

