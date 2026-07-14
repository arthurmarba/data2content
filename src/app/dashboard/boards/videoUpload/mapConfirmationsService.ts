/**
 * mapConfirmationsService.ts
 *
 * Read / write operations for CreatorMapConfirmations.
 * Keeps confirmation state independent from the synthesis snapshot so that
 * new readings never overwrite what the creator already confirmed.
 */
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorMapConfirmations from "@/app/models/CreatorMapConfirmations";
import type {
  ICreatorMapConfirmations,
  MapDimensionConfirmationState,
  MapDimensionConfirmationResponse,
  AssetConfirmationResponse,
  AdjacentNarrativeResponse,
  AdjacentNarrativeSource,
} from "@/app/models/CreatorMapConfirmations";
import { logUsageEvent } from "@/app/lib/dataService/usageEventService";
import { Types } from "mongoose";

// ─── Public shape used by DiagnosticoPageData ─────────────────────────────────

export type MapConfirmationsSnapshot = {
  narrative: MapDimensionConfirmationState;
  territories: MapDimensionConfirmationState;
  tone: MapDimensionConfirmationState;
  assetConfirmations: Array<{ label: string; state: MapDimensionConfirmationState }>;
  /** Labels of hypotheses the creator endorsed via "Faz sentido para mim". */
  endorsedHypotheses: string[];
  /** Labels of hypotheses the creator rejected via "Não faz sentido" — never re-surface. */
  dismissedHypotheses: string[];
  /** Formats the creator confirmed as preferred (subset of ALLOWED_FORMATS). */
  confirmedFormats: string[];
  /**
   * Etapa 4 — Adjacent narratives (narrative extensions/angles) detected by AI
   * or added manually by the creator.
   * pending = detected, awaiting creator validation
   * confirmed = creator said yes / almost
   * dismissed = creator said no
   */
  adjacentNarratives: Array<{
    label: string;
    state: MapDimensionConfirmationState;
    source: AdjacentNarrativeSource;
    response: AdjacentNarrativeResponse | null;
  }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function responseToState(response: MapDimensionConfirmationResponse): MapDimensionConfirmationState {
  return response === "no" ? "dismissed" : "confirmed";
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current confirmation snapshot for a creator, or null if none exists.
 * Never throws — callers should treat null as "all pending".
 */
export async function getMapConfirmationsSnapshot(
  userId: string,
): Promise<MapConfirmationsSnapshot | null> {
  if (!userId || !Types.ObjectId.isValid(userId)) return null;

  try {
    await connectToDatabase();
    const doc = await CreatorMapConfirmations.findOne({
      userId: new Types.ObjectId(userId),
    }).lean<ICreatorMapConfirmations>();

    if (!doc) return null;

    return {
      narrative: doc.narrative?.state ?? "pending",
      territories: doc.territories?.state ?? "pending",
      tone: doc.tone?.state ?? "pending",
      assetConfirmations: (doc.assets ?? []).map((a) => ({
        label: a.label,
        state: a.state ?? "pending",
      })),
      endorsedHypotheses: doc.endorsedHypotheses ?? [],
      dismissedHypotheses: doc.dismissedHypotheses ?? [],
      confirmedFormats: doc.confirmedFormats ?? [],
      adjacentNarratives: (doc.adjacentNarratives ?? []).map((a) => ({
        label: a.label,
        state: a.state ?? "pending",
        source: a.source,
        response: a.response ?? null,
      })),
    };
  } catch {
    // Non-fatal — page renders with "pending" as fallback
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export type ConfirmDimensionParams =
  | { dimension: "narrative" | "territories" | "tone"; response: MapDimensionConfirmationResponse }
  | { dimension: "asset"; response: AssetConfirmationResponse; assetLabel: string };

/**
 * Persists a creator's confirmation response for one map dimension.
 * Uses findOneAndUpdate/upsert so the document is created on first confirmation.
 */
export async function confirmMapDimension(
  userId: string,
  params: ConfirmDimensionParams,
): Promise<{ ok: boolean; state: MapDimensionConfirmationState }> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return { ok: false, state: "pending" };
  }

  await connectToDatabase();
  const now = new Date();

  if (params.dimension === "asset") {
    const assetState: MapDimensionConfirmationState =
      params.response === "no" ? "dismissed" : "confirmed";

    // Replace previous decision for the same asset label, then append the latest one.
    await CreatorMapConfirmations.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $pull: { assets: { label: params.assetLabel } },
      },
    );
    await CreatorMapConfirmations.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $push: {
          assets: {
            label: params.assetLabel,
            state: assetState,
            response: params.response,
            confirmedAt: now,
          },
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );

    logUsageEvent(userId, "map_dimension_confirmed", "mapa", { dimension: "asset", platform: "mobile" });

    return { ok: true, state: assetState };
  }

  // narrative | territories | tone
  const dimensionState = responseToState(params.response);
  const fieldPrefix = params.dimension; // "narrative" | "territories" | "tone"

  await CreatorMapConfirmations.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: {
        [`${fieldPrefix}.state`]: dimensionState,
        [`${fieldPrefix}.response`]: params.response,
        [`${fieldPrefix}.confirmedAt`]: now,
        updatedAt: now,
      },
    },
    { upsert: true, new: true },
  );

  logUsageEvent(userId, "map_dimension_confirmed", "mapa", { dimension: params.dimension, platform: "mobile" });

  return { ok: true, state: dimensionState };
}

