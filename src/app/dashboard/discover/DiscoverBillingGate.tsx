"use client";

import React from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import SubscribeCtaBanner from "@/app/mediakit/components/SubscribeCtaBanner";
import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";

/**
 * Mantém CTAs auxiliares na Discover sem bloquear a experiência.
 * Usuários sem plano veem um lembrete de upgrade, mas continuam com o acesso completo.
 */
export default function DiscoverBillingGate() {
  const { hasPremiumAccess, isLoading, nextAction } = useBillingStatus();

  // Evita flicker inicial: não renderiza nada até primeira leitura
  if (isLoading && hasPremiumAccess) return null;

  return (
    <div className="mb-4 space-y-3">
      {!hasPremiumAccess && (
        <SubscribeCtaBanner
          title="Experimente todo o potencial da IA"
          description="Seu plano pode ser reativado a qualquer momento, mas você já pode explorar a Comunidade normalmente."
          primaryLabel={nextAction === "reactivate" ? "Reativar plano" : "Ativar plano"}
          secondaryLabel="Ver planos"
          isSubscribed={false}
        />
      )}
      {hasPremiumAccess && <WhatsAppConnectInline />}
    </div>
  );
}
