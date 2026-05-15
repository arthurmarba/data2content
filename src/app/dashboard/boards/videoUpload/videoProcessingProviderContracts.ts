import {
  VideoProcessingArtifacts,
  VideoProcessingStatus,
  createEmptyVideoProcessingArtifacts,
} from "./videoProcessingArtifacts";
import { VideoUploadSession } from "./videoUploadSessionContracts";

export type VideoProcessingProviderName =
  | "future_openai"
  | "future_whisper"
  | "future_assemblyai"
  | "future_ffmpeg"
  | "future_google_vision"
  | "future_manual"
  | "local_mock"
  | "unknown";

export type VideoProcessingTaskType =
  | "transcription"
  | "frame_extraction"
  | "ocr"
  | "visual_summary"
  | "technical_signals"
  | "multimodal_summary"
  | "unknown";

export type VideoProcessingTaskStatus =
  | "not_started"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type VideoProcessingInputSource = {
  storageObjectId: string;
  storageKey: string | null;
  signedUrl: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
};

export type VideoProcessingProviderCapabilities = {
  provider: VideoProcessingProviderName;
  supportedTasks: VideoProcessingTaskType[];
  requiresSignedUrl: boolean;
  supportsBatch: boolean;
  maxDurationSeconds: number | null;
  maxFileSizeMb: number | null;
};

export type VideoProcessingTaskRequest = {
  id: string;
  sessionId: string;
  storageObjectId: string;
  taskType: VideoProcessingTaskType;
  provider: VideoProcessingProviderName;
  input: VideoProcessingInputSource;
  createdAt: string;
};

export type VideoProcessingTaskResult = {
  taskId: string;
  taskType: VideoProcessingTaskType;
  provider: VideoProcessingProviderName;
  status: VideoProcessingTaskStatus;
  artifacts: Partial<VideoProcessingArtifacts>;
  message: string | null;
  completedAt: string | null;
};

export type VideoProcessingProviderIssueCode =
  | "missing_task_id"
  | "missing_session_id"
  | "missing_storage_object"
  | "missing_input_source"
  | "missing_signed_url"
  | "unsupported_task"
  | "duration_too_long"
  | "file_too_large"
  | "invalid_status"
  | "provider_unavailable";

export type VideoProcessingProviderIssue = {
  code: VideoProcessingProviderIssueCode;
  message: string;
};

export type VideoProcessingProviderValidationResult = {
  ok: boolean;
  issues: VideoProcessingProviderIssue[];
};

const BYTES_PER_MB = 1024 * 1024;

function providerIssue(code: VideoProcessingProviderIssueCode): VideoProcessingProviderIssue {
  const messages: Record<VideoProcessingProviderIssueCode, string> = {
    missing_task_id: "Tarefa sem identificador.",
    missing_session_id: "Tarefa sem vínculo com sessão.",
    missing_storage_object: "Tarefa sem arquivo temporário.",
    missing_input_source: "Fonte de processamento ausente.",
    missing_signed_url: "URL temporária necessária para este processamento.",
    unsupported_task: "Tipo de processamento não suportado pelo provider.",
    duration_too_long: "Vídeo acima do limite de duração deste provider.",
    file_too_large: "Vídeo acima do limite de tamanho deste provider.",
    invalid_status: "Status de processamento não reconhecido.",
    provider_unavailable: "Provider indisponível para esta solicitação.",
  };

  return {
    code,
    message: messages[code],
  };
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }

  return null;
}

function mergedStatus(results: VideoProcessingTaskResult[]): VideoProcessingStatus {
  if (results.some((result) => result.status === "completed")) return "completed";
  if (results.length > 0 && results.every((result) => result.status === "failed")) return "failed";
  return "pending";
}

export function buildMockVideoProcessingProviderCapabilities(
  params: Partial<VideoProcessingProviderCapabilities> = {},
): VideoProcessingProviderCapabilities {
  return {
    provider: "local_mock",
    supportedTasks: ["transcription", "frame_extraction", "ocr", "visual_summary", "technical_signals"],
    requiresSignedUrl: true,
    supportsBatch: false,
    maxDurationSeconds: 90,
    maxFileSizeMb: 100,
    ...params,
  };
}

