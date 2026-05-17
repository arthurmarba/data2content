import {
  VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MAX_QUESTIONS,
  VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MIN_QUESTIONS,
  buildVideoNarrativeDiagnosisQuiz,
  dedupeVideoNarrativeDiagnosisQuizQuestions,
  getVideoNarrativeDiagnosisQuizQuestionPriority,
  sanitizeVideoNarrativeDiagnosisQuizText,
  type VideoNarrativeDiagnosisQuizInput,
  type VideoNarrativeDiagnosisQuizQuestion,
  type VideoNarrativeDiagnosisQuizQuestionKey,
} from "./videoNarrativeDiagnosisQuizBuilder";
import {
  buildVideoNarrativeStrategicDiagnosis,
  type VideoNarrativeDiagnosisCreatorSignal,
  type VideoNarrativeDiagnosisInput,
} from "./videoNarrativeDiagnosisLearningModel";
import {
  createEmptyVideoNarrativeAnalysis,
  type VideoNarrativeAnalysis,
} from "./videoNarrativeAnalysisTypes";
import {
  buildPostCreationVideoSeedFromAnalysis,
  createEmptyPostCreationVideoSeed,
  type PostCreationVideoSeed,
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

function makeLearningInput(
  overrides: Partial<VideoNarrativeDiagnosisInput> = {},
): VideoNarrativeDiagnosisInput {
  const analysis =
    overrides.analysis ??
    runVideoNarrativeMockProvider({
      input: {
        id: "quiz-builder-test",
        creatorQuestion: "Quero saber se vale postar para uma marca",
        createdAt: "2026-05-17T00:00:00.000Z",
      },
      options: { scenario: "brand_potential" },
    });
  const seed =
    overrides.seed ??
    buildPostCreationVideoSeedFromAnalysis({
      id: "quiz-builder-test-seed",
      analysis,
      creatorQuestion: "Quero saber se vale postar para uma marca",
      createdAt: "2026-05-17T00:00:00.000Z",
    });

  return {
    accessLevel: overrides.accessLevel ?? "free",
    analysis,
    seed,
    creatorQuestion:
      overrides.creatorQuestion === undefined
        ? "Quero saber se vale postar para uma marca"
        : overrides.creatorQuestion,
    quizAnswers: overrides.quizAnswers ?? [],
    creatorProfile: overrides.creatorProfile ?? null,
    instagramContext: overrides.instagramContext ?? null,
  };
}

function makeQuizInput(overrides: Partial<VideoNarrativeDiagnosisQuizInput> = {}): VideoNarrativeDiagnosisQuizInput {
  const learningInput = makeLearningInput({
    accessLevel: overrides.accessLevel ?? "free",
    analysis: overrides.analysis,
    seed: overrides.seed,
    creatorQuestion: overrides.creatorQuestion,
  });
  const diagnosis =
    overrides.diagnosis ??
    buildVideoNarrativeStrategicDiagnosis(learningInput);

  return {
    analysis: learningInput.analysis,
    seed: learningInput.seed,
    diagnosis,
    creatorQuestion: learningInput.creatorQuestion,
    accessLevel: learningInput.accessLevel,
    existingSignals: [],
    ...overrides,
  };
}

function makeEmptyQuizInput(overrides: Partial<VideoNarrativeDiagnosisQuizInput> = {}): VideoNarrativeDiagnosisQuizInput {
  const analysis = overrides.analysis ?? createEmptyVideoNarrativeAnalysis({ id: "empty-analysis" });
  const seed = overrides.seed ?? createEmptyPostCreationVideoSeed({ id: "empty-seed", analysisId: analysis.id });
  const diagnosis =
    overrides.diagnosis ??
    buildVideoNarrativeStrategicDiagnosis(makeLearningInput({
      accessLevel: overrides.accessLevel ?? "free",
      analysis,
      seed,
      creatorQuestion: null,
    }));

  return makeQuizInput({
    analysis,
    seed,
    diagnosis,
    creatorQuestion: null,
    accessLevel: overrides.accessLevel ?? "free",
    ...overrides,
  });
}

function questionKeys(input: VideoNarrativeDiagnosisQuizInput): VideoNarrativeDiagnosisQuizQuestionKey[] {
  return buildVideoNarrativeDiagnosisQuiz(input).questions.map((question) => question.key);
}

function hasQuestion(input: VideoNarrativeDiagnosisQuizInput, key: VideoNarrativeDiagnosisQuizQuestionKey): boolean {
  return questionKeys(input).includes(key);
}

function strongSignal(type: VideoNarrativeDiagnosisCreatorSignal["type"]): VideoNarrativeDiagnosisCreatorSignal {
  return {
    id: `existing-${type}`,
    type,
    value: type,
    source: "quiz_answer",
    confidence: "high",
    evidence: null,
    shouldPersistLater: false,
  };
}

function cloneAnalysis(analysis: VideoNarrativeAnalysis): VideoNarrativeAnalysis {
  return JSON.parse(JSON.stringify(analysis)) as VideoNarrativeAnalysis;
}

function cloneSeed(seed: PostCreationVideoSeed): PostCreationVideoSeed {
  return JSON.parse(JSON.stringify(seed)) as PostCreationVideoSeed;
}

describe("videoNarrativeDiagnosisQuizBuilder", () => {
  it("returns between 3 and 5 questions", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput());

    expect(result.questions.length).toBeGreaterThanOrEqual(VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MIN_QUESTIONS);
    expect(result.questions.length).toBeLessThanOrEqual(VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MAX_QUESTIONS);
  });

  it("includes creator_objective when creatorIntent is absent", () => {
    expect(hasQuestion(makeEmptyQuizInput(), "creator_objective")).toBe(true);
  });

  it("includes hook_direction when hook is weak", () => {
    const analysis = runVideoNarrativeMockProvider({
      input: { id: "weak-hook", creatorQuestion: "Gancho?", createdAt: null },
      options: { scenario: "weak_hook" },
    });
    const seed = buildPostCreationVideoSeedFromAnalysis({ id: "weak-hook-seed", analysis });

    expect(hasQuestion(makeQuizInput({ analysis, seed, creatorQuestion: "Gancho?" }), "hook_direction")).toBe(true);
  });

  it("includes hook_direction when suggestedHook is absent", () => {
    const input = makeEmptyQuizInput();

    expect(hasQuestion(input, "hook_direction")).toBe(true);
  });

  it("includes commercial question when brandPotential is enabled", () => {
    const keys = questionKeys(makeQuizInput({ accessLevel: "premium" }));

    expect(keys.some((key) => key === "commercial_intent" || key === "brand_integration_style")).toBe(true);
  });

  it("includes commercial_intent when creatorQuestion mentions marca/publi", () => {
    expect(hasQuestion(makeQuizInput({ creatorQuestion: "Isso vira publi para uma marca?" }), "commercial_intent")).toBe(true);
  });

  it("includes format_preference when seed suggestedFormat is absent", () => {
    const input = makeQuizInput();
    const seed = cloneSeed(input.seed);
    seed.suggestedFormat = null;

    expect(hasQuestion(makeQuizInput({ seed }), "format_preference")).toBe(true);
  });

  it("includes narrative_preference or missing_context when mainNarrative is absent", () => {
    const keys = questionKeys(makeEmptyQuizInput());

    expect(keys.some((key) => key === "narrative_preference" || key === "missing_context")).toBe(true);
  });

  it("includes collab_intent when creatorQuestion mentions collab", () => {
    expect(hasQuestion(makeQuizInput({ creatorQuestion: "Dá para fazer collab?" }), "collab_intent")).toBe(true);
  });

  it("places missing_context first when analysis is not useful", () => {
    const keys = questionKeys(makeEmptyQuizInput());

    expect(keys[0]).toBe("missing_context");
  });

  it("orders critical questions before less critical questions", () => {
    const keys = questionKeys(makeEmptyQuizInput());

    expect(keys.indexOf("missing_context")).toBeLessThan(keys.indexOf("production_effort"));
  });

  it("reduces creator_objective priority when strong content_goal exists", () => {
    const baseInput = makeEmptyQuizInput();
    const basePriority = getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "creator_objective",
      ...baseInput,
    });
    const reducedPriority = getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "creator_objective",
      ...baseInput,
      existingSignals: [strongSignal("content_goal")],
    });

    expect(reducedPriority).toBeLessThan(basePriority);
  });

  it("reduces hook_direction priority when strong hook_preference exists", () => {
    const baseInput = makeEmptyQuizInput();

    expect(getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "hook_direction",
      ...baseInput,
      existingSignals: [strongSignal("hook_preference")],
    })).toBeLessThan(getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "hook_direction",
      ...baseInput,
    }));
  });

  it("reduces commercial_intent priority when strong commercial_preference exists", () => {
    const baseInput = makeQuizInput();

    expect(getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "commercial_intent",
      ...baseInput,
      existingSignals: [strongSignal("commercial_preference")],
    })).toBeLessThan(getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "commercial_intent",
      ...baseInput,
    }));
  });

  it("reduces format_preference priority when strong format_preference exists", () => {
    const baseInput = makeEmptyQuizInput();

    expect(getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "format_preference",
      ...baseInput,
      existingSignals: [strongSignal("format_preference")],
    })).toBeLessThan(getVideoNarrativeDiagnosisQuizQuestionPriority({
      questionKey: "format_preference",
      ...baseInput,
    }));
  });

  it("dedupeVideoNarrativeDiagnosisQuizQuestions removes duplicate keys", () => {
    const [question] = buildVideoNarrativeDiagnosisQuiz(makeQuizInput()).questions;
    const duplicate: VideoNarrativeDiagnosisQuizQuestion = { ...question, id: `${question.id}-copy` };

    expect(dedupeVideoNarrativeDiagnosisQuizQuestions([question, duplicate])).toHaveLength(1);
  });

  it("each question has options", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput());

    expect(result.questions.every((question) => question.options.length > 0)).toBe(true);
  });

  it("each question has a consultative reason", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput());

    expect(result.questions.every((question) => question.reason.length > 8)).toBe(true);
  });

  it("creator_objective options generate content_goal signals", () => {
    const question = buildVideoNarrativeDiagnosisQuiz(makeEmptyQuizInput()).questions.find((item) => item.key === "creator_objective");

    expect(question?.options.every((option) => option.learningSignalType === "content_goal")).toBe(true);
  });

  it("hook_direction options generate hook_preference signals", () => {
    const question = buildVideoNarrativeDiagnosisQuiz(makeEmptyQuizInput()).questions.find((item) => item.key === "hook_direction");

    expect(question?.options.every((option) => option.learningSignalType === "hook_preference")).toBe(true);
  });

  it("commercial options generate commercial_preference signals", () => {
    const questions = buildVideoNarrativeDiagnosisQuiz(makeQuizInput()).questions.filter((item) =>
      item.key === "commercial_intent" || item.key === "brand_integration_style",
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((question) =>
      question.options.every((option) => option.learningSignalType === "commercial_preference"),
    )).toBe(true);
  });

  it("format_preference options generate format_preference signals", () => {
    const question = buildVideoNarrativeDiagnosisQuiz(makeEmptyQuizInput()).questions.find((item) => item.key === "format_preference");

    expect(question?.options.every((option) => option.learningSignalType === "format_preference")).toBe(true);
  });

  it("production_effort options generate production_constraint signals", () => {
    const question = buildVideoNarrativeDiagnosisQuiz(makeEmptyQuizInput()).questions.find((item) => item.key === "production_effort");

    expect(question?.options.every((option) => option.learningSignalType === "production_constraint")).toBe(true);
  });

  it("collab_intent options generate collab_preference signals", () => {
    const question = buildVideoNarrativeDiagnosisQuiz(makeQuizInput({ creatorQuestion: "Quero collab" })).questions.find((item) => item.key === "collab_intent");

    expect(question?.options.every((option) => option.learningSignalType === "collab_preference")).toBe(true);
  });

  it("does not block quiz for free access", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput({ accessLevel: "free" }));

    expect(result.questions.length).toBeGreaterThan(0);
  });

  it("suggests upgrade_for_deeper_diagnosis for free access with many locked sections", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput({ accessLevel: "free" }));

    expect(result.suggestedNextStep).toBe("upgrade_for_deeper_diagnosis");
  });

  it("suggests build_diagnosis for complete diagnosis", () => {
    const learningInput = makeLearningInput({ accessLevel: "premium" });
    const diagnosis = buildVideoNarrativeStrategicDiagnosis(learningInput);
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput({
      ...learningInput,
      diagnosis,
      accessLevel: "premium",
    }));

    expect(result.suggestedNextStep).toBe("build_diagnosis");
  });

  it("suggests answer_quiz for incomplete diagnosis", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeEmptyQuizInput({ accessLevel: "premium" }));

    expect(result.suggestedNextStep).toBe("answer_quiz");
  });

  it("sanitizeVideoNarrativeDiagnosisQuizText redacts AIza and env API keys", () => {
    expect(sanitizeVideoNarrativeDiagnosisQuizText("AIza1234567890abcdef")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeDiagnosisQuizText("GEMINI_API_KEY=abc")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeDiagnosisQuizText("GOOGLE_GENAI_API_KEY=abc")).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeDiagnosisQuizText redacts long base64", () => {
    expect(sanitizeVideoNarrativeDiagnosisQuizText("A".repeat(140))).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeDiagnosisQuizText redacts signed URLs", () => {
    expect(sanitizeVideoNarrativeDiagnosisQuizText("https://example.com/video.mp4?token=abc")).toBe("[redigido]");
  });

  it("keeps safe language across questions, helpers, reasons and options", () => {
    const result = buildVideoNarrativeDiagnosisQuiz(makeQuizInput({
      creatorQuestion: "Quero viralizar garantido",
    }));
    const content = JSON.stringify(result).toLowerCase();

    FORBIDDEN_TERMS.forEach((term) => {
      expect(content).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("does not import forbidden runtime integrations", () => {
    const source = require("fs").readFileSync(
      "src/app/dashboard/boards/videoUpload/videoNarrativeDiagnosisQuizBuilder.ts",
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
    ];

    forbidden.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });
});
