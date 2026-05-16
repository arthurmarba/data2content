import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_USAGE_LIMITS_COST_CONTRACT.md");

function readContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

describe("videoNarrativeUsageLimitsCostContract", () => {
  it("mantém o contrato documental presente", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
  });

  it("documenta custo, quota, limites e contratos relacionados", () => {
    const contract = readContract();
    const expectedTerms = [
      "custo",
      "quota",
      "limite",
      "5 análises/mês",
      "10 análises/mês",
      "beta",
      "plano",
      "pacote extra",
      "upgrade",
      "retry",
      "cooldown",
      "rate limit",
      "feature flag",
      "VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED",
      "NEXT_PUBLIC",
      "billing",
      "latência",
      "taxa de falha",
      "taxa de fallback",
      "schema parse",
      "usage_limited",
      "quota_exceeded",
      "provider_unavailable",
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
      "consentimento",
      "retenção",
      "storage/input",
    ];

    expectedTerms.forEach((term) => {
      expect(contract).toContain(term);
    });
  });

  it("mantém o princípio central de custo previsível", () => {
    expect(readContract()).toContain(
      "A análise de vídeo deve ser útil para o criador sem abrir um custo imprevisível para a D2C.",
    );
  });

  it("trata 5 análises/mês como hipótese de beta, não promessa pública", () => {
    expect(readContract()).toContain("usar 5 análises/mês como hipótese de beta, não promessa pública");
  });

  it("condiciona 10 análises/mês à medição de custo real", () => {
    expect(readContract()).toContain(
      "considerar 10 análises/mês apenas depois de medir custo real por vídeo curto",
    );
  });

  it("bloqueia cobrança nesta fase", () => {
    expect(readContract()).toContain("não existe cobrança nesta fase");
    expect(readContract()).toContain("não implementar cobrança");
  });

  it("inclui cópias futuras de UX em português para limite e indisponibilidade", () => {
    const contract = readContract();

    expect(contract).toContain("Você atingiu o limite de análises de vídeo deste período.");
    expect(contract).toContain("Não consumimos uma análise porque o vídeo não pôde ser validado.");
    expect(contract).toContain("A análise de vídeo está temporariamente indisponível.");
    expect(contract).toContain("Tente novamente mais tarde ou use um vídeo menor.");
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
