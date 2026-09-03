import { connectToDatabase } from "@/app/lib/mongoose";
import { createHash } from "node:crypto";
import CampaignRadarOpportunityModel from "@/app/models/CampaignRadarOpportunity";
import CampaignRadarWeeklySelectionModel from "@/app/models/CampaignRadarWeeklySelection";
import { normalizeOpportunityForCatalog, type CatalogCampaignOpportunity } from "./catalog";
import { campaignRadarWeekKey, selectWeeklyFreeOpportunity } from "./matching";
import type { CampaignOpportunity, CampaignRadarBatch } from "./types";

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function persistenceRecord(opportunity: CatalogCampaignOpportunity) {
  return {
    opportunityId: opportunity.id,
    catalogBatchId: opportunity.catalogBatchId,
    reportDate: opportunity.reportDate,
    activeInCatalog: opportunity.activeInCatalog,
    sourceId: opportunity.sourceId,
    sourcePlatform: opportunity.sourcePlatform,
    sourceVisibility: opportunity.sourceVisibility,
    sourceUrl: opportunity.sourceUrl,
    applicationUrl: opportunity.applicationUrl,
    applicationLabel: opportunity.applicationLabel,
    requiresAccount: opportunity.requiresAccount,
    title: opportunity.title,
    brand: opportunity.brand,
    summary: opportunity.summary,
    opportunityType: opportunity.opportunityType,
    territories: opportunity.territories,
    platforms: opportunity.platforms,
    formats: opportunity.formats,
    requirements: opportunity.requirements,
    deliverables: opportunity.deliverables,
    compensation: opportunity.compensation,
    applicationDeadline: asDate(opportunity.applicationDeadline),
    publishedAt: asDate(opportunity.publishedAt),
    discoveredAt: asDate(opportunity.discoveredAt),
    lastVerifiedAt: asDate(opportunity.lastVerifiedAt),
    status: opportunity.status,
    evidence: opportunity.evidence,
    review: {
      ...opportunity.review,
      reviewedAt: asDate(opportunity.review.reviewedAt),
    },
  };
}

export interface CampaignRadarImportPreview {
  catalogBatchId: string;
  reportDate: string;
  totalRecords: number;
  activeReviewedRecords: number;
  publiclyQueryableRecords: number;
  restrictedActiveRecords: number;
}

export function previewCampaignRadarImport(batch: CampaignRadarBatch): CampaignRadarImportPreview {
  const normalized = batch.opportunities.map((item) =>
    normalizeOpportunityForCatalog(item, batch.reportDate),
  );
  return {
    catalogBatchId: `campaign-radar:${batch.reportDate}`,
    reportDate: batch.reportDate,
    totalRecords: normalized.length,
    activeReviewedRecords: normalized.filter((item) => item.activeInCatalog).length,
    publiclyQueryableRecords: normalized.filter(
      (item) =>
        item.activeInCatalog &&
        item.sourceVisibility === "publicly_observable" &&
        item.status === "open" &&
        item.review.status === "approved" &&
        item.opportunityType !== "creator_program" &&
        item.opportunityType !== "challenge",
    ).length,
    restrictedActiveRecords: normalized.filter(
      (item) => item.activeInCatalog && item.sourceVisibility === "restricted",
    ).length,
  };
}

