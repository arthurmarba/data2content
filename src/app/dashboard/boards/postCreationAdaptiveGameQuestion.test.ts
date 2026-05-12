import type {
  PostCreationAdaptiveAnswerKey,
} from "./postCreationAdaptiveAnswerKey";
import {
  buildPostCreationAdaptiveAnswerKey,
} from "./postCreationAdaptiveAnswerKey";
import {
  buildPostCreationAdaptiveGameQuestions,
  validatePostCreationAdaptiveGameQuestion,
  validatePostCreationAdaptiveGameQuestions,
  type PostCreationAdaptiveGameQuestion,
} from "./postCreationAdaptiveGameQuestion";
import type { PostCreationAdaptiveStudyContext } from "./postCreationAdaptiveStudyContext";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
} from "./postCreationAdaptiveTypes";

function option(
  id: string,
  label: string,
  extra: Partial<PostCreationAdaptiveQuestionOption> = {},
): PostCreationAdaptiveQuestionOption {
  return {
    id,
    label,
    reason: `${label} tem uma razao plausivel.`,
    value: id,
    ...extra,
  };
}

function question(
  options: PostCreationAdaptiveQuestionOption[],
  extra: Partial<PostCreationAdaptiveQuestion> = {},
): PostCreationAdaptiveQuestion {
  return {
    id: "game-question",
    mapKey: "format",
    type: "strategic_choice",
    title: "Qual caminho funciona melhor?",
    helper: "Escolha a aposta mais forte.",
    required: true,
    options,
    ...extra,
  };
}

function fourOptionQuestion(): PostCreationAdaptiveQuestion {
  return question([
    option("reels", "Reels", { recommended: true }),
    option("stories", "Stories"),
    option("carousel", "Carrossel"),
    option("photo", "Foto"),
  ]);
}

function answerKey(correctOptionId = "carousel", evidence = ["Formato forte: Carrossel"]): PostCreationAdaptiveAnswerKey {
  return {
    mode: "validate_pauta",
    questionKeys: [
      {
        questionId: "game-question",
        mapKey: "format",
        correctOptionId,
        feedback: {
          correct: "Boa aposta.",
          incorrect: "Quase.",
          rationale: "O formato foi priorizado pelo gabarito estrategico.",
          evidence,
        },
      },
    ],
    correctAnswersByQuestionId: {
      "game-question": correctOptionId,
    },
    idealAnswers: [],
    idealPlan: {
      pauta: null,
      objective: null,
      narrative: null,
      format: null,
      hook: null,
      cta: null,
      fiveW2H: {
        who: null,
        what: null,
        where: null,
        when: null,
        why: null,
        how: null,
        howMuch: null,
      },
      scenes: [],
      brandMatch: null,
      collabMatch: null,
      nextActions: [],
    },
    legacyHandoff: {} as PostCreationAdaptiveAnswerKey["legacyHandoff"],
    gameQuestions: [],
    score: {
      max: 1,
      passing: 1,
    },
  };
}

function studyContext(
  overrides: Partial<PostCreationAdaptiveStudyContext> = {},
): PostCreationAdaptiveStudyContext {
  return {
    source: "planner_client",
    periodDays: 90,
    confidence: { score: 0.8, label: "high", reasons: ["fixture"] },
    profileSummary: {
      slotsCount: 0,
      recommendationsCount: 0,
      postedSignalsCount: 0,
      evidencePostsCount: 0,
      captionSignalsCount: 0,
      themeSignalsCount: 0,
      qualitativeSignalsCount: 0,
    },
    topFormats: [],
    topNarratives: [],
    topContexts: [],
    topProposals: [],
    topEngagementDrivers: [],
    topContentIntents: [],
    topNarrativeForms: [],
    topTones: [],
    topThemes: [],
    topThemeKeywords: [],
    topHooks: [],
    topCtas: [],
    topProofStyles: [],
    topStances: [],
    topCommercialModes: [],
    topCaptionSignals: [],
    bestPostingWindows: [],
    referencePosts: [],
    brandSignals: [],
    collabSignals: [],
    ...overrides,
  };
}

