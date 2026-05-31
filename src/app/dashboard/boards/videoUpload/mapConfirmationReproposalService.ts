/**
 * mapConfirmationReproposalService.ts
 *
 * After a new synthesis is persisted, this service compares the new synthesis
 * labels against what the creator previously confirmed. When a dimension has
 * shifted substantially, the confirmation is reset to "pending" and the
 * previous label is stored so the UI can show:
 *
 *   "Antes era X — agora detectamos Y. Faz sentido?"
 *
 * This honours the product principle that the map evolves with the creator,
 * not behind them. Significant shifts are surfaced honestly.
 *
 * Called as a side effect of synthesis persistence — non-fatal on errors.
 */
import type { CreatorStrategicProfileSynthesis } from "./creatorStrategicProfileSynthesis";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorMapConfirmations from "@/app/models/CreatorMapConfirmations";
import { reproposeDimension } from "./mapConfirmationsService";
import { Types } from "mongoose";

/**
 * Normalises a label for comparison: lowercase, trimmed, whitespace collapsed.
 * Two labels are considered "different" only when their normalised forms diverge.
 */
function normaliseLabel(label: string | null | undefined): string {
  if (!label || typeof label !== "string") return "";
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Detects significant overlap between two labels. Returns true when the labels
 * are "the same enough" to NOT trigger re-proposta. Heuristic: one normalised
 * label fully contains the other, or they share the same first ~12 chars.
 *
 * Used to avoid triggering re-proposta on cosmetic phrasing differences
 * ("Humor cotidiano" vs "Humor do cotidiano").
 */
function labelsAreEquivalent(a: string, b: string): boolean {
  const na = normaliseLabel(a);
  const nb = normaliseLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 10 && nb.length >= 10) {
    if (na.includes(nb) || nb.includes(na)) return true;
    if (na.slice(0, 12) === nb.slice(0, 12)) return true;
  }
  return false;
}

/**
 * Picks the dominant labels from a synthesis for comparison.
 */
function dominantLabels(synthesis: CreatorStrategicProfileSynthesis): {
  narrative: string | null;
  tone: string | null;
  territories: string[];
} {
  return {
    narrative: synthesis.mainNarrative?.label ?? null,
    tone: synthesis.dominantTone ?? null,
    territories: synthesis.narrativeTerritories
      .slice(0, 5)
      .map((t) => t.label)
      .filter((l): l is string => typeof l === "string" && l.length > 0),
  };
}

export interface ReproposalSummary {
  narrativeRepoposed: boolean;
  toneReproposed: boolean;
  territoriesReproposed: boolean;
}

/**
 * For each confirmed dimension, check whether the new synthesis introduces
 * a meaningfully different label. If so, reset that dimension to "pending"
 * and record the previous label for the UI.
 *
 * Never throws — failures are silent. The next sync will retry the check.
 */
export async function reproposeConfirmationsIfSynthesisChanged(
  userId: string,
  newSynthesis: CreatorStrategicProfileSynthesis,
): Promise<ReproposalSummary> {
  const summary: ReproposalSummary = {
    narrativeRepoposed: false,
    toneReproposed: false,
    territoriesReproposed: false,
  };

  if (!userId || !Types.ObjectId.isValid(userId)) return summary;

  try {
    await connectToDatabase();
    const existing = await CreatorMapConfirmations.findOne({
      userId: new Types.ObjectId(userId),
    }).lean();

    // Nothing confirmed yet — no re-proposta to do
    if (!existing) return summary;

    const labels = dominantLabels(newSynthesis);

    // ── Narrative ─────────────────────────────────────────────────────────
    if (
      existing.narrative?.state === "confirmed" &&
      labels.narrative &&
      // We only have access to the new label; the "previous" is implicit in the
      // confirmedAt context. If a previousLabel was already recorded for a prior
      // re-propose, we compare against that. Otherwise compare against the
      // dominant new label and the recorded previousLabel (if any).
      existing.narrative.previousLabel &&
      !labelsAreEquivalent(labels.narrative, existing.narrative.previousLabel)
    ) {
      // The synthesis is now different from what we last marked as "the previous
      // version". Re-propose with the most recent confirmed-vs-new comparison.
      await reproposeDimension(userId, "narrative", existing.narrative.previousLabel);
      summary.narrativeRepoposed = true;
    } else if (
      existing.narrative?.state === "confirmed" &&
      labels.narrative &&
      !existing.narrative.previousLabel
    ) {
      // First check after confirmation — store the current new label as
      // "previousLabel" baseline so subsequent re-proposes have a reference.
      // We do NOT reset the state, because we don't yet know what they confirmed.
      await CreatorMapConfirmations.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { "narrative.previousLabel": labels.narrative } },
      );
    }

    // ── Tone ──────────────────────────────────────────────────────────────
    if (
      existing.tone?.state === "confirmed" &&
      labels.tone &&
      existing.tone.previousLabel &&
      !labelsAreEquivalent(labels.tone, existing.tone.previousLabel)
    ) {
      await reproposeDimension(userId, "tone", existing.tone.previousLabel);
      summary.toneReproposed = true;
    } else if (
      existing.tone?.state === "confirmed" &&
      labels.tone &&
      !existing.tone.previousLabel
    ) {
      await CreatorMapConfirmations.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { "tone.previousLabel": labels.tone } },
      );
    }

    // ── Territories ──────────────────────────────────────────────────────
    // For the binary V1: if the entire territories set has rotated (no overlap
    // with previousLabel), repropose. Otherwise leave confirmed.
    if (existing.territories?.state === "confirmed") {
      const previous = existing.territories.previousLabel ?? null;
      const newJoined = labels.territories.join(" | ");

      if (previous && newJoined && previous !== newJoined) {
        const previousList = previous.split(" | ").map(normaliseLabel);
        const newList = labels.territories.map(normaliseLabel);
        const overlap = newList.filter((n) => previousList.some((p) => labelsAreEquivalent(p, n)));
        // Repropose only when LESS than 50% of previous territories survive
        if (
          previousList.length > 0 &&
          overlap.length / previousList.length < 0.5
        ) {
          await reproposeDimension(userId, "territories", previous);
          summary.territoriesReproposed = true;
        }
      } else if (!previous && newJoined) {
        await CreatorMapConfirmations.findOneAndUpdate(
          { userId: new Types.ObjectId(userId) },
          { $set: { "territories.previousLabel": newJoined } },
        );
      }
    }

    return summary;
  } catch (err) {
    console.error("[mapConfirmationReproposal] Erro silencioso:", err);
    return summary;
  }
}
