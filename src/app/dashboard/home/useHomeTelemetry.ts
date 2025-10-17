// src/app/dashboard/home/useHomeTelemetry.ts
// Hook simples para centralizar telemetria dos cards da Home.

"use client";

import React from "react";
import { track } from "@/lib/track";

export type HomeCardId = "next_post" | "consistency" | "mentorship" | "media_kit" | "community_metrics";

export function useHomeTelemetry() {
  const emit = React.useCallback((event: string, payload?: Record<string, unknown>) => {
    try {
      track(event, payload);
    } catch {
      // noop – track já trata erros silenciosamente
    }
  }, []);

  const trackCardAction = React.useCallback(
    (cardId: HomeCardId, action: string, extra?: Record<string, unknown>) => {
      emit("home_card_click", { card_id: cardId, action, ...extra });
    },
    [emit]
  );

  const trackCardPeriodChange = React.useCallback(
    (cardId: HomeCardId, period: string) => {
      emit("home_card_period_change", { card_id: cardId, period });
    },
    [emit]
  );

  return {
    trackCardAction,
    trackCardPeriodChange,
  };
}

