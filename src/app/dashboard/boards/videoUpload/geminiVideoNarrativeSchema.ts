import {
  VideoNarrativeAnalysis,
  VideoNarrativeConfidence,
  VideoNarrativeD2CFormat,
  VideoNarrativeD2CProposal,
  VideoNarrativeHookStrength,
  VideoNarrativeSceneRole,
  createEmptyVideoNarrativeAnalysis,
  hasUsefulVideoNarrativeAnalysis,
  sanitizeVideoNarrativeAnalysisText,
} from "./videoNarrativeAnalysisTypes";

export type GeminiVideoNarrativeRawResponse = {
  hook?: { detected?: unknown; strength?: unknown; why?: unknown };
  summary?: unknown;
  spokenTopics?: unknown;
  onScreenText?: unknown;
  visualElements?: unknown;
  sceneStructure?: unknown;
  d2cClassification?: unknown;
  diagnosis?: unknown;
  blueprintSuggestion?: unknown;
  brandMatch?: unknown;
  evidence?: unknown;
  evidenceAnchors?: unknown;
  profileSignals?: unknown;
  confidence?: unknown;
};

export type GeminiVideoNarrativeSchemaIssueCode =
  | "invalid_json"
  | "missing_object"
  | "invalid_hook"
  | "invalid_classification"
  | "invalid_diagnosis"
  | "invalid_blueprint"
  | "invalid_evidence_anchors"
  | "unsafe_language"
  | "insufficient_context";

export type GeminiVideoNarrativeSchemaIssue = {
  code: GeminiVideoNarrativeSchemaIssueCode;
  message: string;
};

export type GeminiVideoNarrativeParseResult = {
  ok: boolean;
  analysis: VideoNarrativeAnalysis | null;
  issues: GeminiVideoNarrativeSchemaIssue[];
};

const hookStrengths = new Set<VideoNarrativeHookStrength>(["weak", "medium", "strong", "unknown"]);
const confidenceValues = new Set<VideoNarrativeConfidence>(["low", "medium", "high", "unknown"]);
const sceneRoles = new Set<VideoNarrativeSceneRole>([
  "hook",
  "context",
  "development",
  "proof",
  "turning_point",
  "call_to_action",
  "closing",
  "unknown",
]);
const d2cFormats = new Set<VideoNarrativeD2CFormat>(["reel", "photo", "carousel", "long_video", "unknown"]);
const d2cProposals = new Set<VideoNarrativeD2CProposal>([
  "tips",
  "review",
  "humor_scene",
  "positioning_authority",
  "behind_the_scenes",
  "comparison",
  "announcement",
  "comment_to_post",
  "ad_adaptation",
  "collab_narrative",
  "unknown",
]);
const profileSignalTypes = new Set([
  "recurring_theme",
  "content_strength",
  "brand_territory",
  "audience_goal",
  "positioning_signal",
  "creative_gap",
  "unknown",
]);
const unsafeLanguageTerms = ["viralizar garantido", "sempre performa", "garantido", "certeza", "comprovado"];
const MAX_ANCHOR_ITEMS = 4;
const MAX_QUOTE_LENGTH = 180;
const MAX_ANCHOR_TEXT_LENGTH = 260;
const LARGE_BASE64_REGEX = /(?:data:[^;]+;base64,)?[A-Za-z0-9+/=]{1200,}/;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const STORAGE_PATH_REGEX = /\b(?:uploads|video-narrative|mobile-strategic-profile|tmp|temporary)\/[A-Za-z0-9._/-]+\.(mp4|mov|webm|mkv)\b/gi;
const STORAGE_FIELD_REGEX = /\b(?:objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath)\b/gi;
const quoteRoles = new Set(["hook", "promise", "turning_point", "closing", "example", "context", "other"]);
const momentRoles = new Set(["opening", "conflict", "turning_point", "visual_signal", "pacing_signal", "production_signal", "other"]);
const chapterHints = new Set(["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"]);

function issue(code: GeminiVideoNarrativeSchemaIssueCode, message: string): GeminiVideoNarrativeSchemaIssue {
  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const sanitized = sanitizeVideoNarrativeAnalysisText(value);
  return sanitized.length > 0 ? sanitized : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(readString).filter((item): item is string => Boolean(item));
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function readAnchorString(value: unknown, maxLength = MAX_ANCHOR_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  if (LARGE_BASE64_REGEX.test(value)) return null;
  const lineCount = value.split(/\n+/).filter(Boolean).length;
  const timestampCount = (value.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) ?? []).length;
  if (value.length > 2000 || lineCount >= 12 || timestampCount >= 6) return null;
  const sanitized = sanitizeVideoNarrativeAnalysisText(value)
    .replace(URL_REGEX, "[url-redigida]")
    .replace(STORAGE_PATH_REGEX, "[storage-redigido]")
    .replace(STORAGE_FIELD_REGEX, "[storage-redigido]")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized ? truncateText(sanitized, maxLength) : null;
}

