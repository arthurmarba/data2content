import fs from "fs";
import path from "path";

const VIDEO_UPLOAD_DIR = __dirname;
const CHECKLIST_PATH = path.join(VIDEO_UPLOAD_DIR, "MOBILE_STRATEGIC_PROFILE_UX_QA.md");
const TEST_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "mobileStrategicProfileUxQa.test.ts");

function readChecklist(): string {
  return fs.readFileSync(CHECKLIST_PATH, "utf8");
}

describe("mobileStrategicProfileUxQa", () => {
  it("creates the mobile strategic profile UX QA document", () => {
    expect(fs.existsSync(CHECKLIST_PATH)).toBe(true);
  });

  it("contains setup, feature flag and admin/dev access requirement", () => {
    const content = readChecklist();

    expect(content).toContain("/dashboard/boards/mobile-strategic-profile-preview");
    expect(content).toContain("NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1");
    expect(content).toContain("admin/dev");
  });

  it("contains all required preview state URLs", () => {
    const content = readChecklist();

    [
      "state=anonymous_view_profile",
      "state=anonymous_analyze_video",
      "state=account_only",
      "state=first_reading_free",
      "state=premium_without_instagram",
      "state=instagram_optimized",
      "state=media_kit_available",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contains all required QA criteria sections", () => {
    const content = readChecklist();

    [
      "## Critérios do topo do Perfil",
      "## Critérios do Auth Gate",
      "## Critérios do Perfil em construção",
      "## Critérios da primeira leitura gratuita",
      "## Critérios do premium",
      "## Critérios do Instagram optimized",
      "## Critérios do Mídia Kit modal",
      "## Critérios do fluxo +",
      "## Critérios de navegação",
      "## Critérios de Comunidade",
      "## Critérios do ActivationPendingWidget",
      "## Critérios de linguagem",
      "## Critérios de segurança",
      "## Critérios de aprovação geral",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("covers the profile top and auth gate expectations", () => {
    const content = readChecklist();

    [
      "perfil social, não um dashboard",
      "Nome, handle e bio",
      "Status pills",
      "Botão `+`",
      "Usuário anônimo não vê Perfil fake",
      "criar Perfil Estratégico",
      "analisar primeiro vídeo",
      "Preview não chama login real",
      "Preview não importa `LoginClient`",
      "callback",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("covers construction, free, premium and Instagram optimized expectations", () => {
    const content = readChecklist();

    [
      "CTA “Analisar primeiro vídeo”",
      "Comercial aparece como limitado/construção",
      "Mídia Kit não aparece como disponível sem condição",
      "Entrega valor real",
      "Mostra diagnóstico inicial",
      "Sugere Instagram sem parecer obrigatório",
      "Parece mais completo que free",
      "Comercial aparece como tradução estratégica",
      "Não promete marca, publi ou match",
      "Mostra leitura mais precisa",
      "Mostra Instagram conectado",
      "Não afirma uso de dados reais se for mock/preview",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("covers Media Kit modal criteria", () => {
    const content = readChecklist();

    [
      "Mídia Kit não é aba principal",
      "ponte para recurso existente",
      "Não cria Mídia Kit mobile novo",
      "Não altera `MediaKitView`",
      "Não mostra diagnóstico interno",
      "Sem clipboard real",
      "Sem Web Share API",
      "Sem `window.open`",
      "Sem navegação automática",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("covers plus flow and navigation criteria", () => {
    const content = readChecklist();

    [
      "`+` do header abre fluxo",
      "`+` da bottom nav abre o mesmo fluxo",
      "Botão “Analisar vídeo” abre o mesmo fluxo",
      "Confirmação diz “Diagnóstico atualizado.”",
      "Volta para o Perfil",
      "Não cria histórico de vídeos",
      "Não mostra upload real",
      "Não usa `FileReader`",
      "Não usa `fetch`",
      "Bottom nav mockada tem apenas Perfil / + / Comunidade",
      "`+` é ação central, não aba",
      "Mídia Kit não aparece na bottom nav",
      "Diagnóstico não aparece na bottom nav",
      "Comercial não aparece na bottom nav",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("covers Community and ActivationPendingWidget criteria", () => {
    const content = readChecklist();

    [
      "Comunidade aparece apenas como destino",
      "Não existe feed novo",
      "Não existe chat",
      "Não existem comentários",
      "Não existem creators públicos novos",
      "Widget não aparece dentro da preview do Perfil",
      "Estratégia documenta conflito com bottom nav",
      "Estratégia documenta conflito com `+`",
      "Estratégia documenta conflito com Mídia Kit modal",
      "Estratégia documenta conflito com fluxo de análise",
      "Nenhuma alteração real foi feita no widget",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contains forbidden language and security criteria", () => {
    const content = readChecklist();

    [
      "Termos proibidos:",
      "score",
      "nota",
      "pontos",
      "ranking",
      "gabarito",
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "match real",
      "marca garantida",
      "patrocínio garantido",
      "vídeos salvos",
      "histórico de vídeos",
      "novo Mídia Kit",
      "Mídia Kit mobile",
      "18 sinais",
      "3 narrativas",
      "percentual de perfil",
      "API key",
      "base64 longo",
      "URL assinada com token",
      "texto bruto sensível",
      "arquivo real de vídeo",
      "thumbnail real",
      "dados privados de Instagram real",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contains general approval criteria", () => {
    const content = readChecklist();

    [
      "usuário anônimo entende por que precisa entrar",
      "usuário só com Gmail entende como começar",
      "usuário free entende valor da primeira leitura",
      "usuário premium entende o valor do diagnóstico vivo",
      "usuário com Instagram entende a precisão adicional",
      "Perfil parece a casa do app",
      "`+` parece ação, não aba",
      "Mídia Kit parece recurso existente",
      "Comunidade parece destino existente",
      "não há histórico de vídeos",
      "a tela não parece dashboard espremido",
      "compreensível em até 30 segundos",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contains findings table, severities and next decisions", () => {
    const content = readChecklist();

    expect(content).toContain("| Cenário | Largura | Achado | Severidade | Ação sugerida | Status |");
    ["blocker", "high", "medium", "low", "polish"].forEach((term) => {
      expect(content).toContain(term);
    });
    [
      "MM52 — Strategic Profile Mobile Visual Polish",
      "MM53 — Strategic Profile Preview Copy Refinement",
      "MM54 — Mobile Navigation Integration Plan",
      "MM55 — Strategic Profile Data Integration Readiness",
      "Não recomendar integração real antes do QA/polish visual.",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("contains explicit MM51 guardrails", () => {
    const content = readChecklist();

    [
      "Sem Gemini real.",
      "Sem upload/storage real.",
      "Sem persistência.",
      "Sem endpoint alterado.",
      "Sem `LoginClient` alterado.",
      "Sem NextAuth alterado.",
      "Sem `MediaKitView` alterado.",
      "Sem Comunidade real alterada.",
      "Sem navegação real alterada.",
      "Sem `ActivationPendingWidget` alterado.",
      "Sem Instagram real.",
      "Sem billing real.",
    ].forEach((term) => {
      expect(content).toContain(term);
    });
  });

  it("keeps the static QA test free from app/runtime imports", () => {
    const source = fs.readFileSync(TEST_SOURCE_PATH, "utf8");

    [
      "React",
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "ActivationPendingWidget",
      "fetch",
      "Prisma",
      "Gemini",
      "OpenAI",
      "Stripe",
      "@google/genai",
      "next/navigation",
    ].forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });
});
