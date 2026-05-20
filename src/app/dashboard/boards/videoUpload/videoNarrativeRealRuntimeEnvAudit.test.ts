import { performVideoNarrativeRealRuntimeEnvAudit } from "./videoNarrativeRealRuntimeEnvAudit";

describe("videoNarrativeRealRuntimeEnvAudit", () => {
  it("Retorna missing API key sem expor valor", () => {
    const env = {
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.geminiApiKeyPresent).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "gemini_api_key_missing" })
    );
    // Assegura que nenhum valor de variável é exposto nas mensagens
    expect(JSON.stringify(result)).not.toContain("test@example.com");
  });

  it("Retorna provider disabled", () => {
    const env = {
      GEMINI_API_KEY: "secret",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "false",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.geminiProviderEnabled).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "gemini_provider_disabled" })
    );
  });

  it("Retorna real analysis disabled", () => {
    const env = {
      GEMINI_API_KEY: "secret",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "false",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.realAnalysisEnabled).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "real_analysis_disabled" })
    );
  });

  it("Retorna storage provider missing", () => {
    const env = {
      GEMINI_API_KEY: "secret",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "disabled",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.storageProvider).toBe("disabled");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "storage_provider_missing" })
    );
  });

  it("Retorna allowlist missing", () => {
    const env = {
      GEMINI_API_KEY: "secret",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "false",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.allowlistConfigured).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "allowlist_missing" })
    );
  });

  it("Retorna storage credentials missing", () => {
    const env = {
      GEMINI_API_KEY: "secret",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
      // Faltam as keys
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.storageCredentialsPresent).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "storage_credentials_missing" })
    );
  });

  it("Retorna ready quando env fake está completa", () => {
    const env = {
      GEMINI_API_KEY: "fake-secret-key-123",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
      VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "fake-bucket",
      VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID: "fake-key",
      VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY: "fake-secret",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(true);
    expect(result.flags.betaLimitsEnabled).toBe(true);
    expect(result.issues).toHaveLength(2);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "env_ready_for_smoke" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "storage_runtime_resolver_ready" }));
  });

  it("Não retorna nenhum secret", () => {
    const secretKey = "super-secret-api-key-that-should-never-leak";
    const env = {
      GEMINI_API_KEY: secretKey,
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    const jsonStr = JSON.stringify(result);
    expect(jsonStr).not.toContain(secretKey);
  });

  it("Retorna beta limits disabled quando proteção de custo falta", () => {
    const env = {
      GEMINI_API_KEY: "secret",
      VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "true",
      VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "test@example.com",
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
      VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "fake-bucket",
      VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID: "fake-key",
      VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY: "fake-secret",
    };
    const result = performVideoNarrativeRealRuntimeEnvAudit(env);
    expect(result.ok).toBe(false);
    expect(result.flags.betaLimitsEnabled).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "beta_limits_disabled" }));
  });
});
