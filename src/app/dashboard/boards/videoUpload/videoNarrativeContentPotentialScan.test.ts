import {
  buildFallbackVideoNarrativeContentPotentialScan,
  calibrateVideoNarrativeContentPotentialScan,
  contextualizeVideoNarrativeContentPotentialScan,
  sanitizeVideoNarrativeContentPotentialScan,
} from "./videoNarrativeContentPotentialScan";

describe("videoNarrativeContentPotentialScan", () => {
  it("keeps the result uncertain when fewer than three dimensions are known", () => {
    const fallback = buildFallbackVideoNarrativeContentPotentialScan({ selectedGoalOption: "retention" });
    const calibrated = calibrateVideoNarrativeContentPotentialScan({
      scan: {
        ...fallback,
        dimensions: {
          ...fallback.dimensions,
          openingClarity: { status: "strong", evidence: "Tema legível sem som.", adjustment: null, window: "0-3s" },
          attentionArchitecture: { status: "strong", evidence: "Há uma virada visual.", adjustment: null, window: "0-10s" },
        },
      },
      selectedGoalOption: "retention",
    });

    expect(calibrated.band).toBe("uncertain");
    expect(calibrated.confidence).toBe("low");
  });

  it("uses creator history only after five analyzed posts", () => {
    const fallback = buildFallbackVideoNarrativeContentPotentialScan({ selectedGoalOption: "format_test" });
    const dimensions = Object.fromEntries(
      Object.entries(fallback.dimensions).map(([key, value]) => [
        key,
        { ...value, status: "strong", evidence: "Evidência observável." },
      ]),
    ) as typeof fallback.dimensions;
    const calibrated = calibrateVideoNarrativeContentPotentialScan({
      scan: { ...fallback, dimensions },
      selectedGoalOption: "format_test",
      postsAnalyzed: 5,
    });

    expect(calibrated.band).toBe("strong");
    expect(calibrated.basis).toBe("creator_history");
    expect(calibrated.objective).toBe("attention");
    expect(calibrated.disclaimer).toContain("não é garantia");
  });

  it("removes false-precision and guarantee language from provider text", () => {
    const fallback = buildFallbackVideoNarrativeContentPotentialScan({ selectedGoalOption: "retention" });
    const sanitized = sanitizeVideoNarrativeContentPotentialScan({
      ...fallback,
      highestImpactAdjustment: "Score garantido: vai viralizar com certeza.",
    });

    expect(sanitized?.highestImpactAdjustment.toLowerCase()).not.toMatch(/score|garantid|viralizar|certeza/);
  });

  it("turns observed video evidence into watched moments and a practical direction", () => {
    const fallback = buildFallbackVideoNarrativeContentPotentialScan({
      selectedGoalOption: "retention",
      adjustment: "A promessa ainda não aparece na abertura.",
    });
    const contextual = contextualizeVideoNarrativeContentPotentialScan({
      scan: fallback,
      evidenceAnchors: {
        speechQuotes: [{
          quote: "essa ideia sempre trava aqui",
          source: "creator_spoken",
          quoteRole: "hook",
          whyItMatters: "A frase contém a tensão central.",
          chapterHint: "tension",
        }],
        sceneAnchors: [{
          description: "A primeira cena mostra um rascunho antes da pergunta aparecer.",
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "A imagem contextualiza, mas não explicita a promessa.",
          chapterHint: "video_reveal",
        }],
        creatorIntentAnchor: null,
        profilePatternAnchors: [],
        instagramAnchors: [],
      },
      suggestedHook: "Sua ideia trava antes de virar pauta?",
      nextActions: ["Levar a pergunta central para o primeiro frame em texto."],
    });

    expect(contextual.watchedMoments).toEqual(expect.arrayContaining([
      expect.objectContaining({ moment: "opening", observation: expect.stringContaining("rascunho") }),
      expect.objectContaining({ moment: "opening", observation: expect.stringContaining("Você diz") }),
    ]));
    expect(contextual.practicalDirection).toEqual(expect.objectContaining({
      action: "Levar a pergunta central para o primeiro frame em texto.",
      example: "Sua ideia trava antes de virar pauta?",
    }));
  });
});