// ─── Adjacent narratives ──────────────────────────────────────────────────────

/**
 * Saves AI-detected adjacent narrative candidates as "pending" items.
 * Skips labels that already exist in the document (any state) to avoid
 * re-proposing dismissed candidates.
 *
 * Idempotent: safe to call multiple times — only new labels are inserted.
 */
export async function upsertDetectedAdjacentNarratives(
  userId: string,
  candidates: Array<{ label: string }>,
): Promise<void> {
  if (!userId || !Types.ObjectId.isValid(userId) || candidates.length === 0) return;

  await connectToDatabase();

  // Fetch existing labels to skip duplicates
  const doc = await CreatorMapConfirmations.findOne(
    { userId: new Types.ObjectId(userId) },
    { adjacentNarratives: 1 },
  ).lean<Pick<ICreatorMapConfirmations, "adjacentNarratives">>();

  const existingLabelsLower = new Set(
    (doc?.adjacentNarratives ?? []).map((a) => a.label.toLowerCase().trim()),
  );

  const newItems = candidates.filter(
    (c) => !existingLabelsLower.has(c.label.toLowerCase().trim()),
  );
  if (newItems.length === 0) return;

  await CreatorMapConfirmations.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $push: {
        adjacentNarratives: {
          $each: newItems.map((c) => ({
            label: c.label,
            state: "pending",
            source: "detected",
            response: null,
            confirmedAt: null,
          })),
        },
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * Records the creator's response to one adjacent narrative candidate.
 * "yes" / "almost" → state = "confirmed"
 * "no" → state = "dismissed"
 */
export async function confirmAdjacentNarrative(
  userId: string,
  label: string,
  response: AdjacentNarrativeResponse,
): Promise<{ ok: boolean }> {
  if (!userId || !Types.ObjectId.isValid(userId)) return { ok: false };

  await connectToDatabase();
  const now = new Date();
  const state: MapDimensionConfirmationState = response === "no" ? "dismissed" : "confirmed";

  const result = await CreatorMapConfirmations.findOneAndUpdate(
    { userId: new Types.ObjectId(userId), "adjacentNarratives.label": label },
    {
      $set: {
        "adjacentNarratives.$.state": state,
        "adjacentNarratives.$.response": response,
        "adjacentNarratives.$.confirmedAt": now,
        updatedAt: now,
      },
    },
  );

  return { ok: result !== null };
}

/**
 * Adds a creator-entered (manual) adjacent narrative as "confirmed".
 * Skips if the label already exists.
 */
export async function addManualAdjacentNarrative(
  userId: string,
  label: string,
): Promise<{ ok: boolean }> {
  if (!userId || !Types.ObjectId.isValid(userId) || !label.trim()) return { ok: false };

  await connectToDatabase();
  const now = new Date();

  // Check if label already exists
  const doc = await CreatorMapConfirmations.findOne(
    { userId: new Types.ObjectId(userId) },
    { adjacentNarratives: 1 },
  ).lean<Pick<ICreatorMapConfirmations, "adjacentNarratives">>();

  const exists = (doc?.adjacentNarratives ?? []).some(
    (a) => a.label.toLowerCase().trim() === label.toLowerCase().trim(),
  );
  if (exists) return { ok: true }; // idempotent

  await CreatorMapConfirmations.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $push: {
        adjacentNarratives: {
          label: label.trim(),
          state: "confirmed",
          source: "manual",
          response: null,
          confirmedAt: now,
        },
      },
      $set: { updatedAt: now },
    },
    { upsert: true },
  );

  return { ok: true };
}

// ─── Re-propose ───────────────────────────────────────────────────────────────

/**
 * Resets a dimension to "pending" when the synthesis produces a significantly
 * different signal from what was confirmed. Stores the previous label so the
 * UI can show: "Antes era X — agora detectamos Y."
 *
 * Called from the synthesis persistence pipeline (future: Fase 2).
 */
export async function reproposeDimension(
  userId: string,
  dimension: "narrative" | "territories" | "tone",
  previousLabel: string,
): Promise<void> {
  if (!userId || !Types.ObjectId.isValid(userId)) return;

  await connectToDatabase();
  await CreatorMapConfirmations.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: {
        [`${dimension}.state`]: "pending",
        [`${dimension}.response`]: null,
        [`${dimension}.confirmedAt`]: null,
        [`${dimension}.previousLabel`]: previousLabel,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}
