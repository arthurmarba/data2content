import mongoose, { Schema, model, models, Types, Document } from "mongoose";

const USAGE_EVENT_CATEGORIES = [
  "session",
  "pautas",
  "publi",
  "mapa",
  "video",
  "chat",
  "mediakit",
  "collabs",
] as const;

export type UsageEventCategory = (typeof USAGE_EVENT_CATEGORIES)[number];

export interface IUsageEvent extends Document {
  userId: Types.ObjectId;
  eventName: string;
  category: UsageEventCategory;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const UsageEventSchema = new Schema<IUsageEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventName: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: USAGE_EVENT_CATEGORIES, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "usage_events",
  }
);

UsageEventSchema.index({ userId: 1, createdAt: -1 }, { name: "usage_events_user_created_at" });
UsageEventSchema.index({ eventName: 1, createdAt: -1 }, { name: "usage_events_event_created_at" });

const UsageEventModel =
  (models.UsageEvent as mongoose.Model<IUsageEvent>) ||
  model<IUsageEvent>("UsageEvent", UsageEventSchema);

export default UsageEventModel;
export { USAGE_EVENT_CATEGORIES };
