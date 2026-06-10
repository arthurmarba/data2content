import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";
import type {
  CreatorVideoNarrativeEvidenceAnchors,
  VideoNarrativeContentContext,
  VideoNarrativeCoherence,
} from "./creatorVideoNarrativeDiagnosisTypes";

export type { VideoNarrativeContentContext, VideoNarrativeCoherence };

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
  /** Coherence verdict: does this video align with the creator's top-performing narrative pattern? */
  narrativeCoherence?: VideoNarrativeCoherence;
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
