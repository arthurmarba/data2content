import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveStage,
} from "@/app/dashboard/boards/postCreationAdaptiveTypes";

const MAX_ADAPTIVE_INPUT_LENGTH = 1000;
const ADAPTIVE_MODES = new Set<PostCreationAdaptiveMode>([
  "validate_pauta",
  "discover_pauta",
  "create_by_goal",
  "format_guidance",
  "brand_match",
  "collab_match",
  "comment_to_post",
  "weekly_plan",
  "unknown",
]);
const ADAPTIVE_STAGES = new Set<PostCreationAdaptiveStage>([
  "intent",
  "quiz",
  "plan",
  "legacy_handoff",
]);

function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeStringOrNull(value: unknown, maxLength: number): string | null {
  const normalized = normalizeString(value, maxLength);
  return normalized || null;
}

function normalizeStringArray(value: unknown, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item, maxLength))
    .filter((item) => item.length > 0);
}

function normalizeDetection(value: unknown): PostCreationAdaptiveIntentDetection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const mode = ADAPTIVE_MODES.has(candidate.mode as PostCreationAdaptiveMode)
    ? (candidate.mode as PostCreationAdaptiveMode)
    : null;
  if (!mode) return null;

  const confidence = Number(candidate.confidence);
  const suggestedStage = ADAPTIVE_STAGES.has(candidate.suggestedStage as PostCreationAdaptiveStage)
    ? (candidate.suggestedStage as PostCreationAdaptiveStage)
    : mode === "unknown"
      ? "intent"
      : "quiz";

  return {
    mode,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : mode === "unknown" ? 0.25 : 0.65,
    normalizedInput: normalizeString(candidate.normalizedInput, MAX_ADAPTIVE_INPUT_LENGTH),
    originalInput: normalizeString(candidate.originalInput, MAX_ADAPTIVE_INPUT_LENGTH),
    detectedPauta: normalizeStringOrNull(candidate.detectedPauta, 500),
    objective: normalizeStringOrNull(candidate.objective, 240),
    brandCategory: normalizeStringOrNull(candidate.brandCategory, 160),
    sourceComment: normalizeStringOrNull(candidate.sourceComment, 700),
    signals: normalizeStringArray(candidate.signals),
    suggestedStage,
  };
}

function normalizeQuestion(value: unknown): PostCreationAdaptiveQuestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, any>;
  const options = Array.isArray(candidate.options) ? candidate.options : [];

  return {
    id: normalizeString(candidate.id, 120),
    mapKey: candidate.mapKey || candidate.key,
    type: candidate.type,
    title: normalizeString(candidate.title || candidate.prompt, 300),
    helper: normalizeStringOrNull(candidate.helper || candidate.helperText, 500),
    options: options
      .filter((option: unknown) => option && typeof option === "object" && !Array.isArray(option))
      .map((option: any) => ({
        id: normalizeString(option.id, 120),
        label: normalizeString(option.label, 240),
        reason: normalizeStringOrNull(option.reason, 500),
        description: normalizeStringOrNull(option.description, 500),
        value: normalizeStringOrNull(option.value, 240),
        recommended: option.recommended === true,
      }))
      .filter((option) => option.id && option.label),
    required: candidate.required !== false,
    multiSelect: candidate.multiSelect === true,
  } as PostCreationAdaptiveQuestion;
}

function normalizeAnswer(value: unknown): PostCreationAdaptiveAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const rawValue = candidate.value;
  const answerValue = Array.isArray(rawValue)
    ? normalizeStringArray(rawValue, 240)
    : typeof rawValue === "boolean"
      ? rawValue
      : rawValue === null
        ? null
        : normalizeString(rawValue, 500);

  return {
    questionId: normalizeString(candidate.questionId, 120),
    key: candidate.key as PostCreationAdaptiveAnswer["key"],
    value: answerValue,
    optionId: normalizeStringOrNull(candidate.optionId, 120),
    answeredAt: normalizeStringOrNull(candidate.answeredAt, 80),
  };
}

export function normalizeAdaptiveStartBody(body: any): {
  input: string;
  targetUserId: string;
} {
  return {
    input: normalizeString(body?.input, MAX_ADAPTIVE_INPUT_LENGTH),
    targetUserId: normalizeString(body?.targetUserId, 120),
  };
}

export function normalizeAdaptivePlanBody(body: any): {
  detection: PostCreationAdaptiveIntentDetection | null;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  targetUserId: string;
} {
  return {
    detection: normalizeDetection(body?.detection),
    questions: Array.isArray(body?.questions)
      ? body.questions
          .map(normalizeQuestion)
          .filter((question: PostCreationAdaptiveQuestion | null): question is PostCreationAdaptiveQuestion => Boolean(question))
      : [],
    answers: Array.isArray(body?.answers)
      ? body.answers
          .map(normalizeAnswer)
          .filter((answer: PostCreationAdaptiveAnswer | null): answer is PostCreationAdaptiveAnswer => Boolean(answer))
      : [],
    targetUserId: normalizeString(body?.targetUserId, 120),
  };
}

export function isValidAdaptiveStartBody(normalized: ReturnType<typeof normalizeAdaptiveStartBody>): boolean {
  return typeof normalized.input === "string" && normalized.input.trim().length >= 2;
}

export function isValidAdaptivePlanBody(normalized: ReturnType<typeof normalizeAdaptivePlanBody>): boolean {
  return Boolean(
    normalized.detection?.mode &&
      Array.isArray(normalized.questions) &&
      normalized.questions.length > 0 &&
      Array.isArray(normalized.answers)
  );
}
