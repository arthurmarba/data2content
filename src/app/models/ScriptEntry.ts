import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export type ScriptOrigin = "manual" | "ai" | "planner";
export type ScriptLinkType = "standalone" | "planner_slot";

export interface ScriptPlannerRef {
  weekStart?: Date;
  slotId?: string;
  dayOfWeek?: number;
  blockStartHour?: number;
}

export interface ScriptInlineAnnotation {
  id: string;
  startIndex: number;
  endIndex: number;
  quote: string;
  comment: string;
  authorName: string;
  isOrphaned: boolean;
  resolved: boolean;
  createdAt: Date;
}

export interface ScriptPostedContentRef {
  metricId: Types.ObjectId;
  caption?: string | null;
  postDate?: Date | null;
  postLink?: string | null;
  type?: string | null;
  engagement?: number | null;
  totalInteractions?: number | null;
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
  inlineAnnotations?: ScriptInlineAnnotation[];
  postedAt?: Date | null;
  postedContent?: ScriptPostedContentRef | null;
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

const ScriptInlineAnnotationSchema = new Schema<ScriptInlineAnnotation>(
  {
    id: { type: String, required: true },
    startIndex: { type: Number, required: true },
    endIndex: { type: Number, required: true },
    quote: { type: String, required: true, maxlength: 2000 },
    comment: { type: String, required: true, maxlength: 2000 },
    authorName: { type: String, required: true, maxlength: 120 },
    isOrphaned: { type: Boolean, default: false },
    resolved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ScriptPostedContentRefSchema = new Schema<ScriptPostedContentRef>(
  {
    metricId: { type: Schema.Types.ObjectId, ref: "Metric", required: true },
    caption: { type: String, trim: true, maxlength: 320, default: null },
    postDate: { type: Date, default: null },
    postLink: { type: String, trim: true, maxlength: 1000, default: null },
    type: { type: String, trim: true, maxlength: 60, default: null },
    engagement: { type: Number, default: null },
    totalInteractions: { type: Number, default: null },
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
    inlineAnnotations: { type: [ScriptInlineAnnotationSchema], default: [] },
    postedAt: { type: Date, default: null, index: true },
    postedContent: { type: ScriptPostedContentRefSchema, default: null },
  },
  {
    timestamps: true,
    collection: "script_entries",
  }
);

ScriptEntrySchema.index({ userId: 1, updatedAt: -1 }, { name: "script_entries_user_updated_at" });
ScriptEntrySchema.index({ userId: 1, linkType: 1 }, { name: "script_entries_user_link_type" });
ScriptEntrySchema.index(
  { userId: 1, postedAt: -1 },
  { name: "script_entries_user_posted_time" }
);
ScriptEntrySchema.index(
  { userId: 1, "postedContent.metricId": 1 },
  {
    name: "script_entries_user_posted_metric",
    partialFilterExpression: { "postedContent.metricId": { $exists: true } },
  }
);
ScriptEntrySchema.index(
  { userId: 1, isAdminRecommendation: 1, recommendedAt: -1, updatedAt: -1 },
  { name: "script_entries_user_recommendation_time" }
);
ScriptEntrySchema.index(
  { userId: 1, adminAnnotationUpdatedAt: -1, updatedAt: -1 },
  { name: "script_entries_user_admin_annotation_time" }
);
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
