import fs from "fs";
import path from "path";

import {
  VIDEO_NARRATIVE_OBSERVABILITY_EVENT_NAMES,
  VIDEO_NARRATIVE_OBSERVABILITY_SOURCES,
  VIDEO_NARRATIVE_OBSERVABILITY_STATUSES,
  bucketVideoNarrativeDuration,
  bucketVideoNarrativeSize,
  buildVideoNarrativeObservabilityEvent,
  createVideoNarrativeRequestId,
  redactVideoNarrativeObservabilityPayload,
  sanitizeVideoNarrativeObservabilityText,
  validateVideoNarrativeObservabilityEvent,
  type VideoNarrativeObservabilityEventPayload,
} from "./videoNarrativeObservabilityEvents";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeObservabilityEvents.ts");
const CREATED_AT = "2026-05-17T12:00:00.000Z";
const MB = 1024 * 1024;

const validEvent: VideoNarrativeObservabilityEventPayload = {
  requestId: "req-1",
  eventName: "video_narrative_analysis_requested",
  status: "requested",
  source: "internal_endpoint",
  createdAt: CREATED_AT,
};

describe("videoNarrativeObservabilityEvents", () => {
  it("event names contêm os 9 eventos esperados", () => {
    expect(VIDEO_NARRATIVE_OBSERVABILITY_EVENT_NAMES).toEqual([
      "video_narrative_analysis_requested",
      "video_narrative_analysis_started",
      "video_narrative_analysis_completed",
      "video_narrative_analysis_failed",
      "video_narrative_analysis_fallback_used",
      "video_narrative_seed_created",
      "video_narrative_usage_consumed",
      "video_narrative_usage_not_consumed",
      "video_narrative_limit_reached",
    ]);
  });

  it("statuses contêm os statuses esperados", () => {
    expect(VIDEO_NARRATIVE_OBSERVABILITY_STATUSES).toEqual([
      "requested",
      "started",
      "completed",
      "failed",
      "blocked",
      "fallback",
      "consumed",
      "not_consumed",
    ]);
  });

  it("sources contêm as sources esperadas", () => {
    expect(VIDEO_NARRATIVE_OBSERVABILITY_SOURCES).toEqual([
      "manual_real_test",
      "internal_endpoint",
      "closed_beta",
      "production",
    ]);
  });

  it("createVideoNarrativeRequestId com prefix retorna id previsível", () => {
    expect(createVideoNarrativeRequestId("mm24")).toBe("mm24-video-narrative-request");
    expect(createVideoNarrativeRequestId()).toBe("video-narrative-request");
  });

  it("bucketVideoNarrativeDuration cobre null, negativo e faixas", () => {
    expect(bucketVideoNarrativeDuration()).toBeNull();
    expect(bucketVideoNarrativeDuration(-1)).toBeNull();
    expect(bucketVideoNarrativeDuration(15)).toBe("0-15s");
    expect(bucketVideoNarrativeDuration(30)).toBe("16-30s");
    expect(bucketVideoNarrativeDuration(60)).toBe("31-60s");
    expect(bucketVideoNarrativeDuration(120)).toBe("61-120s");
    expect(bucketVideoNarrativeDuration(121)).toBe("over-120s");
  });

  it("bucketVideoNarrativeSize cobre null, negativo e faixas", () => {
    expect(bucketVideoNarrativeSize()).toBeNull();
    expect(bucketVideoNarrativeSize(-1)).toBeNull();
    expect(bucketVideoNarrativeSize(10 * MB)).toBe("0-10mb");
    expect(bucketVideoNarrativeSize(50 * MB)).toBe("10-50mb");
    expect(bucketVideoNarrativeSize(100 * MB)).toBe("50-100mb");
    expect(bucketVideoNarrativeSize(101 * MB)).toBe("over-100mb");
  });

  it("buildVideoNarrativeObservabilityEvent cria evento requested válido", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-1",
      eventName: "video_narrative_analysis_requested",
      status: "requested",
      source: "internal_endpoint",
      createdAt: CREATED_AT,
    });

    expect(result.ok).toBe(true);
    expect(result.event).toMatchObject(validEvent);
  });

  it("buildVideoNarrativeObservabilityEvent cria evento completed com latencyMs, schemaParseOk e hasUsefulSeed", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-2",
      eventName: "video_narrative_analysis_completed",
      status: "completed",
      source: "closed_beta",
      createdAt: CREATED_AT,
      latencyMs: 1200,
      schemaParseOk: true,
      hasUsefulSeed: true,
    });

    expect(result.ok).toBe(true);
    expect(result.event).toMatchObject({
      latencyMs: 1200,
      schemaParseOk: true,
      hasUsefulSeed: true,
    });
  });

  it("buildVideoNarrativeObservabilityEvent cria evento failed com guardBlockedBy e providerStatus", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-3",
      eventName: "video_narrative_analysis_failed",
      status: "failed",
      source: "internal_endpoint",
      createdAt: CREATED_AT,
      guardBlockedBy: "usage_quota",
      providerStatus: "provider_unavailable",
    });

    expect(result.ok).toBe(true);
    expect(result.event).toMatchObject({
      guardBlockedBy: "usage_quota",
      providerStatus: "provider_unavailable",
    });
  });

  it("buildVideoNarrativeObservabilityEvent transforma durationSeconds e sizeBytes em buckets", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-4",
      eventName: "video_narrative_analysis_started",
      status: "started",
      source: "internal_endpoint",
      createdAt: CREATED_AT,
      durationSeconds: 42,
      sizeBytes: 80 * MB,
    });

    expect(result.event).toMatchObject({
      durationBucket: "31-60s",
      sizeBucket: "50-100mb",
    });
  });

  it("buildVideoNarrativeObservabilityEvent sanitiza model/inputSource/providerStatus com API key", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-5",
      eventName: "video_narrative_analysis_started",
      status: "started",
      source: "internal_endpoint",
      createdAt: CREATED_AT,
      model: "gemini AIza1234567890abcdefghi",
      inputSource: "GEMINI_API_KEY=abc",
      providerStatus: "GOOGLE_GENAI_API_KEY=def",
    });

    expect(result.ok).toBe(true);
    expect(result.event?.model).toBe("gemini [redigido]");
    expect(result.event?.inputSource).toBe("[redigido]");
    expect(result.event?.providerStatus).toBe("[redigido]");
  });

  it("buildVideoNarrativeObservabilityEvent retorna issue para latencyMs negativo", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-6",
      eventName: "video_narrative_analysis_completed",
      status: "completed",
      source: "internal_endpoint",
      createdAt: CREATED_AT,
      latencyMs: -1,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("invalid_latency");
  });

  it("buildVideoNarrativeObservabilityEvent retorna issue para estimatedCost negativo", () => {
    const result = buildVideoNarrativeObservabilityEvent({
      requestId: "req-7",
      eventName: "video_narrative_usage_consumed",
      status: "consumed",
      source: "production",
      createdAt: CREATED_AT,
      estimatedCost: -0.01,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("invalid_cost");
  });

  it("validateVideoNarrativeObservabilityEvent aceita evento válido", () => {
    expect(validateVideoNarrativeObservabilityEvent(validEvent).ok).toBe(true);
  });

  it("validateVideoNarrativeObservabilityEvent rejeita eventName inválido", () => {
    expect(
      validateVideoNarrativeObservabilityEvent({ ...validEvent, eventName: "outro" }).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("invalid_event_name");
  });

  it("validateVideoNarrativeObservabilityEvent rejeita status inválido", () => {
    expect(
      validateVideoNarrativeObservabilityEvent({ ...validEvent, status: "outro" }).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("invalid_status");
  });

  it("validateVideoNarrativeObservabilityEvent rejeita source inválida", () => {
    expect(
      validateVideoNarrativeObservabilityEvent({ ...validEvent, source: "outro" }).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("invalid_source");
  });

  it("validateVideoNarrativeObservabilityEvent rejeita createdAt inválido", () => {
    expect(
      validateVideoNarrativeObservabilityEvent({ ...validEvent, createdAt: "sem-data" }).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("invalid_created_at");
  });

  it("validateVideoNarrativeObservabilityEvent rejeita rawText extra", () => {
    expect(
      validateVideoNarrativeObservabilityEvent({ ...validEvent, rawText: "texto completo" }).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("unsafe_payload");
  });

  it("validateVideoNarrativeObservabilityEvent rejeita inlineVideoBase64 extra", () => {
    expect(
      validateVideoNarrativeObservabilityEvent({
        ...validEvent,
        inlineVideoBase64: "a".repeat(140),
      }).issues.map((issue) => issue.code),
    ).toContain("unsafe_payload");
  });

  it("validateVideoNarrativeObservabilityEvent rejeita signedUrl/videoUrl/apiKey extra", () => {
    ["signedUrl", "videoUrl", "apiKey"].forEach((key) => {
      expect(
        validateVideoNarrativeObservabilityEvent({ ...validEvent, [key]: "valor" }).issues.map(
          (issue) => issue.code,
        ),
      ).toContain("unsafe_payload");
    });
  });

  it("redactVideoNarrativeObservabilityPayload redige AIza, GEMINI_API_KEY e GOOGLE_GENAI_API_KEY", () => {
    const redacted = redactVideoNarrativeObservabilityPayload({
      ...validEvent,
      model: "AIza1234567890abcdefghi",
      providerStatus: "GEMINI_API_KEY=abc",
      inputSource: "GOOGLE_GENAI_API_KEY=def",
    });

    expect(redacted.model).toBe("[redigido]");
    expect(redacted.providerStatus).toBe("[redigido]");
    expect(redacted.inputSource).toBe("[redigido]");
  });

  it("redactVideoNarrativeObservabilityPayload redige base64 longo", () => {
    const redacted = redactVideoNarrativeObservabilityPayload({
      ...validEvent,
      accountId: "a".repeat(140),
    });

    expect(redacted.accountId).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeObservabilityText redige URL assinada com token simples", () => {
    expect(
      sanitizeVideoNarrativeObservabilityText("https://cdn.example/video.mp4?token=abc123"),
    ).toBe("[redigido]");
  });

  it("mantém linguagem segura em mensagens e defaults", () => {
    const outputs = [
      buildVideoNarrativeObservabilityEvent({
        requestId: "req-8",
        eventName: "video_narrative_analysis_completed",
        status: "completed",
        source: "internal_endpoint",
        createdAt: CREATED_AT,
        latencyMs: -1,
      }).issues.map((issue) => issue.message),
      sanitizeVideoNarrativeObservabilityText(
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
