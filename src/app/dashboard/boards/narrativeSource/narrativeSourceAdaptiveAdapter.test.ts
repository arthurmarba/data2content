import fs from "fs";
import path from "path";
import { buildAdaptiveInputFromNarrativeSource } from "./narrativeSourceAdaptiveAdapter";
import { createEmptyNarrativeSource, type NarrativeAsset, type NarrativeSource } from "./narrativeSourceTypes";
import type {
  CreatorNarrativeSignal,
  NarrativeSourceIntent,
  NarrativeSourceIntentDetection,
} from "./narrativeSourceTypes";

function makeSource(params: Partial<NarrativeSource> = {}): NarrativeSource {
  return {
    ...createEmptyNarrativeSource({
      id: params.id || "source-adapter-test",
      sourceType: params.sourceType || "video_simulated",
    }),
    ...params,
    metadata: params.metadata || {},
  };
}

function makeIntentDetection(
  intent: NarrativeSourceIntent,
  source: NarrativeSource,
  signals: string[] = []
): NarrativeSourceIntentDetection {
  const originalQuestion = source.creatorQuestion || source.rawText || source.transcript || source.visualDescription || "";

  return {
    intent,
    confidence: intent === "unknown" ? 0.2 : 0.85,
    sourceType: source.sourceType,
    originalQuestion,
    normalizedQuestion: originalQuestion.toLowerCase().replace(/\s+/g, " ").trim(),
    signals,
  };
}

function makeAsset(type: NarrativeAsset["type"], value: string): NarrativeAsset {
  return {
    id: `asset-${type}-${value}`,
    type,
    value,
    confidence: 0.8,
    evidence: "Sinal de teste.",
  };
}

function makeSignal(signalType: CreatorNarrativeSignal["signalType"], value: string): CreatorNarrativeSignal {
  return {
    id: `signal-${signalType}-${value}`,
    signalType,
    value,
    confidence: 0.8,
    sourceType: "video_simulated",
    shouldPersistLater: true,
    evidence: "Sinal de perfil de teste.",
  };
}

function adapt(params: {
  source: NarrativeSource;
  intent: NarrativeSourceIntent;
  assets?: NarrativeAsset[];
  profileSignals?: CreatorNarrativeSignal[];
  signals?: string[];
  summary?: string;
}) {
  return buildAdaptiveInputFromNarrativeSource({
    source: params.source,
    intentDetection: makeIntentDetection(params.intent, params.source, params.signals),
    extraction: {
      assets: params.assets || [],
      profileSignals: params.profileSignals || [],
      summary: params.summary || "A fonte apresenta sinais narrativos úteis.",
      suggestedNextStep: "Explorar a direção mais clara.",
    },
  });
}

