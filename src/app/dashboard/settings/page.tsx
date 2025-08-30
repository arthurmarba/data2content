// src/app/dashboard/settings/page.tsx (RESPONSIVO MOBILE-FIRST)
"use client";

import ChangePlanCard from "../billing/ChangePlanCard";
import SubscriptionCard from "@/components/billing/SubscriptionCard";
import DeleteAccountSection from "./DeleteAccountSection";

export default function SettingsPage() {
  return (
    <div className="w-full">
      {/* Container central: respeita header fixo e safe-area no iOS */}
      <div className="mx-auto w-full max-w-[800px] px-4 pt-header pb-safe">
        {/* Espaçamento vertical mobile-first */}
        <div className="space-y-6 sm:space-y-10">
          {/* Seção 1: Cabeçalho da Página */}
          <section>
            <h1
              id="subscription-management-title"
              className="text-2xl sm:text-3xl font-bold text-brand-dark"
              style={{ scrollMarginTop: "var(--header-h, 4rem)" }}
            >
              Configurações da Conta
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Gerencie seu plano, cobrança e dados da conta em um só lugar.
            </p>
          </section>

          {/* Seção 2: Minha Assinatura */}
          <section
            id="subscription-management"
            aria-labelledby="settings-subscription-title"
            className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200"
          >
            <h2 id="settings-subscription-title" className="text-lg sm:text-xl font-semibold text-brand-dark">
              Minha Assinatura
            </h2>
            <p className="text-sm text-gray-500 mt-1 mb-4 sm:mb-6">
              Visualize o status do seu plano, cancele a renovação ou reative sua assinatura.
            </p>
            {/* Proteção contra overflow horizontal em mobile */}
            <div className="overflow-x-auto">
              <SubscriptionCard />
            </div>
          </section>

          {/* Seção 3: Mudar de Plano */}
          <section
            id="change-plan"
            aria-labelledby="settings-change-plan-title"
            className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200"
          >
            <h2 id="settings-change-plan-title" className="text-lg sm:text-xl font-semibold text-brand-dark">
              Mudar de Plano
            </h2>
            <p className="text-sm text-gray-500 mt-1 mb-4 sm:mb-6">
              Faça upgrade ou downgrade do seu plano a qualquer momento.
            </p>
            {/* Proteção contra overflow horizontal em mobile */}
            <div className="overflow-x-auto">
              <ChangePlanCard />
            </div>
          </section>

          {/* Seção 4: Excluir Conta (zona de perigo) */}
          <section
            id="delete-account-section"
            aria-labelledby="settings-danger-zone-title"
            className="bg-red-50 p-4 sm:p-6 rounded-xl shadow-lg border border-red-200"
          >
            <h2 id="settings-danger-zone-title" className="text-lg sm:text-xl font-semibold text-red-700">
              Zona de Perigo
            </h2>
            <p className="text-sm text-red-600 mt-1 mb-4 sm:mb-6">
              A exclusão da sua conta é uma ação permanente e resultará na perda de todos os seus dados.
            </p>
            <DeleteAccountSection />
          </section>

          {/* Respiro final para não encostar na home bar em iOS */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
