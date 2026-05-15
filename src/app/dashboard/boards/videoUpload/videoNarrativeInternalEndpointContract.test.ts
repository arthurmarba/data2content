import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_INTERNAL_ENDPOINT_CONTRACT.md");

function readContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

describe("videoNarrativeInternalEndpointContract", () => {
  it("mantém o contrato documental presente", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
  });

  it("documenta acesso, payload, resposta, custo e limites", () => {
    const contract = readContract();
    const expectedTerms = [
      "POST /api/internal/video-narrative/analyze",
      "admin/dev",
      "sessão",
      "server-side",
      "VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED",
      "nunca usar `NEXT_PUBLIC`",
      "videoUri",
      "inlineVideoBase64",
      "mimeType",
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
      "hasRawText",
      "nunca retornar `rawText` completo",
      "API key",
      "consentimento",
      "retenção",
      "custo",
      "quota",
      "limite",
      "5 análises/mês",
      "60s",
      "100MB",
      "sem upload real",
      "sem UI",
      "sem endpoint real nesta fase",
    ];

    expectedTerms.forEach((term) => {
      expect(contract).toContain(term);
    });
  });

  it("não inclui implementação real, credencial ou payload bruto extenso", () => {
    const contract = readContract();
    expect(contract).not.toContain("route.ts");
    expect(contract).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(contract).not.toMatch(/[A-Za-z0-9+/]{120,}={0,2}/);
    expect(contract).not.toContain("usuário comum pode");
    expect(contract.toLowerCase()).not.toContain("promessa de performance");
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
