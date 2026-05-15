import fs from "fs";
import path from "path";

import {
  buildPostCreationVideoSeedFromAnalysis,
  getPostCreationVideoSeedPrimaryAction,
  hasUsefulPostCreationVideoSeed,
} from "./videoNarrativePostCreationSeed";
import {
  VideoNarrativeMockProviderScenario,
  runVideoNarrativeMockProvider,
  runVideoNarrativeMockProviderBatch,
} from "./videoNarrativeMockProvider";
import {
  getVideoNarrativeSuggestedNextStep,
  hasUsefulVideoNarrativeAnalysis,
} from "./videoNarrativeAnalysisTypes";

const forbiddenTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
];

function runNarrativePipeline(params: {
  id: string;
  creatorQuestion: string | null;
  scenario: VideoNarrativeMockProviderScenario;
  createdAt: string;
}) {
  const analysis = runVideoNarrativeMockProvider({
    input: {
      id: params.id,
      creatorQuestion: params.creatorQuestion,
      createdAt: params.createdAt,
    },
    options: { scenario: params.scenario },
  });
  const hasUsefulAnalysis = hasUsefulVideoNarrativeAnalysis(analysis);
  const seed = buildPostCreationVideoSeedFromAnalysis({
    id: `${params.id}-seed`,
    analysis,
    creatorQuestion: params.creatorQuestion,
    createdAt: params.createdAt,
  });
  const hasUsefulSeed = hasUsefulPostCreationVideoSeed(seed);
  const primaryAction = getPostCreationVideoSeedPrimaryAction(seed);

  return { analysis, hasUsefulAnalysis, seed, hasUsefulSeed, primaryAction };
}

