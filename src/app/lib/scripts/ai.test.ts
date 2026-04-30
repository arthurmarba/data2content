import {
  buildGenerateScriptPrompt,
  buildIntelligencePromptBlock,
  convertLegacyScriptToTechnical,
  evaluateTechnicalScriptQuality,
  extractAdjustIntentGuidance,
  enforceTechnicalScriptContract,
  resolveBlueprintDensityProfile,
  resolveEditorialAnchorTitle,
  sanitizeScriptIdentityLeakage,
  selectScriptModelForPrompt,
  selectScriptTemperature,
  shouldRunQualityPassForAdjustMode,
  TECHNICAL_SCRIPT_MAX_CHARS,
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
      engagementTiming: null,
      editorialDecision: {
        postDirective: "Poste um reels mostrando o erro antes da dica, com humor observável e virada útil.",
        narrativeAngle: "diagnóstico direto com cena reconhecível",
        recommendedStructure: "erro visível -> contexto real -> ajuste prático -> pergunta final",
        whyThisShouldWork: [
          "A combinação de humor_scene + career_work + humorous já performa bem nesse perfil.",
          "Os roteiros vencedores próximos repetem abertura curta e fechamento em pergunta.",
        ],
        evidence: [
          "proposal humor_scene | context career_work | tone humorous",
          "1 roteiro vencedor próximo do pedido.",
        ],
        postingWindow: null,
      },
      captionEvidence: [
        {
          metricId: "m1",
          caption: "Deixa eu te mostrar como simplificar isso hoje.",
          interactions: 120,
          postDate: null,
          categories: { proposal: "humor_scene" },
        },
      ],
      winningScriptExamples: [
        {
          scriptId: "script-1",
          title: "Roteiro que funcionou bem",
          opening: "Eu parei de começar pela dica.",
          development: "Agora eu abro nomeando o erro e só depois mostro o ajuste.",
          cta: "Qual parte mais falta no seu roteiro hoje?",
          lift: 1.7,
          interactions: 420,
          postDate: null,
        },
      ],
      relaxationLevel: 1,
      usedFallbackRules: false,
      linkedOutcome: {
        enabled: true,
        sampleSizeLinked: 8,
        confidence: "high",
        blendedApplied: true,
        topByDimension: {
          proposal: [{ id: "humor_scene", lift: 1.6, sampleSize: 8 }],
          context: [{ id: "career_work", lift: 1.5, sampleSize: 8 }],
          format: [{ id: "reel", lift: 1.4, sampleSize: 8 }],
        },
        topExamples: [
          {
            metricId: "m-link-1",
            scriptId: "script-1",
            caption: "Quando eu simplifiquei meu processo, o resultado subiu.",
            score: 1.7,
            lift: 1.7,
            hookSample: "Quando eu simplifiquei...",
            ctaSample: "Comenta EU QUERO",
          },
        ],
      },
    });

    expect(block).toContain("Perfil de estilo do usuario");
    expect(block).toContain("Amostra de roteiros: 12");
    expect(block).toContain("Imite o estilo do criador sem copiar frases literalmente.");
    expect(block).toContain("Sinais de roteiros vinculados vencedores");
    expect(block).toContain("Playbook acionável do perfil");
    expect(block).toContain("Decisão editorial recomendada");
    expect(block).toContain("O que postar:");
    expect(block).toContain("diagnóstico concreto + ajuste aplicável + prova");
    expect(block).toContain("Roteiros reais do perfil que performaram bem");
  });

  it("keeps the intelligence prompt block within a bounded size", () => {
    const block = buildIntelligencePromptBlock({
      intelligenceVersion: "scripts_intelligence_v2",
      promptMode: "open",
      intent: { wantsHumor: false, wantsEngagement: true, subjectHint: "retenção de reels" },
      metricUsed: "avg_total_interactions",
      lookbackDays: 180,
      explicitCategories: {},
      resolvedCategories: {
        proposal: "tips",
        context: "career_work",
        format: "reel",
        tone: "educational",
        references: "pop_culture",
      },
      rankedCategories: {
        proposal: ["tips"],
        context: ["career_work"],
        format: ["reel"],
        tone: ["educational"],
        references: ["pop_culture"],
      },
      dnaProfile: {
        sampleSize: 12,
        hasEnoughEvidence: true,
        averageSentenceLength: 10,
        emojiDensity: 0.01,
        openingPatterns: ["eu parei de", "o erro é"],
        ctaPatterns: ["comentario", "salvar"],
        recurringExpressions: ["abertura", "retenção", "ajuste", "roteiro"],
        writingGuidelines: [
          "Use frases curtas.",
          "Abra com diagnóstico concreto.",
          "Mostre ajuste aplicável.",
          "Feche com CTA conversacional.",
        ],
      },
      styleProfile: {
        profileVersion: "scripts_style_profile_v1",
        sampleSize: 20,
        hasEnoughEvidence: true,
        writingGuidelines: [
          "Use frases curtas e diretas.",
          "Abra com observação concreta.",
          "Evite tese abstrata.",
          "Feche convidando resposta real.",
          "Mantenha ritmo rápido.",
        ],
        styleSignalsUsed: {
          hookPatterns: ["eu parei de", "o erro é", "foi quando eu percebi"],
          ctaPatterns: ["comentario", "salvar", "me conta"],
          humorMarkers: [],
          recurringExpressions: ["abertura", "retenção", "roteiro", "ajuste"],
          avgSentenceLength: 10,
          emojiDensity: 0.01,
          narrativeCadence: {
            openingAvgChars: 80,
            developmentAvgChars: 220,
            closingAvgChars: 90,
          },
        },
        styleExamples: Array.from({ length: 12 }, (_, index) => `Exemplo de estilo ${index + 1} com bastante detalhe e contexto.`),
      },
      styleProfileVersion: "scripts_style_profile_v1",
      styleSampleSize: 20,
      engagementTiming: {
        sampleSize: 4,
        timezone: "America/Sao_Paulo",
        topHours: [19, 21],
        topWeekdays: ["ter", "qui"],
        summary: "dias com mais recorrência: ter e qui | horários com mais recorrência: 19h e 21h",
      },
      editorialDecision: {
        postDirective: "Poste um reels sobre retenção de reels pelo ângulo do erro de abertura antes da dica.",
        narrativeAngle: "diagnóstico do erro antes do ajuste",
        recommendedStructure: "erro visível -> contexto observável -> ajuste aplicável -> CTA específico",
        whyThisShouldWork: [
          "As categorias vencedoras do perfil apontam para tips + career_work + educational.",
          "Os roteiros fortes desse tema repetem explicação prática com linguagem curta.",
          "Existe recorrência em ter/qui às 19h e 21h.",
        ],
        evidence: [
          "proposal tips | context career_work | tone educational",
          "4 roteiros vencedores próximos do pedido.",
          "10 legendas fortes consideradas.",
        ],
        postingWindow: "dias com mais recorrência: ter e qui | horários com mais recorrência: 19h e 21h",
      },
      captionEvidence: Array.from({ length: 10 }, (_, index) => ({
        metricId: `m-${index + 1}`,
        caption: `Legenda ${index + 1} com detalhe prático sobre abertura, diagnóstico e ajuste de retenção.`,
        interactions: 200 + index * 10,
        postDate: index < 4 ? `2026-04-0${(index % 4) + 1}T22:00:00.000Z` : null,
        categories: { proposal: "tips" },
      })),
      winningScriptExamples: Array.from({ length: 4 }, (_, index) => ({
        scriptId: `script-${index + 1}`,
        title: `Roteiro vencedor ${index + 1}`,
        opening: "Seu reels já começa fraco quando abre sem diagnóstico.",
        development: "Eu faço em três linhas: erro, ajuste e prova.",
        cta: "Qual dessas partes mais falta no seu roteiro hoje?",
        lift: 1.8 - index * 0.1,
        interactions: 400 + index * 20,
        postDate: null,
      })),
      relaxationLevel: 1,
      usedFallbackRules: false,
      linkedOutcome: {
        enabled: true,
        sampleSizeLinked: 10,
        confidence: "high",
        blendedApplied: true,
        topByDimension: {
          proposal: [{ id: "tips", lift: 1.6, sampleSize: 10 }],
        },
        topExamples: Array.from({ length: 4 }, (_, index) => ({
          metricId: `linked-${index + 1}`,
          scriptId: `script-${index + 1}`,
          caption: `Exemplo vinculado ${index + 1} sobre retenção, abertura e ajuste prático.`,
          score: 1.7,
          lift: 1.7,
          hookSample: "Seu reels já nasce sem diagnóstico.",
          ctaSample: "Qual parte mais falta no seu roteiro hoje?",
          categories: { proposal: "tips", context: "career_work" },
        })),
      },
    });

    expect(block.length).toBeLessThanOrEqual(3400);
    expect(block).toContain("Playbook acionável do perfil");
    expect(block).toContain("Decisão editorial recomendada");
  });
});

