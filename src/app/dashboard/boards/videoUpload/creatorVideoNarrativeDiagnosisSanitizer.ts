import type {
  CreatorVideoNarrativeDiagnosisDocument,
  CreatorVideoNarrativeDiagnosisInput,
  CreatorVideoNarrativeDiagnosisSafetyFlags,
  CreatorVideoNarrativeDiagnosisVideoMetadata,
} from "./creatorVideoNarrativeDiagnosisTypes";

const MAX_TEXT_FIELD_LENGTH = 4000;
const MAX_ARRAY_ITEM_LENGTH = 1000;
const MAX_SERIALIZED_INPUT_LENGTH = 60000;
const MAX_TRANSCRIPT_LENGTH = 2000;

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
  const text = (value: unknown, fieldName: string) => {
    const result = sanitizeText(value, fieldName);
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
    safetyFlags: createSafetyFlags(sanitized),
    schemaVersion: "creator_video_narrative_diagnosis_v1",
  };
}
