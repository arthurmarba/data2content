import React from "react";
import { render, screen } from "@testing-library/react";
import { DiagnosticoPage } from "./DiagnosticoPage";
import { buildDiagnosticoPageDataFixture, buildDiagnosticoReadingItemFixture } from "./diagnosticoTestFixtures";
import { buildCreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesisFixtures";

describe("DiagnosticoPage narrative fallback", () => {
  it("fills the narrative card from a first-reading hypothesis", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading"),
    });

    render(
      <DiagnosticoPage
        data={buildDiagnosticoPageDataFixture({
          synthesis,
          readings: [
            buildDiagnosticoReadingItemFixture({
              contributionType: "opens_new_hypothesis",
              contributionLabel: "Hipótese em teste",
            }),
          ],
          mainNarrativeLabel: null,
          profileSynthesisStatus: synthesis.status,
        })}
        onNewReading={jest.fn()}
        onOpenReading={jest.fn()}
        onOpenCategory={jest.fn()}
      />,
    );

    expect(screen.getAllByText("humor cotidiano com identificação rápida").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sem narrativa ainda")).not.toBeInTheDocument();
  });
});
