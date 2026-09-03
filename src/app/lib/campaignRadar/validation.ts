import { z } from "zod";
import { sourceRegistryEntry } from "./sourceRegistry";
import type { CampaignRadarBatch } from "./types";

const dateOnlySchema = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(
  (value) => {
    const date = new Date(`${value}T12:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  "Data inválida.",
);

const isoDateSchema = z.string().datetime({ offset: true });
const httpsUrlSchema = z.string().url().refine(
  (value) => new URL(value).protocol === "https:",
  "A URL precisa usar HTTPS.",
);
const shortString = z.string().trim().min(1).max(500);
const labelList = z.array(z.string().trim().min(1).max(240)).max(50);
const detailList = z.array(z.string().trim().min(1).max(1_500)).max(50);

const compensationSchema = z.object({
  type: z.enum(["fixed", "range", "variable", "barter", "prize", "unknown"]),
  minimum: z.number().nonnegative().max(100_000_000).nullable(),
  maximum: z.number().nonnegative().max(100_000_000).nullable(),
  currency: z.literal("BRL"),
  basis: z.enum([
    "per_creator",
    "per_delivery",
    "per_view",
    "per_sale",
    "total_campaign_budget",
    "unknown",
  ]),
  sourceText: z.string().trim().max(1_000).nullable(),
  confirmed: z.boolean(),
  includesProduct: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.minimum != null && value.maximum != null && value.minimum > value.maximum) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maximum"],
      message: "O valor máximo não pode ser menor que o mínimo.",
    });
  }
});

const opportunitySchema = z.object({
  id: z.string().trim().min(1).max(240),
  sourceId: z.string().trim().min(1).max(120),
  sourcePlatform: z.string().trim().min(1).max(160),
  sourceUrl: httpsUrlSchema,
  applicationUrl: httpsUrlSchema,
  applicationLabel: z.string().trim().min(1).max(160),
  requiresAccount: z.boolean(),
  title: z.string().trim().min(1).max(300),
  brand: z.string().trim().min(1).max(160).nullable(),
  summary: z.string().trim().min(1).max(3_000),
  opportunityType: z.enum([
    "open_application",
    "creator_program",
    "invitation_only",
    "challenge",
    "barter",
    "ugc",
    "informational",
    "unknown",
  ]),
  territories: labelList,
  platforms: labelList,
  formats: labelList,
  requirements: detailList,
  deliverables: detailList,
  compensation: compensationSchema,
  applicationDeadline: dateOnlySchema.nullable(),
  publishedAt: dateOnlySchema.nullable(),
  discoveredAt: isoDateSchema,
  lastVerifiedAt: isoDateSchema,
  status: z.enum(["open", "closed", "uncertain"]),
  evidence: z.array(z.object({
    field: z.string().trim().min(1).max(160),
    excerpt: z.string().trim().min(1).max(1_500),
  }).strict()).max(100),
  review: z.object({
    status: z.enum(["pending", "approved", "rejected"]),
    reviewedAt: isoDateSchema.nullable(),
    reviewedBy: z.string().trim().min(1).max(160).nullable(),
    notes: z.string().trim().max(2_000).nullable(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (!sourceRegistryEntry(value.sourceId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceId"],
      message: `Fonte não cadastrada: ${value.sourceId}.`,
    });
  }
  if (value.review.status !== "pending" && (!value.review.reviewedAt || !value.review.reviewedBy)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["review"],
      message: "Uma decisão de revisão precisa identificar data e responsável.",
    });
  }
});

const sourceCoverageSchema = z.object({
  sourceId: z.string().trim().min(1).max(120),
  sourcePlatform: z.string().trim().min(1).max(160),
  discoveryUrl: httpsUrlSchema,
  fetchedAt: isoDateSchema,
  discoveredDocuments: z.number().int().nonnegative(),
  emittedOpportunities: z.number().int().nonnegative(),
  warnings: z.array(z.string().trim().min(1).max(1_000)).max(100),
}).strict();

export const campaignRadarBatchSchema = z.object({
  schemaVersion: z.literal("campaign_radar_batch_v1"),
  generatedAt: isoDateSchema,
  reportDate: dateOnlySchema,
  coverageStatement: shortString,
  sources: z.array(sourceCoverageSchema).max(100),
  opportunities: z.array(opportunitySchema).max(10_000),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.opportunities.forEach((opportunity, index) => {
    if (seen.has(opportunity.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opportunities", index, "id"],
        message: `ID duplicado no lote: ${opportunity.id}.`,
      });
    }
    seen.add(opportunity.id);
  });
});

export function parseCampaignRadarBatch(value: unknown): CampaignRadarBatch {
  return campaignRadarBatchSchema.parse(value) as CampaignRadarBatch;
}
