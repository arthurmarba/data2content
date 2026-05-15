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
    ok: issues.length === 0 || issues.every((item) => item.code === "unsafe_language"),
    analysis,
    issues,
  };
}