export function createVideoProcessingTaskRequest(params: {
  id: string;
  session: VideoUploadSession;
  taskType: VideoProcessingTaskType;
  provider?: VideoProcessingProviderName;
  createdAt: string;
}): VideoProcessingTaskRequest {
  return {
    id: params.id,
    sessionId: params.session.id,
    storageObjectId: params.session.storageObject.id,
    taskType: params.taskType,
    provider: params.provider || "local_mock",
    input: {
      storageObjectId: params.session.storageObject.id,
      storageKey: params.session.storageObject.storageKey,
      signedUrl: params.session.signedUploadUrl || params.session.storageObject.signedUrl,
      mimeType: params.session.draftSnapshot.mimeType,
      durationSeconds: params.session.draftSnapshot.durationSeconds,
      sizeBytes: params.session.draftSnapshot.sizeBytes,
    },
    createdAt: params.createdAt,
  };
}

export function validateVideoProcessingTaskRequest(params: {
  request: VideoProcessingTaskRequest;
  capabilities?: VideoProcessingProviderCapabilities;
}): VideoProcessingProviderValidationResult {
  const request = params.request;
  const capabilities = params.capabilities || buildMockVideoProcessingProviderCapabilities();
  const issues: VideoProcessingProviderIssue[] = [];

  if (!request.id.trim()) {
    issues.push(providerIssue("missing_task_id"));
  }

  if (!request.sessionId.trim()) {
    issues.push(providerIssue("missing_session_id"));
  }

  if (!request.storageObjectId.trim()) {
    issues.push(providerIssue("missing_storage_object"));
  }

  if (!request.input || !request.input.storageObjectId.trim()) {
    issues.push(providerIssue("missing_input_source"));
  }

  if (capabilities.requiresSignedUrl && !request.input?.signedUrl) {
    issues.push(providerIssue("missing_signed_url"));
  }

  if (!capabilities.supportedTasks.includes(request.taskType)) {
    issues.push(providerIssue("unsupported_task"));
  }

  if (
    typeof request.input?.durationSeconds === "number" &&
    typeof capabilities.maxDurationSeconds === "number" &&
    request.input.durationSeconds > capabilities.maxDurationSeconds
  ) {
    issues.push(providerIssue("duration_too_long"));
  }

  if (
    typeof request.input?.sizeBytes === "number" &&
    typeof capabilities.maxFileSizeMb === "number" &&
    request.input.sizeBytes > capabilities.maxFileSizeMb * BYTES_PER_MB
  ) {
    issues.push(providerIssue("file_too_large"));
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function createEmptyVideoProcessingTaskResult(params: {
  request: VideoProcessingTaskRequest;
}): VideoProcessingTaskResult {
  return {
    taskId: params.request.id,
    taskType: params.request.taskType,
    provider: params.request.provider,
    status: "not_started",
    artifacts: {},
    message: null,
    completedAt: null,
  };
}

export function markVideoProcessingTaskCompleted(params: {
  result: VideoProcessingTaskResult;
  artifacts: Partial<VideoProcessingArtifacts>;
  completedAt: string;
  message?: string | null;
}): VideoProcessingTaskResult {
  return {
    ...params.result,
    status: "completed",
    artifacts: params.artifacts,
    message: params.message ?? params.result.message,
    completedAt: params.completedAt,
  };
}

export function markVideoProcessingTaskFailed(params: {
  result: VideoProcessingTaskResult;
  message: string;
  completedAt: string;
}): VideoProcessingTaskResult {
  return {
    ...params.result,
    status: "failed",
    message: params.message,
    completedAt: params.completedAt,
  };
}

export function mergeVideoProcessingTaskResults(results: VideoProcessingTaskResult[]): VideoProcessingArtifacts {
  const completedResults = results.filter((result) => result.status === "completed");
  const merged = createEmptyVideoProcessingArtifacts();
  const fullText = firstNonEmpty(completedResults.map((result) => result.artifacts.transcript?.fullText));
  const language = firstNonEmpty(completedResults.map((result) => result.artifacts.transcript?.language));
  const provider = completedResults.find((result) => result.artifacts.transcript?.provider)?.artifacts.transcript?.provider;

  return {
    ...merged,
    status: mergedStatus(results),
    transcript: {
      fullText,
      language,
      provider: provider || "unknown",
      segments: completedResults.flatMap((result) => result.artifacts.transcript?.segments || []),
    },
    frames: completedResults.flatMap((result) => result.artifacts.frames || []),
    ocr: completedResults.flatMap((result) => result.artifacts.ocr || []),
    technicalSignals: completedResults.flatMap((result) => result.artifacts.technicalSignals || []),
    visualSummary: firstNonEmpty(completedResults.map((result) => result.artifacts.visualSummary)),
    processingNotes: results
      .map((result) => normalizeText(result.message))
      .filter(Boolean),
  };
}
