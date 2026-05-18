import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CHECKLIST_PATH = path.join(VIDEO_UPLOAD_DIR, "VIDEO_NARRATIVE_BROWSER_UX_QA_CHECKLIST.md");
const TEST_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeBrowserUxQaChecklist.test.ts");

function readChecklist(): string {
  return fs.readFileSync(CHECKLIST_PATH, "utf8");
}

describe("videoNarrativeBrowserUxQaChecklist", () => {
  it("cria o documento de QA visual no navegador", () => {
    expect(fs.existsSync(CHECKLIST_PATH)).toBe(true);
  });

  it("menciona rota, ambiente, escopo, cenários, acessos e segurança", () => {
    const content = readChecklist();

    [
      "/dashboard/boards/video-narrative-app-preview?mode=interactive",
      "NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED=1",
      "admin/dev",
      "sem upload real",
      "sem provider real",
      "sem persistência",
      "sem BoardShell",
      "sem Instagram real",
      "sem billing",
      "sem analytics real",
      "brand",
      "weak-hook",
      "collab",
      "ad-adaptation",
      "unclear",
      "free",
      "premium",
      "instagram_optimized",
      "mobile-first",
      "rawText",
      "base64",
      "API key",
      "signedUrl",
      "videoUrl",
      "Gemini",
      "upgrade",
      "Instagram",
      "diagnóstico",
      "quiz",
      "CTAs",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contém seção de URLs de teste", () => {
    const content = readChecklist();

    expect(content).toContain("## URLs de teste");
    expect(content).toContain("scenario=brand&access=free&instagram=disconnected");
    expect(content).toContain("scenario=weak-hook&access=free&instagram=disconnected");
    expect(content).toContain("scenario=collab&access=premium&instagram=disconnected");
    expect(content).toContain("scenario=brand&access=instagram_optimized&instagram=connected");
    expect(content).toContain("scenario=unclear&access=free&instagram=disconnected");
  });

  it("contém roteiro principal em checklist", () => {
    const content = readChecklist();

    expect(content).toContain("## Roteiro principal");
    expect(content).toContain("- [ ] Tela inicial mostra promessa clara.");
    expect(content).toContain("- [ ] Upload mostra botão central “Subir vídeo”.");
    expect(content).toContain("- [ ] Quiz aparece com 3 a 5 perguntas.");
    expect(content).toContain("- [ ] Diagnóstico final aparece.");
  });

  it("contém critérios por etapa", () => {
    const content = readChecklist();

    [
      "## Critérios de qualidade por etapa",
      "### Welcome",
      "### Upload",
      "### Loading",
      "### Pergunta central",
      "### Quiz",
      "### Diagnóstico",
      "### Upgrade",
      "### Instagram",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contém cenários obrigatórios", () => {
    const content = readChecklist();

    [
      "## Cenários obrigatórios",
      "### Brand",
      "### Weak hook",
      "### Collab",
      "### Ad adaptation",
      "### Unclear",
      "potencial comercial",
      "direção da abertura",
      "colaboração",
      "publi orgânica",
      "pede contexto",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contém critérios para aprovar MM37", () => {
    const content = readChecklist();

    expect(content).toContain("## Critérios para aprovar MM37");
    expect(content).toContain("fluxo principal é compreensível sem explicação");
    expect(content).toContain("experiência funciona em mobile");
    expect(content).toContain("não há dependência de integração real");
  });

  it("contém tabela de achados", () => {
    const content = readChecklist();

    expect(content).toContain("## Achados esperados");
    expect(content).toContain("| Área | Achado | Severidade | Ação recomendada | Status |");
    expect(content).toContain("| copy |");
    expect(content).toContain("| segurança |");
    expect(content).toContain("| performance percebida |");
  });

  it("contém próximas decisões após QA", () => {
    const content = readChecklist();

    expect(content).toContain("## Próximas decisões após QA");
    expect(content).toContain("refinar UX novamente");
    expect(content).toContain("criar integração controlada com endpoint mock");
    expect(content).toContain("preparar BoardShell handoff");
    expect(content).toContain("só depois upload/storage real");
  });

  it("mantém linguagem segura no documento", () => {
    const content = readChecklist().toLowerCase();

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

  it("mantém o teste novo sem imports proibidos", () => {
    const source = fs.readFileSync(TEST_SOURCE_PATH, "utf8");
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
      "Instagram client",
    ];

    forbiddenImports.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });
});
