import { groundHookRecommendationWithCreatorEvidence } from "./hookRecommendationRanking";
import type { HookRecommendation } from "./hookRecommendation";

const recommendation: HookRecommendation = {
  version: "v1",
  primary: {
    id: "territory",
    spokenLine: "O segredo que ninguém te contou vai viralizar",
    onScreenText: null,
    firstFrameDirection: null,
    deliveryDirection: null,
    strategy: "territory_first",
    pattern: "contrarian",
    whyForThisVideo: "Abre curiosidade.",
  },
  alternatives: [
    {
      id: "creator",
      spokenLine: "Você sente mais a lombar do que o glúteo aqui?",
      onScreenText: "Lombar ou glúteo?",
      firstFrameDirection: "Mostrar a execução.",
      deliveryDirection: null,
      strategy: "creator_first",
      pattern: "question",
      whyForThisVideo: "A demonstração responde exatamente essa pergunta.",
    },
  ],
  basis: { creatorPosts: 0, territoryPosts: 0, territoryCreators: 0, windowDays: 0, confidence: "low" },
};

describe("groundHookRecommendationWithCreatorEvidence", () => {
  it("promotes a creator-aligned candidate and overwrites model-provided creator counts", () => {
    const result = groundHookRecommendationWithCreatorEvidence({
      recommendation,
      creatorPosts: 12,
      windowDays: 90,
      creatorEvidence: [
        {
          spokenLine: "Você sente dor aqui?",
          screenTitle: null,
          pattern: "question",
          subject: "treino",
          tone: "didatico",
          performanceIndex: 1.8,
          outcomeSignals: ["retention"],
        },
        {
          spokenLine: "Qual músculo trabalha neste exercício?",
          screenTitle: null,
          pattern: "question",
          subject: "treino",
          tone: "didatico",
          performanceIndex: 1.4,
          outcomeSignals: ["watch_time"],
        },
      ],
    });

    expect(result.primary.id).toBe("creator");
    expect(result.basis).toMatchObject({ creatorPosts: 12, windowDays: 90, confidence: "medium" });
  });

  it("promotes a territory-backed pattern and overwrites collective counts", () => {
    const safeRecommendation: HookRecommendation = {
      ...recommendation,
      primary: { ...recommendation.primary, spokenLine: "Pare de repetir este erro", firstFrameDirection: "Mostrar o erro." },
    };
    const result = groundHookRecommendationWithCreatorEvidence({
      recommendation: safeRecommendation,
      creatorPosts: 0,
      creatorEvidence: [],
      territoryContext: {
        territoryId: "treino",
        territoryLabel: "Treino",
        weekKey: "2026-W34",
        posts: 42,
        creators: 8,
        windowDays: 90,
        patterns: [{
          pattern: "question",
          label: "Pergunta direta",
          performanceIndex: 1.8,
          posts: 42,
          creators: 8,
          evidence: "tendencia",
        }],
      },
    });

    expect(result.primary.id).toBe("creator");
    expect(result.basis).toMatchObject({ territoryPosts: 42, territoryCreators: 8, windowDays: 90, confidence: "medium" });
  });
});