describe("scripts/ai model selection", () => {
  const envBackup = {
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_MODEL_ADVANCED: process.env.OPENAI_MODEL_ADVANCED,
    OPENAI_MODEL_HYBRID_ENABLED: process.env.OPENAI_MODEL_HYBRID_ENABLED,
    OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED:
      process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED,
    OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED:
      process.env.OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED,
    OPENAI_MODEL_HYBRID_SCORE_THRESHOLD: process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD,
  };

  beforeEach(() => {
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    process.env.OPENAI_MODEL_ADVANCED = "gpt-4o";
    process.env.OPENAI_MODEL_HYBRID_ENABLED = "true";
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED = "true";
    process.env.OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED = "true";
    process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD = "2";
  });

  afterAll(() => {
    process.env.OPENAI_MODEL = envBackup.OPENAI_MODEL;
    process.env.OPENAI_MODEL_ADVANCED = envBackup.OPENAI_MODEL_ADVANCED;
    process.env.OPENAI_MODEL_HYBRID_ENABLED = envBackup.OPENAI_MODEL_HYBRID_ENABLED;
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED =
      envBackup.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED;
    process.env.OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED =
      envBackup.OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED;
    process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD = envBackup.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD;
  });

  it("selects premium model by default for generate operation", () => {
    const selected = selectScriptModelForPrompt({
      userPrompt: "quero uma versão premium com storytelling cinematográfico e tom de voz forte",
      operation: "generate",
    });

    expect(selected.tier).toBe("premium");
    expect(selected.model).toBe("gpt-4o");
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

  it("selects premium model by default for rewrite adjust operation", () => {
    const selected = selectScriptModelForPrompt({
      userPrompt: "reescreva esse roteiro por completo com storytelling mais forte",
      operation: "adjust",
      adjustMode: "rewrite_full",
    });

    expect(selected.tier).toBe("premium");
    expect(selected.model).toBe("gpt-4o");
    expect(selected.reason).toBe("operation_adjust_rewrite_default");
    expect(selected.fallbackModel).toBe("gpt-4o-mini");
  });

  it("keeps base model for rewrite adjust when premium rewrite routing is disabled", () => {
    process.env.OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED = "false";
    const selected = selectScriptModelForPrompt({
      userPrompt: "reescreva esse roteiro por completo com storytelling mais forte",
      operation: "adjust",
      adjustMode: "rewrite_full",
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
    expect(selected.model).toBe("gpt-4o");
    expect(selected.reason).toBe("explicit_intent");
    expect(selected.fallbackModel).toBe("gpt-4o-mini");
  });
});

describe("scripts/ai adjust quality pass routing", () => {
  it("enables quality pass only for rewrite/full new-script adjust modes", () => {
    expect(shouldRunQualityPassForAdjustMode("patch")).toBe(false);
    expect(shouldRunQualityPassForAdjustMode("rewrite_full")).toBe(true);
    expect(shouldRunQualityPassForAdjustMode("new_script")).toBe(true);
  });
});

describe("scripts/ai temperature selection", () => {
  const envBackup = {
    OPENAI_TEMP: process.env.OPENAI_TEMP,
    OPENAI_TEMP_GENERATE: process.env.OPENAI_TEMP_GENERATE,
    OPENAI_TEMP_ADJUST: process.env.OPENAI_TEMP_ADJUST,
    OPENAI_TEMP_ADJUST_PATCH: process.env.OPENAI_TEMP_ADJUST_PATCH,
    OPENAI_TEMP_ADJUST_REWRITE: process.env.OPENAI_TEMP_ADJUST_REWRITE,
  };

  beforeEach(() => {
    delete process.env.OPENAI_TEMP;
    delete process.env.OPENAI_TEMP_GENERATE;
    delete process.env.OPENAI_TEMP_ADJUST;
    delete process.env.OPENAI_TEMP_ADJUST_PATCH;
    delete process.env.OPENAI_TEMP_ADJUST_REWRITE;
  });

  afterAll(() => {
    process.env.OPENAI_TEMP = envBackup.OPENAI_TEMP;
    process.env.OPENAI_TEMP_GENERATE = envBackup.OPENAI_TEMP_GENERATE;
    process.env.OPENAI_TEMP_ADJUST = envBackup.OPENAI_TEMP_ADJUST;
    process.env.OPENAI_TEMP_ADJUST_PATCH = envBackup.OPENAI_TEMP_ADJUST_PATCH;
    process.env.OPENAI_TEMP_ADJUST_REWRITE = envBackup.OPENAI_TEMP_ADJUST_REWRITE;
  });

  it("uses lower default temperature for adjust patch mode", () => {
    process.env.OPENAI_TEMP = "0.4";
    const selected = selectScriptTemperature({ operation: "adjust", adjustMode: "patch" });
    expect(selected).toBe(0.25);
  });

  it("uses higher default temperature for adjust rewrite mode", () => {
    process.env.OPENAI_TEMP = "0.4";
    const selected = selectScriptTemperature({ operation: "adjust", adjustMode: "rewrite_full" });
    expect(selected).toBe(0.45);
  });

  it("prefers explicit env overrides for generate and adjust temperatures", () => {
    process.env.OPENAI_TEMP = "0.33";
    process.env.OPENAI_TEMP_GENERATE = "0.52";
    process.env.OPENAI_TEMP_ADJUST = "0.29";
    process.env.OPENAI_TEMP_ADJUST_PATCH = "0.18";
    process.env.OPENAI_TEMP_ADJUST_REWRITE = "0.61";

    expect(selectScriptTemperature({ operation: "generate" })).toBe(0.52);
    expect(selectScriptTemperature({ operation: "adjust" })).toBe(0.29);
    expect(selectScriptTemperature({ operation: "adjust", adjustMode: "patch" })).toBe(0.18);
    expect(selectScriptTemperature({ operation: "adjust", adjustMode: "new_script" })).toBe(0.61);
  });
});

describe("scripts/ai prompt quality guidance", () => {
  it("builds generation prompt with human narrative guidance", () => {
    const prompt = buildGenerateScriptPrompt({
      prompt: "roteiro sobre manter frequência na academia",
      intelligenceContext: null,
    });

    expect(prompt).toContain("Utilidade prática obrigatória");
    expect(prompt).toContain("1 diagnóstico concreto e 1 ajuste aplicável");
    expect(prompt).toContain("plano prático de gravação");
    expect(prompt).toContain("como gravar");
    expect(prompt.toLowerCase()).toContain("frase-exemplo opcional");
    expect(prompt).toContain('Por que assim:');
    expect(prompt).toContain("Qualidade narrativa obrigatória");
    expect(prompt).toContain("confissão");
    expect(prompt).toContain("dor/tensão real");
    expect(prompt).toContain("motivo humano/prova");
    expect(prompt).toContain("CTA natural, conversacional e específico");
    expect(prompt).toContain("Resposta compacta");
    expect(prompt).toContain("O blueprint completo deve caber idealmente");
    expect(prompt).toContain("Antes de descrever as cenas");
    expect(prompt).toContain("categorias vencedoras");
    expect(prompt).toContain("O que postar:");
    expect(prompt).toContain("Como esse vídeo deve funcionar:");
    expect(prompt).toContain("evidência concreta do perfil");
    expect(prompt).toContain("1 frase curta e densa");
    expect(prompt).toContain("Densidade do blueprint:");
    expect(prompt).toContain("Use 4 cenas por padrão");
  });

  it("opens room for 5 scenes only when the prompt asks for more direction", () => {
    const profile = resolveBlueprintDensityProfile(
      "quero um roteiro mais detalhado, com mais direção prática e passo a passo sobre retenção"
    );
    const prompt = buildGenerateScriptPrompt({
      prompt: "quero um roteiro mais detalhado, com mais direção prática e passo a passo sobre retenção",
      intelligenceContext: null,
    });

    expect(profile.preferredSceneCount).toBe(5);
    expect(profile.maxSceneCount).toBe(6);
    expect(prompt).toContain("Abra para 5 cenas");
    expect(prompt).toContain("Nunca ultrapasse 6 cenas neste pedido");
  });

  it("builds generation prompt with explicit winner-based guidance", () => {
    const prompt = buildGenerateScriptPrompt({
      prompt: "escreva um roteiro com base no que mais engaja no meu perfil",
      intelligenceContext: {
        intent: {
          wantsHumor: false,
          wantsEngagement: true,
          subjectHint: null,
          wantsWinnerBasedScript: true,
          wantsTopicDrivenScript: false,
        },
      } as any,
    });

    expect(prompt).toContain("Use como espinha dorsal o que já mais performa no perfil do criador");
    expect(prompt).toContain("prefira o repertório vencedor");
  });

  it("includes timing and strategic rationale signals when available", () => {
    const prompt = buildGenerateScriptPrompt({
      prompt: "quero um roteiro sobre retenção de reels",
      intelligenceContext: {
        intent: {
          wantsHumor: false,
          wantsEngagement: true,
          subjectHint: "retenção de reels",
          wantsWinnerBasedScript: true,
          wantsTopicDrivenScript: true,
        },
        resolvedCategories: {
          proposal: "tips",
          context: "career_work",
          format: "reel",
          tone: "educational",
        },
        metricUsed: "avg_total_interactions",
        lookbackDays: 180,
        promptMode: "open",
        explicitCategories: {},
        rankedCategories: {},
        dnaProfile: {
          sampleSize: 8,
          hasEnoughEvidence: true,
          averageSentenceLength: 10,
          emojiDensity: 0.01,
          openingPatterns: ["eu parei de"],
          ctaPatterns: ["me conta"],
          recurringExpressions: ["retenção"],
          writingGuidelines: ["Use frases curtas."],
        },
        styleProfile: null,
        styleProfileVersion: null,
        styleSampleSize: 0,
        engagementTiming: {
          sampleSize: 4,
          timezone: "America/Sao_Paulo",
          topHours: [19, 21],
          topWeekdays: ["ter", "qui"],
          summary: "dias com mais recorrência: ter e qui | horários com mais recorrência: 19h e 21h",
        },
        captionEvidence: [],
        winningScriptExamples: [],
        relaxationLevel: 1,
        usedFallbackRules: false,
        linkedOutcome: null,
      } as any,
    });

    expect(prompt).toContain("horários com mais recorrência");
    expect(prompt).toContain("categorias, narrativa vencedora, tom, formato, lift, volume de exemplos ou horário/janela");
  });

  it("builds generation prompt with explicit topic guidance", () => {
    const prompt = buildGenerateScriptPrompt({
      prompt: "quero um roteiro sobre manter frequência na academia",
      intelligenceContext: {
        intent: {
          wantsHumor: false,
          wantsEngagement: false,
          subjectHint: "manter frequência na academia",
          wantsWinnerBasedScript: false,
          wantsTopicDrivenScript: true,
        },
      } as any,
    });

    expect(prompt).toContain("O tema principal deste roteiro é: manter frequência na academia");
    expect(prompt).toContain("Não trate o assunto de forma genérica");
  });

  it("uses saved title as editorial anchor when available", () => {
    const prompt = buildGenerateScriptPrompt({
      prompt: "quero um roteiro sobre manter frequência na academia",
      title: "O ritual que me fez treinar sem depender de motivação",
      intelligenceContext: null,
    });

    expect(prompt).toContain("Título âncora do roteiro: O ritual que me fez treinar sem depender de motivação");
    expect(prompt).toContain("Esse título já veio salvo pelo usuário");
    expect(resolveEditorialAnchorTitle({
      prompt: "quero um roteiro sobre manter frequência na academia",
      title: "O ritual que me fez treinar sem depender de motivação",
      intelligenceContext: null,
    })).toBe("O ritual que me fez treinar sem depender de motivação");
  });

  it("derives a working anchor title when the script has no title", () => {
    const anchor = resolveEditorialAnchorTitle({
      prompt: "quero um roteiro sobre retenção de reels",
      intelligenceContext: null,
    });

    expect(anchor).toContain("retenção");
  });

  it("extracts incremental adjust guidance for 'ser mais...'", () => {
    const guidance = extractAdjustIntentGuidance(
      "quero que voce ajuste esse roteiro pra ser mais humano e menos publicitário"
    );

    expect(guidance).toContain("O atributo principal pedido pelo usuário é");
    expect(guidance).toContain("humano e menos publicitário");
    expect(guidance).toContain("Intensifique esse atributo");
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

    expect(repaired.content).toMatch(/\[ROTEIRO (TÉCNICO V1 — FORMATO DE FLUXO|COPY-FIRST V1)\]/);
    expect(repaired.content).toMatch(/\[\/ROTEIRO (TÉCNICO V1 — FORMATO DE FLUXO|COPY-FIRST V1)\]/);
    const scenes = repaired.content.match(/^\s*CENA\s+\d+:/gim) || [];
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

    const lastSceneStart = repaired.content.search(/^CENA 4:/im);
    const lastScene = lastSceneStart >= 0 ? repaired.content.slice(lastSceneStart) : repaired.content;
    expect(lastScene).toMatch(/comente|salv[ae]|compartilhe|direct|dm|me chama|segue|link|me conta|e voc[eê]|qual foi/i);
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

  it("preserves concise human hook when it is already camera-ready", () => {
    const base = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto.",
      "",
      'Fala: "Você não tá travado."',
      "",
      "Direção: Tom direto e confiante.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Rotina corrida.",
      "",
      'Fala: "Você só está repetindo um formato que já perdeu força."',
      "",
      "Direção: Tom íntimo.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostra o ajuste no celular.",
      "",
      'Fala: "Quando eu mudei a abertura, a retenção mudou junto."',
      "",
      "Direção: Cadência clara.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela: E VOCÊ?",
      "",
      'Fala: "E você, qual abertura mais funciona no seu perfil hoje? Me conta aqui."',
      "",
      "Direção: Curioso e leve.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Teste", content: base },
      "roteiro sobre retenção para reels"
    );

    expect(repaired.content).toContain('Fala: "Você não tá travado."');
  });

  it("converts legacy script text to technical format", () => {
    const converted = convertLegacyScriptToTechnical(
      "Gancho: pare de perder vendas.\nDesenvolvimento: ajuste a mensagem em 2 passos.\nCTA: comente quero.",
      "roteiro para vender mentoria"
    );

    expect(converted).toMatch(/\[ROTEIRO (TÉCNICO V1 — FORMATO DE FLUXO|COPY-FIRST V1)\]/);
    expect(converted).toContain("O que postar:");
    expect(converted).toContain("Por que postar assim:");
    expect(converted).toContain("CENA 1: O GANCHO");
    expect(converted).toContain("CENA 4: CHAMADA PARA AÇÃO");
  });

  it("preserves or injects editorial direction before the scenes", () => {
    const repaired = enforceTechnicalScriptContract(
      {
        title: "Roteiro editorial",
        content: [
          "[ROTEIRO_TECNICO_V1]",
          "O que postar: Reels sobre o erro que derruba retenção antes da dica.",
          "Por que postar assim: Esse recorte costuma funcionar melhor no perfil quando abre pelo atrito real.",
          "Quando postar: Priorizar a janela recorrente do perfil quando esse tema entrar na fila.",
          "Como esse vídeo deve funcionar: erro visível -> contexto real -> ajuste -> pergunta final.",
          "[CENA 1: GANCHO]",
          "Visual: Close no rosto com comentário na tela.",
          'Fala: "Seu reels não morre no meio. Ele já nasce sem diagnóstico."',
          "Direção: Tom direto e preciso.",
          "[CENA 2: CONTEXTO]",
          "Visual: Mostrar o atrito no celular.",
          'Fala: "O erro é abrir já com a dica."',
          "Direção: Didático e ágil.",
          "[CENA 3: DEMONSTRAÇÃO]",
          "Visual: Mostrar a estrutura em três linhas.",
          'Fala: "Primeiro o erro, depois o ajuste, depois a prova."',
          "Direção: Cadência clara.",
          "[CENA 4: CTA]",
          "Visual: Texto na tela: QUAL PARTE FALTA?",
          'Fala: "Qual parte mais falta no seu conteúdo hoje? Me conta aqui."',
          "Direção: Curioso e conversacional.",
          "[/ROTEIRO_TECNICO_V1]",
        ].join("\n"),
      },
      "roteiro sobre retenção de reels"
    );

    expect(repaired.content).toContain("O que postar: Reels sobre o erro que derruba retenção antes da dica.");
    expect(repaired.content).toContain("Por que postar assim:");
    expect(repaired.content).toContain("Quando postar:");
    expect(repaired.content).toContain("Como esse vídeo deve funcionar:");
    expect(repaired.content.indexOf("O que postar:")).toBeLessThan(repaired.content.indexOf("CENA 1:"));
  });

  it("uses evidence-backed editorial rationale when intelligence context is available", () => {
    const repaired = enforceTechnicalScriptContract(
      {
        title: "Roteiro com evidência",
        content: [
          "[ROTEIRO_TECNICO_V1]",
          "[CENA 1: GANCHO]",
          "Visual: Close no rosto com comentário na tela.",
          'Fala: "Seu reels não morre no meio. Ele já nasce sem diagnóstico."',
          "Direção: Tom direto. Por que assim: abertura curta prende mais atenção.",
          "[CENA 2: CONTEXTO]",
          "Visual: Mostrar o atrito no celular.",
          'Fala: "O erro é abrir pela dica antes do problema."',
          "Direção: Didático e rápido. Por que assim: contexto visual deixa o erro claro.",
          "[CENA 3: DEMONSTRAÇÃO]",
          "Visual: Mostrar a estrutura em três linhas.",
          'Fala: "Primeiro o erro, depois o ajuste, depois a prova."',
          "Direção: Cadência clara. Por que assim: método simples aumenta utilidade.",
          "[CENA 4: CTA]",
          "Visual: Texto na tela: QUAL PARTE FALTA?",
          'Fala: "Qual parte mais falta no seu conteúdo hoje? Me conta aqui."',
          "Direção: Curioso e conversacional. Por que assim: pergunta específica gera comentário melhor.",
          "[/ROTEIRO_TECNICO_V1]",
        ].join("\n"),
      },
      "roteiro sobre retenção de reels",
      {
        editorialDecision: {
          postDirective: "Poste um reels sobre retenção pelo ângulo do erro de abertura antes da dica.",
          narrativeAngle: "diagnóstico direto do erro antes da dica",
          recommendedStructure: "erro visível -> contexto observável -> ajuste aplicável -> pergunta específica no fechamento",
          whyThisShouldWork: [
            "No histórico recente, Tips + Trabalho + Educacional aparece como combinação forte para esse tema.",
            "3 roteiro(s) vencedor(es) próximo(s) repetem diagnóstico direto do erro antes da dica e a proposal líder chega a lift 1.40.",
          ],
          evidence: [
            "proposal tips | context career_work | tone educational",
            "3 roteiro(s) vencedor(es) próximos; principal exemplo: Abertura de reels.",
            "Timing observado: dias com mais recorrência: ter e qui | horários com mais recorrência: 19h e 21h.",
          ],
          postingWindow: "dias com mais recorrência: ter e qui | horários com mais recorrência: 19h e 21h",
        },
      }
    );

    expect(repaired.content).toContain("Por que postar assim:");
    expect(repaired.content).toContain("Tips + Trabalho + Educacional");
    expect(repaired.content).toContain("Quando postar: ter/qui, 19h/21h");
    expect(repaired.content).toContain("Ângulo: diagnóstico direto do erro antes da dica.");

    const editorialLines = repaired.content
      .split("\n")
      .filter((line) => /^(O que postar|Por que postar assim|Quando postar|Como esse vídeo deve funcionar):/i.test(line));

    expect(editorialLines).toHaveLength(4);
    expect(editorialLines.every((line) => line.length <= 170)).toBe(true);
  });

  it("uses a sane fallback topic for winner-based prompts without explicit subject", () => {
    const converted = convertLegacyScriptToTechnical(
      "",
      "escreva um roteiro com base no que mais engaja no meu perfil"
    );

    expect(converted.toLowerCase()).toContain("o que ja funciona no seu perfil");
    expect(converted.toLowerCase()).not.toContain("mais engaja no meu perfil");
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
    expect(polishedScore.ctaStrength).toBeGreaterThan(weakScore.ctaStrength);
  });

  it("rewards conversational CTA over robotic CTA", () => {
    const robotic = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto.",
      "",
      'Fala: "Eu só consegui manter consistência quando parei de complicar o processo."',
      "",
      "Direção: Tom direto e humano.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostra a rotina corrida.",
      "",
      'Fala: "Quando tudo vira obrigação, a frequência some primeiro."',
      "",
      "Direção: Tom íntimo.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostra o ritual antes de treinar.",
      "",
      'Fala: "Então eu criei um ritual simples pra facilitar a ida pra academia."',
      "",
      "Direção: Didático e leve.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela: COMENTE.",
      "",
      'Fala: "Comente aqui agora."',
      "",
      "Direção: Final objetivo.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const conversational = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto.",
      "",
      'Fala: "Eu só consegui manter consistência quando parei de complicar o processo."',
      "",
      "Direção: Tom direto e humano.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostra a rotina corrida.",
      "",
      'Fala: "Quando tudo vira obrigação, a frequência some primeiro."',
      "",
      "Direção: Tom íntimo.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostra o ritual antes de treinar.",
      "",
      'Fala: "Então eu criei um ritual simples pra facilitar a ida pra academia."',
      "",
      "Direção: Didático e leve.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela: E VOCÊ?",
      "",
      'Fala: "E você, qual foi o truque que mais te ajudou a manter frequência? Me conta aqui embaixo."',
      "",
      "Direção: Curioso e conversacional.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const roboticScore = evaluateTechnicalScriptQuality(robotic, "roteiro sobre manter frequência na academia");
    const conversationalScore = evaluateTechnicalScriptQuality(conversational, "roteiro sobre manter frequência na academia");

    expect(conversationalScore.ctaStrength).toBeGreaterThan(roboticScore.ctaStrength);
    expect(conversationalScore.perceivedQuality).toBeGreaterThan(roboticScore.perceivedQuality);
  });

  it("rewards scripts with practical utility over abstract scripts", () => {
    const abstract = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto.",
      "",
      'Fala: "Se você quer melhorar, precisa mudar sua mentalidade."',
      "",
      "Direção: Tom sério.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Fundo neutro.",
      "",
      'Fala: "O crescimento exige visão estratégica e energia certa para continuar."',
      "",
      "Direção: Tom professoral.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Gesticulando para câmera.",
      "",
      'Fala: "Quando você entende isso, tudo começa a fazer mais sentido."',
      "",
      "Direção: Ritmo constante.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela: COMENTA.",
      "",
      'Fala: "Comenta aqui agora."',
      "",
      "Direção: Final direto.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const practical = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto.",
      "",
      'Fala: "Seu conteúdo não tá fraco. Ele só abre sem diagnóstico."',
      "",
      "Direção: Tom direto.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostra o roteiro no celular.",
      "",
      'Fala: "O erro é começar pela dica. Primeiro você nomeia o atrito que a pessoa sente hoje."',
      "",
      "Direção: Didático e rápido.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Aponta três linhas escritas.",
      "",
      'Fala: "Eu faço assim: linha 1 com o erro, linha 2 com o ajuste, linha 3 com a prova de que funciona."',
      "",
      "Direção: Cadência clara com gesto de contagem.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela: QUAL AJUSTE?",
      "",
      'Fala: "Qual dessas três linhas mais falta no seu roteiro hoje? Me conta aqui."',
      "",
      "Direção: Curioso e leve.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const abstractScore = evaluateTechnicalScriptQuality(abstract, "roteiro sobre melhorar conteúdo");
    const practicalScore = evaluateTechnicalScriptQuality(practical, "roteiro sobre melhorar conteúdo");

    expect(practicalScore.utilityScore).toBeGreaterThan(abstractScore.utilityScore);
    expect(practicalScore.perceivedQuality).toBeGreaterThan(abstractScore.perceivedQuality);
  });

  it("rewards filmable blueprints over vague scene descriptions", () => {
    const vague = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Mostrar alguma coisa.",
      "",
      'Fala: "Falar de um jeito interessante sobre o tema."',
      "",
      "Direção: Boa energia.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostrar o contexto.",
      "",
      'Fala: "Explicar o problema de forma geral."',
      "",
      "Direção: Ser claro.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostrar a solução.",
      "",
      'Fala: "Explicar o ajuste."',
      "",
      "Direção: Tom didático.",
      "",
      "[CENA 4: CTA]",
      "Visual: Fechamento.",
      "",
      'Fala: "Me conta aqui."',
      "",
      "Direção: Final leve.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const shootable = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto, câmera parada na altura dos olhos e texto na tela destacando o erro principal.",
      "",
      'Fala: "Abrir nomeando o erro que trava a rotina. Frase-exemplo opcional: eu só voltei a ter frequência quando parei de decidir tudo em cima da hora."',
      "",
      "Direção: Tom de confissão segura, ritmo firme e micro-pausa antes da virada.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostrar a mochila pronta perto da porta e o celular com o horário travado.",
      "",
      'Fala: "Explicar o atrito real: toda decisão extra vira desculpa e consome energia antes do treino."',
      "",
      "Direção: Íntimo, direto e com gesto curto apontando para os objetos.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostrar roupa, garrafa e alarme em sequência com cortes curtos.",
      "",
      'Fala: "Descrever o ritual prático: separar os itens na noite anterior e deixar a ida automática."',
      "",
      "Direção: Didático, cadência clara e câmera acompanhando os objetos.",
      "",
      "[CENA 4: CTA]",
      "Visual: Retorno para o rosto com texto na tela: QUAL PARTE TE TRAVA?",
      "",
      'Fala: "Fechar perguntando qual parte da rotina ainda depende de motivação. CTA sugerido: me conta aqui que eu posso aprofundar a próxima."',
      "",
      "Direção: Curioso, leve e com sorriso curto no final.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const vagueScore = evaluateTechnicalScriptQuality(vague, "roteiro sobre manter frequência na academia");
    const shootableScore = evaluateTechnicalScriptQuality(shootable, "roteiro sobre manter frequência na academia");

    expect(shootableScore.shootabilityScore).toBeGreaterThan(vagueScore.shootabilityScore);
    expect(shootableScore.perceivedQuality).toBeGreaterThan(vagueScore.perceivedQuality);
  });

  it("prevents duplicate CTA headings when script has 5 scenes", () => {
    const duplicatedCta = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-06s | Close | Abertura | Gancho | Se você quer melhorar seu conteúdo, fica comigo até o fim. | Ritmo alto |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 07-15s | Médio | Explicação | Contexto | O principal erro é pular a estrutura e começar sem direção clara. | Tom didático |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 16-25s | Médio | Exemplo | Passos | Eu faço em dois passos simples para manter clareza e ritmo. | Cadência firme |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 26-32s | Close | Fechamento | Compartilhe | Se você curtiu, já compartilha esse vídeo agora. | Tom conclusivo |",
      "[CENA 5: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 33-40s | Médio | Encerrar | Comente | Comenta quero para eu te mandar a próxima parte. | Tom convidativo |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Roteiro", content: duplicatedCta },
      "roteiro sobre produtividade para reels"
    );

    const ctaHeadings = repaired.content.match(/^CENA\s+\d+:\s*CHAMADA PARA AÇÃO\b/gim) || [];
    expect(ctaHeadings).toHaveLength(1);
    expect(repaired.content).toContain("CENA 4: A PROVA");
    expect(repaired.content).toContain("CENA 5: CHAMADA PARA AÇÃO");
  });

  it("renders readable flow blocks for each scene", () => {
    const longScript = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-06s | Close no rosto | Entrada rápida com gesto de mão e micro-pausa antes da frase principal com transição para a fala central. | PARE DE ERRAR: CONTEÚDOS DA ANITTA E ESTRATÉGIA DE ENGAJAMENTO | Se você quer destravar os conteúdos da Anitta com uma estrutura que realmente aumenta retenção e conexão, fica comigo até o final porque esse ajuste muda tudo. | Energia alta, olhar direto na câmera, sorriso confiante e pausa intencional antes da frase de impacto final. |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 07-15s | Meio-corpo | Mãos gesticulando, postura aberta com alternância de ponto de foco para manter dinâmica. | Conteúdo, lifestyle e música com posicionamento | Quando ela mistura bastidores, rotina e narrativa de carreira, o público enxerga autenticidade e responde com mais atenção ao conteúdo. | Tom descritivo, ritmo médio, expressividade leve e dicção clara nas palavras-chave. |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 16-25s | Plano médio | Mostra no celular exemplos reais com cortes rápidos para evidenciar o padrão de narrativa visual. | Gravação, bastidores e autenticidade em prática | Repara como ela alterna conquista, processo e vulnerabilidade no mesmo bloco, gerando identificação sem parecer forçado. | Dinâmico, alternar olhar entre celular e câmera, mantendo tom explicativo e preciso. |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 26-34s | Close | Fechamento com gesto curto de confirmação. | Comente e compartilhe | Se isso te ajudou, comenta quero e compartilha com alguém que também quer melhorar conteúdo agora. | Tom conclusivo, sorriso leve, pausa antes da chamada para ação. |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Roteiro", content: longScript },
      "roteiro sobre conteúdos da Anitta para reels"
    );

    expect(repaired.content).toMatch(/\nVisual:\s+/);
    expect(repaired.content).toMatch(/\nDireção:\s+/);
    expect(repaired.content).toMatch(/\nFala:\s*"/);
  });

  it("compacts verbose blueprint scenes to stay within response budget", () => {
    const repeatedVisual =
      "Close no rosto com celular na mão, apontando para a tela, depois mostrando cenário, gesto, luz, enquadramento e repetindo a mesma explicação visual para alongar a cena sem necessidade prática real. ";
    const repeatedSpeech =
      "Explicar em detalhes longos demais o que precisa ser comunicado, repetindo a mesma ideia de erro, ajuste, prova e contexto várias vezes, como se fosse um mini texto corrido em vez de uma orientação enxuta para gravação. ";
    const repeatedDirection =
      "Tom direto, ritmo firme, pausa curta, olhar na lente e gesto com a mão para marcar a virada. Por que assim: no perfil, esse tipo de construção costuma gerar mais retenção, clareza, identificação, repetição de comentário e sensação de utilidade quando a narrativa é objetiva e muito bem encaixada no histórico do criador. ";

    const verbose = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      `Visual: ${repeatedVisual.repeat(3)}`,
      "",
      `Fala: "${repeatedSpeech.repeat(3)}"`,
      "",
      `Direção: ${repeatedDirection.repeat(2)}`,
      "",
      "[CENA 2: CONTEXTO]",
      `Visual: ${repeatedVisual.repeat(3)}`,
      "",
      `Fala: "${repeatedSpeech.repeat(3)}"`,
      "",
      `Direção: ${repeatedDirection.repeat(2)}`,
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      `Visual: ${repeatedVisual.repeat(3)}`,
      "",
      `Fala: "${repeatedSpeech.repeat(3)}"`,
      "",
      `Direção: ${repeatedDirection.repeat(2)}`,
      "",
      "[CENA 4: CTA]",
      `Visual: ${repeatedVisual.repeat(2)}`,
      "",
      `Fala: "${repeatedSpeech.repeat(2)}"`,
      "",
      `Direção: ${repeatedDirection.repeat(2)}`,
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Roteiro prolixo", content: verbose },
      "roteiro sobre vendas no instagram"
    );

    expect(repaired.content.length).toBeLessThanOrEqual(TECHNICAL_SCRIPT_MAX_CHARS);

    const visualLines = repaired.content.match(/^Visual:\s+.*$/gim) || [];
    const falaLines = repaired.content.match(/^Fala:\s+.*$/gim) || [];
    const direcaoLines = repaired.content.match(/^Direção:\s+.*$/gim) || [];
    const reasonSegments = direcaoLines
      .map((line) => line.split(/\bPor que assim:\s*/i)[1] || "")
      .map((value) => value.trim())
      .filter(Boolean);

    expect(visualLines.every((line) => line.length <= 170)).toBe(true);
    expect(falaLines.every((line) => line.length <= 220)).toBe(true);
    expect(direcaoLines.every((line) => line.length <= 220)).toBe(true);
    expect(reasonSegments.every((segment) => segment.length <= 115)).toBe(true);
    expect(repaired.content).toContain("Por que assim:");
  });

  it("prefers 4 scenes for simple requests even when draft arrives longer", () => {
    const longerDraft = [
      "[ROTEIRO_TECNICO_V1]",
      "O que postar: Reels sobre erro de abertura.",
      "Por que postar assim: Tips + Trabalho aparecem fortes.",
      "Quando postar: ter/qui, 19h/21h.",
      "Como esse vídeo deve funcionar: erro -> contexto -> ajuste -> prova -> CTA.",
      "",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto.",
      "",
      'Fala: "Abrir nomeando o erro."',
      "",
      "Direção: Tom firme. Por que assim: abertura direta segura atenção.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostrar o celular.",
      "",
      'Fala: "Explicar o atrito real."',
      "",
      "Direção: Didático. Por que assim: contexto observável aumenta identificação.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostrar três linhas no bloco de notas.",
      "",
      'Fala: "Descrever o ajuste."',
      "",
      "Direção: Cadência clara. Por que assim: método simples aumenta utilidade.",
      "",
      "[CENA 4: PROVA]",
      "Visual: Mostrar antes e depois.",
      "",
      'Fala: "Mostrar a prova."',
      "",
      "Direção: Objetivo. Por que assim: prova concreta reforça credibilidade.",
      "",
      "[CENA 5: CTA]",
      "Visual: Volta para o rosto.",
      "",
      'Fala: "Perguntar qual parte mais falta."',
      "",
      "Direção: Conversa aberta. Por que assim: pergunta específica gera comentário melhor.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Blueprint longo", content: longerDraft },
      "roteiro sobre retenção",
      { preferredSceneCount: 4, maxSceneCount: 4 }
    );
    const scenes = repaired.content.match(/^\s*CENA\s+\d+:/gim) || [];

    expect(scenes).toHaveLength(4);
    expect(repaired.content).toContain("CENA 4: CHAMADA PARA AÇÃO");
    expect(repaired.content).not.toContain("CENA 5:");
  });

  it("rewards concise blueprints over verbose ones", () => {
    const concise = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto com comentário na tela.",
      "",
      'Fala: "Nomear o erro logo na abertura para deixar a promessa clara."',
      "",
      "Direção: Tom firme e frase curta. Por que assim: abertura direta segura melhor a atenção do perfil.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostrar no celular a situação que trava o resultado.",
      "",
      'Fala: "Explicar o atrito real antes da dica."',
      "",
      "Direção: Didático e rápido. Por que assim: contexto observável aumenta identificação.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Apontar três linhas da estrutura na tela.",
      "",
      'Fala: "Mostrar a ordem prática: erro, ajuste e prova."',
      "",
      "Direção: Cadência clara. Por que assim: método simples deixa o vídeo mais aplicável.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela: QUAL PARTE FALTA?",
      "",
      'Fala: "Perguntar qual parte mais falta hoje no conteúdo."',
      "",
      "Direção: Conversa aberta. Por que assim: pergunta específica gera comentário melhor.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const verbose = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto com comentário na tela, depois novo corte no mesmo close, repetindo o enquadramento e alongando a descrição visual sem acrescentar nova informação prática para a gravação.",
      "",
      'Fala: "Explicar em vários trechos longos que o erro precisa ser nomeado logo na abertura, reforçando a mesma ideia mais de uma vez e detalhando demais algo que poderia ser comunicado em uma orientação mais enxuta."',
      "",
      "Direção: Tom firme, frase curta, pausa, olhar na lente, gesto de mão e reforço final da mesma intenção. Por que assim: abertura direta segura melhor a atenção do perfil, aumenta clareza, melhora retenção, reduz dispersão e deixa a leitura do vídeo mais fácil para a audiência quando a promessa aparece cedo.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostrar no celular a situação que trava o resultado, contextualizar o cenário, detalhar o celular, a tela, a mão, a postura e a repetição do mesmo atrito visual de forma extensa.",
      "",
      'Fala: "Explicar o atrito real antes da dica, trazendo repetições adicionais sobre dor, contexto, percepção e dificuldade cotidiana em um nível de detalhe maior do que o necessário para orientar a gravação."',
      "",
      "Direção: Didático e rápido, mas com descrição longa da mesma orientação. Por que assim: contexto observável aumenta identificação, deixa a dor mais clara, aumenta proximidade e reforça a construção narrativa do conteúdo.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Apontar três linhas da estrutura na tela, repetir a ordem, detalhar o gesto, a mão, a cadência e a transição como se fosse um manual em vez de um blueprint compacto.",
      "",
      'Fala: "Mostrar a ordem prática: erro, ajuste e prova, expandindo a explicação com observações extras e repetitivas que aumentam o comprimento da cena sem melhorar a utilidade real."',
      "",
      "Direção: Cadência clara e explicação longa da mesma execução. Por que assim: método simples deixa o vídeo mais aplicável, mais didático, mais claro e mais fácil de repetir, então vale reforçar a lógica de forma extensa.",
      "",
      "[CENA 4: CTA]",
      "Visual: Texto na tela com a pergunta final, mais descrição complementar do gesto, da expressão, da pausa e do fechamento do enquadramento.",
      "",
      'Fala: "Perguntar qual parte mais falta hoje no conteúdo, expandindo a pergunta com novos detalhes de intenção, continuidade e abertura de conversa que poderiam ser bem mais curtos."',
      "",
      "Direção: Conversa aberta com descrição longa do tom e da intenção. Por que assim: pergunta específica gera comentário melhor, prolonga a conversa e reforça a continuidade editorial do perfil.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const conciseScore = evaluateTechnicalScriptQuality(concise, "roteiro sobre vendas no instagram");
    const verboseScore = evaluateTechnicalScriptQuality(verbose, "roteiro sobre vendas no instagram");

    expect(conciseScore.concisionScore).toBeGreaterThan(verboseScore.concisionScore);
    expect(conciseScore.perceivedQuality).toBeGreaterThanOrEqual(verboseScore.perceivedQuality);
  });

  it("preserves practical blueprint guidance when it is already useful", () => {
    const base = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto com texto na tela reforçando a virada.",
      "",
      'Fala: "Abrir nomeando o erro central. Frase-exemplo opcional: eu só destravei isso quando parei de insistir no formato mais óbvio."',
      "",
      "Direção: Tom direto, ritmo firme e micro-pausa antes da virada. Por que assim: abertura curta e confessional tende a segurar melhor a atenção do perfil.",
      "",
      "[CENA 2: CONTEXTO]",
      "Visual: Mostrar o celular e a bagunça do processo.",
      "",
      'Fala: "Explicar o atrito real que derruba a execução antes do resultado."',
      "",
      "Direção: Íntimo e preciso. Por que assim: contexto observável aumenta identificação e evita teoria solta.",
      "",
      "[CENA 3: DEMONSTRAÇÃO]",
      "Visual: Mostrar o ajuste acontecendo em três passos curtos.",
      "",
      'Fala: "Descrever o ajuste prático e o que precisa ficar claro nessa cena."',
      "",
      "Direção: Didático e leve. Por que assim: passo simples e visual melhora utilidade percebida.",
      "",
      "[CENA 4: CTA]",
      "Visual: Retorno para o rosto com texto na tela: QUAL PARTE FALTA?",
      "",
      'Fala: "Fechar perguntando qual parte mais falta no processo. CTA sugerido: me conta aqui."',
      "",
      "Direção: Curioso e conversacional. Por que assim: pergunta aberta tende a gerar comentário melhor que CTA genérico.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const repaired = enforceTechnicalScriptContract(
      { title: "Blueprint", content: base },
      "roteiro sobre retenção para reels"
    );

    expect(repaired.content).toContain("Abrir com a virada central");
    expect(repaired.content).toContain("CTA sugerido");
  });
});