describe("buildAdaptiveInputFromNarrativeSource", () => {
  it("maps validate_before_posting to validate_pauta", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Gravei esse vídeo e quero saber se vale postar",
      }),
      intent: "validate_before_posting",
      assets: [makeAsset("central_theme", "rotina de autocuidado")],
    });

    expect(result.modeHint).toBe("validate_pauta");
    expect(result.input).toContain("validar");
    expect(result.input).toContain("rotina de autocuidado");
  });

  it("maps improve_content to validate_pauta with hook context", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
      }),
      intent: "improve_content",
      assets: [makeAsset("central_theme", "bastidor de trabalho")],
    });

    expect(result.modeHint).toBe("validate_pauta");
    expect(result.input).toContain("melhorar");
    expect(result.input).toContain("gancho");
    expect(result.input).toContain("bastidor de trabalho");
  });

  it("maps discover_narrative to discover_pauta", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      }),
      intent: "discover_narrative",
      assets: [makeAsset("narrative_pattern", "bastidor real")],
    });

    expect(result.modeHint).toBe("discover_pauta");
    expect(result.input).toContain("narrativa");
    expect(result.input).toContain("bastidor real");
  });

  it("maps brand_potential to brand_match", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      }),
      intent: "brand_potential",
      assets: [makeAsset("central_theme", "rotina de autocuidado"), makeAsset("brand_territory", "autocuidado")],
    });

    expect(result.modeHint).toBe("brand_match");
    expect(result.input).toContain("atrair marcas");
    expect(result.input).toContain("autocuidado");
  });

  it("maps adapt_to_ad to brand_match with ad context", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Quero transformar esse vídeo em uma publi para uma marca de skincare",
      }),
      intent: "adapt_to_ad",
      assets: [makeAsset("central_theme", "rotina de autocuidado"), makeAsset("brand_territory", "autocuidado")],
    });

    expect(result.modeHint).toBe("brand_match");
    expect(result.input).toContain("publi");
    expect(result.input).toMatch(/sem parecer forçado|sem parecer forcado/);
  });

  it("maps collab_potential to collab_match", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      }),
      intent: "collab_potential",
      assets: [makeAsset("central_theme", "bastidor de trabalho")],
    });

    expect(result.modeHint).toBe("collab_match");
    expect(result.input).toContain("collab");
    expect(result.input).toContain("bastidor de trabalho");
  });

  it("maps positioning_fit to validate_pauta", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Quero saber se esse vídeo combina com meu posicionamento",
      }),
      intent: "positioning_fit",
      assets: [makeAsset("creator_role", "autoridade em construção")],
    });

    expect(result.modeHint).toBe("validate_pauta");
    expect(result.input).toContain("posicionamento");
    expect(result.input).toContain("tema ainda pouco definido");
  });

  it("returns a safe fallback for unknown intent and sparse assets", () => {
    const result = adapt({
      source: makeSource({
        rawText: "Preciso de uma direção para esse conteúdo",
      }),
      intent: "unknown",
      assets: [],
      profileSignals: [],
    });

    expect(result.modeHint).toBe("unknown");
    expect(result.input).toBeTruthy();
    expect(result.sourceSummary).toContain("Fonte video_simulated");
  });

  it("deduplicates and limits adapter signals", () => {
    const repeatedAssets = [
      makeAsset("central_theme", "rotina"),
      makeAsset("central_theme", "rotina"),
      makeAsset("brand_territory", "autocuidado"),
      makeAsset("brand_territory", "autocuidado"),
      ...Array.from({ length: 16 }, (_, index) => makeAsset("content_proposal", `sinal ${index}`)),
    ];
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      }),
      intent: "brand_potential",
      signals: ["rotina", "rotina", "marca"],
      assets: repeatedAssets,
      profileSignals: [makeSignal("brand_territory", "autocuidado"), makeSignal("brand_territory", "autocuidado")],
    });

    expect(result.signals.length).toBeLessThanOrEqual(12);
    expect(new Set(result.signals.map((signal) => signal.toLowerCase())).size).toBe(result.signals.length);
  });

  it("keeps generated language safe", () => {
    const result = adapt({
      source: makeSource({
        creatorQuestion: "Quero viralizar garantido com esse conteúdo",
      }),
      intent: "general_question",
      signals: ["garantido", "score", "nota", "viralizar"],
      assets: [makeAsset("central_theme", "pontuação comprovado")],
      profileSignals: [makeSignal("audience_goal", "certeza")],
    });
    const text = JSON.stringify([result.input, result.sourceSummary, result.signals]).toLowerCase();

    for (const forbidden of [
      "garantido",
      "certeza",
      "comprovado",
      "viralizar",
      "score",
      "nota",
      "pontuação",
      "acerto",
      "erro",
      "gabarito",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("keeps the adapter isolated from UI, external dependencies, and Adaptive V2 pipeline calls", () => {
    const source = fs.readFileSync(path.join(__dirname, "narrativeSourceAdaptiveAdapter.ts"), "utf8");

    expect(source).not.toMatch(/React|from ["']react["']/);
    expect(source).not.toMatch(/BoardShell|PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/OpenAI|openai/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Prisma|prisma|banco/);
    expect(source).not.toMatch(/components?\//);
    expect(source).not.toMatch(/detectPostCreationAdaptiveIntent/);
    expect(source).not.toMatch(/buildPostCreationAdaptiveQuiz/);
    expect(source).not.toMatch(/buildPostCreationAdaptiveAnswerKey|AnswerKey/);
    expect(source).not.toMatch(/buildPostCreationAdaptiveStrategicPlan|PlanBuilder/);
  });
});
