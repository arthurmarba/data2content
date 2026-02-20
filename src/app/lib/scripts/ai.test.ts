import {
  buildIntelligencePromptBlock,
  convertLegacyScriptToTechnical,
  evaluateTechnicalScriptQuality,
  enforceTechnicalScriptContract,
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

describe("scripts/ai technical contract", () => {
  it("repairs incomplete generation into technical script format", () => {
    const repaired = enforceTechnicalScriptContract(
      {
        title: "Roteiro curto",
        content: "Abertura rápida. Desenvolvimento. Fechamento.",
      },
      "roteiro sobre produtividade para reels"
    );

    expect(repaired.content).toContain("[ROTEIRO_TECNICO_V1]");
    expect(repaired.content).toContain("[/ROTEIRO_TECNICO_V1]");
    const scenes = repaired.content.match(/\[CENA\s+\d+:/gi) || [];
    expect(scenes.length).toBeGreaterThanOrEqual(4);
  });

  it("enforces explicit CTA in last scene", () => {
    const base = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-03s | Close | Gesto | Gancho | Eu vou te mostrar um ajuste simples agora | Ritmo alto |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 03-10s | Plano médio | Corte | Erro | Quando você ignora isso, seu resultado despenca | Tom didático |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 10-20s | Plano médio | Demonstração | Passos | Eu faço em dois passos para manter consistência | Cadência clara |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 20-30s | Close | Encerrar | Final | Isso organiza sua execução de conteúdo | Tom conclusivo |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Roteiro", content: base },
      "roteiro sobre produtividade"
    );

    const lastScene = repaired.content
      .split(/\[CENA 4: CTA\]/i)[1] || "";
    expect(lastScene).toMatch(/comente|salv[ae]|compartilhe|direct|dm|me chama|segue|link/i);
  });

  it("rewrites instructional speech into literal camera speech", () => {
    const base = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-03s | Close | Abertura | Gancho | Mostre o erro principal e apresente a solução. | Falar com energia |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 03-10s | Médio | Contexto | Dor | Explique em uma frase curta. | Tom didático |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 10-20s | Médio | Demonstração | Passos | Faça o passo um e depois passo dois. | Cadência firme |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 20-30s | Close | Final | CTA | Finalize com CTA. | Tom final |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Teste", content: base },
      "roteiro sobre vendas no instagram"
    );

    expect(repaired.content).not.toMatch(/\b(mostre|explique|fa[cç]a|finalize)\b/i);
  });

  it("converts legacy script text to technical format", () => {
    const converted = convertLegacyScriptToTechnical(
      "Gancho: pare de perder vendas.\nDesenvolvimento: ajuste a mensagem em 2 passos.\nCTA: comente quero.",
      "roteiro para vender mentoria"
    );

    expect(converted).toContain("[ROTEIRO_TECNICO_V1]");
    expect(converted).toContain("[CENA 1: GANCHO]");
    expect(converted).toContain("[CENA 4: CTA]");
  });

  it("computes higher perceived quality for polished technical script than weak script", () => {
    const weak = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-03s | ... | ... | ... | Mostre isso. | ... |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 03-10s | ... | ... | ... | Explique melhor. | ... |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 10-20s | ... | ... | ... | Faça em dois passos. | ... |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 20-30s | ... | ... | ... | Finalize com CTA. | ... |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");
    const polished = enforceTechnicalScriptContract(
      { title: "Roteiro", content: weak },
      "roteiro sobre produtividade para reels"
    );

    const weakScore = evaluateTechnicalScriptQuality(weak, "roteiro sobre produtividade para reels");
    const polishedScore = evaluateTechnicalScriptQuality(polished.content, "roteiro sobre produtividade para reels");

    expect(polishedScore.perceivedQuality).toBeGreaterThan(weakScore.perceivedQuality);
    expect(polishedScore.ctaStrength).toBeGreaterThan(0.7);
  });
});
