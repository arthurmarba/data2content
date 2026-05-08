import mongoose, { Schema, Types, Document, model } from 'mongoose';
import { randomBytes } from 'crypto';

export type BrandNarrativeReportStatus = 'active' | 'archived';
export type BrandNarrativeReportMatchLevel = 'alto' | 'medio' | 'baixo';

export interface IBrandNarrativeReportBrand {
  brandId?: Types.ObjectId | null;
  brandName: string;
  slug?: string | null;
  category?: string[];
  subcategories?: string[];
}

export interface IBrandNarrativeReportCreator {
  name?: string | null;
  handle?: string | null;
  profilePictureUrl?: string | null;
  mediaKitSlug?: string | null;
}

export interface IBrandNarrativeReportPauta {
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  theme?: string | null;
  keywords?: string[];
}

export interface IBrandNarrativeReportMatch {
  matchScore?: number | null;
  matchLevel?: BrandNarrativeReportMatchLevel;
  confidenceScore?: number | null;
  matchedSignals?: string[];
  rationale: string;
  insertionAngle: string;
  suggestedDeliverables: string[];
  suggestedApproachMessage?: string | null;
  disclaimer: string;
}

export interface IBrandNarrativeReportEvidencePost {
  id: string;
  title?: string | null;
  description?: string | null;
  postLink?: string | null;
  coverUrl?: string | null;
  postDate?: Date | null;
  format?: string | null;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saved?: number | null;
  totalInteractions?: number | null;
}

export interface IBrandNarrativeReportMetricsSummary {
  postsAnalyzed: number;
  evidenceCount: number;
  totalViews?: number | null;
  totalReach?: number | null;
  totalInteractions?: number | null;
  avgViews?: number | null;
  avgInteractions?: number | null;
  topViews?: number | null;
  topInteractions?: number | null;
}

export interface IBrandNarrativeReportNarrativeFormulaStep {
  title: string;
  description: string;
}

export interface IBrandNarrativeReportActivationPlanStep {
  title: string;
  description: string;
}

export interface IBrandNarrativeReportContent {
  headline: string;
  executiveSummary: string;
  narrativeThesis: string;
  narrativeFormula?: IBrandNarrativeReportNarrativeFormulaStep[];
  brandFit: string;
  evidenceReading?: string;
  organicProof: string;
  campaignConcept?: string;
  campaignIdea: string;
  activationPlan?: IBrandNarrativeReportActivationPlanStep[];
  brandRole?: string;
  commercialClose?: string;
  suggestedExecution: string[];
  creatorApproachMessage: string;
  disclaimer: string;
}

export interface IBrandNarrativeReport extends Document {
  userId: Types.ObjectId;
  publicSlug: string;
  status: BrandNarrativeReportStatus;
  brand: IBrandNarrativeReportBrand;
  creator: IBrandNarrativeReportCreator;
  pauta: IBrandNarrativeReportPauta;
  decisionSnapshot?: Record<string, unknown>;
  match: IBrandNarrativeReportMatch;
  evidencePosts: IBrandNarrativeReportEvidencePost[];
  metricsSummary: IBrandNarrativeReportMetricsSummary;
  reportContent: IBrandNarrativeReportContent;
  createdAt: Date;
  updatedAt: Date;
}

const REPORT_STATUSES: BrandNarrativeReportStatus[] = ['active', 'archived'];
const MATCH_LEVELS: BrandNarrativeReportMatchLevel[] = ['alto', 'medio', 'baixo'];

function createPublicSlug() {
  return `br-${randomBytes(6).toString('base64url')}`;
}

function normalizeStringArray(values: unknown): string[] {
  const list = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of list) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeOptionalStringArray(values: unknown): string[] | undefined {
  const normalized = normalizeStringArray(values);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePublicSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const BrandReportBrandSchema = new Schema<IBrandNarrativeReportBrand>(
  {
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandNarrativeProfile', default: null },
    brandName: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, default: null },
    category: { type: [String], default: undefined, set: normalizeOptionalStringArray },
    subcategories: { type: [String], default: undefined, set: normalizeOptionalStringArray },
  },
  { _id: false }
);

