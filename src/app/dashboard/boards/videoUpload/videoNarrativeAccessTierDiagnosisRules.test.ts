import fs from "fs";
import path from "path";
import {
  buildVideoNarrativeAccessTierDiagnosisRules,
  sanitizeVideoNarrativeAccessTierDiagnosisRulesText,
  type VideoNarrativeAccessTierDiagnosisRules,
} from "./videoNarrativeAccessTierDiagnosisRules";
import {
  buildVideoNarrativeEvolvingDiagnosis,
  type VideoNarrativeEvolvingDiagnosis,
} from "./videoNarrativeEvolvingDiagnosisContract";
import {
  buildVideoNarrativeCreatorProfile,
  type VideoNarrativeCreatorProfile,
} from "./videoNarrativeCreatorProfileContract";
import type {
  VideoNarrativeDiagnosisCreatorSignal,
  VideoNarrativeDiagnosisAccessLevel,
  VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";

const RULES_SOURCE_PATH = path.join(__dirname, "videoNarrativeAccessTierDiagnosisRules.ts");

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
    id: "access-rules-diagnosis",
    accessLevel: "premium",
    mainNarrative: "rotina de cuidado com fit narrativo comercial",
    whatVideoCommunicates: "Esse vídeo comunica rotina, contexto e oportunidade futura.",
    creatorIntent: "Quero saber se isso pode virar publi ou collab",
    strategicReading: "Pelo vídeo, o caminho é transformar a rotina em mapa estratégico.",
    strength: "Mostra contexto real.",
    weakness: "A abertura ainda pode ficar mais clara.",
    recommendedAdjustment: "Abrir com o resultado antes da rotina.",
    suggestedHook: "Comece pelo resultado.",
    brandPotential: {
      enabled: true,
      territories: ["skincare", "bem-estar"],
      whyItFits: "Existe fit narrativo com cuidado e rotina.",
      locked: false,
    },
    blueprint: {
      whatToPost: "Reel com rotina e resultado.",
      whyThisPath: "A narrativa fica mais clara.",
      howItShouldWork: "Abrir com resultado, mostrar processo e fechar com próximo passo.",
      scenes: ["resultado", "processo"],
      locked: false,
    },
    scriptDirection: {
      opening: "Comece pelo resultado.",
      development: ["contexto", "processo"],
      closing: "Próximo passo.",
      tone: "consultivo",
      locked: false,
    },
    nextActions: [{ id: "script", label: "Gerar roteiro", description: null, locked: false }],
    lockedSections: [],
    creatorSignals: [
      signal("content_goal", "validar antes de postar"),
      signal("brand_territory", "skincare"),
      signal("commercial_preference", "atrair marcas"),
      signal("collab_preference", "tipo complementar"),
      signal("format_preference", "reels direto"),
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

function profile(): VideoNarrativeCreatorProfile {
  const first = buildVideoNarrativeCreatorProfile({
    creatorId: "creator-1",
    diagnosisId: "d1",
    createdAt: "2026-05-17T00:00:00.000Z",
    newSignals: [
      signal("content_goal", "validar antes de postar", "high"),
      signal("hook_preference", "abertura direta", "high"),
      signal("format_preference", "reels direto", "medium"),
      signal("brand_territory", "skincare", "high"),
      signal("commercial_preference", "atrair marcas", "medium"),
      signal("collab_preference", "tipo complementar", "medium"),
    ],
  });

  return buildVideoNarrativeCreatorProfile({
    existingProfile: first,
    diagnosisId: "d2",
    createdAt: "2026-05-18T00:00:00.000Z",
    newSignals: [
      signal("content_goal", "validar antes de postar", "high"),
      signal("hook_preference", "abertura direta", "high"),
      signal("format_preference", "reels direto", "medium"),
      signal("brand_territory", "skincare", "high"),
      signal("commercial_preference", "atrair marcas", "medium"),
      signal("collab_preference", "tipo complementar", "medium"),
    ],
  });
}

function evolving(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
  withSignals?: boolean;
  diagnosis?: VideoNarrativeStrategicDiagnosis;
}): VideoNarrativeEvolvingDiagnosis {
  return buildVideoNarrativeEvolvingDiagnosis({
    diagnosis: params.diagnosis ?? makeDiagnosis({ accessLevel: params.accessLevel }),
    creatorProfile: params.withSignals === false ? null : profile(),
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
    analyzedVideosCount: 3,
  });
}

function rules(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
  withSignals?: boolean;
  diagnosis?: VideoNarrativeStrategicDiagnosis;
}): VideoNarrativeAccessTierDiagnosisRules {
  return buildVideoNarrativeAccessTierDiagnosisRules({
    evolvingDiagnosis: evolving(params),
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
  });
}

