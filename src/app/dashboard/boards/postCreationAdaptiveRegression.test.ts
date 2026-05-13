import {
  buildPostCreationAdaptiveAnswerKey,
  evaluatePostCreationAdaptiveAnswers,
} from "./postCreationAdaptiveAnswerKey";
import { buildAdaptiveDecisionViewModel } from "./postCreationAdaptiveDecisionViewModel";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { normalizePostCreationAdaptiveSnapshot } from "./postCreationAdaptiveSnapshot";
import { buildPostCreationAdaptiveStudyContext } from "./postCreationAdaptiveStudyContext";
import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
} from "./postCreationAdaptiveTypes";

const ADAPTIVE_MODES: PostCreationAdaptiveMode[] = [
  "validate_pauta",
  "discover_pauta",
  "create_by_goal",
  "format_guidance",
  "brand_match",
  "collab_match",
  "comment_to_post",
  "weekly_plan",
  "unknown",
];

const INPUT_BY_MODE: Record<PostCreationAdaptiveMode, string> = {
  validate_pauta: "Quero gravar um video sobre minha familia fazendo barulho quando tento relaxar",
  discover_pauta: "Nao sei o que postar essa semana",
  create_by_goal: "Quero gerar mais comentarios com meu conteudo",
  format_guidance: "Melhor reels ou carrossel para uma pauta de rotina?",
  brand_match: "Quero atrair marcas de beleza sem parecer publi forcada",
  collab_match: "Quero uma ideia de collab com outro creator",
  comment_to_post: "Transforma esse comentario em post: como lidar com barulho em casa?",
  weekly_plan: "Quero organizar minha semana de conteudo",
  unknown: "Me ajuda a pensar em conteudo",
};

const SIGNALS_BY_MODE: Record<PostCreationAdaptiveMode, string[]> = {
  validate_pauta: ["validar pauta", "rotina"],
  discover_pauta: ["ideias", "semana"],
  create_by_goal: ["comentarios", "engajamento"],
  format_guidance: ["formato", "reels", "carrossel"],
  brand_match: ["marca", "beleza"],
  collab_match: ["collab", "creator"],
  comment_to_post: ["comentario", "resposta"],
  weekly_plan: ["semana", "cadencia"],
  unknown: [],
};

function detectionForMode(mode: PostCreationAdaptiveMode): PostCreationAdaptiveIntentDetection {
  const originalInput = INPUT_BY_MODE[mode];
  return {
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.86,
    normalizedInput: originalInput.toLowerCase(),
    originalInput,
    detectedPauta:
      mode === "validate_pauta" || mode === "format_guidance"
        ? "rotina em casa com barulho de familia"
        : null,
    objective: mode === "create_by_goal" ? "gerar comentarios" : null,
    brandCategory: mode === "brand_match" ? "beleza" : null,
    sourceComment: mode === "comment_to_post" ? "Como lidar com barulho em casa?" : null,
    signals: SIGNALS_BY_MODE[mode],
    suggestedStage: mode === "unknown" ? "intent" : "quiz",
  };
}

