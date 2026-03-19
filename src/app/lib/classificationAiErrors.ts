export type ClassificationAiFailureKind = "rate_limit" | "insufficient_quota" | "other";

const INSUFFICIENT_QUOTA_PATTERNS = [
  "insufficient_quota",
  "exceeded your current quota",
  "check your plan and billing details",
  "billing",
  "credit balance",
  "insufficient balance",
  "saldo insuficiente",
  "saldo da ia",
];

const RATE_LIMIT_PATTERNS = [
  "rate limit",
  "too many requests",
  "please try again in",
  "requests per min",
  "tokens per min",
];

function normalizeMessage(message: string | null | undefined): string {
  return (message ?? "").trim().toLowerCase();
}

export function classifyAiFailureMessage(message: string | null | undefined): ClassificationAiFailureKind {
  const normalized = normalizeMessage(message);
  if (!normalized) return "other";

  if (INSUFFICIENT_QUOTA_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return "insufficient_quota";
  }

  if (RATE_LIMIT_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return "rate_limit";
  }

  return "other";
}

export function isRetryableAiFailureMessage(message: string | null | undefined): boolean {
  return classifyAiFailureMessage(message) !== "other";
}

export function buildDeferredClassificationErrorMessage(kind: Exclude<ClassificationAiFailureKind, "other">): string {
  if (kind === "insufficient_quota") {
    return "Classificação adiada: saldo/quota da IA indisponível. Reprocesse quando o saldo for restabelecido.";
  }

  return "Classificação adiada: limite temporário da IA atingido. O item pode ser reprocessado depois.";
}
