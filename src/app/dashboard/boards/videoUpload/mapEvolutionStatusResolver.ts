/**
 * mapEvolutionStatusResolver.ts
 *
 * Computes the displayed evolution status of the creator's narrative map.
 *
 * The base synthesis status (`creatorStrategicProfileSynthesis.statusFor`) reflects
 * only Stream A evidence (D2C uploads). This resolver combines that with what the
 * creator has actually confirmed in `mapConfirmations` — so a map can advance to
 * `pattern_in_formation` only when both the IA has gathered evidence AND the
 * creator has confirmed at least one dimension.
 *
 * Promotion rules (creator confirmation gates):
 *   - signals_emerging       → narrative confirmed (creator agreed it fits)
 *   - pattern_in_formation   → narrative + 1+ territories confirmed
 *   - profile_consistent     → narrative + 2+ territories + tone confirmed
 *
 * If the synthesis says "profile_consistent" but the creator never confirmed,
 * we DEMOTE to "signals_emerging" — we trust creator voice over IA evidence.
 */
import type { CreatorStrategicProfileSynthesisStatus } from "./creatorStrategicProfileSynthesis";
import type { MapConfirmationsSnapshot } from "./mapConfirmationsService";

/** All possible displayed statuses. Same vocabulary as the synthesis. */
export type MapEvolutionStatus = CreatorStrategicProfileSynthesisStatus;

const ORDER: MapEvolutionStatus[] = [
  "empty",
  "first_reading",
  "signals_emerging",
  "pattern_in_formation",
  "profile_consistent",
];

function rank(status: MapEvolutionStatus): number {
  const idx = ORDER.indexOf(status);
  return idx < 0 ? 0 : idx;
}

function min(a: MapEvolutionStatus, b: MapEvolutionStatus): MapEvolutionStatus {
  return rank(a) <= rank(b) ? a : b;
}

/**
 * Number of confirmed (not dismissed) territories. Currently we have a single
 * territories-block confirmation in mapConfirmations, so we treat it as binary:
 * 0 if pending/dismissed, 1 if confirmed. Phase 2b can refine to per-territory.
 */
function confirmedTerritoryCount(mapConfirmations: MapConfirmationsSnapshot): number {
  return mapConfirmations.territories === "confirmed" ? 1 : 0;
}

/**
 * Compute the ceiling status allowed by creator confirmations.
 * The displayed status is min(synthesisStatus, confirmationCeiling).
 */
function confirmationCeiling(mapConfirmations: MapConfirmationsSnapshot): MapEvolutionStatus {
  const narrativeConfirmed = mapConfirmations.narrative === "confirmed";
  const toneConfirmed = mapConfirmations.tone === "confirmed";
  const territoryCount = confirmedTerritoryCount(mapConfirmations);

  // profile_consistent gate: narrative + 2+ territories + tone
  // (V1: territory count is binary, so "2+" effectively means "confirmed")
  if (narrativeConfirmed && territoryCount >= 1 && toneConfirmed) {
    return "profile_consistent";
  }
  // pattern_in_formation gate: narrative + 1+ territory
  if (narrativeConfirmed && territoryCount >= 1) {
    return "pattern_in_formation";
  }
  // signals_emerging gate: narrative confirmed
  if (narrativeConfirmed) {
    return "signals_emerging";
  }
  // Without any confirmation, we cap at first_reading (IA can still show signals,
  // but the map hasn't been "owned" by the creator yet)
  return "first_reading";
}

/**
 * Resolve the final evolution status to display.
 *
 * @param synthesisStatus  Status calculated from Stream A evidence
 * @param mapConfirmations Creator's confirmed dimensions (or null when nothing confirmed)
 */
export function resolveMapEvolutionStatus(
  synthesisStatus: CreatorStrategicProfileSynthesisStatus,
  mapConfirmations: MapConfirmationsSnapshot | null,
): MapEvolutionStatus {
  // Empty stays empty — no confirmation gate makes sense yet
  if (synthesisStatus === "empty") return "empty";

  // No confirmations yet — cap at first_reading regardless of how rich the synthesis is.
  // This honours the product principle: "the creator must recognise, not just observe".
  if (!mapConfirmations) {
    return synthesisStatus === "first_reading" ? "first_reading" : "first_reading";
  }

  const ceiling = confirmationCeiling(mapConfirmations);
  return min(synthesisStatus, ceiling);
}