function readEnum<T extends string>(value: unknown, valid: Set<string>, fallback: T): T {
  return typeof value === "string" && valid.has(value) ? (value as T) : fallback;
}

function normalizeEvidenceAnchors(value: unknown): {
  anchors: VideoNarrativeAnalysis["evidenceAnchors"];
  invalid: boolean;
} {
  if (value === undefined || value === null) return { anchors: undefined, invalid: false };
  if (!isRecord(value)) return { anchors: undefined, invalid: true };
  let invalid = false;

  const speechQuotes = (Array.isArray(value.speechQuotes) ? value.speechQuotes : [])
    .slice(0, MAX_ANCHOR_ITEMS)
    .filter(isRecord)
    .map((item) => {
      const quote = readAnchorString(item.quote, MAX_QUOTE_LENGTH);
      const whyItMatters = readAnchorString(item.whyItMatters);
      if (!quote || !whyItMatters || item.source !== "creator_spoken") {
        invalid = true;
        return null;
      }
      return {
        quote,
        source: "creator_spoken" as const,
        quoteRole: readEnum(item.quoteRole, quoteRoles, "other"),
        whyItMatters,
        chapterHint: readEnum(item.chapterHint, chapterHints, "video_reveal"),
      };
    })
    .filter(Boolean) as NonNullable<VideoNarrativeAnalysis["evidenceAnchors"]>["speechQuotes"];

  const sceneAnchors = (Array.isArray(value.sceneAnchors) ? value.sceneAnchors : [])
    .slice(0, MAX_ANCHOR_ITEMS)
    .filter(isRecord)
    .map((item) => {
      const description = readAnchorString(item.description);
      const whyItMatters = readAnchorString(item.whyItMatters);
      if (!description || !whyItMatters) {
        invalid = true;
        return null;
      }
      return {
        description,
        source: item.source === "derived_scene" ? "derived_scene" as const : "model_observed" as const,
        momentRole: readEnum(item.momentRole, momentRoles, "other"),
        whyItMatters,
        chapterHint: readEnum(item.chapterHint, chapterHints, "video_reveal"),
      };
    })
    .filter(Boolean) as NonNullable<VideoNarrativeAnalysis["evidenceAnchors"]>["sceneAnchors"];

  const rawIntent = isRecord(value.creatorIntentAnchor) ? value.creatorIntentAnchor : null;
  const creatorIntentAnchor = rawIntent
    ? (() => {
        const statedGoal = readAnchorString(rawIntent.statedGoal);
        const interpretedGoal = readAnchorString(rawIntent.interpretedGoal);
        const whyItMatters = readAnchorString(rawIntent.whyItMatters);
        if (!statedGoal || !interpretedGoal || !whyItMatters) {
          invalid = true;
          return null;
        }
        return {
          source: "creator_goal" as const,
          statedGoal,
          interpretedGoal,
          whyItMatters,
        };
      })()
    : null;

  return {
    anchors: {
      speechQuotes,
      sceneAnchors,
      creatorIntentAnchor,
      profilePatternAnchors: [],
      instagramAnchors: [],
    },
    invalid,
  };
}

function containsUnsafeLanguage(value: unknown): boolean {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return unsafeLanguageTerms.some((term) => lower.includes(term));
  }
  if (Array.isArray(value)) return value.some(containsUnsafeLanguage);
  if (isRecord(value)) return Object.values(value).some(containsUnsafeLanguage);
  return false;
}

function normalizeSceneStructure(value: unknown): VideoNarrativeAnalysis["sceneStructure"] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((scene, index) => ({
      id: readString(scene.id) ?? `scene-${index + 1}`,
      timestampLabel: readString(scene.timestampLabel),
      role:
        typeof scene.role === "string" && sceneRoles.has(scene.role as VideoNarrativeSceneRole)
          ? (scene.role as VideoNarrativeSceneRole)
          : "unknown",
      description: readString(scene.description) ?? "",
      suggestedAdjustment: readString(scene.suggestedAdjustment),
    }))
    .filter((scene) => scene.description.length > 0);
}

