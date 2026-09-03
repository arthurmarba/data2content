import { isPubliclyQueryableOpportunity, normalizeOpportunityForCatalog } from "./catalog";
import type { CampaignOpportunity } from "./types";

function opportunity(overrides: Partial<CampaignOpportunity> = {}): CampaignOpportunity {
  return {
    id: "influencer-brasil:abc",
    sourceId: "influencer-brasil",
    sourcePlatform: "Influencer Brasil",
    sourceUrl: "https://example.test/source",
    applicationUrl: "https://example.test/apply",
    applicationLabel: "Candidatar-se",
    requiresAccount: true,
    title: "Campanha de moda",
    brand: null,
    summary: "Conteúdo em Reels e Stories no Instagram",
    opportunityType: "open_application",
    territories: ["Moda"],
    platforms: [],
    formats: [],
    requirements: [],
    deliverables: [],
    compensation: {
      type: "fixed",
      minimum: 1200,
      maximum: 1200,
      currency: "BRL",
      basis: "per_creator",
      sourceText: "R$ 1.200",
      confirmed: true,
      includesProduct: false,
    },
    applicationDeadline: "2026-09-10",
    publishedAt: "2026-09-01",
    discoveredAt: "2026-09-01T12:00:00.000Z",
    lastVerifiedAt: "2026-09-01T12:00:00.000Z",
    status: "open",
    evidence: [],
    review: {
      status: "approved",
      reviewedAt: "2026-09-01T12:00:00.000Z",
      reviewedBy: "reviewer",
      notes: null,
    },
    ...overrides,
  };
}

describe("campaign radar catalog normalization", () => {
  it("recovers missing platform and format fields before persistence", () => {
    const normalized = normalizeOpportunityForCatalog(opportunity(), "2026-09-01");
    expect(normalized.platforms).toEqual(["Instagram"]);
    expect(normalized.formats).toEqual(["Reel", "Stories"]);
    expect(normalized.sourceVisibility).toBe("restricted");
    expect(normalized.activeInCatalog).toBe(true);
    expect(isPubliclyQueryableOpportunity(normalized)).toBe(false);
  });

  it("marks authenticated manual inventory as restricted", () => {
    const normalized = normalizeOpportunityForCatalog(
      opportunity({ sourceId: "mis-manual-capture" }),
      "2026-09-01",
    );
    expect(normalized.sourceVisibility).toBe("restricted");
    expect(isPubliclyQueryableOpportunity(normalized)).toBe(false);
  });

  it("does not expose closed or rejected records", () => {
    const closed = normalizeOpportunityForCatalog(opportunity({ status: "closed" }), "2026-09-01");
    const rejected = normalizeOpportunityForCatalog(
      opportunity({ review: { status: "rejected", reviewedAt: null, reviewedBy: null, notes: null } }),
      "2026-09-01",
    );
    expect(isPubliclyQueryableOpportunity(closed)).toBe(false);
    expect(isPubliclyQueryableOpportunity(rejected)).toBe(false);
  });
});
