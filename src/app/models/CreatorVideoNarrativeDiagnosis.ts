import mongoose, { Schema, Types, Document, model } from "mongoose";
import type {
  CreatorVideoNarrativeDiagnosisCommercialReading,
  CreatorVideoNarrativeEvidenceAnchors,
  CreatorVideoNarrativeDiagnosisProfileContribution,
  CreatorVideoNarrativeDiagnosisProductionReading,
  CreatorVideoNarrativeDiagnosisSafetyFlags,
  CreatorVideoNarrativeDiagnosisSource,
  CreatorVideoNarrativeDiagnosisSpeechReading,
  CreatorVideoNarrativeDiagnosisStatus,
  CreatorVideoNarrativeDiagnosisStrategicRecommendation,
  CreatorVideoNarrativeDiagnosisVideoMetadata,
  CreatorVideoNarrativeDiagnosisVideoReading,
} from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisTypes";

export interface ICreatorVideoNarrativeDiagnosis extends Document {
  userId: Types.ObjectId;
  diagnosisId: string;
  status: CreatorVideoNarrativeDiagnosisStatus;
  source: CreatorVideoNarrativeDiagnosisSource;
  videoMetadata: CreatorVideoNarrativeDiagnosisVideoMetadata;
  creatorGoal: string;
  selectedGoalOption: string;
  videoReading: CreatorVideoNarrativeDiagnosisVideoReading;
  speechReading: CreatorVideoNarrativeDiagnosisSpeechReading;
  productionReading: CreatorVideoNarrativeDiagnosisProductionReading;
  commercialReading: CreatorVideoNarrativeDiagnosisCommercialReading;
  strategicRecommendation: CreatorVideoNarrativeDiagnosisStrategicRecommendation;
  profileContribution: CreatorVideoNarrativeDiagnosisProfileContribution;
  evidenceAnchors?: CreatorVideoNarrativeEvidenceAnchors;
  safetyFlags: CreatorVideoNarrativeDiagnosisSafetyFlags;
  schemaVersion: "creator_video_narrative_diagnosis_v1";
  createdAt: Date;
  updatedAt: Date;
}

const VideoMetadataSchema = new Schema<CreatorVideoNarrativeDiagnosisVideoMetadata>(
  {
    mimeType: { type: String },
    sizeBytes: { type: Number },
    durationSeconds: { type: Number },
    originalFileNameSanitized: { type: String },
    uploadedAt: { type: Date },
    analyzedAt: { type: Date },
  },
  { _id: false, strict: true },
);

