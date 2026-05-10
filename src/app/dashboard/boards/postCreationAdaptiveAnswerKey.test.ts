import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
} from "./postCreationAdaptiveTypes";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";
import {
  buildPostCreationAdaptiveStudyContext,
  type PostCreationAdaptiveStudyContext,
} from "./postCreationAdaptiveStudyContext";
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

function customQuestion(
  mapKey: PostCreationAdaptiveQuestionMapKey,
  options: PostCreationAdaptiveQuestionOption[],
): PostCreationAdaptiveQuestion {
  return {
    id: `custom-${mapKey}`,
    mapKey,
    type: "strategic_choice",
    title: `Pergunta ${mapKey}`,
    helper: null,
    required: true,
    options,
  };
}

function answerKeyForCustomQuestion(params: {
  mapKey: PostCreationAdaptiveQuestionMapKey;
  options: PostCreationAdaptiveQuestionOption[];
  studyContext?: PostCreationAdaptiveStudyContext | null;
}) {
  const detection = detectionForMode("validate_pauta");
  const question = customQuestion(params.mapKey, params.options);
  const answerKey = buildPostCreationAdaptiveAnswerKey({
    detection,
    questions: [question],
    studyContext: params.studyContext,
  });

  return { detection, question, answerKey };
}

const highStudyContext = buildPostCreationAdaptiveStudyContext({
  plannerSlots: [
    {
      slotId: "slot-reels",
      dayOfWeek: 2,
      blockStartHour: 19,
      format: "Reels",
      categories: {
        context: ["Casa"],
        proposal: ["Comentário"],
        tone: "Humor",
      },
      narrativeForm: ["Rotina real"],
      contentSignals: ["Comentários"],
      comments: 120,
      shares: 80,
      saves: 30,
      expectedMetrics: { viewsP50: 25_000, sharesP50: 180 },
      evidenceCount: 3,
      evidencePosts: [
        { id: "post-reels", title: "POV rotina em casa", totalInteractions: 5200 },
      ],
    },
    {
      slotId: "slot-list",
      dayOfWeek: 3,
      blockStartHour: 12,
      format: "Carrossel",
      categories: { context: ["Tutorial"], proposal: ["Salvamento"], tone: "Didático" },
      narrativeForm: ["Lista"],
      contentSignals: ["Salvamentos"],
      comments: 10,
      saves: 20,
      expectedMetrics: { viewsP50: 2000, sharesP50: 10 },
      evidencePosts: [{ id: "post-list", title: "Checklist simples", totalInteractions: 800 }],
    },
    {
      slotId: "slot-extra",
      dayOfWeek: 5,
      blockStartHour: 15,
      format: "Stories",
      categories: { context: ["Bastidor"], proposal: ["Conversa"], tone: "Leve" },
      narrativeForm: ["Pergunta"],
      contentSignals: ["Interações"],
      evidencePosts: [{ id: "post-extra", title: "Pergunta de bastidor", totalInteractions: 700 }],
    },
  ],
  brandSignals: [{ brandCategory: "Conforto em casa", confidence: 0.9, evidenceCount: 3 }],
  collabSignals: [{ creatorProfile: "Creator de humor de rotina", opportunityScore: 88, evidenceCount: 3 }],
});

