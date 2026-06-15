import {
  selectFunctionsForIntent,
  isIntentFunctionSubsetEnabled,
  FUNCTIONS_BY_INTENT,
} from "./aiOrchestratorFunctionScope";

const ALL = [
  "getAggregatedReport",
  "getLatestAccountInsights",
  "getLatestAudienceDemographics",
  "fetchCommunityInspirations",
  "getStrategicThemes",
  "getTopPosts",
  "getCategoryRanking",
  "getUserTrend",
  "getFpcTrendHistory",
  "getDayPCOStats",
  "getMetricDetailsById",
  "findPostsByCriteria",
  "getDailyMetricHistory",
  "getMetricsHistory",
  "getConsultingKnowledge",
].map((name) => ({ name }));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isIntentFunctionSubsetEnabled", () => {
  it("default OFF", () => {
    delete process.env.AI_FUNCTION_SUBSET_BY_INTENT;
    expect(isIntentFunctionSubsetEnabled()).toBe(false);
  });
  it("liga só com 'true' literal", () => {
    process.env.AI_FUNCTION_SUBSET_BY_INTENT = "true";
    expect(isIntentFunctionSubsetEnabled()).toBe(true);
    process.env.AI_FUNCTION_SUBSET_BY_INTENT = "1";
    expect(isIntentFunctionSubsetEnabled()).toBe(false);
  });
});

describe("selectFunctionsForIntent", () => {
  it("desligado → lista intacta mesmo para intent mapeado", () => {
    delete process.env.AI_FUNCTION_SUBSET_BY_INTENT;
    expect(selectFunctionsForIntent("demographic_query", ALL)).toBe(ALL);
  });

  describe("com subset ligado", () => {
    beforeEach(() => {
      process.env.AI_FUNCTION_SUBSET_BY_INTENT = "true";
    });

    it("demographic_query → só demografia + insights", () => {
      const out = selectFunctionsForIntent("demographic_query", ALL).map((f) => f.name);
      expect(out).toEqual(["getLatestAccountInsights", "getLatestAudienceDemographics"]);
    });

    it("ranking_request → só o cluster de ranking/trend", () => {
      const out = selectFunctionsForIntent("ranking_request", ALL).map((f) => f.name);
      expect(out).toEqual(["getTopPosts", "getCategoryRanking", "getUserTrend", "getFpcTrendHistory"]);
    });

    it("preserva a ordem original da lista (não a do mapa)", () => {
      const out = selectFunctionsForIntent("ASK_BEST_PERFORMER", ALL).map((f) => f.name);
      // ordem segue ALL: getTopPosts, getCategoryRanking, getMetricDetailsById, findPostsByCriteria
      expect(out).toEqual([
        "getTopPosts",
        "getCategoryRanking",
        "getMetricDetailsById",
        "findPostsByCriteria",
      ]);
    });

    it("intent aberto (general) não mapeado → conjunto completo", () => {
      expect(selectFunctionsForIntent("general", ALL)).toBe(ALL);
    });

    it("intent desconhecido → conjunto completo", () => {
      expect(selectFunctionsForIntent("intent_inexistente", ALL)).toBe(ALL);
    });

    it("salvaguarda: interseção vazia devolve a lista completa", () => {
      const semOverlap = [{ name: "ferramentaQueNaoExisteNoMapa" }];
      expect(selectFunctionsForIntent("demographic_query", semOverlap)).toBe(semOverlap);
    });

    it("respeita filtragem prévia: função fora da lista de entrada não reaparece", () => {
      const semTopPosts = ALL.filter((f) => f.name !== "getTopPosts");
      const out = selectFunctionsForIntent("ranking_request", semTopPosts).map((f) => f.name);
      expect(out).not.toContain("getTopPosts");
      expect(out).toEqual(["getCategoryRanking", "getUserTrend", "getFpcTrendHistory"]);
    });
  });
});

describe("FUNCTIONS_BY_INTENT — integridade", () => {
  it("todos os nomes do mapa existem nos schemas reais", () => {
    const real = new Set(ALL.map((f) => f.name));
    for (const [intent, names] of Object.entries(FUNCTIONS_BY_INTENT)) {
      for (const n of names) {
        expect({ intent, name: n, exists: real.has(n) }).toEqual({ intent, name: n, exists: true });
      }
    }
  });

  it("não mapeia intents abertos (general/report)", () => {
    expect(FUNCTIONS_BY_INTENT.general).toBeUndefined();
    expect(FUNCTIONS_BY_INTENT.report).toBeUndefined();
  });
});
