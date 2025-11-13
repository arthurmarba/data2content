"use client";

import React from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";
import { Sparkles } from "lucide-react";

/**
 * Mensagem complementar exibida ao fim da página.
 * Mobile já conta com a barra de ações fixa, então evitamos duplicar CTA.
 */
export default function DiscoverBillingGate() {
  const { hasPremiumAccess, isLoading } = useBillingStatus();

  if (isLoading) return null;

  if (!hasPremiumAccess) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-brand-magenta/10 p-2 text-brand-magenta">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Ative a IA quando estiver pronto</p>
            <p>
              O botão “Ativar IA no WhatsApp” no topo libera horários quentes, formatos vencedores e benchmarks
              personalizados para o seu nicho. Explore as ideias e decida quando avançar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <WhatsAppConnectInline />;
}
