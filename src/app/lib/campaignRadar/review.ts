import type {
  CampaignRadarBatch,
  CampaignReviewManifest,
} from "./types";

export function applyCampaignReview(
  batch: CampaignRadarBatch,
  manifest: CampaignReviewManifest,
): CampaignRadarBatch {
  const decisions = new Map(manifest.decisions.map((decision) => [decision.id, decision]));
  return {
    ...batch,
    opportunities: batch.opportunities.map((opportunity) => {
      const decision = decisions.get(opportunity.id);
      if (!decision) return opportunity;
      return {
        ...opportunity,
        ...(decision.overrides ?? {}),
        review: {
          status: decision.status,
          reviewedAt: manifest.reviewedAt,
          reviewedBy: manifest.reviewedBy,
          notes: decision.notes ?? null,
        },
      };
    }),
  };
}

export function reviewCoverage(batch: CampaignRadarBatch) {
  const counts = { approved: 0, rejected: 0, pending: 0 };
  for (const opportunity of batch.opportunities) counts[opportunity.review.status] += 1;
  return counts;
}
