"use client";

import { useMemo } from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";

export type DiscoverCtaState =
  | "instagram_connect"
  | "instagram_reconnect"
  | "trial_activate"
  | "trial_active"
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
    window.dispatchEvent(new Event("open-subscribe-modal"));
  } catch {
    /* ignore SSR */
  }
}

function formatCountdown(trialRemainingMs?: number | null) {
  if (!trialRemainingMs || trialRemainingMs <= 0) return null;
  const totalMinutes = Math.floor(trialRemainingMs / 60000);
  if (totalMinutes <= 0) return null;
  if (totalMinutes < 60) return `${totalMinutes} min restantes`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 48) return `${totalHours} h restantes`;
  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays} d restantes`;
}

export function useDiscoverCtaConfig(allowedPersonalized?: boolean): DiscoverCtaConfig {
  const {
    hasPremiumAccess,
    instagram,
    isLoading,
    isTrialActive,
    needsCheckout,
    needsAbort,
    needsPaymentUpdate,
    nextAction,
    trial,
    trialRemainingMs,
  } = useBillingStatus();

  const instagramConnected = Boolean(allowedPersonalized || instagram?.connected);
  const needsReconnect = Boolean(instagram?.needsReconnect);
  const trialState = trial?.state;

  const state: DiscoverCtaState = useMemo(() => {
    if (!instagramConnected) return needsReconnect ? "instagram_reconnect" : "instagram_connect";
    if (needsReconnect) return "instagram_reconnect";
    if (isTrialActive) return "trial_active";
    if (hasPremiumAccess) return "plan_active";
    if (nextAction === "reactivate") return "reactivate_plan";
    if (nextAction === "resubscribe") return "subscribe";
    if (needsPaymentUpdate) return "payment_issue";
    if (needsCheckout) return "checkout_pending";
    if (needsAbort) return "checkout_expired";
    if (trialState === "eligible") return "subscribe";
    if (trialState === "expired" || trialState === "converted" || trialState === "unavailable") {
      return "subscribe";
    }
    return "subscribe";
  }, [
    hasPremiumAccess,
    instagramConnected,
    isTrialActive,
    needsReconnect,
    needsCheckout,
    needsAbort,
    needsPaymentUpdate,
    nextAction,
    trialState,
  ]);

  const countdownLabel = useMemo(() => formatCountdown(trialRemainingMs), [trialRemainingMs]);

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
          href: "/dashboard/instagram/connect",
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
          href: "/dashboard/instagram/connect",
          disabled: isLoading,
        };
      case "reactivate_plan":
        return {
          state,
          kind: "action",
          label: "Reativar Plano Agência",
          description: "Volte a receber análises automáticas, alertas no WhatsApp e oportunidades de publicidade sem exclusividade.",
          stageLabel: "Recupere o acesso ao Plano Agência",
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
          description: "Existe um checkout pendente. Retome ou aborte a tentativa para voltar ao Plano Agência.",
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
          label: "Assinar Plano Agência",
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
          label: "Assinar Plano Agência",
          description: "Ative a IA ilimitada, análises comparativas e receba oportunidades de publicidade sem comissão.",
          stageLabel: "Completar acesso ao Plano Agência",
          step: 4,
          totalSteps,
          onPress: openSubscribeModal,
          disabled: isLoading,
        };
      case "trial_active":
        return {
          state,
          kind: "status",
          label: "Trial ativo",
          statusLabel: countdownLabel || "Trial ativo",
          description: "Aproveite as recomendações enquanto o período grátis está disponível.",
          stageLabel: "IA liberada — explore ideias avançadas",
          step: 3,
          totalSteps,
        };
      case "plan_active":
      default:
      return {
        state,
        kind: "status",
        label: "Plano Agência ativo",
        statusLabel: "Plano Agência ativo",
        description: "Continue usando ideias avançadas, horários vencedores, benchmarks e convites de publicidade direto na plataforma.",
        stageLabel: "Plano Agência ativo",
        step: 4,
        totalSteps,
      };
    }
  }, [state, countdownLabel, isLoading]);
}
