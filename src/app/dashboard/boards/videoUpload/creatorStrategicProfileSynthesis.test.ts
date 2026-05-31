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
    expect(serialized(synthesis.testedNarratives)).toContain("nova direção");
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
    expect(synthesis.nextStrategicMove?.description).toContain("3 leituras");
  });

  it("com varias leituras, nao pede mais duas quando o problema e separar tema de narrativa", () => {
    const badBunnyReading =
      "O criador analisa a performance de Bad Bunny no Super Bowl como uma estrategia de negocio, destacando a independencia do artista, a propriedade intelectual e o impacto cultural para construcao de comunidade leal e global.";
    const base = buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading")[0]!;
    const readings = Array.from({ length: 6 }, (_, index) => ({
      ...base,
      diagnosisId: `bad-bunny-${index + 1}`,
      videoReading: {
        ...base.videoReading,
        title: badBunnyReading,
        summary: `Esse video comunica uma direcao de conteudo ligada a ${badBunnyReading}`,
        whatVideoReveals: `Esse video comunica uma direcao de conteudo ligada a ${badBunnyReading}`,
        mainNarrative: badBunnyReading,
        dominantInsight: `Pelo video, a leitura principal aponta para ${badBunnyReading}`,
      },
      strategicRecommendation: {
        ...base.strategicRecommendation,
        mainAdjustment: `A narrativa nao explicita qual eixo pertence ao creator ${index + 1}.`,
        nextExperiment: "Refinar a abertura antes de transformar o video em roteiro.",
        whatToRepeat: badBunnyReading,
      },
    }));

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings });
    const text = serialized(synthesis);

    expect(synthesis.nextStrategicMove?.label).toBe("Separar tema de narrativa");
    expect(synthesis.nextStrategicMove?.label).not.toBe("Criar mais duas leituras");
    expect(synthesis.testedNarratives[0]?.label).toBe("Autonomia criativa como negocio cultural");
    expect(text).not.toContain("o criador analisa");
    expect(text).not.toContain("esse video comunica uma direcao");
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

  it("strengths ficam vazios quando todas as leituras são needs_more_samples", () => {
    const readings = buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings").map((reading) => ({
      ...reading,
      profileContribution: {
        ...reading.profileContribution,
        type: "needs_more_samples" as const,
      },
    }));

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings });

    expect(synthesis.strengths).toHaveLength(0);
  });

  it("tensionBuckets nunca contém texto de suggestedOpening", () => {
    const base = buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings")[0]!;
    const OPENING_TEXT = "Abre com a frase: 'Você sabia que...'";
    const readings = Array.from({ length: 3 }, (_, i) => ({
      ...base,
      diagnosisId: `reading-${i + 1}`,
      speechReading: {
        ...base.speechReading,
        suggestedOpening: OPENING_TEXT,
        openingRead: OPENING_TEXT,
      },
    }));

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings });
    const text = serialized(synthesis.recurringTensions);

    expect(text).not.toContain("abre com a frase");
  });

  it("6 leituras com mesmo nextExperiment geram 1 experimento contextual, não 1 com evidenceCount=6", () => {
    const base = buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading")[0]!;
    const readings = Array.from({ length: 6 }, (_, i) => ({
      ...base,
      diagnosisId: `reading-${i + 1}`,
      profileContribution: {
        ...base.profileContribution,
        type: "opens_new_hypothesis" as const,
      },
      strategicRecommendation: {
        ...base.strategicRecommendation,
        nextExperiment: "Refinar a abertura antes de transformar o video em roteiro.",
      },
    }));

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings });

    expect(synthesis.tacticalExperiments.length).toBeLessThanOrEqual(3);
    expect(synthesis.tacticalExperiments[0]?.summary).not.toContain("Refinar a abertura");
  });

  it("dominantTone reflete o emotionalRegister mais frequente", () => {
    const base = buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings")[0]!;
    const readings = [
      { ...base, diagnosisId: "r1", contentContext: { ...base.contentContext, emotionalRegister: "reflexivo" } },
      { ...base, diagnosisId: "r2", contentContext: { ...base.contentContext, emotionalRegister: "reflexivo" } },
      { ...base, diagnosisId: "r3", contentContext: { ...base.contentContext, emotionalRegister: "direto" } },
    ];

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings });

    expect(synthesis.dominantTone).toBe("reflexivo");
    expect(synthesis.toneSignals.length).toBeGreaterThan(0);
  });
});
