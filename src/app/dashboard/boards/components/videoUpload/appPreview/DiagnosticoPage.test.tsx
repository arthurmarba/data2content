import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoPage } from "./DiagnosticoPage";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";

const EMPTY_SYNTHESIS: CreatorStrategicProfileSynthesis = {
  id: "empty",
  status: "empty",
  analyzedReadingsCount: 0,
  mainNarrative: null,
  testedNarratives: [],
  recurringPatterns: [],
  recurringTensions: [],
  strengths: [],
  commercialTerritories: [],
  collabTerritories: [],
  narrativeTerritories: [],
  dominantTone: null,
  toneSignals: [],
  executionPatterns: [],
  commercialReasoning: [],
  tacticalExperiments: [],
  confirmedLifeAssets: [],
  topPerformingPattern: null,
  nextStrategicMove: null,
  warnings: [],
  generatedAt: "2026-05-20T00:00:00.000Z",
};

function renderPage(
  props: Partial<React.ComponentProps<typeof DiagnosticoPage>> = {},
) {
  return render(
    <DiagnosticoPage
      data={buildDiagnosticoPageDataFixture(props.data ? undefined : {})}
      onNewReading={jest.fn()}
      onOpenReading={jest.fn()}
      {...props}
    />,
  );
}

describe("DiagnosticoPage", () => {
  it("renders the creator home with brand heading and greeting", () => {
    renderPage({
      data: buildDiagnosticoPageDataFixture({
        userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, mediaKitSlug: null },
      }),
    });

    expect(screen.getByRole("heading", { level: 1, name: "data2content" })).toBeInTheDocument();
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
  });

  it("opens account settings from the avatar button", () => {
    const onOpenAccountMenu = jest.fn();
    renderPage({ onOpenAccountMenu });

    fireEvent.click(screen.getByRole("button", { name: "Conta e configurações" }));

    expect(onOpenAccountMenu).toHaveBeenCalledTimes(1);
  });

  it("renders the same narrative cards from the Sua Narrativa detail on the home", () => {
    renderPage();

    expect(screen.getByRole("region", { name: "Sua narrativa" })).toBeInTheDocument();
    expect(screen.getByText("SUA NARRATIVA")).toBeInTheDocument();
    expect(screen.getByText("humor cotidiano com identificacao rapida")).toBeInTheDocument();
  });

  it("keeps narrative confirmation available inside the same expandable narrative card", () => {
    const onConfirmNarrative = jest.fn();
    renderPage({
      narrativeConfirmationState: "pending",
      onConfirmNarrative,
    });

    fireEvent.click(screen.getByRole("button", { name: /SUA NARRATIVA/i }));

    expect(screen.getByText("Faz parte do seu mapa?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    expect(onConfirmNarrative).toHaveBeenCalledWith("yes");
  });

  it("shows confirmed state on the exposed narrative", () => {
    renderPage({ narrativeConfirmationState: "confirmed" });

    expect(screen.getByText("No seu mapa")).toBeInTheDocument();
    expect(screen.queryByText("Isso descreve sua narrativa central?")).not.toBeInTheDocument();
  });

  it("keeps the daily ritual as the primary action card", () => {
    const onOpenCategory = jest.fn();
    renderPage({ onOpenCategory });

    expect(screen.getByText("Seu mapa hoje")).toBeInTheDocument();
    expect(screen.getByText("Revise sua narrativa")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Ver narrativa" })[0]!);
    expect(onOpenCategory).toHaveBeenCalledWith("narrative");
  });

  it("renders diagnosis as a compact map status row", () => {
    const onOpenDiagnosis = jest.fn();
    renderPage({ onOpenDiagnosis });

    expect(screen.getByRole("region", { name: "Status do mapa" })).toBeInTheDocument();
    expect(screen.getByText("Sinais surgindo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver mapa/i }));
    expect(onOpenDiagnosis).toHaveBeenCalledTimes(1);
  });

  it("keeps next content as a home card", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 2, name: "Próximo conteúdo" })).toBeInTheDocument();
    expect(screen.getByText("Antes da primeira pauta, confirme seu mapa")).toBeInTheDocument();
  });

  it("does not render permanent execution, analyses, or Instagram metric cards", () => {
    renderPage();

    expect(screen.queryByText("Como Você Executa")).not.toBeInTheDocument();
    expect(screen.queryByText("Suas Análises")).not.toBeInTheDocument();
    expect(screen.queryByText("pessoas alcançadas")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Seus sinais" })).not.toBeInTheDocument();
  });

  it("shows Instagram only when there is a relevant new signal", () => {
    const onOpenCategory = jest.fn();
    renderPage({
      data: buildDiagnosticoPageDataFixture({
        streamBSignalsSummary: {
          postsSinceLastVisit: 3,
          newThemesSinceLastVisit: 1,
          totalPostsAnalyzed: 10,
          mostRecentPostAt: null,
        },
      }),
      onOpenCategory,
    });

    expect(screen.getByRole("heading", { level: 2, name: "Sinal novo" })).toBeInTheDocument();
    expect(screen.getAllByText("Sua grade trouxe sinais novos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3 posts entraram na leitura. Um tema novo apareceu no mapa.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sua grade trouxe sinais novos/i }));
    expect(onOpenCategory).toHaveBeenCalledWith("instagram");
  });

  it("keeps expansion locked until narrative and territories are confirmed", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 2, name: "Expansão" })).toBeInTheDocument();
    expect(screen.getByText("Monetização & Collabs")).toBeInTheDocument();
    expect(screen.queryByText("Marcas Recomendadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Collabs Indicadas")).not.toBeInTheDocument();
  });

  it("shows expansion after narrative and territories are confirmed", () => {
    renderPage({
      data: buildDiagnosticoPageDataFixture({
        mapConfirmations: {
          narrative: "confirmed",
          territories: "confirmed",
          tone: "pending",
          assetConfirmations: [],
          endorsedHypotheses: [],
          dismissedHypotheses: [],
          confirmedFormats: [],
          adjacentNarratives: [],
        },
      }),
    });

    expect(screen.getByRole("heading", { level: 2, name: "Expansão" })).toBeInTheDocument();
    expect(screen.getByText("Marcas Recomendadas")).toBeInTheDocument();
    expect(screen.getByText("Collabs Indicadas")).toBeInTheDocument();
  });

  it("renders empty first-step state without narrative or status rows", () => {
    renderPage({
      data: buildDiagnosticoPageDataFixture({
        readings: [],
        synthesis: EMPTY_SYNTHESIS,
        accessState: "free_unused",
      }),
    });

    expect(screen.getByText("Envie seu primeiro vídeo")).toBeInTheDocument();
    expect(screen.getByText("Comece com uma leitura")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sua narrativa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Status do mapa" })).not.toBeInTheDocument();
  });

  it("starts the first reading from the empty state CTA", () => {
    cleanup();
    const onNewReading = jest.fn();
    renderPage({
      data: buildDiagnosticoPageDataFixture({
        readings: [],
        synthesis: EMPTY_SYNTHESIS,
        accessState: "free_unused",
      }),
      onNewReading,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Enviar primeiro vídeo" })[0]!);
    expect(onNewReading).toHaveBeenCalledTimes(1);
  });
});
