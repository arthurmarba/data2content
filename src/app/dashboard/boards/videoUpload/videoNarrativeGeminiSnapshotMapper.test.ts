import { validateSnapshotPayload } from "./mobileStrategicProfileSnapshotService";
import { geminiVideoNarrativeResponseFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";
import { mapGeminiAnalysisToStrategicProfileSnapshot } from "./videoNarrativeGeminiSnapshotMapper";

describe("videoNarrativeGeminiSnapshotMapper", () => {
  it("converte análise parseada em snapshotJson versionado", () => {
    const result = mapGeminiAnalysisToStrategicProfileSnapshot({
      analysis: geminiVideoNarrativeResponseFixture,
      source: "gemini_fixture",
      promptVersion: "mm65_v1",
    });
    expect(result.snapshot.schemaVersion).toBe("mobile_strategic_profile_snapshot_v1");
    expect(result.source).toBe("gemini_fixture");
  });

  it("snapshot não inclui raw response", () => {
    const result = mapGeminiAnalysisToStrategicProfileSnapshot({
      analysis: geminiVideoNarrativeResponseFixture,
      promptVersion: "mm65_v1",
    });
    expect(JSON.stringify(result)).not.toContain("rawResponse");
    expect(JSON.stringify(result)).not.toContain("rawText");
  });

  it("snapshot não inclui uploadUrl/objectKey/signed URL/transcript longo", () => {
    const result = mapGeminiAnalysisToStrategicProfileSnapshot({
      analysis: geminiVideoNarrativeResponseFixture,
      promptVersion: "mm65_v1",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("signature=");
    expect(serialized).not.toContain("rawTranscript");
  });

  it("snapshot não cria histórico visual", () => {
    const result = mapGeminiAnalysisToStrategicProfileSnapshot({
      analysis: geminiVideoNarrativeResponseFixture,
      promptVersion: "mm65_v1",
    });
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("histórico de vídeos");
    expect(serialized).not.toContain("vídeos salvos");
  });

  it("snapshot usa source seguro deste PR", () => {
    const result = mapGeminiAnalysisToStrategicProfileSnapshot({
      analysis: geminiVideoNarrativeResponseFixture,
      promptVersion: "mm65_v1",
    });
    expect(result.source).toBe("gemini_ready");
    expect(result.source).not.toBe("gemini_real");
  });

  it("snapshot passa validações do snapshot service MM57", () => {
    const result = mapGeminiAnalysisToStrategicProfileSnapshot({
      analysis: geminiVideoNarrativeResponseFixture,
      promptVersion: "mm65_v1",
    });
    expect(validateSnapshotPayload(result.snapshot)).toEqual(result.snapshot);
  });
});
