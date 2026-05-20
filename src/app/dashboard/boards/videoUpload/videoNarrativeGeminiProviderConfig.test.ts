import { resolveVideoNarrativeGeminiProviderConfig } from "./videoNarrativeGeminiProviderConfig";

describe("videoNarrativeGeminiProviderConfig", () => {
  it("provider disabled por default", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({});
    expect(result.config.enabled).toBe(false);
    expect(result.issues.some((issue) => issue.code === "gemini_provider_disabled")).toBe(true);
  });

  it("bloqueia sem API key", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({
      VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
      VIDEO_NARRATIVE_GEMINI_MODEL: "model-a",
    });
    expect(result.issues.some((issue) => issue.code === "gemini_api_key_missing")).toBe(true);
  });

  it("bloqueia sem model env", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({
      VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
      GOOGLE_GEMINI_API_KEY: "secret-key",
    });
    expect(result.issues.some((issue) => issue.code === "gemini_model_missing")).toBe(true);
  });

  it("timeout default é seguro", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({});
    expect(result.config.timeoutMs).toBeGreaterThanOrEqual(1000);
    expect(result.config.timeoutMs).toBeLessThanOrEqual(30000);
  });

  it("max output tokens default é seguro", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({});
    expect(result.config.maxOutputTokens).toBeGreaterThanOrEqual(256);
    expect(result.config.maxOutputTokens).toBeLessThanOrEqual(4096);
  });

  it("não expõe API key em issues", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({
      VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
      GOOGLE_GEMINI_API_KEY: "super-secret-key",
    });
    expect(JSON.stringify(result.issues)).not.toContain("super-secret-key");
  });

  it("feature flag disabled bloqueia", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({
      VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "false",
      VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
      GOOGLE_GEMINI_API_KEY: "secret-key",
      VIDEO_NARRATIVE_GEMINI_MODEL: "model-a",
    });
    expect(result.config.enabled).toBe(false);
    expect(result.issues.some((issue) => issue.code === "gemini_provider_disabled")).toBe(true);
  });

  it("allowlist disabled impede real provider", () => {
    const result = resolveVideoNarrativeGeminiProviderConfig({
      VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
      GOOGLE_GEMINI_API_KEY: "secret-key",
      VIDEO_NARRATIVE_GEMINI_MODEL: "model-a",
    });
    expect(result.issues.some((issue) => issue.code === "gemini_allowlist_required")).toBe(true);
  });
});
