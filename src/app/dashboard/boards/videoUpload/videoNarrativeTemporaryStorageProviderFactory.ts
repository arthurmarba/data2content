import { createHmac, randomUUID } from "crypto";

import { resolveTemporaryStorageProviderConfig } from "./videoNarrativeTemporaryStorageProviderConfig";
import {
  createVideoNarrativeSignedUploadSession,
  createVideoNarrativeTemporaryStorageObjectKey,
  type VideoNarrativeTemporaryStorageSignedUrlSigner,
} from "./videoNarrativeTemporaryStorageSignedUrlProvider";
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
  signedUrlSigner?: VideoNarrativeTemporaryStorageSignedUrlSigner | null;
};

function isLocalDiscardUploadEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED === "1";
}

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

function signLocalDiscardUpload(params: {
  sessionId: string;
  expiresAt: string;
  sizeBytes: number;
  mimeType: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): string {
  const env = params.env ?? process.env;
  const secret = env.NEXTAUTH_SECRET?.trim() || "local-discard-upload-dev-secret";
  return createHmac("sha256", secret)
    .update(`${params.sessionId}.${params.expiresAt}.${params.sizeBytes}.${params.mimeType}`)
    .digest("hex");
}

function buildLocalDiscardUploadUrl(params: {
  input: VideoNarrativeTemporaryStorageCreateSessionInput;
  sessionId: string;
  expiresAt: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): string {
  const env = params.env ?? process.env;
  const baseUrl = env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
  const url = new URL("/api/dev/mobile-strategic-profile/discard-upload", baseUrl);
  url.searchParams.set("sessionId", params.sessionId);
  url.searchParams.set("expiresAt", params.expiresAt);
  url.searchParams.set("sizeBytes", String(params.input.sizeBytes));
  url.searchParams.set("mimeType", params.input.mimeType);
  url.searchParams.set("signature", signLocalDiscardUpload({
    sessionId: params.sessionId,
    expiresAt: params.expiresAt,
    sizeBytes: params.input.sizeBytes,
    mimeType: params.input.mimeType,
    env,
  }));
  return url.toString();
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

function buildLocalDiscardUploadProvider(params: {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): VideoNarrativeTemporaryStorageProvider {
  return {
    mode: "real",
    providerName: "local_mock",
    createUploadSession(input: VideoNarrativeTemporaryStorageCreateSessionInput): VideoNarrativeTemporaryStorageCreateSessionResult {
      const now = input.nowIso ? new Date(input.nowIso) : new Date();
      const nowMs = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
      const sessionId = `video-temp-upload-session-local-${randomUUID()}`;
      const expiresAt = new Date(nowMs + params.config.signedUrlTtlSeconds * 1000).toISOString();
      const objectKey = createVideoNarrativeTemporaryStorageObjectKey(input, sessionId);

      return {
        ok: true,
        status: "signed_upload_session_created",
        providerMode: "real",
        storageProvider: "cloudflare_r2",
        uploadSession: {
          id: sessionId,
          providerMode: "real",
          storageProvider: "cloudflare_r2",
          uploadUrl: buildLocalDiscardUploadUrl({
            input,
            sessionId,
            expiresAt,
            env: params.env,
          }),
          method: "PUT",
          expiresAt,
          signedUrlTtlSeconds: params.config.signedUrlTtlSeconds,
          retentionTtlMinutes: params.config.retentionTtlMinutes,
          headers: {
            "Content-Type": input.mimeType,
          },
          objectKey,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
        issues: params.issues.length > 0 ? withoutDuplicateIssues(params.issues) : undefined,
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

function buildSignedProvider(params: {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
  signedUrlSigner?: VideoNarrativeTemporaryStorageSignedUrlSigner | null;
}): VideoNarrativeTemporaryStorageProvider {
  return {
    mode: "real",
    providerName: params.config.providerName,
    createUploadSession(input: VideoNarrativeTemporaryStorageCreateSessionInput) {
      return createVideoNarrativeSignedUploadSession({
        config: params.config,
        input,
        signer: params.signedUrlSigner ?? undefined,
        issues: params.issues,
      });
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
  const localDiscardUploadEnabled = isLocalDiscardUploadEnabled(options.env);

  if (hasBlocker) {
    return {
      ...resolved,
      provider: buildDisabledProvider({ config: resolved.config, issues: resolved.issues }),
    };
  }

  if (resolved.config.uploadSessionEnabled && localDiscardUploadEnabled) {
    return {
      ...resolved,
      provider: buildLocalDiscardUploadProvider({
        config: resolved.config,
        issues: resolved.issues,
        env: options.env,
      }),
    };
  }

  if (resolved.config.mode === "mock" && resolved.config.uploadSessionEnabled) {
    return {
      ...resolved,
      provider: buildMockProvider({ config: resolved.config, issues: resolved.issues }),
    };
  }

  if (resolved.config.mode === "real" && resolved.config.uploadSessionEnabled) {
    return {
      ...resolved,
      provider: buildSignedProvider({
        config: resolved.config,
        issues: resolved.issues,
        signedUrlSigner: options.signedUrlSigner,
      }),
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
