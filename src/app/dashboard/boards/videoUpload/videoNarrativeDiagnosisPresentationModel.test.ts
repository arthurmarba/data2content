import fs from "fs";
import path from "path";
import {
  buildVideoNarrativeDiagnosisPresentation,
  sanitizeVideoNarrativeDiagnosisPresentationText,
  type VideoNarrativeDiagnosisPresentation,
} from "./videoNarrativeDiagnosisPresentationModel";
import {
  buildVideoNarrativeAccessTierDiagnosisRules,
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
  VideoNarrativeDiagnosisAccessLevel,
  VideoNarrativeDiagnosisCreatorSignal,
  VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";

const PRESENTATION_SOURCE_PATH = path.join(__dirname, "videoNarrativeDiagnosisPresentationModel.ts");

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
    id: "presentation-diagnosis",
    accessLevel: "premium",
    mainNarrative: "rotina de cuidado com território de marca possível",
    whatVideoCommunicates: "rotina, contexto e oportunidade futura de conteúdo",
    creatorIntent: "Quero entender se esse vídeo vira uma oportunidade comercial",
    strategicReading: "O vídeo funciona melhor quando a rotina vira direção estratégica.",
    strength: "Mostra contexto real e fácil de entender.",
    weakness: "A abertura ainda demora para revelar o benefício.",
    recommendedAdjustment: "abrir com o resultado antes da rotina",
    suggestedHook: "Comece pelo resultado e depois mostre o processo.",
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
      signal("content_goal", "validar antes de postar", "high"),
      signal("brand_territory", "skincare", "high"),
      signal("commercial_preference", "atrair marcas", "medium"),
      signal("collab_preference", "tipo complementar", "medium"),
      signal("format_preference", "reels direto", "medium"),
      signal("hook_preference", "abertura direta", "high"),
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

function makeProfile(): VideoNarrativeCreatorProfile {
  const firstProfile = buildVideoNarrativeCreatorProfile({
    creatorId: "creator-1",
    diagnosisId: "presentation-d1",
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
    existingProfile: firstProfile,
    diagnosisId: "presentation-d2",
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

function makePresentation(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
  diagnosis?: VideoNarrativeStrategicDiagnosis;
}): VideoNarrativeDiagnosisPresentation {
  const diagnosis = params.diagnosis ?? makeDiagnosis({ accessLevel: params.accessLevel });
  const evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis = buildVideoNarrativeEvolvingDiagnosis({
    diagnosis,
    creatorProfile: makeProfile(),
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
    analyzedVideosCount: 4,
    createdAt: "2026-05-18T00:00:00.000Z",
  });
  const accessRules = buildVideoNarrativeAccessTierDiagnosisRules({
    evolvingDiagnosis,
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
  });

  return buildVideoNarrativeDiagnosisPresentation({
    diagnosis,
    evolvingDiagnosis,
    accessRules,
  });
}

function textOf(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("videoNarrativeDiagnosisPresentationModel", () => {
  it("free gera hero de primeira leitura gratuita", () => {
    const result = makePresentation({ accessLevel: "free" });

    expect(result.hero.title).toBe("Primeira leitura do seu vídeo");
    expect(result.hero.badge.label).toBe("Primeira leitura gratuita");
    expect(result.hero.precisionLabel).toBe("Leitura inicial, sem performance do Instagram");
  });

  it("free gera de 3 a 5 priorityCards curtos", () => {
    const result = makePresentation({ accessLevel: "free" });

    expect(result.priorityCards.length).toBeGreaterThanOrEqual(3);
    expect(result.priorityCards.length).toBeLessThanOrEqual(5);
    result.priorityCards.forEach((card) => {
      expect(card.title.length).toBeLessThanOrEqual(72);
      expect(card.body.length).toBeLessThanOrEqual(170);
    });
  });

  it("free transforma mapa completo, marca, collab e Instagram em lockedPreviews quando apropriado", () => {
    const result = makePresentation({ accessLevel: "free", instagramConnected: false });
    const titles = result.lockedPreviews.map((preview) => preview.title);

    expect(titles).toContain("Mapa estratégico completo");
    expect(titles).toContain("Oportunidades futuras de marca");
    expect(titles).toContain("Tipos de collab possíveis");
    expect(titles).toContain("Leitura mais precisa com Instagram");
  });

  it("free mantém valor real e não fica vazio", () => {
    const result = makePresentation({ accessLevel: "free" });

    expect(result.priorityCards[0]?.body).toContain("Este vídeo comunica");
    expect(result.sections.map((section) => section.id)).toContain("video_diagnosis");
    expect(result.primaryCTA.label).toBe("Desbloquear diagnóstico completo");
  });

  it("premium gera hero de diagnóstico completo e mapa estratégico", () => {
    const result = makePresentation({ accessLevel: "premium" });

    expect(result.hero.title).toBe("Seu mapa estratégico foi atualizado");
    expect(result.hero.badge.label).toBe("Diagnóstico completo");
    expect(result.hero.precisionLabel).toBe("Mapa estratégico baseado nos sinais do creator");
  });

  it("premium mostra creator_evolution e strategic_level", () => {
    const result = makePresentation({ accessLevel: "premium" });
    const sectionIds = result.sections.map((section) => section.id);

    expect(sectionIds).toContain("creator_evolution");
    expect(sectionIds).toContain("strategic_level");
  });

  it("premium mostra brand e collab como oportunidades futuras sem match real", () => {
    const result = makePresentation({ accessLevel: "premium" });
    const text = textOf(result);

    expect(result.sections.map((section) => section.id)).toContain("brand_opportunities");
    expect(result.sections.map((section) => section.id)).toContain("collab_opportunities");
    expect(text).toContain("oportunidade futura");
    expect(text).not.toContain("match real");
  });

  it("premium sem Instagram mantém instagram_precision bloqueado", () => {
    const result = makePresentation({ accessLevel: "premium", instagramConnected: false });

    expect(result.sections.map((section) => section.id)).not.toContain("instagram_precision");
    expect(result.lockedPreviews.map((preview) => preview.id)).toContain("locked-instagram_precision");
  });

  it("instagram optimized conectado gera hero de leitura mais precisa", () => {
    const result = makePresentation({ accessLevel: "instagram_optimized", instagramConnected: true });

    expect(result.hero.title).toBe("Diagnóstico otimizado com contexto de Instagram");
    expect(result.hero.badge.label).toBe("Leitura mais precisa");
  });

  it("instagram optimized conectado mostra seção instagram_precision", () => {
    const result = makePresentation({ accessLevel: "instagram_optimized", instagramConnected: true });

    expect(result.sections.map((section) => section.id)).toContain("instagram_precision");
  });

  it("primaryCTA respeita accessRules", () => {
    const free = makePresentation({ accessLevel: "free" });
    const premium = makePresentation({ accessLevel: "premium", instagramConnected: false });

    expect(free.primaryCTA.label).toBe("Desbloquear diagnóstico completo");
    expect(free.primaryCTA.action).toBe("upgrade");
    expect(premium.primaryCTA.label).toBe("Conectar Instagram para aumentar precisão");
    expect(premium.primaryCTA.action).toBe("connect_instagram");
  });

  it("secondaryCTA é coerente com accessLevel e Instagram", () => {
    expect(makePresentation({ accessLevel: "free" }).secondaryCTA?.label).toBe("Conectar Instagram depois");
    expect(makePresentation({ accessLevel: "premium", instagramConnected: false }).secondaryCTA?.label).toBe("Analisar mais um vídeo");
    expect(makePresentation({
      accessLevel: "instagram_optimized",
      instagramConnected: true,
    }).secondaryCTA?.label).toBe("Criar variação de roteiro");
  });

  it("cards têm textos curtos", () => {
    const result = makePresentation({ accessLevel: "instagram_optimized", instagramConnected: true });
    const cards = [
      ...result.priorityCards,
      ...result.sections.flatMap((section) => section.cards),
    ];

    cards.forEach((card) => {
      expect(card.body.length).toBeLessThanOrEqual(170);
    });
  });

  it("não sugere nomes reais de creators", () => {
    const result = makePresentation({
      accessLevel: "premium",
      diagnosis: makeDiagnosis({
        creatorIntent: "Quero collab com Creator Famoso",
        creatorSignals: [signal("collab_preference", "Creator Famoso", "high")],
      }),
    });

    expect(textOf(result)).not.toContain("creator famoso");
  });

  it("não promete marca, publi, match ou performance", () => {
    const result = makePresentation({ accessLevel: "instagram_optimized", instagramConnected: true });
    const text = textOf(result);

    expect(text).not.toContain("marca garantida");
    expect(text).not.toContain("publi garantida");
    expect(text).not.toContain("patrocínio garantido");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("performance garantida");
    expect(text).not.toContain("garantido");
    expect(text).not.toContain("certeza");
    expect(text).not.toContain("comprovado");
    expect(text).not.toContain("viralizar");
  });

  it("sanitiza textos perigosos", () => {
    const dangerousText = "AIza1234567890abc GEMINI_API_KEY=secret https://x.test/file?token=abc score venceu garantido match real viralizar";
    const sanitized = sanitizeVideoNarrativeDiagnosisPresentationText(dangerousText).toLowerCase();
    const result = makePresentation({
      accessLevel: "free",
      diagnosis: makeDiagnosis({
        whatVideoCommunicates: dangerousText,
        recommendedAdjustment: dangerousText,
      }),
    });
    const text = textOf(result);

    expect(sanitized).toContain("[redigido]");
    expect(text).not.toContain("AIza");
    expect(text).not.toContain("gemini_api_key");
    expect(text).not.toContain("token=abc");
    expect(text).not.toContain("score");
    expect(text).not.toContain("venceu");
    expect(text).not.toContain("garantido");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("viralizar");
  });

  it("não importa fetch, Prisma, banco, Gemini, OpenAI, Stripe ou SDK externo", () => {
    const source = fs.readFileSync(PRESENTATION_SOURCE_PATH, "utf8");

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
    const source = fs.readFileSync(PRESENTATION_SOURCE_PATH, "utf8");

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
