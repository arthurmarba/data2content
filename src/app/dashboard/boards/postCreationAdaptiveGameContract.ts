import type {
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
} from "./postCreationAdaptiveTypes";

export type PostCreationAdaptiveGameOptionRole = "correct" | "distractor";

export type PostCreationAdaptiveGameOptionContract = {
  optionId: string;
  role: PostCreationAdaptiveGameOptionRole;
  reason: string;
  evidence: string[];
};

export type PostCreationAdaptiveGameValidationResult = {
  isValid: boolean;
  validationErrors: string[];
};

export type PostCreationAdaptiveGameQuestionContract = PostCreationAdaptiveGameValidationResult & {
  questionId: string;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  correctOptionId: string | null;
  options: PostCreationAdaptiveGameOptionContract[];
  correctReason: string | null;
  incorrectReasonsByOptionId: Record<string, string>;
  evidence: string[];
};

export type PostCreationAdaptiveGameQuestionAnswerKeyInput = {
  questionId: string;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  correctOptionId: string;
  feedback: {
    rationale: string;
    evidence?: string[];
  };
};

export type BuildPostCreationAdaptiveGameQuestionContractParams = {
  question: PostCreationAdaptiveQuestion;
  questionKey?: PostCreationAdaptiveGameQuestionAnswerKeyInput | null;
};

export type BuildPostCreationAdaptiveGameContractParams = {
  questions: PostCreationAdaptiveQuestion[];
  answerKey: {
    questionKeys: PostCreationAdaptiveGameQuestionAnswerKeyInput[];
  };
};

function cleanText(value?: string | null): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return trimmed || null;
}

function compactEvidence(evidence: Array<string | null | undefined>): string[] {
  return Array.from(new Set(evidence.map(cleanText).filter((item): item is string => Boolean(item)))).slice(0, 3);
}

function lowerFirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function resolveCorrectReason(params: {
  optionReason?: string | null;
  rationale?: string | null;
}): string {
  return cleanText(params.rationale)
    || cleanText(params.optionReason)
    || "Essa alternativa representa o caminho mais alinhado com o gabarito estratégico.";
}

function resolveDistractorReason(params: {
  optionReason?: string | null;
  rationale?: string | null;
}): string {
  const optionReason = cleanText(params.optionReason);
  const rationale = cleanText(params.rationale);
  const comparison = rationale
    ? `fica menos forte aqui porque ${lowerFirst(rationale)}`
    : "fica menos forte do que o caminho recomendado para esta decisão.";

  return optionReason
    ? `${optionReason} Ainda assim, ${comparison}`
    : `Pode funcionar como alternativa, mas ${comparison}`;
}

export function buildPostCreationAdaptiveGameQuestionContract({
  question,
  questionKey,
}: BuildPostCreationAdaptiveGameQuestionContractParams): PostCreationAdaptiveGameQuestionContract {
  const validationErrors: string[] = [];
  const correctOptionId = cleanText(questionKey?.correctOptionId);
  const evidence = compactEvidence(questionKey?.feedback.evidence || []);
  const correctOption = correctOptionId
    ? question.options.find((option) => option.id === correctOptionId) || null
    : null;
  const rationale = cleanText(questionKey?.feedback.rationale);

  if (question.options.length !== 4) {
    validationErrors.push("GameQuestion precisa ter exatamente 4 opções.");
  }
  if (!questionKey) {
    validationErrors.push("Gabarito da pergunta não encontrado.");
  }
  if (correctOptionId && !correctOption) {
    validationErrors.push("Opção correta não encontrada na pergunta.");
  }
  if (!correctOptionId) {
    validationErrors.push("Opção correta não definida no gabarito.");
  }

  const options = question.options.map<PostCreationAdaptiveGameOptionContract>((option) => {
    const isCorrect = Boolean(correctOptionId && option.id === correctOptionId);
    return {
      optionId: option.id,
      role: isCorrect ? "correct" : "distractor",
      reason: isCorrect
        ? resolveCorrectReason({ optionReason: option.reason, rationale })
        : resolveDistractorReason({ optionReason: option.reason, rationale }),
      evidence: isCorrect ? evidence : [],
    };
  });

  const correctCount = options.filter((option) => option.role === "correct").length;
  const distractorCount = options.filter((option) => option.role === "distractor").length;
  if (correctCount !== 1) {
    validationErrors.push("GameQuestion precisa ter exatamente 1 opção correta.");
  }
  if (distractorCount !== 3) {
    validationErrors.push("GameQuestion precisa ter exatamente 3 alternativas plausíveis.");
  }
  if (options.some((option) => !cleanText(option.reason))) {
    validationErrors.push("Todas as alternativas precisam ter uma razão.");
  }

  const incorrectReasonsByOptionId = options.reduce<Record<string, string>>((result, option) => {
    if (option.role === "distractor") {
      result[option.optionId] = option.reason;
    }
    return result;
  }, {});

  return {
    questionId: question.id,
    mapKey: question.mapKey,
    correctOptionId,
    options,
    correctReason: options.find((option) => option.role === "correct")?.reason || null,
    incorrectReasonsByOptionId,
    evidence,
    isValid: validationErrors.length === 0,
    validationErrors,
  };
}

export function buildPostCreationAdaptiveGameContract({
  questions,
  answerKey,
}: BuildPostCreationAdaptiveGameContractParams): PostCreationAdaptiveGameQuestionContract[] {
  const questionKeysById = new Map(answerKey.questionKeys.map((questionKey) => [questionKey.questionId, questionKey]));
  return questions.map((question) =>
    buildPostCreationAdaptiveGameQuestionContract({
      question,
      questionKey: questionKeysById.get(question.id) || null,
    }),
  );
}
