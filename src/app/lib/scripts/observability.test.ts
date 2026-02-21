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

  it("captures technical script diagnostics", () => {
    const technicalContent = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-03s | Close | Abertura | Gancho forte | Se você quer destravar isso, presta atenção agora. | Ritmo alto e olhar na lente |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 03-10s | Médio | Contexto | Erro comum | Quando você ignora esse ponto, seu resultado cai. | Tom didático com pausa curta |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 10-20s | Médio | Demonstração | Ajuste em 2 passos | Eu resolvo assim: primeiro base, depois consistência. | Cadência progressiva e gesto de contagem |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 20-30s | Close | Final | Salve e compartilhe | Se isso te ajudou, salve e compartilhe com alguém do seu nicho. | Entonação conclusiva e sorriso curto |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const diagnostics = buildScriptOutputDiagnostics({
      operation: "create",
      prompt: "roteiro técnico",
      title: "Roteiro técnico",
      content: technicalContent,
    });

    expect(diagnostics.sceneCount).toBeGreaterThanOrEqual(4);
    expect(diagnostics.hasTechnicalColumns).toBe(true);
    expect(diagnostics.hasPerformanceDirection).toBe(true);
    expect(diagnostics.hasOnScreenText).toBe(true);
    expect(typeof diagnostics.perceivedQualityScore).toBe("number");
    expect(typeof diagnostics.hookStrength).toBe("number");
    expect(typeof diagnostics.specificityScore).toBe("number");
    expect(typeof diagnostics.speakabilityScore).toBe("number");
    expect(typeof diagnostics.ctaStrength).toBe("number");
    expect(typeof diagnostics.diversityScore).toBe("number");
  });

  it("captures technical diagnostics in flow format", () => {
    const technicalContent = [
      "[ROTEIRO TÉCNICO V1 — FORMATO DE FLUXO]",
      "CENA 1: O GANCHO (0:00 - 0:06)",
      "Enquadramento: Close no rosto.",
      "",
      "Ação: Entrada rápida com gesto de mão.",
      "",
      "Performance: Ritmo alto, olhar direto na câmera.",
      "",
      "Texto na Tela: PARE DE ERRAR.",
      "",
      'Fala: "Se você quer destravar isso, presta atenção agora."',
      "",
      "CENA 2: CONTEXTO (0:07 - 0:15)",
      "Enquadramento: Plano médio.",
      "",
      "Ação: Explicar o erro central.",
      "",
      "Performance: Tom didático com pausa curta.",
      "",
      "Texto na Tela: ERRO COMUM.",
      "",
      'Fala: "Quando você ignora esse ponto, seu resultado cai."',
      "",
      "CENA 3: DEMONSTRAÇÃO (0:16 - 0:25)",
      "Enquadramento: Plano médio com apoio visual.",
      "",
      "Ação: Mostrar ajuste em dois passos.",
      "",
      "Performance: Cadência progressiva e gesto de contagem.",
      "",
      "Texto na Tela: AJUSTE EM 2 PASSOS.",
      "",
      'Fala: "Eu resolvo assim: primeiro base, depois consistência."',
      "",
      "CENA 4: CHAMADA PARA AÇÃO (0:26 - 0:35)",
      "Enquadramento: Close final.",
      "",
      "Ação: Encerrar com benefício e CTA explícito.",
      "",
      "Performance: Entonação conclusiva e sorriso curto.",
      "",
      "Texto na Tela: SALVE E COMPARTILHE.",
      "",
      'Fala: "Se isso te ajudou, salve e compartilhe com alguém do seu nicho."',
      "[/ROTEIRO TÉCNICO V1 — FORMATO DE FLUXO]",
    ].join("\n");

    const diagnostics = buildScriptOutputDiagnostics({
      operation: "create",
      prompt: "roteiro técnico em fluxo",
      title: "Roteiro técnico",
      content: technicalContent,
    });

    expect(diagnostics.sceneCount).toBeGreaterThanOrEqual(4);
    expect(diagnostics.hasTechnicalColumns).toBe(true);
    expect(diagnostics.hasPerformanceDirection).toBe(true);
    expect(diagnostics.hasOnScreenText).toBe(true);
  });
});