export async function replaceCampaignRadarCatalog(batch: CampaignRadarBatch) {
  const normalized = batch.opportunities.map((item) =>
    normalizeOpportunityForCatalog(item, batch.reportDate),
  );
  const preview = previewCampaignRadarImport(batch);

  const database = await connectToDatabase();
  const session = await database.startSession();
  try {
    await session.withTransaction(async () => {
      if (normalized.length > 0) {
        await CampaignRadarOpportunityModel.bulkWrite(
          normalized.map((item) => ({
            updateOne: {
              filter: { opportunityId: item.id },
              update: { $set: persistenceRecord(item) },
              upsert: true,
            },
          })),
          { ordered: true, session },
        );
      }

      await CampaignRadarOpportunityModel.updateMany(
        { catalogBatchId: { $ne: preview.catalogBatchId }, activeInCatalog: true },
        { $set: { activeInCatalog: false } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return preview;
}

type LeanCampaignRadarOpportunity = Omit<CampaignOpportunity, "id" | "applicationDeadline" | "publishedAt" | "discoveredAt" | "lastVerifiedAt" | "review"> & {
  opportunityId: string;
  reportDate: string;
  catalogBatchId: string;
  activeInCatalog: boolean;
  sourceVisibility: CatalogCampaignOpportunity["sourceVisibility"];
  applicationDeadline: Date | null;
  publishedAt: Date | null;
  discoveredAt: Date;
  lastVerifiedAt: Date;
  review: Omit<CampaignOpportunity["review"], "reviewedAt"> & { reviewedAt: Date | null };
};

function isoDate(value: Date | string | null | undefined, dateOnly = false): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  return dateOnly ? iso.slice(0, 10) : iso;
}

function fromPersistence(record: LeanCampaignRadarOpportunity): CatalogCampaignOpportunity {
  return {
    id: record.opportunityId,
    reportDate: record.reportDate,
    catalogBatchId: record.catalogBatchId,
    activeInCatalog: record.activeInCatalog,
    sourceVisibility: record.sourceVisibility,
    sourceId: record.sourceId,
    sourcePlatform: record.sourcePlatform,
    sourceUrl: record.sourceUrl,
    applicationUrl: record.applicationUrl,
    applicationLabel: record.applicationLabel,
    requiresAccount: record.requiresAccount,
    title: record.title,
    brand: record.brand,
    summary: record.summary,
    opportunityType: record.opportunityType,
    territories: record.territories,
    platforms: record.platforms,
    formats: record.formats,
    requirements: record.requirements,
    deliverables: record.deliverables,
    compensation: record.compensation,
    applicationDeadline: isoDate(record.applicationDeadline, true),
    publishedAt: isoDate(record.publishedAt, true),
    discoveredAt: isoDate(record.discoveredAt) ?? new Date(0).toISOString(),
    lastVerifiedAt: isoDate(record.lastVerifiedAt) ?? new Date(0).toISOString(),
    status: record.status,
    evidence: record.evidence,
    review: {
      ...record.review,
      reviewedAt: isoDate(record.review.reviewedAt),
    },
  };
}

export interface ListCampaignRadarCatalogOptions {
  includePrograms?: boolean;
  now?: Date;
  maxAgeDays?: number;
}

export function saoPauloDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function listPublicCampaignRadarCatalog(
  options: ListCampaignRadarCatalogOptions = {},
): Promise<CatalogCampaignOpportunity[]> {
  const now = options.now ?? new Date();
  const maxAgeDays = Math.max(1, Math.min(30, options.maxAgeDays ?? 8));
  const freshSince = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const todayStart = new Date(`${saoPauloDateKey(now)}T00:00:00.000Z`);

  await connectToDatabase();
  const records = await CampaignRadarOpportunityModel.find({
    activeInCatalog: true,
    sourceVisibility: "publicly_observable",
    status: "open",
    "review.status": "approved",
    lastVerifiedAt: { $gte: freshSince },
    applicationDeadline: { $gte: todayStart },
    opportunityType: options.includePrograms
      ? { $nin: ["challenge"] }
      : { $nin: ["challenge", "creator_program"] },
  })
    .sort({ applicationDeadline: 1, lastVerifiedAt: -1, opportunityId: 1 })
    .limit(500)
    .lean();

  return (records as unknown as LeanCampaignRadarOpportunity[]).map(fromPersistence);
}

interface LeanCampaignRadarWeeklySelection {
  userKey: string;
  weekStartsOn: string;
  opportunityId: string;
  catalogBatchId: string;
  assignedAt: Date;
  expiresAt: Date;
}

export interface WeeklyFreeOpportunityAssignment {
  weekStartsOn: string;
  opportunity: CatalogCampaignOpportunity | null;
  assignedOpportunityUnavailable: boolean;
}

function duplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000,
  );
}

export async function getOrAssignWeeklyFreeOpportunity(params: {
  opportunities: CatalogCampaignOpportunity[];
  userId: string;
  creatorDescription: string | null;
  now?: Date;
}): Promise<WeeklyFreeOpportunityAssignment> {
  const now = params.now ?? new Date();
  const weekStartsOn = campaignRadarWeekKey(now);
  const userKey = createHash("sha256").update(params.userId).digest("hex");
  await connectToDatabase();

  const existing = await CampaignRadarWeeklySelectionModel.findOne({
    userKey,
    weekStartsOn,
  }).lean() as LeanCampaignRadarWeeklySelection | null;
  if (existing) {
    const opportunity = params.opportunities.find(
      (item) => item.id === existing.opportunityId,
    ) ?? null;
    return {
      weekStartsOn,
      opportunity,
      assignedOpportunityUnavailable: opportunity === null,
    };
  }

  const candidate = selectWeeklyFreeOpportunity(
    params.opportunities,
    params.userId,
    params.creatorDescription,
    now,
  );
  if (!candidate) {
    return { weekStartsOn, opportunity: null, assignedOpportunityUnavailable: false };
  }

  let assignment: LeanCampaignRadarWeeklySelection | null = null;
  try {
    assignment = await CampaignRadarWeeklySelectionModel.findOneAndUpdate(
      { userKey, weekStartsOn },
      {
        $setOnInsert: {
          userKey,
          weekStartsOn,
          opportunityId: candidate.opportunity.id,
          catalogBatchId: candidate.opportunity.catalogBatchId,
          assignedAt: now,
          expiresAt: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1_000),
        },
      },
      { upsert: true, new: true },
    ).lean() as LeanCampaignRadarWeeklySelection | null;
  } catch (error) {
    if (!duplicateKeyError(error)) throw error;
    assignment = await CampaignRadarWeeklySelectionModel.findOne({
      userKey,
      weekStartsOn,
    }).lean() as LeanCampaignRadarWeeklySelection | null;
  }

  if (!assignment) {
    throw new Error("Não foi possível registrar a seleção semanal de publicidade.");
  }
  const opportunity = params.opportunities.find(
    (item) => item.id === assignment!.opportunityId,
  ) ?? null;
  return {
    weekStartsOn,
    opportunity,
    assignedOpportunityUnavailable: opportunity === null,
  };
}
