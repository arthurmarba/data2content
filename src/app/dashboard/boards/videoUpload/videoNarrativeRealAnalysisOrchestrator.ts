import type { CreatorStrategicProfileSnapshotInput } from "./mobileStrategicProfileSnapshotTypes";
import {
  upsertStrategicProfileSnapshot,
} from "./mobileStrategicProfileSnapshotService";
import type {
  VideoNarrativeAiProviderInput,
  VideoNarrativeAiProviderResult,
} from "./videoNarrativeAiProviderTypes";
import type { VideoNarrativeGeminiAllowlistUser } from "./videoNarrativeGeminiAllowlist";
import { evaluateVideoNarrativeGeminiAllowlist } from "./videoNarrativeGeminiAllowlist";
import {
  resolveVideoNarrativeGeminiProviderConfig,
  type VideoNarrativeGeminiProviderConfig,
} from "./videoNarrativeGeminiProviderConfig";
import { runVideoNarrativeGeminiProvider, type VideoNarrativeGeminiClientAdapter } from "./videoNarrativeGeminiProvider";
import { mapGeminiAnalysisToStrategicProfileSnapshot } from "./videoNarrativeGeminiSnapshotMapper";
import type { VideoNarrativeRealAnalysisPayload } from "./videoNarrativeRealAnalysisTypes";
import {
  assertCanRunVideoNarrativeRealAnalysis,
  recordVideoNarrativeRealAnalysisAttempt,
  recordVideoNarrativeRealAnalysisFailure,
  recordVideoNarrativeRealAnalysisSuccess,
} from "./videoNarrativeRealAnalysisUsageService";
import {
  getVideoNarrativeRealAnalysisUserFacingMessage,
} from "./videoNarrativeRealAnalysisUserFacingErrors";
import { resolveVideoNarrativeTemporaryStorageObject } from "./videoNarrativeTemporaryStorageRuntimeResolver";
import { resolveVideoNarrativeTemporaryStorageInput } from "./videoNarrativeTemporaryStorageRuntimeAdapter";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type VideoNarrativeRealAnalysisOrchestratorResult =
  | {
      ok: true;
      snapshotUpdated: true;
      snapshot: CreatorStrategicProfileSnapshotInput["snapshot"];
      source: "gemini_real_allowlist";
      cleanupWarning?: string;
    }
  | {
      ok: false;
      status: "blocked" | "failed";
      message: string;
      safeIssueCode?: string;
      cleanupWarning?: string;
    };

export type VideoNarrativeRealAnalysisOrchestratorDeps = {
  env?: EnvLike;
  requestId?: string;
  now?: () => Date;
  geminiConfig?: VideoNarrativeGeminiProviderConfig;
  geminiClient?: VideoNarrativeGeminiClientAdapter | null;
  runProvider?: (params: {
    input: VideoNarrativeAiProviderInput;
    user: VideoNarrativeGeminiAllowlistUser;
    env?: EnvLike;
    config?: VideoNarrativeGeminiProviderConfig;
    client?: VideoNarrativeGeminiClientAdapter | null;
  }) => Promise<VideoNarrativeAiProviderResult>;
  upsertSnapshot?: typeof upsertStrategicProfileSnapshot;
  assertCanRunRealAnalysis?: typeof assertCanRunVideoNarrativeRealAnalysis;
  recordUsageAttempt?: typeof recordVideoNarrativeRealAnalysisAttempt;
  recordUsageSuccess?: typeof recordVideoNarrativeRealAnalysisSuccess;
  recordUsageFailure?: typeof recordVideoNarrativeRealAnalysisFailure;
  cleanupTemporaryUpload?: (payload: {
    uploadSessionId: string;
    objectKey?: string;
    reason: "analysis_completed" | "analysis_failed";
  }) => Promise<void>;
};

function safeFailure(params: {
  status?: "blocked" | "failed";
  message?: string;
  safeIssueCode?: string;
  cleanupWarning?: string;
}): VideoNarrativeRealAnalysisOrchestratorResult {
  return {
    ok: false,
    status: params.status ?? "failed",
    message: params.message ?? "Não foi possível atualizar o diagnóstico real agora.",
    safeIssueCode: params.safeIssueCode,
    cleanupWarning: params.cleanupWarning,
  };
}

async function tryCleanup(params: {
  deps: VideoNarrativeRealAnalysisOrchestratorDeps;
  payload: VideoNarrativeRealAnalysisPayload;
  reason: "analysis_completed" | "analysis_failed";
}): Promise<string | undefined> {
  if (!params.deps.cleanupTemporaryUpload) return undefined;
  try {
    await params.deps.cleanupTemporaryUpload({
      uploadSessionId: params.payload.uploadSessionId,
      objectKey: params.payload.temporaryUpload?.objectKey,
      reason: params.reason,
    });
    return undefined;
  } catch {
    return "Cleanup temporário não foi confirmado.";
  }
}

