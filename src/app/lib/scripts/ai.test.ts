import {
  buildIntelligencePromptBlock,
  sanitizeScriptIdentityLeakage,
  selectScriptModelForPrompt,
} from "./ai";

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

describe("scripts/ai model selection", () => {
  const envBackup = {
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_MODEL_ADVANCED: process.env.OPENAI_MODEL_ADVANCED,
    OPENAI_MODEL_HYBRID_ENABLED: process.env.OPENAI_MODEL_HYBRID_ENABLED,
    OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED:
      process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED,
    OPENAI_MODEL_HYBRID_SCORE_THRESHOLD: process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD,
  };

  beforeEach(() => {
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    process.env.OPENAI_MODEL_ADVANCED = "gpt-4.1";
    process.env.OPENAI_MODEL_HYBRID_ENABLED = "true";
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED = "true";
    process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD = "2";
  });

  afterAll(() => {
    process.env.OPENAI_MODEL = envBackup.OPENAI_MODEL;
    process.env.OPENAI_MODEL_ADVANCED = envBackup.OPENAI_MODEL_ADVANCED;
    process.env.OPENAI_MODEL_HYBRID_ENABLED = envBackup.OPENAI_MODEL_HYBRID_ENABLED;
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED =
      envBackup.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED;
    process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD = envBackup.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD;
  });

  it("selects premium model by default for generate operation", () => {
    const selected = selectScriptModelForPrompt({
      userPrompt: "quero uma versão premium com storytelling cinematográfico e tom de voz forte",
      operation: "generate",
    });

    expect(selected.tier).toBe("premium");
    expect(selected.model).toBe("gpt-4.1");
    expect(selected.reason).toBe("operation_generate_default");
    expect(selected.fallbackModel).toBe("gpt-4o-mini");
  });

  it("uses base model by default for adjust operation", () => {
    const selected = selectScriptModelForPrompt({
      userPrompt: "roteiro curto sobre produtividade",
      operation: "adjust",
    });

    expect(selected.tier).toBe("base");
    expect(selected.model).toBe("gpt-4o-mini");
    expect(selected.reason).toBe("operation_adjust_default");
  });

  it("keeps base model when hybrid mode is disabled", () => {
    process.env.OPENAI_MODEL_HYBRID_ENABLED = "false";

    const selected = selectScriptModelForPrompt({
      userPrompt: "quero uma versão premium e detalhada",
      operation: "adjust",
    });

    expect(selected.tier).toBe("base");
    expect(selected.model).toBe("gpt-4o-mini");
    expect(selected.reason).toBe("hybrid_disabled");
  });

  it("keeps legacy heuristic when operation routing is disabled", () => {
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED = "false";

    const selected = selectScriptModelForPrompt({
      userPrompt: "quero uma versão premium com storytelling cinematográfico",
      operation: "generate",
    });

    expect(selected.tier).toBe("premium");
    expect(selected.model).toBe("gpt-4.1");
    expect(selected.reason).toBe("explicit_intent");
    expect(selected.fallbackModel).toBe("gpt-4o-mini");
  });
});
