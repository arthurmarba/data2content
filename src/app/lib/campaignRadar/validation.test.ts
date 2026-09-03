/** @jest-environment node */

import { parseCampaignRadarBatch } from "./validation";

function batch() {
  return {
    schemaVersion: "campaign_radar_batch_v1",
    generatedAt: "2026-09-01T12:00:00.000Z",
    reportDate: "2026-09-01",
    coverageStatement: "Chamadas públicas revisadas.",
    sources: [
      {
        sourceId: "influencer-brasil",
        sourcePlatform: "Influencer Brasil",
        discoveryUrl: "https://example.test/list",
        fetchedAt: "2026-09-01T12:00:00.000Z",
        discoveredDocuments: 1,
        emittedOpportunities: 1,
        warnings: [],
      },
    ],
    opportunities: [
      {
        id: "influencer-brasil:one",
        sourceId: "influencer-brasil",
        sourcePlatform: "Influencer Brasil",
        sourceUrl: "https://example.test/source",
        applicationUrl: "https://example.test/apply",
        applicationLabel: "Candidatar-se",
        requiresAccount: true,
        title: "Campanha de maternidade",
        brand: "Marca",
        summary: "Campanha pública para creators.",
        opportunityType: "open_application",
        territories: ["Maternidade e família"],
        platforms: ["Instagram"],
        formats: ["Reel"],
        requirements: [],
        deliverables: ["1 Reel"],
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
        applicationDeadline: "2026-09-30",
        publishedAt: "2026-09-01",
        discoveredAt: "2026-09-01T12:00:00.000Z",
        lastVerifiedAt: "2026-09-01T12:00:00.000Z",
        status: "open",
        evidence: [{ field: "valor", excerpt: "R$ 1.200 por creator" }],
        review: {
          status: "approved",
          reviewedAt: "2026-09-01T13:00:00.000Z",
          reviewedBy: "reviewer",
          notes: null,
        },
      },
    ],
  };
}

describe("campaign radar batch validation", () => {
  it("accepts a complete reviewed batch", () => {
    expect(parseCampaignRadarBatch(batch()).opportunities).toHaveLength(1);
  });

  it("rejects duplicate opportunity ids", () => {
    const value = batch();
    value.opportunities.push({ ...value.opportunities[0]! });
    expect(() => parseCampaignRadarBatch(value)).toThrow("ID duplicado no lote");
  });

  it("rejects unsafe application links and unknown sources", () => {
    const value = batch();
    value.opportunities[0]!.applicationUrl = "http://example.test/apply";
    value.opportunities[0]!.sourceId = "unknown-source";
    expect(() => parseCampaignRadarBatch(value)).toThrow("A URL precisa usar HTTPS");
    expect(() => parseCampaignRadarBatch({
      ...batch(),
      opportunities: [{ ...batch().opportunities[0]!, sourceId: "unknown-source" }],
    })).toThrow("Fonte não cadastrada");
  });
});
