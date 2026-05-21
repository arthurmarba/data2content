export type CreatorVideoNarrativeDiagnosisStatus = "draft" | "completed" | "failed" | "discarded";

export type CreatorVideoNarrativeDiagnosisSource = "mock" | "real" | "manual" | "migration";

export type CreatorVideoNarrativeDiagnosisConfidence = "low" | "medium" | "high";

export type CreatorVideoNarrativeDiagnosisContributionType =
  | "confirms_existing_pattern"
  | "opens_new_hypothesis"
  | "isolated_strong_video"
  | "creative_deviation"
  | "commercial_signal"
  | "weak_positioning_signal"
  | "needs_more_samples";

export type CreatorVideoNarrativeDiagnosisWeight = "low" | "medium" | "high";

export type CreatorVideoNarrativeEvidenceChapterHint =
  | "pattern"
  | "tension"
  | "movement"
  | "territory"
  | "video_reveal"
  | "profile_impact"
  | "opportunities";

export type CreatorVideoNarrativeSpeechQuoteSource = "creator_spoken" | "ai_suggested";

export interface CreatorVideoNarrativeDiagnosisSpeechQuoteAnchor {
  quote: string;
  source: CreatorVideoNarrativeSpeechQuoteSource;
  quoteRole:
    | "hook"
    | "promise"
    | "turning_point"
    | "closing"
    | "example"
    | "context"
    | "other";
  whyItMatters: string;
  chapterHint: CreatorVideoNarrativeEvidenceChapterHint;
}

export interface CreatorVideoNarrativeDiagnosisSceneAnchor {
  description: string;
  source: "model_observed" | "derived_scene";
  momentRole:
    | "opening"
    | "conflict"
    | "turning_point"
    | "visual_signal"
    | "pacing_signal"
    | "production_signal"
    | "other";
  whyItMatters: string;
  chapterHint: CreatorVideoNarrativeEvidenceChapterHint;
}

export interface CreatorVideoNarrativeEvidenceAnchors {
  speechQuotes: CreatorVideoNarrativeDiagnosisSpeechQuoteAnchor[];
  sceneAnchors: CreatorVideoNarrativeDiagnosisSceneAnchor[];
  creatorIntentAnchor?: {
    source: "creator_goal";
    statedGoal: string;
    interpretedGoal: string;
    whyItMatters: string;
  } | null;
  profilePatternAnchors?: Array<{
    patternLabel: string;
    whyThisVideoRelates: string;
    evidenceCount?: number;
  }>;
  instagramAnchors?: Array<{
    signalLabel: string;
    whyItMatters: string;
    evidenceSummary: string;
  }>;
}

export interface CreatorVideoNarrativeDiagnosisVideoMetadata {
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  originalFileNameSanitized?: string;
  uploadedAt?: Date;
  analyzedAt?: Date;
}

export interface CreatorVideoNarrativeDiagnosisVideoReading {
  title: string;
  rememberedAs: string;
  summary: string;
  whatVideoReveals: string;
  mainNarrative: string;
  creatorIntent: string;
  dominantInsight: string;
}

export interface CreatorVideoNarrativeDiagnosisSpeechReading {
  summary: string;
  openingRead: string;
  clarityRead: string;
  pacingRead: string;
  suggestedLine: string;
  suggestedOpening: string;
  suggestedClosing: string;
}

export interface CreatorVideoNarrativeDiagnosisProductionReading {
  summary: string;
  framing: string;
  lighting: string;
  audio: string;
  editingRhythm: string;
  firstFrame: string;
  visualClarity: string;
}

export interface CreatorVideoNarrativeDiagnosisCommercialReading {
  summary: string;
  brandTerritories: string[];
  whyItCouldFitBrands: string;
  adAdaptationIdea: string;
  limitations: string;
}

export interface CreatorVideoNarrativeDiagnosisStrategicRecommendation {
  mainAdjustment: string;
  nextExperiment: string;
  whatToRepeat: string;
  whatToAvoid: string;
  successSignal: string;
}

export interface CreatorVideoNarrativeDiagnosisProfileContribution {
  type: CreatorVideoNarrativeDiagnosisContributionType;
  confidence: CreatorVideoNarrativeDiagnosisConfidence;
  weight: CreatorVideoNarrativeDiagnosisWeight;
  reason: string;
  profileImpactPreview: string;
}

export interface CreatorVideoNarrativeDiagnosisSafetyFlags {
  containsPersistedVideoReference: boolean;
  containsSignedUrl: boolean;
  containsObjectKey: boolean;
  containsRawModelResponse: boolean;
  containsLongTranscript: boolean;
  sanitized: boolean;
}

export interface CreatorVideoNarrativeDiagnosisInput {
  userId: string;
  diagnosisId: string;
  status: CreatorVideoNarrativeDiagnosisStatus;
  source: CreatorVideoNarrativeDiagnosisSource;
  videoMetadata?: CreatorVideoNarrativeDiagnosisVideoMetadata | (CreatorVideoNarrativeDiagnosisVideoMetadata & Record<string, unknown>);
  creatorGoal: string;
  selectedGoalOption: string;
  videoReading: CreatorVideoNarrativeDiagnosisVideoReading;
  speechReading: CreatorVideoNarrativeDiagnosisSpeechReading;
  productionReading: CreatorVideoNarrativeDiagnosisProductionReading;
  commercialReading: CreatorVideoNarrativeDiagnosisCommercialReading;
  strategicRecommendation: CreatorVideoNarrativeDiagnosisStrategicRecommendation;
  profileContribution: CreatorVideoNarrativeDiagnosisProfileContribution;
  evidenceAnchors?: CreatorVideoNarrativeEvidenceAnchors;
  schemaVersion?: "creator_video_narrative_diagnosis_v1";
}

export interface CreatorVideoNarrativeDiagnosisDocument
  extends Omit<CreatorVideoNarrativeDiagnosisInput, "schemaVersion" | "videoMetadata"> {
  schemaVersion: "creator_video_narrative_diagnosis_v1";
  videoMetadata: CreatorVideoNarrativeDiagnosisVideoMetadata;
  safetyFlags: CreatorVideoNarrativeDiagnosisSafetyFlags;
  createdAt?: Date;
  updatedAt?: Date;
}
