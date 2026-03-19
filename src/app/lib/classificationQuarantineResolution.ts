import { findCategoryMatchesAcrossTypes, type CategoryType } from "@/app/lib/classification";
import { type MetricCategoryField } from "@/app/lib/classificationLegacy";

export type QuarantineResolutionAction = "append_to_target" | "drop_from_quarantine";

export type ReviewedQuarantineResolution = {
  sourceField: MetricCategoryField;
  raw: string;
  action: QuarantineResolutionAction;
  targetField?: MetricCategoryField;
  targetId?: string;
};

export const TYPE_TO_FIELD: Record<CategoryType, MetricCategoryField> = {
  format: "format",
  proposal: "proposal",
  context: "context",
  tone: "tone",
  reference: "references",
};

export function buildQuarantineResolutionKey(sourceField: MetricCategoryField, raw: string): string {
  return `${sourceField}::${raw.trim().toLowerCase()}`;
}

const REVIEWED_DROP_RULES: Array<Pick<ReviewedQuarantineResolution, "sourceField" | "raw">> = [
  { sourceField: "context", raw: "[]" },
  { sourceField: "references", raw: "[]" },
  { sourceField: "format", raw: "general" },
  { sourceField: "format", raw: "neutral" },
  { sourceField: "proposal", raw: "explorepage" },
  { sourceField: "proposal", raw: "fitnessmotivation" },
  { sourceField: "proposal", raw: "general" },
  { sourceField: "references", raw: "general" },
];

