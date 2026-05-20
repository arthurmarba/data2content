import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NarrativeMapMobileShell } from "./NarrativeMapMobileShell";
import { buildNarrativeMapReadingPreviewFixture } from "./buildNarrativeMapReadingPreviewFixture";

function renderShell(state = "narrative_map_three_related_readings", internalReview = false) {
  const fixture = buildNarrativeMapReadingPreviewFixture({ state });
  return render(
    <NarrativeMapMobileShell
      viewModel={fixture.viewModel}
      presentation={fixture.presentation}
      snapshotReview={fixture.synthesisSnapshotWrite}
      internalReview={internalReview}
    />,
  );
}

function renderedText(container: HTMLElement): string {
  return container.textContent?.toLowerCase() ?? "";
}

describe("NarrativeMapMobileShell", () => {
  it("renderiza tabs Perfil, Leituras e Oportunidades", () => {
    renderShell();

    expect(screen.getByRole("tab", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Leituras" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Oportunidades" })).toBeInTheDocument();
  });

  it("Perfil mostra hero Seu mapa narrativo e capitulos do view model", () => {
    renderShell();

    expect(screen.getByText("Seu mapa narrativo")).toBeInTheDocument();
    expect(screen.getByText("Seu padrão")).toBeInTheDocument();
    expect(screen.getByText("Sua tensão")).toBeInTheDocument();
    expect(screen.getByText("Seu movimento")).toBeInTheDocument();
    expect(screen.getByText("Seu território")).toBeInTheDocument();
  });

  it("Leituras mostra itens recentes e Ver leitura abre detalhe seguro", () => {
    renderShell();

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));
    expect(screen.getByText("Leituras documentadas")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ver leitura" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Ver leitura" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Vídeo sobre humor cotidiano com identificação rápida" });
    expect(within(dialog).getByText("Contribuição")).toBeInTheDocument();
    expect(within(dialog).queryByText(/objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath/)).not.toBeInTheDocument();
  });

  it("Leituras mostra empty state quando nao existirem", () => {
    renderShell("narrative_map_no_readings");

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));

    expect(screen.getByText("Nenhuma leitura documentada ainda")).toBeInTheDocument();
  });

  it("Oportunidades mostra territorios e fit narrativo sem match real", () => {
    const { container } = renderShell("narrative_map_commercial_signals");

    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));

    expect(screen.getAllByText("Territórios em formação").length).toBeGreaterThan(0);
    expect(renderedText(container)).toContain("fit narrativo");
    expect(renderedText(container)).not.toContain("match real");
  });

  it("CTA principal e secundaria seguem a hierarquia esperada", () => {
    renderShell();

    expect(screen.getByRole("button", { name: "Nova leitura" })).toHaveAttribute("data-priority", "primary");
    expect(screen.getByRole("button", { name: "Ler diagnóstico completo" })).toHaveAttribute("data-priority", "secondary");
  });

  it("Ler diagnostico completo abre leitura completa sob demanda", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Ler diagnóstico completo" }));

    expect(screen.getByRole("dialog", { name: "Diagnóstico completo" })).toBeInTheDocument();
  });

  it("cards principais nao renderizam fullReading diretamente", () => {
    renderShell();

    expect(screen.queryByText(/síntese dry-run|Capítulos em sequência/i)).not.toBeInTheDocument();
  });

  it("safety note aparece de forma discreta", () => {
    renderShell();

    expect(screen.getByText("A D2C guarda a leitura estratégica, não o vídeo.")).toBeInTheDocument();
  });

  it("Snapshot review panel renderiza auditoria segura apenas em contexto interno", () => {
    const { rerender } = renderShell("narrative_map_three_related_readings", false);

    expect(screen.queryByLabelText("Snapshot write review")).not.toBeInTheDocument();

    const fixture = buildNarrativeMapReadingPreviewFixture({ state: "narrative_map_three_related_readings" });
    rerender(
      <NarrativeMapMobileShell
        viewModel={fixture.viewModel}
        presentation={fixture.presentation}
        snapshotReview={fixture.synthesisSnapshotWrite}
        internalReview
      />,
    );

    const panel = screen.getByLabelText("Snapshot write review");
    expect(within(panel).getByText("attempted")).toBeInTheDocument();
    expect(within(panel).getByText("written")).toBeInTheDocument();
    expect(within(panel).queryByText(/snapshotJson|payload|videoReading|stack trace/i)).not.toBeInTheDocument();
  });

  it("UI nao exibe termos proibidos", () => {
    const { container } = renderShell("narrative_map_commercial_signals", true);
    const text = renderedText(container);

    for (const forbidden of [
      "score",
      "nota",
      "viralizar",
      "garantido",
      "certeza",
      "comprovado",
      "match real",
      "publi garantida",
      "gemini",
      "raw response",
      "objectkey",
      "signedurl",
      "uploadurl",
      "thumbnailurl",
      "localpath",
      "storageproviderpath",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("shell nao chama endpoint real, SDK, storage ou modelo de snapshot", () => {
    const source = [
      "NarrativeMapMobileShell.tsx",
      "NarrativeMapSnapshotReviewPanel.tsx",
    ].map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");

    expect(source).not.toMatch(/fetch\(|analyze-real|@google\/genai|@aws-sdk|CreatorStrategicProfileSnapshot|from ["']mongoose["']/);
  });
});
