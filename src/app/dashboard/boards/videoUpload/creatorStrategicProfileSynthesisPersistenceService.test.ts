import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { buildCreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "./creatorStrategicProfileSynthesisFixtures";
import { persistCreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesisPersistenceService";
import { upsertStrategicProfileSnapshot } from "./mobileStrategicProfileSnapshotService";
import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";

jest.mock("./mobileStrategicProfileSnapshotService", () => ({
  validateSnapshotPayload: jest.requireActual("./mobileStrategicProfileSnapshotService").validateSnapshotPayload,
  upsertStrategicProfileSnapshot: jest.fn(),
}));

const mockUpsertStrategicProfileSnapshot = upsertStrategicProfileSnapshot as jest.Mock;

function synthesisFor(state: Parameters<typeof buildCreatorStrategicProfileSynthesisReadingsFixture>[0]) {
  return buildCreatorStrategicProfileSynthesis({
    readings: buildCreatorStrategicProfileSynthesisReadingsFixture(state),
  });
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("creatorStrategicProfileSynthesisPersistenceService", () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("faz upsert/update por userId quando mode write e a sintese tem evidencia", async () => {
    const synthesis = synthesisFor("three_related_readings");
    mockUpsertStrategicProfileSnapshot.mockResolvedValue({
      userId,
      accessLevel: "premium",
      snapshot: {},
      source: "video_reading_synthesis_v1",
      lastAnalyzedAt: new Date(synthesis.generatedAt),
    });

    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis,
      accessLevel: "premium",
      mode: "write",
    });

    expect(result.ok).toBe(true);
    expect(mockUpsertStrategicProfileSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      accessLevel: "premium",
      source: "video_reading_synthesis_v1",
    }));
  });

  it("nao cria multiplos snapshots ativos indevidos porque usa o upsert unico por userId existente", async () => {
    const synthesis = synthesisFor("three_related_readings");
    mockUpsertStrategicProfileSnapshot.mockResolvedValue({
      userId,
      accessLevel: "free",
      snapshot: {},
      source: "video_reading_synthesis_v1",
      lastAnalyzedAt: new Date(synthesis.generatedAt),
    });

    await persistCreatorStrategicProfileSynthesis({ userId, synthesis, mode: "write" });

    expect(mockUpsertStrategicProfileSnapshot).toHaveBeenCalledTimes(1);
    expect(mockUpsertStrategicProfileSnapshot.mock.calls[0][0]).not.toHaveProperty("status", "inactive");
  });

  it("retorna resultado seguro", async () => {
    const synthesis = synthesisFor("two_related_readings");
    mockUpsertStrategicProfileSnapshot.mockResolvedValue({
      userId,
      accessLevel: "free",
      snapshot: {},
      source: "video_reading_synthesis_v1",
      lastAnalyzedAt: new Date(synthesis.generatedAt),
    });

    const result = await persistCreatorStrategicProfileSynthesis({ userId, synthesis, mode: "write" });
    const text = serialized(result);

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      userId,
      synthesisStatus: "signals_emerging",
      analyzedReadingsCount: 2,
    }));
    expect(text).not.toContain("stack");
    expect(text).not.toContain("objectkey");
    expect(text).not.toContain("signedurl");
  });

  it("erro de banco vira erro seguro sem stack trace", async () => {
    mockUpsertStrategicProfileSnapshot.mockRejectedValue(new Error("database stack trace with token"));

    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("three_related_readings"),
      mode: "write",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "synthesis_snapshot_write_failed",
      message: "Nao foi possivel persistir a sintese do Perfil.",
    });
  });

  it("modo dry_run nao escreve no banco", async () => {
    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("three_related_readings"),
    });

    expect(result.ok).toBe(true);
    expect(result).toEqual(expect.objectContaining({ mode: "dry_run" }));
    expect(mockUpsertStrategicProfileSnapshot).not.toHaveBeenCalled();
  });

  it("nao salva leituras completas no snapshot", async () => {
    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("three_related_readings"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const text = serialized(result.payload);
      expect(text).not.toContain("videoreading");
      expect(text).not.toContain("speechreading");
      expect(text).not.toContain("productionreading");
      expect(text).not.toContain("profilecontribution");
    }
  });

  it("nao salva video metadata sensivel", async () => {
    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("commercial_signals"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const text = serialized(result.payload);
      for (const forbidden of ["videometadata", "objectkey", "signedurl", "uploadurl", "thumbnailurl", "localpath", "storageproviderpath"]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("nao sobrescreve com empty synthesis por acidente", async () => {
    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("no_readings"),
      mode: "write",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "insufficient_synthesis_evidence",
      message: "Sintese vazia nao pode sobrescrever o snapshot do Perfil.",
    });
    expect(mockUpsertStrategicProfileSnapshot).not.toHaveBeenCalled();
  });

  it("first_reading nao vira narrativa principal definitiva", async () => {
    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("first_reading"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.profileState).toBe("first_reading");
      expect(result.payload.recurringPatterns).toEqual([]);
      expect(serialized(result.payload)).not.toContain("definitiv");
    }
  });

  it("sintese isolada nao apaga padrao existente sem evidencia suficiente", async () => {
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

    const result = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("isolated_strong_video"),
      previousSnapshot,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.recurringPatterns).toEqual(["Padrao existente acumulado"]);
    }
  });

  it("valida userId e expectedSource", async () => {
    const invalidUser = await persistCreatorStrategicProfileSynthesis({
      userId: "invalido",
      synthesis: synthesisFor("three_related_readings"),
      mode: "write",
    });

    const invalidSource = await persistCreatorStrategicProfileSynthesis({
      userId,
      synthesis: synthesisFor("three_related_readings"),
      expectedSource: "wrong_source" as any,
      mode: "write",
    });

    expect(invalidUser).toEqual(expect.objectContaining({ ok: false, errorCode: "invalid_synthesis_input" }));
    expect(invalidSource).toEqual(expect.objectContaining({ ok: false, errorCode: "invalid_synthesis_input" }));
    expect(mockUpsertStrategicProfileSnapshot).not.toHaveBeenCalled();
  });

  it("nao importa endpoint real/mock nem chama Gemini/storage", () => {
    const source = fs.readFileSync(path.join(__dirname, "creatorStrategicProfileSynthesisPersistenceService.ts"), "utf8");

    expect(source).not.toMatch(/api\/|@google\/genai|@aws-sdk|storageProvider|temporaryStorage|fetch\(/);
  });

  it("selector e preview continuam dry-run sem importar o service de persistencia", () => {
    const selector = fs.readFileSync(path.join(__dirname, "narrativeMapMobileViewModelServerSelector.ts"), "utf8");
    const preview = fs.readFileSync(
      path.join(__dirname, "../components/videoUpload/appPreview/NarrativeMapReadingPreview.tsx"),
      "utf8",
    );

    expect(selector).not.toContain("persistCreatorStrategicProfileSynthesis");
    expect(preview).not.toContain("persistCreatorStrategicProfileSynthesis");
    expect(preview).not.toContain("CreatorStrategicProfileSnapshot");
  });

  it("nao integra o write path novo ao caminho direto antigo de analise para snapshot", () => {
    const realOrchestrator = fs.readFileSync(path.join(__dirname, "videoNarrativeRealAnalysisOrchestrator.ts"), "utf8");
    const realRoute = fs.readFileSync(
      path.join(__dirname, "../../../api/dashboard/mobile-strategic-profile/analyze/route.ts"),
      "utf8",
    );
    const internalMockRoute = fs.readFileSync(
      path.join(__dirname, "../../../api/internal/video-narrative/analyze/route.ts"),
      "utf8",
    );

    expect(realOrchestrator).not.toContain("persistCreatorStrategicProfileSynthesis");
    expect(realRoute).not.toContain("persistCreatorStrategicProfileSynthesis");
    expect(internalMockRoute).not.toContain("persistCreatorStrategicProfileSynthesis");
  });
});
