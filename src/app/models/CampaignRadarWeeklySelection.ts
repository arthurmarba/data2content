import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICampaignRadarWeeklySelection extends Document {
  userKey: string;
  weekStartsOn: string;
  opportunityId: string;
  catalogBatchId: string;
  assignedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignRadarWeeklySelectionSchema = new Schema<ICampaignRadarWeeklySelection>(
  {
    userKey: { type: String, required: true, trim: true },
    weekStartsOn: { type: String, required: true, trim: true },
    opportunityId: { type: String, required: true, trim: true },
    catalogBatchId: { type: String, required: true, trim: true },
    assignedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "campaign_radar_weekly_selections" },
);

CampaignRadarWeeklySelectionSchema.index(
  { userKey: 1, weekStartsOn: 1 },
  { unique: true },
);
CampaignRadarWeeklySelectionSchema.index({ opportunityId: 1 });
CampaignRadarWeeklySelectionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CampaignRadarWeeklySelectionModel: Model<ICampaignRadarWeeklySelection> =
  (mongoose.models.CampaignRadarWeeklySelection as
    | Model<ICampaignRadarWeeklySelection>
    | undefined) ??
  mongoose.model<ICampaignRadarWeeklySelection>(
    "CampaignRadarWeeklySelection",
    CampaignRadarWeeklySelectionSchema,
  );

export default CampaignRadarWeeklySelectionModel;
