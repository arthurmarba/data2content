import fs from "fs";
import path from "path";

import {
  VIDEO_NARRATIVE_GUARD_ORDER,
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  createSkippedVideoNarrativeGuardResult,
  isVideoNarrativeGuardBlocking,
  sanitizeVideoNarrativeGuardMessage,
  shouldVideoNarrativeGuardAllowProviderCall,
  shouldVideoNarrativeGuardAllowQuotaConsumption,
  summarizeVideoNarrativeGuardResults,
  type VideoNarrativeGuardName,
  type VideoNarrativeGuardResult,
} from "./videoNarrativeGuardContracts";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeGuardContracts.ts");

function passed(name: VideoNarrativeGuardName): VideoNarrativeGuardResult {
  return createPassedVideoNarrativeGuardResult(name);
}

function buildPassingThroughSafeResponse(): VideoNarrativeGuardResult[] {
  return VIDEO_NARRATIVE_GUARD_ORDER.map((name) => passed(name));
}

function buildPassingBeforeProvider(): VideoNarrativeGuardResult[] {
  return VIDEO_NARRATIVE_GUARD_ORDER.slice(0, VIDEO_NARRATIVE_GUARD_ORDER.indexOf("provider")).map((name) =>
    passed(name),
  );
}

describe("videoNarrativeGuardContracts", () => {
  it("mantém a ordem oficial dos 19 guards do contrato MM18", () => {
    expect(VIDEO_NARRATIVE_GUARD_ORDER).toEqual([
      "method",
      "session",
      "admin_dev",
      "feature_flag",
      "content_type",
      "payload_size",
      "payload_schema",
      "input_source",
      "mime_duration_size",
      "consent",
      "retention",
      "usage_quota",
      "observability_start",
      "provider",
      "parse_fallback",
      "seed_generation",
      "usage_consumption",
      "observability_completion",
      "safe_response",
    ]);
  });

  it("cria resultado passed seguro", () => {
    expect(createPassedVideoNarrativeGuardResult("method")).toEqual({
      name: "method",
      status: "passed",
      code: null,
      severity: "info",
      message: "Método validado.",
      shouldCallProvider: true,
      shouldConsumeQuota: false,
    });
  });

  it("cria resultado blocked sem provider e sem quota", () => {
    const result = createBlockedVideoNarrativeGuardResult({
      name: "payload_schema",
      code: "invalid_payload",
      message: "Payload não validado.",
    });

    expect(result.status).toBe("blocked");
    expect(result.severity).toBe("blocking");
    expect(result.shouldCallProvider).toBe(false);
    expect(result.shouldConsumeQuota).toBe(false);
  });

  it("cria resultado skipped", () => {
    expect(createSkippedVideoNarrativeGuardResult({ name: "provider" })).toMatchObject({
      name: "provider",
      status: "skipped",
      code: null,
      severity: "info",
      shouldCallProvider: false,
      shouldConsumeQuota: false,
    });
  });

  it("identifica bloqueio apenas quando status blocked e severity blocking", () => {
    expect(
      isVideoNarrativeGuardBlocking(
        createBlockedVideoNarrativeGuardResult({
          name: "method",
          code: "method_not_allowed",
          message: "Método bloqueado.",
        }),
      ),
    ).toBe(true);
    expect(
      isVideoNarrativeGuardBlocking(
        createBlockedVideoNarrativeGuardResult({
          name: "method",
          code: "method_not_allowed",
          message: "Método observado.",
          severity: "warning",
        }),
      ),
    ).toBe(false);
    expect(isVideoNarrativeGuardBlocking(createPassedVideoNarrativeGuardResult("method"))).toBe(false);
  });

  it("usa o primeiro blockedBy conforme ordem oficial, não ordem recebida", () => {
    const summary = summarizeVideoNarrativeGuardResults([
      createBlockedVideoNarrativeGuardResult({
        name: "retention",
        code: "retention_expired",
        message: "Retenção expirada.",
      }),
      createBlockedVideoNarrativeGuardResult({
        name: "method",
        code: "method_not_allowed",
        message: "Método bloqueado.",
      }),
    ]);

    expect(summary.blockedBy?.name).toBe("method");
  });

  it.each<VideoNarrativeGuardName>([
    "method",
    "session",
    "admin_dev",
    "feature_flag",
    "payload_schema",
    "input_source",
    "consent",
    "retention",
    "usage_quota",
  ])("bloqueia provider quando %s falha antes do provider", (name) => {
    const summary = summarizeVideoNarrativeGuardResults([
      ...buildPassingBeforeProvider(),
      createBlockedVideoNarrativeGuardResult({
        name,
        code: name === "method" ? "method_not_allowed" : "invalid_payload",
        message: "Guard não validado.",
      }),
    ]);

    expect(summary.canCallProvider).toBe(false);
  });

  it("permite provider quando todos os guards anteriores passam", () => {
    expect(summarizeVideoNarrativeGuardResults(buildPassingBeforeProvider()).canCallProvider).toBe(true);
  });

  it("não consome quota quando há falha antes do provider", () => {
    const summary = summarizeVideoNarrativeGuardResults([
      createBlockedVideoNarrativeGuardResult({
        name: "payload_schema",
        code: "invalid_payload",
        message: "Payload não validado.",
      }),
      ...buildPassingThroughSafeResponse(),
    ]);

    expect(summary.canConsumeQuota).toBe(false);
  });

  it("não consome quota quando provider está indisponível", () => {
    const results = buildPassingThroughSafeResponse().map((result) =>
      result.name === "provider"
        ? createBlockedVideoNarrativeGuardResult({
            name: "provider",
            code: "provider_unavailable",
            message: "Provider não disponível.",
          })
        : result,
    );

    expect(summarizeVideoNarrativeGuardResults(results).canConsumeQuota).toBe(false);
  });

  it("não consome quota quando parse_failed bloqueia", () => {
    const results = buildPassingThroughSafeResponse().map((result) =>
      result.name === "parse_fallback"
        ? createBlockedVideoNarrativeGuardResult({
            name: "parse_fallback",
            code: "parse_failed",
            message: "Parse não validado.",
          })
        : result,
    );

    expect(summarizeVideoNarrativeGuardResults(results).canConsumeQuota).toBe(false);
  });

  it("consome quota apenas quando usage_consumption e safe_response passam", () => {
    expect(summarizeVideoNarrativeGuardResults(buildPassingThroughSafeResponse()).canConsumeQuota).toBe(true);

    const withoutUsage = buildPassingThroughSafeResponse().filter(
      (result) => result.name !== "usage_consumption",
    );
    expect(summarizeVideoNarrativeGuardResults(withoutUsage).canConsumeQuota).toBe(false);

    const unsafeResponse = buildPassingThroughSafeResponse().map((result) =>
      result.name === "safe_response"
        ? createBlockedVideoNarrativeGuardResult({
            name: "safe_response",
            code: "unsafe_response",
            message: "Resposta não validada.",
          })
        : result,
    );
    expect(summarizeVideoNarrativeGuardResults(unsafeResponse).canConsumeQuota).toBe(false);
  });

  it("shouldVideoNarrativeGuardAllowProviderCall respeita resumo", () => {
    expect(shouldVideoNarrativeGuardAllowProviderCall(buildPassingBeforeProvider())).toBe(true);
    expect(
      shouldVideoNarrativeGuardAllowProviderCall([
        createBlockedVideoNarrativeGuardResult({
          name: "session",
          code: "unauthorized",
          message: "Sessão ausente.",
        }),
      ]),
    ).toBe(false);
  });

  it("shouldVideoNarrativeGuardAllowQuotaConsumption respeita resumo", () => {
    expect(shouldVideoNarrativeGuardAllowQuotaConsumption(buildPassingThroughSafeResponse())).toBe(true);
    expect(
      shouldVideoNarrativeGuardAllowQuotaConsumption([
        createBlockedVideoNarrativeGuardResult({
          name: "consent",
          code: "consent_missing",
          message: "Consentimento ausente.",
        }),
      ]),
    ).toBe(false);
  });

  it("redige API key iniciando com AIza", () => {
    expect(sanitizeVideoNarrativeGuardMessage("chave AIza1234567890abcdefghi")).toBe("chave [redigido]");
  });

  it("redige GEMINI_API_KEY e GOOGLE_GENAI_API_KEY", () => {
    expect(sanitizeVideoNarrativeGuardMessage("GEMINI_API_KEY=abc GOOGLE_GENAI_API_KEY=def")).toBe(
      "[redigido] [redigido]",
    );
  });

  it("redige base64 longo", () => {
    const longBase64 = "a".repeat(140);
    expect(sanitizeVideoNarrativeGuardMessage(`payload ${longBase64}`)).toBe("payload [redigido]");
  });

  it("mantém linguagem segura nas mensagens default e outputs dos helpers", () => {
    const outputs = [
      ...VIDEO_NARRATIVE_GUARD_ORDER.map((name) => createPassedVideoNarrativeGuardResult(name).message),
      createBlockedVideoNarrativeGuardResult({
        name: "method",
        code: "method_not_allowed",
        message: "garantido certeza comprovado viralizar garantido score nota pontuação acerto gabarito resposta correta venceu perdeu treinado permanentemente",
      }).message,
      createSkippedVideoNarrativeGuardResult({
        name: "provider",
        message: "Guard não executado.",
      }).message,
    ].join(" ").toLowerCase();

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
