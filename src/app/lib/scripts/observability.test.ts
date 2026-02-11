import { buildScriptOutputDiagnostics } from "./observability";

describe("scripts/observability", () => {
  it("builds diagnostics for generation with CTA and paragraphs", () => {
    const diagnostics = buildScriptOutputDiagnostics({
      operation: "create",
      prompt: "roteiro de humor",
      title: "Titulo",
      content: "Abertura forte.\n\nDesenvolvimento claro.\n\nCTA: comenta aqui.",
    });

    expect(diagnostics.operation).toBe("create");
    expect(diagnostics.hasCta).toBe(true);
    expect(diagnostics.paragraphCount).toBe(3);
    expect(diagnostics.contentLength).toBeGreaterThan(20);
  });

  it("computes explicit category compliance from intelligence context", () => {
    const diagnostics = buildScriptOutputDiagnostics({
      operation: "create",
      prompt: "roteiro",
      title: "Titulo",
      content: "Texto com CTA: comenta.",
      intelligenceContext: {
        intelligenceVersion: "scripts_intelligence_v2",
        promptMode: "partial",
        intent: { wantsHumor: false, wantsEngagement: true, subjectHint: null },
        metricUsed: "avg_total_interactions",
        lookbackDays: 180,
        explicitCategories: { proposal: "tips", tone: "humorous" },
        resolvedCategories: {
          proposal: "tips",
          tone: "humorous",
          context: "career_work",
          format: "reel",
          references: "pop_culture",
        },
        rankedCategories: {
          proposal: ["tips"],
          context: ["career_work"],
          format: ["reel"],
          tone: ["humorous"],
          references: ["pop_culture"],
        },
        dnaProfile: {
          sampleSize: 10,
          hasEnoughEvidence: true,
          averageSentenceLength: 12,
          emojiDensity: 0.02,
          openingPatterns: ["ola criadores"],
          ctaPatterns: ["comentario"],
          recurringExpressions: ["criadores"],
          writingGuidelines: ["Use tom conversacional."],
        },
        styleProfile: {
          profileVersion: "scripts_style_profile_v1",
          sampleSize: 10,
          hasEnoughEvidence: true,
          writingGuidelines: ["Use frases curtas."],
          styleSignalsUsed: {
            hookPatterns: ["oi pessoal"],
            ctaPatterns: ["comentario"],
            humorMarkers: ["humor"],
            recurringExpressions: ["resultado"],
            avgSentenceLength: 12,
            emojiDensity: 0.02,
            narrativeCadence: {
              openingAvgChars: 80,
              developmentAvgChars: 260,
              closingAvgChars: 100,
            },
          },
          styleExamples: ["Oi pessoal, vamos direto ao ponto."],
        },
        styleProfileVersion: "scripts_style_profile_v1",
        styleSampleSize: 10,
        captionEvidence: [],
        relaxationLevel: 1,
        usedFallbackRules: false,
      },
    });

    expect(diagnostics.intelligenceEnabled).toBe(true);
    expect(diagnostics.explicitCategoryCount).toBe(2);
    expect(diagnostics.explicitCategoryComplianceRate).toBe(1);
    expect(diagnostics.dnaSampleSize).toBe(10);
    expect(diagnostics.styleProfileEnabled).toBe(true);
    expect(diagnostics.styleSampleSize).toBe(10);
    expect(typeof diagnostics.styleSimilarityScore).toBe("number");
  });

  it("computes delta diagnostics for adjustments", () => {
    const diagnostics = buildScriptOutputDiagnostics({
      operation: "adjust",
      prompt: "otimiza o primeiro paragrafo",
      title: "Novo",
      content: "Texto ajustado com CTA: comente.",
      previousContent: "Texto antigo com CTA: comente bastante por favor.",
    });

    expect(diagnostics.operation).toBe("adjust");
    expect(typeof diagnostics.contentLengthDelta).toBe("number");
    expect(typeof diagnostics.contentLengthDeltaPct).toBe("number");
  });
});
