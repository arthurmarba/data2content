import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const READINESS_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_ENDPOINT_SKELETON_READINESS.md");
const TEST_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeEndpointSkeletonReadiness.test.ts");
const FUTURE_ROUTE_PATH = path.join(
  process.cwd(),
  "src/app/api/internal/video-narrative/analyze/route.ts",
);
const FUTURE_ENDPOINT_DIR = path.join(
  process.cwd(),
  "src/app/api/internal/video-narrative/analyze",
);

function readReadiness(): string {
  return fs.readFileSync(READINESS_PATH, "utf8");
}

describe("videoNarrativeEndpointSkeletonReadiness", () => {
  it("cria o documento de readiness do endpoint skeleton", () => {
    expect(fs.existsSync(READINESS_PATH)).toBe(true);
  });

  it("menciona a fundação e helpers necessários para o skeleton futuro", () => {
    const content = readReadiness();

    [
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
      "validateVideoNarrativeAnalyzePayload",
      "validateVideoNarrativeInputSourceForPhase",
      "validateVideoNarrativeConsentRetentionForPhase",
      "validateVideoNarrativeUsageQuotaForPhase",
      "summarizeVideoNarrativeGuardResults",
      "buildVideoNarrativeObservabilityEvent",
      "buildBlockedVideoNarrativeSafeResponse",
      "buildVideoNarrativeSafeResponse",
      "validateVideoNarrativeSafeResponse",
      "POST /api/internal/video-narrative/analyze",
      "VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED",
      "VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED",
      "NEXT_PUBLIC",
      "admin/dev",
      "sessão",
      "sem provider real",
      "sem chamada Gemini real",
      "sem upload real",
      "sem UI",
      "sem banco/tabela",
      "sem analytics real",
      "rawText",
      "base64",
      "API key",
      "URL assinada",
      "billing/quota",
      "3 vídeos curtos",
      "ready_without_provider",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contém o princípio central", () => {
    expect(readReadiness()).toContain(
      "Só criar o endpoint skeleton se ele puder nascer bloqueado, observável e incapaz de vazar dados sensíveis.",
    );
  });

  it("declara que o skeleton pode estar ligado sem ligar provider real", () => {
    expect(readReadiness()).toContain("endpoint skeleton pode estar ligado sem ligar provider real");
  });

  it("declara que provider real continua dependente da flag Gemini", () => {
    expect(readReadiness()).toContain("provider real continua dependente da flag Gemini");
  });

  it("confirma que a rota futura ainda não existe", () => {
    expect(fs.existsSync(FUTURE_ROUTE_PATH)).toBe(false);
  });

  it("confirma que o diretório futuro do endpoint ainda não foi criado", () => {
    expect(fs.existsSync(FUTURE_ENDPOINT_DIR)).toBe(false);
  });

  it("mantém linguagem segura no documento", () => {
    const content = readReadiness().toLowerCase();

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
      expect(content).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("mantém arquivos novos sem imports proibidos", () => {
    const combinedSource = [readReadiness(), fs.readFileSync(TEST_SOURCE_PATH, "utf8")].join("\n");
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
      expect(combinedSource).not.toContain(`from "${term}`);
      expect(combinedSource).not.toContain(`from '${term}`);
    });
  });
});
