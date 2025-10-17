import mongoose, { Schema, model, models, Document, Model, Types } from "mongoose";

export type CommunityEventType = "mentorship" | "live" | "webinar" | "workshop";
export type CommunityEventStatus = "draft" | "scheduled" | "cancelled";

export interface ICommunityEvent extends Document {
  type: CommunityEventType;
  status: CommunityEventStatus;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  timezone: string;
  joinUrl?: string | null;
  reminderUrl?: string | null;
  location?: string | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityEventSchema = new Schema<ICommunityEvent>(
  {
    type: {
      type: String,
      enum: ["mentorship", "live", "webinar", "workshop"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "cancelled"],
      default: "draft",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, default: null },
    timezone: { type: String, required: true, default: "America/Sao_Paulo" },
    joinUrl: { type: String, default: null },
    reminderUrl: { type: String, default: null },
    location: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "community_events",
  }
);

CommunityEventSchema.index({ type: 1, startAt: 1 });
CommunityEventSchema.index({ type: 1, status: 1, startAt: 1 });

const CommunityEventModel =
  (models.CommunityEvent as Model<ICommunityEvent>) ||
  model<ICommunityEvent>("CommunityEvent", CommunityEventSchema);

export default CommunityEventModel;

