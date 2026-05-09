import type { PostCreationAdaptiveMode, PostCreationAdaptiveQuestionMapKey } from "./postCreationAdaptiveTypes";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";

function quizFor(input: string) {
  return buildPostCreationAdaptiveQuiz({
    detection: detectPostCreationAdaptiveIntent(input),
  });
}

function mapKeysFor(input: string) {
  return quizFor(input).map((question) => question.mapKey);
}

function detectionForMode(mode: PostCreationAdaptiveMode) {
  return {
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.8,
    normalizedInput: mode,
    originalInput: mode,
    detectedPauta: null,
    objective: null,
    brandCategory: null,
    sourceComment: null,
    signals: [],
    suggestedStage: mode === "unknown" ? "intent" as const : "quiz" as const,
  };
}

describe("buildPostCreationAdaptiveQuiz", () => {
  it("returns between 3 and 5 questions for validate_pauta", () => {
    const quiz = quizFor("Quero gravar um POV sobre minha família fazendo barulho");

    expect(quiz.length).toBeGreaterThanOrEqual(3);
    expect(quiz.length).toBeLessThanOrEqual(5);
  });

  it("builds discover_pauta questions around objective, format or narrative, and effort", () => {
    const keys = mapKeysFor("Não sei o que postar essa semana");

    expect(keys).toContain("objective");
    expect(keys.some((key) => key === "format" || key === "narrative")).toBe(true);
    expect(keys).toContain("effort");
  });

  it("builds create_by_goal questions around objective, narrative, format, and CTA", () => {
    const keys = mapKeysFor("Quero gerar mais comentários");

    expect(keys).toEqual(expect.arrayContaining(["objective", "narrative", "format", "cta"]));
  });

  it("builds brand_match questions around brand, how, narrative, and why or format", () => {
    const keys = mapKeysFor("Quero atrair marcas de skincare");

    expect(keys).toEqual(expect.arrayContaining(["brand", "how", "narrative"]));
    expect(keys.some((key) => key === "why" || key === "format")).toBe(true);
  });

  it("builds collab_match questions around collab, who, and objective", () => {
    const keys = mapKeysFor("Quero fazer collab com alguém do meu nicho");

    expect(keys).toEqual(expect.arrayContaining(["collab", "who", "objective"]));
  });

  it("builds comment_to_post questions around why, format, narrative, and CTA", () => {
    const keys = mapKeysFor("Alguém comentou isso aqui e quero transformar em post");

    expect(keys).toEqual(expect.arrayContaining(["why", "format", "narrative", "cta"]));
  });

  it("builds weekly_plan questions around objective, schedule, and format", () => {
    const keys = mapKeysFor("Quero planejar meus posts da semana");

    expect(keys).toEqual(expect.arrayContaining(["objective", "schedule", "format"]));
  });

  it("returns clarification questions for unknown intent", () => {
    const quiz = quizFor("me ajuda");
    const keys = quiz.map((question) => question.mapKey);

    expect(keys).toEqual(expect.arrayContaining(["objective", "what"]));
    expect(quiz[0]?.title).toMatch(/o que voce quer fazer|o que você quer fazer/i);
  });

  it("gives every generated question at least 3 options", () => {
    const modes: PostCreationAdaptiveMode[] = [
      "validate_pauta",
      "discover_pauta",
      "create_by_goal",
      "brand_match",
      "collab_match",
      "comment_to_post",
      "weekly_plan",
      "unknown",
    ];

    for (const mode of modes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      expect(quiz.every((question) => question.options.length >= 3)).toBe(true);
    }
  });

  it("does not return more than 5 questions for any mode", () => {
    const modes: PostCreationAdaptiveMode[] = [
      "validate_pauta",
      "discover_pauta",
      "create_by_goal",
      "brand_match",
      "collab_match",
      "comment_to_post",
      "weekly_plan",
      "unknown",
    ];

    for (const mode of modes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      expect(quiz.length).toBeLessThanOrEqual(5);
    }
  });

  it("gives every question id, title, type, mapKey, and options", () => {
    const quiz = quizFor("Quero atrair marcas de skincare");

    for (const question of quiz) {
      expect(question.id).toBeTruthy();
      expect(question.title).toBeTruthy();
      expect(question.type).toBeTruthy();
      expect(question.mapKey).toBeTruthy();
      expect(Array.isArray(question.options)).toBe(true);
    }
  });

  it("marks recommended options where a strategic default makes sense", () => {
    const quiz = quizFor("Quero transformar comentário em conteúdo");
    const questionsWithRecommended = quiz.filter((question) =>
      question.options.some((option) => option.recommended)
    );

    expect(questionsWithRecommended.length).toBe(quiz.length);
  });

  it("uses only declared map keys", () => {
    const allowedKeys = new Set<PostCreationAdaptiveQuestionMapKey>([
      "who",
      "what",
      "where",
      "when",
      "why",
      "how",
      "how_much",
      "hook",
      "cta",
      "format",
      "narrative",
      "objective",
      "brand",
      "collab",
      "effort",
      "schedule",
    ]);
    const quiz = quizFor("Quero planejar meus posts da semana");

    expect(quiz.every((question) => allowedKeys.has(question.mapKey))).toBe(true);
  });
});