describe("videoNarrativePipeline", () => {
  const createdAt = "2026-05-15T10:00:00.000Z";

  it("turns skincare routine into blueprint seed with brand hints", () => {
    const result = runNarrativePipeline({
      id: "skincare",
      creatorQuestion: "Quero saber se vale postar",
      scenario: "skincare_routine",
      createdAt,
    });

    expect(result.hasUsefulAnalysis).toBe(true);
    expect(result.hasUsefulSeed).toBe(true);
    expect(result.seed.initialIdea).toBeTruthy();
    expect(result.seed.blueprintDraft.whatToPost).toBeTruthy();
    expect(result.seed.brandMatchHints.length).toBeGreaterThan(0);
    expect(result.primaryAction).toBe("Transformar a sugestão de blueprint em roteiro.");
  });

  it("turns backstage process into process seed", () => {
    const result = runNarrativePipeline({
      id: "backstage",
      creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      scenario: "backstage_process",
      createdAt,
    });

    expect(result.seed.detectedNarrative).toContain("bastidor");
    expect(result.seed.suggestedProposal).toBe("behind_the_scenes");
    expect(result.seed.scriptDirection.development.length).toBeGreaterThan(0);
    expect(result.primaryAction).toBeTruthy();
  });

  it("turns brand potential into seed with brand hints", () => {
    const result = runNarrativePipeline({
      id: "brand",
      creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      scenario: "brand_potential",
      createdAt,
    });

    expect(result.seed.brandMatchHints.length).toBeGreaterThan(0);
    expect(result.seed.strategicDiagnosis).toBeTruthy();
    expect(result.seed.blueprintDraft.whyThisPath || result.seed.blueprintDraft.howItShouldWork).toBeTruthy();
    expect(result.hasUsefulSeed).toBe(true);
  });

  it("turns weak hook into opening direction", () => {
    const result = runNarrativePipeline({
      id: "weak-hook",
      creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
      scenario: "weak_hook",
      createdAt,
    });

    expect(result.analysis.hook.strength).toBe("weak");
    expect(getVideoNarrativeSuggestedNextStep(result.analysis)).toBe(
      "Reforçar o gancho antes de transformar o vídeo em roteiro.",
    );
    expect(result.seed.scriptDirection.opening).toBeTruthy();
    expect(result.seed.strategicDiagnosis).toBeTruthy();
    expect([
      "Transformar a sugestão de blueprint em roteiro.",
      "Usar a direção de abertura para construir o roteiro.",
    ]).toContain(result.primaryAction);
  });

  it("turns collab potential into collab seed", () => {
    const result = runNarrativePipeline({
      id: "collab",
      creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      scenario: "collab_potential",
      createdAt,
    });

    expect(result.seed.suggestedProposal).toBe("collab_narrative");
    expect(result.seed.detectedNarrative).toBeTruthy();
    expect(result.seed.blueprintDraft.scenes.length || result.seed.scriptDirection.development.length).toBeGreaterThan(0);
    expect(result.hasUsefulSeed).toBe(true);
  });

  it("turns ad adaptation into organic ad seed", () => {
    const result = runNarrativePipeline({
      id: "ad",
      creatorQuestion: "Quero transformar esse vídeo em uma publi sem parecer forçado",
      scenario: "ad_adaptation",
      createdAt,
    });

    expect(result.seed.suggestedProposal).toBe("ad_adaptation");
    expect(result.seed.brandMatchHints.length).toBeGreaterThan(0);
    expect(result.seed.blueprintDraft.whatToPost).toBeTruthy();
    expect(result.seed.strategicDiagnosis).toBeTruthy();
  });

  it("turns unclear content into refinement questions", () => {
    const result = runNarrativePipeline({
      id: "unclear",
      creatorQuestion: "Me ajuda com esse vídeo",
      scenario: "unclear_content",
      createdAt,
    });

    expect(result.analysis.confidence).toBe("low");
    expect(result.seed.followUpQuestions.length).toBeGreaterThan(0);
    expect(result.primaryAction).toBe("Responder às perguntas de refinamento antes de avançar.");
    expect(result.seed.blueprintDraft.whatToPost).toBeNull();
  });

  it("preserves batch order and yields useful seeds when possible", () => {
    const analyses = runVideoNarrativeMockProviderBatch({
      inputs: [
        { id: "skincare", creatorQuestion: null, createdAt },
        { id: "weak-hook", creatorQuestion: null, createdAt },
        { id: "unclear", creatorQuestion: null, createdAt },
      ],
      options: { scenario: "skincare_routine" },
    });
    const weakHook = runVideoNarrativeMockProvider({
      input: { id: "weak-hook", creatorQuestion: null, createdAt },
      options: { scenario: "weak_hook" },
    });
    const unclear = runVideoNarrativeMockProvider({
      input: { id: "unclear", creatorQuestion: null, createdAt },
      options: { scenario: "unclear_content" },
    });
    const ordered = [analyses[0], weakHook, unclear];
    const seeds = ordered.map((analysis) =>
      buildPostCreationVideoSeedFromAnalysis({ id: `${analysis.id}-seed`, analysis, createdAt }),
    );

    expect(ordered.map((analysis) => analysis.id)).toEqual(["skincare", "weak-hook", "unclear"]);
    expect(seeds.map((seed) => seed.analysisId)).toEqual(["skincare", "weak-hook", "unclear"]);
    expect(hasUsefulPostCreationVideoSeed(seeds[0])).toBe(true);
    expect(hasUsefulPostCreationVideoSeed(seeds[1])).toBe(true);
    expect(seeds[2].followUpQuestions.length).toBeGreaterThan(0);
  });

  it("keeps generated narrative pipeline language conservative", () => {
    const outputs = [
      ["skincare_routine", "Quero saber se vale postar"],
      ["backstage_process", "Não sei qual narrativa esse vídeo comunica"],
      ["brand_potential", "Quero saber se esse vídeo tem potencial para atrair marcas"],
      ["weak_hook", "Acho que o começo está fraco e queria melhorar o gancho"],
      ["collab_potential", "Esse vídeo poderia virar uma collab com outro creator?"],
      ["ad_adaptation", "Quero transformar esse vídeo em uma publi sem parecer forçado"],
      ["unclear_content", "Me ajuda com esse vídeo"],
    ].map(([scenario, creatorQuestion], index) => {
      const result = runNarrativePipeline({
        id: `scenario-${index}`,
        creatorQuestion,
        scenario: scenario as VideoNarrativeMockProviderScenario,
        createdAt,
      });

      return {
        analysis: result.analysis,
        seed: {
          ...result.seed,
          creatorQuestion: null,
        },
        primaryAction: result.primaryAction,
        suggestedNextStep: getVideoNarrativeSuggestedNextStep(result.analysis),
      };
    });
    const text = JSON.stringify(outputs).toLowerCase();

    for (const term of forbiddenTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("imports only pure narrative modules", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoNarrativePipeline.test.ts"), "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).not.toContain("React");
    expect(importLines).not.toContain("BoardShell");
    expect(importLines).not.toContain("OpenAI");
    expect(importLines).not.toContain("Gemini");
    expect(importLines).not.toContain("fetch");
    expect(importLines).not.toContain("Prisma");
    expect(importLines).not.toContain("storage");
    expect(importLines).not.toContain("ffmpeg");
    expect(importLines).not.toContain("narrativeSource");
    expect(importLines).not.toContain("postCreationAdaptive");
  });
});
