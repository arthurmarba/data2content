import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import type { IMapaData } from "@/app/models/MapaSeed";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import { MapaCard } from "./DiagnosticoPage";

const map: IMapaData = {
  narrativa_central: "Transformar a rotina criativa em decisões mais leves",
  territorios: ["Bastidores de criação"],
  temas: ["Um briefing que parecia impossível"],
  narrativas_adjacentes: [],
  assets: ["Mesa do estúdio"],
  assetGroups: [{ label: "Mesa do estúdio", group: "cenario" }],
  tom: "Direto e acolhedor",
  formatos: [],
  maturidade: "instagram_enriched",
  fonte: ["onboarding_declarativo", "instagram"],
};

function renderMap(overrides: Partial<React.ComponentProps<typeof MapaCard>> = {}) {
  const synthesis = buildDiagnosticoPageDataFixture().synthesis;
  return render(
    <MapaCard
      synthesis={synthesis}
      leadingNarrative={resolveDiagnosticoLeadingNarrativeSignal(synthesis)}
      endorsedHypotheses={[]}
      hasReadings
      onNewReading={jest.fn()}
      mapaSeed={map}
      onMapSeedMutate={jest.fn()}
      noShell
      {...overrides}
    />,
  );
}

describe("MapaCard editor completo", () => {
  it("mantém a organização real do mapa com controles humanos de edição", () => {
    renderMap({ headerTitle: "Editar mapa", headerActionLabel: "Analisar conteúdo", saveStatus: "saved" });

    expect(screen.getByText("Editar mapa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar conteúdo" })).toBeInTheDocument();
    expect(screen.getByText("Salvo")).toBeInTheDocument();
    expect(screen.getByText("Assuntos")).toBeInTheDocument();
    expect(screen.getByText("Situações que viram conteúdo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar assunto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar situação" })).toBeInTheDocument();
  });

  it("edita a narrativa central no próprio mapa", () => {
    const onMapSeedMutate = jest.fn();
    renderMap({ onMapSeedMutate });

    fireEvent.click(screen.getByRole("button", { name: "Editar narrativa central" }));
    fireEvent.change(screen.getByLabelText("Narrativa central"), {
      target: { value: "Ensinar criatividade a partir do trabalho real" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar narrativa" }));

    expect(onMapSeedMutate).toHaveBeenCalledWith(
      "narrativa_central",
      "set",
      "Ensinar criatividade a partir do trabalho real",
    );
  });

  it("prioriza o Norte quando ainda não existe nenhum sinal", () => {
    const onOpenNorte = jest.fn();
    const synthesis = buildDiagnosticoPageDataFixture().synthesis;
    const emptySynthesis = {
      ...synthesis,
      status: "empty" as const,
      analyzedReadingsCount: 0,
      mainNarrative: null,
      narrativeTerritories: [],
      toneSignals: [],
      executionPatterns: [],
      confirmedLifeAssets: [],
      testedNarratives: [],
      recurringPatterns: [],
      strengths: [],
    };

    render(
      <MapaCard
        synthesis={emptySynthesis}
        leadingNarrative={null}
        endorsedHypotheses={[]}
        hasReadings={false}
        onNewReading={jest.fn()}
        hasPurpose={false}
        onOpenNorte={onOpenNorte}
        noShell
      />,
    );

    expect(screen.getByText("Comece pelo seu Norte.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Defina seu norte/i }));
    expect(onOpenNorte).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Primeira análise" })).not.toBeInTheDocument();
  });
});
