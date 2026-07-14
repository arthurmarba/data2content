import { geminiVideoNarrativeRawJsonFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";
import { parseVideoNarrativeGeminiResponse } from "./videoNarrativeGeminiResponseParser";

describe("videoNarrativeGeminiResponseParser", () => {
  it("parseia fixture válida", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.mainNarrative).toContain("Rotina prática");
      expect(result.analysis.evidenceAnchors?.speechQuotes[0]).toEqual(expect.objectContaining({
        quote: "rapidinho",
        source: "creator_spoken",
      }));
    }
  });

  it("captura directAnswer quando presente", () => {
    const raw = { ...JSON.parse(geminiVideoNarrativeRawJsonFixture), directAnswer: "Esse formato vale repetir: o gancho direto sustentou a atenção." };
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.directAnswer).toContain("Esse formato vale repetir");
    }
  });

  it("não quebra quando directAnswer está ausente (resposta antiga)", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.directAnswer).toBeUndefined();
    }
  });

  it("captura os eixos de audiência e marca do veredito 'vale postar?'", () => {
    const raw = {
      ...JSON.parse(geminiVideoNarrativeRawJsonFixture),
      audienceCoherence: { verdict: "aligned", reading: "Fala com quem já te acompanha." },
      brandCoherence: { verdict: "tension", reading: "Abre um território ainda difuso." },
    };
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.audienceCoherence).toEqual({ verdict: "aligned", reading: "Fala com quem já te acompanha." });
      expect(result.analysis.brandCoherence).toEqual({ verdict: "tension", reading: "Abre um território ainda difuso." });
    }
  });

  it("preserva os momentos assistidos e a direção prática do Raio X", () => {
    const raw = {
      ...JSON.parse(geminiVideoNarrativeRawJsonFixture),
      contentPotentialScan: {
        band: "promising_with_adjustment",
        confidence: "medium",
        basis: "video_only",
        objective: "complete_reading",
        historyPostsAnalyzed: 0,
        dimensions: {
          openingClarity: { status: "mixed", evidence: "A pergunta só aparece na fala.", adjustment: "Escrever a pergunta.", window: "0-3s" },
          attentionArchitecture: { status: "strong", evidence: "Há progressão visual.", adjustment: null, window: "0-10s" },
          shareImpulse: { status: "mixed", evidence: "A síntese está implícita.", adjustment: null, window: "full_video" },
          promiseDelivery: { status: "strong", evidence: "O fechamento entrega a solução.", adjustment: null, window: "full_video" },
          narrativeFit: { status: "strong", evidence: "Conversa com o mapa.", adjustment: null, window: "creator_history" },
        },
        watchedMoments: [
          { moment: "opening", observation: "Você mostra o rascunho antes da pergunta.", impact: "A tensão demora a ficar clara." },
          { moment: "closing", observation: "A pauta pronta aparece na tela.", impact: "A entrega fica comprovada." },
        ],
        practicalDirection: {
          title: "Antecipe a pergunta",
          action: "Leve a dúvida principal para o primeiro frame em texto.",
          example: "Sua ideia trava antes de virar pauta?",
        },
        highestImpactAdjustment: "Antecipar a pergunta.",
        disclaimer: "Leitura estrutural, sem garantia de alcance.",
      },
    };
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.contentPotentialScan?.watchedMoments?.[0]).toEqual(expect.objectContaining({
      moment: "opening",
      observation: expect.stringContaining("rascunho"),
    }));
    expect(result.analysis.contentPotentialScan?.practicalDirection).toEqual(expect.objectContaining({
      title: "Antecipe a pergunta",
      example: "Sua ideia trava antes de virar pauta?",
    }));
  });

  it("degrada verdict inválido de eixo para 'unknown' e não quebra quando ausente", () => {
    const withBadVerdict = {
      ...JSON.parse(geminiVideoNarrativeRawJsonFixture),
      audienceCoherence: { verdict: "muito_alinhado", reading: "x" },
    };
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(withBadVerdict));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.audienceCoherence?.verdict).toBe("unknown");
      // brandCoherence ausente permanece undefined (resposta antiga não quebra).
      expect(result.analysis.brandCoherence).toBeUndefined();
    }
  });

  it("remove code fences se necessário", () => {
    const result = parseVideoNarrativeGeminiResponse(`\`\`\`json\n${geminiVideoNarrativeRawJsonFixture}\n\`\`\``);
    expect(result.ok).toBe(true);
  });

  it("extrai JSON quando o provider envolve a resposta em texto curto", () => {
    const result = parseVideoNarrativeGeminiResponse(`Leitura estruturada:\n${geminiVideoNarrativeRawJsonFixture}`);
    expect(result.ok).toBe(true);
  });

  it("aceita objeto analysis aninhado quando o provider cria wrapper", () => {
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify({
      analysis: JSON.parse(geminiVideoNarrativeRawJsonFixture),
    }));
    expect(result.ok).toBe(true);
  });

  it("aceita array com um objeto de análise", () => {
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify([
      JSON.parse(geminiVideoNarrativeRawJsonFixture),
    ]));
    expect(result.ok).toBe(true);
  });

  it("aceita aliases comuns de campos quando o provider varia a nomenclatura", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    const aliased = {
      main_narrative: raw.mainNarrative,
      what_video_communicates: raw.whatVideoCommunicates,
      creator_intention: raw.creatorIntention,
      strategic_reading: raw.strategicReading,
      strength_point: raw.strengthPoint,
      attention_point: raw.attentionPoint,
      recommended_adjustment: raw.recommendedAdjustment,
      suggested_hook: raw.suggestedHook,
      commercial_potential: raw.commercialPotential,
      next_actions: raw.nextActions,
      creator_signals: raw.creatorSignals,
      brand_territories: raw.brandTerritories,
      collab_opportunities: raw.collabOpportunities,
      evidence_anchors: raw.evidenceAnchors,
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(aliased));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.mainNarrative).toBe(raw.mainNarrative);
      expect(result.analysis.evidenceAnchors?.sceneAnchors[0].description).toContain("rotina simples");
    }
  });

  it("normaliza listas obrigatórias quando o provider retorna string única", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.nextActions = "Acompanhar se a promessa aparece mais cedo nos próximos conteúdos.";

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.nextActions).toEqual([
        "Acompanhar se a promessa aparece mais cedo nos próximos conteúdos.",
      ]);
    }
  });

  it("normaliza listas obrigatórias quando o provider retorna objetos", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.creatorSignals = [{ signal: "Bastidor como prova" }, { label: "Autoridade acessível" }];

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.creatorSignals).toEqual(["Bastidor como prova", "Autoridade acessível"]);
    }
  });

  it("rejeita JSON inválido", () => {
    const result = parseVideoNarrativeGeminiResponse("{");
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("invalid_json");
  });

  it("rejeita campos obrigatórios ausentes", () => {
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify({ mainNarrative: "x" }));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("missing_required_fields");
  });

  it("limita strings longas", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.mainNarrative = "a".repeat(1000);
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.analysis.mainNarrative.length).toBeLessThanOrEqual(420);
  });

  it("sanitiza termos proibidos", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.strengthPoint = "score garantido e ranking comprovado";
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = JSON.stringify(result.analysis).toLowerCase();
      expect(serialized).not.toContain("score");
      expect(serialized).not.toContain("ranking");
      expect(serialized).not.toContain("garantido");
    }
  });

  it("rejeita signed URL", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.mainNarrative = "https://storage.example.test/video.mp4?signature=secret";
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("signed_url");
  });

  it("rejeita token/API key", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.mainNarrative = "AIzaSy12345678901234567890123456789012345";
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("api_key");
  });

  it("rejeita raw transcript longo", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.rawTranscript = "fala ".repeat(200);
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("raw_transcript");
  });

  it("aceita speechQuotes, sceneAnchors e creatorIntentAnchor seguros", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.evidenceAnchors = {
      speechQuotes: [
        {
          quote: "rapidinho",
          source: "creator_spoken",
          quoteRole: "hook",
          whyItMatters: "Cria promessa pequena.",
          chapterHint: "pattern",
        },
      ],
      sceneAnchors: [
        {
          description: "A abertura demora a mostrar o conflito principal.",
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "Mostra onde a tensão atrasa.",
          chapterHint: "tension",
        },
      ],
      creatorIntentAnchor: {
        statedGoal: "gerar identificação e comentários",
        interpretedGoal: "testar humor de reconhecimento rápido",
        whyItMatters: "Muda a leitura do gancho.",
      },
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.evidenceAnchors?.speechQuotes[0].source).toBe("creator_spoken");
    expect(result.analysis.evidenceAnchors?.sceneAnchors[0].source).toBe("model_observed");
    expect(result.analysis.evidenceAnchors?.creatorIntentAnchor?.source).toBe("creator_goal");
  });

  it("limpa anchors inseguros sem quebrar a analise", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.evidenceAnchors = {
      speechQuotes: Array.from({ length: 6 }, (_, index) => ({
        quote: index === 0 ? "https://storage.test/video.mp4?signature=abc" : `fala segura ${index}`,
        source: "creator_spoken",
        quoteRole: "hook",
        whyItMatters: "objectKey uploads/user/video.mp4",
        chapterHint: "pattern",
      })),
      sceneAnchors: [
        {
          description: "Cena com uploadUrl e localPath removidos.",
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "storageProviderPath deve sumir.",
          chapterHint: "tension",
        },
      ],
      creatorIntentAnchor: null,
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.analysis);
    expect(result.analysis.evidenceAnchors?.speechQuotes.length).toBeLessThanOrEqual(4);
    expect(serialized).not.toContain("https://storage.test");
    expect(serialized).not.toContain("uploads/user/video.mp4");
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain("storageProviderPath");
  });

  it("descarta base64 grande e blobs parecidos com transcript em anchors", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.evidenceAnchors = {
      speechQuotes: [
        {
          quote: "data:video/mp4;base64," + "A".repeat(1500),
          source: "creator_spoken",
          quoteRole: "hook",
          whyItMatters: "não persistir",
          chapterHint: "pattern",
        },
      ],
      sceneAnchors: [
        {
          description: Array.from({ length: 12 }, (_, index) => `00:${String(index).padStart(2, "0")} fala`).join("\n"),
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "não persistir",
          chapterHint: "tension",
        },
      ],
      creatorIntentAnchor: null,
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.evidenceAnchors?.speechQuotes).toEqual([]);
    expect(result.analysis.evidenceAnchors?.sceneAnchors).toEqual([]);
    expect(result.issues.map((item) => item.code)).toContain("invalid_evidence_anchors");
  });

  it("não retorna raw response", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(JSON.stringify(result)).not.toContain("rawText");
    expect(JSON.stringify(result)).not.toContain("rawResponse");
  });
});
