import {
  sanitizeVideoNarrativeDiagnosisText,
  type VideoNarrativeDiagnosisCreatorSignal,
  type VideoNarrativeDiagnosisCreatorSignalType,
} from "./videoNarrativeDiagnosisLearningModel";

export type VideoNarrativeCreatorProfileSignalStatus =
  | "active"
  | "emerging"
  | "weak"
  | "archived";

export type VideoNarrativeCreatorProfileSignalStrength = "low" | "medium" | "high";

export type VideoNarrativeCreatorProfileSignalCategory =
  | "content_goals"
  | "creative_preferences"
  | "commercial_preferences"
  | "recurring_pains"
  | "hook_preferences"
  | "format_preferences"
  | "brand_territories"
  | "collab_preferences"
  | "production_constraints"
  | "audience_relationship"
  | "positioning_signals"
  | "instagram_patterns"
  | "unknown";

export type VideoNarrativeCreatorProfileSignalSource =
  | "creator_question"
  | "quiz_answer"
  | "video_analysis"
  | "diagnosis"
  | "instagram_context"
  | "manual_review"
  | "historical_diagnosis";

export interface VideoNarrativeCreatorProfileSignalEvidence {
  source: VideoNarrativeCreatorProfileSignalSource;
  value: string;
  diagnosisId?: string | null;
  questionId?: string | null;
  createdAt?: string | null;
}

export interface VideoNarrativeCreatorProfileSignal {
  id: string;
  category: VideoNarrativeCreatorProfileSignalCategory;
  type: string;
  value: string;
  strength: VideoNarrativeCreatorProfileSignalStrength;
  status: VideoNarrativeCreatorProfileSignalStatus;
  confidence: "low" | "medium" | "high";
  recurrenceCount: number;
  evidence: VideoNarrativeCreatorProfileSignalEvidence[];
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  shouldPersistLater: boolean;
}

export interface VideoNarrativeCreatorProfileSummary {
  strongestContentGoals: string[];
  recurringPainPoints: string[];
  preferredFormats: string[];
  preferredHookDirections: string[];
  preferredBrandTerritories: string[];
  commercialPreferences: string[];
  productionConstraints: string[];
  audienceRelationshipSignals: string[];
  positioningSignals: string[];
}

