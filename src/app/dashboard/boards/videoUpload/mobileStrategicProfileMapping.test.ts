import fs from "fs";
import path from "path";
import {
  buildMobileStrategicProfile,
  type MobileStrategicProfile,
} from "./mobileStrategicProfileMapping";
import {
  resolveMobileStrategicProfileState,
  type MobileStrategicProfileState,
} from "./mobileStrategicProfileStateContract";
import type { VideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";

const MAPPING_SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileMapping.ts");

function makePresentation(
  accessLevel: VideoNarrativeDiagnosisPresentation["accessLevel"] = "free",
): VideoNarrativeDiagnosisPresentation {
  return {
    id: `presentation-${accessLevel}`,
    accessLevel,
    hero: {
      title: accessLevel === "instagram_optimized"
        ? "Diagnóstico otimizado com contexto de Instagram"
        : accessLevel === "premium"
          ? "Seu mapa estratégico foi atualizado"
          : "Primeira leitura do seu vídeo",
      subtitle: "O Perfil da D2C é o diagnóstico vivo do creator.",
      badge: {
        id: "hero-badge",
        label: accessLevel === "instagram_optimized" ? "Leitura mais precisa" : "Diagnóstico atualizado",
        tone: accessLevel === "instagram_optimized" ? "instagram" : "neutral",
      },
      levelLabel: "Perfil em evolução",
      nextLevelLabel: "Perfil estratégico",
      precisionLabel: "Leitura de estado",
    },
    priorityCards: [
      {
        id: "main-reading",
        title: "O que este vídeo comunica",
        body: "Este vídeo comunica rotina, contexto e próximo passo.",
        tone: "insight",
        priority: "high",
        locked: false,
      },
      {
        id: "primary-adjustment",
        title: "Ajuste mais importante",
        body: "Abrir com a direção antes do contexto.",
        tone: "action",
        priority: "high",
        locked: false,
      },
    ],
    sections: [
      {
        id: "video_diagnosis",
        title: "Diagnóstico do vídeo",
        description: "Leitura prática do vídeo.",
        visible: true,
        collapsedByDefault: false,
        cards: [
          {
            id: "video-main",
            title: "Narrativa",
            body: "Rotina com direção estratégica.",
            tone: "insight",
            priority: "high",
            locked: false,
          },
        ],
      },
      {
        id: "brand_opportunities",
        title: "Oportunidades futuras de marca",
        description: "Territórios possíveis e fit narrativo.",
        visible: accessLevel !== "free",
        collapsedByDefault: true,
        cards: [
          {
            id: "brand-availability",
            title: "Território possível",
            body: "Oportunidade futura de marca por território e fit narrativo.",
            tone: "opportunity",
            priority: "medium",
            locked: false,
          },
        ],
      },
      {
        id: "collab_opportunities",
        title: "Tipos de collab futuros",
        description: "Caminhos possíveis por tipo de oportunidade futura.",
        visible: accessLevel !== "free",
        collapsedByDefault: true,
        cards: [
          {
            id: "collab-availability",
            title: "Tipo de collab futuro",
            body: "Tipos de collab possíveis por formato, autoridade e ponte de audiência.",
            tone: "opportunity",
            priority: "medium",
            locked: false,
          },
        ],
      },
      {
        id: "instagram_precision",
        title: "Precisão com Instagram",
        description: "Contexto de Instagram para leitura mais precisa.",
        visible: accessLevel === "instagram_optimized",
        collapsedByDefault: true,
        cards: [
          {
            id: "instagram-context",
            title: "Leitura mais precisa",
            body: "Leitura mais precisa por estado de Instagram conectado.",
            tone: "insight",
            priority: "high",
            locked: false,
          },
        ],
      },
    ],
    lockedPreviews: [],
    primaryCTA: {
      label: accessLevel === "free" ? "Desbloquear diagnóstico completo" : "Gerar próximo movimento estratégico",
      action: accessLevel === "free" ? "upgrade" : "generate_next_strategic_move",
      helper: "Próximo passo",
    },
    secondaryCTA: null,
    badges: [],
    readingTimeHint: "Leitura rápida",
    createdAt: "2026-05-19T00:00:00.000Z",
  };
}

function makeState(params: {
  isAuthenticated?: boolean;
  accessLevel?: VideoNarrativeDiagnosisPresentation["accessLevel"] | null;
  diagnosisPresentation?: VideoNarrativeDiagnosisPresentation | null;
  instagramConnected?: boolean;
  hasPremiumAccess?: boolean;
  hasMediaKit?: boolean;
  mediaKitShareUrl?: string | null;
  primaryIntent?: "view_profile" | "analyze_video";
} = {}): MobileStrategicProfileState {
  return resolveMobileStrategicProfileState({
    isAuthenticated: params.isAuthenticated ?? true,
    accessLevel: params.accessLevel,
    diagnosisPresentation: params.diagnosisPresentation,
    instagramConnected: params.instagramConnected,
    hasPremiumAccess: params.hasPremiumAccess,
    hasMediaKit: params.hasMediaKit,
    mediaKitShareUrl: params.mediaKitShareUrl,
    primaryIntent: params.primaryIntent,
    userName: "Ana Creator",
    userHandle: "@ana",
  });
}

function build(params: {
  state?: MobileStrategicProfileState;
  presentation?: VideoNarrativeDiagnosisPresentation | null;
  creatorBio?: string | null;
  mediaKitShareUrl?: string | null;
  mediaKitEditUrl?: string | null;
  mediaKitPublicUrl?: string | null;
  communityHref?: string | null;
  loginHref?: string | null;
}): MobileStrategicProfile {
  return buildMobileStrategicProfile({
    state: params.state ?? makeState(),
    diagnosisPresentation: params.presentation,
    creatorBio: params.creatorBio,
    mediaKitShareUrl: params.mediaKitShareUrl,
    mediaKitEditUrl: params.mediaKitEditUrl,
    mediaKitPublicUrl: params.mediaKitPublicUrl,
    communityHref: params.communityHref,
    loginHref: params.loginHref,
    profileHref: "/dashboard/profile",
    analyzeVideoHref: "/dashboard/analyze",
  });
}

function textOf(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("mobileStrategicProfileMapping", () => {
  it("anonymous user builds authGate and does not build real diagnosis", () => {
    const state = makeState({ isAuthenticated: false, primaryIntent: "view_profile" });
    const result = build({ state, loginHref: "/login" });

    expect(result.authGate.visible).toBe(true);
    expect(result.authGate.description).toBe("Entre com Google para começar seu diagnóstico como creator.");
    expect(result.authGate.action).toMatchObject({ href: "/login", intent: "view_profile" });
    expect(result.sections).toEqual([]);
    expect(result.tabs).toEqual([]);
  });

  it("anonymous with analyze_video intent builds login copy to analyze first video", () => {
    const state = makeState({ isAuthenticated: false, primaryIntent: "analyze_video" });
    const result = build({ state, loginHref: "/login?callbackUrl=/dashboard/analyze" });

    expect(result.authGate.description).toBe("Use sua conta Google para salvar essa primeira leitura no seu Perfil Estratégico.");
    expect(result.authGate.action).toMatchObject({ label: "Entrar e analisar vídeo" });
  });

  it("construction profile builds header, empty diagnosis section and Analisar meu primeiro vídeo action", () => {
    const result = build({ state: makeState({ diagnosisPresentation: null, instagramConnected: false }) });

    expect(result.constructionState.visible).toBe(true);
    expect(result.header.identity.displayName).toBe("Ana Creator");
    expect(result.header.statusPills.map((pill) => pill.label)).toContain("Perfil em construção");
    expect(result.sections.find((section) => section.id === "diagnosis")).toMatchObject({
      state: "construction",
      title: "Diagnóstico",
    });
    expect(result.primaryActions[0]).toMatchObject({ label: "Analisar meu primeiro vídeo", intent: "analyze_video" });
  });

  it("construction profile does not show Media Kit Bridge as available", () => {
    const result = build({ state: makeState({ diagnosisPresentation: null, instagramConnected: false }) });

    expect(result.mediaKitBridge.state).not.toBe("available");
    expect(result.mediaKitBridge.actions).toEqual([]);
  });

  it("first reading builds diagnosis and commercial tabs", () => {
    const presentation = makePresentation("free");
    const state = makeState({ accessLevel: "free", diagnosisPresentation: presentation, instagramConnected: false });
    const result = build({ state, presentation });

    expect(result.tabs.map((tab) => tab.id)).toEqual(["diagnosis", "commercial"]);
    expect(result.activeTab).toBe("diagnosis");
  });

  it("first reading uses diagnosisPresentation for Diagnosis section", () => {
    const presentation = makePresentation("free");
    const state = makeState({ accessLevel: "free", diagnosisPresentation: presentation, instagramConnected: false });
    const result = build({ state, presentation });
    const diagnosis = result.sections.find((section) => section.id === "diagnosis");

    expect(diagnosis?.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "diagnosis-hero", title: "Primeira leitura do seu vídeo", source: "diagnosisPresentation" }),
        expect.objectContaining({ id: "main-reading", source: "diagnosisPresentation" }),
      ]),
    );
  });

  it("free without Instagram creates secondary connect Instagram action", () => {
    const presentation = makePresentation("free");
    const state = makeState({ accessLevel: "free", diagnosisPresentation: presentation, instagramConnected: false });
    const result = build({ state, presentation });

    expect(result.primaryActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "connect-instagram", intent: "connect_instagram", priority: "secondary" }),
      ]),
    );
  });

  it("premium builds fuller Commercial section without brand promise", () => {
    const presentation = makePresentation("premium");
    const state = makeState({
      accessLevel: "premium",
      diagnosisPresentation: presentation,
      hasPremiumAccess: true,
      instagramConnected: false,
    });
    const result = build({ state, presentation });
    const commercial = result.sections.find((section) => section.id === "commercial");
    const text = textOf(commercial);

    expect(commercial?.state).toBe("ready");
    expect(text).toContain("oportunidade futura");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("marca garantida");
    expect(text).not.toContain("patrocínio garantido");
  });

  it("instagram optimized builds more precise reading without promising performance", () => {
    const presentation = makePresentation("instagram_optimized");
    const state = makeState({
      accessLevel: "instagram_optimized",
      diagnosisPresentation: presentation,
      instagramConnected: true,
    });
    const result = build({ state, presentation });
    const text = textOf(result.sections.find((section) => section.id === "diagnosis"));

    expect(result.sections.find((section) => section.id === "diagnosis")?.title).toContain("leitura mais precisa");
    expect(text).toContain("leitura mais precisa");
    expect(text).not.toContain("performance garantida");
    expect(text).not.toContain("resultado garantido");
  });

  it("Media Kit Bridge is available only when state.mediaKitState is available", () => {
    const presentation = makePresentation("instagram_optimized");
    const availableState = makeState({
      accessLevel: "instagram_optimized",
      diagnosisPresentation: presentation,
      instagramConnected: true,
      hasMediaKit: true,
    });
    const unavailableState = makeState({
      accessLevel: "free",
      diagnosisPresentation: makePresentation("free"),
      instagramConnected: false,
      hasMediaKit: false,
    });

    expect(build({ state: availableState, presentation, mediaKitShareUrl: "/media-kit/me" }).mediaKitBridge.state).toBe("available");
    expect(build({ state: unavailableState, presentation: makePresentation("free") }).mediaKitBridge.state).not.toBe("available");
  });

  it("Media Kit Bridge does not include internal diagnosis, QR Code or new MediaKitView", () => {
    const presentation = makePresentation("instagram_optimized");
    const state = makeState({
      accessLevel: "instagram_optimized",
      diagnosisPresentation: presentation,
      instagramConnected: true,
      hasMediaKit: true,
    });
    const result = build({
      state,
      presentation,
      mediaKitShareUrl: "/media-kit/me",
      mediaKitEditUrl: "/dashboard/media-kit",
      mediaKitPublicUrl: "/mediakit/ana",
    });
    const text = textOf(result.mediaKitBridge);

    expect(text).toContain("mídia kit existente");
    expect(text).not.toContain("diagnóstico interno");
    expect(text).not.toContain("qr code");
    expect(text).not.toContain("mediakitview");
  });

  it("Community bridge is not duplicated inside Perfil when Community is a fixed destination", () => {
    const presentation = makePresentation("free");
    const state = makeState({ accessLevel: "free", diagnosisPresentation: presentation });
    const result = build({ state, presentation, communityHref: "/community" });
    const text = textOf(result.communityBridge);

    expect(result.communityBridge).toMatchObject({
      visible: false,
      label: "Comunidade",
      href: "/community",
      description: "Acesse a Comunidade Data2Content, destino existente para continuar aprendendo com outros membros.",
    });
    expect(text).not.toContain("comments");
    expect(text).not.toContain("posts");
    expect(text).not.toContain("creators");
  });

  it("navigation contains only profile and community destinations", () => {
    const result = build({ state: makeState({ diagnosisPresentation: null }) });

    expect(result.navigation.items).toEqual([
      expect.objectContaining({ id: "profile", role: "destination", active: true }),
      expect.objectContaining({ id: "community", role: "destination" }),
    ]);
  });

  it("navigation does not contain media_kit, diagnosis or commercial as global tabs", () => {
    const result = build({ state: makeState({ diagnosisPresentation: null }) });
    const ids = result.navigation.items.map((item) => item.id);

    expect(ids).not.toContain("media_kit");
    expect(ids).not.toContain("diagnosis");
    expect(ids).not.toContain("commercial");
  });

  it("does not create analyzed videos section", () => {
    const presentation = makePresentation("premium");
    const state = makeState({ accessLevel: "premium", diagnosisPresentation: presentation, hasPremiumAccess: true });
    const result = build({ state, presentation });

    expect(result.sections.map((section) => section.id)).not.toContain("videos");
    expect(textOf(result)).not.toContain("vídeos analisados");
  });

  it("does not use signal or narrative counts as primary highlight", () => {
    const presentation = makePresentation("premium");
    const state = makeState({ accessLevel: "premium", diagnosisPresentation: presentation, hasPremiumAccess: true });
    const result = build({ state, presentation, creatorBio: "18 sinais e 3 narrativas com percentual de perfil" });

    const headerText = textOf(result.header);
    expect(headerText).not.toContain("18 sinais");
    expect(headerText).not.toContain("3 narrativas");
    expect(headerText).not.toContain("percentual de perfil");
  });

  it("copies do not use forbidden terms", () => {
    const presentation = makePresentation("premium");
    const state = makeState({ accessLevel: "premium", diagnosisPresentation: presentation, hasPremiumAccess: true });
    const result = build({ state, presentation });
    const text = textOf(result);

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
    const result = build({
      state: makeState({ diagnosisPresentation: null }),
      creatorBio: "score, ranking, match real, marca garantida e patrocínio garantido",
    });

    expect(result.header.identity.bio).toContain("leitura");
    expect(result.header.identity.bio).toContain("mapa");
    expect(result.header.identity.bio).toContain("indicação futura");
    expect(result.header.identity.bio).not.toContain("score");
    expect(result.header.identity.bio).not.toContain("match real");
  });

  it("does not import React components", () => {
    const importLines = fs.readFileSync(MAPPING_SOURCE_PATH, "utf8")
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).not.toContain("React");
    expect(importLines).not.toContain(".tsx");
    expect(importLines).not.toContain("LoginClient");
    expect(importLines).not.toContain("MediaKitView");
  });

  it("does not import forbidden integrations", () => {
    const importLines = fs.readFileSync(MAPPING_SOURCE_PATH, "utf8")
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of ["fetch", "Prisma", "banco", "Gemini", "OpenAI", "Stripe", "SDK", "app/api", "storage"]) {
      expect(importLines).not.toContain(forbidden);
    }
  });

  it("does not alter endpoint, LoginClient, NextAuth, MediaKitView, Community, real navigation or ActivationPendingWidget", () => {
    const source = fs.readFileSync(MAPPING_SOURCE_PATH, "utf8");

    for (const forbidden of [
      "src/app/api/auth/[...nextauth]/route",
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "ActivationPendingWidget",
      "Sidebar",
      "route.ts",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
