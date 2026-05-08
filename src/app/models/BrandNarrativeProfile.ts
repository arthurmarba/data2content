import mongoose, { Schema, Types, Document, model } from 'mongoose';

export type BrandNarrativeStatus =
  | 'observed_external'
  | 'user_requested_unverified'
  | 'ai_generated'
  | 'human_validated'
  | 'brand_registered';

export type BrandNarrativeSource =
  | 'manual_seed'
  | 'admin_created'
  | 'creator_requested'
  | 'ai_enriched'
  | 'imported_csv';

export type BrandNarrativeValidationStatus = 'draft' | 'pending_review' | 'validated' | 'rejected';

export interface IBrandNarrativeMatchExample {
  title: string;
  description: string;
  creatorContext?: string[];
}

export interface IBrandNarrativeUsageStats {
  reportsGenerated: number;
  timesSuggested: number;
  timesSelected: number;
  lastUsedAt?: Date;
}

export interface IBrandNarrativeProfile extends Document {
  brandName: string;
  normalizedName: string;
  slug: string;
  status: BrandNarrativeStatus;
  source: BrandNarrativeSource;
  validationStatus: BrandNarrativeValidationStatus;
  confidenceScore: number;
  category: string[];
  subcategories?: string[];
  territories: string[];
  contexts: string[];
  narrativeForms: string[];
  contentIntents: string[];
  contentSignals: string[];
  tones: string[];
  proofStyles: string[];
  commercialModes: string[];
  products?: string[];
  campaignKeywords?: string[];
  avoidContexts?: string[];
  insertionIdeas: string[];
  matchExamples?: IBrandNarrativeMatchExample[];
  createdBy?: Types.ObjectId;
  validatedBy?: Types.ObjectId;
  validatedAt?: Date;
  archivedAt?: Date;
  notes?: string;
  usageStats?: IBrandNarrativeUsageStats;
  createdAt: Date;
  updatedAt: Date;
}

const BRAND_NARRATIVE_STATUSES: BrandNarrativeStatus[] = [
  'observed_external',
  'user_requested_unverified',
  'ai_generated',
  'human_validated',
  'brand_registered',
];

const BRAND_NARRATIVE_SOURCES: BrandNarrativeSource[] = [
  'manual_seed',
  'admin_created',
  'creator_requested',
  'ai_enriched',
  'imported_csv',
];

const BRAND_NARRATIVE_VALIDATION_STATUSES: BrandNarrativeValidationStatus[] = [
  'draft',
  'pending_review',
  'validated',
  'rejected',
];

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeName(value: string): string {
  return stripAccents(value).toLowerCase().trim().replace(/\s+/g, ' ');
}

function createSlug(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

const MatchExampleSchema = new Schema<IBrandNarrativeMatchExample>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    creatorContext: {
      type: [String],
      default: undefined,
      set: normalizeOptionalStringArray,
    },
  },
  {
    _id: false,
  }
);

const UsageStatsSchema = new Schema<IBrandNarrativeUsageStats>(
  {
    reportsGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    timesSuggested: {
      type: Number,
      default: 0,
      min: 0,
    },
    timesSelected: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    _id: false,
  }
);

const BrandNarrativeProfileSchema = new Schema<IBrandNarrativeProfile>(
  {
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: BRAND_NARRATIVE_STATUSES,
      default: 'observed_external',
      required: true,
    },
    source: {
      type: String,
      enum: BRAND_NARRATIVE_SOURCES,
      default: 'manual_seed',
      required: true,
    },
    validationStatus: {
      type: String,
      enum: BRAND_NARRATIVE_VALIDATION_STATUSES,
      default: 'draft',
      required: true,
    },
    confidenceScore: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
      required: true,
    },
    category: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    subcategories: {
      type: [String],
      default: undefined,
      set: normalizeOptionalStringArray,
    },
    territories: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    contexts: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    narrativeForms: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    contentIntents: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    contentSignals: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    tones: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    proofStyles: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    commercialModes: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    products: {
      type: [String],
      default: undefined,
      set: normalizeOptionalStringArray,
    },
    campaignKeywords: {
      type: [String],
      default: undefined,
      set: normalizeOptionalStringArray,
    },
    avoidContexts: {
      type: [String],
      default: undefined,
      set: normalizeOptionalStringArray,
    },
    insertionIdeas: {
      type: [String],
      default: [],
      set: normalizeStringArray,
    },
    matchExamples: {
      type: [MatchExampleSchema],
      default: undefined,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    validatedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    usageStats: {
      type: UsageStatsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'brandnarrativeprofiles',
  }
);

BrandNarrativeProfileSchema.pre('validate', function normalizeBrandNarrativeProfile(next) {
  if (typeof this.brandName === 'string') {
    this.brandName = this.brandName.trim();
  }

  if (this.brandName) {
    this.normalizedName = normalizeName(this.brandName);
    this.slug = createSlug(this.brandName);
  }

  next();
});

BrandNarrativeProfileSchema.index({ slug: 1 }, { unique: true });
BrandNarrativeProfileSchema.index({ normalizedName: 1 });
BrandNarrativeProfileSchema.index({ category: 1 });
BrandNarrativeProfileSchema.index({ territories: 1 });
BrandNarrativeProfileSchema.index({ contexts: 1 });
BrandNarrativeProfileSchema.index({ narrativeForms: 1 });
BrandNarrativeProfileSchema.index({ contentIntents: 1 });
BrandNarrativeProfileSchema.index({ commercialModes: 1 });
BrandNarrativeProfileSchema.index({ validationStatus: 1, status: 1 });
BrandNarrativeProfileSchema.index({ 'usageStats.reportsGenerated': -1 });
BrandNarrativeProfileSchema.index({ archivedAt: 1 });

const BrandNarrativeProfile =
  (mongoose.models.BrandNarrativeProfile as mongoose.Model<IBrandNarrativeProfile>) ||
  model<IBrandNarrativeProfile>('BrandNarrativeProfile', BrandNarrativeProfileSchema);

export default BrandNarrativeProfile;
