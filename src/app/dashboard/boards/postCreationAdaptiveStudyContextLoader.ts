import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsight from "@/app/models/AccountInsight";
import AdDeal from "@/app/models/AdDeal";
import BrandNarrativeReport from "@/app/models/BrandNarrativeReport";
import BrandProposal from "@/app/models/BrandProposal";
import AudienceDemographicSnapshot from "@/app/models/demographics/AudienceDemographicSnapshot";
import Metric from "@/app/models/Metric";
import {
  buildPostCreationAdaptiveStudyContextFromServerSources,
  toFiniteNumber,
  type PostCreationAdaptiveServerBrandSignal,
  type PostCreationAdaptiveServerMetricPost,
  type PostCreationAdaptiveServerStudyContextResult,
} from "./postCreationAdaptiveStudyContextServer";

type UnknownRecord = Record<string, unknown>;

export type LoadPostCreationAdaptiveStudyContextFromServerParams = {
  userId: string;
  periodDays?: number | null;
  now?: Date;
  postLimit?: number;
  includeCommercialSignals?: boolean;
};

export type LoadPostCreationAdaptiveStudyContextFromServerResult =
  PostCreationAdaptiveServerStudyContextResult & {
    meta: {
      userId: string;
      periodDays: number;
      postLimit: number;
      loadedAt: string;
      sources: {
        metrics: number;
        accountInsight: boolean;
        audienceDemographics: boolean;
        brandReports: number;
        brandProposals: number;
        adDeals: number;
      };
    };
  };

const DEFAULT_PERIOD_DAYS = 90;
const MAX_PERIOD_DAYS = 365;
const DEFAULT_POST_LIMIT = 150;
const MAX_POST_LIMIT = 250;
const BRAND_REPORT_LIMIT = 10;
const BRAND_PROPOSAL_LIMIT = 20;
const AD_DEAL_LIMIT = 20;

export const METRIC_STUDY_CONTEXT_PROJECTION = {
  _id: 1,
  instagramMediaId: 1,
  postLink: 1,
  permalink: 1,
  coverUrl: 1,
  thumbnailUrl: 1,
  mediaUrl: 1,
  description: 1,
  postDate: 1,
  timestamp: 1,
  createdAt: 1,
  type: 1,
  format: 1,
  proposal: 1,
  context: 1,
  tone: 1,
  references: 1,
  contentIntent: 1,
  narrativeForm: 1,
  contentSignals: 1,
  stance: 1,
  proofStyle: 1,
  commercialMode: 1,
  theme: 1,
  themes: 1,
  themeKeyword: 1,
  collab: 1,
  collabCreator: 1,
  isPubli: 1,
  classificationStatus: 1,
  classificationMeta: 1,
  "stats.views": 1,
  "stats.reach": 1,
  "stats.likes": 1,
  "stats.comments": 1,
  "stats.saved": 1,
  "stats.saves": 1,
  "stats.shares": 1,
  "stats.total_interactions": 1,
  "stats.totalInteractions": 1,
  "stats.impressions": 1,
  "stats.profile_visits": 1,
  "stats.follows": 1,
  "stats.video_views": 1,
} as const;

export const ACCOUNT_INSIGHT_STUDY_CONTEXT_PROJECTION = {
  recordedAt: 1,
  followersCount: 1,
  mediaCount: 1,
  accountInsightsPeriod: 1,
  audienceDemographics: 1,
  accountDetails: 1,
} as const;

export const AUDIENCE_DEMOGRAPHIC_STUDY_CONTEXT_PROJECTION = {
  recordedAt: 1,
  demographics: 1,
  follower_demographics: 1,
  engaged_audience_demographics: 1,
  audienceDemographics: 1,
} as const;

export const BRAND_NARRATIVE_REPORT_STUDY_CONTEXT_PROJECTION = {
  brand: 1,
  creator: 1,
  pauta: 1,
  match: 1,
  evidencePosts: 1,
  metricsSummary: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

export const BRAND_PROPOSAL_STUDY_CONTEXT_PROJECTION = {
  brandName: 1,
  campaignTitle: 1,
  campaignDescription: 1,
  deliverables: 1,
  budget: 1,
  status: 1,
  createdAt: 1,
  receivedAt: 1,
  latestAnalysis: 1,
} as const;

export const AD_DEAL_STUDY_CONTEXT_PROJECTION = {
  brandName: 1,
  brandSegment: 1,
  dealDate: 1,
  campaignStart: 1,
  campaignEnd: 1,
  campaignStartDate: 1,
  campaignEndDate: 1,
  deliverables: 1,
  platform: 1,
  compensation: 1,
  compensationValue: 1,
  compensationType: 1,
  relatedPostId: 1,
  notes: 1,
} as const;

function normalizeBoundedInteger(value: number | null | undefined, fallback: number, max: number): number {
  const numeric = Math.floor(toFiniteNumber(value));
  if (numeric <= 0) return fallback;
  return Math.min(numeric, max);
}

function isValidUserId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value.trim());
}

