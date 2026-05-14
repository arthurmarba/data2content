export const SUPPORTED_NARRATIVE_SOURCE_TYPES = [
  "text_prompt",
  "comment",
  "script",
  "caption",
  "video_simulated",
  "video_upload_future",
  "brand_brief_future",
  "instagram_post_future",
] as const;

export type NarrativeSourceType = (typeof SUPPORTED_NARRATIVE_SOURCE_TYPES)[number];

export const SUPPORTED_NARRATIVE_SOURCE_INTENTS = [
  "validate_before_posting",
  "improve_content",
  "discover_narrative",
  "brand_potential",
  "adapt_to_ad",
  "collab_potential",
  "positioning_fit",
  "general_question",
  "unknown",
] as const;

export type NarrativeSourceIntent = (typeof SUPPORTED_NARRATIVE_SOURCE_INTENTS)[number];

export type NarrativeAssetType =
  | "central_theme"
  | "narrative_pattern"
  | "content_proposal"
  | "emotional_tone"
  | "audience_reaction"
  | "brand_territory"
  | "collab_opportunity"
  | "creator_role"
  | "visual_context"
  | "hook_signal"
  | "weakness"
  | "format_fit"
  | "category";

export type CreatorNarrativeSignalType =
  | "recurring_theme"
  | "preferred_format"
  | "creator_role"
  | "brand_territory"
  | "recurring_insecurity"
  | "audience_goal"
  | "content_strength"
  | "content_weakness"
  | "positioning_signal";

export type NarrativeSourceMetadata = {
  title?: string | null;
  durationSeconds?: number | null;
  platform?: "instagram" | "tiktok" | "youtube" | "unknown" | null;
  format?: "reel" | "photo" | "carousel" | "short_video" | "long_video" | "unknown" | null;
  campaignContext?: string | null;
};

export type NarrativeSource = {
  id: string;
  sourceType: NarrativeSourceType;
  rawText: string | null;
  creatorQuestion: string | null;
  transcript: string | null;
  visualDescription: string | null;
  metadata: NarrativeSourceMetadata;
  createdAt?: string | null;
};

export type NarrativeSourceIntentDetection = {
  intent: NarrativeSourceIntent;
  confidence: number;
  sourceType: NarrativeSourceType;
  originalQuestion: string;
  normalizedQuestion: string;
  signals: string[];
};

export type NarrativeAsset = {
  id: string;
  type: NarrativeAssetType;
  value: string;
  confidence: number;
  evidence?: string | null;
};

export type CreatorNarrativeSignal = {
  id: string;
  signalType: CreatorNarrativeSignalType;
  value: string;
  confidence: number;
  sourceType: NarrativeSourceType;
  shouldPersistLater: boolean;
  evidence?: string | null;
};

export type NarrativeSourceDiagnostic = {
  source: NarrativeSource;
  intentDetection: NarrativeSourceIntentDetection;
  assets: NarrativeAsset[];
  profileSignals: CreatorNarrativeSignal[];
  summary: string;
  suggestedNextStep: string;
};

export function isSupportedNarrativeSourceType(value: string): value is NarrativeSourceType {
  return SUPPORTED_NARRATIVE_SOURCE_TYPES.includes(value as NarrativeSourceType);
}

export function isSupportedNarrativeSourceIntent(value: string): value is NarrativeSourceIntent {
  return SUPPORTED_NARRATIVE_SOURCE_INTENTS.includes(value as NarrativeSourceIntent);
}

export function createEmptyNarrativeSource(params: {
  id: string;
  sourceType: NarrativeSourceType;
  createdAt?: string | null;
}): NarrativeSource {
  return {
    id: params.id,
    sourceType: params.sourceType,
    rawText: null,
    creatorQuestion: null,
    transcript: null,
    visualDescription: null,
    metadata: {},
    createdAt: params.createdAt ?? null,
  };
}
