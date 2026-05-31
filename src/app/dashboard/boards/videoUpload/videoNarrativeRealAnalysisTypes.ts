import type { VideoNarrativeAiProviderGoalOption } from "./videoNarrativeAiProviderTypes";

export type VideoNarrativeRealAnalysisPayload = {
  uploadSessionId: string;
  temporaryUpload?: {
    objectKey?: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt?: string;
  };
  creatorGoal: string;
  selectedGoalOption: VideoNarrativeAiProviderGoalOption;
  quickAnswers?: Array<{ id: string; value: string }>;
  consentTextVersion: string;
  persistReading?: boolean;
  persistSynthesisSnapshot?: boolean;
};

export type VideoNarrativeRealAnalysisPayloadValidationResult =
  | { ok: true; payload: VideoNarrativeRealAnalysisPayload }
  | { ok: false; message: string; code: string };

const FORBIDDEN_KEYS = [
  "file",
  "video",
  "videoUrl",
  "uploadUrl",
  "signedUrl",
  "thumbnailUrl",
  "base64",
  "rawTranscript",
  "rawModelResponse",
  "bucket",
  "accessKey",
  "secretKey",
  "token",
];

const ALLOWED_GOAL_OPTIONS: VideoNarrativeAiProviderGoalOption[] = [
  "authority",
  "authority_build",
  "retention",
  "format_test",
  "sponsored_content",
];

const SESSION_ID_PATTERN = /^video-temp-upload-session-[a-zA-Z0-9_-]+$/;
const OBJECT_KEY_PATTERN = /^temporary\/video-narrative\/[a-f0-9]{16}\/video-temp-upload-session-[a-zA-Z0-9_-]+\.(mp4|mov|webm)$/;
const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const SIGNED_URL_KEYWORDS = ["signature=", "expires=", "policy=", "x-amz-", "x-goog-"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasForbiddenKey(value: unknown): string | null {
  if (!isRecord(value) && !Array.isArray(value)) return null;
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
  for (const [key, nested] of entries as Iterable<[string | number, unknown]>) {
    if (typeof key === "string" && FORBIDDEN_KEYS.includes(key)) return key;
    const found = hasForbiddenKey(nested);
    if (found) return found;
  }
  return null;
}

function hasForbiddenString(serialized: string): boolean {
  const lower = serialized.toLowerCase();
  return (
    lower.includes("base64") ||
    /data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/i.test(serialized) ||
    SIGNED_URL_KEYWORDS.some((keyword) => lower.includes(keyword))
  );
}

function readQuickAnswers(value: unknown): Array<{ id: string; value: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .slice(0, 6)
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = typeof item.id === "string" ? item.id.slice(0, 80).trim() : "";
      const answerValue = typeof item.value === "string" ? item.value.slice(0, 240).trim() : "";
      if (!id || !answerValue) return null;
      return { id, value: answerValue };
    })
    .filter((item): item is { id: string; value: string } => Boolean(item));
}

export function validateVideoNarrativeRealAnalysisPayload(
  body: unknown,
): VideoNarrativeRealAnalysisPayloadValidationResult {
  if (!isRecord(body)) {
    return { ok: false, code: "invalid_payload", message: "Payload inválido: deve ser um objeto." };
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > 7000) {
    return {
      ok: false,
      code: "payload_too_large",
      message: "Regra de segurança: tamanho do payload excedeu o limite máximo seguro.",
    };
  }

  const forbiddenKey = hasForbiddenKey(body);
  if (forbiddenKey) {
    return {
      ok: false,
      code: "forbidden_payload_key",
      message: `Regra de segurança: o campo '${forbiddenKey}' não é permitido nesta rota.`,
    };
  }

  if (hasForbiddenString(serialized)) {
    return {
      ok: false,
      code: "forbidden_payload_content",
      message: "Regra de segurança: mídia bruta, Base64 ou links assinados não são permitidos.",
    };
  }

  const uploadSessionId = typeof body.uploadSessionId === "string" ? body.uploadSessionId.trim() : "";
  if (!SESSION_ID_PATTERN.test(uploadSessionId)) {
    return { ok: false, code: "upload_session_required", message: "Sessão de upload temporário inválida." };
  }

  const consentTextVersion = typeof body.consentTextVersion === "string" ? body.consentTextVersion.trim() : "";
  if (!consentTextVersion) {
    return { ok: false, code: "consent_version_required", message: "Versão de consentimento obrigatória." };
  }

  const creatorGoal = typeof body.creatorGoal === "string" ? body.creatorGoal.trim() : "";
  if (!creatorGoal || creatorGoal.length > 500) {
    return { ok: false, code: "invalid_creator_goal", message: "Objetivo do creator inválido." };
  }

  const selectedGoalOption = typeof body.selectedGoalOption === "string" ? body.selectedGoalOption : "";
  if (!ALLOWED_GOAL_OPTIONS.includes(selectedGoalOption as VideoNarrativeAiProviderGoalOption)) {
    return { ok: false, code: "invalid_goal_option", message: "Objetivo selecionado inválido." };
  }

  if (!isRecord(body.temporaryUpload)) {
    return { ok: false, code: "temporary_upload_required", message: "Referência temporária do vídeo obrigatória." };
  }

  const objectKey = typeof body.temporaryUpload.objectKey === "string" ? body.temporaryUpload.objectKey.trim() : undefined;
  if (objectKey && !OBJECT_KEY_PATTERN.test(objectKey)) {
    return { ok: false, code: "invalid_object_key", message: "Referência temporária do vídeo inválida." };
  }

  const mimeType = typeof body.temporaryUpload.mimeType === "string" ? body.temporaryUpload.mimeType.trim() : "";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, code: "invalid_mime_type", message: "Formato de vídeo inválido." };
  }

  const sizeBytes = typeof body.temporaryUpload.sizeBytes === "number" ? body.temporaryUpload.sizeBytes : 0;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 100 * 1024 * 1024) {
    return { ok: false, code: "invalid_size_bytes", message: "Tamanho do vídeo inválido." };
  }

  const uploadedAt = typeof body.temporaryUpload.uploadedAt === "string" ? body.temporaryUpload.uploadedAt : undefined;

  return {
    ok: true,
    payload: {
      uploadSessionId,
      temporaryUpload: {
        ...(objectKey ? { objectKey } : {}),
        mimeType,
        sizeBytes,
        ...(uploadedAt ? { uploadedAt } : {}),
      },
      creatorGoal: creatorGoal.slice(0, 500),
      selectedGoalOption: selectedGoalOption as VideoNarrativeAiProviderGoalOption,
      quickAnswers: readQuickAnswers(body.quickAnswers),
      consentTextVersion: consentTextVersion.slice(0, 80),
      ...(body.persistReading === true ? { persistReading: true } : {}),
      ...(body.persistSynthesisSnapshot === true ? { persistSynthesisSnapshot: true } : {}),
    },
  };
}
