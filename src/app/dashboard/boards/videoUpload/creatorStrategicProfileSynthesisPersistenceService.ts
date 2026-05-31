import { Types } from "mongoose";
import type { CreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import {
  CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_SOURCE,
  CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_VERSION,
  mapCreatorStrategicProfileSynthesisToSnapshotPayload,
} from "./creatorStrategicProfileSynthesisSnapshotMapper";
import type {
  CreatorStrategicProfileSnapshotInput,
  MobileStrategicProfileSnapshotPayload,
} from "./mobileStrategicProfileSnapshotTypes";
import { upsertStrategicProfileSnapshot, validateSnapshotPayload } from "./mobileStrategicProfileSnapshotService";
import { reproposeConfirmationsIfSynthesisChanged } from "./mapConfirmationReproposalService";

export type CreatorStrategicProfileSynthesisPersistenceMode = "dry_run" | "write";

export type CreatorStrategicProfileSynthesisPersistenceErrorCode =
  | "invalid_synthesis_input"
  | "unsafe_synthesis_payload"
  | "synthesis_snapshot_write_failed"
  | "insufficient_synthesis_evidence"
  | "unknown_synthesis_persistence_error";

export interface PersistCreatorStrategicProfileSynthesisParams {
  userId: string;
  synthesis: CreatorStrategicProfileSynthesis;
  accessLevel?: "free" | "premium" | "instagram_optimized";
  mode?: CreatorStrategicProfileSynthesisPersistenceMode;
  expectedSource?: typeof CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_SOURCE;
  previousSnapshot?: MobileStrategicProfileSnapshotPayload | null;
}

export interface CreatorStrategicProfileSynthesisPersistenceDeps {
  upsertSnapshot?: typeof upsertStrategicProfileSnapshot;
}

export type CreatorStrategicProfileSynthesisPersistenceResult =
  | {
      ok: true;
      mode: CreatorStrategicProfileSynthesisPersistenceMode;
      userId: string;
      snapshotId?: string;
      payload: MobileStrategicProfileSnapshotPayload;
      synthesisVersion: string;
      synthesisStatus: CreatorStrategicProfileSynthesis["status"];
      analyzedReadingsCount: number;
      updatedAt: string;
    }
  | {
      ok: false;
      errorCode: CreatorStrategicProfileSynthesisPersistenceErrorCode;
      message: string;
    };

function invalidResult(
  errorCode: CreatorStrategicProfileSynthesisPersistenceErrorCode,
  message: string,
): CreatorStrategicProfileSynthesisPersistenceResult {
  return { ok: false, errorCode, message };
}

function validateSynthesisInput(params: PersistCreatorStrategicProfileSynthesisParams): CreatorStrategicProfileSynthesisPersistenceResult | null {
  if (!params.userId || !Types.ObjectId.isValid(params.userId)) {
    return invalidResult("invalid_synthesis_input", "UserId invalido para persistir sintese do Perfil.");
  }

  if (params.expectedSource && params.expectedSource !== CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_SOURCE) {
    return invalidResult("invalid_synthesis_input", "Origem da sintese nao permitida para este write path.");
  }

  if (!params.synthesis || typeof params.synthesis !== "object" || !params.synthesis.status) {
    return invalidResult("invalid_synthesis_input", "Sintese invalida para persistencia do Perfil.");
  }

  if (!Number.isFinite(params.synthesis.analyzedReadingsCount) || params.synthesis.analyzedReadingsCount < 0) {
    return invalidResult("invalid_synthesis_input", "Sintese sem contador seguro de leituras analisadas.");
  }

  return null;
}

function blocksWrite(synthesis: CreatorStrategicProfileSynthesis): boolean {
  return synthesis.status === "empty";
}

export async function persistCreatorStrategicProfileSynthesis(
  params: PersistCreatorStrategicProfileSynthesisParams,
  deps: CreatorStrategicProfileSynthesisPersistenceDeps = {},
): Promise<CreatorStrategicProfileSynthesisPersistenceResult> {
  const mode = params.mode ?? "dry_run";
  const invalid = validateSynthesisInput(params);
  if (invalid) return invalid;

  let payload: MobileStrategicProfileSnapshotPayload;
  try {
    payload = validateSnapshotPayload(mapCreatorStrategicProfileSynthesisToSnapshotPayload({
      synthesis: params.synthesis,
      previousSnapshot: params.previousSnapshot,
    }));
  } catch {
    return invalidResult("unsafe_synthesis_payload", "A sintese gerou payload inseguro para o snapshot.");
  }

  if (mode === "dry_run") {
    return {
      ok: true,
      mode,
      userId: params.userId,
      payload,
      synthesisVersion: CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_VERSION,
      synthesisStatus: params.synthesis.status,
      analyzedReadingsCount: params.synthesis.analyzedReadingsCount,
      updatedAt: params.synthesis.generatedAt,
    };
  }

  if (blocksWrite(params.synthesis)) {
    return invalidResult(
      "insufficient_synthesis_evidence",
      "Sintese vazia nao pode sobrescrever o snapshot do Perfil.",
    );
  }

  try {
    const upsertSnapshot = deps.upsertSnapshot ?? upsertStrategicProfileSnapshot;
    const result = await upsertSnapshot({
      userId: params.userId,
      accessLevel: params.accessLevel ?? "free",
      snapshot: payload,
      source: CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_SOURCE,
      lastAnalyzedAt: new Date(params.synthesis.generatedAt),
    } satisfies CreatorStrategicProfileSnapshotInput);

    // Side effect: check whether the new synthesis diverges from what the creator
    // previously confirmed and, if so, reset those dimensions to "pending" so the
    // map can re-propose. Non-fatal — failures here never block persistence.
    void reproposeConfirmationsIfSynthesisChanged(result.userId, params.synthesis);

    return {
      ok: true,
      mode,
      userId: result.userId,
      payload,
      synthesisVersion: CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_VERSION,
      synthesisStatus: params.synthesis.status,
      analyzedReadingsCount: params.synthesis.analyzedReadingsCount,
      updatedAt: (result.lastAnalyzedAt ?? new Date(params.synthesis.generatedAt)).toISOString(),
    };
  } catch {
    return invalidResult("synthesis_snapshot_write_failed", "Nao foi possivel persistir a sintese do Perfil.");
  }
}
