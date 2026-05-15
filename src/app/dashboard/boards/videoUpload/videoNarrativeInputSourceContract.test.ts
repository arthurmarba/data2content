import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_INPUT_SOURCE_CONTRACT.md");

function readContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

describe("videoNarrativeInputSourceContract", () => {
  it("mantém o contrato documental presente", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
  });

  it("documenta fontes, limites, privacidade e contratos relacionados", () => {
    const contract = readContract();
    const expectedTerms = [
      "Gemini File API",
      "inlineVideoBase64",
      "mimeType",
      "videoUri",
      "storage temporário próprio",
      "GCS",
      "S3",
      "R2",
      "URL Pública Restrita",
      "60s",
      "100MB",
      "5 análises/mês",
      "consentimento",
      "retenção",
      "cleanup",
      "hasRawText",
      "resposta sem `rawText` completo",
      "nunca logar base64",
      "não commitar vídeo",
      "não commitar API key",
      "VideoUploadDraft",
      "VideoUploadSession",
      "VideoTemporaryStorageObject",
      "VideoNarrativeAnalysis",
    ];

    expectedTerms.forEach((term) => {
      expect(contract).toContain(term);
    });
  });

  it("recomenda uma origem diferente por fase", () => {
    const contract = readContract();
    expect(contract).toContain("usar Gemini File API ou inline base64 pequeno");
    expect(contract).toContain("aceitar `videoUri` primeiro");
    expect(contract).toContain("usar storage temporário próprio ou provider escolhido");
    expect(contract).toContain("nunca depender de base64 como fluxo principal");
  });

  it("não inclui instrução de implementação de rota", () => {
    expect(readContract()).not.toContain("route.ts");
  });

  it("confirma que a rota futura ainda não existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(false);
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

  it("mantém os novos arquivos sem imports proibidos", () => {
    const testSource = fs.readFileSync(__filename, "utf8");
    const forbiddenImports = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "component",
      "hook",
      "endpoint",
      "upload service",
      "storage provider",
      "ffmpeg",
      "UI",
    ];

    forbiddenImports.forEach((term) => {
      expect(testSource).not.toContain(`from "${term}`);
      expect(testSource).not.toContain(`from '${term}`);
    });
  });
});
