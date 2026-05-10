import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";
import { buildPostCreationLegacyHandoff } from "./postCreationAdaptiveLegacyAdapter";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";

export type PostCreationAdaptiveAnswerFeedback = {
  correct: string;
  incorrect: string;
  rationale: string;
};

export type PostCreationAdaptiveQuestionAnswerKey = {
  questionId: string;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  correctOptionId: string;
  feedback: PostCreationAdaptiveAnswerFeedback;
};

export type PostCreationAdaptiveAnswerEvaluation = {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  isCorrect: boolean;
  feedbackTitle: string;
  feedbackMessage: string;
  rationale: string;
};

export type PostCreationAdaptiveScore = {
  total: number;
  correct: number;
  percentage: number;
  label: string;
  summary: string;
};

export type PostCreationAdaptiveLegacyHandoff = {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
};

export type PostCreationAdaptiveAnswerKey = {
  mode: PostCreationAdaptiveMode;
  questionKeys: PostCreationAdaptiveQuestionAnswerKey[];
  correctAnswersByQuestionId: Record<string, string>;
  idealAnswers: PostCreationAdaptiveAnswer[];
  idealPlan: PostCreationStrategicPlan;
  legacyHandoff: PostCreationAdaptiveLegacyHandoff;
  score: {
    max: number;
    passing: number;
  };
};

const RATIONALE_BY_MAP_KEY: Partial<Record<PostCreationAdaptiveQuestionMapKey, string>> = {
  objective: "O objetivo define o comportamento que o conteúdo precisa provocar.",
  format: "O formato precisa combinar com a força principal da ideia.",
  hook: "O gancho decide se a pessoa entende a tensão nos primeiros segundos.",
  cta: "O CTA precisa continuar a conversa depois do conteúdo.",
  brand: "A marca funciona melhor quando entra como parte natural da narrativa.",
  collab: "A collab precisa adicionar contraste, repertório ou público novo.",
  why: "O motivo estratégico sustenta a recomendação final.",
  narrative: "A narrativa organiza a tensão principal em uma história fácil de acompanhar.",
  how: "A execução precisa deixar a ideia clara sem explicar demais.",
  who: "A pessoa certa na cena muda a força da recomendação.",
  effort: "O esforço precisa caber na execução real da pauta.",
  schedule: "A cadência precisa ser sustentável para manter consistência.",
};

function cleanText(value?: string | null): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return trimmed || null;
}

function normalizeText(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildDetectionCorpus(detection: PostCreationAdaptiveIntentDetection): string {
  return [
    detection.normalizedInput,
    detection.originalInput,
    detection.detectedPauta,
    detection.objective,
    detection.brandCategory,
    detection.sourceComment,
    ...detection.signals,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
}

function getOptionCorpus(option: PostCreationAdaptiveQuestionOption): string {
  return normalizeText([option.id, option.label, option.reason, option.description, option.value].filter(Boolean).join(" "));
}

function findFirstOptionByTerms(
  options: PostCreationAdaptiveQuestionOption[],
  terms: string[],
): PostCreationAdaptiveQuestionOption | null {
  const normalizedTerms = terms.map(normalizeText).filter(Boolean);
  if (!normalizedTerms.length) return null;

  return options.find((option) => {
    const corpus = getOptionCorpus(option);
    return normalizedTerms.some((term) => corpus.includes(term));
  }) || null;
}

function findOptionByIdPriority(
  options: PostCreationAdaptiveQuestionOption[],
  ids: string[],
): PostCreationAdaptiveQuestionOption | null {
  for (const id of ids) {
    const option = options.find((candidate) => candidate.id === id);
    if (option) return option;
  }
  return null;
}

function resolveObjectiveOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
}): PostCreationAdaptiveQuestionOption | null {
  const { detection, question } = params;
  if (detection.mode === "brand_match") {
    return findFirstOptionByTerms(question.options, ["brand", "marca", "marcas"]);
  }
  if (detection.mode === "collab_match") {
    return findFirstOptionByTerms(question.options, ["collab", "colab", "parceria", "creator"]);
  }
  if (detection.mode === "comment_to_post") {
    return findFirstOptionByTerms(question.options, ["comentario", "comentarios", "identificacao", "responder"]);
  }
  return null;
}

function resolveFormatOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  const { detection, question, corpus } = params;
  if (detection.mode === "weekly_plan") {
    return findOptionByIdPriority(question.options, ["reels_stories", "full_mix", "reels_carousel"]);
  }
  if (/\b(pov|reels?|video|cena|grav(ar|ar um|ando)?)\b/.test(corpus)) {
    return findOptionByIdPriority(question.options, ["reels", "simple_reels", "reply_reels"]);
  }
  return null;
}

function resolveHookOption(params: {
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  if (/\bpov\b/.test(params.corpus)) {
    return findOptionByIdPriority(params.question.options, ["pov"]);
  }
  return null;
}

function resolveCtaOption(question: PostCreationAdaptiveQuestion): PostCreationAdaptiveQuestionOption | null {
  return findOptionByIdPriority(question.options, ["specific_question", "answer_question", "anyone_else"])
    || findFirstOptionByTerms(question.options, ["pergunta", "comentario", "comentarios", "responder"]);
}

function resolveBrandOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
}): PostCreationAdaptiveQuestionOption | null {
  const brandCategory = normalizeText(params.detection.brandCategory);
  if (brandCategory) {
    const byCategory = findFirstOptionByTerms(params.question.options, [brandCategory]);
    if (byCategory) return byCategory;
  }
  return findFirstOptionByTerms(params.question.options, ["marca", "brand", "beleza", "autocuidado"]);
}

function resolveCollabOption(question: PostCreationAdaptiveQuestion): PostCreationAdaptiveQuestionOption | null {
  return findOptionByIdPriority(question.options, ["reaction", "joint_scene", "debate"])
    || findFirstOptionByTerms(question.options, ["reacao", "cena", "conversa", "creator"]);
}

function resolveHeuristicOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  const { detection, question, corpus } = params;

  if (question.mapKey === "objective") {
    return resolveObjectiveOption({ detection, question });
  }
  if (question.mapKey === "format") {
    return resolveFormatOption({ detection, question, corpus });
  }
  if (question.mapKey === "hook") {
    return resolveHookOption({ question, corpus });
  }
  if (question.mapKey === "cta") {
    return resolveCtaOption(question);
  }
  if (question.mapKey === "brand") {
    return resolveBrandOption({ detection, question });
  }
  if (question.mapKey === "collab") {
    return resolveCollabOption(question);
  }

  return null;
}

function resolveCorrectOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  const recommendedOption = params.question.options.find((option) => option.recommended === true);
  if (recommendedOption) return recommendedOption;

  const heuristicOption = resolveHeuristicOption(params);
  if (heuristicOption) return heuristicOption;

  return params.question.options[0] || null;
}

function buildFeedback(mapKey: PostCreationAdaptiveQuestionMapKey): PostCreationAdaptiveAnswerFeedback {
  const rationale = RATIONALE_BY_MAP_KEY[mapKey] || "Essa decisão ajuda a calibrar a recomendação final.";
  return {
    correct: `Esse é o caminho mais forte para esta pauta. ${rationale}`,
    incorrect: `Essa opção pode funcionar, mas eu iria por outro caminho. ${rationale}`,
    rationale,
  };
}

function buildIdealAnswer(params: {
  question: PostCreationAdaptiveQuestion;
  option: PostCreationAdaptiveQuestionOption;
}): PostCreationAdaptiveAnswer {
  return {
    questionId: params.question.id,
    key: params.question.mapKey,
    optionId: params.option.id,
    value: params.option.value ?? params.option.label ?? params.option.id,
  };
}

