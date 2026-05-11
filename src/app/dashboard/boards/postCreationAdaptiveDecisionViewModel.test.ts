import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveQuestion,
} from "./postCreationAdaptiveTypes";
import type {
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveAnswerKey,
} from "./postCreationAdaptiveAnswerKey";
import {
  buildPostCreationAdaptiveAnswerKey,
  evaluatePostCreationAdaptiveAnswers,
} from "./postCreationAdaptiveAnswerKey";
import { buildAdaptiveDecisionViewModel } from "./postCreationAdaptiveDecisionViewModel";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";

function baseQuestion(overrides: Partial<PostCreationAdaptiveQuestion> = {}): PostCreationAdaptiveQuestion {
  return {
    id: "q-objective",
    title: "Qual objetivo principal?",
    helper: "Escolha o resultado que guia a execução.",
    mapKey: "objective",
    type: "strategic_choice",
    required: true,
    options: [
      { id: "comments", label: "Comentários", reason: "Puxa conversa.", recommended: true },
      { id: "reach", label: "Alcance", reason: "Amplia descoberta." },
      { id: "saves", label: "Salvamentos", reason: "Aumenta utilidade." },
    ],
    ...overrides,
  };
}

function answerFor(questionId = "q-objective", optionId = "reach"): PostCreationAdaptiveAnswer {
  return {
    questionId,
    key: "objective",
    optionId,
    value: "Alcance",
    answeredAt: "2026-05-09T00:00:00.000Z",
  };
}

function answerKeyFor(
  question: PostCreationAdaptiveQuestion,
  correctOptionId = "comments",
): PostCreationAdaptiveAnswerKey {
  return {
    mode: "validate_pauta",
    questionKeys: [
      {
        questionId: question.id,
        mapKey: question.mapKey,
        correctOptionId,
        feedback: {
          correct: "Esse é o caminho mais forte para esta pauta.",
          incorrect: "Essa opção pode funcionar, mas eu iria por outro caminho.",
          rationale: "O objetivo define o comportamento que o conteúdo precisa provocar.",
          evidence: ["Formato forte: Reels"],
        },
      },
    ],
    correctAnswersByQuestionId: {
      [question.id]: correctOptionId,
    },
    idealAnswers: [
      {
        questionId: question.id,
        key: question.mapKey,
        optionId: correctOptionId,
        value: correctOptionId,
      },
    ],
    idealPlan: {} as PostCreationAdaptiveAnswerKey["idealPlan"],
    legacyHandoff: {} as PostCreationAdaptiveAnswerKey["legacyHandoff"],
    gameQuestions: [
      {
        questionId: question.id,
        mapKey: question.mapKey,
        correctOptionId,
        correctReason: "Comentários vencem porque a pauta pede conversa e identificação.",
        incorrectReasonsByOptionId: question.options.reduce<Record<string, string>>((result, option) => {
          if (option.id !== correctOptionId) {
            result[option.id] = `${option.label} faz sentido, mas perde força perto da conversa.`;
          }
          return result;
        }, {}),
        evidence: ["Formato forte: Reels", "Sinal de engajamento: Comentários"],
        options: question.options.map((option) => ({
          optionId: option.id,
          role: option.id === correctOptionId ? "correct" : "distractor",
          reason: option.id === correctOptionId
            ? "Comentários vencem porque a pauta pede conversa e identificação."
            : `${option.label} faz sentido, mas perde força perto da conversa.`,
          evidence: option.id === correctOptionId ? ["Formato forte: Reels"] : [],
        })),
        isValid: true,
        validationErrors: [],
      },
    ],
    score: {
      max: 1,
      passing: 1,
    },
  };
}

