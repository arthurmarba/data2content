import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
} from "./postCreationAdaptiveTypes";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";
import {
  buildPostCreationAdaptiveAnswerKey,
  evaluatePostCreationAdaptiveAnswers,
  type PostCreationAdaptiveAnswerKey,
} from "./postCreationAdaptiveAnswerKey";

function detectionForInput(input: string) {
  return detectPostCreationAdaptiveIntent(input);
}

function quizForInput(input: string) {
  const detection = detectionForInput(input);
  const questions = buildPostCreationAdaptiveQuiz({ detection });
  return {
    detection,
    questions,
    answerKey: buildPostCreationAdaptiveAnswerKey({ detection, questions }),
  };
}

function detectionForMode(mode: PostCreationAdaptiveMode) {
  const base = detectPostCreationAdaptiveIntent("me ajuda");
  return {
    ...base,
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.8,
    normalizedInput: mode,
    originalInput: mode,
    detectedPauta: null,
    objective: null,
    brandCategory: mode === "brand_match" ? "skincare" : null,
    sourceComment: mode === "comment_to_post" ? "Como lidar com barulho em casa?" : null,
    signals: [],
    suggestedStage: mode === "unknown" ? "intent" as const : "quiz" as const,
  };
}

function answerFromOption(question: PostCreationAdaptiveQuestion, optionId: string): PostCreationAdaptiveAnswer {
  const option = question.options.find((candidate) => candidate.id === optionId);
  return {
    questionId: question.id,
    key: question.mapKey,
    optionId,
    value: option?.value ?? option?.label ?? optionId,
  };
}

function correctAnswers(answerKey: PostCreationAdaptiveAnswerKey): PostCreationAdaptiveAnswer[] {
  return answerKey.idealAnswers.map((answer) => ({ ...answer }));
}

function wrongAnswersForQuestions(
  questions: PostCreationAdaptiveQuestion[],
  answerKey: PostCreationAdaptiveAnswerKey,
): PostCreationAdaptiveAnswer[] {
  return questions.flatMap((question) => {
    const correctOptionId = answerKey.correctAnswersByQuestionId[question.id];
    const wrongOption = question.options.find((option) => option.id !== correctOptionId);
    return wrongOption ? [answerFromOption(question, wrongOption.id)] : [];
  });
}

function mixedAnswersForScore(
  questions: PostCreationAdaptiveQuestion[],
  answerKey: PostCreationAdaptiveAnswerKey,
  correctCount: number,
): PostCreationAdaptiveAnswer[] {
  return questions.map((question, index) => {
    const correctOptionId = answerKey.correctAnswersByQuestionId[question.id];
    const optionId =
      index < correctCount
        ? correctOptionId
        : question.options.find((option) => option.id !== correctOptionId)?.id || correctOptionId;
    return answerFromOption(question, optionId);
  });
}

