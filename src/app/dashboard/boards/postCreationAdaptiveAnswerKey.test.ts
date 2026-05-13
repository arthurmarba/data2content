import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationAdaptiveAnswerKey } from "./postCreationAdaptiveAnswerKey";
import type { PostCreationAdaptiveAnswer } from "./postCreationAdaptiveTypes";

describe("buildPostCreationAdaptiveAnswerKey", () => {
  const validateDetection = detectPostCreationAdaptiveIntent("Quero gravar um POV sobre rotina");
  const validateQuestions = buildPostCreationAdaptiveQuiz({ detection: validateDetection });

  it("evaluates a perfect match with recommended answers", () => {
    const answers: PostCreationAdaptiveAnswer[] = validateQuestions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));

    const result = buildPostCreationAdaptiveAnswerKey({
      detection: validateDetection,
      questions: validateQuestions,
      answers,
    });

    expect(result.answeredQuestions).toBe(result.totalQuestions);
    expect(result.recommendedMatches).toBe(result.totalQuestions);
    expect(result.summary).toContain("alinhada");
    expect(result.evaluations.every((e) => e.isRecommendedChoice)).toBe(true);
  });

  it("evaluates choices that differ from recommendations", () => {
    const answers: PostCreationAdaptiveAnswer[] = validateQuestions.map((q, index) => ({
      questionId: q.id,
      key: q.mapKey,
      // Choose non-recommended for the first question
      optionId: index === 0
        ? q.options.find((o) => !o.recommended)?.id || q.options[1]!.id
        : q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));

    const result = buildPostCreationAdaptiveAnswerKey({
      detection: validateDetection,
      questions: validateQuestions,
      answers,
    });

    expect(result.recommendedMatches).toBeLessThan(result.totalQuestions);
    expect(result.adjustments.length).toBeGreaterThan(0);
    expect(result.summary).toContain("ajuste");
  });

  it("handles missing answers gracefully", () => {
    const answers: PostCreationAdaptiveAnswer[] = [
      {
        questionId: validateQuestions[0]!.id,
        key: validateQuestions[0]!.mapKey,
        optionId: validateQuestions[0]!.options[0]!.id,
        value: null,
      },
    ];

    const result = buildPostCreationAdaptiveAnswerKey({
      detection: validateDetection,
      questions: validateQuestions,
      answers,
    });

    expect(result.answeredQuestions).toBe(1);
    expect(result.evaluations.some((e) => e.selectedOptionId === null)).toBe(true);
    expect(result.adjustments.some((a) => a.includes("pendente"))).toBe(true);
    expect(result.summary).toContain("ajuste");
  });

  it("works with unknown mode", () => {
    const unknownDetection = detectPostCreationAdaptiveIntent("me ajuda");
    const unknownQuestions = buildPostCreationAdaptiveQuiz({ detection: unknownDetection });
    const answers: PostCreationAdaptiveAnswer[] = [];

    const result = buildPostCreationAdaptiveAnswerKey({
      detection: unknownDetection,
      questions: unknownQuestions,
      answers,
    });

    expect(result.mode).toBe("unknown");
    expect(result.summary).toContain("faltam escolhas");
    expect(result.evaluations.length).toBe(unknownQuestions.length);
  });

  it("enforces consultative and safe language", () => {
    const answers: PostCreationAdaptiveAnswer[] = validateQuestions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options[0]!.id,
      value: null,
    }));

    const result = buildPostCreationAdaptiveAnswerKey({
      detection: validateDetection,
      questions: validateQuestions,
      answers,
    });

    const fullText = [
      result.summary,
      ...result.strengths,
      ...result.adjustments,
      ...result.evaluations.map((e) => e.reason),
    ].join(" ").toLowerCase();

    const forbiddenWords = [
      "acertou", "errou", "erro", "errado", "venceu", "perdeu",
      "nota", "pontuação", "garantido", "comprovado", "certeza", "sempre performa"
    ];

    for (const word of forbiddenWords) {
      expect(fullText).not.toContain(word);
    }
  });
});
