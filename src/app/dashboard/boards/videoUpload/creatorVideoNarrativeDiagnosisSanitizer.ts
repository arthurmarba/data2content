import type {
  CreatorVideoNarrativeDiagnosisDocument,
  CreatorVideoNarrativeEvidenceAnchors,
  CreatorVideoNarrativeDiagnosisInput,
  CreatorVideoNarrativeDiagnosisSafetyFlags,
  CreatorVideoNarrativeDiagnosisVideoMetadata,
  VideoNarrativeContentContext,
  VideoNarrativeCoherence,
} from "./creatorVideoNarrativeDiagnosisTypes";

const MAX_TEXT_FIELD_LENGTH = 4000;
const MAX_ARRAY_ITEM_LENGTH = 1000;
const MAX_SERIALIZED_INPUT_LENGTH = 60000;
const MAX_TRANSCRIPT_LENGTH = 2000;
const MAX_SPEECH_QUOTES = 4;
const MAX_SCENE_ANCHORS = 4;
const MAX_PROFILE_PATTERN_ANCHORS = 4;
const MAX_INSTAGRAM_ANCHORS = 4;
const MAX_QUOTE_LENGTH = 180;
const MAX_ANCHOR_TEXT_LENGTH = 260;

const SIGNED_URL_REGEX = /https?:\/\/[^\s"'<>]+[?&](x-amz-signature|x-goog-signature|signature|expires|token|policy|x-amz-credential)=\S*/gi;
const STORAGE_URL_REGEX = /https?:\/\/[^\s"'<>]*(s3|r2|cloudfront|storage\.googleapis|amazonaws|blob\.core\.windows)[^\s"'<>]*/gi;
const VIDEO_FILE_URL_REGEX = /https?:\/\/[^\s"'<>]+\.(mp4|mov|quicktime|webm|avi|mkv|flv|wmv)(\?[^\s"'<>]*)?/gi;
const LARGE_BASE64_REGEX = /(?:data:[^;]+;base64,)?[A-Za-z0-9+/=]{1200,}/g;
const TOKEN_REGEX = /\b(sk-[A-Za-z0-9_-]{20,}|AIzaSy[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|(?:api[_-]?key|secret|token)=?[A-Za-z0-9._-]{16,})\b/gi;
const OBJECT_KEY_VALUE_REGEX = /\b(?:uploads|video-narrative|mobile-strategic-profile|tmp|temporary)\/[A-Za-z0-9._/-]+\.(mp4|mov|webm|mkv)\b/gi;

const DANGEROUS_ANYWHERE_KEYS = new Set([
  "rawGeminiResponse",
  "rawModelResponse",
  "geminiResponse",
  "providerResponse",
  "modelResponse",
  "transcript",
  "transcription",
  "fullTranscript",
  "longTranscript",
  "headers",
  "authorization",
  "cookie",
  "secret",
  "token",
]);

const SAFE_VIDEO_METADATA_KEYS: Array<keyof CreatorVideoNarrativeDiagnosisVideoMetadata> = [
  "mimeType",
  "sizeBytes",
  "durationSeconds",
  "originalFileNameSanitized",
  "uploadedAt",
  "analyzedAt",
];

const PROFILE_CONTRIBUTION_TYPES = [
  "confirms_existing_pattern",
  "opens_new_hypothesis",
  "isolated_strong_video",
  "creative_deviation",
  "commercial_signal",
  "weak_positioning_signal",
  "needs_more_samples",
];
const PROFILE_CONTRIBUTION_CONFIDENCE = ["low", "medium", "high"];
const PROFILE_CONTRIBUTION_WEIGHT = ["low", "medium", "high"];
const QUOTE_SOURCES = ["creator_spoken", "ai_suggested"];
const QUOTE_ROLES = ["hook", "promise", "turning_point", "closing", "example", "context", "other"];
const SCENE_SOURCES = ["model_observed", "derived_scene"];
const MOMENT_ROLES = ["opening", "conflict", "turning_point", "visual_signal", "pacing_signal", "production_signal", "other"];
const CHAPTER_HINTS = ["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"];

function truncateSafeText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function looksLikeTranscriptBlob(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length > MAX_TRANSCRIPT_LENGTH) return true;
  const lineCount = normalized.split(/\n+/).filter(Boolean).length;
  const timestampLikeCount = (normalized.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) ?? []).length;
  return lineCount >= 12 || timestampLikeCount >= 6;
}

function createSafetyFlags(sanitized: boolean): CreatorVideoNarrativeDiagnosisSafetyFlags {
  return {
    containsPersistedVideoReference: false,
    containsSignedUrl: false,
    containsObjectKey: false,
    containsRawModelResponse: false,
    containsLongTranscript: false,
    sanitized,
  };
}

function assertNoDangerousKeys(value: unknown, path = "input"): void {
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_ANYWHERE_KEYS.has(key)) {
      throw new Error(`Leitura de vídeo insegura: campo proibido detectado em ${path}.${key}`);
    }

    if (/transcri(c|ç)(a|ã)o|transcript/i.test(key) && typeof child === "string" && child.length > MAX_TRANSCRIPT_LENGTH) {
      throw new Error("Leitura de vídeo insegura: transcrição longa não pode ser persistida");
    }

    assertNoDangerousKeys(child, `${path}.${key}`);
  }
}

