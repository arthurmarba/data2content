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
    if (trialState === "eligible") return "trial_activate";
    if (nextAction === "resubscribe") return "subscribe";
    if (trialState === "expired" || trialState === "converted" || trialState === "unavailable") {
      return "subscribe";
    }
    return "subscribe";
  }, [hasPremiumAccess, instagramConnected, isTrialActive, needsReconnect, nextAction, trialState]);

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
      case "trial_activate":
        return {
          state,
          kind: "action",
          label: "⚡ Ativar IA 48h grátis",
          description: "Desbloqueie ideias adaptadas ao seu perfil + horários vencedores do seu nicho.",
          stageLabel: "Etapa 3/4 — Curadoria avançada com IA",
          step: 3,
          totalSteps,
          onPress: openSubscribeModal,
          disabled: isLoading,
        };
      case "reactivate_plan":
        return {
          state,
          kind: "action",
          label: "Reativar plano PRO",
          description: "Volte a receber análises automáticas e recomendações em tempo real.",
          stageLabel: "Recupere o acesso PRO",
          step: 4,
          totalSteps,
          onPress: openSubscribeModal,
          disabled: isLoading,
        };
      case "subscribe":
        return {
          state,
          kind: "action",
          label: "Assinar PRO",
          description: "Ative a IA ilimitada, análises comparativas e benchmarks do seu segmento.",
          stageLabel: "Completar acesso PRO",
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
          label: "Plano PRO ativo",
          statusLabel: "Plano PRO ativo",
          description: "Continue usando ideias avançadas, horários vencedores e benchmarks do seu nicho.",
          stageLabel: "Plano PRO ativo",
          step: 4,
          totalSteps,
        };
    }
  }, [state, countdownLabel, isLoading]);
}