function cleanText(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return trimmed || null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const direct = cleanText(value);
    if (direct) return direct;
  }
  return null;
}

function toPlainValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlainValue);
  if (!value || typeof value !== "object") return value;
  if (typeof (value as { toHexString?: unknown }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString();
  }
  const result: UnknownRecord = {};
  for (const [key, nestedValue] of Object.entries(value as UnknownRecord)) {
    result[key] = toPlainValue(nestedValue);
  }
  return result;
}

function toPlainRecord(value: unknown): UnknownRecord {
  const plain = toPlainValue(value);
  return plain && typeof plain === "object" && !Array.isArray(plain) ? plain as UnknownRecord : {};
}

function toPlainRecords(values: unknown): UnknownRecord[] {
  return Array.isArray(values) ? values.map(toPlainRecord) : [];
}

function buildEmptyResult(params: {
  userId: string;
  periodDays: number;
  postLimit: number;
  loadedAt: string;
}): LoadPostCreationAdaptiveStudyContextFromServerResult {
  const result = buildPostCreationAdaptiveStudyContextFromServerSources({
    periodDays: params.periodDays,
    generatedAt: params.loadedAt,
  });

  return {
    ...result,
    meta: {
      userId: params.userId,
      periodDays: params.periodDays,
      postLimit: params.postLimit,
      loadedAt: params.loadedAt,
      sources: {
        metrics: 0,
        accountInsight: false,
        audienceDemographics: false,
        brandReports: 0,
        brandProposals: 0,
        adDeals: 0,
      },
    },
  };
}

function normalizeAccountInsight(value: unknown): UnknownRecord | null {
  const record = toPlainRecord(value);
  return Object.keys(record).length ? record : null;
}

function normalizeAudienceDemographics(value: unknown): UnknownRecord | null {
  const record = toPlainRecord(value);
  if (!Object.keys(record).length) return null;
  const demographics = toPlainRecord(record.demographics);
  return {
    ...record,
    ...(Object.keys(demographics).length ? demographics : {}),
  };
}

function buildBrandSignal(params: {
  id: string | null;
  label: string | null;
  score: number;
  evidenceCount?: number;
  category?: string | null;
}): PostCreationAdaptiveServerBrandSignal | null {
  if (!params.label) return null;
  return {
    id: params.id,
    label: params.label,
    brandCategory: params.category || params.label,
    score: params.score,
    evidenceCount: params.evidenceCount || 1,
  };
}

function brandSignalsFromReports(reports: UnknownRecord[]): PostCreationAdaptiveServerBrandSignal[] {
  return reports.flatMap((report, index) => {
    const brand = toPlainRecord(report.brand);
    const match = toPlainRecord(report.match);
    const metricsSummary = toPlainRecord(report.metricsSummary);
    const evidencePosts = Array.isArray(report.evidencePosts) ? report.evidencePosts : [];
    const brandName = firstText(brand.brandName, brand.category, report.pauta);
    const label = brandName ? `Relatorio de match: ${brandName}` : "Relatorio de match";
    const score = Math.max(
      toFiniteNumber(match.matchScore) * 100,
      toFiniteNumber(match.confidenceScore) * 100,
      toFiniteNumber(metricsSummary.totalInteractions),
      120,
    );
    return [
      buildBrandSignal({
        id: firstText(report._id, `brand-report-${index}`),
        label,
        score,
        evidenceCount: Math.max(1, evidencePosts.length, toFiniteNumber(metricsSummary.evidenceCount)),
        category: firstText(brand.category, brandName),
      }),
    ].filter((signal): signal is PostCreationAdaptiveServerBrandSignal => Boolean(signal));
  });
}

function brandSignalsFromProposals(proposals: UnknownRecord[]): PostCreationAdaptiveServerBrandSignal[] {
  return proposals.flatMap((proposal, index) => {
    const brandName = firstText(proposal.brandName, proposal.campaignTitle);
    const label = brandName ? `Proposta recebida: ${brandName}` : "Proposta recebida";
    const status = cleanText(proposal.status);
    const statusScore = status === "aceito" ? 160 : status === "respondido" ? 120 : 80;
    const budgetScore = Math.min(200, toFiniteNumber(proposal.budget) / 100);
    return [
      buildBrandSignal({
        id: firstText(proposal._id, `brand-proposal-${index}`),
        label,
        score: statusScore + budgetScore,
        evidenceCount: 1,
        category: firstText(proposal.campaignTitle, brandName),
      }),
    ].filter((signal): signal is PostCreationAdaptiveServerBrandSignal => Boolean(signal));
  });
}