function buildRegressionStudyContext() {
  return buildPostCreationAdaptiveStudyContext({
    periodDays: 90,
    plannerSlots: [
      {
        id: "slot-reels-comments",
        format: "Reels",
        narrative: "Rotina real",
        narrativeForm: ["Cena e reacao"],
        context: "Casa",
        proposal: "Comentario",
        contentIntent: "Gerar conversa",
        contentSignals: ["Comentarios"],
        themes: ["rotina", "familia"],
        themeKeyword: "barulho",
        hook: "Voce ja tentou relaxar e a casa inteira resolveu fazer barulho?",
        caption: "Comenta se isso acontece na sua casa e compartilha com alguem da familia.",
        commercialMode: "produto na rotina",
        proofStyle: "uso real",
        stance: "humor de rotina",
        comments: 92,
        shares: 54,
        saves: 18,
        totalInteractions: 3600,
        evidenceCount: 4,
        day: 2,
        hour: 19,
        evidencePosts: [
          {
            id: "post-reels-rotina",
            title: "POV rotina em casa",
            format: "Reels",
            totalInteractions: 3600,
            comments: 92,
            shares: 54,
          },
        ],
      },
      {
        id: "slot-carousel-saves",
        format: "Carrossel",
        narrative: "Passo a passo",
        narrativeForm: ["Passo a passo"],
        context: "Tutorial",
        proposal: "Salvamento",
        contentIntent: "Salvamento",
        contentSignals: ["Salvamentos"],
        themes: ["skincare", "autocuidado"],
        themeKeyword: "checklist",
        caption: "Salva este checklist para consultar antes de gravar.",
        saves: 140,
        shares: 20,
        comments: 10,
        totalInteractions: 2400,
        evidenceCount: 3,
        evidencePosts: [
          {
            id: "post-carousel-checklist",
            title: "Checklist de rotina",
            format: "Carrossel",
            saves: 140,
            totalInteractions: 2400,
          },
        ],
      },
      {
        id: "slot-stories-brand",
        format: "Stories",
        narrative: "Bastidor",
        narrativeForm: ["Conversa de bastidor"],
        context: "Uso real",
        proposal: "Marca",
        contentIntent: "Conversa",
        commercialMode: "marca na rotina",
        themes: ["beleza", "rotina"],
        caption: "Me conta qual produto aparece de forma natural na sua rotina.",
        comments: 34,
        evidenceCount: 2,
        evidencePosts: [
          {
            id: "post-stories-brand",
            title: "Produto na rotina real",
            format: "Stories",
            comments: 34,
          },
        ],
      },
    ],
    recommendations: [
      {
        id: "rec-brand-beauty",
        formatLabel: "Reels",
        narrativeLabel: "Rotina real",
        contextLabel: "Casa",
        proposalLabel: "Marca",
        expectedMetrics: {
          commentsP50: 45,
          sharesP50: 30,
          savesP50: 22,
          viewsP50: 20000,
        },
        evidenceCount: 3,
      },
    ],
    outcomeSignals: [
      {
        id: "outcome-comments",
        label: "Comentarios",
        comments: 80,
        evidenceCount: 3,
      },
    ],
    evidencePosts: [
      {
        id: "direct-evidence-skincare",
        title: "Rotina de skincare em casa",
        caption: "Voce ja percebeu como um detalhe muda o resultado?",
        format: "Reels",
        interactions: 2100,
        comments: 40,
      },
    ],
    brandSignals: [
      {
        id: "brand-beauty",
        label: "Beleza",
        brandCategory: "beleza",
        confidence: 0.9,
        evidenceCount: 3,
      },
    ],
    collabSignals: [
      {
        id: "collab-reaction",
        label: "Creator de humor de rotina",
        creatorProfile: "Creator de humor de rotina",
        collaborationAngle: "reacao",
        opportunityScore: 88,
        evidenceCount: 3,
      },
    ],
  });
}

function answerForOption(
  question: PostCreationAdaptiveQuestion,
  optionId: string,
): PostCreationAdaptiveAnswer {
  const option = question.options.find((candidate) => candidate.id === optionId);
  return {
    questionId: question.id,
    key: question.mapKey,
    optionId,
    value: option?.value ?? option?.label ?? optionId,
    answeredAt: "2026-05-11T12:00:00.000Z",
  };
}

