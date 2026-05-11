import type { PostCreationAdaptiveMode, PostCreationAdaptiveQuestionMapKey } from "./postCreationAdaptiveTypes";
import { buildPostCreationAdaptiveAnswerKey } from "./postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationAdaptiveStudyContext } from "./postCreationAdaptiveStudyContext";

function detectionForMode(mode: PostCreationAdaptiveMode) {
  return {
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.8,
    normalizedInput: mode,
    originalInput: mode,
    detectedPauta: null,
    objective: null,
    brandCategory: mode === "brand_match" ? "skincare" : null,
    sourceComment: mode === "comment_to_post" ? "Como lidar com barulho em casa?" : null,
    signals: mode === "brand_match" ? ["marca"] : [],
    suggestedStage: mode === "unknown" ? "intent" as const : "quiz" as const,
  };
}

const adaptiveModes: PostCreationAdaptiveMode[] = [
  "validate_pauta",
  "discover_pauta",
  "create_by_goal",
  "brand_match",
  "collab_match",
  "comment_to_post",
  "weekly_plan",
  "unknown",
];

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

describe("adaptive quiz game contract compatibility", () => {
  it("generates structurally complete game questions for every adaptive mode", () => {
    let totalQuestions = 0;

    for (const mode of adaptiveModes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      totalQuestions += quiz.length;

      for (const question of quiz) {
        expect(question.required).toBe(true);
        expect(question.id.trim()).toBeTruthy();
        expect(question.mapKey).toBeTruthy();
        expect(allowedKeys.has(question.mapKey)).toBe(true);
        expect(question.options).toHaveLength(4);

        const optionIds = new Set<string>();
        for (const option of question.options) {
          expect(option.id.trim()).toBeTruthy();
          expect(option.label.trim()).toBeTruthy();
          expect(option.reason?.trim()).toBeTruthy();
          optionIds.add(option.id);
        }
        expect(optionIds.size).toBe(question.options.length);
      }
    }

    expect(totalQuestions).toBe(33);
  });

  it("builds valid game contracts for every generated question in every mode", () => {
    for (const mode of adaptiveModes) {
      const detection = detectionForMode(mode);
      const questions = buildPostCreationAdaptiveQuiz({ detection });
      const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions });

      expect(answerKey.gameQuestions).toHaveLength(questions.length);
      for (const gameQuestion of answerKey.gameQuestions) {
        expect(gameQuestion.isValid).toBe(true);
        expect(gameQuestion.validationErrors).toEqual([]);
        expect(gameQuestion.options).toHaveLength(4);
        expect(gameQuestion.options.filter((option) => option.role === "correct")).toHaveLength(1);
        expect(gameQuestion.options.filter((option) => option.role === "distractor")).toHaveLength(3);
        expect(gameQuestion.correctOptionId).toBeTruthy();
        expect(gameQuestion.options.some((option) => option.optionId === gameQuestion.correctOptionId)).toBe(true);
        expect(gameQuestion.options.every((option) => option.reason.trim().length > 0)).toBe(true);
      }
    }
  });

  it("keeps StudyContext-guided answer keys compatible with the game contract", () => {
    const detection = detectionForMode("discover_pauta");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const studyContext = buildPostCreationAdaptiveStudyContext({
      recommendations: [
        {
          id: "rec-carousel",
          format: "Carrossel",
          narrative: "Rotina real",
          context: "Casa",
          comments: 12,
          saves: 180,
          shares: 28,
          evidenceCount: 4,
        },
      ],
      evidencePosts: [
        {
          id: "post-carousel",
          title: "Carrossel de rotina que gerou salvamentos",
          format: "Carrossel",
          saves: 180,
        },
      ],
    });

    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext,
    });
    const formatQuestion = questions.find((question) => question.id === "discover-format");
    const formatGameQuestion = answerKey.gameQuestions.find((question) => question.questionId === "discover-format");

    expect(formatQuestion?.options.some((option) => option.id === answerKey.correctAnswersByQuestionId["discover-format"])).toBe(true);
    expect(answerKey.correctAnswersByQuestionId["discover-format"]).toBe("carousel");
    expect(formatGameQuestion?.correctOptionId).toBe("carousel");
    expect(formatGameQuestion?.isValid).toBe(true);
    expect(formatGameQuestion?.validationErrors).toEqual([]);
    expect(answerKey.idealAnswers.find((answer) => answer.questionId === "discover-format")?.optionId).toBe("carousel");
  });
});
