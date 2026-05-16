import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_OBSERVABILITY_CONTRACT.md");

function readContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

describe("videoNarrativeObservabilityContract", () => {
  it("mantém o contrato documental presente", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
  });

  it("documenta métricas, eventos, logs seguros e contratos relacionados", () => {
    const contract = readContract();
    const expectedTerms = [
      "custo",
      "latência",
      "latencyMs",
      "fallback",
      "schema parse",
      "provider status",
      "hasRawText",
      "estimatedCost",
      "quota consumed",
      "usage_limited",
      "quota_exceeded",
      "cooldown_active",
      "provider_unavailable",
      "parse_failed",
      "insufficient_context",
      "consent_missing",
      "storage_expired",
      "video_narrative_analysis_requested",
      "video_narrative_analysis_completed",
      "video_narrative_analysis_failed",
      "video_narrative_usage_consumed",
      "video_narrative_limit_reached",
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
      "blueprint",
      "roteiro",
      "p95",
      "dashboard",
      "alerta",
      "API key",
      "base64",
      "rawText completo",
      "URL assinada",
      "dados sensíveis",
    ];

    expectedTerms.forEach((term) => {
      expect(contract).toContain(term);
    });
  });

  it("mantém o princípio central de observabilidade", () => {
    expect(readContract()).toContain(
      "Não lançar análise de vídeo sem conseguir medir custo, latência, falha, fallback e utilidade do resultado.",
    );
  });

  it("bloqueia analytics real nesta fase", () => {
    expect(readContract()).toContain("não existe analytics real nesta fase");
    expect(readContract()).toContain("não implementar analytics real");
  });

  it("bloqueia tabela e banco nesta fase", () => {
    const contract = readContract();

    expect(contract).toContain("não existe banco/tabela nesta fase");
    expect(contract).toContain("não criar tabela");
    expect(contract).toContain("não criar banco");
  });

  it("bloqueia log de rawText completo", () => {
    expect(readContract()).toContain("O rawText completo não deve ser logado.");
  });

  it("confirma que a rota futura ainda não existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(false);
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