function assertQuestionShape(question: PostCreationAdaptiveQuestion) {
  expect(question.required).toBe(true);
  expect(question.id.trim()).toBeTruthy();
  expect(question.title.trim()).toBeTruthy();
  expect(question.mapKey).toBeTruthy();
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

function buildWrongAnswers(
  questions: PostCreationAdaptiveQuestion[],
  correctAnswersByQuestionId: Record<string, string>,
): PostCreationAdaptiveAnswer[] {
  return questions
    .map((question) => {
      const wrongOption = question.options.find(
        (option) => option.id !== correctAnswersByQuestionId[question.id],
      );
      return wrongOption ? answerForOption(question, wrongOption.id) : null;
    })
    .filter((answer): answer is PostCreationAdaptiveAnswer => Boolean(answer));
}

describe("post creation adaptive regression", () => {
  it.each(ADAPTIVE_MODES)("builds a valid game flow for %s", (mode) => {
    const detection = detectionForMode(mode);
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext: buildRegressionStudyContext(),
    });

    expect(questions.length).toBeGreaterThan(0);
    questions.forEach(assertQuestionShape);

    expect(answerKey.questionKeys).toHaveLength(questions.length);
    expect(answerKey.idealAnswers).toHaveLength(questions.length);
    expect(answerKey.gameQuestions).toHaveLength(questions.length);
    expect(answerKey.score.max).toBe(questions.length);
    expect(answerKey.idealPlan).toEqual(expect.objectContaining({
      fiveW2H: expect.any(Object),
      nextActions: expect.any(Array),
    }));
    expect(answerKey.legacyHandoff).toEqual(expect.objectContaining({
      decision: expect.any(Object),
      idea: expect.any(Object),
      blueprint: expect.any(Object),
    }));

    for (const gameQuestion of answerKey.gameQuestions) {
      const sourceQuestion = questions.find((question) => question.id === gameQuestion.questionId);
      expect(sourceQuestion).toBeTruthy();
      expect(gameQuestion.isValid).toBe(true);
      expect(gameQuestion.validationErrors).toEqual([]);
      expect(gameQuestion.options).toHaveLength(4);
      expect(gameQuestion.options.filter((option) => option.role === "correct")).toHaveLength(1);
      expect(gameQuestion.options.filter((option) => option.role === "distractor")).toHaveLength(3);
      expect(sourceQuestion?.options.some((option) => option.id === gameQuestion.correctOptionId)).toBe(true);
      expect(gameQuestion.options.every((option) => option.reason.trim().length > 0)).toBe(true);
    }
  });

  it.each(ADAPTIVE_MODES)("scores ideal answers at 100% for %s", (mode) => {
    const detection = detectionForMode(mode);
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext: buildRegressionStudyContext(),
    });
    const { evaluations, score } = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: answerKey.idealAnswers,
    });

    expect(score.total).toBe(questions.length);
    expect(score.correct).toBe(score.total);
    expect(score.percentage).toBe(100);
    expect(score.label).toBe("Leitura afiada");
    expect(score.summary).toBe(`Você acertou ${score.correct} de ${score.total} decisões estratégicas.`);
    expect(evaluations).toHaveLength(questions.length);
    for (const evaluation of evaluations) {
      expect(evaluation.isCorrect).toBe(true);
      expect(evaluation.feedbackMessage.trim()).toBeTruthy();
      expect(evaluation.rationale.trim()).toBeTruthy();
    }
  });

  it.each(ADAPTIVE_MODES)("keeps evaluation safe when every answer misses for %s", (mode) => {
    const detection = detectionForMode(mode);
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext: buildRegressionStudyContext(),
    });
    const wrongAnswers = buildWrongAnswers(questions, answerKey.correctAnswersByQuestionId);
    const { evaluations, score } = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: wrongAnswers,
    });

    expect(wrongAnswers).toHaveLength(questions.length);
    expect(evaluations).toHaveLength(answerKey.questionKeys.length);
    expect(score.total).toBe(questions.length);
    expect(score.percentage).toBeLessThan(100);
    for (const evaluation of evaluations) {
      expect(evaluation.selectedOptionId).toBeTruthy();
      expect(evaluation.feedbackMessage.trim()).toBeTruthy();
      expect(evaluation.rationale.trim()).toBeTruthy();
    }
  });

  it.each(["format_guidance", "brand_match"] as PostCreationAdaptiveMode[])(
    "exposes GameContract feedback through the decision view model for %s",
    (mode) => {
      const detection = detectionForMode(mode);
      const questions = buildPostCreationAdaptiveQuiz({ detection });
      const answerKey = buildPostCreationAdaptiveAnswerKey({
        detection,
        questions,
        studyContext: buildRegressionStudyContext(),
      });
      const question = questions[0];
      const correctOptionId = answerKey.correctAnswersByQuestionId[question.id];
      const wrongOption = question.options.find((option) => option.id !== correctOptionId);
      expect(wrongOption).toBeTruthy();

      const correctAnswers = [answerForOption(question, correctOptionId)];
      const correctEvaluations = evaluatePostCreationAdaptiveAnswers({
        answerKey,
        answers: correctAnswers,
      }).evaluations;
      const correctViewModel = buildAdaptiveDecisionViewModel({
        question,
        answers: correctAnswers,
        questionIndex: 0,
        questionCount: questions.length,
        answerKey,
        evaluations: correctEvaluations,
      });

      expect(correctViewModel.shouldRevealFeedback).toBe(true);
      expect(correctViewModel.feedbackMode).toBe("correct");
      expect(correctViewModel.correctOptionLabel).toBeTruthy();
      expect(correctViewModel.correctReason).toBeTruthy();
      expect(correctViewModel.selectedIncorrectReason).toBeNull();
      expect(correctViewModel.feedbackEvidence.length).toBeLessThanOrEqual(3);

      const wrongAnswers = [answerForOption(question, wrongOption!.id)];
      const wrongEvaluations = evaluatePostCreationAdaptiveAnswers({
        answerKey,
        answers: wrongAnswers,
      }).evaluations;
      const wrongViewModel = buildAdaptiveDecisionViewModel({
        question,
        answers: wrongAnswers,
        questionIndex: 0,
        questionCount: questions.length,
        answerKey,
        evaluations: wrongEvaluations,
      });

      expect(wrongViewModel.shouldRevealFeedback).toBe(true);
      expect(wrongViewModel.feedbackMode).toBe("incorrect");
      expect(wrongViewModel.correctOptionLabel).toBeTruthy();
      expect(wrongViewModel.correctReason).toBeTruthy();
      expect(wrongViewModel.selectedIncorrectReason).toBeTruthy();
      expect(wrongViewModel.feedbackEvidence.length).toBeLessThanOrEqual(3);
      expect(new Set(wrongViewModel.feedbackEvidence).size).toBe(wrongViewModel.feedbackEvidence.length);
    },
  );

  it("normalizes a quiz snapshot and preserves restored answers for the view model", () => {
    const detection = detectionForMode("format_guidance");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext: buildRegressionStudyContext(),
    });
    const answers = answerKey.idealAnswers.slice(0, 2);
    const snapshot = normalizePostCreationAdaptiveSnapshot({
      input: detection.originalInput,
      status: "quiz",
      detection,
      questions,
      answers,
      plan: null,
      legacyHandoff: null,
      error: null,
      updatedAt: "2026-05-11T12:00:00.000Z",
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.input).toBe(detection.originalInput);
    expect(snapshot?.status).toBe("quiz");
    expect(snapshot?.detection).toEqual(detection);
    expect(snapshot?.questions).toHaveLength(questions.length);
    expect(snapshot?.answers).toEqual(answers);

    const evaluations = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers,
    }).evaluations;
    const answeredViewModel = buildAdaptiveDecisionViewModel({
      question: questions[0],
      answers: snapshot!.answers,
      questionIndex: 0,
      questionCount: questions.length,
      answerKey,
      evaluations,
    });
    const nextViewModel = buildAdaptiveDecisionViewModel({
      question: questions[2],
      answers: snapshot!.answers,
      questionIndex: 2,
      questionCount: questions.length,
      answerKey,
      evaluations,
    });

    expect(answeredViewModel.selectedOptionId).toBe(answers[0].optionId);
    expect(answeredViewModel.canAdvance).toBe(true);
    expect(answeredViewModel.shouldRevealFeedback).toBe(true);
    expect(nextViewModel.selectedOptionId).toBeNull();
    expect(nextViewModel.canAdvance).toBe(false);
    expect(nextViewModel.shouldRevealFeedback).toBe(false);
  });
});
