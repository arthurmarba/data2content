import mongoose, { Document, Schema, Types, model, models } from 'mongoose';

export type CampaignLinkEntityType = 'script' | 'publi';
export type CampaignLinkScriptApprovalStatus = 'draft' | 'sent' | 'approved' | 'changes_requested';

export interface ICampaignLink extends Document {
  proposalId: Types.ObjectId;
  userId: Types.ObjectId;
  entityType: CampaignLinkEntityType;
  entityId: Types.ObjectId;
  scriptApprovalStatus?: CampaignLinkScriptApprovalStatus | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignLinkSchema = new Schema<ICampaignLink>(
  {
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: 'BrandProposal',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['script', 'publi'],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    scriptApprovalStatus: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'changes_requested'],
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 3000,
    },
  },
  {
    timestamps: true,
  }
);

CampaignLinkSchema.index(
  { proposalId: 1, entityType: 1, entityId: 1 },
  { unique: true, name: 'campaign_links_unique_entity_per_proposal' }
);
CampaignLinkSchema.index({ userId: 1, proposalId: 1, updatedAt: -1 });
CampaignLinkSchema.index(
  { userId: 1, entityType: 1, entityId: 1, updatedAt: -1 },
  { name: 'campaign_links_user_entity_lookup' }
);

const CampaignLink =
  (models.CampaignLink as mongoose.Model<ICampaignLink>) ||
  model<ICampaignLink>('CampaignLink', CampaignLinkSchema);

export default CampaignLink;
