import { evaluateVideoNarrativeGeminiAllowlist } from "./videoNarrativeGeminiAllowlist";

describe("videoNarrativeGeminiAllowlist", () => {
  const enabledEnv = { VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1" };

  it("permite admin/dev", () => {
    expect(evaluateVideoNarrativeGeminiAllowlist({ user: { id: "u1", role: "admin" }, env: enabledEnv }).ok).toBe(true);
    expect(evaluateVideoNarrativeGeminiAllowlist({ user: { id: "u2", isDev: true }, env: enabledEnv }).ok).toBe(true);
  });

  it("permite email allowlist", () => {
    const result = evaluateVideoNarrativeGeminiAllowlist({
      user: { email: "creator@example.com" },
      env: {
        ...enabledEnv,
        VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "creator@example.com",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("permite userId allowlist", () => {
    const result = evaluateVideoNarrativeGeminiAllowlist({
      user: { id: "usr_allowed" },
      env: {
        ...enabledEnv,
        VIDEO_NARRATIVE_GEMINI_ALLOWED_USER_IDS: "usr_allowed",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("bloqueia usuário comum", () => {
    const result = evaluateVideoNarrativeGeminiAllowlist({ user: { id: "usr_common" }, env: enabledEnv });
    expect(result.ok).toBe(false);
  });

  it("erro não expõe allowlist", () => {
    const result = evaluateVideoNarrativeGeminiAllowlist({
      user: { id: "usr_common" },
      env: {
        ...enabledEnv,
        VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "sensitive@example.com",
        VIDEO_NARRATIVE_GEMINI_ALLOWED_USER_IDS: "usr_sensitive",
      },
    });
    expect(JSON.stringify(result)).not.toContain("sensitive@example.com");
    expect(JSON.stringify(result)).not.toContain("usr_sensitive");
  });
});
