import mongoose, { Schema, Types, Document, model } from "mongoose";

export type CreatorStrategicProfileSnapshotStatus = "active" | "inactive" | "archived";

export type CreatorStrategicProfileSnapshotSource =
  | "manual_seed"
  | "mock_analysis"
  | "future_video_analysis"
  | "imported"
  | "unknown";

export interface ICreatorStrategicProfileSnapshot extends Document {
  userId: Types.ObjectId;
  status: CreatorStrategicProfileSnapshotStatus;
  accessLevel: "free" | "premium" | "instagram_optimized";
  snapshotJson: string;
  source: CreatorStrategicProfileSnapshotSource;
  lastAnalyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CreatorStrategicProfileSnapshotSchema = new Schema<ICreatorStrategicProfileSnapshot>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      required: true,
    },
    accessLevel: {
      type: String,
      enum: ["free", "premium", "instagram_optimized"],
      default: "free",
      required: true,
    },
    snapshotJson: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      enum: ["manual_seed", "mock_analysis", "future_video_analysis", "imported", "unknown"],
      default: "manual_seed",
      required: true,
    },
    lastAnalyzedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "creatorstrategicprofilesnapshots",
  }
);

// Índices adicionais para consultas rápidas
CreatorStrategicProfileSnapshotSchema.index({ status: 1 });
CreatorStrategicProfileSnapshotSchema.index({ lastAnalyzedAt: -1 });

const CreatorStrategicProfileSnapshot =
  (mongoose.models.CreatorStrategicProfileSnapshot as mongoose.Model<ICreatorStrategicProfileSnapshot>) ||
  model<ICreatorStrategicProfileSnapshot>("CreatorStrategicProfileSnapshot", CreatorStrategicProfileSnapshotSchema);

export default CreatorStrategicProfileSnapshot;