const BrandReportCreatorSchema = new Schema<IBrandNarrativeReportCreator>(
  {
    name: { type: String, trim: true, default: null },
    handle: { type: String, trim: true, default: null },
    profilePictureUrl: { type: String, trim: true, default: null },
    mediaKitSlug: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const BrandReportPautaSchema = new Schema<IBrandNarrativeReportPauta>(
  {
    title: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    reason: { type: String, trim: true, default: null },
    theme: { type: String, trim: true, default: null },
    keywords: { type: [String], default: undefined, set: normalizeOptionalStringArray },
  },
  { _id: false }
);

const BrandReportMatchSchema = new Schema<IBrandNarrativeReportMatch>(
  {
    matchScore: { type: Number, min: 0, max: 1, default: null },
    matchLevel: { type: String, enum: MATCH_LEVELS, default: undefined },
    confidenceScore: { type: Number, min: 0, max: 1, default: null },
    matchedSignals: { type: [String], default: undefined, set: normalizeOptionalStringArray },
    rationale: { type: String, required: true, trim: true },
    insertionAngle: { type: String, required: true, trim: true },
    suggestedDeliverables: { type: [String], default: [], set: normalizeStringArray },
    suggestedApproachMessage: { type: String, trim: true, default: null },
    disclaimer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const BrandReportEvidencePostSchema = new Schema<IBrandNarrativeReportEvidencePost>(
  {
    id: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    postLink: { type: String, trim: true, default: null },
    coverUrl: { type: String, trim: true, default: null },
    postDate: { type: Date, default: null },
    format: { type: String, trim: true, default: null },
    views: { type: Number, default: null },
    reach: { type: Number, default: null },
    likes: { type: Number, default: null },
    comments: { type: Number, default: null },
    shares: { type: Number, default: null },
    saved: { type: Number, default: null },
    totalInteractions: { type: Number, default: null },
  },
  { _id: false }
);

const BrandReportMetricsSummarySchema = new Schema<IBrandNarrativeReportMetricsSummary>(
  {
    postsAnalyzed: { type: Number, default: 0, min: 0 },
    evidenceCount: { type: Number, default: 0, min: 0 },
    totalViews: { type: Number, default: null },
    totalReach: { type: Number, default: null },
    totalInteractions: { type: Number, default: null },
    avgViews: { type: Number, default: null },
    avgInteractions: { type: Number, default: null },
    topViews: { type: Number, default: null },
    topInteractions: { type: Number, default: null },
  },
  { _id: false }
);

const BrandReportNarrativeFormulaStepSchema = new Schema<IBrandNarrativeReportNarrativeFormulaStep>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const BrandReportActivationPlanStepSchema = new Schema<IBrandNarrativeReportActivationPlanStep>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const BrandReportContentSchema = new Schema<IBrandNarrativeReportContent>(
  {
    headline: { type: String, required: true, trim: true },
    executiveSummary: { type: String, required: true, trim: true },
    narrativeThesis: { type: String, required: true, trim: true },
    narrativeFormula: { type: [BrandReportNarrativeFormulaStepSchema], default: undefined },
    brandFit: { type: String, required: true, trim: true },
    evidenceReading: { type: String, trim: true, default: undefined },
    organicProof: { type: String, required: true, trim: true },
    campaignConcept: { type: String, trim: true, default: undefined },
    campaignIdea: { type: String, required: true, trim: true },
    activationPlan: { type: [BrandReportActivationPlanStepSchema], default: undefined },
    brandRole: { type: String, trim: true, default: undefined },
    commercialClose: { type: String, trim: true, default: undefined },
    suggestedExecution: { type: [String], default: [], set: normalizeStringArray },
    creatorApproachMessage: { type: String, required: true, trim: true },
    disclaimer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const BrandNarrativeReportSchema = new Schema<IBrandNarrativeReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publicSlug: { type: String, required: true, trim: true },
    status: { type: String, enum: REPORT_STATUSES, default: 'active', required: true },
    brand: { type: BrandReportBrandSchema, required: true },
    creator: { type: BrandReportCreatorSchema, default: () => ({}) },
    pauta: { type: BrandReportPautaSchema, default: () => ({}) },
    decisionSnapshot: { type: Schema.Types.Mixed, default: undefined },
    match: { type: BrandReportMatchSchema, required: true },
    evidencePosts: { type: [BrandReportEvidencePostSchema], default: [] },
    metricsSummary: { type: BrandReportMetricsSummarySchema, default: () => ({}) },
    reportContent: { type: BrandReportContentSchema, required: true },
  },
  {
    timestamps: true,
    collection: 'brandnarrativereports',
  }
);

BrandNarrativeReportSchema.pre('validate', function normalizeBrandNarrativeReport(next) {
  if (!this.publicSlug) {
    this.publicSlug = createPublicSlug();
  } else {
    this.publicSlug = normalizePublicSlug(this.publicSlug) || createPublicSlug();
  }

  if (this.creator) {
    this.creator.name = normalizeNullableString(this.creator.name) ?? null;
    this.creator.handle = normalizeNullableString(this.creator.handle) ?? null;
    this.creator.profilePictureUrl = normalizeNullableString(this.creator.profilePictureUrl) ?? null;
    this.creator.mediaKitSlug = normalizeNullableString(this.creator.mediaKitSlug) ?? null;
  }

  next();
});

BrandNarrativeReportSchema.index({ publicSlug: 1 }, { unique: true });
BrandNarrativeReportSchema.index({ userId: 1, createdAt: -1 });
BrandNarrativeReportSchema.index({ 'brand.brandName': 1 });
BrandNarrativeReportSchema.index({ status: 1 });
BrandNarrativeReportSchema.index({ createdAt: -1 });

const BrandNarrativeReport =
  (mongoose.models.BrandNarrativeReport as mongoose.Model<IBrandNarrativeReport>) ||
  model<IBrandNarrativeReport>('BrandNarrativeReport', BrandNarrativeReportSchema);

export default BrandNarrativeReport;
