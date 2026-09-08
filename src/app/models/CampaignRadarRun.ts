import mongoose, { Schema, type Model } from "mongoose";
import type { CampaignSourceCoverage } from "@/app/lib/campaignRadar/types";

interface CampaignRadarRun {
  day: string;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt: Date | null;
  processed: number;
  apiCost: number;
  sources: CampaignSourceCoverage[];
  error: string | null;
}
const schema = new Schema<CampaignRadarRun>({
  day: { type: String, required: true, unique: true },
  status: { type: String, enum: ["running", "completed", "failed"], required: true },
  startedAt: { type: Date, required: true }, completedAt: { type: Date, default: null },
  processed: { type: Number, default: 0 }, apiCost: { type: Number, enum: [0], default: 0 },
  sources: { type: [new Schema<CampaignSourceCoverage>({ sourceId: String, sourcePlatform: String, discoveryUrl: String,
    fetchedAt: String, discoveredDocuments: Number, emittedOpportunities: Number, warnings: [String] }, { _id: false })], default: [] },
  error: { type: String, default: null },
}, { collection: "campaign_radar_runs", autoCreate: false, autoIndex: false });
schema.index({ startedAt: 1 }, { expireAfterSeconds: 90 * 86400 });
export default (mongoose.models.CampaignRadarRun as Model<CampaignRadarRun> | undefined)
  ?? mongoose.model<CampaignRadarRun>("CampaignRadarRun", schema);
