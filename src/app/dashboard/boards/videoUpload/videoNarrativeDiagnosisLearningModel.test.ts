import {
  buildVideoNarrativeStrategicDiagnosis,
  extractVideoNarrativeCreatorSignals,
  getVideoNarrativeDiagnosisLockedSections,
  hasUsefulVideoNarrativeStrategicDiagnosis,
  sanitizeVideoNarrativeDiagnosisText,
  type VideoNarrativeDiagnosisInput,
  type VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";
import { createEmptyVideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import {
  buildPostCreationVideoSeedFromAnalysis,
  createEmptyPostCreationVideoSeed,
} from "./videoNarrativePostCreationSeed";
import { runVideoNarrativeMockProvider } from "./videoNarrativeMockProvider";

const FORBIDDEN_TERMS = [
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
  "treinado permanentemente",
];

function makeInput(overrides: Partial<VideoNarrativeDiagnosisInput> = {}): VideoNarrativeDiagnosisInput {
  const analysis =
    overrides.analysis ??
    runVideoNarrativeMockProvider({
      input: {
        id: "diagnosis-test",
        creatorQuestion: "Quero saber se vale postar para uma marca",
        createdAt: "2026-05-17T00:00:00.000Z",
      },
      options: { scenario: "brand_potential" },
    });
  const seed =
    overrides.seed ??
    buildPostCreationVideoSeedFromAnalysis({
      id: "diagnosis-test-seed",
      analysis,
      creatorQuestion: "Quero saber se vale postar para uma marca",
      createdAt: "2026-05-17T00:00:00.000Z",
    });

  return {
    accessLevel: "free",
    analysis,
    seed,
    creatorQuestion: "Quero saber se vale postar para uma marca",
    quizAnswers: [],
    creatorProfile: null,
    instagramContext: null,
    ...overrides,
  };
}

function stringifyDiagnosis(diagnosis: VideoNarrativeStrategicDiagnosis): string {
  return JSON.stringify(diagnosis).toLowerCase();
}

describe("videoNarrativeDiagnosisLearningModel", () => {
  it("builds a free diagnosis with mainNarrative, whatVideoCommunicates and creatorIntent", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput());

    expect(diagnosis.mainNarrative).toBeTruthy();
    expect(diagnosis.whatVideoCommunicates).toContain("Esse vídeo comunica");
    expect(diagnosis.creatorIntent).toContain("marca");
  });

  it("limits free brandPotential to at most 2 territories", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput());

    expect(diagnosis.brandPotential.territories.length).toBeLessThanOrEqual(2);
  });

  it("limits free blueprint scenes to at most 2", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput());

    expect(diagnosis.blueprint.scenes.length).toBeLessThanOrEqual(2);
  });

  it("locks scriptDirection for free", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "free" }));

    expect(diagnosis.scriptDirection.locked).toBe(true);
    expect(diagnosis.scriptDirection.opening).toBeNull();
  });

  it("unlocks scriptDirection for premium", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "premium" }));

    expect(diagnosis.scriptDirection.locked).toBe(false);
    expect(diagnosis.scriptDirection.opening).toBeTruthy();
  });

  it("locks instagramComparison for premium without Instagram", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "premium" }));

    expect(diagnosis.instagramComparison.locked).toBe(true);
  });

  it("unlocks instagramComparison for instagram_optimized when connected", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(
      makeInput({
        accessLevel: "instagram_optimized",
        instagramContext: {
          connected: true,
          topNarratives: ["rotina orgânica -> produto -> continuidade"],
          topFormats: ["reel"],
        },
      }),
    );

    expect(diagnosis.instagramComparison.locked).toBe(false);
  });

  it("finds matchingNarratives with simple overlap", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(
      makeInput({
        accessLevel: "instagram_optimized",
        creatorProfile: {
          knownSignals: [],
          recurringNarratives: ["rotina orgânica -> produto -> continuidade"],
        },
        instagramContext: {
          connected: true,
          topNarratives: ["rotina orgânica -> produto -> continuidade"],
        },
      }),
    );

    expect(diagnosis.instagramComparison.matchingNarratives).toContain("rotina orgânica -> produto -> continuidade");
  });

  it("finds matchingFormats with simple overlap", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(
      makeInput({
        accessLevel: "instagram_optimized",
        creatorProfile: { knownSignals: [], preferredFormats: ["reel"] },
        instagramContext: { connected: true, topFormats: ["reel"] },
      }),
    );

    expect(diagnosis.instagramComparison.matchingFormats).toContain("reel");
  });

  it("prioritizes quiz objective/intent/goal for creatorIntent", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(
      makeInput({
        quizAnswers: [{ questionId: "q1", key: "objective", value: "Validar pauta antes de postar" }],
      }),
    );

    expect(diagnosis.creatorIntent).toBe("Validar pauta antes de postar");
  });

  it("uses creatorQuestion as creatorIntent fallback", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(
      makeInput({ quizAnswers: [], creatorQuestion: "Quero melhorar o gancho" }),
    );

    expect(diagnosis.creatorIntent).toContain("gancho");
  });

  it("strategicReading crosses video, stated objective and recommended adjustment", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(
      makeInput({
        quizAnswers: [{ questionId: "q1", key: "goal", value: "Criar versão para publi" }],
      }),
    );

    expect(diagnosis.strategicReading).toContain("Pelo vídeo");
    expect(diagnosis.strategicReading).toContain("Pelo objetivo declarado");
    expect(diagnosis.strategicReading).toContain("O melhor caminho");
  });

  it("suggestedHook uses seed scriptDirection opening", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput());

    expect(diagnosis.suggestedHook).toBeTruthy();
  });

  it("suggestedHook uses recommendedAdjustment when hook is weak", () => {
    const analysis = runVideoNarrativeMockProvider({
      input: { id: "weak-hook", creatorQuestion: "Gancho?", createdAt: null },
      options: { scenario: "weak_hook" },
    });
    const seed = buildPostCreationVideoSeedFromAnalysis({ id: "weak-hook-seed", analysis });
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ analysis, seed }));

    expect(diagnosis.suggestedHook).toContain("Abrir");
  });

  it("brandPotential uses analysis brandMatch and seed hints", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "premium" }));

    expect(diagnosis.brandPotential.enabled).toBe(true);
    expect(diagnosis.brandPotential.territories.length).toBeGreaterThan(0);
  });

  it("premium shows more brand territories than free", () => {
    const free = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "free" }));
    const premium = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "premium" }));

    expect(premium.brandPotential.territories.length).toBeGreaterThanOrEqual(free.brandPotential.territories.length);
  });

  it("limits free nextActions", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "free" }));

    expect(diagnosis.nextActions.length).toBeLessThanOrEqual(2);
  });

  it("premium includes complete nextActions", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({ accessLevel: "premium" }));

    expect(diagnosis.nextActions.length).toBeGreaterThan(2);
  });

  it("lockedSections free contains premium and Instagram reasons", () => {
    const locked = getVideoNarrativeDiagnosisLockedSections({ accessLevel: "free" });

    expect(locked.some((section) => section.reason === "requires_premium")).toBe(true);
    expect(locked.some((section) => section.reason === "requires_instagram_connection")).toBe(true);
  });

  it("lockedSections premium without Instagram contains Instagram reason", () => {
    const locked = getVideoNarrativeDiagnosisLockedSections({ accessLevel: "premium", instagramConnected: false });

    expect(locked.some((section) => section.reason === "requires_instagram_connection")).toBe(true);
  });

  it("lockedSections instagram_optimized connected reduces Instagram blocks", () => {
    const locked = getVideoNarrativeDiagnosisLockedSections({ accessLevel: "instagram_optimized", instagramConnected: true });

    expect(locked.some((section) => section.reason === "requires_instagram_connection")).toBe(false);
  });

  it("extracts content_goal from quiz objective", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({
      quizAnswers: [{ questionId: "q1", key: "objective", value: "Validar pauta" }],
    }));

    expect(signals.some((signal) => signal.type === "content_goal")).toBe(true);
  });

  it("extracts hook_preference from quiz hook", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({
      quizAnswers: [{ questionId: "q1", key: "hook", value: "Direto ao ponto" }],
    }));

    expect(signals.some((signal) => signal.type === "hook_preference")).toBe(true);
  });

  it("extracts format_preference from quiz format", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({
      quizAnswers: [{ questionId: "q1", key: "format", value: "reel" }],
    }));

    expect(signals.some((signal) => signal.type === "format_preference")).toBe(true);
  });

  it("extracts commercial_preference from creatorQuestion with publi/marca", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({ creatorQuestion: "Serve para publi de marca?" }));

    expect(signals.some((signal) => signal.type === "commercial_preference")).toBe(true);
  });

  it("extracts recurring_pain from creatorQuestion with gancho", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({ creatorQuestion: "Como melhorar o gancho?" }));

    expect(signals.some((signal) => signal.type === "recurring_pain")).toBe(true);
  });

  it("extracts collab_preference from creatorQuestion with collab", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({ creatorQuestion: "Dá para fazer collab?" }));

    expect(signals.some((signal) => signal.type === "collab_preference")).toBe(true);
  });

  it("extracts brand_territory from analysis and seed", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput());

    expect(signals.some((signal) => signal.type === "brand_territory")).toBe(true);
  });

  it("extracts instagram_context signals when connected", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({
      instagramContext: {
        connected: true,
        topNarratives: ["rotina"],
        brandTerritories: ["beleza"],
        strongestMetricsSummary: "Histórico conectado futuro.",
      },
    }));

    expect(signals.some((signal) => signal.source === "instagram_context")).toBe(true);
  });

  it("keeps shouldPersistLater false for all creator signals", () => {
    const signals = extractVideoNarrativeCreatorSignals(makeInput({
      quizAnswers: [{ questionId: "q1", key: "objective", value: "Validar pauta" }],
      instagramContext: { connected: true, topNarratives: ["rotina"] },
    }));

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.shouldPersistLater === false)).toBe(true);
  });

  it("hasUsefulVideoNarrativeStrategicDiagnosis returns true for useful diagnosis", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput());

    expect(hasUsefulVideoNarrativeStrategicDiagnosis(diagnosis)).toBe(true);
  });

  it("hasUsefulVideoNarrativeStrategicDiagnosis returns false for empty diagnosis", () => {
    const analysis = createEmptyVideoNarrativeAnalysis({ id: "empty" });
    const seed = createEmptyPostCreationVideoSeed({ id: "empty-seed", analysisId: "empty" });
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({
      analysis,
      seed,
      creatorQuestion: null,
      quizAnswers: [],
    }));

    expect(hasUsefulVideoNarrativeStrategicDiagnosis(diagnosis)).toBe(false);
  });

  it("sanitizeVideoNarrativeDiagnosisText redacts AIza and env API keys", () => {
    expect(sanitizeVideoNarrativeDiagnosisText("AIza1234567890abcdef")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeDiagnosisText("GEMINI_API_KEY=abc")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeDiagnosisText("GOOGLE_GENAI_API_KEY=abc")).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeDiagnosisText redacts long base64", () => {
    const base64 = "A".repeat(140);

    expect(sanitizeVideoNarrativeDiagnosisText(base64)).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeDiagnosisText redacts signed URLs", () => {
    expect(sanitizeVideoNarrativeDiagnosisText("https://example.com/video.mp4?token=abc")).toBe("[redigido]");
  });

  it("keeps safe language across diagnosis, locked sections, next actions and signals", () => {
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(makeInput({
      quizAnswers: [{ questionId: "q1", key: "objective", value: "viralizar garantido" }],
    }));
    const content = stringifyDiagnosis(diagnosis);

    FORBIDDEN_TERMS.forEach((term) => {
      expect(content).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("does not import forbidden runtime integrations", () => {
    const source = require("fs").readFileSync(
      "src/app/dashboard/boards/videoUpload/videoNarrativeDiagnosisLearningModel.ts",
      "utf8",
    ) as string;
    const forbidden = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "componentes",
      "hooks",
      "route",
      "upload service",
      "storage provider",
      "analytics provider",
      "ffmpeg",
      "UI",
      "Stripe",
      "billing",
      "@google/genai",
      "Instagram",
    ];

    forbidden.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });
});
