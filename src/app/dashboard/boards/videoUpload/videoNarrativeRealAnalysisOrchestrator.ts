import type {
  VideoNarrativeAiProviderInput,
  VideoNarrativeAiProviderResult,
  VideoNarrativeCoherence,
  VideoNarrativeAxisCoherence,
} from "./videoNarrativeAiProviderTypes";
import type { VideoNarrativeReadingPersistenceSummary, VideoNarrativeSynthesisSnapshotWriteSummary } from "./videoNarrativeSafeResponseBuilder";
import type { VideoNarrativeGeminiAllowlistUser } from "./videoNarrativeGeminiAllowlist";
import { evaluateVideoNarrativeGeminiAllowlist } from "./videoNarrativeGeminiAllowlist";
import {
  resolveVideoNarrativeGeminiProviderConfig,
  type VideoNarrativeGeminiProviderConfig,
} from "./videoNarrativeGeminiProviderConfig";
import { runVideoNarrativeGeminiProvider, type VideoNarrativeGeminiClientAdapter } from "./videoNarrativeGeminiProvider";
import { buildRealProviderDiagnosisArtifacts } from "./videoNarrativeRealAnalysisDiagnosisPipeline";
import {
  buildVideoNarrativeDiagnosisQuiz,
  type VideoNarrativeDiagnosisQuizResult,
} from "./videoNarrativeDiagnosisQuizBuilder";
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
import { logger } from "@/app/lib/logger";
import { resolveVideoNarrativeTemporaryStorageObject } from "./videoNarrativeTemporaryStorageRuntimeResolver";
import { resolveVideoNarrativeTemporaryStorageInput } from "./videoNarrativeTemporaryStorageRuntimeAdapter";
import {
  saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis,
  type SaveCreatorVideoNarrativeDiagnosisResult,
} from "./creatorVideoNarrativeDiagnosisSaveOrchestrator";
import {
  runControlledVideoReadingSynthesisSnapshotWrite,
  type ControlledVideoReadingSynthesisSnapshotWriteResult,
} from "./creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

const REAL_ANALYSIS_BUG_INDICATOR = "MOBILE_STRATEGIC_PROFILE_REAL_ANALYSIS_BUG";

function logRealAnalysisOrchestratorBugEvent(params: {
  event: string;
  requestId?: string;
  userId?: string | null;
  meta?: Record<string, unknown>;
}) {
  logger.warn(`[${REAL_ANALYSIS_BUG_INDICATOR}] ${params.event}`, {
    bugIndicator: REAL_ANALYSIS_BUG_INDICATOR,
    component: "videoNarrativeRealAnalysisOrchestrator",
    requestId: params.requestId,
    userId: params.userId ?? undefined,
    ...(params.meta ?? {}),
  });
}

export type VideoNarrativeRealAnalysisOrchestratorResult =
  | {
      ok: true;
      realAnalysis: true;
      source: "gemini_real_allowlist";
      videoReadingPersistence: VideoNarrativeReadingPersistenceSummary;
      synthesisSnapshotWrite: VideoNarrativeSynthesisSnapshotWriteSummary;
      evidenceAnchorsUsed: boolean;
      cleanupAttempted: boolean;
      usageLimitChecked: boolean;
      allowlistGatePassed: boolean;
      adaptiveQuiz: VideoNarrativeDiagnosisQuizResult;
      /** Highlights surfaced on the post-analysis confirmation step (not persisted). */
      confirmation?: {
        directAnswer?: string | null;
        coherenceVerdict?: VideoNarrativeCoherence["verdict"] | null;
        coherenceReasoning?: string | null;
        /** Eixo audiência do veredito "vale postar?". */
        audienceCoherence?: VideoNarrativeAxisCoherence | null;
        /** Eixo marca do veredito "vale postar?". */
        brandCoherence?: VideoNarrativeAxisCoherence | null;
      };
      cleanupWarning?: string;
    }
  | {
      ok: false;
      status: "blocked" | "failed";
      message: string;
      safeIssueCode?: string;
      videoReadingPersistence?: VideoNarrativeReadingPersistenceSummary;
      synthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary;
      evidenceAnchorsUsed?: boolean;
      cleanupAttempted?: boolean;
      usageLimitChecked?: boolean;
      allowlistGatePassed?: boolean;
      cleanupWarning?: string;
    };

