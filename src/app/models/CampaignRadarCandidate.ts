import mongoose, { Schema, type Model } from "mongoose";
import type { CampaignOpportunity } from "@/app/lib/campaignRadar/types";

export interface CampaignRadarCandidate {
  key: string;
  opportunity: CampaignOpportunity;
  originalOpportunity?: CampaignOpportunity;
  previousOpportunity?: CampaignOpportunity;
  observationFingerprint?: string;
  intake: "manual" | "automatic";
  decision: "pending" | "internal" | "approved" | "rejected" | "recheck";
  revision: number;
  sightings: number;
  lastSeenAt: Date;
  applicationKey: string;
  history: Array<{ actor: string; action: string; at: Date; note: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CampaignRadarCandidate>({
  key: { type: String, required: true, unique: true },
  // O contrato completo é validado por Zod antes de qualquer escrita no serviço.
  opportunity: { type: Schema.Types.Mixed, required: true },
  originalOpportunity: { type: Schema.Types.Mixed },
  previousOpportunity: { type: Schema.Types.Mixed },
  observationFingerprint: String,
  intake: { type: String, enum: ["manual", "automatic"], required: true },
  decision: { type: String, enum: ["pending", "internal", "approved", "rejected", "recheck"], default: "pending", index: true },
  revision: { type: Number, default: 0 }, sightings: { type: Number, default: 1 },
  lastSeenAt: { type: Date, required: true }, applicationKey: { type: String, required: true, index: true },
  history: [{ _id: false, actor: String, action: String, at: Date, note: String }],
}, { timestamps: true, collection: "campaign_radar_candidates", autoCreate: false, autoIndex: false });
schema.index({ decision: 1, createdAt: -1 });
export default (mongoose.models.CampaignRadarCandidate as Model<CampaignRadarCandidate> | undefined)
  ?? mongoose.model<CampaignRadarCandidate>("CampaignRadarCandidate", schema);
