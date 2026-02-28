import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const SCRIPT_OUTCOME_PROFILE_VERSION = "scripts_outcome_profile_v1";

export type ScriptOutcomeConfidence = "low" | "medium" | "high";

export interface ScriptOutcomeBaseline {
  medianInteractions: number;
  medianEngagement: number;
}

export interface ScriptOutcomeCategoryLift {
  id: string;
  lift: number;
  score: number;
  sampleSize: number;
}

export interface ScriptOutcomeTopExample {
  metricId: string;
  scriptId: string;
  caption: string;
  interactions: number;
  engagement: number | null;
  score: number;
  lift: number;
  postDate?: Date | null;
  categories: {
    proposal?: string | null;
    context?: string | null;
    format?: string | null;
    tone?: string | null;
    references?: string | null;
  };
  hookSample?: string | null;
  ctaSample?: string | null;
}

export interface ScriptOutcomeTopByDimension {
  proposal: ScriptOutcomeCategoryLift[];
  context: ScriptOutcomeCategoryLift[];
  format: ScriptOutcomeCategoryLift[];
  tone: ScriptOutcomeCategoryLift[];
  references: ScriptOutcomeCategoryLift[];
}

export interface IScriptOutcomeProfile extends Document {
  userId: Types.ObjectId;
  profileVersion: string;
  sampleSizeLinked: number;
  lastComputedAt?: Date | null;
  baseline: ScriptOutcomeBaseline;
  topByDimension: ScriptOutcomeTopByDimension;
  topExamples: ScriptOutcomeTopExample[];
  confidence: ScriptOutcomeConfidence;
  createdAt: Date;
  updatedAt: Date;
}

const BaselineSchema = new Schema<ScriptOutcomeBaseline>(
  {
    medianInteractions: { type: Number, default: 0, min: 0 },
    medianEngagement: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const CategoryLiftSchema = new Schema<ScriptOutcomeCategoryLift>(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    lift: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    sampleSize: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const TopExampleSchema = new Schema<ScriptOutcomeTopExample>(
  {
    metricId: { type: String, required: true, trim: true, maxlength: 64 },
    scriptId: { type: String, required: true, trim: true, maxlength: 64 },
    caption: { type: String, default: "", trim: true, maxlength: 400 },
    interactions: { type: Number, default: 0, min: 0 },
    engagement: { type: Number, default: null },
    score: { type: Number, default: 0 },
    lift: { type: Number, default: 0 },
    postDate: { type: Date, default: null },
    categories: {
      type: {
        proposal: { type: String, default: null, trim: true, maxlength: 120 },
        context: { type: String, default: null, trim: true, maxlength: 120 },
        format: { type: String, default: null, trim: true, maxlength: 120 },
        tone: { type: String, default: null, trim: true, maxlength: 120 },
        references: { type: String, default: null, trim: true, maxlength: 120 },
      },
      default: () => ({}),
    },
    hookSample: { type: String, default: null, trim: true, maxlength: 240 },
    ctaSample: { type: String, default: null, trim: true, maxlength: 240 },
  },
  { _id: false }
);

const TopByDimensionSchema = new Schema<ScriptOutcomeTopByDimension>(
  {
    proposal: { type: [CategoryLiftSchema], default: [] },
    context: { type: [CategoryLiftSchema], default: [] },
    format: { type: [CategoryLiftSchema], default: [] },
    tone: { type: [CategoryLiftSchema], default: [] },
    references: { type: [CategoryLiftSchema], default: [] },
  },
  { _id: false }
);

const ScriptOutcomeProfileSchema = new Schema<IScriptOutcomeProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    profileVersion: { type: String, required: true, default: SCRIPT_OUTCOME_PROFILE_VERSION },
    sampleSizeLinked: { type: Number, required: true, default: 0, min: 0 },
    lastComputedAt: { type: Date, default: null },
    baseline: { type: BaselineSchema, required: true, default: () => ({}) },
    topByDimension: { type: TopByDimensionSchema, required: true, default: () => ({}) },
    topExamples: { type: [TopExampleSchema], default: [] },
    confidence: { type: String, enum: ["low", "medium", "high"], default: "low" },
  },
  {
    timestamps: true,
    collection: "script_outcome_profiles",
  }
);

ScriptOutcomeProfileSchema.index({ userId: 1 }, { unique: true, name: "script_outcome_profiles_user_unique" });

const ScriptOutcomeProfileModel: Model<IScriptOutcomeProfile> =
  (mongoose.models.ScriptOutcomeProfile as Model<IScriptOutcomeProfile>) ||
  mongoose.model<IScriptOutcomeProfile>("ScriptOutcomeProfile", ScriptOutcomeProfileSchema);

export default ScriptOutcomeProfileModel;
