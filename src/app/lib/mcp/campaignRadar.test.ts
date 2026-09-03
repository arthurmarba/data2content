/** @jest-environment node */

import {
  getOrAssignWeeklyFreeOpportunity,
  listPublicCampaignRadarCatalog,
} from "@/app/lib/campaignRadar/repository";
import type { CatalogCampaignOpportunity } from "@/app/lib/campaignRadar/catalog";
import type { McpAccountState } from "./accountState";
import {
  extractCampaignRadarPrivateSignals,
  findMcpCampaignOpportunities,
} from "./campaignRadar";

jest.mock("@/app/lib/campaignRadar/repository", () => ({
  listPublicCampaignRadarCatalog: jest.fn(),
  getOrAssignWeeklyFreeOpportunity: jest.fn(),
}));

const mockListCatalog = listPublicCampaignRadarCatalog as jest.MockedFunction<
  typeof listPublicCampaignRadarCatalog
>;
const mockWeeklyAssignment = getOrAssignWeeklyFreeOpportunity as jest.MockedFunction<
  typeof getOrAssignWeeklyFreeOpportunity
>;

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
    sourceId: "influencer-brasil",
    sourcePlatform: "Influencer Brasil",
    sourceUrl: `https://example.test/source/${id}`,
    applicationUrl: `https://example.test/apply/${id}`,
    applicationLabel: "Candidatar-se",
    requiresAccount: true,
    title: `Campanha ${id}`,
    brand: "Marca",
    summary: "Campanha de maternidade no Instagram",
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

function accountState(accessLevel: "free" | "pro", instagramConnected = false): McpAccountState {
  return {
    accountAvailable: true,
    reason: accessLevel === "free"
      ? "ready_free"
      : instagramConnected
        ? "ready_pro_with_instagram"
        : "ready_pro_without_instagram",
    accessLevel,
    entitlement: {
      eligible: accessLevel === "pro",
      reason: accessLevel === "pro" ? "active" : "subscription_required",
      normalizedStatus: accessLevel === "pro" ? "active" : "inactive",
      validUntil: null,
      instagramConnected,
    },
    instagramConnected,
    creatorNorth: "Crio conteúdo de maternidade real para mães de primeira viagem.",
    northDeclared: true,
    communityInvitePending: false,
    capabilities: {
      aggregateCommunityContext: true,
      privateCreatorIntelligence: accessLevel === "pro" && instagramConnected,
      membershipBenefits: accessLevel === "pro",
    },
  };
}

describe("MCP campaign radar", () => {
  beforeEach(() => {
    mockListCatalog.mockReset();
    mockListCatalog.mockResolvedValue([
      opportunity("one"),
      opportunity("two"),
      opportunity("three"),
    ]);
    mockWeeklyAssignment.mockImplementation(async ({ opportunities }) => ({
      weekStartsOn: "2026-08-31",
      opportunity: opportunities[0] ?? null,
      assignedOpportunityUnavailable: false,
    }));
  });

  it("returns one stable complete opportunity to a free account without leaking catalog counts or sales links", async () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const first = await findMcpCampaignOpportunities({
      userId: "507f1f77bcf86cd799439011",
      accountState: accountState("free"),
      search: { query: "maternidade", limit: 10 },
      now,
    });
    const second = await findMcpCampaignOpportunities({
      userId: "507f1f77bcf86cd799439011",
      accountState: accountState("free"),
      search: { query: "fitness", minimumConfirmedPay: 3000, limit: 10 },
      now,
    });

    expect(first.access).toBe("weekly_selection");
    expect(first.weekStartsOn).toBe("2026-08-31");
    expect(first.opportunities).toHaveLength(1);
    expect(second.opportunities).toHaveLength(1);
    expect(first.opportunities[0]?.application.url).toBe(
      second.opportunities[0]?.application.url,
    );
    expect(first.opportunities[0]?.application.url).toMatch(/^https:\/\/example\.test\/apply\//);
    expect(first).not.toHaveProperty("coverage");
    expect(JSON.stringify(first)).not.toContain("dashboard/profile");
    expect(JSON.stringify(first)).not.toContain("assin");
    expect(first.accountNotice).toContain("uma publicidade selecionada por semana");
  });

  it("returns the filtered catalog to a PRO account and never treats total budget as creator pay", async () => {
    mockListCatalog.mockResolvedValue([
      opportunity("confirmed"),
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
    ]);

    const result = await findMcpCampaignOpportunities({
      userId: "507f1f77bcf86cd799439011",
      accountState: accountState("pro"),
      search: { minimumConfirmedPay: 1000, limit: 5 },
      now: new Date("2026-09-02T12:00:00.000Z"),
    });

    expect(result.access).toBe("full_catalog");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({
      title: "Campanha confirmed",
      compensation: { individualPayConfirmed: true, minimum: 1200 },
    });
    expect(result.coverage).toMatchObject({ activePublicCatalog: 2, exactMatches: 1 });
    expect(JSON.stringify(result)).not.toContain("total_campaign_budget");
  });

  it("returns a transparent empty state when no reviewed active public call is fresh", async () => {
    mockListCatalog.mockResolvedValue([]);
    const result = await findMcpCampaignOpportunities({
      userId: "507f1f77bcf86cd799439011",
      accountState: accountState("free"),
      search: {},
      now: new Date("2026-09-02T12:00:00.000Z"),
    });
    expect(result.opportunities).toEqual([]);
    expect(result.message).toContain("Não encontrei uma publicidade pública, ativa e revisada");
  });

  it("extracts only derived category signals from the private creator snapshot", () => {
    expect(
      extractCampaignRadarPrivateSignals({
        strategy: {
          resolvedCategories: { context: "maternidade" },
          rankedCategories: { context: ["maternidade", "rotina"] },
        },
        performanceLearning: {
          captionEvidence: [{ categories: ["família", "maternidade"] }],
        },
        creatorVoice: { dnaProfile: { recurringExpressions: ["vida real"] } },
        receipt: { captionEvidenceMetricIds: ["private-id-that-must-not-be-copied"] },
      }),
    ).toEqual(["maternidade", "rotina", "família", "vida real"]);
  });

  it("marks Instagram signals as used only when private analyzed-content signals were supplied", async () => {
    const result = await findMcpCampaignOpportunities({
      userId: "507f1f77bcf86cd799439011",
      accountState: accountState("pro", true),
      search: { territories: ["Maternidade e família"] },
      privateContentSignals: ["maternidade", "rotina com filhos"],
      now: new Date("2026-09-02T12:00:00.000Z"),
    });
    expect(result.personalization).toEqual({
      basis: "declared_profile_and_instagram_content",
      instagramConnected: true,
      instagramSignalsUsed: true,
    });
    expect(result.opportunities[0]?.fit.reasons.join(" ")).toContain("conteúdos analisados");
    expect(result.personalization.instagramSignalsUsed).toBe(true);
  });

  it("does not replace a weekly free opportunity that became unavailable", async () => {
    mockWeeklyAssignment.mockResolvedValue({
      weekStartsOn: "2026-08-31",
      opportunity: null,
      assignedOpportunityUnavailable: true,
    });
    const result = await findMcpCampaignOpportunities({
      userId: "507f1f77bcf86cd799439011",
      accountState: accountState("free"),
      search: { query: "outra publicidade" },
      now: new Date("2026-09-02T12:00:00.000Z"),
    });
    expect(result.opportunities).toEqual([]);
    expect(result.message).toContain("não vou substituí-la por outra");
  });
});
