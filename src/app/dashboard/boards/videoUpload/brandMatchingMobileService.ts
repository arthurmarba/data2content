import { matchBrandsForNarrative } from "@/app/lib/brands/brandNarrativeMatcher";
import type { BrandNarrativeMatchResult } from "@/app/lib/brands/brandNarrativeMatchTypes";
import type { CreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import type { MapConfirmationsSnapshot } from "./mapConfirmationsService";

/**
 * Builds brand match suggestions from a creator's profile synthesis.
 *
 * Runs `matchBrandsForNarrative` using the synthesis signals as input keywords
 * and content signals. Returns only alto/medio quality matches (up to 5).
 *
 * Non-fatal: returns [] on any error, on first_reading, or on empty synthesis
 * so the caller's view model render is never blocked.
 */
export async function buildBrandMatchesFromSynthesis(
  synthesis: CreatorStrategicProfileSynthesis,
): Promise<BrandNarrativeMatchResult[]> {
  // Require at least some accumulated signal quality for matches to be meaningful
  if (synthesis.status === "empty" || synthesis.status === "first_reading") {
    return [];
  }

  const keywords = [
    synthesis.mainNarrative?.label,
    ...synthesis.commercialTerritories.map((t) => t.label),
    ...synthesis.strengths.map((s) => s.label).slice(0, 3),
  ].filter((k): k is string => Boolean(k));

  if (keywords.length === 0) return [];

  try {
    const matches = await matchBrandsForNarrative({
      pauta: {
        title: synthesis.mainNarrative?.label ?? keywords[0],
        keywords,
      },
      categories: {
        contentSignals: synthesis.recurringPatterns.map((p) => p.label).slice(0, 6),
      },
      limit: 5,
    });
    // Only surface high-confidence matches to avoid noise
    return matches.filter((m) => m.matchLevel === "alto" || m.matchLevel === "medio");
  } catch {
    return []; // brand matching never blocks the view model render
  }
}

/**
 * Builds brand match suggestions using the creator's CONFIRMED map as the primary signal.
 *
 * When narrative is confirmed, uses the confirmed narrative label as primary keyword.
 * When territories are confirmed, uses all narrative/commercial territory labels.
 * When tone is confirmed, includes dominant tone as content signal.
 * Confirmed assets are included as additional keyword context.
 *
 * Falls back to `buildBrandMatchesFromSynthesis` when the map is not sufficiently confirmed.
 *
 * This ensures brand recommendations reflect what the creator explicitly declared
 * about their own map — not just what the AI inferred from content.
 *
 * Non-fatal: never throws.
 */
export async function buildBrandMatchesFromConfirmedMap(
  synthesis: CreatorStrategicProfileSynthesis,
  mapConfirmations: MapConfirmationsSnapshot | null,
): Promise<{ matches: BrandNarrativeMatchResult[]; confirmedMap: boolean }> {
  // If narrative isn't confirmed yet, fall back to synthesis-based matching
  const narrativeConfirmed = mapConfirmations?.narrative === "confirmed";
  if (!narrativeConfirmed) {
    const matches = await buildBrandMatchesFromSynthesis(synthesis).catch(() => []);
    return { matches, confirmedMap: false };
  }

  if (synthesis.status === "empty" || synthesis.status === "first_reading") {
    return { matches: [], confirmedMap: false };
  }

  const territoriesConfirmed = mapConfirmations?.territories === "confirmed";
  const toneConfirmed = mapConfirmations?.tone === "confirmed";

  // Build keyword list from confirmed map dimensions
  const keywords: string[] = [];

  // 1. Confirmed narrative label (primary signal)
  if (synthesis.mainNarrative?.label) {
    keywords.push(synthesis.mainNarrative.label);
  }

  // 2. Territory labels — use when territories dimension is confirmed
  if (territoriesConfirmed) {
    synthesis.narrativeTerritories?.forEach((t) => keywords.push(t.label));
    synthesis.commercialTerritories?.forEach((t) => keywords.push(t.label));
  } else {
    // Not confirmed yet — still useful as partial signal
    synthesis.commercialTerritories?.slice(0, 2).forEach((t) => keywords.push(t.label));
  }

  // 3. Confirmed assets as additional context (max 3)
  const confirmedAssets = (mapConfirmations?.assetConfirmations ?? [])
    .filter((a) => a.state === "confirmed")
    .map((a) => a.label)
    .slice(0, 3);
  keywords.push(...confirmedAssets);

  // 4. Strengths as signal enrichment
  synthesis.strengths?.slice(0, 2).forEach((s) => keywords.push(s.label));

  const dedupedKeywords = Array.from(new Set(keywords.filter(Boolean)));
  if (dedupedKeywords.length === 0) {
    return { matches: [], confirmedMap: false };
  }

  // Build content signals — include tone when confirmed
  const contentSignals: string[] = synthesis.recurringPatterns?.map((p) => p.label).slice(0, 6) ?? [];
  if (toneConfirmed && synthesis.dominantTone) {
    contentSignals.unshift(synthesis.dominantTone);
  }

  try {
    const matches = await matchBrandsForNarrative({
      pauta: {
        title: synthesis.mainNarrative?.label ?? dedupedKeywords[0],
        keywords: dedupedKeywords,
      },
      categories: { contentSignals: contentSignals.slice(0, 6) },
      limit: 5,
    });
    const filtered = matches.filter((m) => m.matchLevel === "alto" || m.matchLevel === "medio");
    return { matches: filtered, confirmedMap: territoriesConfirmed };
  } catch {
    return { matches: [], confirmedMap: false };
  }
}
