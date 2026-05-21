import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NarrativeMapReadingPreview } from "./NarrativeMapReadingPreview";
import {
  buildNarrativeMapReadingPreviewFixture,
  type NarrativeMapReadingPreviewState,
} from "./buildNarrativeMapReadingPreviewFixture";

const SOURCE_FILES = [
  "NarrativeMapReadingPreview.tsx",
  "NarrativeMapMobileShell.tsx",
  "NarrativeMapSnapshotReviewPanel.tsx",
  "NarrativeMapReadingChapterCard.tsx",
  "NarrativeMapReadingChapterModal.tsx",
  "NarrativeMapReadingFullDiagnosisModal.tsx",
  "buildNarrativeMapReadingPreviewFixture.ts",
];

function renderState(state: NarrativeMapReadingPreviewState = "narrative_map_chapters") {
  return render(<NarrativeMapReadingPreview fixture={buildNarrativeMapReadingPreviewFixture({ state })} />);
}

function renderedText(container: HTMLElement): string {
  return container.textContent?.toLowerCase() ?? "";
}

function openFirstChapter() {
  fireEvent.click(screen.getAllByRole("button", { name: "Ler capítulo" })[0]);
}

describe("NarrativeMapReadingPreview", () => {
  it("renderiza topo compacto", () => {
    renderState();

    const header = screen.getByLabelText("Topo compacto do creator");

    expect(within(header).getByText("Lívia Linhares")).toBeInTheDocument();
    expect(within(header).getByText("@livialinharess · Perfil em formação")).toBeInTheDocument();
    expect(within(header).getAllByText("3").length).toBeGreaterThan(0);
    expect(within(header).getByText("Leituras")).toBeInTheDocument();
    expect(within(header).getByText("1")).toBeInTheDocument();
    expect(within(header).getByText("Padrões")).toBeInTheDocument();
    expect(within(header).getByText("Oportunidades")).toBeInTheDocument();
  });

  it("renderiza hero com headline, subheadline/statusLabel e capitulos", () => {
    renderState();

    expect(screen.getByText("Seu mapa narrativo")).toBeInTheDocument();
    expect(screen.getByText("Um padrão começa a se repetir")).toBeInTheDocument();
    expect(screen.getByText("Padrão em formação")).toBeInTheDocument();
    expect(screen.getAllByText(/narrativa recorrente|começa a se repetir/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Seu padrão")).toBeInTheDocument();
  });

  it("CTA principal Nova leitura tem prioridade maior que Ler diagnostico completo", () => {
    renderState();

    expect(screen.getByRole("button", { name: "Nova leitura" })).toHaveAttribute("data-priority", "primary");
    expect(screen.getByRole("button", { name: "Ler diagnóstico completo" })).toHaveAttribute(
      "data-priority",
      "secondary",
    );
  });

  it("renderiza cards de capitulos com title e preview", () => {
    renderState();

    const profileSection = screen.getByLabelText("Capítulos — Perfil");
    expect(within(profileSection).getByText("Seu padrão")).toBeInTheDocument();
    expect(within(profileSection).getByText("Sua tensão")).toBeInTheDocument();
    expect(within(profileSection).getByText("Seu movimento")).toBeInTheDocument();
    expect(within(profileSection).getByText("Seu território")).toBeInTheDocument();
    expect(within(profileSection).getAllByRole("button", { name: "Ler capítulo" })).toHaveLength(4);
  });

  it("cards nao exibem fullReading diretamente na tela principal", () => {
    renderState();

    expect(screen.queryByText(/Você parece ter mais força quando cuidado cotidiano/i)).not.toBeInTheDocument();
  });

  it("ao clicar em Ler capitulo abre modal com fullReading", () => {
    renderState();
    openFirstChapter();

    const dialog = screen.getByRole("dialog", { name: "Seu padrão" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/síntese dry-run|leitura aparece/i)).toBeInTheDocument();
  });

  it("modal mostra evidence quando disponivel", () => {
    renderState();
    openFirstChapter();

    const dialog = screen.getByRole("dialog", { name: "Seu padrão" });
    expect(within(dialog).getByText("Onde isso aparece")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("modal mostra action quando disponivel", () => {
    renderState();
    openFirstChapter();

    const dialog = screen.getByRole("dialog", { name: "Seu padrão" });
    expect(within(dialog).getByText("Como usar agora")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/3 vídeos|repetir/i).length).toBeGreaterThan(0);
  });

  it("modal fecha corretamente", () => {
    renderState();
    openFirstChapter();

    fireEvent.click(screen.getByRole("button", { name: "Fechar capítulo" }));

    expect(screen.queryByRole("dialog", { name: "Seu padrão" })).not.toBeInTheDocument();
  });

  it("botao Ler diagnostico completo abre leitura completa com multiplos capitulos", () => {
    renderState();

    fireEvent.click(screen.getByRole("button", { name: "Ler diagnóstico completo" }));

    const dialog = screen.getByRole("dialog", { name: "Diagnóstico completo" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("O que este vídeo revela")).toBeInTheDocument();
    expect(within(dialog).getByText("Como pesa no Perfil")).toBeInTheDocument();
    expect(within(dialog).getByText("Oportunidades em formação")).toBeInTheDocument();
    expect(within(dialog).getByText("Onde a D2C percebeu isso")).toBeInTheDocument();
    expect(within(dialog).getByText(/Capítulos em sequência/)).toBeInTheDocument();
  });

  it("estado de primeira leitura nao crava padrao definitivo", () => {
    const { container } = renderState("narrative_map_first_reading");
    const text = renderedText(container);

    expect(screen.getByText("Primeira leitura")).toBeInTheDocument();
    expect(screen.getByText("Seu mapa começou")).toBeInTheDocument();
    expect(text).toContain("ainda é cedo");
    expect(text).not.toContain("padrão reforçado");
    expect(text).not.toContain("padrão definitivo");
  });

  it("estado com Instagram conectado mostra copy de precisao sem prometer performance", () => {
    const { container } = renderState("narrative_map_instagram");
    const text = renderedText(container);

    expect(screen.getByText("Cruzado com Instagram")).toBeInTheDocument();
    expect(text).toContain("cruzado com instagram");
    expect(screen.queryByRole("tab", { name: "Instagram" })).not.toBeInTheDocument();
    expect(text).not.toContain("desempenho garantido");
  });

  it("estado de oportunidades nao promete match real, marca real ou creator real", () => {
    const { container } = renderState("narrative_map_opportunities");

    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));
    const text = renderedText(container);

    expect(text).toContain("território");
    expect(text).toContain("fit narrativo");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("marca real");
    expect(text).not.toContain("creator real");
    expect(text).not.toContain("publi garantida");
  });

  it("renderiza aba Leituras com leitura atual e recentes", () => {
    renderState();

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));

    expect(screen.getByText("Leituras documentadas")).toBeInTheDocument();
    expect(screen.getByText(/Cada vídeo enviado vira uma leitura/)).toBeInTheDocument();
    expect(screen.getAllByText("Vídeo sobre humor cotidiano com identificação rápida").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Narrativa reforçada").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Ver leitura" }).length).toBeGreaterThan(0);
  });

  it("clicar em Ver leitura abre detalhe seguro", () => {
    renderState();

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ver leitura" })[0]);

    const dialog = screen.getByRole("dialog", { name: "Vídeo sobre humor cotidiano com identificação rápida" });
    expect(within(dialog).getByText("Contribuição")).toBeInTheDocument();
    expect(within(dialog).getByText("Como pesa no Perfil")).toBeInTheDocument();
    expect(within(dialog).queryByText(/thumbnailUrl|objectKey|signedUrl|uploadUrl|localPath|storageProviderPath/)).not.toBeInTheDocument();
  });

  it("renderiza empty state quando não há leituras", () => {
    renderState("narrative_map_empty_readings");

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));

    expect(screen.getByText("Nenhuma leitura documentada ainda")).toBeInTheDocument();
  });

  it("renderiza Oportunidades pelo view model sem match real", () => {
    const { container } = renderState("narrative_map_opportunities");

    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));

    expect(screen.getAllByText("Territórios em formação").length).toBeGreaterThan(0);
    expect(screen.getByText(/Fit narrativo possível/)).toBeInTheDocument();
    expect(renderedText(container)).not.toContain("match real");
  });

  it("preview renderiza síntese acumulada no hero e Perfil", () => {
    renderState("narrative_map_three_related_readings");

    expect(screen.getByText("Um padrão começa a se repetir")).toBeInTheDocument();
    expect(screen.getByText("Seu padrão")).toBeInTheDocument();
    expect(screen.getByText("Sua tensão")).toBeInTheDocument();
    expect(screen.getByText("Seu movimento")).toBeInTheDocument();
    expect(screen.getByText("Seu território")).toBeInTheDocument();
  });

  it("preview renderiza sinal emergente para duas leituras", () => {
    renderState("narrative_map_two_related_readings");

    expect(screen.getByText("Um sinal começa a aparecer")).toBeInTheDocument();
    expect(screen.getByText("Sinais em formação")).toBeInTheDocument();
  });

  it("preview mostra Leituras recentes a partir da síntese", () => {
    renderState("narrative_map_three_related_readings");

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));

    expect(screen.getAllByText("Vídeo sobre humor cotidiano com identificação rápida").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Ver leitura" })).toHaveLength(3);
  });

  it("preview mostra Oportunidades com territórios da síntese", () => {
    renderState("narrative_map_commercial_signals");

    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));

    expect(screen.getAllByText(/rotina real/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Collab de problema/i)).toBeInTheDocument();
  });

  it("preview nao chama endpoint real ou mock", () => {
    const source = SOURCE_FILES
      .map((file) => fs.readFileSync(path.join(__dirname, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/fetch\(|axios|analyze-real\/route|analyze\/route|api\/dashboard\/mobile-strategic-profile|videoNarrativeEndpointMockMode/);
  });

  it("preview nao importa SDKs, Mongoose, service de persistencia ou CreatorStrategicProfileSnapshot", () => {
    const source = SOURCE_FILES
      .map((file) => fs.readFileSync(path.join(__dirname, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/@google\/genai|@aws-sdk|from ["']mongoose["']|CreatorVideoNarrativeDiagnosis\.|creatorVideoNarrativeDiagnosisService|createCreatorVideoNarrativeDiagnosis|CreatorStrategicProfileSnapshot/);
  });

  it("preview nao altera MobileStrategicProfile real fora do ambiente interno", () => {
    const source = fs.readFileSync(path.join(__dirname, "MobileStrategicProfilePreview.tsx"), "utf8");

    expect(source).not.toContain("NarrativeMapReadingPreview");
    expect(source).not.toContain("narrative_map_chapters");
  });

  it("nao exibe termos proibidos na UI", () => {
    const { container } = renderState("narrative_map_opportunities");
    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));
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
});
