import fs from "fs";
import path from "path";
import { buildCreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "./creatorStrategicProfileSynthesisFixtures";

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("creatorStrategicProfileSynthesis", () => {
  it("retorna empty quando não há leituras", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({ readings: [] });

    expect(synthesis.status).toBe("empty");
    expect(synthesis.mainNarrative).toBeNull();
  });

  it("uma leitura gera first_reading e não crava padrão definitivo", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading"),
    });
    const text = serialized(synthesis);

    expect(synthesis.status).toBe("first_reading");
    expect(synthesis.mainNarrative).toBeNull();
    expect(text).toContain("primeiro sinal");
    expect(text).not.toContain("padrão definitivo");
  });

  it("duas leituras parecidas geram signals_emerging", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("two_related_readings"),
    });

    expect(synthesis.status).toBe("signals_emerging");
    expect(synthesis.mainNarrative?.confidence).toBe("medium");
    expect(synthesis.mainNarrative?.evidenceCount).toBe(2);
  });

  it("três leituras parecidas geram pattern_in_formation", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(synthesis.status).toBe("pattern_in_formatiOn".toLowerCase());
    expect(synthesis.mainNarrative?.label).toContain("humor cotidiano");
    expect(synthesis.recurringPatterns[0]?.evidenceCount).toBe(3);
  });

  it("confirms_existing_pattern aumenta força de recorrência", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(synthesis.recurringPatterns[0]).toEqual(expect.objectContaining({
      evidenceCount: 3,
    }));
  });

  it("opens_new_hypothesis entra como narrativa em teste", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading"),
    });

    expect(synthesis.testedNarratives[0]?.label).toContain("humor cotidiano");
  });

  it("isolated_strong_video não vira narrativa principal sozinho", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("isolated_strong_video"),
    });

    expect(synthesis.status).toBe("first_reading");
    expect(synthesis.mainNarrative).toBeNull();
    expect(synthesis.strengths.length).toBeGreaterThan(0);
  });

  it("creative_deviation não sobrescreve narrativa principal", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("creative_deviation"),
    });

    expect(synthesis.mainNarrative).toBeNull();
    expect(serialized(synthesis.testedNarratives)).toContain("desvio criativo");
  });

  it("commercial_signal gera território comercial sem match real", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("commercial_signals"),
    });
    const text = serialized(synthesis);

    expect(synthesis.commercialTerritories.length).toBeGreaterThan(0);
    expect(synthesis.collabTerritories.length).toBeGreaterThan(0);
    expect(text).not.toContain("match real");
  });

  it("needs_more_samples gera warning conservador", () => {
    const readings = buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading").map((reading) => ({
      ...reading,
      profileContribution: {
        ...reading.profileContribution,
        type: "needs_more_samples" as const,
      },
    }));

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings });

    expect(synthesis.warnings.map((warning) => warning.code)).toContain("needs_more_samples");
    expect(synthesis.status).toBe("first_reading");
  });

  it("recurringTensions detecta ajustes repetidos", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(synthesis.recurringTensions[0]?.label).toContain("abertura");
    expect(synthesis.recurringTensions[0]?.evidenceCount).toBe(3);
  });

  it("nextStrategicMove é gerado quando há padrão ou tensão suficiente", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(synthesis.nextStrategicMove?.label).toBeTruthy();
    expect(synthesis.nextStrategicMove?.description).toContain("3 vídeos");
  });

  it("não usa termos proibidos", () => {
    const synthesis = buildCreatorStrategicProfileSynthesis({
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("commercial_signals"),
    });
    const text = serialized(synthesis);

    for (const forbidden of [
      "score",
      "nota",
      "viralizar",
      "garantido",
      "certeza",
      "comprovado",
      "match real",
      "publi garantida",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("agregador é puro e não importa persistência, endpoint, SDK ou Snapshot", () => {
    const source = fs.readFileSync(path.join(__dirname, "creatorStrategicProfileSynthesis.ts"), "utf8");

    expect(source).not.toMatch(/connectToDatabase|from ["']mongoose["']|@google\/genai|@aws-sdk|api\/|CreatorStrategicProfileSnapshot|createCreatorVideoNarrativeDiagnosis|fetch\(/);
  });
});
