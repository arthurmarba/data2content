import mongoose, { Document, Model, Schema, Types } from "mongoose";
import type {
  CreatorWeeklyReportPayload,
  CreatorWeeklyReportStatus,
} from "@/app/lib/creatorWeeklyReport/types";

export interface ICreatorWeeklyReport extends Document {
  userId: Types.ObjectId;
  weekKey: string;
  status: CreatorWeeklyReportStatus;
  schemaVersion: number;
  periodStartsAt: Date;
  periodEndsAt: Date;
  generatedAt: Date;
  sourceMetricsUpdatedAt: Date | null;
  coverage: CreatorWeeklyReportPayload["coverage"];
  payload: CreatorWeeklyReportPayload;
  safeErrorCode: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const creatorWeeklyReportSchema = new Schema<ICreatorWeeklyReport>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "generating", "ready", "partial", "failed"],
      required: true,
      default: "queued",
    },
    schemaVersion: { type: Number, required: true },
    periodStartsAt: { type: Date, required: true },
    periodEndsAt: { type: Date, required: true },
    generatedAt: { type: Date, required: true },
    sourceMetricsUpdatedAt: { type: Date, default: null },
    coverage: { type: Schema.Types.Mixed, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    safeErrorCode: { type: String, default: null },
    attempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "creatorweeklyreports",
  },
);

creatorWeeklyReportSchema.index({ userId: 1, weekKey: 1 }, { unique: true });
creatorWeeklyReportSchema.index({ userId: 1, periodEndsAt: -1 });
creatorWeeklyReportSchema.index({ status: 1, updatedAt: 1 });

const CreatorWeeklyReport: Model<ICreatorWeeklyReport> =
  (mongoose.models.CreatorWeeklyReport as Model<ICreatorWeeklyReport>) ||
  mongoose.model<ICreatorWeeklyReport>("CreatorWeeklyReport", creatorWeeklyReportSchema);

export default CreatorWeeklyReport;