function brandSignalsFromAdDeals(deals: UnknownRecord[]): PostCreationAdaptiveServerBrandSignal[] {
  return deals.flatMap((deal, index) => {
    const brandName = firstText(deal.brandName, deal.brandSegment);
    const label = brandName ? `Deal anterior: ${brandName}` : "Deal anterior";
    const score = 180 + Math.min(300, toFiniteNumber(deal.compensationValue) / 100);
    return [
      buildBrandSignal({
        id: firstText(deal._id, `ad-deal-${index}`),
        label,
        score,
        evidenceCount: 1,
        category: firstText(deal.brandSegment, brandName),
      }),
    ].filter((signal): signal is PostCreationAdaptiveServerBrandSignal => Boolean(signal));
  });
}

export function buildPostCreationAdaptiveCommercialBrandSignals(params: {
  brandReports?: unknown[];
  brandProposals?: unknown[];
  adDeals?: unknown[];
}): PostCreationAdaptiveServerBrandSignal[] {
  return [
    ...brandSignalsFromReports(toPlainRecords(params.brandReports || [])),
    ...brandSignalsFromProposals(toPlainRecords(params.brandProposals || [])),
    ...brandSignalsFromAdDeals(toPlainRecords(params.adDeals || [])),
  ];
}

export async function loadPostCreationAdaptiveStudyContextFromServer(
  params: LoadPostCreationAdaptiveStudyContextFromServerParams,
): Promise<LoadPostCreationAdaptiveStudyContextFromServerResult> {
  const userId = params.userId.trim();
  const now = params.now || new Date();
  const loadedAt = now.toISOString();
  const periodDays = normalizeBoundedInteger(params.periodDays, DEFAULT_PERIOD_DAYS, MAX_PERIOD_DAYS);
  const postLimit = normalizeBoundedInteger(params.postLimit, DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
  const includeCommercialSignals = params.includeCommercialSignals !== false;

  if (!isValidUserId(userId)) {
    return buildEmptyResult({ userId, periodDays, postLimit, loadedAt });
  }

  await connectToDatabase();

  const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const metricDocs = await Metric.find(
    { user: userId, postDate: { $gte: cutoff } },
    METRIC_STUDY_CONTEXT_PROJECTION,
  )
    .sort({ postDate: -1, "stats.total_interactions": -1, _id: -1 })
    .limit(postLimit)
    .lean();

  const accountInsightDoc = await AccountInsight.findOne(
    { user: userId },
    ACCOUNT_INSIGHT_STUDY_CONTEXT_PROJECTION,
  )
    .sort({ recordedAt: -1, _id: -1 })
    .lean();

  const audienceDemographicsDoc = await AudienceDemographicSnapshot.findOne(
    { user: userId },
    AUDIENCE_DEMOGRAPHIC_STUDY_CONTEXT_PROJECTION,
  )
    .sort({ recordedAt: -1, _id: -1 })
    .lean();

  const [brandReportDocs, brandProposalDocs, adDealDocs] = includeCommercialSignals
    ? await Promise.all([
      BrandNarrativeReport.find(
        { userId },
        BRAND_NARRATIVE_REPORT_STUDY_CONTEXT_PROJECTION,
      )
        .sort({ createdAt: -1, _id: -1 })
        .limit(BRAND_REPORT_LIMIT)
        .lean(),
      BrandProposal.find(
        { userId },
        BRAND_PROPOSAL_STUDY_CONTEXT_PROJECTION,
      )
        .sort({ createdAt: -1, _id: -1 })
        .limit(BRAND_PROPOSAL_LIMIT)
        .lean(),
      AdDeal.find(
        { userId },
        AD_DEAL_STUDY_CONTEXT_PROJECTION,
      )
        .sort({ dealDate: -1, createdAt: -1, _id: -1 })
        .limit(AD_DEAL_LIMIT)
        .lean(),
    ])
    : [[], [], []];

  const metrics = toPlainRecords(metricDocs) as PostCreationAdaptiveServerMetricPost[];
  const accountInsight = normalizeAccountInsight(accountInsightDoc);
  const audienceDemographics = normalizeAudienceDemographics(audienceDemographicsDoc);
  const brandReports = toPlainRecords(brandReportDocs);
  const brandProposals = toPlainRecords(brandProposalDocs);
  const adDeals = toPlainRecords(adDealDocs);
  const brandSignals = buildPostCreationAdaptiveCommercialBrandSignals({
    brandReports,
    brandProposals,
    adDeals,
  });
  const result = buildPostCreationAdaptiveStudyContextFromServerSources({
    posts: metrics,
    accountInsight,
    audienceDemographics,
    brandSignals,
    periodDays,
    generatedAt: loadedAt,
  });

  return {
    ...result,
    meta: {
      userId,
      periodDays,
      postLimit,
      loadedAt,
      sources: {
        metrics: metrics.length,
        accountInsight: Boolean(accountInsight),
        audienceDemographics: Boolean(audienceDemographics),
        brandReports: brandReports.length,
        brandProposals: brandProposals.length,
        adDeals: adDeals.length,
      },
    },
  };
}
