import { evaluateVideoNarrativeClosedBetaReadiness } from "./videoNarrativeClosedBetaReadiness";

const readyEnv = {
  GEMINI_API_KEY: "fake-secret-key",
  VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
  VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "creator@example.com",
  VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "1",
  NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "1",
  VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
  VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS: "creator@example.com",
  VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
  VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "bucket",
  VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID: "fake-key",
  VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY: "fake-secret",
  VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
};

const allowlistUser = {
  id: "507f1f77bcf86cd799439011",
  email: "creator@example.com",
  role: "user",
  planStatus: "inactive",
};

const forbiddenTerms = [
  "score",
  "nota",
  "pontos",
  "ranking",
  "gabarito",
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "match real",
  "marca garantida",
  "patrocínio garantido",
  "vídeos salvos",
  "histórico de vídeos",
  "novo Mídia Kit",
  "Mídia Kit mobile",
  "18 sinais",
  "3 narrativas",
  "percentual de perfil",
];

describe("videoNarrativeClosedBetaReadiness", () => {
  it("beta disabled retorna beta_disabled", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: allowlistUser,
      env: { ...readyEnv, VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "0" },
    });

    expect(result.state).toBe("beta_disabled");
    expect(result.realAnalysisReady).toBe(false);
  });

  it("usuário comum retorna user_not_allowlisted", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: { ...allowlistUser, email: "common@example.com" },
      env: readyEnv,
    });

    expect(result.state).toBe("user_not_allowlisted");
    expect(result.betaAccessAllowed).toBe(false);
  });

  it("allowlist + env ready retorna beta_ready", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: allowlistUser,
      usage: { dailyCount: 0, monthlyCount: 0, lastAttemptAt: null },
      env: readyEnv,
    });

    expect(result.state).toBe("beta_ready");
    expect(result.realAnalysisReady).toBe(true);
    expect(result.betaAccessAllowed).toBe(true);
  });

  it("usage limit retorna usage_limit_reached", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: allowlistUser,
      usage: { dailyCount: 5, monthlyCount: 5, lastAttemptAt: null },
      env: readyEnv,
    });

    expect(result.state).toBe("usage_limit_reached");
    expect(result.issueCodes).toContain("usage_limit_reached");
  });

  it("storage issue retorna storage_not_ready", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: allowlistUser,
      env: { ...readyEnv, VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "" },
    });

    expect(result.state).toBe("storage_not_ready");
    expect(result.storageReady).toBe(false);
  });

  it("gemini issue retorna gemini_not_ready", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: allowlistUser,
      env: { ...readyEnv, GEMINI_API_KEY: "" },
    });

    expect(result.state).toBe("gemini_not_ready");
    expect(result.geminiReady).toBe(false);
  });

  it("rollback flag retorna rollback_enabled", () => {
    const result = evaluateVideoNarrativeClosedBetaReadiness({
      user: allowlistUser,
      env: { ...readyEnv, NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED: "0" },
    });

    expect(result.state).toBe("rollback_enabled");
    expect(result.rollbackActive).toBe(true);
  });

  it("mensagens não expõem secrets nem termos proibidos", () => {
    const results = [
      evaluateVideoNarrativeClosedBetaReadiness({ user: allowlistUser, env: readyEnv }),
      evaluateVideoNarrativeClosedBetaReadiness({ user: null, env: readyEnv }),
      evaluateVideoNarrativeClosedBetaReadiness({ user: allowlistUser, env: { ...readyEnv, GEMINI_API_KEY: "" } }),
    ];
    const text = JSON.stringify(results);

    expect(text).not.toMatch(/api[_ -]?key|secret|cfat_|AIza|uploadUrl|objectKey|signedUrl/i);
    for (const term of forbiddenTerms) {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
});