describe("buildPostCreationAdaptiveAnswerKey", () => {
  it("returns the detected mode", () => {
    const { detection, questions } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions });

    expect(answerKey.mode).toBe(detection.mode);
  });

  it("creates questionKeys for every question", () => {
    const { questions, answerKey } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");

    expect(answerKey.questionKeys).toHaveLength(questions.length);
  });

  it("creates correctAnswersByQuestionId for every question id", () => {
    const { questions, answerKey } = quizForInput("Quero atrair marcas de skincare");

    expect(Object.keys(answerKey.correctAnswersByQuestionId).sort()).toEqual(
      questions.map((question) => question.id).sort(),
    );
  });

  it("uses option.recommended as correctOptionId when it exists", () => {
    const { questions, answerKey } = quizForInput("Quero transformar comentário em conteúdo");
    const question = questions[0]!;
    const recommendedOption = question.options.find((option) => option.recommended);

    expect(recommendedOption).toBeTruthy();
    expect(answerKey.correctAnswersByQuestionId[question.id]).toBe(recommendedOption?.id);
  });

  it("falls back to the first option when there is no recommended option or heuristic match", () => {
    const detection = detectionForInput("Quero validar uma pauta");
    const questions: PostCreationAdaptiveQuestion[] = [
      {
        id: "custom-where",
        mapKey: "where",
        type: "strategic_choice",
        title: "Onde gravar?",
        helper: null,
        required: true,
        options: [
          { id: "room", label: "No quarto" },
          { id: "street", label: "Na rua" },
        ],
      },
    ];
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions });

    expect(answerKey.correctAnswersByQuestionId["custom-where"]).toBe("room");
  });

  it("creates idealAnswers with questionId and optionId", () => {
    const { questions, answerKey } = quizForInput("Quero planejar meus posts da semana");

    expect(answerKey.idealAnswers).toHaveLength(questions.length);
    for (const answer of answerKey.idealAnswers) {
      expect(answer.questionId).toBeTruthy();
      expect(answer.optionId).toBe(answerKey.correctAnswersByQuestionId[answer.questionId]);
    }
  });

  it("idealAnswers use the correct answers, not user answers", () => {
    const { questions, answerKey } = quizForInput("Não sei o que postar essa semana");
    const wrongAnswers = wrongAnswersForQuestions(questions, answerKey);

    expect(wrongAnswers.length).toBeGreaterThan(0);
    expect(answerKey.idealAnswers.map((answer) => answer.optionId)).toEqual(
      answerKey.questionKeys.map((questionKey) => questionKey.correctOptionId),
    );
    expect(answerKey.idealAnswers.map((answer) => answer.optionId)).not.toEqual(
      wrongAnswers.map((answer) => answer.optionId),
    );
  });

  it("creates a non-empty idealPlan", () => {
    const { answerKey } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");

    expect(answerKey.idealPlan.pauta).toBeTruthy();
    expect(answerKey.idealPlan.objective).toBeTruthy();
    expect(answerKey.idealPlan.fiveW2H.what).toBeTruthy();
  });

  it("creates legacyHandoff with decision, idea, and blueprint", () => {
    const { answerKey } = quizForInput("Quero atrair marcas de skincare");

    expect(answerKey.legacyHandoff.decision).toBeTruthy();
    expect(answerKey.legacyHandoff.idea).toBeTruthy();
    expect(answerKey.legacyHandoff.blueprint).toBeTruthy();
    expect(answerKey.legacyHandoff.blueprint.whatToPost).toBeTruthy();
  });

  it("creates feedback for every question", () => {
    const { answerKey } = quizForInput("Quero fazer collab com alguém do meu nicho");

    for (const questionKey of answerKey.questionKeys) {
      expect(questionKey.feedback.correct).toBeTruthy();
      expect(questionKey.feedback.incorrect).toBeTruthy();
      expect(questionKey.feedback.rationale).toBeTruthy();
    }
  });

  it("feedback avoids hard visible language", () => {
    const { answerKey } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");
    const feedbackText = answerKey.questionKeys
      .flatMap((questionKey) => [
        questionKey.feedback.correct,
        questionKey.feedback.incorrect,
        questionKey.feedback.rationale,
      ])
      .join(" ");

    expect(feedbackText).not.toMatch(/errad/i);
  });

  it("works with validate_pauta", () => {
    const { answerKey } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");

    expect(answerKey.mode).toBe("validate_pauta");
    expect(answerKey.questionKeys.length).toBeGreaterThan(0);
  });

  it("works with discover_pauta", () => {
    const { answerKey } = quizForInput("Não sei o que postar essa semana");

    expect(answerKey.mode).toBe("discover_pauta");
    expect(answerKey.questionKeys.length).toBeGreaterThan(0);
  });

  it("works with brand_match", () => {
    const { answerKey } = quizForInput("Quero atrair marcas de skincare");

    expect(answerKey.mode).toBe("brand_match");
    expect(answerKey.idealPlan.brandMatch?.enabled).toBe(true);
  });

  it("works with comment_to_post", () => {
    const { answerKey } = quizForInput("Alguém comentou isso aqui e quero transformar em post");

    expect(answerKey.mode).toBe("comment_to_post");
    expect(answerKey.questionKeys.length).toBeGreaterThan(0);
  });

  it("works with collab_match", () => {
    const { answerKey } = quizForInput("Quero fazer collab com alguém do meu nicho");

    expect(answerKey.mode).toBe("collab_match");
    expect(answerKey.idealPlan.collabMatch?.enabled).toBe(true);
  });

  it("works with weekly_plan", () => {
    const { answerKey } = quizForInput("Quero planejar meus posts da semana");

    expect(answerKey.mode).toBe("weekly_plan");
    expect(answerKey.questionKeys.length).toBeGreaterThan(0);
  });

  it("does not change idealPlan when user answers miss the answer key", () => {
    const { questions, answerKey } = quizForInput("Não sei o que postar essa semana");
    const before = JSON.stringify(answerKey.idealPlan);
    const wrongAnswers = wrongAnswersForQuestions(questions, answerKey);
    const wrongPlan = buildPostCreationStrategicPlan({
      detection: detectionForInput("Não sei o que postar essa semana"),
      questions,
      answers: wrongAnswers,
    });

    evaluatePostCreationAdaptiveAnswers({ answerKey, answers: wrongAnswers });

    expect(JSON.stringify(answerKey.idealPlan)).toBe(before);
    expect(answerKey.idealPlan).toEqual(
      buildPostCreationStrategicPlan({
        detection: detectionForInput("Não sei o que postar essa semana"),
        questions,
        answers: answerKey.idealAnswers,
      }),
    );
    expect(wrongPlan).toBeTruthy();
  });

  it("does not break with empty questions", () => {
    const detection = detectionForMode("unknown");
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions: [] });
    const result = evaluatePostCreationAdaptiveAnswers({ answerKey, answers: [] });

    expect(answerKey.questionKeys).toEqual([]);
    expect(answerKey.correctAnswersByQuestionId).toEqual({});
    expect(answerKey.idealAnswers).toEqual([]);
    expect(answerKey.score).toEqual({ max: 0, passing: 0 });
    expect(result.score.total).toBe(0);
  });
});

