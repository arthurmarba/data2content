// src/app/dashboard/settings/page.tsx
"use client";

import { useSession } from "next-auth/react";
import ChangePlanCard from "../billing/ChangePlanCard";
import CancelRenewalCard from "../billing/CancelRenewalCard";
import DeleteAccountSection from "./DeleteAccountSection";

export default function SettingsPage() {
  const { data: session } = useSession();
  const planStatus = session?.user?.planStatus ?? "inactive";

  return (
    <div className="p-6 space-y-6">
      <section className="space-y-2">
        <h1
          id="subscription-management-title"
          className="text-2xl font-semibold"
        >
          Minha Assinatura
        </h1>
        <p className="text-sm text-gray-600">
          Gerencie seu plano, cobrança e renovação automática.
        </p>

        {/* Aviso didático quando o status é 'pending' */}
        {planStatus === "pending" && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">Assinatura pendente</p>
            <p className="mt-1">
              Não encontramos uma cobrança ativa vinculada. Você pode{" "}
              <a
                href="#delete-account"
                className="underline hover:opacity-90"
              >
                excluir sua conta
              </a>{" "}
              se preferir, ou concluir a assinatura escolhendo um plano abaixo.
            </p>
          </div>
        )}
      </section>

      <ChangePlanCard />
      <CancelRenewalCard />

      {/* Seção de exclusão mantém o bloqueio apenas para planos realmente ativos/trial */}
      <DeleteAccountSection />
    </div>
  );
}
