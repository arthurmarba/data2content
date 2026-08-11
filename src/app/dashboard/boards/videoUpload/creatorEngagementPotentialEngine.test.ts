import { enrichContentPotentialWithCreatorHistory } from "./creatorEngagementPotentialEngine";
import type { CreatorEngagementBaseline } from "./creatorEngagementBaselineService";
import type { VideoNarrativeAiAnalysis } from "./videoNarrativeAiProviderTypes";
import type { VideoNarrativeContentPotentialScan } from "./videoNarrativeContentPotentialScan";

const dimension = {
  status: "mixed" as const,
  evidence: "Sinal identificado no vídeo.",
  adjustment: "Torne o sinal mais explícito.",
  window: "full_video" as const,
};

const scan: VideoNarrativeContentPotentialScan = {
  band: "promising_with_adjustment",
  confidence: "medium",
  basis: "creator_history",
  objective: "complete_reading",
  historyPostsAnalyzed: 12,
  dimensions: {
    openingClarity: { ...dimension, window: "0-3s" },
    attentionArchitecture: { ...dimension, window: "0-10s" },
    shareImpulse: dimension,
    promiseDelivery: dimension,
    narrativeFit: { ...dimension, window: "creator_history" },
  },
  highestImpactAdjustment: "Explicite a promessa.",
  disclaimer: "Tendência, não garantia.",
};

const baseline: CreatorEngagementBaseline = {
  postsAnalyzed: 15,
  windowDays: 90,
  confidence: "high",
  medianEngagementRate: 0.08,
  medianDeepEngagementRate: 0.03,
  topPostsCount: 6,
  openingSpeechRate: 0.8,
  openingTextRate: 0.5,
  patterns: {
    framing: { key: "close_up", label: "Close-up", count: 5 },
    aesthetic: { key: "minimal", label: "Minimalista", count: 4 },
    subject: { key: "bastidores", label: "Bastidores", count: 5 },
    tone: { key: "didatico", label: "Didático", count: 4 },
    place: null,
  },
};

function analysis(overrides: Partial<VideoNarrativeAiAnalysis> = {}): VideoNarrativeAiAnalysis {
  return {
    mainNarrative: "Bastidores de criação",
    whatVideoCommunicates: "Processo",
    creatorIntention: "Ensinar",
    strategicReading: "Autoridade",
    strengthPoint: "Clareza",
    attentionPoint: "Abertura",
    recommendedAdjustment: "Explicitar gancho",
    suggestedHook: "Veja como faço",
    commercialPotential: "Médio",
    nextActions: [],
    creatorSignals: [],
    brandTerritories: [],
    collabOpportunities: [],
    contentContext: {
      setting: null,
      socialPresence: null,
      emotionalRegister: "Didático",
      humorStyle: null,
      energyLevel: null,
      lifeSignals: [],
      productionStyle: "Close-up minimalista",
    },
    ...overrides,
  };
}

describe("creatorEngagementPotentialEngine", () => {
  it("explica quando a execução está alinhada ao histórico publicado", () => {
    const result = enrichContentPotentialWithCreatorHistory({ scan, baseline, analysis: analysis() });
    expect(result.engagementPotential).toEqual(expect.objectContaining({
      confidence: "high",
      basis: "creator_history",
      postsCompared: 15,
    }));
    expect(result.engagementPotential?.summary).toContain("próxima dos padrões");
    expect(result.personalComparisons?.find((item) => item.dimension === "framing")?.impact).toBe("positive");
  });

  it("trata enquadramento, assunto e tom diferentes como experimento e prevê resposta diferente", () => {
    const result = enrichContentPotentialWithCreatorHistory({
      scan,
      baseline,
      analysis: analysis({
        mainNarrative: "Viagem gastronômica",
        contentContext: {
          setting: null,
          socialPresence: null,
          emotionalRegister: "Contemplativo",
          humorStyle: null,
          energyLevel: null,
          lifeSignals: [],
          productionStyle: "Plano geral documental",
        },
      }),
    });
    expect(result.engagementPotential?.summary).toContain("resposta pode ser diferente");
    expect(result.personalComparisons?.filter((item) => ["framing", "subject", "tone"].includes(item.dimension)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ dimension: "framing", impact: "experimental" }),
        expect.objectContaining({ dimension: "subject", impact: "experimental" }),
        expect.objectContaining({ dimension: "tone", impact: "experimental" }),
      ]));
  });
});
