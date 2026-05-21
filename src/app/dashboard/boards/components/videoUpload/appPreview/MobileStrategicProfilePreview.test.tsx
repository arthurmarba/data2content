import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MobileStrategicProfilePreview } from "./MobileStrategicProfilePreview";
import {
  buildMobileStrategicProfilePreviewFixture,
  type MobileStrategicProfilePreviewFixtureState,
} from "./buildMobileStrategicProfilePreviewFixture";

jest.mock("@/utils/paywallModal", () => ({
  openPaywallModal: jest.fn(),
}));

const SOURCE_PATH = path.join(__dirname, "MobileStrategicProfilePreview.tsx");

function renderState(state: MobileStrategicProfilePreviewFixtureState) {
  const fixture = buildMobileStrategicProfilePreviewFixture({ state });
  return render(<MobileStrategicProfilePreview profile={fixture.profile} activeState={fixture.id} />);
}

function renderedText(container: HTMLElement): string {
  return container.textContent?.toLowerCase() ?? "";
}

function clickAnalyzeAction(label: string) {
  const button = screen
    .getAllByRole("button", { name: label })
    .find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Action button not found: ${label}`);
  fireEvent.click(button);
}

async function advanceAnalyzeFlowToConfirmation() {
  for (const label of ["Começar", "Continuar", "Continuar", "Gerar leitura"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
  }
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "Leitura pronta" })).toBeInTheDocument();
  }, { timeout: 2000 });
}

describe("MobileStrategicProfilePreview", () => {
  it("renders polished header with creator name, handle and bio", () => {
    renderState("first_reading_free");

    expect(screen.getByText("Ana Creator")).toBeInTheDocument();
    expect(screen.getAllByText("@ana.creator").length).toBeGreaterThan(0);
    expect(screen.getByText("Diagnóstico vivo do creator")).toBeInTheDocument();
    expect(screen.getByLabelText("Status do Perfil")).toBeInTheDocument();
  });

  it("renders profile status bubble as next action", () => {
    renderState("first_reading_free");

    expect(screen.getByText("Leitura grátis usada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assinar Pro" })).toBeInTheDocument();
  });

  it("renders status pills without forbidden technical language", () => {
    const { container } = renderState("instagram_optimized");
    const text = renderedText(container);

    expect(screen.getByText("Instagram conectado")).toBeInTheDocument();
    for (const forbidden of ["18 sinais", "3 narrativas", "percentual de perfil", "score", "ranking"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("auth gate renders Perfil Estratégico copy", () => {
    renderState("anonymous_view_profile");

    expect(screen.getByText("Crie seu Perfil Estratégico")).toBeInTheDocument();
    expect(screen.getByText("Entre com Google para começar seu diagnóstico como creator.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar com Google" })).toBeInTheDocument();
  });

  it("auth gate for analyze_video renders first video copy", () => {
    renderState("anonymous_analyze_video");

    expect(screen.getByText("Entre para analisar seu primeiro vídeo")).toBeInTheDocument();
    expect(screen.getByText("Use sua conta Google para salvar essa primeira leitura no seu Perfil Estratégico.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar e analisar vídeo" })).toBeInTheDocument();
  });

  it("construction profile renders Analisar primeiro vídeo CTA", () => {
    renderState("account_only");

    expect(screen.getAllByText("Perfil em construção").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Analisar meu primeiro vídeo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Teste sua primeira leitura narrativa").length).toBeGreaterThan(0);
  });

  it("construction profile does not show Media Kit available", () => {
    const { container } = renderState("account_only");
    const text = renderedText(container);

    expect(text).not.toContain("mídia kit ativo");
    expect(text).not.toContain("copiar link");
    expect(text).not.toContain("ver como marca");
  });

  it("first reading renders Mapa and conversion CTA", () => {
    renderState("first_reading_free");

    expect(screen.getAllByText("Mapa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Oportunidades").length).toBeGreaterThan(0);
    expect(screen.getByText("O que este vídeo comunica")).toBeInTheDocument();
    expect(screen.getByText("Transforme essa leitura em um Perfil vivo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assinar Pro e conectar Instagram" })).toBeInTheDocument();
  });

  it("premium renders Commercial section without brand promise", () => {
    const { container } = renderState("premium_without_instagram");
    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));
    const text = renderedText(container);

    expect(screen.getAllByText("Potencial comercial").length).toBeGreaterThan(0);
    expect(text).toContain("oportunidade futura");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("marca garantida");
    expect(text).not.toContain("patrocínio garantido");
  });

  it("instagram optimized renders more precise reading and Instagram connected", () => {
    renderState("instagram_optimized");

    expect(screen.getAllByText("Leitura mais precisa").length).toBeGreaterThan(0);
    expect(screen.getByText("Instagram conectado")).toBeInTheDocument();
  });

  it("internal tabs switch between Mapa and Oportunidades locally", () => {
    renderState("premium_without_instagram");

    expect(screen.getByRole("tab", { name: "Mapa" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Diagnóstico vivo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));

    expect(screen.getByRole("tab", { name: "Oportunidades" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Potencial comercial").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Mapa" }));

    expect(screen.getByRole("tab", { name: "Mapa" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Diagnóstico vivo")).toBeInTheDocument();
  });

  it("diagnosis tab keeps the first view compact", () => {
    renderState("first_reading_free");
    const diagnosisSection = screen.getByLabelText("Diagnóstico vivo");

    expect(within(diagnosisSection).getAllByRole("article").length).toBeLessThanOrEqual(3);
  });

  it("Media Kit Bridge available renders visual buttons without changing MediaKitView", () => {
    const { container } = renderState("media_kit_available");
    const text = renderedText(container);

    expect(screen.getAllByText("Mídia Kit").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver como marca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Mídia Kit" })).toBeInTheDocument();
    expect(text).not.toContain("mediakitview");
    expect(text).not.toContain("qr code");
    expect(text).not.toContain("diagnóstico interno");
  });

  it("Analyze flow does not appear by default", () => {
    renderState("first_reading_free");

    expect(screen.queryByRole("dialog", { name: "Nova leitura estratégica" })).not.toBeInTheDocument();
  });

  it("opens Analyze flow from status bubble when free reading is available", () => {
    renderState("account_only");

    fireEvent.click(screen.getAllByRole("button", { name: "Analisar meu primeiro vídeo" })[0]);

    expect(screen.getByRole("dialog", { name: "Nova leitura estratégica" })).toBeInTheDocument();
  });

  it("does not render central analyze action in bottom nav", () => {
    renderState("first_reading_free");
    const nav = screen.getByLabelText("Navegação mobile principal");

    expect(within(nav).queryByRole("button", { name: "Analisar vídeo pela ação central" })).not.toBeInTheDocument();
    expect(within(nav).queryByText("+")).not.toBeInTheDocument();
  });

  it("opens Analyze flow from Analisar meu primeiro vídeo action in account_only", () => {
    renderState("account_only");

    clickAnalyzeAction("Analisar meu primeiro vídeo");

    expect(screen.getByText("Envie um vídeo e diga o que você quer entender. A D2C transforma esse conteúdo em direção para o seu Perfil.")).toBeInTheDocument();
  });

  it("opens Analyze flow from empty state CTA in account_only", () => {
    renderState("account_only");

    clickAnalyzeAction("Analisar meu primeiro vídeo");

    expect(screen.getByRole("dialog", { name: "Nova leitura estratégica" })).toBeInTheDocument();
  });

  it("anonymous auth gate does not open real Analyze flow", () => {
    renderState("anonymous_analyze_video");

    fireEvent.click(screen.getByRole("button", { name: "Entrar e analisar vídeo" }));

    expect(screen.queryByRole("dialog", { name: "Nova leitura estratégica" })).not.toBeInTheDocument();
  });

  it("Analyze flow returns to Profile after short confirmation", async () => {
    renderState("account_only");

    clickAnalyzeAction("Analisar meu primeiro vídeo");
    await advanceAnalyzeFlowToConfirmation();

    expect(screen.getByRole("dialog", { name: "Leitura pronta" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver leitura no Perfil" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Perfil Estratégico mobile")).toBeInTheDocument();
    expect(screen.getAllByText("Mapa").length).toBeGreaterThan(0);
    expect(screen.getByText("A D2C atualizou seu Perfil com sinais deste vídeo.")).toBeInTheDocument();
  });

  it("Analyze flow does not create analyzed videos history or active file input", async () => {
    const { container } = renderState("account_only");

    clickAnalyzeAction("Analisar meu primeiro vídeo");
    await advanceAnalyzeFlowToConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Ver leitura no Perfil" }));

    const text = renderedText(container);
    expect(text).not.toContain("histórico de vídeos");
    expect(text).not.toContain("vídeos salvos");
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("Media Kit modal does not appear by default", () => {
    renderState("media_kit_available");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not compete with status action for Media Kit", () => {
    renderState("media_kit_available");

    expect(screen.queryByRole("button", { name: "Compartilhar Mídia Kit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });

  it("opens Media Kit modal from bridge action", () => {
    renderState("media_kit_available");

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(screen.getByRole("dialog", { name: "Compartilhar Mídia Kit" })).toBeInTheDocument();
    expect(screen.getByText("/mediakit/ana-preview")).toBeInTheDocument();
  });

  it("closes Media Kit modal from close button", () => {
    renderState("media_kit_available");

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Community appears only as destination/nav, without social surfaces", () => {
    const { container } = renderState("first_reading_free");
    const text = renderedText(container);

    expect(screen.getAllByText("Comunidade").length).toBeGreaterThan(0);
    expect(text).not.toContain("conhecer comunidade");
    expect(text).not.toContain("feed");
    expect(text).not.toContain("chat");
    expect(text).not.toContain("comments");
    expect(text).not.toContain("comentários");
  });

  it("bottom nav renders only Perfil and Comunidade", () => {
    renderState("first_reading_free");
    const nav = screen.getByLabelText("Navegação mobile principal");

    expect(within(nav).getByText("Perfil")).toBeInTheDocument();
    expect(within(nav).getByText("Comunidade")).toBeInTheDocument();
    expect(within(nav).queryByText("+")).not.toBeInTheDocument();
  });

  it("bottom nav does not render Mídia Kit, Diagnóstico or Comercial as global tabs", () => {
    renderState("media_kit_available");
    const nav = screen.getByLabelText("Navegação mobile principal");

    expect(within(nav).queryByText("Mídia Kit")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Diagnóstico")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Comercial")).not.toBeInTheDocument();
  });

  it("all required preview states continue rendering", () => {
    for (const state of [
      "anonymous_view_profile",
      "anonymous_analyze_video",
      "account_only",
      "first_reading_free",
      "premium_without_instagram",
      "instagram_optimized",
      "media_kit_available",
    ] satisfies MobileStrategicProfilePreviewFixtureState[]) {
      const { unmount } = renderState(state);

      expect(screen.getByText("Perfil Estratégico mobile")).toBeInTheDocument();
      unmount();
    }
  });

  it("does not render forbidden terms", () => {
    const { container } = renderState("media_kit_available");
    const text = renderedText(container);

    for (const forbidden of [
      "api_key",
      "apikey",
      "base64",
      "signedurl",
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
      "18 sinais",
      "3 narrativas",
      "percentual de perfil",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import forbidden app or integration dependencies", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "fetch",
      "FileReader",
      "localStorage",
      "sessionStorage",
      "router.push",
      "Prisma",
      "banco",
      "Gemini",
      "OpenAI",
      "Stripe",
      "SDK",
      "ActivationPendingWidget",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }

    for (const forbiddenCall of ["fetch(", "router.push", "navigator.clipboard", "navigator.share", "window.open"]) {
      expect(source).not.toContain(forbiddenCall);
    }
  });
});
