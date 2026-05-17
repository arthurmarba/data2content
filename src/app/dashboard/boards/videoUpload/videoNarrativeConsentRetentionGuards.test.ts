import fs from "fs";
import path from "path";

import {
  buildVideoNarrativeConsentGuardResult,
  buildVideoNarrativeRetentionGuardResult,
  canVideoNarrativeAdminBypassConsent,
  getVideoNarrativeConsentPolicy,
  getVideoNarrativeRetentionPolicy,
  isVideoNarrativeRetentionExpired,
  isVideoNarrativeRetentionWithinPolicy,
  requiresVideoNarrativeExpiresAt,
  requiresVideoNarrativeExplicitConsent,
  sanitizeVideoNarrativeConsentRetentionMessage,
  validateVideoNarrativeConsentRetentionForPhase,
  type VideoNarrativeConsentRetentionIssue,
  type VideoNarrativeConsentRetentionPhase,
} from "./videoNarrativeConsentRetentionGuards";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeConsentRetentionGuards.ts");
const NOW = "2026-05-17T12:00:00.000Z";
const WITHIN_24H = "2026-05-18T12:00:00.000Z";
const WITHIN_72H = "2026-05-20T12:00:00.000Z";
const OVER_72H = "2026-05-20T12:00:01.000Z";
const PAST = "2026-05-17T11:59:59.000Z";

function issueCodes(input: Parameters<typeof validateVideoNarrativeConsentRetentionForPhase>[0]): string[] {
  return validateVideoNarrativeConsentRetentionForPhase(input).issues.map((issue) => issue.code);
}

