import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsight from "@/app/models/AccountInsight";
import AdDeal from "@/app/models/AdDeal";
import BrandNarrativeReport from "@/app/models/BrandNarrativeReport";
import BrandProposal from "@/app/models/BrandProposal";
import AudienceDemographicSnapshot from "@/app/models/demographics/AudienceDemographicSnapshot";
import Metric from "@/app/models/Metric";
import {
  AD_DEAL_STUDY_CONTEXT_PROJECTION,
  ACCOUNT_INSIGHT_STUDY_CONTEXT_PROJECTION,
  AUDIENCE_DEMOGRAPHIC_STUDY_CONTEXT_PROJECTION,
  BRAND_NARRATIVE_REPORT_STUDY_CONTEXT_PROJECTION,
  BRAND_PROPOSAL_STUDY_CONTEXT_PROJECTION,
  buildPostCreationAdaptiveCommercialBrandSignals,
  loadPostCreationAdaptiveStudyContextFromServer,
  METRIC_STUDY_CONTEXT_PROJECTION,
} from "./postCreationAdaptiveStudyContextLoader";

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock("@/app/models/AccountInsight", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("@/app/models/demographics/AudienceDemographicSnapshot", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("@/app/models/BrandNarrativeReport", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock("@/app/models/BrandProposal", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock("@/app/models/AdDeal", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

const USER_ID = "64f1b6a2f1b6a2f1b6a2f111";
const NOW = new Date("2026-05-11T12:00:00.000Z");

function mockFindChain(model: { find: jest.Mock }, docs: unknown[]) {
  const lean = jest.fn().mockResolvedValue(docs);
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  model.find.mockReturnValue({ sort });
  return { sort, limit, lean };
}

function mockFindOneChain(model: { findOne: jest.Mock }, doc: unknown | null) {
  const lean = jest.fn().mockResolvedValue(doc);
  const sort = jest.fn().mockReturnValue({ lean });
  model.findOne.mockReturnValue({ sort });
  return { sort, lean };
}

function setupMocks(params?: {
  metrics?: unknown[];
  accountInsight?: unknown | null;
  audienceDemographics?: unknown | null;
  brandReports?: unknown[];
  brandProposals?: unknown[];
  adDeals?: unknown[];
}) {
  (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
  const metricChain = mockFindChain(Metric as unknown as { find: jest.Mock }, params?.metrics || []);
  const accountInsightChain = mockFindOneChain(
    AccountInsight as unknown as { findOne: jest.Mock },
    params?.accountInsight ?? null,
  );
  const audienceChain = mockFindOneChain(
    AudienceDemographicSnapshot as unknown as { findOne: jest.Mock },
    params?.audienceDemographics ?? null,
  );
  const brandReportChain = mockFindChain(
    BrandNarrativeReport as unknown as { find: jest.Mock },
    params?.brandReports || [],
  );
  const brandProposalChain = mockFindChain(
    BrandProposal as unknown as { find: jest.Mock },
    params?.brandProposals || [],
  );
  const adDealChain = mockFindChain(AdDeal as unknown as { find: jest.Mock }, params?.adDeals || []);

  return {
    metricChain,
    accountInsightChain,
    audienceChain,
    brandReportChain,
    brandProposalChain,
    adDealChain,
  };
}

describe("loadPostCreationAdaptiveStudyContextFromServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads Metric posts and returns StudyContext with topFormats and referencePosts", async () => {
    setupMocks({
      metrics: [
        {
          _id: { toHexString: () => "metric-1" },
          type: "REEL",
          format: "REEL",
          description: "Voce ja viu isso? Comenta e salva.",
          postDate: new Date("2026-05-01T19:00:00.000Z"),
          postLink: "https://instagram.com/p/metric-1",
          context: ["Rotina"],
          proposal: ["Comentario"],
          tone: ["Humor"],
          stats: {
            total_interactions: 500,
            comments: 80,
            saved: 30,
            shares: 50,
            reach: 20_000,
          },
        },
      ],
    });

    const result = await loadPostCreationAdaptiveStudyContextFromServer({ userId: USER_ID, now: NOW });

    expect(result.studyContext.topFormats.map((signal) => signal.label)).toContain("Reels");
    expect(result.studyContext.referencePosts[0]).toEqual(
      expect.objectContaining({
        id: "metric-1",
        permalink: "https://instagram.com/p/metric-1",
        interactions: 500,
      }),
    );
    expect(result.meta.sources.metrics).toBe(1);
  });

  it("uses default and maximum bounds for periodDays and postLimit", async () => {
    const { metricChain } = setupMocks();

    const defaultResult = await loadPostCreationAdaptiveStudyContextFromServer({ userId: USER_ID, now: NOW });
    expect(defaultResult.meta.periodDays).toBe(90);
    expect(defaultResult.meta.postLimit).toBe(150);
    expect(metricChain.limit).toHaveBeenLastCalledWith(150);

    const boundedResult = await loadPostCreationAdaptiveStudyContextFromServer({
      userId: USER_ID,
      now: NOW,
      periodDays: 999,
      postLimit: 999,
    });
    expect(boundedResult.meta.periodDays).toBe(365);
    expect(boundedResult.meta.postLimit).toBe(250);
    expect(metricChain.limit).toHaveBeenLastCalledWith(250);
  });

  it("calls Metric with user filter, cutoff date, explicit projection, sort, limit, and lean", async () => {
    const { metricChain } = setupMocks();

    await loadPostCreationAdaptiveStudyContextFromServer({
      userId: USER_ID,
      now: NOW,
      periodDays: 30,
      postLimit: 25,
    });

    expect(Metric.find).toHaveBeenCalledWith(
      {
        user: USER_ID,
        postDate: { $gte: new Date("2026-04-11T12:00:00.000Z") },
      },
      METRIC_STUDY_CONTEXT_PROJECTION,
    );
    expect(metricChain.sort).toHaveBeenCalledWith({ postDate: -1, "stats.total_interactions": -1, _id: -1 });
    expect(metricChain.limit).toHaveBeenCalledWith(25);
    expect(metricChain.lean).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(METRIC_STUDY_CONTEXT_PROJECTION)).not.toContain("rawData");
  });

  it("loads the latest AccountInsight and AudienceDemographicSnapshot", async () => {
    setupMocks({
      accountInsight: {
        recordedAt: new Date("2026-05-10T00:00:00.000Z"),
        followersCount: 1000,
        accountDetails: { username: "creator" },
      },
      audienceDemographics: {
        recordedAt: new Date("2026-05-09T00:00:00.000Z"),
        demographics: {
          follower_demographics: { city: { SP: 20 } },
        },
      },
    });

    const result = await loadPostCreationAdaptiveStudyContextFromServer({ userId: USER_ID, now: NOW });

    expect(AccountInsight.findOne).toHaveBeenCalledWith(
      { user: USER_ID },
      ACCOUNT_INSIGHT_STUDY_CONTEXT_PROJECTION,
    );
    expect(AudienceDemographicSnapshot.findOne).toHaveBeenCalledWith(
      { user: USER_ID },
      AUDIENCE_DEMOGRAPHIC_STUDY_CONTEXT_PROJECTION,
    );
    expect(result.coverage.hasAccountInsight).toBe(true);
    expect(result.coverage.hasAudienceDemographics).toBe(true);
    expect(result.meta.sources.accountInsight).toBe(true);
    expect(result.meta.sources.audienceDemographics).toBe(true);
  });

  it("converts BrandNarrativeReport, BrandProposal, and AdDeal into brandSignals", async () => {
    setupMocks({
      brandReports: [
        {
          _id: { toHexString: () => "report-1" },
          brand: { brandName: "Marca A", category: ["beleza"] },
          match: { matchScore: 0.9, confidenceScore: 0.8 },
          evidencePosts: [{ id: "post-1" }, { id: "post-2" }],
          metricsSummary: { evidenceCount: 2, totalInteractions: 1000 },
        },
      ],
      brandProposals: [
        {
          _id: { toHexString: () => "proposal-1" },
          brandName: "Marca B",
          campaignTitle: "Campanha B",
          budget: 20_000,
          status: "aceito",
        },
      ],
      adDeals: [
        {
          _id: { toHexString: () => "deal-1" },
          brandName: "Marca C",
          brandSegment: "moda",
          compensationValue: 15_000,
        },
      ],
    });

    const result = await loadPostCreationAdaptiveStudyContextFromServer({ userId: USER_ID, now: NOW });

    expect(BrandNarrativeReport.find).toHaveBeenCalledWith(
      { userId: USER_ID },
      BRAND_NARRATIVE_REPORT_STUDY_CONTEXT_PROJECTION,
    );
    expect(BrandProposal.find).toHaveBeenCalledWith(
      { userId: USER_ID },
      BRAND_PROPOSAL_STUDY_CONTEXT_PROJECTION,
    );
    expect(AdDeal.find).toHaveBeenCalledWith(
      { userId: USER_ID },
      AD_DEAL_STUDY_CONTEXT_PROJECTION,
    );
    expect(result.studyContext.brandSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining([
        "Relatorio de match: Marca A",
        "Proposta recebida: Marca B",
        "Deal anterior: Marca C",
      ]),
    );
    expect(result.meta.sources.brandReports).toBe(1);
    expect(result.meta.sources.brandProposals).toBe(1);
    expect(result.meta.sources.adDeals).toBe(1);
  });

  it("builds brandSignals defensively without inventing details", () => {
    const signals = buildPostCreationAdaptiveCommercialBrandSignals({
      brandReports: [{ brand: {}, match: {}, evidencePosts: [] }],
      brandProposals: [{ campaignTitle: "Campanha sem marca" }],
      adDeals: [{ brandSegment: "beleza" }],
    });

    expect(signals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining([
        "Relatorio de match",
        "Proposta recebida: Campanha sem marca",
        "Deal anterior: beleza",
      ]),
    );
  });

  it("works when optional sources return null or empty arrays", async () => {
    setupMocks({
      metrics: [
        {
          _id: { toHexString: () => "metric-missing" },
          postDate: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
      accountInsight: null,
      audienceDemographics: null,
      brandReports: [],
      brandProposals: [],
      adDeals: [],
    });

    const result = await loadPostCreationAdaptiveStudyContextFromServer({ userId: USER_ID, now: NOW });

    expect(result.meta.sources).toEqual({
      metrics: 1,
      accountInsight: false,
      audienceDemographics: false,
      brandReports: 0,
      brandProposals: 0,
      adDeals: 0,
    });
    expect(result.studyContext.referencePosts[0]?.id).toBe("metric-missing");
  });

  it("returns safe empty context for invalid userId without querying models", async () => {
    setupMocks();

    const result = await loadPostCreationAdaptiveStudyContextFromServer({
      userId: "not-a-user-id",
      now: NOW,
    });

    expect(connectToDatabase).not.toHaveBeenCalled();
    expect(Metric.find).not.toHaveBeenCalled();
    expect(result.meta.userId).toBe("not-a-user-id");
    expect(result.meta.sources.metrics).toBe(0);
    expect(result.studyContext.confidence.label).toBe("low");
  });

  it("skips commercial queries when includeCommercialSignals is false", async () => {
    setupMocks();

    const result = await loadPostCreationAdaptiveStudyContextFromServer({
      userId: USER_ID,
      now: NOW,
      includeCommercialSignals: false,
    });

    expect(BrandNarrativeReport.find).not.toHaveBeenCalled();
    expect(BrandProposal.find).not.toHaveBeenCalled();
    expect(AdDeal.find).not.toHaveBeenCalled();
    expect(result.meta.sources.brandReports).toBe(0);
    expect(result.meta.sources.brandProposals).toBe(0);
    expect(result.meta.sources.adDeals).toBe(0);
  });

  it("does not expose Mongoose documents to the normalizer result", async () => {
    setupMocks({
      metrics: [
        {
          _id: { toHexString: () => "object-id-value" },
          postDate: new Date("2026-05-01T12:00:00.000Z"),
          type: "IMAGE",
          description: "Legenda simples",
          stats: { total_interactions: 10 },
        },
      ],
    });

    const result = await loadPostCreationAdaptiveStudyContextFromServer({ userId: USER_ID, now: NOW });

    expect(result.studyContext.referencePosts[0]?.id).toBe("object-id-value");
    expect(result.studyContext.referencePosts[0]?.id).not.toEqual(expect.objectContaining({ toHexString: expect.any(Function) }));
  });
});
