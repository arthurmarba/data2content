import { buildLegacyHookRecommendation, sanitizeHookRecommendation } from "./hookRecommendation";

describe("hookRecommendation", () => {
  it("sanitizes a versioned recommendation and removes duplicate alternatives", () => {
    const result = sanitizeHookRecommendation({
      version: "v1",
      primary: {
        id: "a",
        spokenLine: "Esse é o erro que sobrecarrega sua lombar.",
        strategy: "creator_first",
        pattern: "diagnostico_de_erro",
        whyForThisVideo: "O vídeo mostra o erro e depois demonstra a correção.",
      },
      alternatives: [
        {
          spokenLine: "Esse é o erro que sobrecarrega sua lombar.",
          strategy: "hybrid",
          whyForThisVideo: "Duplicada.",
        },
        {
          spokenLine: "Você sente mais a lombar do que o glúteo aqui?",
          strategy: "hybrid",
          whyForThisVideo: "Parte de uma dor que aparece na demonstração.",
        },
      ],
      basis: { creatorPosts: 8, territoryPosts: 20, territoryCreators: 5, windowDays: 90, confidence: "medium" },
    });

    expect(result?.primary.strategy).toBe("creator_first");
    expect(result?.alternatives).toHaveLength(1);
    expect(result?.basis).toMatchObject({ creatorPosts: 8, territoryPosts: 20, confidence: "medium" });
  });

  it("builds a backwards-compatible recommendation from suggestedHook", () => {
    const result = buildLegacyHookRecommendation({
      suggestedHook: "Comece mostrando o resultado.",
      creatorPosts: 6,
      windowDays: 90,
    });

    expect(result).toMatchObject({
      version: "hook-recommendation-legacy-v1",
      primary: { spokenLine: "Comece mostrando o resultado." },
      basis: { confidence: "medium", creatorPosts: 6 },
    });
  });

  it("rejects a recommendation without a usable primary line", () => {
    expect(sanitizeHookRecommendation({ primary: { spokenLine: "" } })).toBeNull();
  });
});

