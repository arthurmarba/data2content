import fs from "fs";
import path from "path";
import { buildMobileStrategicProfile } from "./mobileStrategicProfileMapping";
import { buildMobileStrategicProfileNavigationStrategy } from "./mobileStrategicProfileNavigationStrategy";
import { resolveMobileStrategicProfileState } from "./mobileStrategicProfileStateContract";

const SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileNavigationStrategy.ts");

function makeProfile() {
  const state = resolveMobileStrategicProfileState({
    isAuthenticated: true,
    userName: "Ana Creator",
    userHandle: "@ana.creator",
    instagramConnected: false,
  });

  return buildMobileStrategicProfile({
    state,
    profileHref: "/mobile-profile",
    analyzeVideoHref: "/analyze-video",
    communityHref: "/community",
    loginHref: "/login",
  });
}

function build(params: Partial<Parameters<typeof buildMobileStrategicProfileNavigationStrategy>[0]> = {}) {
  return buildMobileStrategicProfileNavigationStrategy({
    profile: makeProfile(),
    isAuthenticated: true,
    profileHref: "/mobile-profile",
    analyzeVideoHref: "/analyze-video",
    communityHref: "/community",
    loginHref: "/login",
    currentSurface: "preview",
    createdAt: "2026-05-19T00:00:00.000Z",
    ...params,
  });
}

function textOf(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("mobileStrategicProfileNavigationStrategy", () => {
  it("creates Perfil as primary destination", () => {
    const result = build();

    expect(result.primaryDestinations).toEqual([
      expect.objectContaining({
        id: "profile",
        label: "Perfil",
        role: "destination",
        href: "/mobile-profile",
        active: true,
      }),
    ]);
  });

  it("creates Comunidade as existing destination", () => {
    const result = build();

    expect(result.secondaryDestinations).toEqual([
      expect.objectContaining({
        id: "community",
        label: "Comunidade",
        role: "destination",
        href: "/community",
        existingResource: true,
      }),
    ]);
    expect(textOf(result.secondaryDestinations)).toContain("destino existente");
    expect(textOf(result.secondaryDestinations)).not.toContain("feed");
    expect(textOf(result.secondaryDestinations)).not.toContain("chat");
    expect(textOf(result.secondaryDestinations)).not.toContain("comments");
  });

  it("creates plus as central_action and not a primary destination tab", () => {
    const result = build();

    expect(result.centralAction).toEqual(expect.objectContaining({
      id: "analyze_video",
      label: "+",
      helper: "Analisar vídeo",
      role: "central_action",
      destinationAfterCompletion: "profile",
      temporary: true,
    }));
    expect(result.primaryDestinations.map((item) => item.id)).not.toContain("analyze_video");
  });

  it("keeps forbidden destinations out of bottom nav", () => {
    const result = build();
    const forbiddenIds = result.forbiddenDestinations.map((item) => item.id);

    expect(forbiddenIds).toEqual(expect.arrayContaining([
      "media_kit",
      "diagnosis",
      "commercial",
      "videos",
      "uploads",
      "campaigns",
      "calculator",
      "crm",
      "collabs",
      "settings",
    ]));
  });

  it("describes Media Kit as bridge/modal without MediaKitView", () => {
    const result = build();
    const mediaKit = result.forbiddenDestinations.find((item) => item.id === "media_kit");

    expect(mediaKit?.reason).toContain("bridge/modal");
    expect(textOf(mediaKit)).not.toContain("mediakitview");
  });

  it("creates auth redirects for anonymous profile and plus intents", () => {
    const result = build({
      isAuthenticated: false,
      loginHref: "/login",
    });

    expect(result.authRedirects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "profile_auth",
        source: "profile",
        intent: "strategic_profile",
        href: "/login?intent=strategic_profile",
      }),
      expect.objectContaining({
        id: "analyze_video_auth",
        source: "analyze_video",
        intent: "analyze_video",
        href: "/login?intent=analyze_video",
      }),
    ]));
  });

  it("does not create profile auth redirect for authenticated users", () => {
    const result = build({ isAuthenticated: true });

    expect(result.authRedirects.find((item) => item.source === "profile")).toBeUndefined();
  });

  it("includes required risks and activation risk when widget is present", () => {
    const result = build({ activationWidgetPresent: true });
    const riskIds = result.risks.map((item) => item.id);

    expect(riskIds).toEqual(expect.arrayContaining([
      "activation_widget_overlap",
      "sidebar_mobile_conflict",
      "analyze_video_becoming_tab",
      "duplicated_media_kit_entry",
      "duplicated_community_entry",
      "profile_becoming_dashboard",
      "video_history_pressure",
    ]));
    expect(result.risks.find((item) => item.id === "activation_widget_overlap")?.severity).toBe("high");
  });

  it("includes required guardrails", () => {
    const result = build();
    const guardrailIds = result.guardrails.map((item) => item.id);

    expect(guardrailIds).toEqual(expect.arrayContaining([
      "do_not_recreate_media_kit",
      "do_not_recreate_community",
      "do_not_add_video_history",
      "do_not_make_analyze_video_a_tab",
      "do_not_change_real_navigation_yet",
      "keep_profile_as_mobile_home",
      "keep_diagnosis_inside_profile",
      "keep_commercial_inside_profile",
    ]));
  });

  it("does not use forbidden terms", () => {
    const text = textOf(build({ activationWidgetPresent: true, isAuthenticated: false }));

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
      "vídeos salvos",
      "histórico de vídeos",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import React components, real navigation or forbidden integrations", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "React",
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "sidebar/config",
      "ActivationPendingWidget",
      "fetch",
      "Prisma",
      "banco",
      "Gemini",
      "OpenAI",
      "Stripe",
      "SDK",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
