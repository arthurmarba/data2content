import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";
import type {
  CreatorVideoNarrativeEvidenceAnchors,
  VideoNarrativeContentContext,
  VideoNarrativeCoherence,
  VideoNarrativeAxisCoherence,
} from "./creatorVideoNarrativeDiagnosisTypes";

export type { VideoNarrativeContentContext, VideoNarrativeCoherence, VideoNarrativeAxisCoherence };

/**
 * Aggregated Instagram metrics summary built from the creator's stored Metric
 * documents. Injected into the Gemini prompt to contextualise the diagnosis
 * with real performance data rather than relying on defaults.
 */
export type VideoNarrativeInstagramMetricsSummary = {
  postsAnalyzed?: number;
  avgReachPerPost?: number | null;
  avgEngagementRate?: number | null;
  avgReelsDurationSeconds?: number | null;
  avgReelsWatchTimeSeconds?: number | null;
  avgReelsViews?: number | null;
  avgSavesPerPost?: number | null;
  avgSharesPerPost?: number | null;
  avgCommentsPerPost?: number | null;
  avgIntentActionsPerPost?: number | null;
  topFormats?: string[];
  /** Label of the day with highest avg reach, e.g. "Qua" */
  bestDayLabel?: string | null;
  bestDayAvgReach?: number | null;
  /** % change (e.g. 0.24 = +24%) for reach and intent signals */
  reachDelta?: number | null;
  engagementDelta?: number | null;
  intentDelta?: number | null;
};

/**
 * Compact, real audience signal derived from the creator's demographic snapshot.
 * Injected into the prompt so the "audiência" axis of the "vale postar?" verdict is
 * anchored in who actually follows/engages — not only what the AI infers from the video.
 * Fragile source (depends on an Instagram demographic snapshot); null when unavailable,
 * which lets the model return audienceCoherence.verdict = "unknown".
 */
export type VideoNarrativeAudienceContextSummary = {
  /** Dominant audience gender, already localised (e.g. "mulheres"). */
  topGender?: string | null;
  /** Share (0–100) of the dominant gender. */
  topGenderPct?: number | null;
  /** Dominant age bracket, e.g. "25-34". */
  topAgeRange?: string | null;
  /** Share (0–100) of the dominant age bracket. */
  topAgeRangePct?: number | null;
  /** Most concentrated audience locations (cities, or countries as fallback). */
  topLocations?: string[];
};

export type VideoNarrativeAiProviderGoalOption =
  | "authority"
  | "authority_build"
  | "retention"
  | "format_test"
  | "sponsored_content";

export type VideoNarrativeAiProviderInput = {
  userId: string;
  creatorGoal: string;
  selectedGoalOption: VideoNarrativeAiProviderGoalOption;
  quickAnswers?: Array<{ id: string; value: string }>;
  temporaryUpload?: {
    uploadSessionId: string;
    objectKey?: string;
    mimeType: string;
    sizeBytes: number;
  };
  profileContext?: {
    displayName?: string;
    instagramConnected?: boolean;
    premiumAccess?: boolean;
    /** Narrative labels already confirmed for this creator (from synthesis). Used to help Gemini detect confirmations vs. deviations. */
    knownNarratives?: string[] | null;
    /** Life-asset combinations confirmed across multiple prior readings (setting + socialPresence + emotionalRegister combos that repeat). */
    confirmedLifeAssets?: Array<{ label: string; evidenceCount: number }> | null;
    /** The single top-performing asset pattern — used as the primary reference for the coherence verdict. */
    topPerformingPattern?: string | null;
    /** Creator's answers to adaptive quiz questions from recent confirmation steps. Used to contextualise intent and preference. */
    pastCreatorAnswers?: Array<{ questionText: string; answerValue: string }> | null;
    /** Real audience composition (demographics), used to anchor the audiência axis of the verdict. */
    audienceContext?: VideoNarrativeAudienceContextSummary | null;
  };
  /** Real Instagram metrics from the creator's stored analytics. Optional — omitted for mock/free flows. */
  instagramMetrics?: VideoNarrativeInstagramMetricsSummary | null;
  promptVersion: string;
  requestId: string;
};

export type VideoNarrativeAiIssue = {
  code: string;
  severity: "blocker" | "warning" | "info";
  message: string;
};

export type VideoNarrativeAiAnalysis = {
  /** Direct, observational answer to the creator's stated question/goal for this upload. */
  directAnswer?: string;
  mainNarrative: string;
  whatVideoCommunicates: string;
  creatorIntention: string;
  strategicReading: string;
  strengthPoint: string;
  attentionPoint: string;
  recommendedAdjustment: string;
  suggestedHook: string;
  commercialPotential: string;
  nextActions: string[];
  creatorSignals: string[];
  brandTerritories: string[];
  collabOpportunities: string[];
  evidenceAnchors?: CreatorVideoNarrativeEvidenceAnchors;
  /** Structured life-asset dimensions extracted by watching the video. */
  contentContext?: VideoNarrativeContentContext;
  /** Coherence verdict: does this video align with the creator's top-performing narrative pattern? (eixo narrativa) */
  narrativeCoherence?: VideoNarrativeCoherence;
  /** Does this video speak to who actually watches the creator / what the audience asks for? (eixo audiência) */
  audienceCoherence?: VideoNarrativeAxisCoherence;
  /** Does this video open or sustain a coherent commercial territory? (eixo marca) */
  brandCoherence?: VideoNarrativeAxisCoherence;
};

export type VideoNarrativeAiProviderResult = {
  ok: boolean;
  provider: "gemini";
  mode: "disabled" | "ready" | "fixture" | "failed";
  promptVersion: string;
  analysis?: VideoNarrativeAiAnalysis;
  issues?: VideoNarrativeAiIssue[];
  safeDebugSummary?: string;
  timingMs?: number;
};

export type VideoNarrativeGeminiSnapshotMappingResult = {
  source: "gemini_ready" | "gemini_fixture" | "gemini_real_allowlist";
  snapshot: MobileStrategicProfileSnapshotPayload;
};
