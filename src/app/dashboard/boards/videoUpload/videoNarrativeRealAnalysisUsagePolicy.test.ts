import {
  evaluateVideoNarrativeRealAnalysisUsagePolicy,
  getVideoNarrativeRealAnalysisUsagePolicy,
  resolveVideoNarrativeRealAnalysisUsageTier,
} from "./videoNarrativeRealAnalysisUsagePolicy";

const betaEnv = {
  VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "creator@example.com",
  VIDEO_NARRATIVE_GEMINI_ALLOWED_USER_IDS: "user_allowlisted",
};

describe("videoNarrativeRealAnalysisUsagePolicy", () => {
  it("anonymous não pode rodar", () => {
    const decision = evaluateVideoNarrativeRealAnalysisUsagePolicy({ user: null, env: betaEnv });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("beta_access_required");
  });

  it("free não pode rodar por default no beta", () => {
    const decision = evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: { id: "user_free", email: "free@example.com", role: "user", planStatus: "inactive" },
      env: betaEnv,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.tier).toBe("free");
  });

  it("premium não pode rodar sem allowlist por default", () => {
    const decision = evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: { id: "user_premium", email: "premium@example.com", role: "user", planStatus: "active" },
      env: betaEnv,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.tier).toBe("premium");
      expect(decision.code).toBe("beta_access_required");
    }
  });

  it("allowlist pode rodar com limite baixo", () => {
    const tier = resolveVideoNarrativeRealAnalysisUsageTier({
      user: { id: "user_allowlisted", email: "creator@example.com", role: "user", planStatus: "inactive" },
      env: betaEnv,
    });
    const policy = getVideoNarrativeRealAnalysisUsagePolicy({ tier, env: betaEnv });

    expect(tier).toBe("allowlist");
    expect(policy.allowRealAnalysis).toBe(true);
    expect(policy.dailyLimit).toBe(5);
    expect(policy.monthlyLimit).toBe(20);
  });

  it("admin/dev pode rodar com limite maior", () => {
    const tier = resolveVideoNarrativeRealAnalysisUsageTier({
      user: { id: "admin_user", email: "admin@example.com", role: "admin", planStatus: "inactive" },
      env: betaEnv,
    });
    const policy = getVideoNarrativeRealAnalysisUsagePolicy({ tier, env: betaEnv });

    expect(tier).toBe("admin_dev");
    expect(policy.dailyLimit).toBe(20);
    expect(policy.monthlyLimit).toBe(100);
  });

  it("flag allowPremiumBeta libera premium", () => {
    const decision = evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: { id: "user_premium", email: "premium@example.com", role: "user", planStatus: "active" },
      env: { ...betaEnv, VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA: "true" },
      usage: { dailyCount: 0, monthlyCount: 0 },
    });

    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.tier).toBe("premium");
  });

  it("cooldown bloqueia chamadas repetidas", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    const decision = evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: { id: "admin_user", email: "admin@example.com", role: "admin" },
      env: betaEnv,
      now,
      usage: { dailyCount: 0, monthlyCount: 0, lastAttemptAt: "2026-05-20T11:59:50.000Z" },
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("usage_cooldown_active");
  });

  it("limites diário e mensal bloqueiam antes do provider", () => {
    const daily = evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: { id: "user_allowlisted", email: "creator@example.com", role: "user" },
      env: betaEnv,
      usage: { dailyCount: 5, monthlyCount: 5 },
    });
    const monthly = evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: { id: "user_allowlisted", email: "creator@example.com", role: "user" },
      env: betaEnv,
      usage: { dailyCount: 0, monthlyCount: 20 },
    });

    expect(daily.ok).toBe(false);
    if (!daily.ok) expect(daily.code).toBe("daily_limit_reached");
    expect(monthly.ok).toBe(false);
    if (!monthly.ok) expect(monthly.code).toBe("monthly_limit_reached");
  });
});
