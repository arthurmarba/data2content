"use client";

import ChangePlanCard from "../billing/ChangePlanCard";
import CancelRenewalCard from "../billing/CancelRenewalCard";
import DeleteAccountSection from "./DeleteAccountSection";

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-8">
      <section className="space-y-2">
        {/* CORREÇÃO: Adicionado o id para a função de rolagem funcionar. */}
        <h1
          id="subscription-management-title"
          className="text-2xl font-semibold scroll-mt-20"
        >
          Configurações da Conta
        </h1>
        <p className="text-sm text-gray-600">
          Gerencie seu plano, cobrança e dados da conta.
        </p>
      </section>

      <ChangePlanCard />
      <CancelRenewalCard />
      <DeleteAccountSection />
    </div>
  );
}