function buildCorrectAnswersByQuestionId(
  questionKeys: PostCreationAdaptiveQuestionAnswerKey[],
): Record<string, string> {
  return questionKeys.reduce<Record<string, string>>((result, questionKey) => {
    result[questionKey.questionId] = questionKey.correctOptionId;
    return result;
  }, {});
}

function buildScoreContract(total: number) {
  return {
    max: total,
    passing: total > 0 ? Math.ceil(total * 0.75) : 0,
  };
}

function resolveScoreLabel(percentage: number): string {
  if (percentage === 100) return "Leitura afiada";
  if (percentage >= 75) return "Boa leitura estratégica";
  if (percentage >= 50) return "Caminho promissor";
  return "Ainda dá para calibrar";
}

function resolveAnswerOptionId(answer: PostCreationAdaptiveAnswer | undefined): string | null {
  return cleanText(answer?.optionId);
}

export function buildPostCreationAdaptiveAnswerKey(params: {
  detection: PostCreationAdaptiveIntentDetection;
  questions: PostCreationAdaptiveQuestion[];
}): PostCreationAdaptiveAnswerKey {
  const corpus = buildDetectionCorpus(params.detection);
  const questionKeyInputs = params.questions
    .map((question) => {
      const correctOption = resolveCorrectOption({ detection: params.detection, question, corpus });
      if (!correctOption) return null;
      return {
        question,
        correctOption,
      };
    })
    .filter((item): item is { question: PostCreationAdaptiveQuestion; correctOption: PostCreationAdaptiveQuestionOption } =>
      Boolean(item),
    );

  const questionKeys = questionKeyInputs.map<PostCreationAdaptiveQuestionAnswerKey>(({ question, correctOption }) => ({
    questionId: question.id,
    mapKey: question.mapKey,
    correctOptionId: correctOption.id,
    feedback: buildFeedback(question.mapKey),
  }));
  const correctAnswersByQuestionId = buildCorrectAnswersByQuestionId(questionKeys);
  const idealAnswers = questionKeyInputs.map(({ question, correctOption }) =>
    buildIdealAnswer({ question, option: correctOption }),
  );
  const idealPlan = buildPostCreationStrategicPlan({
    detection: params.detection,
    questions: params.questions,
    answers: idealAnswers,
  });
  const legacyHandoff = buildPostCreationLegacyHandoff({ plan: idealPlan });

  return {
    mode: params.detection.mode,
    questionKeys,
    correctAnswersByQuestionId,
    idealAnswers,
    idealPlan,
    legacyHandoff,
    score: buildScoreContract(questionKeys.length),
  };
}

export function evaluatePostCreationAdaptiveAnswers(params: {
  answerKey: PostCreationAdaptiveAnswerKey;
  answers: PostCreationAdaptiveAnswer[];
}): {
  evaluations: PostCreationAdaptiveAnswerEvaluation[];
  score: PostCreationAdaptiveScore;
} {
  const answersByQuestionId = new Map(params.answers.map((answer) => [answer.questionId, answer]));
  const evaluations = params.answerKey.questionKeys.map<PostCreationAdaptiveAnswerEvaluation>((questionKey) => {
    const selectedOptionId = resolveAnswerOptionId(answersByQuestionId.get(questionKey.questionId));
    const correctOptionId = cleanText(questionKey.correctOptionId);
    const isCorrect = Boolean(selectedOptionId && correctOptionId && selectedOptionId === correctOptionId);

    return {
      questionId: questionKey.questionId,
      selectedOptionId,
      correctOptionId,
      isCorrect,
      feedbackTitle: isCorrect ? "Boa aposta" : "Quase",
      feedbackMessage: isCorrect ? questionKey.feedback.correct : questionKey.feedback.incorrect,
      rationale: questionKey.feedback.rationale,
    };
  });

  const total = evaluations.length;
  const correct = evaluations.filter((evaluation) => evaluation.isCorrect).length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    evaluations,
    score: {
      total,
      correct,
      percentage,
      label: resolveScoreLabel(percentage),
      summary: `Você acertou ${correct} de ${total} decisões estratégicas.`,
    },
  };
}
