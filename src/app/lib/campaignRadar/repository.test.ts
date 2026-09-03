/** @jest-environment node */

import { connectToDatabase } from "@/app/lib/mongoose";
import CampaignRadarOpportunityModel from "@/app/models/CampaignRadarOpportunity";
import CampaignRadarWeeklySelectionModel from "@/app/models/CampaignRadarWeeklySelection";
import type { CatalogCampaignOpportunity } from "./catalog";
import {
  getOrAssignWeeklyFreeOpportunity,
  replaceCampaignRadarCatalog,
  saoPauloDateKey,
} from "./repository";
import type { CampaignRadarBatch } from "./types";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/CampaignRadarOpportunity", () => ({
  __esModule: true,
  default: { bulkWrite: jest.fn(), updateMany: jest.fn() },
}));
jest.mock("@/app/models/CampaignRadarWeeklySelection", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));

const mockConnect = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
const mockOpportunityModel = CampaignRadarOpportunityModel as jest.Mocked<
  typeof CampaignRadarOpportunityModel
>;
const mockSelectionModel = CampaignRadarWeeklySelectionModel as jest.Mocked<
  typeof CampaignRadarWeeklySelectionModel
>;

function opportunity(id: string): CatalogCampaignOpportunity {
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
    summary: "Campanha pública",
    opportunityType: "open_application",
    territories: ["Maternidade e família"],
    platforms: ["Instagram"],
    formats: ["Reel"],
    requirements: [],
    deliverables: [],
    compensation: {
      type: "unknown",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "unknown",
      sourceText: null,
      confirmed: false,
      includesProduct: false,
    },
    applicationDeadline: "2026-09-30",
    publishedAt: "2026-09-01",
    discoveredAt: "2026-09-01T12:00:00.000Z",
    lastVerifiedAt: "2026-09-01T12:00:00.000Z",
    status: "open",
    evidence: [],
    review: {
      status: "approved",
      reviewedAt: "2026-09-01T13:00:00.000Z",
      reviewedBy: "reviewer",
      notes: null,
    },
  };
}

describe("campaign radar repository", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the São Paulo calendar date near the UTC day boundary", () => {
    expect(saoPauloDateKey(new Date("2026-09-02T01:30:00.000Z"))).toBe("2026-09-01");
    expect(saoPauloDateKey(new Date("2026-09-02T03:30:00.000Z"))).toBe("2026-09-02");
  });

  it("does not assign a second opportunity when the weekly selection disappears", async () => {
    mockConnect.mockResolvedValue({} as never);
    mockSelectionModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        userKey: "hashed-user-1",
        weekStartsOn: "2026-08-31",
        opportunityId: "one",
        catalogBatchId: "campaign-radar:2026-09-01",
        assignedAt: new Date("2026-09-01T12:00:00.000Z"),
        expiresAt: new Date("2026-09-22T12:00:00.000Z"),
      }),
    } as never);

    const result = await getOrAssignWeeklyFreeOpportunity({
      opportunities: [opportunity("two")],
      userId: "user-1",
      creatorDescription: "Agora falo de fitness.",
      now: new Date("2026-09-02T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      weekStartsOn: "2026-08-31",
      opportunity: null,
      assignedOpportunityUnavailable: true,
    });
    expect(mockSelectionModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("publishes a catalog batch inside one transaction", async () => {
    let transactionActive = false;
    const endSession = jest.fn();
    mockConnect.mockResolvedValue({
      startSession: jest.fn().mockResolvedValue({
        withTransaction: async (operation: () => Promise<void>) => {
          transactionActive = true;
          await operation();
          transactionActive = false;
        },
        endSession,
      }),
    } as never);
    mockOpportunityModel.bulkWrite.mockImplementation(async () => {
      expect(transactionActive).toBe(true);
      return {} as never;
    });
    mockOpportunityModel.updateMany.mockImplementation(async () => {
      expect(transactionActive).toBe(true);
      return {} as never;
    });

    const item = opportunity("one");
    const batch: CampaignRadarBatch = {
      schemaVersion: "campaign_radar_batch_v1",
      generatedAt: "2026-09-01T12:00:00.000Z",
      reportDate: "2026-09-01",
      coverageStatement: "Chamadas públicas revisadas.",
      sources: [],
      opportunities: [item],
    };
    await replaceCampaignRadarCatalog(batch);

    expect(mockOpportunityModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(mockOpportunityModel.updateMany).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
  });
});
