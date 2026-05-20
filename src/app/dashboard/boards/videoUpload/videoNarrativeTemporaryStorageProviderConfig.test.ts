import { resolveTemporaryStorageProviderConfig } from "./videoNarrativeTemporaryStorageProviderConfig";

describe("videoNarrativeTemporaryStorageProviderConfig", () => {
  it("returns disabled/none by default and does not allow real upload", () => {
    const result = resolveTemporaryStorageProviderConfig({ env: {} });

    expect(result.config.mode).toBe("disabled");
    expect(result.config.providerName).toBe("none");
    expect(result.config.realUploadEnabled).toBe(false);
    expect(result.config.uploadSessionEnabled).toBe(false);
  });

  it("reads VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1" },
    });

    expect(result.config.uploadSessionEnabled).toBe(true);
  });

  it("reads VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB: "50" },
    });

    expect(result.config.maxFileSizeBytes).toBe(50 * 1024 * 1024);
  });

  it("reads retention TTL and signed URL TTL", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES: "30",
        VIDEO_NARRATIVE_TEMP_SIGNED_URL_TTL_SECONDS: "120",
      },
    });

    expect(result.config.retentionTtlMinutes).toBe(30);
    expect(result.config.signedUrlTtlSeconds).toBe(120);
  });

  it("rejects absurd retention TTL", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES: "99999" },
    });

    expect(result.config.retentionTtlMinutes).toBe(60);
    expect(result.issues.some((issue) => issue.code === "invalid_retention_ttl_minutes")).toBe(true);
  });

  it("rejects absurd max MB", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB: "99999" },
    });

    expect(result.config.maxFileSizeBytes).toBe(100 * 1024 * 1024);
    expect(result.issues.some((issue) => issue.code === "invalid_max_upload_mb")).toBe(true);
  });

  it("does not expose secrets from env", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: {
        VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY: "secret",
        VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID: "access",
      },
    });

    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("access");
  });

  it("returns blocker when real upload is enabled", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true" },
    });

    expect(result.config.realUploadEnabled).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "real_upload_not_supported_in_this_build",
        severity: "blocker",
      }),
    );
  });

  it("returns warning when planned provider is configured without real upload", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2" },
    });

    expect(result.config.mode).toBe("r2_planned");
    expect(result.config.providerName).toBe("cloudflare_r2");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "planned_provider_configured_without_real_upload",
        severity: "warning",
      }),
    );
  });

  it("resolves mock/local_mock provider mode", () => {
    const result = resolveTemporaryStorageProviderConfig({
      env: { VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "local_mock" },
    });

    expect(result.config.mode).toBe("mock");
    expect(result.config.providerName).toBe("local_mock");
  });
});
