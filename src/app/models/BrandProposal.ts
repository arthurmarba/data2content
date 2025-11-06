import mongoose, { Schema, Types, Document, model, models } from 'mongoose';

export type BrandProposalStatus = 'novo' | 'visto' | 'respondido' | 'aceito' | 'rejeitado';

export interface IBrandProposal extends Document {
  userId: Types.ObjectId;
  mediaKitSlug: string;
  brandName: string;
  contactEmail: string;
  contactWhatsapp?: string;
  campaignTitle: string;
  campaignDescription?: string;
  deliverables?: string[];
  budget?: number;
  currency?: string;
  status: BrandProposalStatus;
  referenceLinks?: string[];
  originIp?: string;
  userAgent?: string;
  lastResponseAt?: Date;
  lastResponseMessage?: string;
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
    currency: {
      type: String,
      default: 'BRL',
      trim: true,
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
