import mongoose, { Schema, Types, Document, model } from "mongoose";

export interface ICreatorVideoNarrativeRealAnalysisUsage extends Document {
  userId: Types.ObjectId;
  dateKey: string;
  monthKey: string;
  dailyCount: number;
  monthlyCount: number;
  lastAttemptAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  lastFailureReasonCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CreatorVideoNarrativeRealAnalysisUsageSchema =
  new Schema<ICreatorVideoNarrativeRealAnalysisUsage>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      dateKey: {
        type: String,
        required: true,
      },
      monthKey: {
        type: String,
        required: true,
        index: true,
      },
      dailyCount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      monthlyCount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      lastAttemptAt: {
        type: Date,
        default: null,
      },
      lastSuccessAt: {
        type: Date,
        default: null,
      },
      lastFailureAt: {
        type: Date,
        default: null,
      },
      lastFailureReasonCode: {
        type: String,
        default: null,
        maxlength: 80,
      },
    },
    {
      timestamps: true,
      collection: "creator_video_narrative_real_analysis_usage",
    },
  );

CreatorVideoNarrativeRealAnalysisUsageSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
CreatorVideoNarrativeRealAnalysisUsageSchema.index({ userId: 1, monthKey: 1 });

const CreatorVideoNarrativeRealAnalysisUsage =
  (mongoose.models
    .CreatorVideoNarrativeRealAnalysisUsage as mongoose.Model<ICreatorVideoNarrativeRealAnalysisUsage>) ||
  model<ICreatorVideoNarrativeRealAnalysisUsage>(
    "CreatorVideoNarrativeRealAnalysisUsage",
    CreatorVideoNarrativeRealAnalysisUsageSchema,
  );

export default CreatorVideoNarrativeRealAnalysisUsage;