describe("videoNarrativeConsentRetentionGuards", () => {
  it("retorna política de consentimento de manual_real_test", () => {
    expect(getVideoNarrativeConsentPolicy("manual_real_test")).toEqual({
      phase: "manual_real_test",
      requiresExplicitConsent: false,
      allowAdminBypass: true,
      requiresConsentVersion: false,
      allowProfileSignalsPersistence: false,
    });
  });

  it("retorna política de consentimento de internal_endpoint", () => {
    expect(getVideoNarrativeConsentPolicy("internal_endpoint")).toEqual({
      phase: "internal_endpoint",
      requiresExplicitConsent: false,
      allowAdminBypass: true,
      requiresConsentVersion: false,
      allowProfileSignalsPersistence: false,
    });
  });

  it("retorna política de consentimento de closed_beta", () => {
    expect(getVideoNarrativeConsentPolicy("closed_beta")).toEqual({
      phase: "closed_beta",
      requiresExplicitConsent: true,
      allowAdminBypass: false,
      requiresConsentVersion: true,
      allowProfileSignalsPersistence: false,
    });
  });

  it("retorna política de consentimento de production", () => {
    expect(getVideoNarrativeConsentPolicy("production")).toEqual({
      phase: "production",
      requiresExplicitConsent: true,
      allowAdminBypass: false,
      requiresConsentVersion: true,
      allowProfileSignalsPersistence: false,
    });
  });

  it("retorna maxRetentionHours esperado por fase", () => {
    expect(getVideoNarrativeRetentionPolicy("manual_real_test").maxRetentionHours).toBeNull();
    expect(getVideoNarrativeRetentionPolicy("internal_endpoint").maxRetentionHours).toBe(72);
    expect(getVideoNarrativeRetentionPolicy("closed_beta").maxRetentionHours).toBe(72);
    expect(getVideoNarrativeRetentionPolicy("production").maxRetentionHours).toBe(72);
  });

  it("manual_real_test não exige consentimento explícito", () => {
    expect(requiresVideoNarrativeExplicitConsent("manual_real_test")).toBe(false);
  });

  it("closed_beta exige consentimento explícito", () => {
    expect(requiresVideoNarrativeExplicitConsent("closed_beta")).toBe(true);
  });

  it("production exige consentimento explícito", () => {
    expect(requiresVideoNarrativeExplicitConsent("production")).toBe(true);
  });

  it("internal_endpoint permite admin/dev sem consentimento explícito", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "internal_endpoint",
      isAdminOrDev: true,
      expiresAt: WITHIN_24H,
      now: NOW,
    });

    expect(canVideoNarrativeAdminBypassConsent("internal_endpoint")).toBe(true);
    expect(result.consentGuardResult.status).toBe("passed");
  });

  it("closed_beta sem consentimento bloqueia consent guard", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "closed_beta",
      hasExplicitConsent: false,
      consentVersion: "v1",
      expiresAt: WITHIN_24H,
      now: NOW,
    });

    expect(result.consentGuardResult).toMatchObject({
      name: "consent",
      status: "blocked",
      code: "consent_missing",
    });
    expect(result.issues.map((issue) => issue.code)).toContain("consent_missing");
  });

  it("production sem consentVersion bloqueia consent guard", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "production",
      hasExplicitConsent: true,
      expiresAt: WITHIN_24H,
      now: NOW,
    });

    expect(result.consentGuardResult.status).toBe("blocked");
    expect(result.issues.map((issue) => issue.code)).toContain("consent_version_missing");
  });

  it("closed_beta com consentimento e consentVersion passa consent guard", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "closed_beta",
      hasExplicitConsent: true,
      consentVersion: "v1",
      expiresAt: WITHIN_24H,
      now: NOW,
    });

    expect(result.consentGuardResult.status).toBe("passed");
  });

  it("fase que exige expiresAt sem expiresAt bloqueia retention guard", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "closed_beta",
      hasExplicitConsent: true,
      consentVersion: "v1",
      now: NOW,
    });

    expect(requiresVideoNarrativeExpiresAt("closed_beta")).toBe(true);
    expect(result.retentionGuardResult.status).toBe("blocked");
    expect(result.issues.map((issue) => issue.code)).toContain("expires_at_missing");
  });

  it("expiresAt no passado bloqueia retention guard", () => {
    expect(
      issueCodes({
        phase: "closed_beta",
        hasExplicitConsent: true,
        consentVersion: "v1",
        expiresAt: PAST,
        now: NOW,
      }),
    ).toContain("retention_expired");
  });

  it("expiresAt inválido bloqueia retention guard", () => {
    expect(
      issueCodes({
        phase: "closed_beta",
        hasExplicitConsent: true,
        consentVersion: "v1",
        expiresAt: "sem-data",
        now: NOW,
      }),
    ).toContain("invalid_date");
  });

  it("expiresAt além de maxRetentionHours bloqueia retention guard", () => {
    expect(
      issueCodes({
        phase: "production",
        hasExplicitConsent: true,
        consentVersion: "v1",
        expiresAt: OVER_72H,
        now: NOW,
      }),
    ).toContain("retention_exceeds_policy");
  });

  it("expiresAt dentro da política passa retention guard", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "production",
      hasExplicitConsent: true,
      consentVersion: "v1",
      expiresAt: WITHIN_72H,
      now: NOW,
    });

    expect(result.retentionGuardResult.status).toBe("passed");
  });

  it("isVideoNarrativeRetentionExpired funciona com now fixo", () => {
    expect(isVideoNarrativeRetentionExpired({ expiresAt: PAST, now: NOW })).toBe(true);
    expect(isVideoNarrativeRetentionExpired({ expiresAt: WITHIN_24H, now: NOW })).toBe(false);
  });

  it("isVideoNarrativeRetentionWithinPolicy funciona com maxRetentionHours null", () => {
    expect(
      isVideoNarrativeRetentionWithinPolicy({
        expiresAt: OVER_72H,
        now: NOW,
        maxRetentionHours: null,
      }),
    ).toBe(true);
  });

  it("wantsProfileSignalsPersistence true gera issue porque persistência ainda não é permitida", () => {
    expect(
      issueCodes({
        phase: "closed_beta",
        hasExplicitConsent: true,
        consentVersion: "v1",
        expiresAt: WITHIN_24H,
        now: NOW,
        wantsProfileSignalsPersistence: true,
      }),
    ).toContain("profile_signals_persistence_not_allowed");
  });

  it.each<VideoNarrativeConsentRetentionPhase>([
    "manual_real_test",
    "internal_endpoint",
    "closed_beta",
    "production",
  ])("canPersistProfileSignals false em %s", (phase) => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase,
      hasExplicitConsent: true,
      consentVersion: "v1",
      isAdminOrDev: true,
      expiresAt: phase === "manual_real_test" ? null : WITHIN_24H,
      now: NOW,
      wantsProfileSignalsPersistence: true,
    });

    expect(result.canPersistProfileSignals).toBe(false);
  });

  it("retorna ok true quando consent e retention passam", () => {
    const result = validateVideoNarrativeConsentRetentionForPhase({
      phase: "closed_beta",
      hasExplicitConsent: true,
      consentVersion: "v1",
      expiresAt: WITHIN_24H,
      now: NOW,
    });

    expect(result.ok).toBe(true);
  });

  it("retorna ok false quando consent falha", () => {
    expect(
      validateVideoNarrativeConsentRetentionForPhase({
        phase: "closed_beta",
        expiresAt: WITHIN_24H,
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("retorna ok false quando retention falha", () => {
    expect(
      validateVideoNarrativeConsentRetentionForPhase({
        phase: "closed_beta",
        hasExplicitConsent: true,
        consentVersion: "v1",
        expiresAt: PAST,
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("buildVideoNarrativeConsentGuardResult cria passed e blocked corretamente", () => {
    const issue: VideoNarrativeConsentRetentionIssue = {
      code: "consent_missing",
      message: "Consentimento não informado.",
    };

    expect(buildVideoNarrativeConsentGuardResult({ ok: true }).status).toBe("passed");
    expect(buildVideoNarrativeConsentGuardResult({ ok: false, issues: [issue] })).toMatchObject({
      name: "consent",
      status: "blocked",
      code: "consent_missing",
      shouldCallProvider: false,
      shouldConsumeQuota: false,
    });
  });

  it("buildVideoNarrativeRetentionGuardResult cria passed e blocked corretamente", () => {
    const issue: VideoNarrativeConsentRetentionIssue = {
      code: "retention_expired",
      message: "Arquivo temporário expirado.",
    };

    expect(buildVideoNarrativeRetentionGuardResult({ ok: true }).status).toBe("passed");
    expect(buildVideoNarrativeRetentionGuardResult({ ok: false, issues: [issue] })).toMatchObject({
      name: "retention",
      status: "blocked",
      code: "retention_expired",
      shouldCallProvider: false,
      shouldConsumeQuota: false,
    });
  });

  it("redige AIza, GEMINI_API_KEY, GOOGLE_GENAI_API_KEY e base64 longo", () => {
    expect(
      sanitizeVideoNarrativeConsentRetentionMessage(
        `AIza1234567890abcdefghi GEMINI_API_KEY=abc GOOGLE_GENAI_API_KEY=def ${"a".repeat(140)}`,
      ),
    ).toBe("[redigido] [redigido] [redigido] [redigido]");
  });

  it("mantém linguagem segura em mensagens e defaults", () => {
    const outputs = [
      buildVideoNarrativeConsentGuardResult({ ok: true }).message,
      buildVideoNarrativeRetentionGuardResult({ ok: true }).message,
      validateVideoNarrativeConsentRetentionForPhase({
        phase: "production",
        hasExplicitConsent: false,
        expiresAt: PAST,
        now: NOW,
        wantsProfileSignalsPersistence: true,
      }).issues.map((issue) => issue.message),
      sanitizeVideoNarrativeConsentRetentionMessage(
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

  it("confirma que a rota skeleton MM27 existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(true);
  });
});