function stringify(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("videoNarrativeAccessTierDiagnosisRules", () => {
  it("free mostra apenas seções essenciais e bloqueia mapa completo", () => {
    const result = rules({ accessLevel: "free" });

    expect(result.valueLayer).toBe("first_reading");
    expect(result.visibleSections.map((section) => section.key)).toContain("main_video_reading");
    expect(result.visibleSections.map((section) => section.key)).toContain("primary_adjustment");
    expect(result.canShowFullProfileImpact).toBe(false);
    expect(result.lockedSections.map((section) => section.key)).toContain("full_profile_impact");
  });

  it("free cria CTA de desbloquear diagnóstico completo", () => {
    const result = rules({ accessLevel: "free" });

    expect(result.primaryCTA.action).toBe("upgrade");
    expect(result.primaryCTA.label).toBe("Desbloquear diagnóstico completo");
    expect(result.shouldTeaseSubscription).toBe(true);
  });

  it("free limita marca/collab a teaser quando houver oportunidade", () => {
    const result = rules({ accessLevel: "free" });

    expect(result.commercialAvailability.state).toBe("teaser_only");
    expect(result.collabAvailability.state).toBe("teaser_only");
    expect(result.canShowFullBrandOpportunities).toBe(false);
    expect(result.canShowFullCollabOpportunities).toBe(false);
  });

  it("premium libera mapa estratégico, sinais e padrões recorrentes", () => {
    const result = rules({ accessLevel: "premium" });

    expect(result.valueLayer).toBe("strategic_map");
    expect(result.canShowFullProfileImpact).toBe(true);
    expect(result.canShowFullRecurringPatterns).toBe(true);
    expect(result.visibleSections.map((section) => section.key)).toContain("unlocked_signals");
    expect(result.visibleSections.map((section) => section.key)).toContain("recurring_patterns");
  });

  it("premium libera oportunidades estratégicas de marca/collab sem match real", () => {
    const result = rules({ accessLevel: "premium" });

    expect(result.commercialAvailability.state).toBe("strategic_available");
    expect(result.collabAvailability.state).toBe("strategic_available");
    expect(result.commercialAvailability.realMatchAvailable).toBe(false);
    expect(result.collabAvailability.realMatchAvailable).toBe(false);
    expect(stringify(result)).not.toContain("match real disponível");
  });

  it("premium sem Instagram cria CTA ou motivo para conectar Instagram", () => {
    const result = rules({ accessLevel: "premium", instagramConnected: false });

    expect(result.primaryCTA.action).toBe("connect_instagram");
    expect(result.primaryCTA.label).toBe("Conectar Instagram para aumentar precisão");
    expect(result.instagramReasons.map((reason) => reason.id)).toContain("instagram_precision");
    expect(result.shouldTeaseInstagramConnection).toBe(true);
  });

  it("instagram optimized conectado libera precisão contextual", () => {
    const result = rules({ accessLevel: "instagram_optimized", instagramConnected: true });

    expect(result.valueLayer).toBe("instagram_precision");
    expect(result.canShowInstagramPrecision).toBe(true);
    expect(result.primaryCTA.action).toBe("generate_next_strategic_move");
    expect(result.visibleSections.map((section) => section.key)).toContain("instagram_precision");
  });

  it("instagram optimized conectado não afirma uso de dados reais", () => {
    const result = rules({ accessLevel: "instagram_optimized", instagramConnected: true });
    const text = stringify(result);

    expect(text).toContain("contexto futuro");
    expect(text).not.toContain("dados reais foram usados");
    expect(text).not.toContain("usou dados reais");
  });

  it("commercialAvailability muda corretamente entre free, premium e instagram_optimized", () => {
    expect(rules({ accessLevel: "free" }).commercialAvailability.state).toBe("teaser_only");
    expect(rules({ accessLevel: "premium" }).commercialAvailability.state).toBe("strategic_available");
    expect(rules({
      accessLevel: "instagram_optimized",
      instagramConnected: true,
    }).commercialAvailability.state).toBe("instagram_precision_available");
  });

  it("collabAvailability muda corretamente entre free, premium e instagram_optimized", () => {
    expect(rules({ accessLevel: "free" }).collabAvailability.state).toBe("teaser_only");
    expect(rules({ accessLevel: "premium" }).collabAvailability.state).toBe("strategic_available");
    expect(rules({
      accessLevel: "instagram_optimized",
      instagramConnected: true,
    }).collabAvailability.state).toBe("instagram_precision_available");
  });

  it("não sugere nomes reais de creators", () => {
    const result = rules({
      accessLevel: "premium",
      diagnosis: makeDiagnosis({
        creatorIntent: "Quero collab com Creator Famoso",
        creatorSignals: [signal("collab_preference", "Creator Famoso")],
      }),
    });

    expect(stringify(result)).not.toContain("creator famoso");
  });

  it("não promete marca, publi, match ou resultado garantido", () => {
    const result = rules({ accessLevel: "premium" });
    const text = stringify(result);

    expect(text).not.toContain("marca garantida");
    expect(text).not.toContain("publi garantida");
    expect(text).not.toContain("match comprovado");
    expect(text).not.toContain("resultado garantido");
    expect(text).not.toContain("garantido");
    expect(text).not.toContain("certeza");
    expect(text).not.toContain("comprovado");
  });

  it("sanitiza textos perigosos", () => {
    const text = sanitizeVideoNarrativeAccessTierDiagnosisRulesText(
      "AIza1234567890abc GEMINI_API_KEY=secret abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 https://x.test/file?token=abc score venceu garantido",
    ).toLowerCase();

    expect(text).toContain("[redigido]");
    expect(text).not.toContain("AIza");
    expect(text).not.toContain("gemini_api_key");
    expect(text).not.toContain("token=abc");
    expect(text).not.toContain("score");
    expect(text).not.toContain("venceu");
  });

  it("não importa fetch, Prisma, banco, Gemini, OpenAI, Stripe ou SDK externo", () => {
    const source = fs.readFileSync(RULES_SOURCE_PATH, "utf8");

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
    const source = fs.readFileSync(RULES_SOURCE_PATH, "utf8");

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
