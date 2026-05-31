// ─── Video content context extracted by the AI from watching the video ──────────
// Structured dimensions that describe the life assets visible in each upload.
// Accumulates across readings to identify the creator's confirmed narrative assets.

export type VideoNarrativeContentContext = {
  /** Primary filming location: "praia", "casa", "academia", "rua", "estúdio", etc. */
  setting: string | null;
  /** Who appears with the creator: "solo", "família", "amigos", "casal", "equipe", etc. */
  socialPresence: string | null;
  /** Emotional tone: "humor", "inspiracional", "educativo", "reflexivo", "emotivo", etc. */
  emotionalRegister: string | null;
  /** Humor style if applicable: "cultural", "auto-ironia", "situacional", "absurdo", or null */
  humorStyle: string | null;
  /** Energy level: "alta", "moderada", "calma" */
  energyLevel: string | null;
  /** Observable life signals: ["carioca", "rotina de fim de semana", "vida com filhos"] */
  lifeSignals: string[];
  /** Camera/production style: "selfie", "estabilizado-casual", "profissional", "vertical-raw" */
  productionStyle: string | null;
};

export type VideoNarrativeCoherenceVerdict =
  | "confirms_top_pattern"  // video matches creator's best-performing narrative asset
  | "experiment"            // new direction, doesn't break identity
  | "deviation"             // clearly different from established pattern
  | "first_reading"         // no established pattern yet
  | "unknown";

/** Whether the uploaded video is coherent with the creator's top-performing pattern. */
export type VideoNarrativeCoherence = {
  verdict: VideoNarrativeCoherenceVerdict;
  /** The top pattern it's compared against: "praia + família + humor" */
  topPattern: string | null;
  /** Brief explanation of the verdict */
  reasoning: string | null;
  /** Life assets from prior readings that this video confirms */
  alignedAssets: string[];
  /** Potential new assets detected in this video (not yet confirmed by repetition) */
  newAssets: string[];
};

// ─────────────────────────────────────────────────────────────────────────────

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
  /** Public URL of the video thumbnail stored in Cloudflare R2. */
  thumbnailUrl?: string | null;
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
  /** Structured life-asset dimensions extracted by the AI from watching the video. */
  contentContext?: VideoNarrativeContentContext;
  /** Whether this video is coherent with the creator's confirmed top-performing pattern. */
  narrativeCoherence?: VideoNarrativeCoherence;
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
