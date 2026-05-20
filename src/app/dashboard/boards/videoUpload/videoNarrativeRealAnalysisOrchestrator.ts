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

  const runProvider = deps.runProvider ?? runVideoNarrativeGeminiProvider;
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
    client: deps.geminiClient ?? null,
  });

  if (!providerResult.ok || !providerResult.analysis) {
    const cleanupWarning = await tryCleanup({ deps, payload: params.payload, reason: "analysis_failed" });
    return safeFailure({
      message: "Não foi possível concluir a análise real agora.",
      safeIssueCode: providerResult.issues?.[0]?.code ?? "gemini_provider_failed",
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

    return {
      ok: true,
      snapshotUpdated: true,
      snapshot: upserted.snapshot,
      source: "gemini_real_allowlist",
      cleanupWarning,
    };
  } catch {
    const cleanupWarning = await tryCleanup({ deps, payload: params.payload, reason: "analysis_failed" });
    return safeFailure({
      message: "Não foi possível salvar o diagnóstico real agora.",
      safeIssueCode: "snapshot_upsert_failed",
      cleanupWarning,
    });
  }
}