function sanitizeText(value: unknown, fieldName: string, maxLength = MAX_TEXT_FIELD_LENGTH): { value: string; sanitized: boolean } {
  if (typeof value !== "string") {
    throw new Error(`Leitura de vídeo inválida: ${fieldName} deve ser texto`);
  }

  if (value.length > maxLength) {
    throw new Error(`Leitura de vídeo inválida: ${fieldName} excede o limite seguro`);
  }

  let sanitized = false;
  let next = value;
  const replacements: Array<[RegExp, string]> = [
    [SIGNED_URL_REGEX, "[signed-url-redacted]"],
    [STORAGE_URL_REGEX, "[storage-url-redacted]"],
    [VIDEO_FILE_URL_REGEX, "[video-url-redacted]"],
    [LARGE_BASE64_REGEX, "[base64-redacted]"],
    [TOKEN_REGEX, "[secret-redacted]"],
    [OBJECT_KEY_VALUE_REGEX, "[object-key-redacted]"],
  ];

  for (const [regex, replacement] of replacements) {
    next = next.replace(regex, () => {
      sanitized = true;
      return replacement;
    });
  }

  return { value: next.trim(), sanitized };
}

function sanitizeTextArray(value: unknown, fieldName: string): { value: string[]; sanitized: boolean } {
  if (!Array.isArray(value)) {
    throw new Error(`Leitura de vídeo inválida: ${fieldName} deve ser uma lista`);
  }

  let sanitized = false;
  const items = value.map((item, index) => {
    const result = sanitizeText(item, `${fieldName}[${index}]`, MAX_ARRAY_ITEM_LENGTH);
    sanitized = sanitized || result.sanitized;
    return result.value;
  });

  return { value: items, sanitized };
}

function sanitizeVideoMetadata(
  input: CreatorVideoNarrativeDiagnosisInput["videoMetadata"],
): { value: CreatorVideoNarrativeDiagnosisVideoMetadata; sanitized: boolean } {
  if (!input || typeof input !== "object") return { value: {}, sanitized: false };

  const metadata: CreatorVideoNarrativeDiagnosisVideoMetadata = {};
  let sanitized = Object.keys(input).some(
    (key) => !SAFE_VIDEO_METADATA_KEYS.includes(key as keyof CreatorVideoNarrativeDiagnosisVideoMetadata),
  );

  if (typeof input.mimeType === "string") {
    metadata.mimeType = sanitizeText(input.mimeType, "videoMetadata.mimeType", 120).value;
  }
  if (typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes) && input.sizeBytes >= 0) {
    metadata.sizeBytes = input.sizeBytes;
  }
  if (
    typeof input.durationSeconds === "number" &&
    Number.isFinite(input.durationSeconds) &&
    input.durationSeconds >= 0
  ) {
    metadata.durationSeconds = input.durationSeconds;
  }
  if (typeof input.originalFileNameSanitized === "string") {
    const fileName = sanitizeText(input.originalFileNameSanitized, "videoMetadata.originalFileNameSanitized", 240);
    metadata.originalFileNameSanitized = fileName.value;
    sanitized = sanitized || fileName.sanitized;
  }
  if (input.uploadedAt instanceof Date) {
    metadata.uploadedAt = input.uploadedAt;
  }
  if (input.analyzedAt instanceof Date) {
    metadata.analyzedAt = input.analyzedAt;
  }

  return { value: metadata, sanitized };
}

