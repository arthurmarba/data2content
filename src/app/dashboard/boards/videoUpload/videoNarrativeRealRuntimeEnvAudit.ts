export type VideoNarrativeEnvAuditIssueCode =
  | "gemini_api_key_missing"
  | "gemini_provider_disabled"
  | "real_analysis_disabled"
  | "real_upload_disabled"
  | "signed_upload_allowlist_disabled"
  | "storage_provider_missing"
  | "storage_credentials_missing"
  | "storage_runtime_resolver_ready"
  | "allowlist_missing"
  | "env_ready_for_smoke";

export type VideoNarrativeEnvAuditIssue = {
  code: VideoNarrativeEnvAuditIssueCode;
  message: string;
};

export type VideoNarrativeEnvAuditResult = {
  ok: boolean;
  issues: VideoNarrativeEnvAuditIssue[];
  flags: {
    geminiApiKeyPresent: boolean;
    geminiProviderEnabled: boolean;
    realAnalysisEnabled: boolean;
    realUploadEnabled: boolean;
    signedUploadAllowlistEnabled: boolean;
    storageProvider: string;
    storageCredentialsPresent: boolean;
    allowlistConfigured: boolean;
  };
};

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function performVideoNarrativeRealRuntimeEnvAudit(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): VideoNarrativeEnvAuditResult {
  const issues: VideoNarrativeEnvAuditIssue[] = [];

  const geminiApiKeyPresent = !!(env.GEMINI_API_KEY?.trim() || env.GOOGLE_GENAI_API_KEY?.trim());
  const geminiProviderEnabled = parseBoolean(env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED);
  const realAnalysisEnabled = parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED);
  const realUploadEnabled = parseBoolean(env.VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED);
  const signedUploadAllowlistEnabled = parseBoolean(env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED);
  const geminiAllowlistEnabled = parseBoolean(env.VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED);
  
  const hasAllowedEmails = !!env.VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS?.trim();
  const hasAllowedUserIds = !!env.VIDEO_NARRATIVE_GEMINI_ALLOWED_USER_IDS?.trim();
  const allowlistConfigured = geminiAllowlistEnabled && (hasAllowedEmails || hasAllowedUserIds);

  const storageProvider = env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER?.trim() || "disabled";

  if (!geminiApiKeyPresent) {
    issues.push({
      code: "gemini_api_key_missing",
      message: "Chave da API do Gemini (GEMINI_API_KEY) não encontrada no ambiente.",
    });
  }

  if (!geminiProviderEnabled) {
    issues.push({
      code: "gemini_provider_disabled",
      message: "Provider do Gemini está desabilitado (VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED).",
    });
  }

  if (!realAnalysisEnabled) {
    issues.push({
      code: "real_analysis_disabled",
      message: "Análise real de vídeo está desabilitada (VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED).",
    });
  }

  if (!allowlistConfigured) {
    issues.push({
      code: "allowlist_missing",
      message: "Allowlist do Gemini não está configurada (VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED e/ou emails/ids).",
    });
  }

  if (!realUploadEnabled) {
    issues.push({
      code: "real_upload_disabled",
      message: "Upload real está desabilitado (VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED).",
    });
  }

  if (!signedUploadAllowlistEnabled) {
    issues.push({
      code: "signed_upload_allowlist_disabled",
      message: "Allowlist de signed upload está desabilitada (VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED).",
    });
  }

  if (storageProvider === "disabled" || storageProvider === "none") {
    issues.push({
      code: "storage_provider_missing",
      message: "Nenhum provider de storage real configurado (VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER).",
    });
  } else {
    const bucket = !!env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET?.trim();
    const accessKeyId = !!env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID?.trim();
    const secretAccessKey = !!env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY?.trim();

    if (!bucket || !accessKeyId || !secretAccessKey) {
      issues.push({
        code: "storage_credentials_missing",
        message: "Credenciais de storage incompletas (falta bucket ou access keys).",
      });
    } else {
      issues.push({
        code: "storage_runtime_resolver_ready",
        message: "Provider e credenciais de storage configurados e prontos.",
      });
    }
  }

  const ok = issues.filter(i => i.code !== "storage_runtime_resolver_ready").length === 0;

  if (ok) {
    issues.push({
      code: "env_ready_for_smoke",
      message: "O ambiente local está pronto para o teste (smoke harness) da análise real com Gemini.",
    });
  }

  return {
    ok,
    issues,
    flags: {
      geminiApiKeyPresent,
      geminiProviderEnabled,
      realAnalysisEnabled,
      realUploadEnabled,
      signedUploadAllowlistEnabled,
      storageProvider,
      storageCredentialsPresent: !!env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET?.trim() && !!env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID?.trim() && !!env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY?.trim(),
      allowlistConfigured,
    },
  };
}