export interface VideoNarrativeCreatorProfile {
  creatorId: string | null;
  signals: VideoNarrativeCreatorProfileSignal[];
  summary: VideoNarrativeCreatorProfileSummary;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface VideoNarrativeCreatorProfileBuildInput {
  creatorId?: string | null;
  existingProfile?: VideoNarrativeCreatorProfile | null;
  newSignals: VideoNarrativeDiagnosisCreatorSignal[];
  diagnosisId?: string | null;
  createdAt?: string | null;
}

const CATEGORY_BY_DIAGNOSIS_SIGNAL_TYPE: Record<
  VideoNarrativeDiagnosisCreatorSignalType,
  VideoNarrativeCreatorProfileSignalCategory
> = {
  content_goal: "content_goals",
  creative_preference: "creative_preferences",
  commercial_preference: "commercial_preferences",
  recurring_pain: "recurring_pains",
  hook_preference: "hook_preferences",
  format_preference: "format_preferences",
  brand_territory: "brand_territories",
  collab_preference: "collab_preferences",
  production_constraint: "production_constraints",
  audience_relationship: "audience_relationship",
  positioning_signal: "positioning_signals",
  unknown: "unknown",
};

const PROFILE_SOURCE_BY_DIAGNOSIS_SOURCE: Record<
  VideoNarrativeDiagnosisCreatorSignal["source"],
  VideoNarrativeCreatorProfileSignalSource
> = {
  creator_question: "creator_question",
  quiz_answer: "quiz_answer",
  video_analysis: "video_analysis",
  seed: "diagnosis",
  instagram_context: "instagram_context",
  diagnosis_inference: "diagnosis",
};

const CONFIDENCE_RANK: Record<"low" | "medium" | "high", number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const STRENGTH_RANK: Record<VideoNarrativeCreatorProfileSignalStrength, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const BLOCKED_TERMS = [
  "viralizar garantido",
  "treinado permanentemente",
  "resposta correta",
  "garantido",
  "certeza",
  "comprovado",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "venceu",
  "perdeu",
];

function emptySummary(): VideoNarrativeCreatorProfileSummary {
  return {
    strongestContentGoals: [],
    recurringPainPoints: [],
    preferredFormats: [],
    preferredHookDirections: [],
    preferredBrandTerritories: [],
    commercialPreferences: [],
    productionConstraints: [],
    audienceRelationshipSignals: [],
    positioningSignals: [],
  };
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function normalize(value: string): string {
  return sanitizeVideoNarrativeCreatorProfileText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickHigherConfidence(
  left: "low" | "medium" | "high",
  right: "low" | "medium" | "high",
): "low" | "medium" | "high" {
  return CONFIDENCE_RANK[right] > CONFIDENCE_RANK[left] ? right : left;
}

function strengthFromConfidence(confidence: "low" | "medium" | "high"): VideoNarrativeCreatorProfileSignalStrength {
  if (confidence === "high") return "high";
  if (confidence === "medium") return "medium";
  return "low";
}

function statusFromSignal(params: {
  confidence: "low" | "medium" | "high";
  recurrenceCount: number;
}): VideoNarrativeCreatorProfileSignalStatus {
  if (params.confidence === "low") return "weak";
  if (params.recurrenceCount >= 2) return "active";
  return "emerging";
}

function mergeDates(
  left: string | null,
  right: string | null,
  direction: "oldest" | "newest",
): string | null {
  if (!left) return right;
  if (!right) return left;
  return direction === "oldest"
    ? (left <= right ? left : right)
    : (left >= right ? left : right);
}

function evidenceKey(evidence: VideoNarrativeCreatorProfileSignalEvidence): string {
  return [
    evidence.source,
    evidence.value,
    evidence.diagnosisId ?? "",
    evidence.questionId ?? "",
    evidence.createdAt ?? "",
  ].join("|");
}

function dedupeEvidence(
  evidence: VideoNarrativeCreatorProfileSignalEvidence[],
): VideoNarrativeCreatorProfileSignalEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = evidenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeKey(signal: VideoNarrativeCreatorProfileSignal): string {
  return [
    signal.category,
    normalize(signal.type),
    normalize(signal.value),
  ].join("|");
}

function sortSignalsForSummary(
  signals: VideoNarrativeCreatorProfileSignal[],
): VideoNarrativeCreatorProfileSignal[] {
  return [...signals].sort((left, right) => {
    const strengthDelta = STRENGTH_RANK[right.strength] - STRENGTH_RANK[left.strength];
    if (strengthDelta !== 0) return strengthDelta;
    return right.recurrenceCount - left.recurrenceCount;
  });
}

function valuesForCategory(
  signals: VideoNarrativeCreatorProfileSignal[],
  category: VideoNarrativeCreatorProfileSignalCategory,
): string[] {
  return sortSignalsForSummary(signals)
    .filter((signal) =>
      signal.category === category &&
      (signal.status === "active" || signal.status === "emerging") &&
      hasText(signal.value),
    )
    .map((signal) => signal.value)
    .slice(0, 5);
}

export function createEmptyVideoNarrativeCreatorProfile(params?: {
  creatorId?: string | null;
  createdAt?: string | null;
}): VideoNarrativeCreatorProfile {
  return {
    creatorId: params?.creatorId ?? null,
    signals: [],
    summary: emptySummary(),
    createdAt: params?.createdAt ?? null,
    updatedAt: params?.createdAt ?? null,
  };
}

export function sanitizeVideoNarrativeCreatorProfileText(value: string): string {
  let sanitized = sanitizeVideoNarrativeDiagnosisText(value);
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{8,}/g, "[redigido]");
  sanitized = sanitized.replace(/\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+/g, "[redigido]");
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, "[redigido]");
  sanitized = sanitized.replace(/\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi, "[redigido]");

  BLOCKED_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "gi"), "[redigido]");
  });

  return sanitized.trim();
}

export function mapDiagnosisSignalToCreatorProfileSignal(params: {
  signal: VideoNarrativeDiagnosisCreatorSignal;
  diagnosisId?: string | null;
  createdAt?: string | null;
}): VideoNarrativeCreatorProfileSignal {
  const category = CATEGORY_BY_DIAGNOSIS_SIGNAL_TYPE[params.signal.type] ?? "unknown";
  const value = sanitizeVideoNarrativeCreatorProfileText(params.signal.value);
  const type = sanitizeVideoNarrativeCreatorProfileText(params.signal.type);
  const confidence = params.signal.confidence;
  const recurrenceCount = 1;
  const createdAt = params.createdAt ?? null;
  const source = PROFILE_SOURCE_BY_DIAGNOSIS_SOURCE[params.signal.source] ?? "diagnosis";
  const evidenceValue = sanitizeVideoNarrativeCreatorProfileText(params.signal.evidence ?? params.signal.value);

  return {
    id: `creator-profile-${category}-${normalize(type)}-${normalize(value) || "signal"}`,
    category,
    type,
    value,
    strength: strengthFromConfidence(confidence),
    status: statusFromSignal({ confidence, recurrenceCount }),
    confidence,
    recurrenceCount,
    evidence: evidenceValue
      ? [{
          source,
          value: evidenceValue,
          diagnosisId: params.diagnosisId ?? null,
          createdAt,
        }]
      : [],
    firstSeenAt: createdAt,
    lastSeenAt: createdAt,
    shouldPersistLater: params.signal.shouldPersistLater,
  };
}

