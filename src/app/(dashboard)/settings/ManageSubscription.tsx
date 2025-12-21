"use client";

import React, { useState } from "react";
import SubscriptionCard from "@/components/billing/SubscriptionCard";
import ChangePlanCard from "@/app/dashboard/billing/ChangePlanCard";
import DeleteAccountSection from "@/app/dashboard/settings/DeleteAccountSection";
import { FaCreditCard } from "react-icons/fa";

export default function ManageSubscription() {
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#FAFAFB]">
      <div className="dashboard-page-shell flex min-h-screen items-center justify-center py-6">
        <div className="w-full max-w-md space-y-8">
          {/* Header Minimalista */}
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
              <FaCreditCard className="h-6 w-6 text-[#D62E5E]" />
            </div>
            <h1 id="subscription-management-title" className="text-2xl font-bold text-gray-900">
              Minha Assinatura
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Gerencie seu plano e detalhes de cobrança.
            </p>
          </div>

          <SubscriptionCard onChangePlan={() => setIsChangePlanOpen(true)} />

          {/* Zona de Perigo (Sempre visível) */}
          <div className="rounded-xl border border-red-100 bg-red-50 p-6">
            <h3 className="mb-2 text-sm font-semibold text-red-900">Zona de Perigo</h3>
            <p className="mb-4 text-xs text-red-700">
              Ações irreversíveis relacionadas à sua conta.
            </p>
            <DeleteAccountSection />
          </div>
        </div>
      </div>

      {/* Modal de Mudança de Plano */}
      {isChangePlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsChangePlanOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>
            <div className="p-6">
              <h2 className="mb-6 text-xl font-bold text-gray-900">Gerenciar Assinatura</h2>
              <ChangePlanCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