function normalizeProfileSignals(value: unknown): VideoNarrativeAnalysis["profileSignals"] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((signal) => ({
      type:
        typeof signal.type === "string" && profileSignalTypes.has(signal.type)
          ? (signal.type as VideoNarrativeAnalysis["profileSignals"][number]["type"])
          : "unknown",
      value: readString(signal.value) ?? "",
      confidence:
        typeof signal.confidence === "string" && confidenceValues.has(signal.confidence as VideoNarrativeConfidence)
          ? (signal.confidence as VideoNarrativeConfidence)
          : "unknown",
      shouldPersistLater: typeof signal.shouldPersistLater === "boolean" ? signal.shouldPersistLater : false,
    }))
    .filter((signal) => signal.value.length > 0);
}

export function buildFallbackVideoNarrativeAnalysis(params: {
  id: string;
  createdAt?: string | null;
  reason?: string | null;
}): VideoNarrativeAnalysis {
  const fallback = createEmptyVideoNarrativeAnalysis({
    id: params.id,
    createdAt: params.createdAt ?? null,
  });

  return {
    ...fallback,
    summary: params.reason ? readString(params.reason) : null,
    diagnosis: {
      ...fallback.diagnosis,
      recommendedAdjustments: ["Trazer mais contexto antes de transformar o vídeo em pauta."],
    },
    confidence: "low",
  };
}

export function parseGeminiVideoNarrativeJson(params: {
  id: string;
  rawText: string;
  createdAt?: string | null;
}): GeminiVideoNarrativeParseResult {
  try {
    return normalizeGeminiVideoNarrativeResponse({
      id: params.id,
      raw: JSON.parse(params.rawText),
      createdAt: params.createdAt,
    });
  } catch {
    return {
      ok: false,
      analysis: buildFallbackVideoNarrativeAnalysis({ id: params.id, createdAt: params.createdAt }),
      issues: [issue("invalid_json", "Resposta de análise em formato inválido.")],
    };
  }
}