function requireObject<T extends Record<string, unknown>>(value: unknown, fieldName: string): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Leitura de vídeo inválida: ${fieldName} deve ser um objeto`);
  }

  return value as T;
}

function requireOneOf(value: string, validValues: string[], fieldName: string): string {
  if (!validValues.includes(value)) {
    throw new Error(`Leitura de vídeo inválida: ${fieldName} não suportado`);
  }

  return value;
}

function sanitizeEvidenceAnchors(
  input: unknown,
  text: (value: unknown, fieldName: string, maxLength?: number) => string,
): CreatorVideoNarrativeEvidenceAnchors | undefined {
  if (input === undefined || input === null) return undefined;
  const anchors = requireObject<Record<string, unknown>>(input, "evidenceAnchors");

  const speechQuotes = Array.isArray(anchors.speechQuotes) ? anchors.speechQuotes.slice(0, MAX_SPEECH_QUOTES) : [];
  const sceneAnchors = Array.isArray(anchors.sceneAnchors) ? anchors.sceneAnchors.slice(0, MAX_SCENE_ANCHORS) : [];

  const sanitizedSpeechQuotes = speechQuotes.map((item, index) => {
    const quote = requireObject<Record<string, unknown>>(item, `evidenceAnchors.speechQuotes[${index}]`);
    if (typeof quote.quote === "string" && /[A-Za-z0-9+/=]{1200,}/.test(quote.quote)) {
      throw new Error("Leitura de vídeo insegura: base64 grande não pode ser persistido em evidenceAnchors");
    }
    const cleanedQuote = text(quote.quote, `evidenceAnchors.speechQuotes[${index}].quote`, MAX_ARRAY_ITEM_LENGTH);
    if (looksLikeTranscriptBlob(cleanedQuote)) {
      throw new Error("Leitura de vídeo insegura: transcrição longa não pode ser persistida em evidenceAnchors");
    }

    return {
      quote: truncateSafeText(cleanedQuote, MAX_QUOTE_LENGTH),
      source: requireOneOf(
        text(quote.source, `evidenceAnchors.speechQuotes[${index}].source`, 40),
        QUOTE_SOURCES,
        `evidenceAnchors.speechQuotes[${index}].source`,
      ) as CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number]["source"],
      quoteRole: requireOneOf(
        text(quote.quoteRole, `evidenceAnchors.speechQuotes[${index}].quoteRole`, 40),
        QUOTE_ROLES,
        `evidenceAnchors.speechQuotes[${index}].quoteRole`,
      ) as CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number]["quoteRole"],
      whyItMatters: truncateSafeText(
        text(quote.whyItMatters, `evidenceAnchors.speechQuotes[${index}].whyItMatters`, MAX_ANCHOR_TEXT_LENGTH),
        MAX_ANCHOR_TEXT_LENGTH,
      ),
      chapterHint: requireOneOf(
        text(quote.chapterHint, `evidenceAnchors.speechQuotes[${index}].chapterHint`, 40),
        CHAPTER_HINTS,
        `evidenceAnchors.speechQuotes[${index}].chapterHint`,
      ) as CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number]["chapterHint"],
    };
  });

  const sanitizedSceneAnchors = sceneAnchors.map((item, index) => {
    const scene = requireObject<Record<string, unknown>>(item, `evidenceAnchors.sceneAnchors[${index}]`);
    if (typeof scene.description === "string" && /[A-Za-z0-9+/=]{1200,}/.test(scene.description)) {
      throw new Error("Leitura de vídeo insegura: base64 grande não pode ser persistido em evidenceAnchors");
    }
    const description = text(scene.description, `evidenceAnchors.sceneAnchors[${index}].description`, MAX_ARRAY_ITEM_LENGTH);
    if (looksLikeTranscriptBlob(description)) {
      throw new Error("Leitura de vídeo insegura: transcrição longa não pode ser persistida em evidenceAnchors");
    }

    return {
      description: truncateSafeText(description, MAX_ANCHOR_TEXT_LENGTH),
      source: requireOneOf(
        text(scene.source, `evidenceAnchors.sceneAnchors[${index}].source`, 40),
        SCENE_SOURCES,
        `evidenceAnchors.sceneAnchors[${index}].source`,
      ) as CreatorVideoNarrativeEvidenceAnchors["sceneAnchors"][number]["source"],
      momentRole: requireOneOf(
        text(scene.momentRole, `evidenceAnchors.sceneAnchors[${index}].momentRole`, 40),
        MOMENT_ROLES,
        `evidenceAnchors.sceneAnchors[${index}].momentRole`,
      ) as CreatorVideoNarrativeEvidenceAnchors["sceneAnchors"][number]["momentRole"],
      whyItMatters: truncateSafeText(
        text(scene.whyItMatters, `evidenceAnchors.sceneAnchors[${index}].whyItMatters`, MAX_ANCHOR_TEXT_LENGTH),
        MAX_ANCHOR_TEXT_LENGTH,
      ),
      chapterHint: requireOneOf(
        text(scene.chapterHint, `evidenceAnchors.sceneAnchors[${index}].chapterHint`, 40),
        CHAPTER_HINTS,
        `evidenceAnchors.sceneAnchors[${index}].chapterHint`,
      ) as CreatorVideoNarrativeEvidenceAnchors["sceneAnchors"][number]["chapterHint"],
    };
  });

  const creatorIntentAnchor = anchors.creatorIntentAnchor && typeof anchors.creatorIntentAnchor === "object"
    ? (() => {
        const intent = requireObject<Record<string, unknown>>(anchors.creatorIntentAnchor, "evidenceAnchors.creatorIntentAnchor");
        return {
          source: "creator_goal" as const,
          statedGoal: truncateSafeText(text(intent.statedGoal, "evidenceAnchors.creatorIntentAnchor.statedGoal", MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
          interpretedGoal: truncateSafeText(text(intent.interpretedGoal, "evidenceAnchors.creatorIntentAnchor.interpretedGoal", MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
          whyItMatters: truncateSafeText(text(intent.whyItMatters, "evidenceAnchors.creatorIntentAnchor.whyItMatters", MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
        };
      })()
    : null;

  const profilePatternAnchors = Array.isArray(anchors.profilePatternAnchors)
    ? anchors.profilePatternAnchors.slice(0, MAX_PROFILE_PATTERN_ANCHORS).map((item, index) => {
        const pattern = requireObject<Record<string, unknown>>(item, `evidenceAnchors.profilePatternAnchors[${index}]`);
        const evidenceCount = typeof pattern.evidenceCount === "number" && Number.isFinite(pattern.evidenceCount)
          ? Math.max(0, Math.trunc(pattern.evidenceCount))
          : undefined;
        return {
          patternLabel: truncateSafeText(text(pattern.patternLabel, `evidenceAnchors.profilePatternAnchors[${index}].patternLabel`, MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
          whyThisVideoRelates: truncateSafeText(text(pattern.whyThisVideoRelates, `evidenceAnchors.profilePatternAnchors[${index}].whyThisVideoRelates`, MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
          ...(evidenceCount === undefined ? {} : { evidenceCount }),
        };
      })
    : [];

  const instagramAnchors = Array.isArray(anchors.instagramAnchors)
    ? anchors.instagramAnchors.slice(0, MAX_INSTAGRAM_ANCHORS).map((item, index) => {
        const signal = requireObject<Record<string, unknown>>(item, `evidenceAnchors.instagramAnchors[${index}]`);
        return {
          signalLabel: truncateSafeText(text(signal.signalLabel, `evidenceAnchors.instagramAnchors[${index}].signalLabel`, MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
          whyItMatters: truncateSafeText(text(signal.whyItMatters, `evidenceAnchors.instagramAnchors[${index}].whyItMatters`, MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
          evidenceSummary: truncateSafeText(text(signal.evidenceSummary, `evidenceAnchors.instagramAnchors[${index}].evidenceSummary`, MAX_ANCHOR_TEXT_LENGTH), MAX_ANCHOR_TEXT_LENGTH),
        };
      })
    : [];

  return {
    speechQuotes: sanitizedSpeechQuotes,
    sceneAnchors: sanitizedSceneAnchors,
    creatorIntentAnchor,
    profilePatternAnchors,
    instagramAnchors,
  };
}

export function sanitizeCreatorVideoNarrativeDiagnosisInput(
  input: CreatorVideoNarrativeDiagnosisInput,
): CreatorVideoNarrativeDiagnosisDocument {
  if (!input || typeof input !== "object") {
    throw new Error("Leitura de vídeo inválida: input deve ser um objeto");
  }

  const serializedInput = JSON.stringify(input);
  if (serializedInput.length > MAX_SERIALIZED_INPUT_LENGTH) {
    throw new Error("Leitura de vídeo insegura: payload bruto excede o limite seguro");
  }

  assertNoDangerousKeys(input);

  const validStatuses = ["draft", "completed", "failed", "discarded"];
  const validSources = ["mock", "real", "manual", "migration"];
  if (!validStatuses.includes(input.status)) {
    throw new Error("Leitura de vídeo inválida: status não suportado");
  }
  if (!validSources.includes(input.source)) {
    throw new Error("Leitura de vídeo inválida: source não suportado");
  }
  if (!input.profileContribution) {
    throw new Error("Leitura de vídeo inválida: profileContribution é obrigatório");
  }

  let sanitized = false;
  const text = (value: unknown, fieldName: string, maxLength = MAX_TEXT_FIELD_LENGTH) => {
    const result = sanitizeText(value, fieldName, maxLength);
    sanitized = sanitized || result.sanitized;
    return result.value;
  };
  const textArray = (value: unknown, fieldName: string) => {
    const result = sanitizeTextArray(value, fieldName);
    sanitized = sanitized || result.sanitized;
    return result.value;
  };

  const metadata = sanitizeVideoMetadata(input.videoMetadata);
  sanitized = sanitized || metadata.sanitized;

  const videoReading = requireObject<Record<string, unknown>>(input.videoReading, "videoReading");
  const speechReading = requireObject<Record<string, unknown>>(input.speechReading, "speechReading");
  const productionReading = requireObject<Record<string, unknown>>(input.productionReading, "productionReading");
  const commercialReading = requireObject<Record<string, unknown>>(input.commercialReading, "commercialReading");
  const strategicRecommendation = requireObject<Record<string, unknown>>(
    input.strategicRecommendation,
    "strategicRecommendation",
  );
  const profileContribution = requireObject<Record<string, unknown>>(input.profileContribution, "profileContribution");
  const evidenceAnchors = sanitizeEvidenceAnchors(input.evidenceAnchors, text);
  const profileContributionType = requireOneOf(
    text(profileContribution.type, "profileContribution.type"),
    PROFILE_CONTRIBUTION_TYPES,
    "profileContribution.type",
  ) as CreatorVideoNarrativeDiagnosisDocument["profileContribution"]["type"];
  const profileContributionConfidence = requireOneOf(
    text(profileContribution.confidence, "profileContribution.confidence"),
    PROFILE_CONTRIBUTION_CONFIDENCE,
    "profileContribution.confidence",
  ) as CreatorVideoNarrativeDiagnosisDocument["profileContribution"]["confidence"];
  const profileContributionWeight = requireOneOf(
    text(profileContribution.weight, "profileContribution.weight"),
    PROFILE_CONTRIBUTION_WEIGHT,
    "profileContribution.weight",
  ) as CreatorVideoNarrativeDiagnosisDocument["profileContribution"]["weight"];

  return {
    userId: text(input.userId, "userId"),
    diagnosisId: text(input.diagnosisId, "diagnosisId"),
    status: input.status,
    source: input.source,
    videoMetadata: metadata.value,
    creatorGoal: text(input.creatorGoal, "creatorGoal"),
    selectedGoalOption: text(input.selectedGoalOption, "selectedGoalOption"),
    videoReading: {
      title: text(videoReading.title, "videoReading.title"),
      rememberedAs: text(videoReading.rememberedAs, "videoReading.rememberedAs"),
      summary: text(videoReading.summary, "videoReading.summary"),
      whatVideoReveals: text(videoReading.whatVideoReveals, "videoReading.whatVideoReveals"),
      mainNarrative: text(videoReading.mainNarrative, "videoReading.mainNarrative"),
      creatorIntent: text(videoReading.creatorIntent, "videoReading.creatorIntent"),
      dominantInsight: text(videoReading.dominantInsight, "videoReading.dominantInsight"),
    },
    speechReading: {
      summary: text(speechReading.summary, "speechReading.summary"),
      openingRead: text(speechReading.openingRead, "speechReading.openingRead"),
      clarityRead: text(speechReading.clarityRead, "speechReading.clarityRead"),
      pacingRead: text(speechReading.pacingRead, "speechReading.pacingRead"),
      suggestedLine: text(speechReading.suggestedLine, "speechReading.suggestedLine"),
      suggestedOpening: text(speechReading.suggestedOpening, "speechReading.suggestedOpening"),
      suggestedClosing: text(speechReading.suggestedClosing, "speechReading.suggestedClosing"),
    },
    productionReading: {
      summary: text(productionReading.summary, "productionReading.summary"),
      framing: text(productionReading.framing, "productionReading.framing"),
      lighting: text(productionReading.lighting, "productionReading.lighting"),
      audio: text(productionReading.audio, "productionReading.audio"),
      editingRhythm: text(productionReading.editingRhythm, "productionReading.editingRhythm"),
      firstFrame: text(productionReading.firstFrame, "productionReading.firstFrame"),
      visualClarity: text(productionReading.visualClarity, "productionReading.visualClarity"),
    },
    commercialReading: {
      summary: text(commercialReading.summary, "commercialReading.summary"),
      brandTerritories: textArray(commercialReading.brandTerritories, "commercialReading.brandTerritories"),
      whyItCouldFitBrands: text(commercialReading.whyItCouldFitBrands, "commercialReading.whyItCouldFitBrands"),
      adAdaptationIdea: text(commercialReading.adAdaptationIdea, "commercialReading.adAdaptationIdea"),
      limitations: text(commercialReading.limitations, "commercialReading.limitations"),
    },
    strategicRecommendation: {
      mainAdjustment: text(strategicRecommendation.mainAdjustment, "strategicRecommendation.mainAdjustment"),
      nextExperiment: text(strategicRecommendation.nextExperiment, "strategicRecommendation.nextExperiment"),
      whatToRepeat: text(strategicRecommendation.whatToRepeat, "strategicRecommendation.whatToRepeat"),
      whatToAvoid: text(strategicRecommendation.whatToAvoid, "strategicRecommendation.whatToAvoid"),
      successSignal: text(strategicRecommendation.successSignal, "strategicRecommendation.successSignal"),
    },
    profileContribution: {
      type: profileContributionType,
      confidence: profileContributionConfidence,
      weight: profileContributionWeight,
      reason: text(profileContribution.reason, "profileContribution.reason"),
      profileImpactPreview: text(profileContribution.profileImpactPreview, "profileContribution.profileImpactPreview"),
    },
    ...(evidenceAnchors ? { evidenceAnchors } : {}),
    // contentContext and narrativeCoherence are safe AI-extracted metadata (no storage refs,
    // no raw transcripts) — pass through as-is after the outer sanitize pass.
    ...(input.contentContext ? { contentContext: input.contentContext as VideoNarrativeContentContext } : {}),
    ...(input.narrativeCoherence ? { narrativeCoherence: input.narrativeCoherence as VideoNarrativeCoherence } : {}),
    safetyFlags: createSafetyFlags(sanitized),
    schemaVersion: "creator_video_narrative_diagnosis_v1",
  };
}