const lowStudyContext = buildPostCreationAdaptiveStudyContext({
  plannerSlots: [
    {
      format: "Reels",
      narrativeForm: ["Rotina real"],
      categories: { context: ["Casa"], proposal: ["Comentário"] },
      contentSignals: ["Comentários"],
    },
  ],
});
lowStudyContext.confidence = {
  score: 20,
  label: "low",
  reasons: ["Contexto criado com dados limitados do planner."],
};

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

  it("keeps legacy behavior when studyContext is not provided", () => {
    const detection = detectionForMode("validate_pauta");
    const questions = [
      customQuestion("format", [
        { id: "carousel", label: "Carrossel", recommended: true },
        { id: "reels", label: "Reels" },
      ]),
    ];

    expect(buildPostCreationAdaptiveAnswerKey({ detection, questions }).correctAnswersByQuestionId["custom-format"])
      .toBe("carousel");
  });

  it("accepts optional studyContext", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.questionKeys).toHaveLength(1);
  });

  it("uses topFormats to choose a matching format option", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel", recommended: true },
        { id: "reels", label: "Vídeo Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("reels");
  });

  it("uses topNarratives to choose a matching narrative option", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "narrative",
      options: [
        { id: "tutorial", label: "Tutorial direto", recommended: true },
        { id: "rotina", label: "Cena de rotina real" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-narrative"]).toBe("rotina");
  });

  it("uses topContexts to choose a matching context option", () => {
    const mapKey = "context" as PostCreationAdaptiveQuestionMapKey;
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey,
      options: [
        { id: "street", label: "Rua", recommended: true },
        { id: "home", label: "Casa" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-context"]).toBe("home");
  });

  it("uses topProposals to choose a matching proposal option", () => {
    const mapKey = "proposal" as PostCreationAdaptiveQuestionMapKey;
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey,
      options: [
        { id: "save", label: "Salvamento", recommended: true },
        { id: "comment", label: "Comentário" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-proposal"]).toBe("comment");
  });

  it("uses topEngagementDrivers for objective when applicable", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "objective",
      options: [
        { id: "save", label: "Fazer alguém salvar", recommended: true },
        { id: "comment", label: "Fazer a galera comentar" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-objective"]).toBe("comment");
  });

  it("uses topEngagementDrivers for CTA when applicable", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "cta",
      options: [
        { id: "save_tip", label: "Salvar para depois", recommended: true },
        { id: "ask", label: "Deixar uma pergunta nos comentários" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-cta"]).toBe("ask");
  });

  it("uses brandSignals to choose a brand option", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "brand",
      options: [
        { id: "beauty", label: "Beleza", recommended: true },
        { id: "home_comfort", label: "Conforto em casa" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-brand"]).toBe("home_comfort");
  });

  it("uses collabSignals to choose a collab option", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "collab",
      options: [
        { id: "expert", label: "Especialista", recommended: true },
        { id: "humor", label: "Creator de humor de rotina" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-collab"]).toBe("humor");
  });

  it("falls back to recommended when studyContext has no match", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "photo", label: "Foto", recommended: true },
        { id: "live", label: "Live" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("photo");
  });

  it("falls back to the current heuristic when there is no study match or recommended option", () => {
    const detection = detectionForMode("weekly_plan");
    const questions = [
      customQuestion("format", [
        { id: "photo", label: "Foto" },
        { id: "reels_stories", label: "Reels e stories" },
      ]),
    ];
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext: buildPostCreationAdaptiveStudyContext({ plannerSlots: [{ format: "Live" }] }),
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("reels_stories");
  });

  it("falls back to the first option when nothing resolves", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "where",
      options: [
        { id: "room", label: "Quarto" },
        { id: "street", label: "Rua" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-where"]).toBe("room");
  });

  it("matches studyContext ignoring accents and casing", () => {
    const studyContext = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          format: "Vídeo Curto",
          evidenceCount: 3,
          evidencePosts: [
            { id: "a", title: "A" },
            { id: "b", title: "B" },
            { id: "c", title: "C" },
          ],
        },
        { format: "Stories" },
        { format: "Live" },
      ],
    });
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "video_curto", label: "video curto" },
        { id: "carousel", label: "Carrossel" },
      ],
      studyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("video_curto");
  });

  it("matches studyContext through option.label", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "narrative",
      options: [
        { id: "a", label: "Tutorial" },
        { id: "b", label: "Rotina real com humor" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-narrative"]).toBe("b");
  });

  it("matches studyContext through option.id", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "reels", label: "Vídeo curto" },
        { id: "carousel", label: "Carrossel" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("reels");
  });

  it("matches studyContext through option.value string", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "narrative",
      options: [
        { id: "a", label: "Tutorial" },
        { id: "b", label: "Cena", value: "Rotina real" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-narrative"]).toBe("b");
  });

  it("adds evidence to feedback when studyContext influenced the answer", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.questionKeys[0]?.feedback.evidence).toEqual(
      expect.arrayContaining(["Formato forte: Reels"]),
    );
  });

  it("does not require feedback evidence without studyContext", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel", recommended: true },
        { id: "reels", label: "Reels" },
      ],
    });

    expect(answerKey.questionKeys[0]?.feedback.evidence).toBeUndefined();
  });

  it("uses careful language when studyContext confidence is low", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: lowStudyContext,
    });

    expect(answerKey.questionKeys[0]?.feedback.correct).toMatch(/Com os sinais disponíveis/i);
    expect(answerKey.questionKeys[0]?.feedback.correct).not.toMatch(/sinais fortes do seu histórico/i);
  });

  it("can mention history or analysis when studyContext confidence is high", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.questionKeys[0]?.feedback.correct).toMatch(/histórico/i);
  });

  it("limits feedback evidence to at most 3 items", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.questionKeys[0]?.feedback.evidence?.length).toBeLessThanOrEqual(3);
  });

  it("copies feedback evidence into evaluations", () => {
    const { question, answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: [answerFromOption(question, "reels")],
    });

    expect(result.evaluations[0]?.evidence).toEqual(answerKey.questionKeys[0]?.feedback.evidence);
    expect(result.evaluations[0]?.evidence).toEqual(expect.arrayContaining(["Formato forte: Reels"]));
  });

  it("keeps evaluation evidence limited and without empty strings", () => {
    const detection = detectionForMode("validate_pauta");
    const question = customQuestion("format", [
      { id: "reels", label: "Reels" },
    ]);
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions: [question] });
    answerKey.questionKeys[0]!.feedback.evidence = [
      "Formato forte: Reels",
      " ",
      "Sinal de engajamento: Comentários",
      "Post de referência: POV rotina",
      "Extra",
    ];
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: [answerFromOption(question, "reels")],
    });

    expect(result.evaluations[0]?.evidence).toEqual([
      "Formato forte: Reels",
      "Sinal de engajamento: Comentários",
      "Post de referência: POV rotina",
    ]);
  });

  it("idealAnswers use correctOptionId from studyContext", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel", recommended: true },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.idealAnswers[0]?.optionId).toBe("reels");
  });

  it("generates idealPlan from idealAnswers guided by studyContext", () => {
    const detection = detectionForMode("validate_pauta");
    const questions = [
      customQuestion("format", [
        { id: "carousel", label: "Carrossel", value: "Carrossel", recommended: true },
        { id: "reels", label: "Reels", value: "Reels" },
      ]),
    ];
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, studyContext: highStudyContext });

    expect(answerKey.idealPlan).toEqual(
      buildPostCreationStrategicPlan({
        detection,
        questions,
        answers: answerKey.idealAnswers,
      }),
    );
    expect(answerKey.idealPlan.format).toMatch(/Reels/i);
  });

  it("continues creating legacyHandoff with studyContext", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });

    expect(answerKey.legacyHandoff.decision).toBeTruthy();
    expect(answerKey.legacyHandoff.idea).toBeTruthy();
    expect(answerKey.legacyHandoff.blueprint).toBeTruthy();
  });

  it("does not break with an empty studyContext", () => {
    const emptyStudyContext = buildPostCreationAdaptiveStudyContext({});
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel", recommended: true },
        { id: "reels", label: "Reels" },
      ],
      studyContext: emptyStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("carousel");
  });

  it("does not break with low confidence studyContext", () => {
    const { answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: lowStudyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["custom-format"]).toBe("reels");
  });

  it("does not alter score and evaluation behavior with studyContext", () => {
    const { question, answerKey } = answerKeyForCustomQuestion({
      mapKey: "format",
      options: [
        { id: "carousel", label: "Carrossel" },
        { id: "reels", label: "Reels" },
      ],
      studyContext: highStudyContext,
    });
    const result = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: [answerFromOption(question, "reels")],
    });

    expect(result.score.correct).toBe(1);
    expect(result.score.percentage).toBe(100);
    expect(result.evaluations[0]?.feedbackMessage).toMatch(/histórico/i);
  });

  it("works integrated with buildPostCreationAdaptiveStudyContext", () => {
    const detection = detectionForInput("Quero validar uma pauta sobre rotina em casa");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const studyContext = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          format: "Reels",
          categories: { context: ["Casa"], proposal: ["Comentário"] },
          narrativeForm: ["Rotina real"],
          contentSignals: ["Comentários"],
          evidencePosts: [
            { id: "ref-a", title: "Rotina A" },
            { id: "ref-b", title: "Rotina B" },
            { id: "ref-c", title: "Rotina C" },
          ],
        },
        { format: "Carrossel" },
        { format: "Stories" },
      ],
    });
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, studyContext });

    expect(answerKey.questionKeys.length).toBeGreaterThan(0);
    expect(answerKey.idealPlan).toBeTruthy();
  });

  it("works with validate_pauta and studyContext", () => {
    const detection = detectionForInput("Quero gravar um POV sobre minha família fazendo barulho");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, studyContext: highStudyContext });

    expect(answerKey.mode).toBe("validate_pauta");
  });

  it("works with discover_pauta and studyContext", () => {
    const detection = detectionForInput("Não sei o que postar essa semana");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, studyContext: highStudyContext });

    expect(answerKey.mode).toBe("discover_pauta");
  });

  it("works with brand_match and studyContext", () => {
    const detection = detectionForInput("Quero atrair marcas de conforto");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, studyContext: highStudyContext });

    expect(answerKey.mode).toBe("brand_match");
    expect(answerKey.legacyHandoff.decision).toBeTruthy();
  });

  it("works with collab_match and studyContext", () => {
    const detection = detectionForInput("Quero fazer collab com alguém de humor");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, studyContext: highStudyContext });

    expect(answerKey.mode).toBe("collab_match");
    expect(answerKey.legacyHandoff.blueprint).toBeTruthy();
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
