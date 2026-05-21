import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";
import type { CreatorVideoNarrativeEvidenceAnchors } from "./creatorVideoNarrativeDiagnosisTypes";

export type VideoNarrativeAiProviderGoalOption =
  | "authority"
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
  };
  promptVersion: string;
  requestId: string;
};

export type VideoNarrativeAiIssue = {
  code: string;
  severity: "blocker" | "warning" | "info";
  message: string;
};

export type VideoNarrativeAiAnalysis = {
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
