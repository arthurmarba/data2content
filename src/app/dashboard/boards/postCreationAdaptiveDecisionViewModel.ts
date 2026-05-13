import type {
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveAnswerKey,
} from "./postCreationAdaptiveAnswerKey";
import type { PostCreationAdaptiveGameOptionRole } from "./postCreationAdaptiveGameContract";
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
  gameRole: PostCreationAdaptiveGameOptionRole | null;
  gameReason: string | null;
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
  correctOptionLabel: string | null;
  correctReason: string | null;
  selectedIncorrectReason: string | null;
  selectedOptionReason: string | null;
  gameEvidence: string[];
  feedbackMode: "correct" | "incorrect" | "neutral";
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

function mergeEvidence(...groups: Array<Array<string | null | undefined> | undefined>): string[] {
  return normalizeEvidence(groups.flatMap((group) => group || []));
}

function sanitizeStrategicCopy(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/\bPor que essa resposta venceu\b/g, "Por que esse caminho é mais coerente")
    .replace(/\bPor que sua aposta perdeu força\b/g, "Por que eu ajustaria essa escolha")
    .replace(/\bTente acertar o caminho mais forte\b/g, "Escolha o caminho que parece mais estratégico")
    .replace(/\bEssa opção pode funcionar, mas eu iria por outro caminho\b/g, "Essa escolha pode funcionar, mas eu ajustaria o caminho para fortalecer a pauta")
    .replace(/\bEsse caminho está bem alinhado\b/g, "Essa leitura está bem alinhada")
    .replace(/\bEssa resposta venceu\b/g, "Esse caminho se destaca")
    .replace(/\bessa resposta venceu\b/g, "esse caminho se destaca")
    .replace(/\bResposta mais forte\b/g, "Caminho mais coerente")
    .replace(/\bcaminho mais forte\b/g, "caminho mais coerente")
    .replace(/\bmais forte\b/g, "mais coerente")
    .replace(/\bvencem\b/g, "se destacam")
    .replace(/\bvenceu\b/g, "se destacou")
    .replace(/\bperde força\b/g, "fica menos estratégico")
    .replace(/\bperdeu força\b/g, "ficou menos estratégico")
    .replace(/\bBoa aposta\b/g, "Boa leitura")
    .replace(/\bQuase\b/g, "Bom ponto de partida")
    .replace(/\bAposta registrada\b/g, "Leitura registrada")
    .replace(/\bSua aposta\b/g, "Sua leitura");
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
  const gameQuestion =
    params.answerKey?.gameQuestions?.find((candidate) => candidate.questionId === params.question.id && candidate.isValid)
    || null;
  const correctOption = correctOptionId
    ? params.question.options.find((option) => option.id === correctOptionId) || null
    : null;
  const selectedGameOption = selectedOptionId
    ? gameQuestion?.options.find((option) => option.optionId === selectedOptionId) || null
    : null;
  const gameEvidence = shouldRevealFeedback && gameQuestion ? normalizeEvidence(gameQuestion.evidence) : [];
  const feedbackEvidence = shouldRevealFeedback
    ? mergeEvidence(evaluation?.evidence, gameEvidence)
    : [];
  const feedbackMode =
    shouldRevealFeedback && selectedIsCorrect === true
      ? "correct"
      : shouldRevealFeedback && selectedIsCorrect === false
        ? "incorrect"
        : "neutral";

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
    feedbackTitle: sanitizeStrategicCopy(evaluation?.feedbackTitle),
    feedbackMessage: sanitizeStrategicCopy(evaluation?.feedbackMessage),
    feedbackRationale: evaluation?.rationale ?? null,
    feedbackEvidence,
    correctOptionLabel: shouldRevealFeedback && gameQuestion ? normalizeNullableText(correctOption?.label) : null,
    correctReason: sanitizeStrategicCopy(shouldRevealFeedback && gameQuestion ? normalizeNullableText(gameQuestion.correctReason) : null),
    selectedIncorrectReason:
      sanitizeStrategicCopy(shouldRevealFeedback && selectedOptionId && selectedIsCorrect === false && gameQuestion
        ? normalizeNullableText(gameQuestion.incorrectReasonsByOptionId[selectedOptionId])
        : null),
    selectedOptionReason:
      sanitizeStrategicCopy(shouldRevealFeedback && selectedGameOption ? normalizeNullableText(selectedGameOption.reason) : null),
    gameEvidence,
    feedbackMode,
    shouldRevealFeedback,
    options: params.question.options.map((option) => ({
      ...(() => {
        const gameOption = gameQuestion?.options.find((candidate) => candidate.optionId === option.id) || null;
        return {
          gameRole: gameOption?.role ?? null,
          gameReason: sanitizeStrategicCopy(normalizeNullableText(gameOption?.reason)),
        };
      })(),
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
