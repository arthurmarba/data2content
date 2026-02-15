import mongoose, { Schema, Types, Document, model, models } from 'mongoose';

export type BrandProposalStatus = 'novo' | 'visto' | 'respondido' | 'aceito' | 'rejeitado';
export type BrandProposalBudgetIntent = 'provided' | 'requested';
export type BrandProposalSuggestionType =
  | 'aceitar'
  | 'ajustar'
  | 'aceitar_com_extra'
  | 'ajustar_escopo'
  | 'coletar_orcamento';

export interface IBrandProposalAnalysisSnapshot {
  createdAt: Date;
  version?: string;
  analysis: string;
  replyDraft: string;
  suggestionType: BrandProposalSuggestionType;
  suggestedValue?: number | null;
  pricingConsistency?: 'alta' | 'media' | 'baixa';
  pricingSource?: 'calculator_core_v1' | 'historical_only';
  limitations?: string[];
  analysisV2?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface IBrandProposal extends Document {
  userId: Types.ObjectId;
  mediaKitSlug: string;
  brandName: string;
  contactName: string;
  contactEmail: string;
  contactWhatsapp?: string;
  campaignTitle: string;
  campaignDescription?: string;
  deliverables?: string[];
  budget?: number;
  budgetIntent?: BrandProposalBudgetIntent;
  currency?: string;
  creatorProposedBudget?: number | null;
  creatorProposedCurrency?: string;
  creatorProposedAt?: Date;
  status: BrandProposalStatus;
  referenceLinks?: string[];
  originIp?: string;
  userAgent?: string;
  lastResponseAt?: Date;
  lastResponseMessage?: string;
  latestAnalysis?: IBrandProposalAnalysisSnapshot;
  analysisHistory?: IBrandProposalAnalysisSnapshot[];
  upsellNotifiedAt?: Date;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  utmReferrer?: string;
  utmFirstTouchAt?: Date;
  utmLastTouchAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProposalAnalysisSnapshotSchema = new Schema<IBrandProposalAnalysisSnapshot>(
  {
    createdAt: {
      type: Date,
      required: true,
    },
    version: {
      type: String,
      trim: true,
      default: '2.0.0',
    },
    analysis: {
      type: String,
      required: true,
      trim: true,
    },
    replyDraft: {
      type: String,
      required: true,
      trim: true,
    },
    suggestionType: {
      type: String,
      enum: ['aceitar', 'ajustar', 'aceitar_com_extra', 'ajustar_escopo', 'coletar_orcamento'],
      required: true,
      trim: true,
    },
    suggestedValue: {
      type: Number,
    },
    pricingConsistency: {
      type: String,
      enum: ['alta', 'media', 'baixa'],
      trim: true,
    },
    pricingSource: {
      type: String,
      enum: ['calculator_core_v1', 'historical_only'],
      trim: true,
    },
    limitations: {
      type: [String],
      default: [],
    },
    analysisV2: {
      type: Schema.Types.Mixed,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
  },
  {
    _id: false,
  }
);

const BrandProposalSchema = new Schema<IBrandProposal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mediaKitSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contactWhatsapp: {
      type: String,
      trim: true,
    },
    campaignTitle: {
      type: String,
      required: true,
      trim: true,
    },
    campaignDescription: {
      type: String,
      trim: true,
    },
    deliverables: {
      type: [String],
      default: undefined,
    },
    referenceLinks: {
      type: [String],
      default: undefined,
    },
    budget: {
      type: Number,
    },
    budgetIntent: {
      type: String,
      enum: ['provided', 'requested'],
      index: true,
    },
    currency: {
      type: String,
      default: 'BRL',
      trim: true,
    },
    creatorProposedBudget: {
      type: Number,
    },
    creatorProposedCurrency: {
      type: String,
      trim: true,
    },
    creatorProposedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['novo', 'visto', 'respondido', 'aceito', 'rejeitado'],
      default: 'novo',
      index: true,
    },
    originIp: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    lastResponseAt: {
      type: Date,
    },
    lastResponseMessage: {
      type: String,
      trim: true,
    },
    latestAnalysis: {
      type: ProposalAnalysisSnapshotSchema,
    },
    analysisHistory: {
      type: [ProposalAnalysisSnapshotSchema],
      default: undefined,
    },
    upsellNotifiedAt: {
      type: Date,
    },
    utmSource: {
      type: String,
      trim: true,
    },
    utmMedium: {
      type: String,
      trim: true,
    },
    utmCampaign: {
      type: String,
      trim: true,
    },
    utmTerm: {
      type: String,
      trim: true,
    },
    utmContent: {
      type: String,
      trim: true,
    },
    utmReferrer: {
      type: String,
      trim: true,
    },
    utmFirstTouchAt: {
      type: Date,
    },
    utmLastTouchAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

BrandProposalSchema.index({ userId: 1, createdAt: -1 });
BrandProposalSchema.index({ mediaKitSlug: 1, createdAt: -1 });

const BrandProposal =
  (models.BrandProposal as mongoose.Model<IBrandProposal>) ||
  model<IBrandProposal>('BrandProposal', BrandProposalSchema);

export default BrandProposal;
