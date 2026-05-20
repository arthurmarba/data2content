import fs from "fs";
import path from "path";
import { buildCreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "./creatorStrategicProfileSynthesisFixtures";
import { mapCreatorStrategicProfileSynthesisToSnapshotPayload } from "./creatorStrategicProfileSynthesisSnapshotMapper";
import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";

function synthesisFor(state: Parameters<typeof buildCreatorStrategicProfileSynthesisReadingsFixture>[0]) {
  return buildCreatorStrategicProfileSynthesis({
    readings: buildCreatorStrategicProfileSynthesisReadingsFixture(state),
  });
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("creatorStrategicProfileSynthesisSnapshotMapper", () => {
  it("mapeia first_reading para snapshot com linguagem conservadora", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("first_reading"),
    });

    expect(payload.profileState).toBe("first_reading");
    expect(payload.diagnosisSummary).toContain("Primeiro sinal");
    expect(payload.diagnosisSummary).toContain("cedo");
    expect(payload.recurringPatterns).toEqual([]);
  });

  it("mapeia signals_emerging para sinais em formacao sem criar padrao recorrente", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("two_related_readings"),
    });

    expect(payload.profileState).toBe("signals_emerging");
    expect(payload.diagnosisSummary).toContain("Sinal em formacao");
    expect(payload.recurringPatterns).toEqual([]);
  });

  it("mapeia pattern_in_formation para recurringPatterns", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("three_related_readings"),
    });

    expect(payload.profileState).toBe("pattern_in_formation");
    expect(payload.recurringPatterns[0]).toContain("Padrao em formacao");
    expect(payload.recurringPatterns[0]).toContain("humor cotidiano");
  });

  it("mapeia commercialTerritories para opportunities/commercialSummary sem match real", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("commercial_signals"),
    });
    const text = serialized(payload);

    expect(payload.opportunities.some((item) => item.includes("Territorio em formacao"))).toBe(true);
    expect(payload.commercialSummary).toContain("Territorios em formacao");
    expect(text).not.toContain("match real");
  });

  it("mapeia recurringTensions para pontos de atencao recorrentes", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("three_related_readings"),
    });

    expect(payload.pendingSignals.some((signal) => signal.includes("Ponto de atencao recorrente"))).toBe(true);
  });

  it("mapeia nextStrategicMove para recomendacao de proximo movimento", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("three_related_readings"),
    });

    expect(payload.lastAnalysisSummary).toContain("Testar");
    expect(payload.lastAnalysisSummary).toContain("3 vídeos");
  });

  it("nao inclui campos sensiveis", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("commercial_signals"),
    });
    const text = serialized(payload);

    for (const forbidden of ["objectkey", "signedurl", "uploadurl", "thumbnailurl", "localpath", "storageproviderpath"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("nao usa termos proibidos no payload", () => {
    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("commercial_signals"),
    });
    const text = serialized(payload);

    for (const forbidden of ["score", "nota", "viralizar", "garantido", "certeza", "comprovado", "match real", "publi garantida"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("preserva padrao existente quando a sintese isolada ainda nao tem evidencia suficiente", () => {
    const previousSnapshot: MobileStrategicProfileSnapshotPayload = {
      schemaVersion: "mobile_strategic_profile_snapshot_v1",
      profileState: "pattern_in_formation",
      unlockedSignals: ["Sinal anterior"],
      pendingSignals: [],
      recurringPatterns: ["Padrao existente acumulado"],
      opportunities: [],
      diagnosisSummary: "Resumo anterior",
      commercialSummary: "Resumo comercial anterior",
      lastAnalysisSummary: "Movimento anterior",
    };

    const payload = mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: synthesisFor("isolated_strong_video"),
      previousSnapshot,
    });

    expect(payload.recurringPatterns).toEqual(["Padrao existente acumulado"]);
    expect(payload.diagnosisSummary).toContain("Primeiro sinal");
  });

  it("mapper puro nao importa banco, endpoint, SDK ou modelo de snapshot", () => {
    const source = fs.readFileSync(path.join(__dirname, "creatorStrategicProfileSynthesisSnapshotMapper.ts"), "utf8");

    expect(source).not.toMatch(/connectToDatabase|from ["']mongoose["']|@google\/genai|@aws-sdk|api\/|CreatorStrategicProfileSnapshot|fetch\(/);
  });
});
