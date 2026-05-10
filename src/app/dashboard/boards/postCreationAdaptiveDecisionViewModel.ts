import type {
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveAnswerKey,
} from "./postCreationAdaptiveAnswerKey";
import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionType,
} from "./postCreationAdaptiveTypes";

export type PostCreationAdaptiveDecisionOptionViewModel = {
  id: string;
  label: string;
  reason: string | null;
  value: string | string[] | boolean | null;
  selected: boolean;
  recommended: boolean;
  isCorrect: boolean | null;
  isIncorrectSelection: boolean;
};

export type PostCreationAdaptiveDecisionViewModel = {
  id: string;
  title: string;
  helper: string | null;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  questionType: PostCreationAdaptiveQuestionType;
  visualStep: string;
  progressLabel: string;
  progressValue: number;
  questionIndex: number;
  questionCount: number;
  selectedOptionId: string | null;
  selectedAnswer: PostCreationAdaptiveAnswer | null;
  canAdvance: boolean;
  nextLabel: string;
  correctOptionId: string | null;
  selectedIsCorrect: boolean | null;
  feedbackTitle: string | null;
  feedbackMessage: string | null;
  feedbackRationale: string | null;
  feedbackEvidence: string[];
  shouldRevealFeedback: boolean;
  options: PostCreationAdaptiveDecisionOptionViewModel[];
};

const VISUAL_STEP_LABELS: Record<PostCreationAdaptiveQuestionMapKey, string> = {
  objective: "Objetivo",
  format: "Formato",
  narrative: "Narrativa",
  hook: "Gancho",
  cta: "CTA",
  brand: "Marca",
  collab: "Collab",
  who: "Quem",
  what: "O quê",
  where: "Onde",
  when: "Quando",
  why: "Por quê",
  how: "Como",
  how_much: "Esforço",
  effort: "Esforço",
  schedule: "Cadência",
};

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function resolveVisualStep(mapKey: PostCreationAdaptiveQuestionMapKey): string {
  return VISUAL_STEP_LABELS[mapKey] || "Decisão";
}

function resolveSelectedOptionId(answer: PostCreationAdaptiveAnswer | null): string | null {
  return normalizeNullableText(answer?.optionId);
}

function normalizeEvidence(values: Array<string | null | undefined> | undefined): string[] {
  if (!values) return [];
  return Array.from(new Set(values.map(normalizeNullableText).filter((item): item is string => Boolean(item)))).slice(0, 3);
}

export function buildAdaptiveDecisionViewModel(params: {
  question: PostCreationAdaptiveQuestion;
  answers: PostCreationAdaptiveAnswer[];
  questionIndex: number;
  questionCount: number;
  answerKey?: PostCreationAdaptiveAnswerKey | null;
  evaluations?: PostCreationAdaptiveAnswerEvaluation[];
}): PostCreationAdaptiveDecisionViewModel {
  const safeQuestionCount = Math.max(1, Math.floor(params.questionCount || 0));
  const safeQuestionIndex = clampNumber(Math.floor(params.questionIndex || 0), 0, safeQuestionCount - 1);
  const progressValue = clampNumber((safeQuestionIndex + 1) / safeQuestionCount, 0, 1);
  const selectedAnswer =
    params.answers.find((answer) => answer.questionId === params.question.id) || null;
  const selectedOptionId = resolveSelectedOptionId(selectedAnswer);
  const isLastQuestion = safeQuestionIndex >= safeQuestionCount - 1;
  const correctOptionId =
    normalizeNullableText(params.answerKey?.correctAnswersByQuestionId?.[params.question.id]) || null;
  const selectedIsCorrect =
    selectedOptionId && correctOptionId ? selectedOptionId === correctOptionId : null;
  const evaluation =
    params.evaluations?.find((candidate) => candidate.questionId === params.question.id) || null;
  const shouldRevealFeedback = Boolean(selectedOptionId && correctOptionId);

  return {
    id: params.question.id,
    title: params.question.title,
    helper: normalizeNullableText(params.question.helper),
    mapKey: params.question.mapKey,
    questionType: params.question.type,
    visualStep: resolveVisualStep(params.question.mapKey),
    progressLabel: `Pergunta ${safeQuestionIndex + 1} de ${safeQuestionCount}`,
    progressValue,
    questionIndex: safeQuestionIndex,
    questionCount: safeQuestionCount,
    selectedOptionId,
    selectedAnswer,
    canAdvance: params.question.required !== true || Boolean(selectedOptionId),
    nextLabel: isLastQuestion ? "Ver plano estratégico" : "Próxima decisão",
    correctOptionId,
    selectedIsCorrect,
    feedbackTitle: evaluation?.feedbackTitle ?? null,
    feedbackMessage: evaluation?.feedbackMessage ?? null,
    feedbackRationale: evaluation?.rationale ?? null,
    feedbackEvidence: normalizeEvidence(evaluation?.evidence),
    shouldRevealFeedback,
    options: params.question.options.map((option) => ({
      id: option.id,
      label: option.label,
      reason: normalizeNullableText(option.reason),
      value: option.value ?? option.label ?? option.id ?? null,
      selected: option.id === selectedOptionId,
      recommended: option.recommended === true,
      isCorrect: correctOptionId ? option.id === correctOptionId : null,
      isIncorrectSelection: Boolean(
        selectedOptionId
          && correctOptionId
          && option.id === selectedOptionId
          && option.id !== correctOptionId,
      ),
    })),
  };
}
