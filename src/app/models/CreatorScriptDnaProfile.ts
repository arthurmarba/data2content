import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const CREATOR_SCRIPT_DNA_VERSION = "creator_script_dna_v3";

export interface ICreatorScriptDnaProfile extends Document {
  userId: Types.ObjectId;
  profileVersion: string;
  lookbackDays: number;
  confidence: "low" | "medium" | "high";
  sampleSize: number;
  voice: {
    avgWords: number;
    avgWordsPerSentence: number;
    wordsPerSecond: number | null;
    recurringExpressions: string[];
    hookPatterns: string[];
    ctaPatterns: string[];
    toneSignals: string[];
  };
  narrative: {
    winningStructures: string[][];
    medianDurationSeconds: number | null;
    winningDurationRange: { min: number | null; max: number | null };
    hookDeliverySeconds: number | null;
  };
  visual: {
    settings: string[];
    objects: string[];
    framing: string[];
    aesthetics: string[];
  };
  subjects: Array<{ label: string; count: number; performanceIndex: number }>;
  audience: {
    source: "engaged" | "followers" | "none";
    age: string[];
    gender: string[];
    cities: string[];
    countries: string[];
    recordedAt: Date | null;
  };
  winners: Array<{
    metricId: Types.ObjectId;
    scriptId: Types.ObjectId | null;
    performanceIndex: number;
    durationSeconds: number | null;
    hook: string | null;
    subjects: string[];
  }>;
  coverage: {
    publishedContent: number;
    evidenceRecords: number;
    transcripts: number;
    scenes: number;
    performance: number;
    linkedScripts: number;
    demographics: boolean;
  };
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CreatorScriptDnaProfileSchema = new Schema<ICreatorScriptDnaProfile>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  profileVersion: { type: String, required: true, default: CREATOR_SCRIPT_DNA_VERSION },
  lookbackDays: { type: Number, required: true, default: 365, min: 7, max: 365 },
  confidence: { type: String, enum: ["low", "medium", "high"], required: true, default: "low" },
  sampleSize: { type: Number, required: true, default: 0, min: 0 },
  voice: { type: new Schema({
    avgWords: { type: Number, default: 0, min: 0 },
    avgWordsPerSentence: { type: Number, default: 0, min: 0 },
    wordsPerSecond: { type: Number, default: null, min: 0 },
    recurringExpressions: { type: [String], default: [] },
    hookPatterns: { type: [String], default: [] },
    ctaPatterns: { type: [String], default: [] },
    toneSignals: { type: [String], default: [] },
  }, { _id: false, strict: true }), required: true, default: () => ({}) },
  narrative: { type: new Schema({
    winningStructures: { type: [[String]], default: [] },
    medianDurationSeconds: { type: Number, default: null, min: 0 },
    winningDurationRange: { type: new Schema({
      min: { type: Number, default: null, min: 0 },
      max: { type: Number, default: null, min: 0 },
    }, { _id: false, strict: true }), default: () => ({}) },
    hookDeliverySeconds: { type: Number, default: null, min: 0 },
  }, { _id: false, strict: true }), required: true, default: () => ({}) },
  visual: { type: new Schema({
    settings: { type: [String], default: [] },
    objects: { type: [String], default: [] },
    framing: { type: [String], default: [] },
    aesthetics: { type: [String], default: [] },
  }, { _id: false, strict: true }), required: true, default: () => ({}) },
  subjects: { type: [new Schema({
    label: { type: String, required: true, maxlength: 180 },
    count: { type: Number, required: true, min: 0 },
    performanceIndex: { type: Number, required: true, min: 0 },
  }, { _id: false, strict: true })], default: [] },
  audience: { type: new Schema({
    source: { type: String, enum: ["engaged", "followers", "none"], default: "none" },
    age: { type: [String], default: [] },
    gender: { type: [String], default: [] },
    cities: { type: [String], default: [] },
    countries: { type: [String], default: [] },
    recordedAt: { type: Date, default: null },
  }, { _id: false, strict: true }), required: true, default: () => ({}) },
  winners: { type: [new Schema({
    metricId: { type: Schema.Types.ObjectId, ref: "Metric", required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: "ScriptEntry", default: null },
    performanceIndex: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, default: null, min: 0 },
    hook: { type: String, default: null, maxlength: 500 },
    subjects: { type: [String], default: [] },
  }, { _id: false, strict: true })], default: [] },
  coverage: { type: new Schema({
    publishedContent: { type: Number, default: 0, min: 0 },
    evidenceRecords: { type: Number, default: 0, min: 0 },
    transcripts: { type: Number, default: 0, min: 0 },
    scenes: { type: Number, default: 0, min: 0 },
    performance: { type: Number, default: 0, min: 0 },
    linkedScripts: { type: Number, default: 0, min: 0 },
    demographics: { type: Boolean, default: false },
  }, { _id: false, strict: true }), required: true, default: () => ({}) },
  generatedAt: { type: Date, required: true, default: Date.now, index: true },
}, { timestamps: true, collection: "creator_script_dna_profiles" });

const CreatorScriptDnaProfile: Model<ICreatorScriptDnaProfile> =
  (mongoose.models.CreatorScriptDnaProfile as Model<ICreatorScriptDnaProfile>) ||
  mongoose.model<ICreatorScriptDnaProfile>("CreatorScriptDnaProfile", CreatorScriptDnaProfileSchema);

export default CreatorScriptDnaProfile;
