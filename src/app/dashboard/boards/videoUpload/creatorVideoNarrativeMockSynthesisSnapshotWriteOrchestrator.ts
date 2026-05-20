import {
  buildCreatorStrategicProfileSynthesis,
  type CreatorStrategicProfileSynthesis,
} from "./creatorStrategicProfileSynthesis";
import {
  listRecentCreatorVideoNarrativeDiagnosesForUser,
  type CreatorVideoNarrativeDiagnosisSafeReading,
} from "./creatorVideoNarrativeDiagnosisReadService";
import {
  persistCreatorStrategicProfileSynthesis,
  type CreatorStrategicProfileSynthesisPersistenceResult,
} from "./creatorStrategicProfileSynthesisPersistenceService";

export type ControlledVideoReadingSynthesisSnapshotWriteErrorCode =
  | "synthesis_write_disabled"
  | "saved_reading_not_found"
  | "synthesis_empty"
  | "synthesis_snapshot_write_failed"
  | "insufficient_evidence"
  | "unknown_synthesis_write_error";

export interface ControlledVideoReadingSynthesisSnapshotWriteParams {
  userId: string;
  savedDiagnosisId: string;
  enableSnapshotWrite: boolean;
  source: "mock_internal";
  requestId?: string | null;
}

export interface ControlledVideoReadingSynthesisSnapshotWriteResult {
  attempted: boolean;
  written: boolean;
  skippedReason?: ControlledVideoReadingSynthesisSnapshotWriteErrorCode;
  synthesisStatus?: CreatorStrategicProfileSynthesis["status"];
  analyzedReadingsCount?: number;
  snapshotId?: string;
  updatedAt?: string;
}

export interface ControlledVideoReadingSynthesisSnapshotWriteDeps {
  listReadingsForUser?: (params: { userId: string; limit?: number }) => Promise<CreatorVideoNarrativeDiagnosisSafeReading[]>;
  buildSynthesis?: typeof buildCreatorStrategicProfileSynthesis;
  persistSynthesisSnapshot?: typeof persistCreatorStrategicProfileSynthesis;
}

function skipped(
  params: Omit<ControlledVideoReadingSynthesisSnapshotWriteResult, "written">,
): ControlledVideoReadingSynthesisSnapshotWriteResult {
  return {
    ...params,
    written: false,
  };
}

function mapPersistenceFailure(
  result: Extract<CreatorStrategicProfileSynthesisPersistenceResult, { ok: false }>,
): ControlledVideoReadingSynthesisSnapshotWriteErrorCode {
  if (result.errorCode === "insufficient_synthesis_evidence") return "insufficient_evidence";
  if (result.errorCode === "synthesis_snapshot_write_failed") return "synthesis_snapshot_write_failed";
  return "unknown_synthesis_write_error";
}

export async function runControlledVideoReadingSynthesisSnapshotWrite(
  params: ControlledVideoReadingSynthesisSnapshotWriteParams,
  deps: ControlledVideoReadingSynthesisSnapshotWriteDeps = {},
): Promise<ControlledVideoReadingSynthesisSnapshotWriteResult> {
  if (params.enableSnapshotWrite !== true) {
    return skipped({
      attempted: false,
      skippedReason: "synthesis_write_disabled",
    });
  }

  if (params.source !== "mock_internal" || !params.userId.trim() || !params.savedDiagnosisId.trim()) {
    return skipped({
      attempted: true,
      skippedReason: "saved_reading_not_found",
    });
  }

  try {
    const listReadingsForUser = deps.listReadingsForUser ?? listRecentCreatorVideoNarrativeDiagnosesForUser;
    const readings = await listReadingsForUser({ userId: params.userId, limit: 12 });
    const savedReading = readings.find((reading) => reading.diagnosisId === params.savedDiagnosisId);

    if (!savedReading) {
      return skipped({
        attempted: true,
        skippedReason: "saved_reading_not_found",
      });
    }

    const buildSynthesis = deps.buildSynthesis ?? buildCreatorStrategicProfileSynthesis;
    const synthesis = buildSynthesis({ readings });

    if (synthesis.status === "empty") {
      return skipped({
        attempted: true,
        skippedReason: "synthesis_empty",
        synthesisStatus: synthesis.status,
        analyzedReadingsCount: synthesis.analyzedReadingsCount,
      });
    }

    const persistSynthesisSnapshot = deps.persistSynthesisSnapshot ?? persistCreatorStrategicProfileSynthesis;
    const persistResult = await persistSynthesisSnapshot({
      userId: params.userId,
      synthesis,
      mode: "write",
      expectedSource: "video_reading_synthesis_v1",
    });

    if (!persistResult.ok) {
      return skipped({
        attempted: true,
        skippedReason: mapPersistenceFailure(persistResult),
        synthesisStatus: synthesis.status,
        analyzedReadingsCount: synthesis.analyzedReadingsCount,
      });
    }

    return {
      attempted: true,
      written: true,
      synthesisStatus: persistResult.synthesisStatus,
      analyzedReadingsCount: persistResult.analyzedReadingsCount,
      snapshotId: persistResult.snapshotId,
      updatedAt: persistResult.updatedAt,
    };
  } catch {
    return skipped({
      attempted: true,
      skippedReason: "unknown_synthesis_write_error",
    });
  }
}
