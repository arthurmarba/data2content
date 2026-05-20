import { resolveTemporaryStorageProviderConfig } from "./videoNarrativeTemporaryStorageProviderConfig";
import {
  PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES,
  type VideoNarrativeTemporaryStorageCreateSessionInput,
  type VideoNarrativeTemporaryStorageCreateSessionResult,
  type VideoNarrativeTemporaryStorageProvider,
  type VideoNarrativeTemporaryStorageProviderConfig,
  type VideoNarrativeTemporaryStorageProviderConfigIssue,
} from "./videoNarrativeTemporaryStorageProviderTypes";

type CreateProviderOptions = {
  config?: VideoNarrativeTemporaryStorageProviderConfig;
  configIssues?: VideoNarrativeTemporaryStorageProviderConfigIssue[];
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  realUploadEnabled?: boolean;
  uploadSessionEnabled?: boolean;
};

function disabledIssue(message = "Storage temporário desativado nesta fase."): VideoNarrativeTemporaryStorageProviderConfigIssue {
  return {
    code: "temporary_storage_disabled",
    severity: "info",
    message,
  };
}

function withoutDuplicateIssues(
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[],
): VideoNarrativeTemporaryStorageProviderConfigIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDisabledProvider(params: {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
}): VideoNarrativeTemporaryStorageProvider {
  return {
    mode: params.config.mode,
    providerName: params.config.providerName,
    createUploadSession(): VideoNarrativeTemporaryStorageCreateSessionResult {
      return {
        ok: false,
        status: "disabled",
        reason: "temporary_storage_disabled",
        providerMode: params.config.mode,
        storageProvider: params.config.providerName,
        issues: withoutDuplicateIssues(params.issues.length > 0 ? params.issues : [disabledIssue()]),
      };
    },
  };
}

function buildMockProvider(params: {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
}): VideoNarrativeTemporaryStorageProvider {
  return {
    mode: "mock",
    providerName: "local_mock",
    createUploadSession(input: VideoNarrativeTemporaryStorageCreateSessionInput): VideoNarrativeTemporaryStorageCreateSessionResult {
      const now = input.nowIso ? new Date(input.nowIso) : new Date();
      const nowMs = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
      const expiresAt = new Date(nowMs + params.config.retentionTtlMinutes * 60 * 1000).toISOString();

      return {
        ok: true,
        status: "mock_session_created",
        providerMode: "mock",
        storageProvider: "none",
        uploadSession: {
          id: `video-temp-upload-session-mock-${nowMs}`,
          providerMode: "mock",
          storageProvider: "none",
          expiresAt,
          retentionTtlMinutes: params.config.retentionTtlMinutes,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
        issues: params.issues.length > 0 ? withoutDuplicateIssues(params.issues) : undefined,
      };
    },
  };
}

export function createVideoNarrativeTemporaryStorageProvider(
  options: CreateProviderOptions = {},
): {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
  provider: VideoNarrativeTemporaryStorageProvider;
} {
  const resolved = options.config
    ? { config: options.config, issues: options.configIssues ?? [] }
    : resolveTemporaryStorageProviderConfig({
        env: options.env,
        realUploadEnabled: options.realUploadEnabled,
        uploadSessionEnabled: options.uploadSessionEnabled,
      });

  const hasBlocker = resolved.issues.some((issue) => issue.severity === "blocker");
  const isPlannedProvider = PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES.includes(resolved.config.mode);

  if (hasBlocker) {
    return {
      ...resolved,
      provider: buildDisabledProvider({ config: resolved.config, issues: resolved.issues }),
    };
  }

  if (resolved.config.mode === "mock" && resolved.config.uploadSessionEnabled) {
    return {
      ...resolved,
      provider: buildMockProvider({ config: resolved.config, issues: resolved.issues }),
    };
  }

  if (isPlannedProvider) {
    const plannedIssue: VideoNarrativeTemporaryStorageProviderConfigIssue = {
      code: "planned_provider_not_supported_in_this_build",
      severity: "blocker",
      message: "Provider real planejado ainda não é suportado nesta build.",
    };
    const issues = withoutDuplicateIssues([...resolved.issues, plannedIssue]);
    return {
      config: resolved.config,
      issues,
      provider: buildDisabledProvider({ config: resolved.config, issues }),
    };
  }

  const issues = withoutDuplicateIssues([
    ...resolved.issues,
    disabledIssue(
      resolved.config.uploadSessionEnabled
        ? "Provider de storage temporário não está configurado para modo mock."
        : "Sessão temporária de upload desativada.",
    ),
  ]);

  return {
    config: resolved.config,
    issues,
    provider: buildDisabledProvider({ config: resolved.config, issues }),
  };
}
