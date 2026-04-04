"use client";

import { useMemo } from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";

export type DiscoverCtaState =
  | "instagram_connect"
  | "instagram_reconnect"
  | "plan_active"
  | "reactivate_plan"
  | "checkout_pending"
  | "checkout_expired"
  | "payment_issue"
  | "subscribe";

export type DiscoverCtaConfig = {
  state: DiscoverCtaState;
  kind: "action" | "status";
  label: string;
  description?: string;
  stageLabel: string;
  step: number;
  totalSteps: number;
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
  statusLabel?: string;
};

function openSubscribeModal() {
  try {
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/dashboard/discover";
    window.dispatchEvent(
      new CustomEvent("open-subscribe-modal", {
        detail: {
          context: "planning",
          source: "discover_cta",
          returnTo,
        },
      })
    );
  } catch {
    /* ignore SSR */
  }
}

export function useDiscoverCtaConfig(allowedPersonalized?: boolean): DiscoverCtaConfig {
  const {
    hasPremiumAccess,
    instagram,
    isLoading,
    needsCheckout,
    needsAbort,
    needsPaymentUpdate,
    nextAction,
  } = useBillingStatus();

  const instagramConnected = Boolean(allowedPersonalized || instagram?.connected);
  const needsReconnect = Boolean(instagram?.needsReconnect);

  const state: DiscoverCtaState = useMemo(() => {
    if (nextAction === "reactivate") return "reactivate_plan";
    if (nextAction === "resubscribe") return "subscribe";
    if (needsPaymentUpdate) return "payment_issue";
    if (needsCheckout) return "checkout_pending";
    if (needsAbort) return "checkout_expired";
    if (hasPremiumAccess) {
      if (!instagramConnected) return needsReconnect ? "instagram_reconnect" : "instagram_connect";
      if (needsReconnect) return "instagram_reconnect";
      return "plan_active";
    }
    return "subscribe";
  }, [
    hasPremiumAccess,
    instagramConnected,
    needsReconnect,
    needsCheckout,
    needsAbort,
    needsPaymentUpdate,
    nextAction,
  ]);

  return useMemo<DiscoverCtaConfig>(() => {
    const totalSteps = 4;
    switch (state) {
      case "instagram_connect":
        return {
          state,
          kind: "action",
          label: "Conectar Instagram",
          description: "Personalize a curadoria e libere horários quentes conectando seu perfil.",
          stageLabel: "Etapa 2/4 — Conectar Instagram",
          step: 2,
          totalSteps,
          href: "/dashboard/instagram/connect?next=planner",
          disabled: isLoading,
        };
      case "instagram_reconnect":
        return {
          state,
          kind: "action",
          label: "Reativar conexão",
          description: "Sua conta precisa ser autenticada novamente para manter as recomendações personalizadas.",
          stageLabel: "Conexão do Instagram pendente",
          step: 2,
          totalSteps,
          href: "/dashboard/instagram/connect?next=planner",
          disabled: isLoading,
        };
      case "reactivate_plan":
        return {
          state,
          kind: "action",
          label: "Reativar Plano Pro",
          description: "Volte a receber análises automáticas, alertas no WhatsApp e oportunidades de publicidade sem exclusividade.",
          stageLabel: "Recupere o acesso ao Plano Pro",
          step: 4,
          totalSteps,
          href: "/dashboard/billing",
          disabled: isLoading,
        };
      case "payment_issue":
        return {
          state,
          kind: "action",
          label: "Atualizar pagamento",
          description: "Existe um pagamento pendente. Atualize seu método de pagamento para recuperar o acesso.",
          stageLabel: "Pagamento pendente",
          step: 4,
          totalSteps,
          href: "/dashboard/billing",
          disabled: isLoading,
        };
      case "checkout_pending":
        return {
          state,
          kind: "action",
          label: "Continuar checkout",
          description: "Existe um checkout pendente. Retome ou aborte a tentativa para voltar ao Plano Pro.",
          stageLabel: "Checkout pendente",
          step: 4,
          totalSteps,
          href: "/dashboard/billing",
          disabled: isLoading,
        };
      case "checkout_expired":
        return {
          state,
          kind: "action",
          label: "Assinar Plano Pro",
          description: "Tentativa expirada. Voce pode iniciar um novo checkout agora.",
          stageLabel: "Checkout expirado",
          step: 4,
          totalSteps,
          onPress: openSubscribeModal,
          disabled: isLoading,
        };
      case "subscribe":
        return {
          state,
          kind: "action",
          label: "Assinar Plano Pro",
          description: "Ative a IA ilimitada, análises comparativas e receba oportunidades de publicidade sem comissão.",
          stageLabel: "Completar acesso ao Plano Pro",
          step: 4,
          totalSteps,
          onPress: openSubscribeModal,
          disabled: isLoading,
        };
      case "plan_active":
      default:
      return {
        state,
        kind: "status",
        label: "Plano Pro ativo",
        statusLabel: "Plano Pro ativo",
        description: "Continue usando ideias avançadas, horários vencedores, benchmarks e convites de publicidade direto na plataforma.",
        stageLabel: "Plano Pro ativo",
        step: 4,
        totalSteps,
      };
    }
  }, [state, isLoading]);
}
