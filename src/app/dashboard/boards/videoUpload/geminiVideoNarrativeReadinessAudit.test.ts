import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const ROOT_DIR = process.cwd();

function readVideoUploadFile(fileName: string): string {
  return fs.readFileSync(path.join(VIDEO_UPLOAD_DIR, fileName), "utf8");
}

function readRootFile(filePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, filePath), "utf8");
}

describe("geminiVideoNarrativeReadinessAudit", () => {
  it("mantém a auditoria documental presente", () => {
    expect(fs.existsSync(path.join(VIDEO_UPLOAD_DIR, "GEMINI_VIDEO_NARRATIVE_READINESS_AUDIT.md"))).toBe(true);
  });

  it("documenta os contratos, guardas e riscos pendentes", () => {
    const audit = readVideoUploadFile("GEMINI_VIDEO_NARRATIVE_READINESS_AUDIT.md");
    const expectedTerms = [
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
      "flag server-side",
      "API key",
      "rawText",
      "hasRawText",
      "sem endpoint público",
      "sem UI pública",
      "sem upload real",
      "billing/quota",
      "custo real",
      "latência real",
      "File API",
      "consentimento",
      "retenção",
      "limite por plano",
    ];

    expectedTerms.forEach((term) => {
      expect(audit).toContain(term);
    });
  });

  it("mantém a flag real fora de NEXT_PUBLIC", () => {
    const featureFlag = readVideoUploadFile("geminiVideoNarrativeFeatureFlag.ts");
    expect(featureFlag).not.toContain("NEXT_PUBLIC");
  });

  it("mantém o composer lendo somente configuração server-side esperada", () => {
    const composer = readVideoUploadFile("geminiVideoNarrativeProviderComposer.ts");
    expect(composer).toContain("GEMINI_API_KEY");
    expect(composer).toContain("GOOGLE_GENAI_API_KEY");
    expect(composer).toContain("VIDEO_NARRATIVE_GEMINI_MODEL");
  });

  it("mantém o harness retornando apenas hasRawText no contrato público", () => {
    const harness = readVideoUploadFile("geminiVideoNarrativeRealRunHarness.ts");
    const resultType = harness.match(/export type GeminiVideoNarrativeRealRunResult = \{[\s\S]*?\n\};/)?.[0];

    expect(resultType).toContain("hasRawText: boolean;");
    expect(resultType).not.toContain("rawText:");
  });

  it("mantém o script sem segredos ou base64 embutidos", () => {
    const script = readRootFile("scripts/video-narrative-real-run.ts");
    expect(script).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(script).not.toMatch(/[A-Za-z0-9+/]{80,}={0,2}/);
  });

  it("mantém os novos arquivos livres de integrações proibidas", () => {
    const sources = [
      readVideoUploadFile("GEMINI_VIDEO_NARRATIVE_READINESS_AUDIT.md"),
      readVideoUploadFile("geminiVideoNarrativeReadinessAudit.test.ts"),
    ].join("\n");
    const forbiddenImports = [
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "Prisma",
      "OpenAI",
      "fetch",
      "endpoint",
      "upload service",
      "storage provider",
      "ffmpeg",
    ];

    forbiddenImports.forEach((term) => {
      expect(sources).not.toContain(`from "${term}`);
      expect(sources).not.toContain(`from '${term}`);
    });
  });

  it("mantém linguagem consultiva na auditoria", () => {
    const audit = readVideoUploadFile("GEMINI_VIDEO_NARRATIVE_READINESS_AUDIT.md").toLowerCase();
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
      expect(audit).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });
});