export type VideoNarrativeRealAnalysisOrchestratorDeps = {
  env?: EnvLike;
  requestId?: string;
  now?: () => Date;
  /** Pre-fetched Instagram metrics for prompt context. Omit to skip. */
  instagramMetrics?: import("./videoNarrativeAiProviderTypes").VideoNarrativeInstagramMetricsSummary | null;
  /** Narrative labels already confirmed for this creator, used to help Gemini detect confirmations vs. deviations. */
  knownNarratives?: string[] | null;
  /** Life-asset combinations confirmed across prior readings — fed back to Gemini for the coherence verdict. */
  confirmedLifeAssets?: Array<{ label: string; evidenceCount: number }> | null;
  /** The single top-performing asset pattern derived from confirmedLifeAssets. */
  topPerformingPattern?: string | null;
  /** Creator's answers to adaptive quiz questions from recent confirmation steps. */
  pastCreatorAnswers?: Array<{ questionText: string; answerValue: string }> | null;
  /** Real audience composition (demographics), used to anchor the audiência axis of the verdict. */
  audienceContext?: import("./videoNarrativeAiProviderTypes").VideoNarrativeAudienceContextSummary | null;
  geminiConfig?: VideoNarrativeGeminiProviderConfig;
  geminiClient?: VideoNarrativeGeminiClientAdapter | null;
  runProvider?: (params: {
    input: VideoNarrativeAiProviderInput;
    user: VideoNarrativeGeminiAllowlistUser;
    env?: EnvLike;
    config?: VideoNarrativeGeminiProviderConfig;
    client?: VideoNarrativeGeminiClientAdapter | null;
    skipAllowlist?: boolean;
  }) => Promise<VideoNarrativeAiProviderResult>;
  evaluateAllowlist?: typeof evaluateVideoNarrativeGeminiAllowlist;
  saveReading?: typeof saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis;
  runSynthesisSnapshotWrite?: typeof runControlledVideoReadingSynthesisSnapshotWrite;
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
  videoReadingPersistence?: VideoNarrativeReadingPersistenceSummary;
  synthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary;
  evidenceAnchorsUsed?: boolean;
  cleanupAttempted?: boolean;
  usageLimitChecked?: boolean;
  allowlistGatePassed?: boolean;
  cleanupWarning?: string;
}): VideoNarrativeRealAnalysisOrchestratorResult {
  return {
    ok: false,
    status: params.status ?? "failed",
    message: params.message ?? "Não foi possível atualizar o diagnóstico real agora.",
    safeIssueCode: params.safeIssueCode,
    videoReadingPersistence: params.videoReadingPersistence,
    synthesisSnapshotWrite: params.synthesisSnapshotWrite,
    evidenceAnchorsUsed: params.evidenceAnchorsUsed,
    cleanupAttempted: params.cleanupAttempted,
    usageLimitChecked: params.usageLimitChecked,
    allowlistGatePassed: params.allowlistGatePassed,
    cleanupWarning: params.cleanupWarning,
  };
}

function skippedReading(reason: string): VideoNarrativeReadingPersistenceSummary {
  return {
    attempted: false,
    saved: false,
    skippedReason: reason,
  };
}

function skippedSnapshot(reason: string): VideoNarrativeSynthesisSnapshotWriteSummary {
  return {
    attempted: false,
    written: false,
    skippedReason: reason,
  };
}

function mapSaveResult(result: SaveCreatorVideoNarrativeDiagnosisResult): VideoNarrativeReadingPersistenceSummary {
  if (result.ok) {
    return {
      attempted: true,
      saved: true,
      diagnosisId: result.diagnosisId,
    };
  }

  return {
    attempted: true,
    saved: false,
    errorCode: result.errorCode,
  };
}

