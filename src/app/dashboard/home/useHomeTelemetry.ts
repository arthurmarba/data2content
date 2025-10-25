// src/app/dashboard/home/useHomeTelemetry.ts
// Hook simples para centralizar telemetria dos cards da Home.

"use client";

import React from "react";
import { track } from "@/lib/track";

export type HomeCardId =
  | "next_post"
  | "consistency"
  | "mentorship"
  | "media_kit"
  | "community_metrics"
  | "micro_insight"
  | "connect_prompt";

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

  const trackHeroAction = React.useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      emit("home_hero_click", { action, ...extra });
    },
    [emit]
  );

  const trackSurfaceView = React.useCallback(
    (surface: string, extra?: Record<string, unknown>) => {
      emit("home_surface_view", { surface, ...extra });
    },
    [emit]
  );

  const trackWhatsappEvent = React.useCallback(
    (type: "start" | "success" | "fail", extra?: Record<string, unknown>) => {
      emit(`whatsapp_connect_${type}`, extra);
    },
    [emit]
  );

  return {
    trackCardAction,
    trackCardPeriodChange,
    trackHeroAction,
    trackSurfaceView,
    trackWhatsappEvent,
  };
}
