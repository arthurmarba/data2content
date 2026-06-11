/**
 * U4 — empty-states do card de Collab para Pro com mapa pronto.
 *
 * Cobre os dois branches silenciosos que existiam antes da U4:
 *   1. API retornou 0 resultados (status "ready", items [])
 *   2. API falhou (status "error")
 *
 * Para activar isMapReadyForExpansion, o fixture precisa de:
 *   - hasSynthesis: synthesis.status !== "empty" && analyzedReadingsCount > 0
 *   - mapConfirmations.narrative === "confirmed"
 *   - mapConfirmations.territories === "confirmed"
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoPage } from "./DiagnosticoPage";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import type { DiagnosticoCollabSuggestionsState } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";

const confirmedMapConfirmations = {
  narrative: "confirmed" as const,
  territories: "confirmed" as const,
  tone: "pending" as const,
  assets: [],
  assetConfirmations: [],
  confirmedFormats: [],
  endorsedHypotheses: [],
  dismissedHypotheses: [],
  adjacentNarratives: [],
};

function renderPage(collabSuggestions: DiagnosticoCollabSuggestionsState) {
  const data = buildDiagnosticoPageDataFixture({
    mapConfirmations: confirmedMapConfirmations,
  });
  return render(
    <DiagnosticoPage
      data={data}
      collabSuggestions={collabSuggestions}
      onNewReading={jest.fn()}
      onOpenReading={jest.fn()}
    />,
  );
}

describe("DiagnosticoPage — U4: collab empty-states para Pro com mapa pronto", () => {
  it("status 'ready' + 0 itens: exibe mensagem de busca em andamento", () => {
    renderPage({ status: "ready", items: [], error: null });
    expect(
      screen.getByText("Ainda buscando criadores compatíveis com seu mapa."),
    ).toBeInTheDocument();
  });

  it("status 'error': exibe mensagem de erro com convite a tentar de novo", () => {
    renderPage({ status: "error", items: [], error: "timeout" });
    expect(
      screen.getByText(/Não foi possível carregar as collabs agora/),
    ).toBeInTheDocument();
  });

  it("status 'ready' + 0 itens: NÃO exibe o upgrade teaser (é Pro, não free)", () => {
    renderPage({ status: "ready", items: [], error: null });
    // O teaser de upgrade (cards desfocados) é visível apenas para free.
    expect(screen.queryByText(/Disponível no Pro/i)).not.toBeInTheDocument();
  });

  it("abre Comunidade pelo CTA protegido e Collabs pelo CTA Ver todos", () => {
    const onOpenCategory = jest.fn();
    const onOpenCommunity = jest.fn();
    const data = buildDiagnosticoPageDataFixture({
      mapConfirmations: confirmedMapConfirmations,
    });

    render(
      <DiagnosticoPage
        data={data}
        collabSuggestions={{ status: "ready", items: [], error: null }}
        onNewReading={jest.fn()}
        onOpenReading={jest.fn()}
        onOpenCategory={onOpenCategory}
        onOpenCommunity={onOpenCommunity}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Comunidade" }));
    expect(onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(onOpenCategory).not.toHaveBeenCalledWith("community");

    fireEvent.click(screen.getByRole("button", { name: "Ver todos →" }));
    expect(onOpenCategory).toHaveBeenCalledWith("collabs");
  });

  it("sem mapa pronto (narrative pending): NÃO exibe o empty-state de 0 collabs — exibe o de mapa em formação", () => {
    const data = buildDiagnosticoPageDataFixture({
      mapConfirmations: null, // narrative não confirmada → isMapReadyForExpansion = false
    });
    render(
      <DiagnosticoPage
        data={data}
        collabSuggestions={{ status: "ready", items: [], error: null }}
        onNewReading={jest.fn()}
        onOpenReading={jest.fn()}
      />,
    );
    // Não deve aparecer o "buscando criadores" — o mapa ainda não está pronto.
    expect(
      screen.queryByText("Ainda buscando criadores compatíveis com seu mapa."),
    ).not.toBeInTheDocument();
  });
});
