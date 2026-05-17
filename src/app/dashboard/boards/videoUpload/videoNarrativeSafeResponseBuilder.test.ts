import fs from "fs";
import path from "path";

import {
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  summarizeVideoNarrativeGuardResults,
} from "./videoNarrativeGuardContracts";
import {
  buildBlockedVideoNarrativeSafeResponse,
  buildVideoNarrativeSafeResponse,
  redactVideoNarrativeSafeResponse,
  sanitizeVideoNarrativeSafeResponseText,
  validateVideoNarrativeSafeResponse,
  type VideoNarrativeSafeIssue,
  type VideoNarrativeSafeResponse,
} from "./videoNarrativeSafeResponseBuilder";
import { createEmptyVideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import { createEmptyPostCreationVideoSeed } from "./videoNarrativePostCreationSeed";
import type {
  VideoNarrativeQuotaGuardResult,
  VideoNarrativeUsageConsumptionDecision,
} from "./videoNarrativeUsageQuotaGuards";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeSafeResponseBuilder.ts");
const CREATED_AT = "2026-05-17T12:00:00.000Z";

function createAnalysis() {
  return {
    ...createEmptyVideoNarrativeAnalysis({ id: "analysis-1", createdAt: CREATED_AT }),
    summary: "Vídeo com narrativa clara.",
    blueprintSuggestion: {
      whatToPost: "Transformar em pauta.",
      whyThisPath: "Há um caminho narrativo.",
      howItShouldWork: "Abrir com contexto.",
      scenes: ["Cena inicial."],
    },
  };
}

function createSeed() {
  return {
    ...createEmptyPostCreationVideoSeed({
      id: "seed-1",
      analysisId: "analysis-1",
      createdAt: CREATED_AT,
    }),
    initialIdea: "Criar uma pauta a partir do vídeo.",
  };
}

function createBlockedSummary() {
  return summarizeVideoNarrativeGuardResults([
    createPassedVideoNarrativeGuardResult("method"),
    createBlockedVideoNarrativeGuardResult({
      name: "usage_quota",
      code: "quota_exceeded",
      message: "Limite mensal atingido.",
    }),
  ]);
}

function createUsageDecision(): VideoNarrativeUsageConsumptionDecision {
  return {
    shouldConsumeQuota: true,
    reason: "useful_analysis",
    issues: [],
    guardResult: createPassedVideoNarrativeGuardResult("usage_consumption"),
  };
}

function createQuotaGuard(): VideoNarrativeQuotaGuardResult {
  return {
    ok: true,
    phase: "closed_beta",
    issues: [],
    guardResult: createPassedVideoNarrativeGuardResult("usage_quota"),
    canAttemptAnalysis: true,
  };
}

describe("videoNarrativeSafeResponseBuilder", () => {
  it("retorna ready quando analysis e seed existem", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: createAnalysis(),
      seed: createSeed(),
      primaryAction: "Transformar em roteiro.",
    });

    expect(response).toMatchObject({
      ok: true,
      status: "ready",
      hasRawText: false,
      primaryAction: "Transformar em roteiro.",
    });
    expect(response.analysis?.id).toBe("analysis-1");
    expect(response.seed?.id).toBe("seed-1");
  });

  it("retorna blocked quando guardSummary tem blockedBy", () => {
    const response = buildVideoNarrativeSafeResponse({
      guardSummary: createBlockedSummary(),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe("blocked");
    expect(response.guardSummary?.blockedBy).toBe("usage_quota");
  });

  it("retorna failed quando há issue blocking sem analysis/seed", () => {
    const response = buildVideoNarrativeSafeResponse({
      issues: [{ code: "provider_unavailable", message: "Provider não disponível.", severity: "blocking" }],
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe("failed");
  });

  it("buildBlockedVideoNarrativeSafeResponse cria response blocked seguro", () => {
    const response = buildBlockedVideoNarrativeSafeResponse({
      issues: [{ code: "usage_limited", message: "Uso não disponível.", severity: "blocking" }],
      guardSummary: createBlockedSummary(),
    });

    expect(response).toMatchObject({
      ok: false,
      status: "blocked",
      analysis: null,
      seed: null,
    });
  });

  it("response nunca inclui rawText, apenas hasRawText", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: createAnalysis(),
      seed: createSeed(),
      hasRawText: true,
    });

    expect(JSON.stringify(response)).not.toContain("rawText");
    expect(response.hasRawText).toBe(true);
  });

  it("guardSummary é reduzido para shape seguro", () => {
    const response = buildVideoNarrativeSafeResponse({
      guardSummary: createBlockedSummary(),
    });

    expect(response.guardSummary).toMatchObject({
      canCallProvider: false,
      canConsumeQuota: false,
      blockedBy: "usage_quota",
    });
    expect(response.guardSummary?.results[0]).toEqual({
      name: "method",
      status: "passed",
      code: null,
      severity: "info",
      message: "Método validado.",
    });
  });

  it("usageSummary inclui shouldConsumeQuota/reason/quotaGuardOk", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: createAnalysis(),
      usageDecision: createUsageDecision(),
      quotaGuard: createQuotaGuard(),
    });

    expect(response.usageSummary).toEqual({
      shouldConsumeQuota: true,
      reason: "useful_analysis",
      quotaGuardOk: true,
    });
  });

  it("observabilitySummary inclui apenas requestId e eventos mínimos", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: createAnalysis(),
      observabilityEvents: [
        {
          requestId: "req-1",
          eventName: "video_narrative_analysis_started",
          status: "started",
          source: "internal_endpoint",
          createdAt: CREATED_AT,
          providerStatus: "provider_unavailable",
        },
      ],
    });

    expect(response.observabilitySummary).toEqual({
      requestId: "req-1",
      events: [
        {
          eventName: "video_narrative_analysis_started",
          status: "started",
          source: "internal_endpoint",
          createdAt: CREATED_AT,
        },
      ],
    });
    expect(JSON.stringify(response.observabilitySummary)).not.toContain("providerStatus");
  });

  it("observabilitySummary redige payload antes de resumir", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: createAnalysis(),
      observabilityEvents: [
        {
          requestId: "AIza1234567890abcdefghi",
          eventName: "video_narrative_analysis_started",
          status: "started",
          source: "internal_endpoint",
          createdAt: CREATED_AT,
        },
      ],
    });

    expect(response.observabilitySummary?.requestId).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeSafeResponseText redige AIza, GEMINI_API_KEY e GOOGLE_GENAI_API_KEY", () => {
    expect(
      sanitizeVideoNarrativeSafeResponseText(
        "AIza1234567890abcdefghi GEMINI_API_KEY=abc GOOGLE_GENAI_API_KEY=def",
      ),
    ).toBe("[redigido] [redigido] [redigido]");
  });

  it("sanitizeVideoNarrativeSafeResponseText redige base64 longo", () => {
    expect(sanitizeVideoNarrativeSafeResponseText("a".repeat(140))).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeSafeResponseText redige URL assinada com token", () => {
    expect(
      sanitizeVideoNarrativeSafeResponseText("https://cdn.example/video.mp4?token=abc123"),
    ).toBe("[redigido]");
  });

  it("redactVideoNarrativeSafeResponse redige strings perigosas dentro de analysis", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: {
        ...createAnalysis(),
        summary: "GEMINI_API_KEY=abc",
      },
    });

    expect(response.analysis?.summary).toBe("[redigido]");
  });

  it("redactVideoNarrativeSafeResponse redige strings perigosas dentro de seed", () => {
    const response = buildVideoNarrativeSafeResponse({
      seed: {
        ...createSeed(),
        initialIdea: "https://cdn.example/video.mp4?token=abc123",
      },
    });

    expect(response.seed?.initialIdea).toBe("[redigido]");
  });

  it("validateVideoNarrativeSafeResponse aceita response seguro", () => {
    const response = buildVideoNarrativeSafeResponse({
      analysis: createAnalysis(),
      seed: createSeed(),
    });

    expect(validateVideoNarrativeSafeResponse(response).ok).toBe(true);
  });

  it("validateVideoNarrativeSafeResponse rejeita rawText em qualquer nível", () => {
    const response = {
      ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
      analysis: { ...createAnalysis(), rawText: "texto completo" },
    };

    expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
      "unsafe_response",
    );
  });

  it("validateVideoNarrativeSafeResponse rejeita inlineVideoBase64/base64 em qualquer nível", () => {
    ["inlineVideoBase64", "base64"].forEach((key) => {
      const response = {
        ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
        analysis: { ...createAnalysis(), [key]: "a".repeat(140) },
      };

      expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
        "unsafe_response",
      );
    });
  });

  it("validateVideoNarrativeSafeResponse rejeita apiKey/GEMINI_API_KEY/GOOGLE_GENAI_API_KEY em qualquer nível", () => {
    ["apiKey", "GEMINI_API_KEY", "GOOGLE_GENAI_API_KEY"].forEach((key) => {
      const response = {
        ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
        analysis: { ...createAnalysis(), [key]: "valor" },
      };

      expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
        "unsafe_response",
      );
    });
  });

  it("validateVideoNarrativeSafeResponse rejeita signedUrl/videoUrl em qualquer nível", () => {
    ["signedUrl", "videoUrl"].forEach((key) => {
      const response = {
        ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
        analysis: { ...createAnalysis(), [key]: "https://cdn.example/video.mp4?token=abc123" },
      };

      expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
        "unsafe_response",
      );
    });
  });

  it("validateVideoNarrativeSafeResponse rejeita status desconhecido", () => {
    const response = {
      ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
      status: "outro",
    };

    expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
      "invalid_status",
    );
  });

  it("validateVideoNarrativeSafeResponse rejeita issue sem code/message", () => {
    const response = {
      ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
      issues: [{ code: "x" }],
    };

    expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
      "invalid_issue",
    );
  });

  it("validateVideoNarrativeSafeResponse rejeita string com API key", () => {
    const response = {
      ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
      primaryAction: "AIza1234567890abcdefghi",
    };

    expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
      "unsafe_response",
    );
  });

  it("validateVideoNarrativeSafeResponse rejeita base64 longo", () => {
    const response = {
      ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
      primaryAction: "a".repeat(140),
    };

    expect(validateVideoNarrativeSafeResponse(response).issues.map((issue) => issue.code)).toContain(
      "unsafe_response",
    );
  });

  it("redactVideoNarrativeSafeResponse substitui chave perigosa sem quebrar shape", () => {
    const response = {
      ...buildVideoNarrativeSafeResponse({ analysis: createAnalysis() }),
      analysis: { ...createAnalysis(), apiKey: "secret" },
    } as unknown as VideoNarrativeSafeResponse;

    expect(
      JSON.stringify(redactVideoNarrativeSafeResponse(response)),
    ).toContain("[redigido]");
  });

  it("mantém linguagem segura em mensagens e defaults", () => {
    const unsafeIssue: VideoNarrativeSafeIssue = {
      code: "unsafe",
      message:
        "garantido certeza comprovado viralizar garantido score nota pontuação acerto gabarito resposta correta venceu perdeu treinado permanentemente",
      severity: "blocking",
    };
    const outputs = [
      buildBlockedVideoNarrativeSafeResponse({ issues: [unsafeIssue] }).issues.map((issue) => issue.message),
      sanitizeVideoNarrativeSafeResponseText(unsafeIssue.message),
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