const REVIEWED_APPEND_RULES: Array<Required<Pick<ReviewedQuarantineResolution, "sourceField" | "raw" | "targetField" | "targetId">>> = [
  { sourceField: "format", raw: "announcement", targetField: "proposal", targetId: "announcement" },
  { sourceField: "format", raw: "call_to_action", targetField: "proposal", targetId: "call_to_action" },
  { sourceField: "format", raw: "clip", targetField: "proposal", targetId: "clip" },
  { sourceField: "format", raw: "giveaway", targetField: "proposal", targetId: "giveaway" },
  { sourceField: "format", raw: "lifestyle", targetField: "proposal", targetId: "lifestyle" },
  { sourceField: "format", raw: "publi_divulgation", targetField: "proposal", targetId: "publi_divulgation" },
  { sourceField: "format", raw: "tips", targetField: "proposal", targetId: "tips" },
  { sourceField: "format", raw: "trend", targetField: "proposal", targetId: "trend" },
  { sourceField: "format", raw: "unboxing", targetField: "proposal", targetId: "unboxing" },

  { sourceField: "proposal", raw: "educational", targetField: "tone", targetId: "educational" },
  { sourceField: "proposal", raw: "events_celebrations", targetField: "context", targetId: "events_celebrations" },
  { sourceField: "proposal", raw: "event_celebration", targetField: "context", targetId: "events_celebrations" },
  { sourceField: "proposal", raw: "eventos_celebrations", targetField: "context", targetId: "events_celebrations" },
  { sourceField: "proposal", raw: "fashion_style", targetField: "context", targetId: "fashion_style" },
  { sourceField: "proposal", raw: "fitness_sports", targetField: "context", targetId: "fitness_sports" },
  { sourceField: "proposal", raw: "parenting", targetField: "context", targetId: "parenting" },
  { sourceField: "proposal", raw: "personal_and_professional", targetField: "context", targetId: "personal_and_professional" },
  { sourceField: "proposal", raw: "personal_development", targetField: "context", targetId: "personal_development" },
  { sourceField: "proposal", raw: "pets", targetField: "context", targetId: "pets" },
  { sourceField: "proposal", raw: "promotion", targetField: "tone", targetId: "promotional" },
  { sourceField: "proposal", raw: "promotional", targetField: "tone", targetId: "promotional" },
  { sourceField: "proposal", raw: "social_causes_religion", targetField: "context", targetId: "social_causes_religion" },

  { sourceField: "context", raw: "city", targetField: "references", targetId: "city" },
  { sourceField: "context", raw: "country", targetField: "references", targetId: "country" },
  { sourceField: "context", raw: "geography.city", targetField: "references", targetId: "city" },
  { sourceField: "context", raw: "hobbies_and_interests>pop_culture", targetField: "references", targetId: "pop_culture" },
  { sourceField: "context", raw: "lifestyle", targetField: "proposal", targetId: "lifestyle" },
  { sourceField: "context", raw: "pop_culture", targetField: "references", targetId: "pop_culture" },
  { sourceField: "context", raw: "pop_culture_internet", targetField: "references", targetId: "pop_culture_internet" },

  { sourceField: "references", raw: "art_culture", targetField: "context", targetId: "art_culture" },
  { sourceField: "references", raw: "curiosities", targetField: "context", targetId: "curiosities" },
  { sourceField: "references", raw: "events_celebrations", targetField: "context", targetId: "events_celebrations" },
  { sourceField: "references", raw: "fashion_style", targetField: "context", targetId: "fashion_style" },
  { sourceField: "references", raw: "hobbies_and_interests", targetField: "context", targetId: "hobbies_and_interests" },
  { sourceField: "references", raw: "hobbies_and_interests.automotive", targetField: "context", targetId: "automotive" },
  { sourceField: "references", raw: "hobbies_and_interests_automotive", targetField: "context", targetId: "automotive" },
  { sourceField: "references", raw: "history", targetField: "context", targetId: "history" },
  { sourceField: "references", raw: "home_decor_diy", targetField: "context", targetId: "home_decor_diy" },
  { sourceField: "references", raw: "nature_animals", targetField: "context", targetId: "nature_animals" },
  { sourceField: "references", raw: "parenting", targetField: "context", targetId: "parenting" },
  { sourceField: "references", raw: "people_and_groups.relationships_family", targetField: "context", targetId: "relationships_family" },
  { sourceField: "references", raw: "people_and_groups/parenting", targetField: "context", targetId: "parenting" },
  { sourceField: "references", raw: "personal_and_professional", targetField: "context", targetId: "personal_and_professional" },
  { sourceField: "references", raw: "personal_and_professional_relationships_family", targetField: "context", targetId: "relationships_family" },
  { sourceField: "references", raw: "pets", targetField: "context", targetId: "pets" },
  { sourceField: "references", raw: "pop_culture_people", targetField: "references", targetId: "pop_culture" },
  { sourceField: "references", raw: "relationships_family", targetField: "context", targetId: "relationships_family" },
  { sourceField: "references", raw: "science_and_knowledge", targetField: "context", targetId: "science_and_knowledge" },
  { sourceField: "references", raw: "science_communication", targetField: "context", targetId: "science_communication" },
  { sourceField: "references", raw: "social_and_events", targetField: "context", targetId: "social_and_events" },
  { sourceField: "references", raw: "social_and_events.events_celebrations", targetField: "context", targetId: "events_celebrations" },
  { sourceField: "references", raw: "social_and_events.social_causes_religion", targetField: "context", targetId: "social_causes_religion" },
  { sourceField: "references", raw: "social_and_events/social_causes_religion", targetField: "context", targetId: "social_causes_religion" },
  { sourceField: "references", raw: "social_causes_religion", targetField: "context", targetId: "social_causes_religion" },
  { sourceField: "references", raw: "technology_digital", targetField: "context", targetId: "technology_digital" },
];

export const REVIEWED_QUARANTINE_RESOLUTIONS: ReviewedQuarantineResolution[] = [
  ...REVIEWED_DROP_RULES.map((rule) => ({
    ...rule,
    action: "drop_from_quarantine" as const,
  })),
  ...REVIEWED_APPEND_RULES.map((rule) => ({
    ...rule,
    action: "append_to_target" as const,
  })),
];

export function getReviewedQuarantineResolution(
  sourceField: MetricCategoryField,
  raw: string
): ReviewedQuarantineResolution | null {
  const key = buildQuarantineResolutionKey(sourceField, raw);
  return (
    REVIEWED_QUARANTINE_RESOLUTIONS.find(
      (resolution) => buildQuarantineResolutionKey(resolution.sourceField, resolution.raw) === key
    ) ?? null
  );
}

export function getSuggestedCrossDimensionResolution(
  sourceField: MetricCategoryField,
  raw: string
): ReviewedQuarantineResolution | null {
  const matches = findCategoryMatchesAcrossTypes(raw);
  if (matches.length !== 1) return null;

  const match = matches[0];
  if (!match) return null;
  const targetField = TYPE_TO_FIELD[match.type];
  if (targetField === sourceField) return null;

  return {
    sourceField,
    raw,
    action: "append_to_target",
    targetField,
    targetId: match.id,
  };
}
