import fs from "fs";
import path from "path";
import { buildMobileStrategicProfileActivationWidgetStrategy } from "./mobileStrategicProfileActivationWidgetStrategy";

const SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileActivationWidgetStrategy.ts");

function build(
  params: Partial<Parameters<typeof buildMobileStrategicProfileActivationWidgetStrategy>[0]> = {},
) {
  return buildMobileStrategicProfileActivationWidgetStrategy({
    currentSurface: "production_dashboard",
    viewport: "mobile",
    createdAt: "2026-05-19T00:00:00.000Z",
    ...params,
  });
}

function textOf(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("mobileStrategicProfileActivationWidgetStrategy", () => {
  it("current production does not recommend immediate change", () => {
    const result = build({ currentSurface: "production_dashboard", viewport: "mobile" });

    expect(["keep_current_for_production", "defer_until_navigation_integration"]).toContain(result.recommendedPolicy);
    expect(result.shouldChangeProductionNow).toBe(false);
  });

  it("strategic profile preview does not recommend rendering the widget inside preview", () => {
    const result = build({
      currentSurface: "strategic_profile_preview",
      viewport: "mobile",
      hasBottomNav: true,
      hasCentralAnalyzeAction: true,
    });

    expect(result.recommendedPolicy).toBe("defer_until_navigation_integration");
    expect(result.shouldChangeProductionNow).toBe(false);
    expect(result.guardrails.map((item) => item.id)).toContain("do_not_change_activation_widget_now");
  });

  it("future mobile app with bottom nav recommends hiding or converting to profile card", () => {
    const result = build({
      currentSurface: "future_mobile_app",
      viewport: "mobile",
      hasBottomNav: true,
    });

    expect(["hide_on_future_mobile_app", "convert_to_profile_card"]).toContain(result.recommendedPolicy);
    expect(result.shouldHideInFutureMobileApp).toBe(true);
  });

  it("future mobile app with central analyze action registers central action competition", () => {
    const result = build({
      currentSurface: "future_mobile_app",
      viewport: "mobile",
      hasCentralAnalyzeAction: true,
    });

    expect(result.conflicts.map((item) => item.id)).toContain("central_action_competition");
    expect(result.risks.find((item) => item.id === "central_action_competition")?.severity).toBe("high");
  });

  it("bottom nav, Media Kit modal and analyze flow register specific conflicts", () => {
    const result = build({
      currentSurface: "future_mobile_app",
      viewport: "mobile",
      hasBottomNav: true,
      hasMediaKitModal: true,
      hasAnalyzeFlow: true,
    });

    expect(result.conflicts.map((item) => item.id)).toEqual(expect.arrayContaining([
      "bottom_nav_overlap",
      "media_kit_modal_overlap",
      "analyze_flow_distraction",
    ]));
    expect(result.risks.find((item) => item.id === "bottom_nav_overlap")?.severity).toBe("high");
    expect(result.risks.find((item) => item.id === "media_kit_modal_overlap")?.severity).toBe("medium");
    expect(result.risks.find((item) => item.id === "analyze_flow_distraction")?.severity).toBe("medium");
  });

  it("desktop can keep desktop-only behavior", () => {
    const result = build({
      currentSurface: "future_mobile_app",
      viewport: "desktop",
    });

    expect(result.recommendedPolicy).toBe("desktop_only");
    expect(result.shouldKeepDesktopOnly).toBe(true);
  });

  it("construction profile recommends profile card as future option", () => {
    const result = build({
      currentSurface: "future_mobile_app",
      viewport: "mobile",
      profileAvailability: "construction",
    });

    expect(result.recommendedPolicy).toBe("convert_to_profile_card");
    expect(result.shouldConvertToProfileCard).toBe(true);
    expect(result.futureDecisions.map((item) => item.id)).toContain("convert_to_profile_card");
  });

  it("includes required guardrails", () => {
    const result = build();
    const guardrailIds = result.guardrails.map((item) => item.id);

    expect(guardrailIds).toEqual(expect.arrayContaining([
      "do_not_change_activation_widget_now",
      "do_not_overlap_bottom_nav",
      "do_not_compete_with_central_plus",
      "do_not_block_media_kit_modal",
      "do_not_interrupt_analyze_flow",
      "prefer_profile_card_for_mobile_onboarding",
      "keep_desktop_behavior_until_integration",
      "require_feature_flag_before_real_change",
    ]));
  });

  it("reserves safe area when mobile widget or bottom nav are present", () => {
    expect(build({ viewport: "mobile", activationWidgetVisible: true }).shouldReserveSafeArea).toBe(true);
    expect(build({ viewport: "mobile", hasBottomNav: true }).shouldReserveSafeArea).toBe(true);
  });

  it("does not use forbidden terms", () => {
    const text = textOf(build({
      currentSurface: "future_mobile_app",
      viewport: "mobile",
      hasBottomNav: true,
      hasCentralAnalyzeAction: true,
      hasMediaKitModal: true,
      hasAnalyzeFlow: true,
      activationWidgetVisible: true,
      profileAvailability: "construction",
    }));

    for (const forbidden of [
      "score",
      "nota",
      "pontos",
      "ranking",
      "gabarito",
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "match real",
      "marca garantida",
      "patrocínio garantido",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import React components or forbidden integrations", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "React",
      "ActivationPendingWidget",
      "useActivationChecklist",
      "sidebar/config",
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "fetch",
      "Prisma",
      "Gemini",
      "OpenAI",
      "Stripe",
      "SDK",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
