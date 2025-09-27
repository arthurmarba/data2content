"use client";

import React from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import SubscribeCtaBanner from "@/app/mediakit/components/SubscribeCtaBanner";
import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";

/**
 * Renderiza o CTA correto para a Discover:
 * - Assinantes (active/trialing): mostra o bloco de vínculo do WhatsApp
 * - Não assinantes: mostra o banner de assinatura
 *
 * Mantém a decisão no client para evitar estado "travado" após SSR
 * quando a sessão ainda não refletiu a mudança de plano.
 */
export default function DiscoverBillingGate() {
  const { planStatus, isLoading, nextAction } = useBillingStatus();
  const isActive = planStatus === "active" || planStatus === "trialing" || planStatus === "non_renewing";

  // Evita flicker inicial: não renderiza nada até primeira leitura
  if (isLoading && !planStatus) return null;

  if (isActive) {
    return (
      <div className="mb-4">
        <WhatsAppConnectInline />
      </div>
    );
  }

  return (
    <div className="mb-4">
      <SubscribeCtaBanner
        title="Desbloqueie nossa IA avançada"
        description="Torne-se assinante e utilize nossa IA para planejar conteúdo."
        primaryLabel={nextAction === "reactivate" ? "Reativar plano" : "Ativar plano"}
        secondaryLabel="Ver planos"
        isSubscribed={false}
      />
    </div>
  );
}

