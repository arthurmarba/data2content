"use client";

import React, { useState } from "react";
import SubscriptionCard from "@/components/billing/SubscriptionCard";
import ChangePlanCard from "@/app/dashboard/billing/ChangePlanCard";
import DeleteAccountSection from "@/app/dashboard/settings/DeleteAccountSection";
import { BillingMobileShell } from "@/app/dashboard/settings/BillingMobileShell";
import { useSidebarViewport } from "@/app/dashboard/components/sidebar/hooks";

export default function ManageSubscription() {
  const { mounted, isMobile } = useSidebarViewport();
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);

  // Mobile: shell nativo com header, scroll e UX integrados ao Diagnóstico
  if (mounted && isMobile) {
    return <BillingMobileShell />;
  }

  // Desktop: layout centralizado existente
  return (
    <div className="min-h-screen w-full bg-[#FAFAFB]">
      <div className="dashboard-page-shell flex min-h-screen items-center justify-center py-6">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 id="subscription-management-title" className="text-2xl font-bold text-gray-900">
              Seu plano
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Gerencie sua assinatura e detalhes de cobrança.
            </p>
          </div>

          <SubscriptionCard onChangePlan={() => setIsChangePlanOpen(true)} />

          {/* Conta — colapsada por padrão no desktop */}
          <details className="group rounded-xl border border-red-100 bg-red-50">
            <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-semibold text-red-900 marker:hidden list-none">
              Conta
              <span className="text-red-400 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-red-100 px-5 pb-5 pt-4">
              <p className="mb-4 text-xs leading-relaxed text-red-700">
                Ações irreversíveis relacionadas à sua conta.
              </p>
              <DeleteAccountSection />
            </div>
          </details>
        </div>
      </div>

      {/* Modal de Mudança de Plano */}
      {isChangePlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsChangePlanOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
              aria-label="Fechar"
            >
              ✕
            </button>
            <div className="p-6">
              <h2 className="mb-6 text-xl font-bold text-gray-900">Mudar de plano</h2>
              <ChangePlanCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
