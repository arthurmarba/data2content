// src/app/dashboard/settings/page.tsx (UI ATUALIZADA)
"use client";

import ChangePlanCard from "../billing/ChangePlanCard";
import SubscriptionCard from "@/components/billing/SubscriptionCard";
import DeleteAccountSection from "./DeleteAccountSection";

export default function SettingsPage() {
  return (
    // Container principal com espaçamento consistente entre as seções
    <div className="space-y-10">
      
      {/* Seção 1: Cabeçalho da Página */}
      <section>
        <h1
          id="subscription-management-title"
          className="text-3xl font-bold text-brand-dark scroll-mt-20"
        >
          Configurações da Conta
        </h1>
        <p className="mt-2 text-md text-gray-600">
          Gerencie seu plano, cobrança e dados da conta em um só lugar.
        </p>
      </section>

      {/* Seção 2: Gerenciamento da Assinatura (agora dentro de um card) */}
      <section 
        id="subscription-management"
        className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
      >
        <h2 className="text-xl font-semibold text-brand-dark">Minha Assinatura</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Visualize o status do seu plano, cancele a renovação ou reative sua assinatura.
        </p>
        {/* O componente funcional que já corrigimos */}
        <SubscriptionCard />
      </section>

      {/* Seção 3: Mudar de Plano (agora dentro de um card) */}
      <section 
        id="change-plan"
        className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
      >
        <h2 className="text-xl font-semibold text-brand-dark">Mudar de Plano</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Faça upgrade ou downgrade do seu plano a qualquer momento.
        </p>
        <ChangePlanCard />
      </section>

      {/* Seção 4: Excluir Conta (agora dentro de um "card de perigo") */}
      <section 
        id="delete-account-section"
        className="bg-red-50 p-6 rounded-xl shadow-lg border border-red-200"
      >
        <h2 className="text-xl font-semibold text-red-700">Zona de Perigo</h2>
        <p className="text-sm text-red-600 mt-1 mb-6">
          A exclusão da sua conta é uma ação permanente e resultará na perda de todos os seus dados.
        </p>
        <DeleteAccountSection />
      </section>

    </div>
  );
}