function detectionForMode(mode: PostCreationAdaptiveMode): PostCreationAdaptiveIntentDetection {
  return {
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.8,
    normalizedInput: mode,
    originalInput: mode,
    detectedPauta: mode === "format_guidance" ? "qual formato usar" : null,
    objective: mode === "create_by_goal" ? "crescer comentarios" : null,
    brandCategory: mode === "brand_match" ? "skincare" : null,
    sourceComment: mode === "comment_to_post" ? "Como lidar com barulho em casa?" : null,
    signals: mode === "brand_match" ? ["marca"] : [],
    suggestedStage: mode === "unknown" ? "intent" : "quiz",
  };
}

function buildFirstGameQuestion(params: {
  inputQuestion?: PostCreationAdaptiveQuestion;
  inputAnswerKey?: PostCreationAdaptiveAnswerKey;
  inputStudyContext?: PostCreationAdaptiveStudyContext | null;
} = {}) {
  const [gameQuestion] = buildPostCreationAdaptiveGameQuestions({
    questions: [params.inputQuestion || fourOptionQuestion()],
    answerKey: params.inputAnswerKey || answerKey(),
    studyContext: params.inputStudyContext,
  });
  if (!gameQuestion) throw new Error("GameQuestion nao foi gerada.");
  return gameQuestion;
}

