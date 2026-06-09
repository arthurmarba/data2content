import fs from "fs";
import path from "path";
import { buildCreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "./creatorStrategicProfileSynthesisFixtures";
import {
  runControlledVideoReadingSynthesisSnapshotWrite,
  type ControlledVideoReadingSynthesisSnapshotWriteResult,
} from "./creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator";
import type { CreatorVideoNarrativeDiagnosisSafeReading } from "./creatorVideoNarrativeDiagnosisReadService";

const USER_ID = "665f0f2c8a0b7d1f2c3a4b5c";

function readings(state: Parameters<typeof buildCreatorStrategicProfileSynthesisReadingsFixture>[0]) {
  return buildCreatorStrategicProfileSynthesisReadingsFixture(state);
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function expectSafeAuditResult(result: ControlledVideoReadingSynthesisSnapshotWriteResult): void {
  const text = serialized(result);

  expect(text).not.toContain("snapshotjson");
  expect(text).not.toContain("payload");
  expect(text).not.toContain("videoreading");
  expect(text).not.toContain("speechreading");
  expect(text).not.toContain("objectkey");
  expect(text).not.toContain("signedurl");
  expect(text).not.toContain("uploadurl");
  expect(text).not.toContain("thumbnailurl");
  expect(text).not.toContain("localpath");
  expect(text).not.toContain("storageproviderpath");
}

describe("creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator", () => {
  it("nao escreve snapshot quando enableSnapshotWrite=false", async () => {
    const persistSynthesisSnapshot = jest.fn();

    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-pattern-1",
      enableSnapshotWrite: false,
      source: "mock_internal",
    }, { persistSynthesisSnapshot });

    expect(result).toEqual({
      attempted: false,
      written: false,
      skippedReason: "synthesis_write_disabled",
    });
    expect(persistSynthesisSnapshot).not.toHaveBeenCalled();
  });

  it("escreve snapshot quando enableSnapshotWrite=true e ha leituras suficientes", async () => {
    const listReadingsForUser = jest.fn().mockResolvedValue(readings("three_related_readings"));
    const persistSynthesisSnapshot = jest.fn().mockResolvedValue({
      ok: true,
      mode: "write",
      userId: USER_ID,
      synthesisVersion: "creator_profile_synthesis_snapshot_v1",
      synthesisStatus: "pattern_in_formation",
      analyzedReadingsCount: 3,
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-pattern-1",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, { listReadingsForUser, persistSynthesisSnapshot });

    expect(result).toEqual({
      attempted: true,
      written: true,
      synthesisStatus: "pattern_in_formation",
      analyzedReadingsCount: 3,
      updatedAt: "2026-05-20T00:00:00.000Z",
    });
    expect(persistSynthesisSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      mode: "write",
      expectedSource: "video_reading_synthesis_v1",
    }));
  });

  it("exclui leituras 'no' da síntese persistida (filtro publishIntent)", async () => {
    // 3 leituras recorrentes; uma marcada como 'não vou publicar'.
    const withNo = readings("three_related_readings").map((r, i) =>
      i === 1 ? { ...r, publishIntent: "no" as const } : r,
    );
    const persistSynthesisSnapshot = jest.fn().mockResolvedValue({
      ok: true,
      mode: "write",
      userId: USER_ID,
      synthesisVersion: "creator_profile_synthesis_snapshot_v1",
      synthesisStatus: "signals_emerging",
      analyzedReadingsCount: 2,
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    await runControlledVideoReadingSynthesisSnapshotWrite(
      {
        userId: USER_ID,
        savedDiagnosisId: "reading-pattern-1",
        enableSnapshotWrite: true,
        source: "mock_internal",
      },
      // Usa o buildSynthesis real (default) para exercitar o filtro end-to-end.
      { listReadingsForUser: jest.fn().mockResolvedValue(withNo), persistSynthesisSnapshot },
    );

    const synthesisArg = persistSynthesisSnapshot.mock.calls[0][0].synthesis;
    expect(synthesisArg.analyzedReadingsCount).toBe(2);
  });

  it("retorna skipped quando nao ha leitura salva", async () => {
    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "missing-reading",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, {
      listReadingsForUser: jest.fn().mockResolvedValue(readings("three_related_readings")),
      persistSynthesisSnapshot: jest.fn(),
    });

    expect(result).toEqual({
      attempted: true,
      written: false,
      skippedReason: "saved_reading_not_found",
    });
  });

  it("retorna skipped quando synthesis.status=empty", async () => {
    const savedOnly = readings("first_reading").slice(0, 1);
    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-first",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, {
      listReadingsForUser: jest.fn().mockResolvedValue(savedOnly),
      buildSynthesis: jest.fn(() => buildCreatorStrategicProfileSynthesis({ readings: [] })),
      persistSynthesisSnapshot: jest.fn(),
    });

    expect(result).toEqual({
      attempted: true,
      written: false,
      skippedReason: "synthesis_empty",
      synthesisStatus: "empty",
      analyzedReadingsCount: 0,
    });
  });

  it("first_reading escreve apenas estado inicial e nao padrao definitivo", async () => {
    const persistSynthesisSnapshot = jest.fn().mockResolvedValue({
      ok: true,
      mode: "write",
      userId: USER_ID,
      synthesisVersion: "creator_profile_synthesis_snapshot_v1",
      synthesisStatus: "first_reading",
      analyzedReadingsCount: 1,
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-first",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, {
      listReadingsForUser: jest.fn().mockResolvedValue(readings("first_reading")),
      persistSynthesisSnapshot,
    });
    const synthesisArg = persistSynthesisSnapshot.mock.calls[0][0].synthesis;

    expect(result.synthesisStatus).toBe("first_reading");
    expect(synthesisArg.mainNarrative).toBeNull();
    expect(serialized(result)).not.toContain("definitiv");
  });

  it("tres leituras recorrentes escrevem pattern_in_formation", async () => {
    const persistSynthesisSnapshot = jest.fn().mockResolvedValue({
      ok: true,
      mode: "write",
      userId: USER_ID,
      synthesisVersion: "creator_profile_synthesis_snapshot_v1",
      synthesisStatus: "pattern_in_formation",
      analyzedReadingsCount: 3,
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-pattern-2",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, {
      listReadingsForUser: jest.fn().mockResolvedValue(readings("three_related_readings")),
      persistSynthesisSnapshot,
    });

    expect(result.written).toBe(true);
    expect(result.synthesisStatus).toBe("pattern_in_formation");
  });

  it("erro de persistencia vira erro seguro", async () => {
    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-pattern-1",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, {
      listReadingsForUser: jest.fn().mockResolvedValue(readings("three_related_readings")),
      persistSynthesisSnapshot: jest.fn().mockResolvedValue({
        ok: false,
        errorCode: "synthesis_snapshot_write_failed",
        message: "stack trace escondido",
      }),
    });

    expect(result).toEqual({
      attempted: true,
      written: false,
      skippedReason: "synthesis_snapshot_write_failed",
      synthesisStatus: "pattern_in_formation",
      analyzedReadingsCount: 3,
    });
  });

  it("resultado nao contem snapshot completo nem metadados sensiveis", async () => {
    const result = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-commercial-1",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, {
      listReadingsForUser: jest.fn().mockResolvedValue(readings("commercial_signals")),
      persistSynthesisSnapshot: jest.fn().mockResolvedValue({
        ok: true,
        mode: "write",
        userId: USER_ID,
        payload: { snapshotJson: "nao deve voltar" },
        synthesisVersion: "creator_profile_synthesis_snapshot_v1",
        synthesisStatus: "signals_emerging",
        analyzedReadingsCount: 3,
        updatedAt: "2026-05-20T00:00:00.000Z",
      }),
    });

    expectSafeAuditResult(result);
  });

  it("nao chama Gemini/storage nem importa endpoint real", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@google\/genai|@aws-sdk|api\/dashboard|analyze-real|storageProvider|temporaryStorage|fetch\(/);
  });

  it("isolated_strong_video e creative_deviation nao geram auditoria proibida", async () => {
    const isolated = readings("isolated_strong_video");
    const deviation = readings("creative_deviation");
    const listReadingsForUser = jest
      .fn<Promise<CreatorVideoNarrativeDiagnosisSafeReading[]>, [{ userId: string; limit?: number }]>()
      .mockResolvedValueOnce(isolated)
      .mockResolvedValueOnce(deviation);
    const persistSynthesisSnapshot = jest.fn().mockResolvedValue({
      ok: true,
      mode: "write",
      userId: USER_ID,
      synthesisVersion: "creator_profile_synthesis_snapshot_v1",
      synthesisStatus: "first_reading",
      analyzedReadingsCount: 1,
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    const isolatedResult = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-isolated-1",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, { listReadingsForUser, persistSynthesisSnapshot });
    const deviationResult = await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: USER_ID,
      savedDiagnosisId: "reading-deviation-2",
      enableSnapshotWrite: true,
      source: "mock_internal",
    }, { listReadingsForUser, persistSynthesisSnapshot });

    for (const result of [isolatedResult, deviationResult]) {
      const text = serialized(result);
      expect(text).not.toContain("score");
      expect(text).not.toContain("nota");
      expect(text).not.toContain("viralizar");
      expect(text).not.toContain("garantido");
      expect(text).not.toContain("certeza");
      expect(text).not.toContain("comprovado");
      expect(text).not.toContain("match real");
      expect(text).not.toContain("publi garantida");
    }
  });
});