export function mergeVideoNarrativeCreatorProfileSignals(params: {
  existingSignals: VideoNarrativeCreatorProfileSignal[];
  newSignals: VideoNarrativeCreatorProfileSignal[];
}): VideoNarrativeCreatorProfileSignal[] {
  const merged = new Map<string, VideoNarrativeCreatorProfileSignal>();

  [...params.existingSignals, ...params.newSignals].forEach((signal) => {
    const sanitizedSignal: VideoNarrativeCreatorProfileSignal = {
      ...signal,
      type: sanitizeVideoNarrativeCreatorProfileText(signal.type),
      value: sanitizeVideoNarrativeCreatorProfileText(signal.value),
      evidence: signal.evidence.map((item) => ({
        ...item,
        value: sanitizeVideoNarrativeCreatorProfileText(item.value),
      })),
    };
    const key = mergeKey(sanitizedSignal);
    const existing = merged.get(key);

    if (!existing) {
      const confidence = sanitizedSignal.confidence;
      const recurrenceCount = Math.max(1, sanitizedSignal.recurrenceCount);
      merged.set(key, {
        ...sanitizedSignal,
        confidence,
        recurrenceCount,
        strength: strengthFromConfidence(confidence),
        status: statusFromSignal({ confidence, recurrenceCount }),
        evidence: dedupeEvidence(sanitizedSignal.evidence),
      });
      return;
    }

    const confidence = pickHigherConfidence(existing.confidence, sanitizedSignal.confidence);
    const recurrenceCount = existing.recurrenceCount + Math.max(1, sanitizedSignal.recurrenceCount);
    merged.set(key, {
      ...existing,
      confidence,
      recurrenceCount,
      strength: strengthFromConfidence(confidence),
      status: statusFromSignal({ confidence, recurrenceCount }),
      evidence: dedupeEvidence([...existing.evidence, ...sanitizedSignal.evidence]),
      firstSeenAt: mergeDates(existing.firstSeenAt, sanitizedSignal.firstSeenAt, "oldest"),
      lastSeenAt: mergeDates(existing.lastSeenAt, sanitizedSignal.lastSeenAt, "newest"),
      shouldPersistLater: existing.shouldPersistLater || sanitizedSignal.shouldPersistLater,
    });
  });

  return Array.from(merged.values());
}

export function summarizeVideoNarrativeCreatorProfile(
  signals: VideoNarrativeCreatorProfileSignal[],
): VideoNarrativeCreatorProfileSummary {
  return {
    strongestContentGoals: valuesForCategory(signals, "content_goals"),
    recurringPainPoints: valuesForCategory(signals, "recurring_pains"),
    preferredFormats: valuesForCategory(signals, "format_preferences"),
    preferredHookDirections: valuesForCategory(signals, "hook_preferences"),
    preferredBrandTerritories: valuesForCategory(signals, "brand_territories"),
    commercialPreferences: valuesForCategory(signals, "commercial_preferences"),
    productionConstraints: valuesForCategory(signals, "production_constraints"),
    audienceRelationshipSignals: valuesForCategory(signals, "audience_relationship"),
    positioningSignals: valuesForCategory(signals, "positioning_signals"),
  };
}

export function buildVideoNarrativeCreatorProfile(
  input: VideoNarrativeCreatorProfileBuildInput,
): VideoNarrativeCreatorProfile {
  const existingProfile =
    input.existingProfile ??
    createEmptyVideoNarrativeCreatorProfile({
      creatorId: input.creatorId ?? null,
      createdAt: input.createdAt ?? null,
    });
  const mappedSignals = input.newSignals.map((signal) =>
    mapDiagnosisSignalToCreatorProfileSignal({
      signal,
      diagnosisId: input.diagnosisId ?? null,
      createdAt: input.createdAt ?? null,
    }),
  );
  const signals = mergeVideoNarrativeCreatorProfileSignals({
    existingSignals: existingProfile.signals,
    newSignals: mappedSignals,
  });

  return {
    creatorId: input.creatorId ?? existingProfile.creatorId ?? null,
    signals,
    summary: summarizeVideoNarrativeCreatorProfile(signals),
    createdAt: existingProfile.createdAt ?? input.createdAt ?? null,
    updatedAt: input.createdAt ?? existingProfile.updatedAt ?? null,
  };
}

export function hasUsefulVideoNarrativeCreatorProfile(
  profile: VideoNarrativeCreatorProfile,
): boolean {
  return profile.signals.some((signal) =>
    hasText(signal.value) &&
    signal.status !== "archived" &&
    signal.status !== "weak",
  );
}
