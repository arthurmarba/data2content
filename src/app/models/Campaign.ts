import mongoose, { Schema, Document, model, models } from 'mongoose';

export type CampaignStatus = 'pending' | 'in_review' | 'contacted';

export interface ICampaign extends Document {
  brandName: string;
  contactEmail: string;
  contactPhone?: string | null;
  budget?: number | null;
  currency?: string | null;
  description?: string | null;
  segments?: string[];
  referenceLinks?: string[];
  source?: string | null;
  originAffiliate?: string | null;
  originCreatorHandle?: string | null;
  originMediaKitSlug?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  originIp?: string | null;
  userAgent?: string | null;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    brandName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true },
    contactPhone: { type: String, default: null, trim: true },
    budget: { type: Number, default: null },
    currency: { type: String, default: 'BRL' },
    description: { type: String, default: null },
    segments: { type: [String], default: [] },
    referenceLinks: { type: [String], default: [] },
    source: { type: String, default: 'direct' },
    originAffiliate: { type: String, default: null },
    originCreatorHandle: { type: String, default: null },
    originMediaKitSlug: { type: String, default: null },
    utmSource: { type: String, default: null },
    utmMedium: { type: String, default: null },
    utmCampaign: { type: String, default: null },
    originIp: { type: String, default: null },
    userAgent: { type: String, default: null },
    status: { type: String, enum: ['pending', 'in_review', 'contacted'], default: 'pending', index: true },
  },
  { timestamps: true }
);

CampaignSchema.index({ createdAt: -1 });
CampaignSchema.index({ source: 1, createdAt: -1 });
CampaignSchema.index({ originMediaKitSlug: 1, createdAt: -1 });

const Campaign =
  (models.Campaign as mongoose.Model<ICampaign>) ||
  model<ICampaign>('Campaign', CampaignSchema);

export default Campaign;
