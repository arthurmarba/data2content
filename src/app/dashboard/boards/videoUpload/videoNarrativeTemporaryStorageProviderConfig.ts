import {
  DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG,
  PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES,
  type VideoNarrativeTemporaryStorageProviderConfig,
  type VideoNarrativeTemporaryStorageProviderConfigIssue,
  type VideoNarrativeTemporaryStorageProviderMode,
  type VideoNarrativeTemporaryStorageProviderName,
} from "./videoNarrativeTemporaryStorageProviderTypes";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

type ResolveConfigOptions = {
  env?: EnvLike;
  realUploadEnabled?: boolean;
  uploadSessionEnabled?: boolean;
};

const MAX_ALLOWED_UPLOAD_MB = 500;
const MIN_ALLOWED_UPLOAD_MB = 1;
const MAX_RETENTION_TTL_MINUTES = 24 * 60;
const MIN_RETENTION_TTL_MINUTES = 5;
const MAX_SIGNED_URL_TTL_SECONDS = 15 * 60;
const MIN_SIGNED_URL_TTL_SECONDS = 60;

function issue(params: {
  code: string;
  severity: "blocker" | "warning" | "info";
  message: string;
}): VideoNarrativeTemporaryStorageProviderConfigIssue {
  return params;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveProvider(value: string | undefined, realUploadEnabled: boolean, signedUploadAllowlistEnabled: boolean): {
  mode: VideoNarrativeTemporaryStorageProviderMode;
  providerName: VideoNarrativeTemporaryStorageProviderName;
} {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "mock" || normalized === "local_mock") {
    return { mode: "mock", providerName: "local_mock" };
  }

  if (normalized === "r2" || normalized === "cloudflare_r2") {
    return {
      mode: realUploadEnabled && signedUploadAllowlistEnabled ? "real" : "r2_planned",
      providerName: "cloudflare_r2",
    };
  }

  if (normalized === "s3" || normalized === "aws_s3") {
    return {
      mode: realUploadEnabled && signedUploadAllowlistEnabled ? "real" : "s3_planned",
      providerName: "aws_s3",
    };
  }

  if (normalized === "gcs" || normalized === "google_cloud_storage") {
    return { mode: "gcs_planned", providerName: "google_cloud_storage" };
  }

  if (normalized === "cloudinary") {
    return { mode: "cloudinary_planned", providerName: "cloudinary" };
  }

  return { mode: "disabled", providerName: "none" };
}

function readBoundedInteger(params: {
  raw: string | undefined;
  fallback: number;
  min: number;
  max: number;
  code: string;
  label: string;
  multiplier?: number;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
}): number {
  const parsed = parsePositiveNumber(params.raw);
  if (parsed === null) return params.fallback;

  if (parsed < params.min || parsed > params.max) {
    params.issues.push(
      issue({
        code: params.code,
        severity: "blocker",
        message: `${params.label} fora do limite seguro permitido.`,
      }),
    );
    return params.fallback;
  }

  return Math.round(parsed * (params.multiplier ?? 1));
}

export function resolveTemporaryStorageMaxFileSizeBytes(
  env: EnvLike = process.env,
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[] = [],
): number {
  return readBoundedInteger({
    raw: env.VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB,
    fallback: DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG.maxFileSizeBytes,
    min: MIN_ALLOWED_UPLOAD_MB,
    max: MAX_ALLOWED_UPLOAD_MB,
    code: "invalid_max_upload_mb",
    label: "Tamanho máximo de upload",
    multiplier: 1024 * 1024,
    issues,
  });
}

export function resolveTemporaryStorageProviderConfig(
  options: ResolveConfigOptions = {},
): {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
} {
  const env = options.env ?? process.env;
  const issues: VideoNarrativeTemporaryStorageProviderConfigIssue[] = [];
  const realUploadEnabled = options.realUploadEnabled ?? parseBoolean(env.VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED);
  const uploadSessionEnabled =
    options.uploadSessionEnabled ?? parseBoolean(env.VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED);
  const signedUploadAllowlistEnabled = parseBoolean(env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED);
  const provider = resolveProvider(
    env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER,
    realUploadEnabled,
    signedUploadAllowlistEnabled,
  );

  const maxFileSizeBytes = resolveTemporaryStorageMaxFileSizeBytes(env, issues);

  const retentionTtlMinutes = readBoundedInteger({
    raw: env.VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES,
    fallback: DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG.retentionTtlMinutes,
    min: MIN_RETENTION_TTL_MINUTES,
    max: MAX_RETENTION_TTL_MINUTES,
    code: "invalid_retention_ttl_minutes",
    label: "TTL de retenção",
    issues,
  });

  const signedUrlTtlSeconds = readBoundedInteger({
    raw: env.VIDEO_NARRATIVE_TEMP_SIGNED_URL_TTL_SECONDS,
    fallback: DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG.signedUrlTtlSeconds,
    min: MIN_SIGNED_URL_TTL_SECONDS,
    max: MAX_SIGNED_URL_TTL_SECONDS,
    code: "invalid_signed_url_ttl_seconds",
    label: "TTL de URL assinada",
    issues,
  });

  if (realUploadEnabled && !signedUploadAllowlistEnabled) {
    issues.push(
      issue({
        code: "signed_upload_allowlist_required",
        severity: "blocker",
        message: "Upload real exige allowlist server-side habilitada nesta build.",
      }),
    );
  }

  if (realUploadEnabled && provider.mode !== "real") {
    issues.push(
      issue({
        code: "valid_real_storage_provider_required",
        severity: "blocker",
        message: "Provider de storage temporário real não está disponível nesta build.",
      }),
    );
  }

  if (provider.mode === "real") {
    for (const [code, label, raw] of [
      ["missing_storage_bucket", "Bucket de storage temporário", env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET],
      ["missing_storage_region", "Região de storage temporário", env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION],
      ["missing_storage_endpoint", "Endpoint de storage temporário", env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT],
    ] as const) {
      if (!raw?.trim()) {
        issues.push(
          issue({
            code,
            severity: "blocker",
            message: `${label} deve estar configurado para signed upload session.`,
          }),
        );
      }
    }
  }

  if (PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES.includes(provider.mode) && !realUploadEnabled) {
    issues.push(
      issue({
        code: "planned_provider_configured_without_real_upload",
        severity: "warning",
        message: "Provider real planejado configurado, mas upload real segue desativado.",
      }),
    );
  }

  return {
    config: {
      mode: provider.mode,
      providerName: provider.providerName,
      realUploadEnabled,
      uploadSessionEnabled,
      signedUploadAllowlistEnabled,
      maxFileSizeBytes,
      retentionTtlMinutes,
      signedUrlTtlSeconds,
      bucketName: env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET?.trim() || undefined,
      region: env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION?.trim() || undefined,
      endpoint: env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT?.trim() || undefined,
    },
    issues,
  };
}
