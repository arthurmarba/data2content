// src/app/dashboard/home/useHomeTelemetry.ts
// Hook simples para centralizar telemetria dos cards da Home.

"use client";

import React from "react";
import { track } from "@/lib/track";
import type { JourneyStepId } from "./types";

export type HomeCardId =
  | "next_post"
  | "consistency"
  | "mentorship"
  | "media_kit"
  | "community_metrics"
  | "micro_insight"
  | "connect_prompt";

export type DashboardCtaTarget =
  | "connect_ig"
  | "create_media_kit"
  | "open_proposals"
  | "analyze_with_ai"
  | "copy_kit_link"
  | "view_as_brand"
  | "edit_kit"
  | "activate_pro"
  | "open_creator_survey";

export type DashboardCtaSurface =
  | "flow_checklist"
  | "proposals_block"
  | "media_kit_block"
  | "upsell_block"
  | "other";

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

  const trackDashboardCta = React.useCallback(
    (target: DashboardCtaTarget, extra?: Record<string, unknown>) => {
      emit("dashboard_cta_clicked", { target, ...extra });
    },
    [emit]
  );

  const trackTutorialStep = React.useCallback(
    (stepId: JourneyStepId, action: string, extra?: Record<string, unknown>) => {
      emit("tutorial_step_clicked", { step_id: stepId, action, ...extra });
    },
    [emit]
  );

  const trackHomeCard = React.useCallback(
    (cardId: string, action: string, extra?: Record<string, unknown>) => {
      emit("home_card_clicked", { card_id: cardId, action, ...extra });
    },
    [emit]
  );

  return {
    trackCardAction,
    trackCardPeriodChange,
    trackHeroAction,
    trackSurfaceView,
    trackWhatsappEvent,
    trackDashboardCta,
    trackTutorialStep,
    trackHomeCard,
  };
}