async function recordFailureSafely(params: {
  deps: VideoNarrativeRealAnalysisOrchestratorDeps;
  userId?: string | null;
  reason: string;
  now: Date;
}): Promise<void> {
  if (!params.userId) return;
  try {
    await (params.deps.recordUsageFailure ?? recordVideoNarrativeRealAnalysisFailure)({
      userId: params.userId,
      reason: params.reason,
      now: params.now,
    });
  } catch {
    // Usage telemetry must not leak implementation details or mask the original safe failure.
  }
}

export async function runVideoNarrativeRealAnalysisOrchestrator(params: {
  payload: VideoNarrativeRealAnalysisPayload;
  user: VideoNarrativeGeminiAllowlistUser & {
    planStatus?: string | null;
    name?: string | null;
    instagramConnected?: boolean | null;
    isInstagramConnected?: boolean | null;
  };
  deps?: VideoNarrativeRealAnalysisOrchestratorDeps;
}): Promise<VideoNarrativeRealAnalysisOrchestratorResult> {
  const deps = params.deps ?? {};
  const env = deps.env ?? process.env;
  const now = deps.now?.() ?? new Date();
  const configResult = deps.geminiConfig
    ? { config: deps.geminiConfig, issues: [] }
    : resolveVideoNarrativeGeminiProviderConfig(env);
  const blocker = configResult.issues.find((issue) => issue.severity === "blocker");

  if (!configResult.config.enabled || blocker) {
    return safeFailure({
      status: "blocked",
      message: "Análise real indisponível nesta configuração.",
      safeIssueCode: blocker?.code ?? "gemini_provider_disabled",
    });
  }

  const allowlist = evaluateVideoNarrativeGeminiAllowlist({ user: params.user, env });
  if (!allowlist.ok) {
    return safeFailure({
      status: "blocked",
      message: "Análise real indisponível para este usuário.",
      safeIssueCode: allowlist.issues[0]?.code,
    });
  }

  let usageAttemptRecorded = false;
  const assertCanRunRealAnalysis = deps.assertCanRunRealAnalysis ?? assertCanRunVideoNarrativeRealAnalysis;
  try {
    const usageDecision = await assertCanRunRealAnalysis({
      user: params.user,
      env,
      now,
    });

    if (!usageDecision.ok) {
      return safeFailure({
        status: "blocked",
        message: getVideoNarrativeRealAnalysisUserFacingMessage(usageDecision.code),
        safeIssueCode: usageDecision.code,
      });
    }

    if (
      params.payload.temporaryUpload?.sizeBytes &&
      params.payload.temporaryUpload.sizeBytes > usageDecision.policy.maxFileSizeBytes
    ) {
      return safeFailure({
        status: "blocked",
        message: getVideoNarrativeRealAnalysisUserFacingMessage("storage_not_ready"),
        safeIssueCode: "object_too_large",
      });
    }

    if (params.user.id) {
      await (deps.recordUsageAttempt ?? recordVideoNarrativeRealAnalysisAttempt)({
        userId: params.user.id,
        now,
      });
      usageAttemptRecorded = true;
    }
  } catch {
    return safeFailure({
      status: "failed",
      message: getVideoNarrativeRealAnalysisUserFacingMessage("unknown_error"),
      safeIssueCode: "usage_check_failed",
    });
  }

  const storageResolver = resolveVideoNarrativeTemporaryStorageObject({
    uploadSessionId: params.payload.uploadSessionId,
    objectKey: params.payload.temporaryUpload?.objectKey,
    mimeType: params.payload.temporaryUpload?.mimeType,
  });

  if (!storageResolver.ok) {
    if (usageAttemptRecorded) {
      await recordFailureSafely({ deps, userId: params.user.id, reason: storageResolver.status, now });
    }
    return safeFailure({
      status: "blocked",
      message: getVideoNarrativeRealAnalysisUserFacingMessage(storageResolver.status),
      safeIssueCode: storageResolver.status,
    });
  }

  const storageInputResult = await resolveVideoNarrativeTemporaryStorageInput({
    input: {
      uploadSessionId: params.payload.uploadSessionId,
      objectKey: params.payload.temporaryUpload?.objectKey ?? "",
      mimeType: params.payload.temporaryUpload?.mimeType ?? "video/mp4",
      sizeBytes: params.payload.temporaryUpload?.sizeBytes ?? 0,
    },
    env,
  });

  if (!storageInputResult.ok) {
    if (usageAttemptRecorded) {
      await recordFailureSafely({ deps, userId: params.user.id, reason: storageInputResult.status, now });
    }
    return safeFailure({
      status: "failed",
      message: getVideoNarrativeRealAnalysisUserFacingMessage(storageInputResult.status),
      safeIssueCode: storageInputResult.status,
    });
  }

  const runProvider = deps.runProvider ?? runVideoNarrativeGeminiProvider;
  const geminiClient =
    "geminiClient" in deps
      ? deps.geminiClient ?? null
      : deps.runProvider
        ? null
        : configResult.config.apiKey
          ? (
              await import("./geminiVideoNarrativeClientFactory")
            ).createVideoNarrativeGeminiClientAdapter({
              apiKey: configResult.config.apiKey,
              model: configResult.config.model ?? undefined,
            }).client
        : null;
  const providerResult = await runProvider({
    input: {
      userId: params.user.id ?? "unknown",
      creatorGoal: params.payload.creatorGoal,
      selectedGoalOption: params.payload.selectedGoalOption,
      quickAnswers: params.payload.quickAnswers,
      temporaryUpload: {
        uploadSessionId: params.payload.uploadSessionId,
        objectKey: params.payload.temporaryUpload?.objectKey,
        mimeType: params.payload.temporaryUpload?.mimeType ?? "video/mp4",
        sizeBytes: params.payload.temporaryUpload?.sizeBytes ?? 0,
      },
      profileContext: {
        displayName: params.user.name ?? undefined,
        instagramConnected: Boolean(params.user.instagramConnected || params.user.isInstagramConnected),
        premiumAccess: params.user.planStatus === "active",
      },
      promptVersion: configResult.config.promptVersion,
      requestId: deps.requestId ?? `real-analysis-${now.getTime()}`,
    },
    user: params.user,
    env,
    config: configResult.config,
    client: geminiClient,
    videoInput: storageInputResult.geminiInput,
  });

  if (!providerResult.ok || !providerResult.analysis) {
    const cleanupWarning = await tryCleanup({ deps, payload: params.payload, reason: "analysis_failed" });
    const providerIssueCode = providerResult.issues?.[0]?.code;
    const safeProviderIssueCode = providerIssueCode && [
      "gemini_timeout",
      "gemini_invalid_response",
      "provider_invalid_response",
    ].includes(providerIssueCode)
      ? providerIssueCode
      : "gemini_provider_failed";
    if (usageAttemptRecorded) {
      await recordFailureSafely({
        deps,
        userId: params.user.id,
        reason: safeProviderIssueCode,
        now,
      });
    }
    return safeFailure({
      message: getVideoNarrativeRealAnalysisUserFacingMessage(
        safeProviderIssueCode,
      ),
      safeIssueCode: safeProviderIssueCode,
      cleanupWarning,
    });
  }

  const mapped = mapGeminiAnalysisToStrategicProfileSnapshot({
    analysis: providerResult.analysis,
    promptVersion: providerResult.promptVersion,
    source: "gemini_real_allowlist",
  });
  const upsertSnapshot = deps.upsertSnapshot ?? upsertStrategicProfileSnapshot;

  try {
    const upserted = await upsertSnapshot({
      userId: params.user.id ?? "",
      status: "active",
      accessLevel: params.user.planStatus === "active" ? "premium" : "free",
      snapshot: mapped.snapshot,
      source: mapped.source,
      lastAnalyzedAt: now,
    });
    const cleanupWarning = await tryCleanup({ deps, payload: params.payload, reason: "analysis_completed" });
    if (usageAttemptRecorded && params.user.id) {
      try {
        await (deps.recordUsageSuccess ?? recordVideoNarrativeRealAnalysisSuccess)({
          userId: params.user.id,
          now,
        });
      } catch {
        // Usage telemetry should not turn a completed snapshot into a user-facing failure.
      }
    }

    return {
      ok: true,
      snapshotUpdated: true,
      snapshot: upserted.snapshot,
      source: "gemini_real_allowlist",
      cleanupWarning,
    };
  } catch {
    const cleanupWarning = await tryCleanup({ deps, payload: params.payload, reason: "analysis_failed" });
    if (usageAttemptRecorded) {
      await recordFailureSafely({ deps, userId: params.user.id, reason: "snapshot_save_failed", now });
    }
    return safeFailure({
      message: getVideoNarrativeRealAnalysisUserFacingMessage("snapshot_save_failed"),
      safeIssueCode: "snapshot_upsert_failed",
      cleanupWarning,
    });
  }
}