const VideoReadingSchema = new Schema<CreatorVideoNarrativeDiagnosisVideoReading>(
  {
    title: { type: String, required: true },
    rememberedAs: { type: String, required: true },
    summary: { type: String, required: true },
    whatVideoReveals: { type: String, required: true },
    mainNarrative: { type: String, required: true },
    creatorIntent: { type: String, required: true },
    dominantInsight: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const SpeechReadingSchema = new Schema<CreatorVideoNarrativeDiagnosisSpeechReading>(
  {
    summary: { type: String, required: true },
    openingRead: { type: String, required: true },
    clarityRead: { type: String, required: true },
    pacingRead: { type: String, required: true },
    suggestedLine: { type: String, required: true },
    suggestedOpening: { type: String, required: true },
    suggestedClosing: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const ProductionReadingSchema = new Schema<CreatorVideoNarrativeDiagnosisProductionReading>(
  {
    summary: { type: String, required: true },
    framing: { type: String, required: true },
    lighting: { type: String, required: true },
    audio: { type: String, required: true },
    editingRhythm: { type: String, required: true },
    firstFrame: { type: String, required: true },
    visualClarity: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const CommercialReadingSchema = new Schema<CreatorVideoNarrativeDiagnosisCommercialReading>(
  {
    summary: { type: String, required: true },
    brandTerritories: { type: [String], required: true, default: [] },
    whyItCouldFitBrands: { type: String, required: true },
    adAdaptationIdea: { type: String, required: true },
    limitations: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const StrategicRecommendationSchema = new Schema<CreatorVideoNarrativeDiagnosisStrategicRecommendation>(
  {
    mainAdjustment: { type: String, required: true },
    nextExperiment: { type: String, required: true },
    whatToRepeat: { type: String, required: true },
    whatToAvoid: { type: String, required: true },
    successSignal: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const ProfileContributionSchema = new Schema<CreatorVideoNarrativeDiagnosisProfileContribution>(
  {
    type: {
      type: String,
      enum: [
        "confirms_existing_pattern",
        "opens_new_hypothesis",
        "isolated_strong_video",
        "creative_deviation",
        "commercial_signal",
        "weak_positioning_signal",
        "needs_more_samples",
      ],
      required: true,
    },
    confidence: { type: String, enum: ["low", "medium", "high"], required: true },
    weight: { type: String, enum: ["low", "medium", "high"], required: true },
    reason: { type: String, required: true },
    profileImpactPreview: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const EvidenceAnchorsSchema = new Schema<CreatorVideoNarrativeEvidenceAnchors>(
  {
    speechQuotes: {
      type: [
        new Schema(
          {
            quote: { type: String, required: true },
            source: { type: String, enum: ["creator_spoken", "ai_suggested"], required: true },
            quoteRole: {
              type: String,
              enum: ["hook", "promise", "turning_point", "closing", "example", "context", "other"],
              required: true,
            },
            whyItMatters: { type: String, required: true },
            chapterHint: {
              type: String,
              enum: ["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"],
              required: true,
            },
          },
          { _id: false, strict: true },
        ),
      ],
      default: [],
    },
    sceneAnchors: {
      type: [
        new Schema(
          {
            description: { type: String, required: true },
            source: { type: String, enum: ["derived_scene"], required: true },
            momentRole: {
              type: String,
              enum: ["opening", "conflict", "turning_point", "visual_signal", "pacing_signal", "production_signal", "other"],
              required: true,
            },
            whyItMatters: { type: String, required: true },
            chapterHint: {
              type: String,
              enum: ["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"],
              required: true,
            },
          },
          { _id: false, strict: true },
        ),
      ],
      default: [],
    },
    creatorIntentAnchor: {
      type: new Schema(
        {
          source: { type: String, enum: ["creator_goal"], required: true },
          statedGoal: { type: String, required: true },
          interpretedGoal: { type: String, required: true },
          whyItMatters: { type: String, required: true },
        },
        { _id: false, strict: true },
      ),
      default: null,
    },
    profilePatternAnchors: {
      type: [
        new Schema(
          {
            patternLabel: { type: String, required: true },
            whyThisVideoRelates: { type: String, required: true },
            evidenceCount: { type: Number },
          },
          { _id: false, strict: true },
        ),
      ],
      default: [],
    },
    instagramAnchors: {
      type: [
        new Schema(
          {
            signalLabel: { type: String, required: true },
            whyItMatters: { type: String, required: true },
            evidenceSummary: { type: String, required: true },
          },
          { _id: false, strict: true },
        ),
      ],
      default: [],
    },
  },
  { _id: false, strict: true },
);

const SafetyFlagsSchema = new Schema<CreatorVideoNarrativeDiagnosisSafetyFlags>(
  {
    containsPersistedVideoReference: { type: Boolean, required: true, default: false },
    containsSignedUrl: { type: Boolean, required: true, default: false },
    containsObjectKey: { type: Boolean, required: true, default: false },
    containsRawModelResponse: { type: Boolean, required: true, default: false },
    containsLongTranscript: { type: Boolean, required: true, default: false },
    sanitized: { type: Boolean, required: true, default: false },
  },
  { _id: false, strict: true },
);

const CreatorVideoNarrativeDiagnosisSchema = new Schema<ICreatorVideoNarrativeDiagnosis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    diagnosisId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "completed", "failed", "discarded"],
      required: true,
      default: "draft",
      index: true,
    },
    source: {
      type: String,
      enum: ["mock", "real", "manual", "migration"],
      required: true,
    },
    videoMetadata: { type: VideoMetadataSchema, required: true, default: () => ({}) },
    creatorGoal: { type: String, required: true },
    selectedGoalOption: { type: String, required: true },
    videoReading: { type: VideoReadingSchema, required: true },
    speechReading: { type: SpeechReadingSchema, required: true },
    productionReading: { type: ProductionReadingSchema, required: true },
    commercialReading: { type: CommercialReadingSchema, required: true },
    strategicRecommendation: { type: StrategicRecommendationSchema, required: true },
    profileContribution: { type: ProfileContributionSchema, required: true },
    evidenceAnchors: { type: EvidenceAnchorsSchema, required: false },
    safetyFlags: { type: SafetyFlagsSchema, required: true },
    schemaVersion: {
      type: String,
      enum: ["creator_video_narrative_diagnosis_v1"],
      required: true,
      default: "creator_video_narrative_diagnosis_v1",
    },
  },
  {
    timestamps: true,
    collection: "creatorvideonarrativediagnoses",
    strict: true,
  },
);

CreatorVideoNarrativeDiagnosisSchema.index(
  { userId: 1, diagnosisId: 1 },
  { unique: true, name: "creator_video_narrative_diagnosis_user_diagnosis_unique" },
);
CreatorVideoNarrativeDiagnosisSchema.index({ userId: 1, createdAt: -1 });

const CreatorVideoNarrativeDiagnosis =
  (mongoose.models.CreatorVideoNarrativeDiagnosis as mongoose.Model<ICreatorVideoNarrativeDiagnosis>) ||
  model<ICreatorVideoNarrativeDiagnosis>(
    "CreatorVideoNarrativeDiagnosis",
    CreatorVideoNarrativeDiagnosisSchema,
  );

export default CreatorVideoNarrativeDiagnosis;