export function normalizeGeminiVideoNarrativeResponse(params: {
  id: string;
  raw: unknown;
  createdAt?: string | null;
}): GeminiVideoNarrativeParseResult {
  if (!isRecord(params.raw)) {
    return {
      ok: false,
      analysis: buildFallbackVideoNarrativeAnalysis({ id: params.id, createdAt: params.createdAt }),
      issues: [issue("missing_object", "Resposta de análise sem objeto estruturado.")],
    };
  }

  const raw = params.raw as GeminiVideoNarrativeRawResponse;
  const issues: GeminiVideoNarrativeSchemaIssue[] = [];
  const base = createEmptyVideoNarrativeAnalysis({ id: params.id, createdAt: params.createdAt ?? null });

  if (containsUnsafeLanguage(raw)) {
    issues.push(issue("unsafe_language", "Ajustamos termos absolutos para manter a análise consultiva."));
  }

  if (raw.hook !== undefined && !isRecord(raw.hook)) {
    issues.push(issue("invalid_hook", "Leitura de gancho incompleta."));
  }
  const hook = isRecord(raw.hook) ? raw.hook : {};
  const normalizedHook = {
    detected: readString(hook.detected),
    strength:
      typeof hook.strength === "string" && hookStrengths.has(hook.strength as VideoNarrativeHookStrength)
        ? (hook.strength as VideoNarrativeHookStrength)
        : "unknown",
    why: readString(hook.why),
  };
  if (
    isRecord(raw.hook) &&
    hook.strength !== undefined &&
    (typeof hook.strength !== "string" || !hookStrengths.has(hook.strength as VideoNarrativeHookStrength))
  ) {
    issues.push(issue("invalid_hook", "Leitura de gancho incompleta."));
  }

  const rawClassification = raw.d2cClassification;
  if (rawClassification !== undefined && !isRecord(rawClassification)) {
    issues.push(issue("invalid_classification", "Classificação narrativa incompleta."));
  }
  const classification = isRecord(rawClassification) ? rawClassification : {};
  const normalizedClassification = {
    format:
      typeof classification.format === "string" && d2cFormats.has(classification.format as VideoNarrativeD2CFormat)
        ? (classification.format as VideoNarrativeD2CFormat)
        : "unknown",
    proposal:
      typeof classification.proposal === "string" &&
      d2cProposals.has(classification.proposal as VideoNarrativeD2CProposal)
        ? (classification.proposal as VideoNarrativeD2CProposal)
        : "unknown",
    context: readString(classification.context),
    tone: readString(classification.tone),
    reference: readString(classification.reference),
    intent: readString(classification.intent),
    narrative: readString(classification.narrative),
  };
  if (
    isRecord(rawClassification) &&
    ((classification.format !== undefined &&
      (typeof classification.format !== "string" ||
        !d2cFormats.has(classification.format as VideoNarrativeD2CFormat))) ||
      (classification.proposal !== undefined &&
        (typeof classification.proposal !== "string" ||
          !d2cProposals.has(classification.proposal as VideoNarrativeD2CProposal))))
  ) {
    issues.push(issue("invalid_classification", "Classificação narrativa incompleta."));
  }

  const rawDiagnosis = raw.diagnosis;
  if (rawDiagnosis !== undefined && !isRecord(rawDiagnosis)) {
    issues.push(issue("invalid_diagnosis", "Diagnóstico narrativo incompleto."));
  }
  const diagnosis = isRecord(rawDiagnosis) ? rawDiagnosis : {};
  const normalizedDiagnosis = {
    strengths: readStringArray(diagnosis.strengths),
    weaknesses: readStringArray(diagnosis.weaknesses),
    recommendedAdjustments: readStringArray(diagnosis.recommendedAdjustments),
  };
  if (
    isRecord(rawDiagnosis) &&
    [diagnosis.strengths, diagnosis.weaknesses, diagnosis.recommendedAdjustments].some(
      (value) => value !== undefined && !Array.isArray(value),
    )
  ) {
    issues.push(issue("invalid_diagnosis", "Diagnóstico narrativo incompleto."));
  }

  const rawBlueprint = raw.blueprintSuggestion;
  if (rawBlueprint !== undefined && !isRecord(rawBlueprint)) {
    issues.push(issue("invalid_blueprint", "Sugestão de blueprint incompleta."));
  }
  const blueprint = isRecord(rawBlueprint) ? rawBlueprint : {};
  const normalizedBlueprint = {
    whatToPost: readString(blueprint.whatToPost),
    whyThisPath: readString(blueprint.whyThisPath),
    howItShouldWork: readString(blueprint.howItShouldWork),
    scenes: readStringArray(blueprint.scenes),
  };
  if (isRecord(rawBlueprint) && blueprint.scenes !== undefined && !Array.isArray(blueprint.scenes)) {
    issues.push(issue("invalid_blueprint", "Sugestão de blueprint incompleta."));
  }

  const brandMatch = isRecord(raw.brandMatch) ? raw.brandMatch : {};
  const evidence = isRecord(raw.evidence) ? raw.evidence : {};
  const evidenceAnchors = normalizeEvidenceAnchors(raw.evidenceAnchors);
  if (evidenceAnchors.invalid) {
    issues.push(issue("invalid_evidence_anchors", "Evidence anchors inválidos foram descartados ou limpos."));
  }
  const analysis: VideoNarrativeAnalysis = {
    ...base,
    summary: readString(raw.summary),
    hook: normalizedHook,
    spokenTopics: readStringArray(raw.spokenTopics),
    onScreenText: readStringArray(raw.onScreenText),
    visualElements: readStringArray(raw.visualElements),
    sceneStructure: normalizeSceneStructure(raw.sceneStructure),
    d2cClassification: normalizedClassification,
    diagnosis: normalizedDiagnosis,
    blueprintSuggestion: normalizedBlueprint,
    brandMatch: {
      enabled: typeof brandMatch.enabled === "boolean" ? brandMatch.enabled : false,
      territories: readStringArray(brandMatch.territories),
      whyBrandsWouldFit: readString(brandMatch.whyBrandsWouldFit),
    },
    evidence: {
      transcript: readString(evidence.transcript),
      ocr: readStringArray(evidence.ocr),
      frames: readStringArray(evidence.frames),
      technicalSignals: readStringArray(evidence.technicalSignals),
    },
    evidenceAnchors: evidenceAnchors.anchors,
    profileSignals: normalizeProfileSignals(raw.profileSignals),
    confidence:
      typeof raw.confidence === "string" && confidenceValues.has(raw.confidence as VideoNarrativeConfidence)
        ? (raw.confidence as VideoNarrativeConfidence)
        : "unknown",
  };

  if (!hasUsefulVideoNarrativeAnalysis(analysis)) {
    return {
      ok: false,
      analysis: buildFallbackVideoNarrativeAnalysis({ id: params.id, createdAt: params.createdAt }),
      issues: [...issues, issue("insufficient_context", "Contexto insuficiente para transformar o vídeo em pauta.")],
    };
  }

  return {
    ok: issues.length === 0 || issues.every((item) => item.code === "unsafe_language" || item.code === "invalid_evidence_anchors"),
    analysis,
    issues,
  };
}