describe("postCreationAdaptiveGameQuestion", () => {
  it("turns a four-option question into a GameQuestion with four options", () => {
    const gameQuestion = buildFirstGameQuestion();

    expect(gameQuestion.options).toHaveLength(4);
    expect(gameQuestion.id).toBe("game-question");
    expect(gameQuestion.type).toBe("strategic_choice");
    expect(gameQuestion.mapKey).toBe("format");
    expect(gameQuestion.required).toBe(true);
  });

  it("marks exactly one correct option from the answer key", () => {
    const gameQuestion = buildFirstGameQuestion();

    expect(gameQuestion.correctOptionId).toBe("carousel");
    expect(gameQuestion.options.filter((candidate) => candidate.isCorrect)).toHaveLength(1);
    expect(gameQuestion.options.find((candidate) => candidate.isCorrect)?.id).toBe("carousel");
  });

  it("marks the remaining three options as distractors", () => {
    const gameQuestion = buildFirstGameQuestion();

    expect(gameQuestion.options.filter((candidate) => candidate.isDistractor)).toHaveLength(3);
    expect(gameQuestion.options.filter((candidate) => candidate.isDistractor).every((candidate) => candidate.distractorReason)).toBe(true);
  });

  it("uses correctOptionId from the answer key", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputAnswerKey: answerKey("stories"),
    });

    expect(gameQuestion.correctOptionId).toBe("stories");
    expect(gameQuestion.options.find((candidate) => candidate.id === "stories")?.isCorrect).toBe(true);
  });

  it("uses evidence from answer key feedback and limits it to three items", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputAnswerKey: answerKey("carousel", [
        "Formato forte: Carrossel",
        "Formato forte: Carrossel",
        "",
        "Sinal de engajamento: salvamentos",
        "Post de referencia: Checklist",
        "Extra ignorado",
      ]),
    });

    expect(gameQuestion.evidence).toEqual([
      "Formato forte: Carrossel",
      "Sinal de engajamento: salvamentos",
      "Post de referencia: Checklist",
    ]);
  });

  it("uses rationale as correctReason", () => {
    const gameQuestion = buildFirstGameQuestion();

    expect(gameQuestion.correctReason).toBe("O formato foi priorizado pelo gabarito estrategico.");
  });

  it("preserves relative option order", () => {
    const gameQuestion = buildFirstGameQuestion();

    expect(gameQuestion.options.map((candidate) => candidate.id)).toEqual(["reels", "stories", "carousel", "photo"]);
  });

  it("keeps the correct option and three distractors when the source has more than four options", () => {
    const inputQuestion = question([
      option("a", "A"),
      option("b", "B"),
      option("c", "C"),
      option("d", "D"),
      option("e", "E"),
      option("f", "F"),
    ]);
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion,
      inputAnswerKey: answerKey("e"),
    });

    expect(gameQuestion.options).toHaveLength(4);
    expect(gameQuestion.options.map((candidate) => candidate.id)).toEqual(["a", "b", "c", "e"]);
    expect(gameQuestion.options.find((candidate) => candidate.id === "e")?.isCorrect).toBe(true);
  });

  it("adds fallback distractors when the source has fewer than four options", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion: question([
        option("reels", "Reels", { recommended: true }),
        option("carousel", "Carrossel"),
      ]),
      inputAnswerKey: answerKey("reels"),
    });

    expect(gameQuestion.options).toHaveLength(4);
    expect(gameQuestion.correctOptionId).toBe("reels");
    expect(gameQuestion.options.filter((candidate) => candidate.isDistractor)).toHaveLength(3);
    expect(new Set(gameQuestion.options.map((candidate) => candidate.id)).size).toBe(4);
  });

  it("does not duplicate option ids when adding fallbacks", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion: question([
        option("fallback-format-carousel", "Carrossel customizado", { recommended: true }),
        option("fallback-format-stories", "Stories customizado"),
      ]),
      inputAnswerKey: answerKey("fallback-format-carousel"),
    });

    expect(gameQuestion.options).toHaveLength(4);
    expect(new Set(gameQuestion.options.map((candidate) => candidate.id)).size).toBe(4);
  });

  it("does not mutate the original question", () => {
    const inputQuestion = question([
      option("reels", "Reels", { recommended: true }),
      option("carousel", "Carrossel"),
    ]);
    const original = JSON.parse(JSON.stringify(inputQuestion));

    buildFirstGameQuestion({
      inputQuestion,
      inputAnswerKey: answerKey("reels"),
    });

    expect(inputQuestion).toEqual(original);
  });

  it("falls back to recommended option when answer key has no answer for the question", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputAnswerKey: {
        ...answerKey("carousel"),
        correctAnswersByQuestionId: {},
        questionKeys: [],
      },
    });

    expect(gameQuestion.correctOptionId).toBe("reels");
    expect(gameQuestion.options.find((candidate) => candidate.id === "reels")?.isCorrect).toBe(true);
  });

  it("falls back to first option when there is no answer key match or recommended option", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion: question([
        option("first", "Primeira"),
        option("second", "Segunda"),
        option("third", "Terceira"),
        option("fourth", "Quarta"),
      ]),
      inputAnswerKey: {
        ...answerKey("missing"),
        correctAnswersByQuestionId: {},
        questionKeys: [],
      },
    });

    expect(gameQuestion.correctOptionId).toBe("first");
    expect(gameQuestion.options.find((candidate) => candidate.id === "first")?.isCorrect).toBe(true);
  });

  it("does not use forbidden terms in distractorReason", () => {
    const gameQuestion = buildFirstGameQuestion();
    const reasons = gameQuestion.options.map((candidate) => candidate.distractorReason || "").join(" ").toLowerCase();

    expect(reasons).not.toContain("errado");
    expect(reasons).not.toContain("incorreto");
    expect(reasons).not.toContain("falhou");
  });

  it("validates a valid GameQuestion", () => {
    const validation = validatePostCreationAdaptiveGameQuestion(buildFirstGameQuestion());

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("fails validation with fewer than four options", () => {
    const invalid: PostCreationAdaptiveGameQuestion = {
      ...buildFirstGameQuestion(),
      options: buildFirstGameQuestion().options.slice(0, 3),
    };

    expect(validatePostCreationAdaptiveGameQuestion(invalid).ok).toBe(false);
    expect(validatePostCreationAdaptiveGameQuestion(invalid).errors).toContain("GameQuestion precisa ter exatamente 4 opcoes.");
  });

  it("fails validation with more than four options", () => {
    const valid = buildFirstGameQuestion();
    const invalid: PostCreationAdaptiveGameQuestion = {
      ...valid,
      options: [
        ...valid.options,
        {
          ...valid.options[0],
          id: "extra",
          isCorrect: false,
          isDistractor: true,
          distractorReason: "Pode funcionar em outro contexto, mas nao e a aposta principal aqui.",
        },
      ],
    };

    expect(validatePostCreationAdaptiveGameQuestion(invalid).ok).toBe(false);
    expect(validatePostCreationAdaptiveGameQuestion(invalid).errors).toContain("GameQuestion precisa ter exatamente 4 opcoes.");
  });

  it("fails validation with zero correct options", () => {
    const valid = buildFirstGameQuestion();
    const invalid: PostCreationAdaptiveGameQuestion = {
      ...valid,
      options: valid.options.map((candidate) => ({ ...candidate, isCorrect: false, isDistractor: true })),
    };

    expect(validatePostCreationAdaptiveGameQuestion(invalid).errors).toContain("GameQuestion precisa ter exatamente 1 resposta certa.");
  });

  it("fails validation with two correct options", () => {
    const valid = buildFirstGameQuestion();
    const invalid: PostCreationAdaptiveGameQuestion = {
      ...valid,
      options: valid.options.map((candidate, index) => ({ ...candidate, isCorrect: index < 2, isDistractor: index >= 2 })),
    };

    expect(validatePostCreationAdaptiveGameQuestion(invalid).errors).toContain("GameQuestion precisa ter exatamente 1 resposta certa.");
  });

  it("fails validation with duplicate ids", () => {
    const valid = buildFirstGameQuestion();
    const invalid: PostCreationAdaptiveGameQuestion = {
      ...valid,
      options: valid.options.map((candidate, index) => ({ ...candidate, id: index === 1 ? valid.options[0].id : candidate.id })),
    };

    expect(validatePostCreationAdaptiveGameQuestion(invalid).errors).toContain("As opcoes nao podem ter ids duplicados.");
  });

  it("fails validation when correctOptionId does not exist in options", () => {
    const invalid: PostCreationAdaptiveGameQuestion = {
      ...buildFirstGameQuestion(),
      correctOptionId: "missing",
    };

    expect(validatePostCreationAdaptiveGameQuestion(invalid).errors).toContain("correctOptionId precisa existir nas opcoes.");
  });

  it("uses generic fallback safely with an unknown mapKey", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion: question([option("one", "Um", { recommended: true })], {
        mapKey: "unknown_map" as PostCreationAdaptiveQuestionMapKey,
      }),
      inputAnswerKey: answerKey("one"),
    });

    expect(gameQuestion.options).toHaveLength(4);
    expect(gameQuestion.options.some((candidate) => candidate.id.startsWith("fallback-generic"))).toBe(true);
    expect(validatePostCreationAdaptiveGameQuestion(gameQuestion).ok).toBe(true);
  });

  it("works with a question without helper", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion: question(fourOptionQuestion().options, { helper: null }),
    });

    expect(gameQuestion.helper).toBeNull();
    expect(validatePostCreationAdaptiveGameQuestion(gameQuestion).ok).toBe(true);
  });

  it("works with empty evidence", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputAnswerKey: answerKey("carousel", []),
    });

    expect(gameQuestion.evidence).toEqual([]);
    expect(validatePostCreationAdaptiveGameQuestion(gameQuestion).ok).toBe(true);
  });

  it("uses studyContext topFormats to contextualize format option labels", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputStudyContext: studyContext({
        topFormats: [
          { id: "reels", label: "Reels", score: 100, evidenceCount: 5, reason: "Forte em alcance." },
          { id: "carousel", label: "Carrossel", score: 90, evidenceCount: 4, reason: "Forte em salvamento." },
          { id: "stories", label: "Stories", score: 80, evidenceCount: 3, reason: "Forte em conversa." },
          { id: "photo", label: "Foto", score: 70, evidenceCount: 2, reason: "Forte em legenda." },
        ],
      }),
    });

    expect(gameQuestion.options).toHaveLength(4);
    expect(gameQuestion.options.map((candidate) => candidate.label)).toEqual([
      "Reels, formato forte no seu historico",
      "Carrossel, alternativa com potencial de salvamento",
      "Stories, bom para conversa rapida",
      "Foto, aposta mais dependente de legenda/contexto",
    ]);
    expect(validatePostCreationAdaptiveGameQuestion(gameQuestion).ok).toBe(true);
  });

  it("uses topFormats as distractors when enough StudyContext signals exist", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputStudyContext: studyContext({
        topFormats: [
          { id: "reels", label: "Reels", score: 100, evidenceCount: 5, reason: "Forte em alcance." },
          { id: "carousel", label: "Carrossel", score: 90, evidenceCount: 4, reason: "Forte em salvamento." },
          { id: "stories", label: "Stories", score: 80, evidenceCount: 3, reason: "Forte em conversa." },
          { id: "photo", label: "Foto", score: 70, evidenceCount: 2, reason: "Forte em legenda." },
        ],
      }),
    });

    expect(gameQuestion.options.filter((candidate) => candidate.isDistractor).map((candidate) => candidate.id)).toEqual([
      "reels",
      "stories",
      "photo",
    ]);
  });

  it("completes StudyContext format options with fallback when signals are insufficient", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputQuestion: question([option("carousel", "Carrossel")]),
      inputAnswerKey: answerKey("carousel"),
      inputStudyContext: studyContext({
        topFormats: [
          { id: "carousel", label: "Carrossel", score: 90, evidenceCount: 4, reason: "Forte em salvamento." },
        ],
      }),
    });

    expect(gameQuestion.options).toHaveLength(4);
    expect(gameQuestion.correctOptionId).toBe("carousel");
    expect(gameQuestion.options.some((candidate) => candidate.id.startsWith("fallback-format"))).toBe(true);
  });

  it("keeps the AnswerKey correctOptionId when StudyContext contextualizes options", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputAnswerKey: answerKey("stories"),
      inputStudyContext: studyContext({
        topFormats: [
          { id: "carousel", label: "Carrossel", score: 100, evidenceCount: 5, reason: "Forte em salvamento." },
          { id: "stories", label: "Stories", score: 90, evidenceCount: 4, reason: "Forte em conversa." },
          { id: "reels", label: "Reels", score: 80, evidenceCount: 3, reason: "Forte em alcance." },
          { id: "photo", label: "Foto", score: 70, evidenceCount: 2, reason: "Forte em legenda." },
        ],
      }),
    });

    expect(gameQuestion.correctOptionId).toBe("stories");
    expect(gameQuestion.options.find((candidate) => candidate.id === "stories")?.isCorrect).toBe(true);
    expect(gameQuestion.options.filter((candidate) => candidate.isCorrect)).toHaveLength(1);
    expect(gameQuestion.options.filter((candidate) => candidate.isDistractor)).toHaveLength(3);
  });

  it("does not duplicate ids when StudyContext signals map to existing options", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputStudyContext: studyContext({
        topFormats: [
          { id: "carousel", label: "Carrossel", score: 100, evidenceCount: 5, reason: "Forte em salvamento." },
          { id: "carrossel", label: "Carrossel", score: 95, evidenceCount: 4, reason: "Duplicado." },
          { id: "reels", label: "Reels", score: 80, evidenceCount: 3, reason: "Forte em alcance." },
        ],
      }),
    });

    expect(new Set(gameQuestion.options.map((candidate) => candidate.id)).size).toBe(4);
    expect(validatePostCreationAdaptiveGameQuestion(gameQuestion).ok).toBe(true);
  });

  it("does not use forbidden terms in StudyContext-driven labels or reasons", () => {
    const gameQuestion = buildFirstGameQuestion({
      inputStudyContext: studyContext({
        topFormats: [
          { id: "reels", label: "Reels", score: 100, evidenceCount: 5, reason: "Forte em alcance." },
          { id: "carousel", label: "Carrossel", score: 90, evidenceCount: 4, reason: "Forte em salvamento." },
        ],
      }),
    });
    const text = gameQuestion.options.map((candidate) => `${candidate.label} ${candidate.reason}`).join(" ").toLowerCase();

    expect(text).not.toContain("garantido");
    expect(text).not.toContain("provado");
    expect(text).not.toContain("certeza");
  });

  it("uses topNarratives, topContexts, and topProposals for matching mapKeys", () => {
    const key = answerKey("routine");
    const narrativeQuestion = buildFirstGameQuestion({
      inputQuestion: question([option("routine", "Rotina real")], { mapKey: "narrative" }),
      inputAnswerKey: { ...key, correctAnswersByQuestionId: { "game-question": "routine" } },
      inputStudyContext: studyContext({
        topNarratives: [{ id: "routine", label: "Rotina real", score: 80, evidenceCount: 3, reason: "Recorrente." }],
      }),
    });
    const contextQuestion = buildFirstGameQuestion({
      inputQuestion: question([option("home", "Casa")], { mapKey: "where" }),
      inputAnswerKey: { ...key, correctAnswersByQuestionId: { "game-question": "home" } },
      inputStudyContext: studyContext({
        topContexts: [{ id: "home", label: "Casa", score: 70, evidenceCount: 2, reason: "Recorrente." }],
      }),
    });
    const proposalQuestion = buildFirstGameQuestion({
      inputQuestion: question([option("tutorial", "Tutorial")], { mapKey: "what" }),
      inputAnswerKey: { ...key, correctAnswersByQuestionId: { "game-question": "tutorial" } },
      inputStudyContext: studyContext({
        topProposals: [{ id: "tutorial", label: "Tutorial", score: 60, evidenceCount: 2, reason: "Recorrente." }],
      }),
    });

    expect(narrativeQuestion.options[0]?.label).toContain("narrativa que aparece");
    expect(contextQuestion.options[0]?.label).toContain("contexto presente");
    expect(proposalQuestion.options[0]?.label).toContain("proposta recorrente");
  });

  it("generates one correct answer and three distractors for all current quizBuilder questions", () => {
    const modes: PostCreationAdaptiveMode[] = [
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

    let totalQuestions = 0;
    for (const mode of modes) {
      const detection = detectionForMode(mode);
      const questions = buildPostCreationAdaptiveQuiz({ detection });
      const key = buildPostCreationAdaptiveAnswerKey({ detection, questions });
      const gameQuestions = buildPostCreationAdaptiveGameQuestions({ questions, answerKey: key });
      totalQuestions += gameQuestions.length;

      expect(gameQuestions).toHaveLength(questions.length);
      expect(validatePostCreationAdaptiveGameQuestions(gameQuestions).ok).toBe(true);
      for (const gameQuestion of gameQuestions) {
        expect(gameQuestion.options).toHaveLength(4);
        expect(gameQuestion.options.filter((candidate) => candidate.isCorrect)).toHaveLength(1);
        expect(gameQuestion.options.filter((candidate) => candidate.isDistractor)).toHaveLength(3);
        expect(gameQuestion.options.some((candidate) => candidate.id === gameQuestion.correctOptionId)).toBe(true);
      }
    }

    expect(totalQuestions).toBeGreaterThan(0);
  });
});
