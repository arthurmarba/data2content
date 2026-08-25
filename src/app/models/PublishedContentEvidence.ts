import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const PUBLISHED_CONTENT_EVIDENCE_VERSION = "published_content_evidence_v1";

export type PublishedTranscriptSegment = {
  startMs: number | null;
  endMs: number | null;
  text: string;
};

export type PublishedSceneEvidence = {
  startMs: number | null;
  endMs: number | null;
  role: string;
  description: string;
  spokenText: string | null;
  onScreenText: string | null;
  setting: string | null;
  objects: string[];
  framing: string[];
};

export interface IPublishedContentEvidence extends Document {
  userId: Types.ObjectId;
  metricId: Types.ObjectId;
  instagramMediaId?: string | null;
  publishedAt?: Date | null;
  evidenceVersion: string;
  transcript: {
    fullText: string | null;
    segments: PublishedTranscriptSegment[];
    wordCount: number;
    language: string | null;
    source: "gemini_video" | "stored_script" | "caption_fallback" | "none";
  };
  scenes: PublishedSceneEvidence[];
  narrative: {
    hook: string | null;
    promise: string | null;
    structure: string[];
    cta: string | null;
    subjects: string[];
    toneSignals: string[];
  };
  visual: {
    setting: string | null;
    objects: string[];
    framing: string[];
    aesthetics: string[];
    screenTitle: string | null;
  };
  performance: {
    durationSeconds: number | null;
    views: number | null;
    reach: number | null;
    interactions: number | null;
    saves: number | null;
    shares: number | null;
    comments: number | null;
    follows: number | null;
    averageWatchTimeSeconds: number | null;
    retentionRate: number | null;
    capturedAt: Date;
  };
  scriptLink: {
    scriptId: Types.ObjectId | null;
    confidence: "confirmed" | "high" | "possible" | "unlinked";
    similarity: number | null;
    source: "user" | "automatic" | "none";
  };
  completeness: {
    transcript: boolean;
    scenes: boolean;
    performance: boolean;
    duration: boolean;
    scriptLink: boolean;
  };
  provider: string;
  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TranscriptSegmentSchema = new Schema<PublishedTranscriptSegment>({
  startMs: { type: Number, default: null, min: 0 },
  endMs: { type: Number, default: null, min: 0 },
  text: { type: String, required: true, trim: true, maxlength: 1600 },
}, { _id: false, strict: true });

const SceneEvidenceSchema = new Schema<PublishedSceneEvidence>({
  startMs: { type: Number, default: null, min: 0 },
  endMs: { type: Number, default: null, min: 0 },
  role: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, required: true, trim: true, maxlength: 800 },
  spokenText: { type: String, default: null, trim: true, maxlength: 2000 },
  onScreenText: { type: String, default: null, trim: true, maxlength: 500 },
  setting: { type: String, default: null, trim: true, maxlength: 120 },
  objects: { type: [String], default: [] },
  framing: { type: [String], default: [] },
}, { _id: false, strict: true });

const PublishedContentEvidenceSchema = new Schema<IPublishedContentEvidence>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  metricId: { type: Schema.Types.ObjectId, ref: "Metric", required: true, unique: true, index: true },
  instagramMediaId: { type: String, default: null, trim: true, maxlength: 160, index: true },
  publishedAt: { type: Date, default: null, index: true },
  evidenceVersion: { type: String, required: true, default: PUBLISHED_CONTENT_EVIDENCE_VERSION },
  transcript: {
    type: new Schema({
      fullText: { type: String, default: null, maxlength: 30000 },
      segments: { type: [TranscriptSegmentSchema], default: [] },
      wordCount: { type: Number, default: 0, min: 0 },
      language: { type: String, default: null, maxlength: 20 },
      source: {
        type: String,
        enum: ["gemini_video", "stored_script", "caption_fallback", "none"],
        default: "none",
      },
    }, { _id: false, strict: true }),
    required: true,
    default: () => ({}),
  },
  scenes: { type: [SceneEvidenceSchema], default: [] },
  narrative: {
    type: new Schema({
      hook: { type: String, default: null, maxlength: 500 },
      promise: { type: String, default: null, maxlength: 500 },
      structure: { type: [String], default: [] },
      cta: { type: String, default: null, maxlength: 500 },
      subjects: { type: [String], default: [] },
      toneSignals: { type: [String], default: [] },
    }, { _id: false, strict: true }),
    required: true,
    default: () => ({}),
  },
  visual: {
    type: new Schema({
      setting: { type: String, default: null, maxlength: 120 },
      objects: { type: [String], default: [] },
      framing: { type: [String], default: [] },
      aesthetics: { type: [String], default: [] },
      screenTitle: { type: String, default: null, maxlength: 500 },
    }, { _id: false, strict: true }),
    required: true,
    default: () => ({}),
  },
  performance: {
    type: new Schema({
      durationSeconds: { type: Number, default: null, min: 0 },
      views: { type: Number, default: null, min: 0 },
      reach: { type: Number, default: null, min: 0 },
      interactions: { type: Number, default: null, min: 0 },
      saves: { type: Number, default: null, min: 0 },
      shares: { type: Number, default: null, min: 0 },
      comments: { type: Number, default: null, min: 0 },
      follows: { type: Number, default: null, min: 0 },
      averageWatchTimeSeconds: { type: Number, default: null, min: 0 },
      retentionRate: { type: Number, default: null, min: 0 },
      capturedAt: { type: Date, required: true, default: Date.now },
    }, { _id: false, strict: true }),
    required: true,
    default: () => ({}),
  },
  scriptLink: {
    type: new Schema({
      scriptId: { type: Schema.Types.ObjectId, ref: "ScriptEntry", default: null },
      confidence: { type: String, enum: ["confirmed", "high", "possible", "unlinked"], default: "unlinked" },
      similarity: { type: Number, default: null, min: 0, max: 1 },
      source: { type: String, enum: ["user", "automatic", "none"], default: "none" },
    }, { _id: false, strict: true }),
    required: true,
    default: () => ({}),
  },
  completeness: {
    type: new Schema({
      transcript: { type: Boolean, default: false },
      scenes: { type: Boolean, default: false },
      performance: { type: Boolean, default: false },
      duration: { type: Boolean, default: false },
      scriptLink: { type: Boolean, default: false },
    }, { _id: false, strict: true }),
    required: true,
    default: () => ({}),
  },
  provider: { type: String, required: true, default: "derived", maxlength: 80 },
  analyzedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true, collection: "published_content_evidence" });

PublishedContentEvidenceSchema.index({ userId: 1, publishedAt: -1 });
PublishedContentEvidenceSchema.index({ userId: 1, "scriptLink.scriptId": 1 });

const PublishedContentEvidenceModel: Model<IPublishedContentEvidence> =
  (mongoose.models.PublishedContentEvidence as Model<IPublishedContentEvidence>) ||
  mongoose.model<IPublishedContentEvidence>("PublishedContentEvidence", PublishedContentEvidenceSchema);

export default PublishedContentEvidenceModel;
