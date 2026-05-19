import fs from "fs";
import path from "path";
import {
  buildVideoNarrativeEvolvingDiagnosis,
  sanitizeVideoNarrativeEvolvingDiagnosisText,
  type VideoNarrativeEvolvingDiagnosis,
} from "./videoNarrativeEvolvingDiagnosisContract";
import {
  buildVideoNarrativeCreatorProfile,
  createEmptyVideoNarrativeCreatorProfile,
  type VideoNarrativeCreatorProfile,
} from "./videoNarrativeCreatorProfileContract";
import type {
  VideoNarrativeDiagnosisCreatorSignal,
  VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";

const CONTRACT_SOURCE_PATH = path.join(__dirname, "videoNarrativeEvolvingDiagnosisContract.ts");

function signal(
  type: VideoNarrativeDiagnosisCreatorSignal["type"],
  value: string,
  confidence: VideoNarrativeDiagnosisCreatorSignal["confidence"] = "medium",
): VideoNarrativeDiagnosisCreatorSignal {
  return {
    id: `${type}-${value}`,
    type,
    value,
    source: "diagnosis_inference",
    confidence,
    evidence: `Evidência para ${value}`,
    shouldPersistLater: false,
  };
}

function makeDiagnosis(overrides: Partial<VideoNarrativeStrategicDiagnosis> = {}): VideoNarrativeStrategicDiagnosis {
  return {
    id: "diagnosis-1",
    accessLevel: "free",
    mainNarrative: "rotina de produto com potencial comercial",
    whatVideoCommunicates: "Esse vídeo comunica uma rotina com território narrativo de cuidado.",
    creatorIntent: "Quero saber se vale postar e se pode virar publi",
    strategicReading: "Pelo vídeo e pelo objetivo declarado, o melhor caminho é tornar o gancho mais direto.",
    strength: "Mostra contexto real de uso.",
    weakness: "A abertura poderia ser mais clara.",
    recommendedAdjustment: "Abrir com a transformação principal antes do passo a passo.",
    suggestedHook: "Abrir com o resultado antes da rotina.",
    brandPotential: {
      enabled: true,
      territories: ["skincare", "bem-estar", "rotina prática"],
      whyItFits: "Existe fit narrativo com rotina e cuidado.",
      locked: false,
    },
    blueprint: {
      whatToPost: "Reel de rotina com antes/depois narrativo.",
      whyThisPath: "A narrativa fica mais fácil de entender.",
      howItShouldWork: "Abrir com resultado, mostrar processo e fechar com convite para salvar.",
      scenes: ["resultado", "processo", "fechamento"],
      locked: false,
    },
    scriptDirection: {
      opening: "Comece mostrando o resultado final.",
      development: ["mostrar contexto", "explicar decisão"],
      closing: "Fechar com próximo passo.",
      tone: "consultivo",
      locked: false,
    },
    nextActions: [
      { id: "improve-hook", label: "Melhorar gancho", description: null, locked: false },
    ],
    lockedSections: [],
    creatorSignals: [
      signal("content_goal", "validar antes de postar"),
      signal("commercial_preference", "atrair marcas"),
      signal("brand_territory", "skincare"),
    ],
    instagramComparison: {
      connected: false,
      summary: null,
      matchingNarratives: [],
      matchingFormats: [],
      locked: true,
    },
    createdAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

function profileFromSignals(
  signals: VideoNarrativeDiagnosisCreatorSignal[],
  existingProfile: VideoNarrativeCreatorProfile | null = null,
): VideoNarrativeCreatorProfile {
  return buildVideoNarrativeCreatorProfile({
    creatorId: "creator-1",
    existingProfile,
    newSignals: signals,
    diagnosisId: "diagnosis-1",
    createdAt: "2026-05-18T00:00:00.000Z",
  });
}

function recurringProfile(): VideoNarrativeCreatorProfile {
  const first = profileFromSignals([
    signal("content_goal", "validar antes de postar", "high"),
    signal("hook_preference", "abertura direta", "high"),
    signal("format_preference", "reels direto", "medium"),
    signal("brand_territory", "skincare", "high"),
    signal("commercial_preference", "atrair marcas", "medium"),
    signal("collab_preference", "autoridade complementar", "medium"),
  ]);

  return profileFromSignals([
    signal("content_goal", "validar antes de postar", "high"),
    signal("hook_preference", "abertura direta", "high"),
    signal("format_preference", "reels direto", "medium"),
    signal("brand_territory", "skincare", "high"),
    signal("commercial_preference", "atrair marcas", "medium"),
    signal("collab_preference", "autoridade complementar", "medium"),
  ], first);
}

function stringify(value: VideoNarrativeEvolvingDiagnosis): string {
  return JSON.stringify(value).toLowerCase();
}

describe("videoNarrativeEvolvingDiagnosisContract", () => {
  it("cria diagnóstico evolutivo gratuito útil a partir de um diagnóstico estratégico", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis(),
      accessLevel: "free",
    });

    expect(evolving.accessLevel).toBe("free");
    expect(evolving.videoDiagnosisId).toBe("diagnosis-1");
    expect(evolving.currentLevel.id).toBeTruthy();
    expect(evolving.profileImpact.summary).toContain("primeira leitura");
    expect(evolving.unlockedSignals.length).toBeGreaterThan(0);
  });

  it("free gera subscriptionUnlocks para evolução completa, marca/collab e análise aprofundada", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis(),
      accessLevel: "free",
    });
    const text = stringify(evolving);

    expect(evolving.subscriptionUnlocks.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain("evolução completa");
    expect(text).toContain("potencial comercial");
    expect(text).toContain("collab");
    expect(text).toContain("padrões recorrentes");
  });

  it("premium gera profileImpact mais completo que free", () => {
    const profile = recurringProfile();
    const free = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis(),
      creatorProfile: profile,
      accessLevel: "free",
    });
    const premium = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({ accessLevel: "premium" }),
      creatorProfile: profile,
      accessLevel: "premium",
    });

    expect(premium.profileImpact.depth).toBe("deep");
    expect(premium.profileImpact.usefulSignalsCount).toBeGreaterThan(free.profileImpact.usefulSignalsCount);
    expect(premium.unlockedSignals.length).toBeGreaterThan(free.unlockedSignals.length);
  });

  it("instagram optimized conectado marca leitura como mais precisa", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({ accessLevel: "instagram_optimized" }),
      creatorProfile: recurringProfile(),
      accessLevel: "instagram_optimized",
      instagramConnected: true,
    });

    expect(evolving.accessSummary.precision).toBe("instagram_contextual");
    expect(evolving.accessSummary.message).toContain("mais precisa");
    expect(evolving.instagramUnlocks).toHaveLength(0);
  });

  it("sem Instagram conectado cria instagramUnlocks claros", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({ accessLevel: "premium" }),
      accessLevel: "premium",
      instagramConnected: false,
    });

    expect(evolving.instagramUnlocks.map((unlock) => unlock.id)).toContain("unlock-instagram-comparison");
    expect(evolving.instagramUnlocks.map((unlock) => unlock.id)).toContain("unlock-performance-precision");
  });

  it("usa Creator Narrative Profile para detectar padrões recorrentes", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({ accessLevel: "premium" }),
      creatorProfile: recurringProfile(),
      accessLevel: "premium",
    });

    expect(evolving.recurringPatterns.length).toBeGreaterThan(0);
    expect(evolving.profileImpact.recurringSignalsCount).toBeGreaterThan(0);
  });

  it("nível estratégico não depende apenas de analyzedVideosCount", () => {
    const manyVideosWithoutSignals = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({ creatorSignals: [], brandPotential: { enabled: false, territories: [], whyItFits: null, locked: true } }),
      creatorProfile: createEmptyVideoNarrativeCreatorProfile(),
      accessLevel: "premium",
      analyzedVideosCount: 99,
    });
    const fewVideosWithSignals = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({ accessLevel: "instagram_optimized" }),
      creatorProfile: recurringProfile(),
      accessLevel: "instagram_optimized",
      instagramConnected: true,
      analyzedVideosCount: 1,
    });

    expect(manyVideosWithoutSignals.currentLevel.id).toBe("first_reading");
    expect(fewVideosWithSignals.currentLevel.position).toBeGreaterThan(manyVideosWithoutSignals.currentLevel.position);
  });

  it("gera currentLevel e nextLevel coerentes", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis(),
      accessLevel: "free",
    });

    expect(evolving.currentLevel.position).toBeGreaterThanOrEqual(1);
    expect(evolving.nextLevel?.position).toBe(evolving.currentLevel.position + 1);
  });

  it("gera pendingSignals quando faltam formato, performance, marca ou collab", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({
        creatorSignals: [signal("content_goal", "validar pauta")],
        brandPotential: { enabled: false, territories: [], whyItFits: null, locked: true },
      }),
      accessLevel: "free",
      instagramConnected: false,
    });
    const pendingIds = evolving.pendingSignals.map((pending) => pending.id);

    expect(pendingIds).toContain("pending-format-preference");
    expect(pendingIds).toContain("pending-performance-context");
    expect(pendingIds).toContain("pending-brand-territory");
    expect(pendingIds).toContain("pending-collab-preference");
  });

  it("gera nextSignalsToUnlock com ações claras", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({
        creatorSignals: [signal("content_goal", "validar pauta")],
        brandPotential: { enabled: false, territories: [], whyItFits: null, locked: true },
      }),
      accessLevel: "free",
    });

    expect(evolving.nextSignalsToUnlock.length).toBeGreaterThan(0);
    evolving.nextSignalsToUnlock.forEach((item) => {
      expect(item.label).toContain("Desbloquear");
      expect(item.action.length).toBeGreaterThan(10);
    });
  });

  it("gera opportunities de marca/collab sem prometer match real", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({
        creatorSignals: [
          ...makeDiagnosis().creatorSignals,
          signal("collab_preference", "autoridade complementar"),
        ],
      }),
      accessLevel: "premium",
    });

    expect(evolving.opportunities.some((item) => item.type === "brand_territory")).toBe(true);
    expect(evolving.opportunities.some((item) => item.type === "collab_type")).toBe(true);
    expect(evolving.opportunities.every((item) => item.realMatchAvailable === false)).toBe(true);
    expect(stringify(evolving)).not.toContain("match real disponível");
  });

  it("não sugere nomes reais de creators", () => {
    const evolving = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis: makeDiagnosis({
        creatorIntent: "Quero fazer collab com Creator Famoso",
        creatorSignals: [signal("collab_preference", "Creator Famoso")],
      }),
      accessLevel: "premium",
    });

    expect(stringify(evolving)).not.toContain("creator famoso");
    expect(evolving.opportunities.filter((item) => item.type === "collab_type").length).toBeGreaterThan(0);
  });

  it("sanitiza textos perigosos", () => {
    const text = sanitizeVideoNarrativeEvolvingDiagnosisText(
      "AIza1234567890abc GEMINI_API_KEY=secret abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 https://x.test/file?token=abc marca garantida score venceu",
    );

    expect(text).toContain("[redigido]");
    expect(text).not.toContain("AIza");
    expect(text).not.toContain("GEMINI_API_KEY");
    expect(text).not.toContain("token=abc");
    expect(text.toLowerCase()).not.toContain("marca garantida");
    expect(text.toLowerCase()).not.toContain("score");
    expect(text.toLowerCase()).not.toContain("venceu");
  });

  it("não importa fetch, Prisma, banco, Gemini, OpenAI, Stripe ou SDK externo", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");

    [
      "fetch",
      "Prisma",
      "banco",
      "@google/genai",
      "Gemini",
      "OpenAI",
      "Stripe",
      "stripe",
      "firebase",
      "supabase",
    ].forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });

  it("não altera endpoint, UI ou preview", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");

    [
      "route.ts",
      "VideoNarrativeAppPreview",
      "VideoNarrativeInteractiveAppPreview",
      "React",
      "BoardShell",
      "PostCreationFunnelState",
      "components/",
      "app/api",
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });
  });
});
