import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";

export type PostCreationAdaptiveSnapshotStatus =
  | "idle"
  | "starting"
  | "quiz"
  | "planning"
  | "plan_ready"
  | "error";

export type PostCreationAdaptiveSnapshot = {
  input: string;
  status: PostCreationAdaptiveSnapshotStatus;
  detection: PostCreationAdaptiveIntentDetection | null;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  plan: PostCreationStrategicPlan | null;
  legacyHandoff: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  } | null;
  error: string | null;
  updatedAt?: string | null;
};

const SNAPSHOT_STATUSES = new Set<PostCreationAdaptiveSnapshotStatus>([
  "idle",
  "starting",
  "quiz",
  "planning",
  "plan_ready",
  "error",
]);

export function createEmptyPostCreationAdaptiveSnapshot(): PostCreationAdaptiveSnapshot {
  return {
    input: "",
    status: "idle",
    detection: null,
    questions: [],
    answers: [],
    plan: null,
    legacyHandoff: null,
    error: null,
    updatedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSnapshotStatus(
  status: unknown,
  questions: PostCreationAdaptiveQuestion[],
  plan: PostCreationStrategicPlan | null,
): PostCreationAdaptiveSnapshotStatus {
  if (!SNAPSHOT_STATUSES.has(status as PostCreationAdaptiveSnapshotStatus)) {
    return plan ? "plan_ready" : questions.length > 0 ? "quiz" : "idle";
  }
  if (status === "starting" || status === "planning") {
    return plan ? "plan_ready" : questions.length > 0 ? "quiz" : "idle";
  }
  if (status === "plan_ready" && !plan) {
    return questions.length > 0 ? "quiz" : "idle";
  }
  return status as PostCreationAdaptiveSnapshotStatus;
}

export function normalizePostCreationAdaptiveSnapshot(value: unknown): PostCreationAdaptiveSnapshot | null {
  if (!isRecord(value)) return null;

  const questions = Array.isArray(value.questions)
    ? (value.questions.filter(isRecord) as PostCreationAdaptiveQuestion[])
    : [];
  const answers = Array.isArray(value.answers)
    ? (value.answers.filter(isRecord) as PostCreationAdaptiveAnswer[])
    : [];
  const detection = isRecord(value.detection)
    ? (value.detection as PostCreationAdaptiveIntentDetection)
    : null;
  const plan = isRecord(value.plan) ? (value.plan as PostCreationStrategicPlan) : null;
  const legacyHandoff = isRecord(value.legacyHandoff)
    ? (value.legacyHandoff as PostCreationAdaptiveSnapshot["legacyHandoff"])
    : null;
  const status = normalizeSnapshotStatus(value.status, questions, plan);

  return {
    input: typeof value.input === "string" ? value.input : "",
    status,
    detection,
    questions,
    answers,
    plan,
    legacyHandoff,
    error: typeof value.error === "string" && value.error.trim() ? value.error.trim() : null,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim() ? value.updatedAt.trim() : null,
  };
}

export function isMeaningfulPostCreationAdaptiveSnapshot(
  snapshot: PostCreationAdaptiveSnapshot | null,
): boolean {
  if (!snapshot) return false;
  return Boolean(
    snapshot.input.trim() ||
      snapshot.detection ||
      snapshot.questions.length > 0 ||
      snapshot.answers.length > 0 ||
      snapshot.plan ||
      snapshot.legacyHandoff ||
      snapshot.error,
  );
}
