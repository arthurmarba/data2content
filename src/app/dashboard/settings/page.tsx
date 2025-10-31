// src/app/dashboard/settings/page.tsx (RESPONSIVO MOBILE-FIRST)
"use client";

import ChangePlanCard from "../billing/ChangePlanCard";
import SubscriptionCard from "@/components/billing/SubscriptionCard";
import DeleteAccountSection from "./DeleteAccountSection";

export default function SettingsPage() {
  return (
    <div className="w-full min-h-screen bg-[#FAFAFB]">
      {/* Container central: respeita header fixo e safe-area no iOS */}
      <div className="mx-auto w-full max-w-[800px] px-4 sm:px-6 pt-header pb-safe">
        {/* Espaçamento vertical mobile-first */}
        <div className="space-y-7 sm:space-y-10">
          {/* Seção 1: Cabeçalho da Página */}
          <section>
            <h1
              id="subscription-management-title"
              className="text-[20px] sm:text-[22px] font-bold text-[#1E1E1E] mb-1"
              style={{ scrollMarginTop: "var(--header-h, 4rem)" }}
            >
              Configurações da Conta
            </h1>
            <p className="text-[13px] leading-relaxed text-[#666]">
              Gerencie seu plano, cobrança e dados da conta em um só lugar.
            </p>
          </section>

          {/* Seção 2: Minha Assinatura */}
          <section
            id="subscription-management"
            aria-labelledby="settings-subscription-title"
            className="bg-white rounded-[12px] p-4 sm:p-6 shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
          >
            <h2
              id="settings-subscription-title"
              className="flex items-center gap-2 border-l-[3px] border-[#D62E5E] pl-2 text-[16px] font-semibold text-[#1E1E1E] mb-3"
            >
              <span role="img" aria-label="status">
                🪙
              </span>
              Minha Assinatura
            </h2>
            <p className="text-[14px] leading-relaxed text-[#555] mb-4 sm:mb-5">
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
            className="bg-white rounded-[12px] p-4 sm:p-6 shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
          >
            <h2
              id="settings-change-plan-title"
              className="flex items-center gap-2 border-l-[3px] border-[#D62E5E] pl-2 text-[16px] font-semibold text-[#1E1E1E] mb-3"
            >
              <span role="img" aria-label="trocar plano">
                🔄
              </span>
              Mudar de Plano
            </h2>
            <p className="text-[14px] leading-relaxed text-[#555] mb-4 sm:mb-5">
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
            className="rounded-[12px] bg-[#FFF6F7] p-4 sm:p-6 shadow-[0_2px_6px_rgba(214,46,94,0.15)] border border-[#FDD9E0]"
          >
            <h2
              id="settings-danger-zone-title"
              className="flex items-center gap-2 border-l-[3px] border-[#D62E5E] pl-2 text-[16px] font-semibold text-[#A72B3C] mb-3"
            >
              <span role="img" aria-label="alerta">
                🚨
              </span>
              Zona de Perigo
            </h2>
            <p className="text-[14px] leading-relaxed text-[#A72B3C] mb-4 sm:mb-5">
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
