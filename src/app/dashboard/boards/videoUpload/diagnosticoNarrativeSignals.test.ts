import { resolveDiagnosticoLeadingNarrativeSignal } from "./diagnosticoNarrativeSignals";
import { buildCreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "./creatorStrategicProfileSynthesisFixtures";

describe("diagnosticoNarrativeSignals", () => {
  it("uses a first-reading hypothesis as the visible narrative signal", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading"),
    });

    const signal = resolveDiagnosticoLeadingNarrativeSignal(synthesis);

    expect(synthesis.status).toBe("first_reading");
    expect(synthesis.mainNarrative).toBeNull();
    expect(signal).toEqual(expect.objectContaining({
      source: "tested_narrative",
      label: expect.stringContaining("humor cotidiano"),
      confidence: "low",
      evidenceCount: 1,
    }));
  });

  it("prefers confirmed main narrative when the profile has one", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("two_related_readings"),
    });

    const signal = resolveDiagnosticoLeadingNarrativeSignal(synthesis);

    expect(signal).toEqual(expect.objectContaining({
      source: "main_narrative",
      confidence: "medium",
      evidenceCount: 2,
    }));
  });
});
