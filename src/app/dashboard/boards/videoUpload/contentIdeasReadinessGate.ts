/**
 * contentIdeasReadinessGate.ts
 *
 * Determines whether the creator's map is ready for pautas (content idea generation).
 *
 * Gate criteria (V2):
 *   - Narrative: creator confirmed it explicitly OR synthesis detected one from readings/MapaSeed
 *   - Territories: creator confirmed them OR synthesis detected at least one territory
 *
 * Explicit confirmation ENRICHES pautas but is no longer a hard gate.
 * If the synthesis already carries the data, generation should proceed.
 *
 * Tom and assets are NOT required — they enrich pautas but aren't gates.
 */
import type { MapConfirmationsSnapshot } from "./mapConfirmationsService";

export type ContentIdeasMissingDimension =
  | "narrative_not_confirmed"
  | "territories_not_confirmed";

export interface ContentIdeasReadiness {
  ready: boolean;
  missingDimensions: ContentIdeasMissingDimension[];
  /** Human-readable next step for the creator. Null when ready. */
  nextStep: string | null;
  /**
   * True when plan tier blocks generation (non-premium, non-admin).
   * The map may already be confirmed — creator just needs to upgrade.
   * When true, `ready` is always false and auto-generate must NOT fire.
   */
  premiumRequired?: boolean;
}

/**
 * @param mapConfirmations  - Explicit creator confirmations (may be null for new users).
 * @param synthesisHasNarrative  - True when the synthesis already carries a mainNarrative label
 *                                 (from readings or MapaSeed). Accepted as fallback for explicit confirmation.
 * @param synthesisHasTerritories - True when the synthesis has at least one narrativeTerritory.
 *                                  Accepted as fallback for explicit confirmation.
 */
export function evaluateContentIdeasReadiness(
  mapConfirmations: MapConfirmationsSnapshot | null,
  synthesisHasNarrative = false,
  synthesisHasTerritories = false,
): ContentIdeasReadiness {
  const missing: ContentIdeasMissingDimension[] = [];

  const narrativeOk =
    mapConfirmations?.narrative === "confirmed" || synthesisHasNarrative;
  const territoriesOk =
    mapConfirmations?.territories === "confirmed" || synthesisHasTerritories;

  if (!narrativeOk) missing.push("narrative_not_confirmed");
  if (!territoriesOk) missing.push("territories_not_confirmed");

  if (missing.length === 0) {
    return { ready: true, missingDimensions: [], nextStep: null };
  }

  let nextStep: string;
  if (missing.includes("narrative_not_confirmed")) {
    nextStep = "Analise um vídeo para o mapa detectar sua narrativa e liberar as pautas.";
  } else {
    nextStep = "Analise mais um vídeo para o mapa detectar seus territórios e liberar as pautas.";
  }

  return { ready: false, missingDimensions: missing, nextStep };
}
