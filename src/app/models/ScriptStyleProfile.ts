import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const SCRIPT_STYLE_PROFILE_VERSION = "scripts_style_profile_v1";

export interface ScriptStyleSourceMix {
  manual: number;
  ai: number;
  planner: number;
}

export interface ScriptStyleNarrativeCadence {
  openingAvgChars: number;
  developmentAvgChars: number;
  closingAvgChars: number;
}

export interface ScriptStyleSignals {
  avgParagraphs: number;
  avgSentenceLength: number;
  emojiDensity: number;
  questionRate: number;
  exclamationRate: number;
  hookPatterns: string[];
  ctaPatterns: string[];
  humorMarkers: string[];
  recurringExpressions: string[];
  narrativeCadence: ScriptStyleNarrativeCadence;
}

export interface ScriptStyleExclusionStats {
  adminRecommendationSkipped: number;
  tooShortSkipped: number;
  emptySkipped: number;
  duplicateSkipped: number;
}

export interface IScriptStyleProfile extends Document {
  userId: Types.ObjectId;
  profileVersion: string;
  sampleSize: number;
  lastScriptAt?: Date | null;
  sourceMix: ScriptStyleSourceMix;
  styleSignals: ScriptStyleSignals;
  styleExamples: string[];
  exclusionStats: ScriptStyleExclusionStats;
  createdAt: Date;
  updatedAt: Date;
}

const SourceMixSchema = new Schema<ScriptStyleSourceMix>(
  {
    manual: { type: Number, default: 0, min: 0 },
    ai: { type: Number, default: 0, min: 0 },
    planner: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const NarrativeCadenceSchema = new Schema<ScriptStyleNarrativeCadence>(
  {
    openingAvgChars: { type: Number, default: 0, min: 0 },
    developmentAvgChars: { type: Number, default: 0, min: 0 },
    closingAvgChars: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const StyleSignalsSchema = new Schema<ScriptStyleSignals>(
  {
    avgParagraphs: { type: Number, default: 0, min: 0 },
    avgSentenceLength: { type: Number, default: 0, min: 0 },
    emojiDensity: { type: Number, default: 0, min: 0 },
    questionRate: { type: Number, default: 0, min: 0 },
    exclamationRate: { type: Number, default: 0, min: 0 },
    hookPatterns: { type: [String], default: [] },
    ctaPatterns: { type: [String], default: [] },
    humorMarkers: { type: [String], default: [] },
    recurringExpressions: { type: [String], default: [] },
    narrativeCadence: { type: NarrativeCadenceSchema, default: () => ({}) },
  },
  { _id: false }
);

const ExclusionStatsSchema = new Schema<ScriptStyleExclusionStats>(
  {
    adminRecommendationSkipped: { type: Number, default: 0, min: 0 },
    tooShortSkipped: { type: Number, default: 0, min: 0 },
    emptySkipped: { type: Number, default: 0, min: 0 },
    duplicateSkipped: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ScriptStyleProfileSchema = new Schema<IScriptStyleProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    profileVersion: { type: String, required: true, default: SCRIPT_STYLE_PROFILE_VERSION },
    sampleSize: { type: Number, required: true, default: 0, min: 0 },
    lastScriptAt: { type: Date, default: null },
    sourceMix: { type: SourceMixSchema, required: true, default: () => ({}) },
    styleSignals: { type: StyleSignalsSchema, required: true, default: () => ({}) },
    styleExamples: { type: [String], default: [] },
    exclusionStats: { type: ExclusionStatsSchema, required: true, default: () => ({}) },
  },
  {
    timestamps: true,
    collection: "script_style_profiles",
  }
);

ScriptStyleProfileSchema.index({ userId: 1 }, { unique: true, name: "script_style_profiles_user_unique" });

const ScriptStyleProfileModel: Model<IScriptStyleProfile> =
  (mongoose.models.ScriptStyleProfile as Model<IScriptStyleProfile>) ||
  mongoose.model<IScriptStyleProfile>("ScriptStyleProfile", ScriptStyleProfileSchema);

export default ScriptStyleProfileModel;
