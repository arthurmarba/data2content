import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_CONSENT_RETENTION_CONTRACT.md");

function readContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

describe("videoNarrativeConsentRetentionContract", () => {
  it("mantém o contrato documental presente", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
  });

  it("documenta consentimento, retenção, privacidade e contratos relacionados", () => {
    const contract = readContract();
    const expectedTerms = [
      "consentimento",
      "retenção",
      "privacidade",
      "vídeo temporário",
      "IA",
      "voz",
      "rosto",
      "texto na tela",
      "dados pessoais",
      "não deve ser salvo permanentemente",
      "profileSignals",
      "VideoNarrativeAnalysis",
      "PostCreationVideoSeed",
      "VideoTemporaryStorageObject",
      "VideoStorageRetention",
      "VideoUploadSession",
      "expiresAt",
      "cleanup",
      "logs",
      "API key",
      "base64",
      "rawText",
      "24h",
      "72h",
      "limite por plano",
      "beta",
      "apagar análise/vídeo",
    ];

    expectedTerms.forEach((term) => {
      expect(contract).toContain(term);
    });
  });

  it("mantém o princípio central de dado temporário", () => {
    expect(readContract()).toContain(
      "O vídeo deve ser tratado como dado temporário de análise, não como ativo permanente da conta.",
    );
  });

  it("inclui texto conceitual de consentimento futuro em português", () => {
    const contract = readContract();

    expect(contract).toContain("Ao enviar este vídeo, você autoriza a D2C");
    expect(contract).toContain("analisá-lo com IA");
    expect(contract).toContain("arquivo temporário de análise");
    expect(contract).toContain("Evite enviar vídeos com dados sensíveis");
  });

  it("bloqueia persistência automática de profileSignals", () => {
    expect(readContract()).toContain(
      "Esses `profileSignals` não devem ser automaticamente persistidos no perfil do usuário.",
    );
  });

  it("bloqueia retorno ou salvamento padrão de rawText completo", () => {
    expect(readContract()).toContain("O rawText completo não deve ser retornado/salvo por padrão.");
  });

  it("confirma que a rota skeleton MM27 existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(true);
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
    const contract = readContract();
    const combinedSource = `${testSource}\n${contract}`;
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
      "ffmpeg",
      "UI",
    ];

    forbiddenImports.forEach((term) => {
      expect(combinedSource).not.toContain(`from "${term}`);
      expect(combinedSource).not.toContain(`from '${term}`);
    });
  });
});