describe("evaluatePostCreationAdaptiveAnswers", () => {
  it("calculates full score when the user chooses every correct answer", () => {
    const { answerKey } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: correctAnswers(answerKey),
    });

    expect(result.score.correct).toBe(answerKey.questionKeys.length);
    expect(result.score.percentage).toBe(100);
    expect(result.evaluations.every((evaluation) => evaluation.isCorrect)).toBe(true);
  });

  it("calculates zero when the user chooses a different answer for every question", () => {
    const { questions, answerKey } = quizForInput("Quero gravar um POV sobre minha família fazendo barulho");
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: wrongAnswersForQuestions(questions, answerKey),
    });

    expect(result.score.correct).toBe(0);
    expect(result.score.percentage).toBe(0);
    expect(result.evaluations.every((evaluation) => evaluation.isCorrect === false)).toBe(true);
  });

  it("handles missing answers", () => {
    const { answerKey } = quizForInput("Quero atrair marcas de skincare");
    const result = evaluatePostCreationAdaptiveAnswers({ answerKey, answers: [] });

    expect(result.evaluations).toHaveLength(answerKey.questionKeys.length);
    expect(result.evaluations.every((evaluation) => evaluation.selectedOptionId === null)).toBe(true);
    expect(result.score.correct).toBe(0);
  });

  it("keeps score percentage between 0 and 100", () => {
    const { questions, answerKey } = quizForInput("Quero planejar meus posts da semana");
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: mixedAnswersForScore(questions, answerKey, 2),
    });

    expect(result.score.percentage).toBeGreaterThanOrEqual(0);
    expect(result.score.percentage).toBeLessThanOrEqual(100);
  });

  it("changes score label according to performance", () => {
    const { questions, answerKey } = quizForInput("Não sei o que postar essa semana");

    expect(evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: mixedAnswersForScore(questions, answerKey, 4),
    }).score.label).toBe("Leitura afiada");
    expect(evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: mixedAnswersForScore(questions, answerKey, 3),
    }).score.label).toBe("Boa leitura estratégica");
    expect(evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: mixedAnswersForScore(questions, answerKey, 2),
    }).score.label).toBe("Caminho promissor");
    expect(evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: mixedAnswersForScore(questions, answerKey, 1),
    }).score.label).toBe("Ainda dá para calibrar");
  });

  it("uses the expected score summary", () => {
    const { questions, answerKey } = quizForInput("Não sei o que postar essa semana");
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: mixedAnswersForScore(questions, answerKey, 2),
    });

    expect(result.score.summary).toBe("Você acertou 2 de 4 decisões estratégicas.");
  });
});