function mapSynthesisResult(
  result: ControlledVideoReadingSynthesisSnapshotWriteResult,
): VideoNarrativeSynthesisSnapshotWriteSummary {
  return {
    attempted: result.attempted,
    written: result.written,
    skippedReason: result.skippedReason ?? null,
    synthesisStatus: result.synthesisStatus ?? null,
    analyzedReadingsCount: result.analyzedReadingsCount ?? null,
    snapshotId: result.snapshotId ?? null,
    updatedAt: result.updatedAt ?? null,
  };
}

function hasEvidenceAnchors(analysis: VideoNarrativeAiProviderResult["analysis"]): boolean {
  return Boolean(
    analysis?.evidenceAnchors &&
      (
        analysis.evidenceAnchors.speechQuotes.length > 0 ||
        analysis.evidenceAnchors.sceneAnchors.length > 0 ||
        analysis.evidenceAnchors.creatorIntentAnchor
      ),
  );
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
  const createdAt = now.toISOString();
  const configResult = deps.geminiConfig
    ? { config: deps.geminiConfig, issues: [] }
    : resolveVideoNarrativeGeminiProviderConfig(env);
  const blocker = configResult.issues.find((issue) => issue.severity === "blocker");

  if (!configResult.config.enabled || blocker) {
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_provider_config_blocked",
      requestId: deps.requestId,
      userId: params.user.id,
      meta: {
        blockerCode: blocker?.code,
        providerEnabled: configResult.config.enabled,
        issueCodes: configResult.issues.map((issue) => issue.code),
      },
    });
    return safeFailure({
      status: "blocked",
      message: "Análise real indisponível nesta configuração.",
      safeIssueCode: blocker?.code ?? "gemini_provider_disabled",
    });
  }

  const evaluateAllowlist = deps.evaluateAllowlist ?? evaluateVideoNarrativeGeminiAllowlist;
  const allowlist = evaluateAllowlist({ user: params.user, env });
  if (!allowlist.ok) {
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_allowlist_blocked",
      requestId: deps.requestId,
      userId: params.user.id,
      meta: { issueCodes: allowlist.issues.map((issue) => issue.code) },
    });
    return safeFailure({
      status: "blocked",
      message: "Análise real indisponível para este usuário.",
      safeIssueCode: allowlist.issues[0]?.code,
    });
  }

  let usageAttemptRecorded = false;
  let usageLimitChecked = false;
  const assertCanRunRealAnalysis = deps.assertCanRunRealAnalysis ?? assertCanRunVideoNarrativeRealAnalysis;
  try {
    const usageDecision = await assertCanRunRealAnalysis({
      user: params.user,
      env,
      now,
    });
    usageLimitChecked = true;

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
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_usage_check_failed",
      requestId: deps.requestId,
      userId: params.user.id,
    });
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
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_storage_resolver_blocked",
      requestId: deps.requestId,
      userId: params.user.id,
      meta: { status: storageResolver.status },
    });
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
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_storage_input_failed",
      requestId: deps.requestId,
      userId: params.user.id,
      meta: { status: storageInputResult.status },
    });
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
  let cleanupWarning: string | undefined;
  let cleanupAttempted = false;
  const attemptCleanup = async (reason: "analysis_completed" | "analysis_failed") => {
    cleanupAttempted = Boolean(deps.cleanupTemporaryUpload);
    cleanupWarning = await tryCleanup({ deps, payload: params.payload, reason });
  };

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
        knownNarratives: deps.knownNarratives ?? null,
        confirmedLifeAssets: deps.confirmedLifeAssets ?? null,
        topPerformingPattern: deps.topPerformingPattern ?? null,
        pastCreatorAnswers: deps.pastCreatorAnswers ?? null,
        audienceContext: deps.audienceContext ?? null,
      },
      instagramMetrics: deps.instagramMetrics ?? undefined,
      promptVersion: configResult.config.promptVersion,
      requestId: deps.requestId ?? `real-analysis-${now.getTime()}`,
    },
    user: params.user,
    env,
    config: configResult.config,
    client: geminiClient,
    videoInput: storageInputResult.geminiInput,
    skipAllowlist: true,
  });

  if (!providerResult.ok || !providerResult.analysis) {
    await attemptCleanup("analysis_failed");
    const providerIssueCode = providerResult.issues?.[0]?.code;
    const safeProviderIssueCode = providerIssueCode && [
      "empty_response",
      "invalid_json",
      "missing_object",
      "missing_required_fields",
      "invalid_required_string",
      "invalid_required_array",
      "gemini_timeout",
      "gemini_invalid_response",
      "gemini_permission_denied",
      "gemini_file_upload_failed",
      "gemini_file_permission_denied",
      "gemini_file_processing_failed",
      "gemini_file_processing_timeout",
      "gemini_file_uri_missing",
      "provider_invalid_response",
    ].includes(providerIssueCode)
      ? providerIssueCode
      : "gemini_provider_failed";
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_provider_failed",
      requestId: deps.requestId,
      userId: params.user.id,
      meta: {
        providerMode: providerResult.mode,
        providerIssueCode,
        safeProviderIssueCode,
        providerIssueCodes: providerResult.issues?.map((issue) => issue.code) ?? [],
        providerTimingMs: providerResult.timingMs,
        providerSafeDebugSummary: providerResult.safeDebugSummary,
        cleanupAttempted,
        cleanupWarning,
      },
    });
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
      evidenceAnchorsUsed: false,
      cleanupAttempted,
      usageLimitChecked,
      allowlistGatePassed: true,
      cleanupWarning,
    });
  }

  const evidenceAnchorsUsed = hasEvidenceAnchors(providerResult.analysis);
  if (!evidenceAnchorsUsed) {
    await attemptCleanup("analysis_failed");
    logRealAnalysisOrchestratorBugEvent({
      event: "orchestrator_video_evidence_missing",
      requestId: deps.requestId,
      userId: params.user.id,
      meta: {
        providerMode: providerResult.mode,
        providerTimingMs: providerResult.timingMs,
        cleanupAttempted,
        cleanupWarning,
      },
    });
    if (usageAttemptRecorded) {
      await recordFailureSafely({
        deps,
        userId: params.user.id,
        reason: "video_evidence_missing",
        now,
      });
    }
    return safeFailure({
      message: getVideoNarrativeRealAnalysisUserFacingMessage("video_evidence_missing"),
      safeIssueCode: "video_evidence_missing",
      evidenceAnchorsUsed: false,
      cleanupAttempted,
      usageLimitChecked,
      allowlistGatePassed: true,
      cleanupWarning,
    });
  }

  const accessLevel = params.user.planStatus === "active" ? "premium" : "free";
  const instagramConnected = Boolean(params.user.instagramConnected || params.user.isInstagramConnected);
  const artifacts = buildRealProviderDiagnosisArtifacts({
    analysisId: `real-video-narrative-${params.payload.uploadSessionId}`,
    providerAnalysis: providerResult.analysis,
    creatorGoal: params.payload.creatorGoal,
    selectedGoalOption: params.payload.selectedGoalOption,
    accessLevel,
    instagramConnected,
    createdAt,
  });
  const adaptiveQuiz = buildVideoNarrativeDiagnosisQuiz({
    analysis: artifacts.analysis,
    seed: artifacts.seed,
    diagnosis: artifacts.strategicDiagnosis,
    creatorQuestion: params.payload.creatorGoal,
    accessLevel,
    existingSignals: artifacts.strategicDiagnosis.creatorSignals,
  });

  const saveReading = deps.saveReading ?? saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis;
  let videoReadingPersistence = skippedReading("persist_reading_disabled");
  let synthesisSnapshotWrite = skippedSnapshot("synthesis_write_disabled");

  if (params.payload.persistReading === true) {
    const saveResult = await saveReading({
      userId: params.user.id ?? "",
      source: "real",
      creatorGoal: params.payload.creatorGoal,
      selectedGoalOption: params.payload.selectedGoalOption,
      safeVideoMetadata: {
        mimeType: params.payload.temporaryUpload?.mimeType,
        sizeBytes: params.payload.temporaryUpload?.sizeBytes,
        uploadedAt: params.payload.temporaryUpload?.uploadedAt ? new Date(params.payload.temporaryUpload.uploadedAt) : undefined,
        analyzedAt: now,
      },
      strategicDiagnosis: artifacts.strategicDiagnosis,
      evolvingDiagnosis: artifacts.evolvingDiagnosis,
      presentation: artifacts.presentation,
      seed: artifacts.seed,
      analyzedAt: now,
      createdAt: now,
    });
    videoReadingPersistence = mapSaveResult(saveResult);

    if (!saveResult.ok) {
      if (usageAttemptRecorded) {
        await recordFailureSafely({ deps, userId: params.user.id, reason: saveResult.errorCode, now });
      }
      return safeFailure({
        status: "failed",
        message: saveResult.message,
        safeIssueCode: saveResult.errorCode,
        videoReadingPersistence,
        synthesisSnapshotWrite: skippedSnapshot("saved_reading_not_found"),
        evidenceAnchorsUsed,
        cleanupAttempted,
        usageLimitChecked,
        allowlistGatePassed: true,
        cleanupWarning,
      });
    }

    if (params.payload.persistSynthesisSnapshot === true && saveResult.diagnosisId) {
      const runSynthesisSnapshotWrite = deps.runSynthesisSnapshotWrite ?? runControlledVideoReadingSynthesisSnapshotWrite;
      synthesisSnapshotWrite = mapSynthesisResult(await runSynthesisSnapshotWrite({
        userId: params.user.id ?? "",
        savedDiagnosisId: saveResult.diagnosisId,
        enableSnapshotWrite: true,
        source: "real_internal",
        requestId: deps.requestId,
      }));

      if (!synthesisSnapshotWrite.written) {
        if (usageAttemptRecorded) {
          await recordFailureSafely({
            deps,
            userId: params.user.id,
            reason: synthesisSnapshotWrite.skippedReason ?? "unknown_synthesis_write_error",
            now,
          });
        }
        return safeFailure({
          status: "failed",
          message: "A leitura foi salva, mas a síntese acumulada não foi atualizada agora.",
          safeIssueCode: synthesisSnapshotWrite.skippedReason ?? "unknown_synthesis_write_error",
          videoReadingPersistence,
          synthesisSnapshotWrite,
          evidenceAnchorsUsed,
          cleanupAttempted,
          usageLimitChecked,
          allowlistGatePassed: true,
          cleanupWarning,
        });
      }
    } else if (params.payload.persistSynthesisSnapshot === true) {
      synthesisSnapshotWrite = skippedSnapshot("saved_reading_not_found");
    }
  }

  if (usageAttemptRecorded && params.user.id) {
    try {
      await (deps.recordUsageSuccess ?? recordVideoNarrativeRealAnalysisSuccess)({
        userId: params.user.id,
        now,
      });
    } catch {
      // Usage telemetry should not turn a completed safe analysis into a user-facing failure.
    }
  }

  await attemptCleanup("analysis_completed");

  const coherence = providerResult.analysis.narrativeCoherence;
  return {
    ok: true,
    realAnalysis: true,
    source: "gemini_real_allowlist",
    videoReadingPersistence,
    synthesisSnapshotWrite,
    evidenceAnchorsUsed,
    cleanupAttempted,
    usageLimitChecked,
    allowlistGatePassed: true,
    adaptiveQuiz,
    confirmation: {
      directAnswer: providerResult.analysis.directAnswer ?? null,
      coherenceVerdict: coherence?.verdict ?? null,
      coherenceReasoning: coherence?.reasoning ?? null,
      audienceCoherence: providerResult.analysis.audienceCoherence ?? null,
      brandCoherence: providerResult.analysis.brandCoherence ?? null,
    },
    cleanupWarning,
  };
}
