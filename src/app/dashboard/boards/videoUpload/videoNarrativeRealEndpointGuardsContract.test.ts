import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_REAL_ENDPOINT_GUARDS_CONTRACT.md");

function readContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

describe("videoNarrativeRealEndpointGuardsContract", () => {
  it("mantém o contrato documental presente", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
  });

  it("documenta endpoint futuro, guards, status e contratos relacionados", () => {
    const contract = readContract();
    const expectedTerms = [
      "POST /api/internal/video-narrative/analyze",
      "Method Guard",
      "Session Guard",
      "Admin/Dev Guard",
      "Feature Flag Guard",
      "VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED",
      "NEXT_PUBLIC",
      "Content-Type Guard",
      "Payload Size Guard",
      "Payload Schema Guard",
      "Input Source Guard",
      "Consent Guard",
      "Retention Guard",
      "Usage/Quota Guard",
      "observabilidade",
      "Provider Call",
      "fallback",
      "Seed Generation",
      "Usage Consumption",
      "Safe Response",
      "hasRawText",
      "rawText completo",
      "API key",
      "base64",
      "route.ts",
      "60s",
      "100MB",
      "quota_exceeded",
      "cooldown_active",
      "consent_missing",
      "retention_expired",
      "provider_unavailable",
      "parse_failed",
      "latencyMs",
      "requestId",
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
    ];

    expectedTerms.forEach((term) => {
      expect(contract).toContain(term);
    });
  });

  it("mantém o princípio central de guards antes do provider", () => {
    expect(readContract()).toContain(
      "O endpoint real só deve chamar o provider depois que acesso, flag, payload, consentimento, origem do vídeo, uso e observabilidade estiverem resolvidos.",
    );
  });

  it("documenta a transição de contrato MM18 para skeleton MM27", () => {
    expect(readContract()).toContain("não existe route.ts nesta fase");
    expect(readContract()).toContain("MM27 cria");
    expect(readContract()).toContain("endpoint skeleton admin/dev");
  });

  it("documenta que falha antes do provider não consome quota", () => {
    expect(readContract()).toContain("falha antes do provider não consome");
    expect(readContract()).toContain("falha antes de chamar provider");
  });

  it("confirma que a rota skeleton MM27 existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("mantém os novos arquivos sem imports proibidos", () => {
    const testSource = fs.readFileSync(__filename, "utf8");
    const contract = readContract();
    const combinedSource = `${testSource}\n${contract}`;
    const forbiddenImports = [
      "Stripe",
      "billing",
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
    ];

    forbiddenImports.forEach((term) => {
      expect(combinedSource).not.toContain(`from "${term}`);
      expect(combinedSource).not.toContain(`from '${term}`);
    });
  });

  it("mantém linguagem consultiva no documento", () => {
    const contract = readContract().toLowerCase();
    const blockedTerms = [
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
    ];

    blockedTerms.forEach((term) => {
      expect(contract).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });
});
