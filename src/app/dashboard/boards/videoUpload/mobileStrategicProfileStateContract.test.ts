import fs from "fs";
import path from "path";
import {
  resolveMobileStrategicProfileState,
  sanitizeMobileStrategicProfileText,
  type MobileStrategicProfileState,
} from "./mobileStrategicProfileStateContract";
import type { VideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";

const CONTRACT_SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileStateContract.ts");

function makePresentation(
  accessLevel: VideoNarrativeDiagnosisPresentation["accessLevel"] = "free",
): VideoNarrativeDiagnosisPresentation {
  return {
    id: `presentation-${accessLevel}`,
    accessLevel,
    hero: {
      title: accessLevel === "free" ? "Primeira leitura do seu vídeo" : "Seu mapa estratégico foi atualizado",
      subtitle: "Leitura estratégica para o Perfil.",
      badge: {
        id: "badge",
        label: accessLevel === "instagram_optimized" ? "Leitura mais precisa" : "Diagnóstico atualizado",
        tone: accessLevel === "instagram_optimized" ? "instagram" : "neutral",
      },
      levelLabel: "Perfil em evolução",
      nextLevelLabel: "Perfil estratégico",
      precisionLabel: "Leitura de estado",
    },
    priorityCards: [],
    sections: [],
    lockedPreviews: [],
    primaryCTA: {
      label: "Analisar vídeo",
      action: accessLevel === "free" ? "upgrade" : "generate_next_strategic_move",
      helper: "Próximo passo",
    },
    secondaryCTA: null,
    badges: [],
    readingTimeHint: "Leitura rápida",
    createdAt: "2026-05-19T00:00:00.000Z",
  };
}

function allText(state: MobileStrategicProfileState): string {
  return JSON.stringify(state).toLowerCase();
}

describe("mobileStrategicProfileStateContract", () => {
  it("anonymous with view_profile intent generates auth_gate and login action to create Perfil Estratégico", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: false,
      primaryIntent: "view_profile",
    });

    expect(result.authState).toBe("anonymous");
    expect(result.profileAvailability).toBe("auth_gate");
    expect(result.diagnosisState).toBe("empty");
    expect(result.mediaKitState).toBe("unavailable");
    expect(result.summary.description).toBe("Entre com Google para começar seu diagnóstico como creator.");
    expect(result.recommendedActions[0]).toMatchObject({
      id: "login",
      intent: "view_profile",
      label: "Entrar com Google",
    });
  });

  it("anonymous with analyze_video intent generates auth_gate and login action to analyze first video", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: false,
      primaryIntent: "analyze_video",
    });

    expect(result.profileAvailability).toBe("auth_gate");
    expect(result.summary.description).toBe("Use sua conta Google para salvar essa primeira leitura no seu Perfil Estratégico.");
    expect(result.recommendedActions[0]).toMatchObject({
      id: "login",
      intent: "analyze_video",
      label: "Entrar e analisar vídeo",
    });
  });

  it("authenticated Gmail-only user generates Perfil em construção", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      userName: "Ana Creator",
      instagramConnected: false,
    });

    expect(result.authState).toBe("authenticated");
    expect(result.profileAvailability).toBe("construction");
    expect(result.readinessState).toBe("first_diagnosis_pending");
    expect(result.diagnosisState).toBe("empty");
    expect(result.statusPills.map((pill) => pill.label)).toContain("Perfil em construção");
    expect(result.summary.title).toBe("Seu Perfil Estratégico começa aqui");
  });

  it("authenticated user without diagnosis prioritizes Analisar primeiro vídeo", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
    });

    expect(result.recommendedActions[0]).toMatchObject({
      id: "analyze-first-video",
      intent: "analyze_video",
      label: "Analisar primeiro vídeo",
      priority: "primary",
    });
  });

  it("free user with first reading generates first_reading_ready", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "free",
      diagnosisPresentation: makePresentation("free"),
      instagramConnected: false,
    });

    expect(result.profileAvailability).toBe("active");
    expect(result.readinessState).toBe("first_reading_ready");
    expect(result.diagnosisState).toBe("first_reading");
    expect(result.summary.title).toBe("Primeira leitura criada");
  });

  it("free user without Instagram suggests connecting Instagram as secondary next step", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "free",
      diagnosisPresentation: makePresentation("free"),
      instagramConnected: false,
    });

    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "connect-instagram",
          intent: "connect_instagram",
          priority: "secondary",
        }),
      ]),
    );
  });

  it("premium user with diagnosis generates strategic_profile_active", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "premium",
      hasPremiumAccess: true,
      diagnosisPresentation: makePresentation("premium"),
    });

    expect(result.subscriptionState).toBe("premium");
    expect(result.diagnosisState).toBe("complete");
    expect(result.readinessState).toBe("strategic_profile_active");
    expect(result.statusPills.map((pill) => pill.label)).toContain("Premium");
  });

  it("premium user without Instagram suggests connecting for precision", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "premium",
      hasPremiumAccess: true,
      diagnosisPresentation: makePresentation("premium"),
      instagramConnected: false,
    });

    expect(allText(result)).toContain("comparar sua narrativa com mais contexto");
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "connect-instagram", intent: "connect_instagram" }),
      ]),
    );
  });

  it("instagram_optimized connected user generates instagram_optimized diagnosis state", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "instagram_optimized",
      diagnosisPresentation: makePresentation("instagram_optimized"),
      instagramConnected: true,
    });

    expect(result.diagnosisState).toBe("instagram_optimized");
    expect(result.instagramState).toBe("connected");
    expect(result.readinessState).toBe("strategic_profile_active");
    expect(result.statusPills.map((pill) => pill.label)).toContain("Leitura mais precisa");
  });

  it("mediaKitState is available when hasMediaKit or mediaKitShareUrl exists", () => {
    expect(resolveMobileStrategicProfileState({
      isAuthenticated: true,
      hasMediaKit: true,
    }).mediaKitState).toBe("available");

    expect(resolveMobileStrategicProfileState({
      isAuthenticated: true,
      mediaKitShareUrl: "https://data2content.test/media-kit/demo",
    }).mediaKitState).toBe("available");
  });

  it("mediaKitState does not create a new Media Kit experience", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "instagram_optimized",
      diagnosisPresentation: makePresentation("instagram_optimized"),
      instagramConnected: true,
      hasMediaKit: true,
    });

    expect(result.mediaKitState).toBe("available");
    expect(allText(result)).toContain("mídia kit existente");
    expect(allText(result)).not.toContain("novo card");
    expect(allText(result)).not.toContain("mediakitview");
  });

  it("Comunidade is only modeled as a future existing destination without feed or chat", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      diagnosisPresentation: makePresentation("free"),
      accessLevel: "free",
    });
    const communityAction = result.recommendedActions.find((item) => item.id === "community-future");

    expect(communityAction).toMatchObject({
      label: "Comunidade",
      disabled: true,
    });
    expect(communityAction?.description).toContain("Destino existente de navegação futura");
    expect(allText(result)).not.toContain("feed");
    expect(allText(result)).not.toContain("comentários");
  });

  it("does not use signal or narrative counts as primary status", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "premium",
      diagnosisPresentation: makePresentation("premium"),
      hasPremiumAccess: true,
    });
    const statusText = result.statusPills.map((pill) => pill.label).join(" ").toLowerCase();

    expect(statusText).not.toContain("18 sinais");
    expect(statusText).not.toContain("3 narrativas");
    expect(statusText).not.toContain("percentual");
  });

  it("copies do not use forbidden product terms", () => {
    const result = resolveMobileStrategicProfileState({
      isAuthenticated: true,
      accessLevel: "free",
      diagnosisPresentation: makePresentation("free"),
      instagramConnected: false,
      hasMediaKit: false,
    });
    const text = allText(result);

    for (const forbidden of [
      "score",
      "nota",
      "ranking",
      "gabarito",
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "match real",
      "marca garantida",
      "patrocínio garantido",
      "18 sinais",
      "3 narrativas",
      "percentual de perfil",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("sanitizes dangerous text", () => {
    expect(sanitizeMobileStrategicProfileText(
      "score, ranking, match real, marca garantida e patrocínio garantido",
    )).toBe("leitura, mapa, indicação futura, território possível e oportunidade futura");
  });

  it("does not import React components", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).not.toContain("React");
    expect(importLines).not.toContain(".tsx");
    expect(importLines).not.toContain("LoginClient");
    expect(importLines).not.toContain("MediaKitView");
    expect(importLines).not.toContain("MediaKitSnapshot");
  });

  it("does not import forbidden integrations", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "fetch",
      "Prisma",
      "banco",
      "Gemini",
      "OpenAI",
      "Stripe",
      "SDK",
      "app/api",
      "storage",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }
  });

  it("does not alter endpoint, LoginClient, NextAuth, MediaKitView, Community, navigation or ActivationPendingWidget", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");

    for (const forbidden of [
      "src/app/api/auth/[...nextauth]/route",
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "ActivationPendingWidget",
      "Sidebar",
      "navigation",
      "route.ts",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
