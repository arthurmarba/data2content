import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export type ScriptOrigin = "manual" | "ai" | "planner";
export type ScriptLinkType = "standalone" | "planner_slot";

export interface ScriptPlannerRef {
  weekStart?: Date;
  slotId?: string;
  dayOfWeek?: number;
  blockStartHour?: number;
}

export interface IScriptEntry extends Document {
  userId: Types.ObjectId;
  title: string;
  content: string;
  source: ScriptOrigin;
  linkType: ScriptLinkType;
  plannerRef?: ScriptPlannerRef;
  aiVersionId?: string | null;
  isAdminRecommendation?: boolean;
  recommendedByAdminId?: Types.ObjectId | null;
  recommendedByAdminName?: string | null;
  recommendedAt?: Date | null;
  adminAnnotation?: string | null;
  adminAnnotationUpdatedById?: Types.ObjectId | null;
  adminAnnotationUpdatedByName?: string | null;
  adminAnnotationUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ScriptPlannerRefSchema = new Schema<ScriptPlannerRef>(
  {
    weekStart: { type: Date },
    slotId: { type: String, trim: true },
    dayOfWeek: { type: Number, min: 1, max: 7 },
    blockStartHour: { type: Number, min: 0, max: 23 },
  },
  { _id: false }
);

const ScriptEntrySchema = new Schema<IScriptEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    source: {
      type: String,
      enum: ["manual", "ai", "planner"],
      default: "manual",
      required: true,
      index: true,
    },
    linkType: {
      type: String,
      enum: ["standalone", "planner_slot"],
      default: "standalone",
      required: true,
      index: true,
    },
    plannerRef: { type: ScriptPlannerRefSchema, default: undefined },
    aiVersionId: { type: String, default: null },
    isAdminRecommendation: { type: Boolean, default: false, index: true },
    recommendedByAdminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    recommendedByAdminName: { type: String, trim: true, maxlength: 120, default: null },
    recommendedAt: { type: Date, default: null },
    adminAnnotation: { type: String, trim: true, maxlength: 5000, default: null },
    adminAnnotationUpdatedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    adminAnnotationUpdatedByName: { type: String, trim: true, maxlength: 120, default: null },
    adminAnnotationUpdatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "script_entries",
  }
);

ScriptEntrySchema.index({ userId: 1, updatedAt: -1 }, { name: "script_entries_user_updated_at" });
ScriptEntrySchema.index({ userId: 1, linkType: 1 }, { name: "script_entries_user_link_type" });
ScriptEntrySchema.index(
  { userId: 1, "plannerRef.weekStart": 1, "plannerRef.slotId": 1 },
  {
    name: "script_entries_user_planner_slot_unique",
    unique: true,
    partialFilterExpression: {
      linkType: "planner_slot",
      "plannerRef.weekStart": { $exists: true },
      "plannerRef.slotId": { $exists: true },
    },
  }
);

const ScriptEntryModel =
  (models.ScriptEntry as mongoose.Model<IScriptEntry>) || model<IScriptEntry>("ScriptEntry", ScriptEntrySchema);

export default ScriptEntryModel;
export { ScriptEntryModel };