function evaluationFor(
  questionId = "q-objective",
  overrides: Partial<PostCreationAdaptiveAnswerEvaluation> = {},
): PostCreationAdaptiveAnswerEvaluation {
  return {
    questionId,
    selectedOptionId: "comments",
    correctOptionId: "comments",
    isCorrect: true,
    feedbackTitle: "Boa aposta",
    feedbackMessage: "Esse é o caminho mais forte para esta pauta.",
    rationale: "O objetivo define o comportamento que o conteúdo precisa provocar.",
    evidence: [],
    ...overrides,
  };
}

describe("buildAdaptiveDecisionViewModel", () => {
  it("creates a view model with id, title, helper, mapKey, and questionType", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.id).toBe(question.id);
    expect(viewModel.title).toBe(question.title);
    expect(viewModel.helper).toBe(question.helper);
    expect(viewModel.mapKey).toBe(question.mapKey);
    expect(viewModel.questionType).toBe(question.type);
  });

  it("sets progressLabel to Pergunta 1 de 4", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.progressLabel).toBe("Pergunta 1 de 4");
  });

  it("calculates progressValue and keeps it between 0 and 1", () => {
    const first = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });
    const last = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 3,
      questionCount: 4,
    });
    const overflow = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 99,
      questionCount: 4,
    });

    expect(first.progressValue).toBe(0.25);
    expect(last.progressValue).toBe(1);
    expect(overflow.progressValue).toBe(1);
  });

  it("translates objective to Objetivo", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ mapKey: "objective" }),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.visualStep).toBe("Objetivo");
  });

  it("translates brand to Marca", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ mapKey: "brand" }),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.visualStep).toBe("Marca");
  });

  it("uses fallback Decisão for an unknown mapKey", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ mapKey: "unknown_key" as any }),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.visualStep).toBe("Decisão");
  });

  it("gets selectedOptionId from an existing answer", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.selectedOptionId).toBe("reach");
  });

  it("returns the selectedAnswer when found", () => {
    const answer = answerFor();
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answer],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.selectedAnswer).toBe(answer);
  });

  it("marks selected only on the selected option", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.options.map((option) => [option.id, option.selected])).toEqual([
      ["comments", false],
      ["reach", true],
      ["saves", false],
    ]);
  });

  it("sets canAdvance false when required and unanswered", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ required: true }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.canAdvance).toBe(false);
  });

  it("sets canAdvance true when required and answered", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ required: true }),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.canAdvance).toBe(true);
  });

  it("sets canAdvance true when required is false, even without answer", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ required: false }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.canAdvance).toBe(true);
  });

  it("uses Proxima decisao before the last question", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 1,
      questionCount: 4,
    });

    expect(viewModel.nextLabel).toBe("Próxima decisão");
  });

  it("uses Ver plano estrategico on the last question", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 3,
      questionCount: 4,
    });

    expect(viewModel.nextLabel).toBe("Ver plano estratégico");
  });

  it("preserves option order", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.options.map((option) => option.id)).toEqual(["comments", "reach", "saves"]);
  });

  it("normalizes empty helper to null", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ helper: "   " }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.helper).toBeNull();
  });

  it("normalizes empty option reason to null", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({
        options: [
          { id: "one", label: "Uma", reason: "   " },
          { id: "two", label: "Duas", reason: "Razão" },
          { id: "three", label: "Três" },
        ],
      }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.options[0]?.reason).toBeNull();
    expect(viewModel.options[1]?.reason).toBe("Razão");
    expect(viewModel.options[2]?.reason).toBeNull();
  });

  it("works integrated with intent detection and adaptive quiz builder", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const firstQuestion = questions[0];
    expect(firstQuestion).toBeTruthy();

    const viewModel = buildAdaptiveDecisionViewModel({
      question: firstQuestion!,
      answers: [
        {
          questionId: firstQuestion!.id,
          key: firstQuestion!.mapKey,
          optionId: firstQuestion!.options[0]!.id,
          value: firstQuestion!.options[0]!.label,
        },
      ],
      questionIndex: 0,
      questionCount: questions.length,
    });

    expect(viewModel.visualStep).toBe("Marca");
    expect(viewModel.options[0]?.selected).toBe(true);
    expect(viewModel.canAdvance).toBe(true);
  });

  it("does not break with a negative questionIndex", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: -10,
      questionCount: 4,
    });

    expect(viewModel.questionIndex).toBe(0);
    expect(viewModel.progressLabel).toBe("Pergunta 1 de 4");
    expect(viewModel.progressValue).toBe(0.25);
  });

  it("does not break with questionCount zero", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 0,
    });

    expect(viewModel.questionCount).toBe(1);
    expect(viewModel.progressLabel).toBe("Pergunta 1 de 1");
    expect(viewModel.progressValue).toBe(1);
  });

  it("keeps legacy behavior when answerKey is not provided", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.selectedOptionId).toBe("reach");
    expect(viewModel.correctOptionId).toBeNull();
    expect(viewModel.selectedIsCorrect).toBeNull();
    expect(viewModel.feedbackTitle).toBeNull();
    expect(viewModel.feedbackMessage).toBeNull();
    expect(viewModel.feedbackRationale).toBeNull();
    expect(viewModel.feedbackEvidence).toEqual([]);
    expect(viewModel.correctOptionLabel).toBeNull();
    expect(viewModel.correctReason).toBeNull();
    expect(viewModel.selectedIncorrectReason).toBeNull();
    expect(viewModel.selectedOptionReason).toBeNull();
    expect(viewModel.gameEvidence).toEqual([]);
    expect(viewModel.feedbackMode).toBe("neutral");
    expect(viewModel.shouldRevealFeedback).toBe(false);
    expect(viewModel.options.map((option) => option.isCorrect)).toEqual([null, null, null]);
    expect(viewModel.options.map((option) => option.gameRole)).toEqual([null, null, null]);
  });

  it("gets correctOptionId from answerKey", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "saves"),
    });

    expect(viewModel.correctOptionId).toBe("saves");
  });

  it("sets selectedIsCorrect true when selectedOptionId matches correctOptionId", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.selectedIsCorrect).toBe(true);
  });

  it("sets selectedIsCorrect false when selectedOptionId differs from correctOptionId", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "reach")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.selectedIsCorrect).toBe(false);
  });

  it("sets selectedIsCorrect null when there is no answer", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.selectedIsCorrect).toBeNull();
  });

  it("does not reveal feedback without an answer", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.shouldRevealFeedback).toBe(false);
  });

  it("reveals feedback when there is an answer and a correctOptionId", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.shouldRevealFeedback).toBe(true);
  });

  it("attaches feedbackTitle, feedbackMessage, and rationale from evaluations", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [evaluationFor(question.id)],
    });

    expect(viewModel.feedbackTitle).toBe("Boa aposta");
    expect(viewModel.feedbackMessage).toBe("Esse é o caminho mais forte para esta pauta.");
    expect(viewModel.feedbackRationale).toBe("O objetivo define o comportamento que o conteúdo precisa provocar.");
  });

  it("uses game evidence when feedback is revealed even without an evaluation", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.feedbackEvidence).toEqual(["Formato forte: Reels", "Sinal de engajamento: Comentários"]);
  });

  it("attaches feedbackEvidence from the evaluation", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [
        evaluationFor(question.id, {
          evidence: ["Formato forte: Reels", "Sinal de engajamento: Comentários"],
        }),
      ],
    });

    expect(viewModel.feedbackEvidence).toEqual([
      "Formato forte: Reels",
      "Sinal de engajamento: Comentários",
    ]);
  });

  it("limits and cleans feedbackEvidence", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [
        evaluationFor(question.id, {
          evidence: [
            "Formato forte: Reels",
            " ",
            "Formato forte: Reels",
            "Sinal de engajamento: Comentários",
            "Post de referência: POV rotina",
            "Extra",
          ],
        }),
      ],
    });

    expect(viewModel.feedbackEvidence).toEqual([
      "Formato forte: Reels",
      "Sinal de engajamento: Comentários",
      "Post de referência: POV rotina",
    ]);
  });

  it("keeps new game feedback fields empty when answerKey has no gameQuestions", () => {
    const question = baseQuestion();
    const answerKey = {
      ...answerKeyFor(question, "comments"),
      gameQuestions: undefined,
    } as unknown as PostCreationAdaptiveAnswerKey;
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey,
      evaluations: [evaluationFor(question.id)],
    });

    expect(viewModel.correctOptionLabel).toBeNull();
    expect(viewModel.correctReason).toBeNull();
    expect(viewModel.selectedIncorrectReason).toBeNull();
    expect(viewModel.selectedOptionReason).toBeNull();
    expect(viewModel.gameEvidence).toEqual([]);
    expect(viewModel.feedbackMode).toBe("correct");
  });

  it("uses a valid gameQuestion to explain a correct answer", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [
        evaluationFor(question.id, {
          evidence: ["Formato forte: Reels", "Formato forte: Reels"],
        }),
      ],
    });

    expect(viewModel.correctOptionLabel).toBe("Comentários");
    expect(viewModel.correctReason).toBe("Comentários vencem porque a pauta pede conversa e identificação.");
    expect(viewModel.selectedIncorrectReason).toBeNull();
    expect(viewModel.selectedOptionReason).toBe("Comentários vencem porque a pauta pede conversa e identificação.");
    expect(viewModel.gameEvidence).toEqual(["Formato forte: Reels", "Sinal de engajamento: Comentários"]);
    expect(viewModel.feedbackEvidence).toEqual(["Formato forte: Reels", "Sinal de engajamento: Comentários"]);
    expect(viewModel.feedbackMode).toBe("correct");
    expect(viewModel.options.map((option) => [option.id, option.gameRole])).toEqual([
      ["comments", "correct"],
      ["reach", "distractor"],
      ["saves", "distractor"],
    ]);
    expect(viewModel.options[0]?.gameReason).toBe("Comentários vencem porque a pauta pede conversa e identificação.");
  });

  it("uses a valid gameQuestion to explain a wrong answer", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "reach")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [
        evaluationFor(question.id, {
          selectedOptionId: "reach",
          correctOptionId: "comments",
          isCorrect: false,
          feedbackTitle: "Quase",
          evidence: ["Formato forte: Reels"],
        }),
      ],
    });

    expect(viewModel.correctOptionLabel).toBe("Comentários");
    expect(viewModel.correctReason).toBe("Comentários vencem porque a pauta pede conversa e identificação.");
    expect(viewModel.selectedIncorrectReason).toBe("Alcance faz sentido, mas perde força perto da conversa.");
    expect(viewModel.selectedOptionReason).toBe("Alcance faz sentido, mas perde força perto da conversa.");
    expect(viewModel.feedbackEvidence).toEqual(["Formato forte: Reels", "Sinal de engajamento: Comentários"]);
    expect(viewModel.feedbackMode).toBe("incorrect");
  });

  it("ignores invalid gameQuestion contracts and keeps fallback behavior", () => {
    const question = baseQuestion();
    const answerKey = answerKeyFor(question, "comments");
    answerKey.gameQuestions = answerKey.gameQuestions.map((gameQuestion) => ({
      ...gameQuestion,
      isValid: false,
      validationErrors: ["GameQuestion precisa ter exatamente 4 opções."],
    }));
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey,
      evaluations: [evaluationFor(question.id)],
    });

    expect(viewModel.correctOptionId).toBe("comments");
    expect(viewModel.feedbackTitle).toBe("Boa aposta");
    expect(viewModel.correctReason).toBeNull();
    expect(viewModel.selectedIncorrectReason).toBeNull();
    expect(viewModel.gameEvidence).toEqual([]);
    expect(viewModel.options.map((option) => option.gameRole)).toEqual([null, null, null]);
  });

  it("keeps feedback null when no evaluation exists", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [evaluationFor("other-question")],
    });

    expect(viewModel.feedbackTitle).toBeNull();
    expect(viewModel.feedbackMessage).toBeNull();
    expect(viewModel.feedbackRationale).toBeNull();
    expect(viewModel.feedbackEvidence).toEqual(["Formato forte: Reels", "Sinal de engajamento: Comentários"]);
  });

  it("marks option.isCorrect true only on the correct option", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.options.map((option) => [option.id, option.isCorrect])).toEqual([
      ["comments", true],
      ["reach", false],
      ["saves", false],
    ]);
  });

  it("sets option.isCorrect null when there is no correctOptionId", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.options.map((option) => option.isCorrect)).toEqual([null, null, null]);
  });

  it("marks isIncorrectSelection only on the selected wrong option", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "reach")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.options.map((option) => [option.id, option.isIncorrectSelection])).toEqual([
      ["comments", false],
      ["reach", true],
      ["saves", false],
    ]);
  });

  it("does not mark isIncorrectSelection on the selected correct option", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "comments")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
    });

    expect(viewModel.options.map((option) => option.isIncorrectSelection)).toEqual([false, false, false]);
  });

  it("does not treat recommended as correct automatically without answerKey", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor("q-objective", "comments")],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.options[0]?.recommended).toBe(true);
    expect(viewModel.correctOptionId).toBeNull();
    expect(viewModel.options[0]?.isCorrect).toBeNull();
  });

  it("works integrated with detection, quiz builder, answer key, and evaluation", () => {
    const detection = detectPostCreationAdaptiveIntent(
      "Quero gravar um POV sobre minha família fazendo barulho quando tento relaxar",
    );
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions });
    const firstQuestion = questions[0]!;
    const correctOptionId = answerKey.correctAnswersByQuestionId[firstQuestion.id]!;
    const answers = [
      {
        questionId: firstQuestion.id,
        key: firstQuestion.mapKey,
        optionId: correctOptionId,
        value: correctOptionId,
      },
    ];
    const { evaluations } = evaluatePostCreationAdaptiveAnswers({ answerKey, answers });

    const viewModel = buildAdaptiveDecisionViewModel({
      question: firstQuestion,
      answers,
      questionIndex: 0,
      questionCount: questions.length,
      answerKey,
      evaluations,
    });

    expect(viewModel.correctOptionId).toBe(correctOptionId);
    expect(viewModel.selectedIsCorrect).toBe(true);
    expect(viewModel.shouldRevealFeedback).toBe(true);
    expect(viewModel.feedbackTitle).toBe("Boa aposta");
  });

  it("does not expose feedback to be revealed before the user answers", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [evaluationFor(question.id, { selectedOptionId: null, isCorrect: false })],
    });

    expect(viewModel.correctOptionId).toBe("comments");
    expect(viewModel.shouldRevealFeedback).toBe(false);
    expect(viewModel.feedbackEvidence).toEqual([]);
    expect(viewModel.correctReason).toBeNull();
    expect(viewModel.selectedIncorrectReason).toBeNull();
    expect(viewModel.gameEvidence).toEqual([]);
    expect(viewModel.feedbackMode).toBe("neutral");
  });

  it("exposes feedback to be revealed after the user answers", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [answerFor(question.id, "reach")],
      questionIndex: 0,
      questionCount: 1,
      answerKey: answerKeyFor(question, "comments"),
      evaluations: [
        evaluationFor(question.id, {
          selectedOptionId: "reach",
          correctOptionId: "comments",
          isCorrect: false,
          feedbackTitle: "Quase",
          feedbackMessage: "Essa opção pode funcionar, mas eu iria por outro caminho.",
        }),
      ],
    });

    expect(viewModel.shouldRevealFeedback).toBe(true);
    expect(viewModel.feedbackTitle).toBe("Quase");
    expect(viewModel.feedbackMessage).toBe("Essa opção pode funcionar, mas eu iria por outro caminho.");
  });
});
