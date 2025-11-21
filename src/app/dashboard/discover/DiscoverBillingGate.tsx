"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";
import GlassCard from "@/components/GlassCard";

/**
 * Mensagem complementar exibida ao fim da página.
 * Mobile já conta com a barra de ações fixa, então evitamos duplicar CTA.
 */
export default function DiscoverBillingGate() {
  const { hasPremiumAccess, isLoading } = useBillingStatus();

  if (isLoading) {
    return (
      <GlassCard className="border border-brand-glass p-5 text-sm text-brand-text-secondary/80 shadow-[0_35px_90px_rgba(15,23,42,0.08)]">
        Validando sua assinatura…
      </GlassCard>
    );
  }

  if (!hasPremiumAccess) {
    return (
      <GlassCard className="space-y-4 border border-brand-glass p-5 text-sm text-brand-text-secondary/90 shadow-[0_35px_90px_rgba(15,23,42,0.08)]" showGlow>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-2xl bg-brand-magenta-soft p-2 text-brand-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="space-y-2">
            <p className="text-base font-semibold text-brand-dark">Ative a IA quando estiver pronto</p>
            <p>
              O botão “Ativar IA no WhatsApp” libera horários quentes, formatos vencedores e benchmarks personalizados para
              o seu nicho. Explore as ideias e decida quando avançar.
            </p>
          </div>
        </div>
        <p className="text-xs text-brand-text-secondary/70">
          Assim que ativar, enviamos alertas automáticos e ajustes direto no WhatsApp.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="border border-brand-glass p-5 shadow-[0_35px_90px_rgba(15,23,42,0.08)]" showGlow>
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-brand-text-secondary/70">
        Conecte seu WhatsApp
      </div>
      <WhatsAppConnectInline />
    </GlassCard>
  );
}
