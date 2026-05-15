import { isGeminiVideoNarrativeEnabled } from "./geminiVideoNarrativeFeatureFlag";

const originalEnvValue = process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED;
    return;
  }

  process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED = originalEnvValue;
});

describe("geminiVideoNarrativeFeatureFlag", () => {
  it("returns false when the env flag is absent", () => {
    delete process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED;

    expect(isGeminiVideoNarrativeEnabled()).toBe(false);
  });

  it("returns false when the env flag is false", () => {
    process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED = "false";

    expect(isGeminiVideoNarrativeEnabled()).toBe(false);
  });

  it("returns true only when the env flag is true", () => {
    process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED = "true";

    expect(isGeminiVideoNarrativeEnabled()).toBe(true);
  });
});
