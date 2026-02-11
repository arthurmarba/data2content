import { buildIntelligencePromptBlock, sanitizeScriptIdentityLeakage } from "./ai";

describe("scripts/ai identity leakage sanitization", () => {
  it("removes unauthorized mentions and hashtags", () => {
    const sanitized = sanitizeScriptIdentityLeakage(
      {
        title: "Roteiro com @outraPessoa",
        content:
          "Hoje vamos falar de rotina com @usuarioaleatorio e #viral. Comenta aqui no final.",
      },
      ["quero um roteiro de humor"]
    );

    expect(sanitized.title).not.toContain("@outraPessoa");
    expect(sanitized.content).not.toContain("@usuarioaleatorio");
    expect(sanitized.content).not.toContain("#viral");
    expect(sanitized.content).toContain("Comenta aqui no final");
  });

  it("keeps mentions and hashtags explicitly present in allowed texts", () => {
    const sanitized = sanitizeScriptIdentityLeakage(
      {
        title: "Roteiro para @meuperfil",
        content: "Use #meutema e @meuperfil no CTA final.",
      },
      ["fazer roteiro para @meuperfil com #meutema"]
    );

    expect(sanitized.title).toContain("@meuperfil");
    expect(sanitized.content).toContain("#meutema");
    expect(sanitized.content).toContain("@meuperfil");
  });

  it("includes style profile guidance in intelligence prompt block", () => {
    const block = buildIntelligencePromptBlock({
      intelligenceVersion: "scripts_intelligence_v2",
      promptMode: "open",
      intent: { wantsHumor: true, wantsEngagement: true, subjectHint: null },
      metricUsed: "avg_total_interactions",
      lookbackDays: 180,
      explicitCategories: {},
      resolvedCategories: {
        proposal: "humor_scene",
        context: "career_work",
        format: "reel",
        tone: "humorous",
        references: "pop_culture",
      },
      rankedCategories: {
        proposal: ["humor_scene"],
        context: ["career_work"],
        format: ["reel"],
        tone: ["humorous"],
        references: ["pop_culture"],
      },
      dnaProfile: {
        sampleSize: 8,
        hasEnoughEvidence: true,
        averageSentenceLength: 12,
        emojiDensity: 0.02,
        openingPatterns: ["deixa eu te mostrar"],
        ctaPatterns: ["comentario"],
        recurringExpressions: ["resultado"],
        writingGuidelines: ["Use frases curtas."],
      },
      styleProfile: {
        profileVersion: "scripts_style_profile_v1",
        sampleSize: 12,
        hasEnoughEvidence: true,
        writingGuidelines: ["Imite o tom conversacional."],
        styleSignalsUsed: {
          hookPatterns: ["deixa eu te mostrar"],
          ctaPatterns: ["comentario"],
          humorMarkers: ["humor"],
          recurringExpressions: ["resultado"],
          avgSentenceLength: 12,
          emojiDensity: 0.02,
          narrativeCadence: {
            openingAvgChars: 90,
            developmentAvgChars: 260,
            closingAvgChars: 110,
          },
        },
        styleExamples: ["Deixa eu te mostrar um jeito simples de fazer isso."],
      },
      styleProfileVersion: "scripts_style_profile_v1",
      styleSampleSize: 12,
      captionEvidence: [
        {
          metricId: "m1",
          caption: "Deixa eu te mostrar como simplificar isso hoje.",
          interactions: 120,
          postDate: null,
          categories: { proposal: "humor_scene" },
        },
      ],
      relaxationLevel: 1,
      usedFallbackRules: false,
    });

    expect(block).toContain("Perfil de estilo do usuario");
    expect(block).toContain("Amostra de roteiros: 12");
    expect(block).toContain("Imite o estilo do criador sem copiar frases literalmente.");
  });
});
