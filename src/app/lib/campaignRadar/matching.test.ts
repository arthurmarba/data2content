import type { CatalogCampaignOpportunity } from "./catalog";
import {
  campaignRadarWeekKey,
  isConfirmedIndividualPay,
  rankCampaignCatalog,
  selectWeeklyFreeOpportunity,
} from "./matching";

function opportunity(
  id: string,
  overrides: Partial<CatalogCampaignOpportunity> = {},
): CatalogCampaignOpportunity {
  return {
    id,
    reportDate: "2026-09-01",
    catalogBatchId: "campaign-radar:2026-09-01",
    activeInCatalog: true,
    sourceVisibility: "publicly_observable",
    sourceId: "public-source",
    sourcePlatform: "Fonte pública",
    sourceUrl: `https://example.test/source/${id}`,
    applicationUrl: `https://example.test/apply/${id}`,
    applicationLabel: "Candidatar-se",
    requiresAccount: false,
    title: "Campanha de maternidade",
    brand: "Marca",
    summary: "Conteúdo sobre rotina com filhos no Instagram",
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
    evidence: [],
    review: { status: "approved", reviewedAt: null, reviewedBy: null, notes: null },
    ...overrides,
  };
}

describe("campaign radar matching", () => {
  it("only treats confirmed per-creator or per-delivery values as individual pay", () => {
    expect(isConfirmedIndividualPay(opportunity("one"))).toBe(true);
    expect(
      isConfirmedIndividualPay(
        opportunity("budget", {
          compensation: {
            type: "range",
            minimum: 5000,
            maximum: 10000,
            currency: "BRL",
            basis: "total_campaign_budget",
            sourceText: "R$ 5 mil a R$ 10 mil",
            confirmed: true,
            includesProduct: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it("returns a closest match and states the missing confirmed-pay criterion", () => {
    const [result] = rankCampaignCatalog(
      [opportunity("one")],
      { territories: ["Maternidade e família"], minimumConfirmedPay: 2000 },
      "Crio conteúdo sobre maternidade real.",
    );
    expect(result?.matchType).toBe("closest");
    expect(result?.reasons.join(" ")).toContain("Maternidade e família");
    expect(result?.unmetCriteria.join(" ")).toContain("R$ 2.000");
  });

  it("keeps the free weekly selection stable across different queries", () => {
    const opportunities = [opportunity("one"), opportunity("two"), opportunity("three")];
    const now = new Date("2026-09-02T12:00:00.000Z");
    const first = selectWeeklyFreeOpportunity(
      opportunities,
      "507f1f77bcf86cd799439011",
      "Crio conteúdo sobre maternidade.",
      now,
    );
    const second = selectWeeklyFreeOpportunity(
      [...opportunities].reverse(),
      "507f1f77bcf86cd799439011",
      "Crio conteúdo sobre maternidade.",
      now,
    );
    expect(first?.opportunity.id).toBe(second?.opportunity.id);
    expect(campaignRadarWeekKey(now)).toBe("2026-08-31");
  });

  it("uses private content signals only when they are explicitly supplied", () => {
    const [withoutInstagramSignals] = rankCampaignCatalog(
      [opportunity("one")],
      {},
      "Crio conteúdo sobre organização pessoal.",
    );
    const [withInstagramSignals] = rankCampaignCatalog(
      [opportunity("one")],
      {},
      "Crio conteúdo sobre organização pessoal.",
      ["maternidade", "rotina com filhos"],
    );
    expect(withoutInstagramSignals?.reasons.join(" ")).not.toContain("conteúdos analisados");
    expect(withInstagramSignals?.reasons.join(" ")).toContain("conteúdos analisados");
    expect(withInstagramSignals!.internalScore).toBeGreaterThan(withoutInstagramSignals!.internalScore);
  });
});
