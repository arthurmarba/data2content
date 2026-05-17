import fs from "fs";
import path from "path";

import {
  buildVideoNarrativeUsageConsumptionGuardResult,
  buildVideoNarrativeUsageQuotaGuardResult,
  decideVideoNarrativeUsageConsumption,
  getVideoNarrativeUsagePolicy,
  isVideoNarrativeCooldownActive,
  sanitizeVideoNarrativeUsageMessage,
  validateVideoNarrativeUsageQuotaForPhase,
  type VideoNarrativeUsageIssue,
} from "./videoNarrativeUsageQuotaGuards";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeUsageQuotaGuards.ts");
const NOW = "2026-05-17T12:00:00.000Z";
const FUTURE = "2026-05-17T12:30:00.000Z";
const PAST = "2026-05-17T11:59:00.000Z";

function issueCodes(result: { issues: VideoNarrativeUsageIssue[] }): string[] {
  return result.issues.map((issue) => issue.code);
}

describe("videoNarrativeUsageQuotaGuards", () => {
  it("retorna manual_real_test sem limites", () => {
    expect(getVideoNarrativeUsagePolicy("manual_real_test")).toMatchObject({
      monthlyLimit: null,
      dailyLimit: null,
      allowAdminBypass: true,
    });
  });

  it("retorna internal_endpoint com dailyLimit 20", () => {
    expect(getVideoNarrativeUsagePolicy("internal_endpoint")).toMatchObject({
      monthlyLimit: null,
      dailyLimit: 20,
      allowAdminBypass: true,
    });
  });

  it("retorna closed_beta com monthlyLimit 5 e dailyLimit 3", () => {
    expect(getVideoNarrativeUsagePolicy("closed_beta")).toMatchObject({
      monthlyLimit: 5,
      dailyLimit: 3,
      allowAdminBypass: false,
    });
  });

  it("retorna production com monthlyLimit 5 e dailyLimit 3", () => {
    expect(getVideoNarrativeUsagePolicy("production")).toMatchObject({
      monthlyLimit: 5,
      dailyLimit: 3,
      allowAdminBypass: false,
    });
  });

  it("manual_real_test permite análise sem usageState", () => {
    expect(validateVideoNarrativeUsageQuotaForPhase({ phase: "manual_real_test" })).toMatchObject({
      ok: true,
      canAttemptAnalysis: true,
    });
  });

  it("internal_endpoint bloqueia quando usedToday >= 20 sem admin/dev", () => {
    const result = validateVideoNarrativeUsageQuotaForPhase({
      phase: "internal_endpoint",
      usageState: { usedToday: 20 },
    });

    expect(result.canAttemptAnalysis).toBe(false);
    expect(issueCodes(result)).toContain("daily_limit_exceeded");
  });

  it("internal_endpoint permite bypass admin/dev", () => {
    const result = validateVideoNarrativeUsageQuotaForPhase({
      phase: "internal_endpoint",
      usageState: { usedToday: 20, isAdminOrDev: true },
    });

    expect(result.canAttemptAnalysis).toBe(true);
  });

  it("closed_beta bloqueia quando usedThisMonth >= 5", () => {
    expect(
      issueCodes(
        validateVideoNarrativeUsageQuotaForPhase({
          phase: "closed_beta",
          usageState: { usedThisMonth: 5 },
        }),
      ),
    ).toContain("quota_exceeded");
  });

  it("production bloqueia quando usedThisMonth >= 5", () => {
    expect(
      issueCodes(
        validateVideoNarrativeUsageQuotaForPhase({
          phase: "production",
          usageState: { usedThisMonth: 5 },
        }),
      ),
    ).toContain("quota_exceeded");
  });

  it("closed_beta bloqueia quando usedToday >= 3", () => {
    expect(
      issueCodes(
        validateVideoNarrativeUsageQuotaForPhase({
          phase: "closed_beta",
          usageState: { usedToday: 3 },
        }),
      ),
    ).toContain("daily_limit_exceeded");
  });

  it("cooldown ativo bloqueia usage guard", () => {
    expect(
      issueCodes(
        validateVideoNarrativeUsageQuotaForPhase({
          phase: "closed_beta",
          usageState: { cooldownUntil: FUTURE, now: NOW },
        }),
      ),
    ).toContain("cooldown_active");
  });

  it("cooldown expirado não bloqueia", () => {
    expect(
      validateVideoNarrativeUsageQuotaForPhase({
        phase: "closed_beta",
        usageState: { cooldownUntil: PAST, now: NOW },
      }).canAttemptAnalysis,
    ).toBe(true);
  });

  it("isVideoNarrativeCooldownActive funciona com now fixo", () => {
    expect(isVideoNarrativeCooldownActive({ cooldownUntil: FUTURE, now: NOW })).toBe(true);
    expect(isVideoNarrativeCooldownActive({ cooldownUntil: PAST, now: NOW })).toBe(false);
  });

  it("usageState com datas inválidas não quebra", () => {
    const result = validateVideoNarrativeUsageQuotaForPhase({
      phase: "closed_beta",
      usageState: { cooldownUntil: "sem-data", now: "tambem-sem-data" },
    });

    expect(result.canAttemptAnalysis).toBe(true);
    expect(issueCodes(result)).toContain("usage_state_invalid");
  });

  it("não consome se failedBeforeProvider", () => {
    const decision = decideVideoNarrativeUsageConsumption({
      phase: "closed_beta",
      failedBeforeProvider: true,
    });

    expect(decision).toMatchObject({ shouldConsumeQuota: false, reason: "failed_before_provider" });
  });

  it("não consome se payloadWasInvalid", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        payloadWasInvalid: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "payload_invalid" });
  });

  it("não consome se consentWasMissing", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        consentWasMissing: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "consent_missing" });
  });

  it("não consome se retentionWasExpired", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        retentionWasExpired: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "retention_expired" });
  });

  it("não consome se providerWasCalled false", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        providerWasCalled: false,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "provider_not_called" });
  });

  it("não consome em provider failure", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        providerWasCalled: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "provider_failure" });
  });

  it("não consome em fallback only", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        providerWasCalled: true,
        usedFallbackOnly: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "fallback_only" });
  });

  it("consome em useful_analysis", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        providerWasCalled: true,
        providerReturnedUsefulAnalysis: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: true, reason: "useful_analysis" });
  });

  it("consome em useful_partial_analysis quando política permite", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        providerWasCalled: true,
        providerReturnedUsefulPartialAnalysis: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: true, reason: "useful_partial_analysis" });
  });

  it("não consome manual retry em internal_endpoint com allowRetryWithoutConsumption", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "internal_endpoint",
        providerWasCalled: true,
        providerReturnedUsefulAnalysis: true,
        userRequestedManualRetry: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "manual_retry" });
  });

  it("consome manual retry em closed_beta quando houve análise útil", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        providerWasCalled: true,
        providerReturnedUsefulAnalysis: true,
        userRequestedManualRetry: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: true, reason: "manual_retry" });
  });

  it("não consome para admin/dev bypass em internal_endpoint", () => {
    expect(
      decideVideoNarrativeUsageConsumption({
        phase: "internal_endpoint",
        usageState: { isAdminOrDev: true },
        providerWasCalled: true,
        providerReturnedUsefulAnalysis: true,
      }),
    ).toMatchObject({ shouldConsumeQuota: false, reason: "admin_bypass" });
  });

  it("buildVideoNarrativeUsageQuotaGuardResult cria passed guard quando ok", () => {
    expect(buildVideoNarrativeUsageQuotaGuardResult({ ok: true, phase: "closed_beta" }).guardResult).toMatchObject({
      name: "usage_quota",
      status: "passed",
      code: null,
    });
  });

  it("buildVideoNarrativeUsageQuotaGuardResult cria blocked guard quando limite", () => {
    const issue: VideoNarrativeUsageIssue = {
      code: "quota_exceeded",
      message: "Limite mensal atingido.",
    };

    expect(
      buildVideoNarrativeUsageQuotaGuardResult({
        ok: false,
        phase: "closed_beta",
        issues: [issue],
      }).guardResult,
    ).toMatchObject({
      name: "usage_quota",
      status: "blocked",
      shouldCallProvider: false,
    });
  });

  it("buildVideoNarrativeUsageConsumptionGuardResult cria passed guard para consumo calculado", () => {
    expect(
      buildVideoNarrativeUsageConsumptionGuardResult({
        shouldConsumeQuota: false,
        reason: "provider_not_called",
      }),
    ).toMatchObject({
      name: "usage_consumption",
      status: "passed",
    });
  });

  it("buildVideoNarrativeUsageConsumptionGuardResult bloqueia quota_blocked/cooldown_active", () => {
    expect(
      buildVideoNarrativeUsageConsumptionGuardResult({
        shouldConsumeQuota: false,
        reason: "quota_blocked",
      }).status,
    ).toBe("blocked");
    expect(
      buildVideoNarrativeUsageConsumptionGuardResult({
        shouldConsumeQuota: false,
        reason: "cooldown_active",
      }).code,
    ).toBe("cooldown_active");
  });

  it("redige AIza, GEMINI_API_KEY, GOOGLE_GENAI_API_KEY e base64 longo", () => {
    expect(
      sanitizeVideoNarrativeUsageMessage(
        `AIza1234567890abcdefghi GEMINI_API_KEY=abc GOOGLE_GENAI_API_KEY=def ${"a".repeat(140)}`,
      ),
    ).toBe("[redigido] [redigido] [redigido] [redigido]");
  });

  it("mantém linguagem segura em mensagens e defaults", () => {
    const outputs = [
      validateVideoNarrativeUsageQuotaForPhase({
        phase: "closed_beta",
        usageState: { usedThisMonth: 5, cooldownUntil: FUTURE, now: NOW },
      }).issues.map((issue) => issue.message),
      decideVideoNarrativeUsageConsumption({
        phase: "closed_beta",
        payloadWasInvalid: true,
      }).issues.map((issue) => issue.message),
      sanitizeVideoNarrativeUsageMessage(
        "garantido certeza comprovado viralizar garantido score nota pontuação acerto gabarito resposta correta venceu perdeu treinado permanentemente",
      ),
    ]
      .flat()
      .join(" ")
      .toLowerCase();

    [
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "score",
      "nota",
      "pontuação",
      "acerto",
      "gabarito",
      "resposta correta",
      "venceu",
      "perdeu",
      "treinado permanentemente",
    ].forEach((term) => {
      expect(outputs).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("mantém o contrato puro sem imports proibidos", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");
    const forbiddenImports = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "componentes",
      "hooks",
      "endpoint",
      "upload service",
      "storage provider",
      "analytics provider",
      "ffmpeg",
      "UI",
      "Stripe",
      "billing",
      "@google/genai",
    ];

    forbiddenImports.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });

  it("confirma que a rota futura ainda não existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(false);
  });
});
