import { idsToLabels } from "@/app/lib/classification";
import { v2IdsToLabels } from "@/app/lib/classificationV2";
import { v25IdsToLabels } from "@/app/lib/classificationV2_5";

export type DiscoverPresentationCategories = {
  format?: string[];
  context?: string[];
  references?: string[];
  contentIntent?: string[];
  narrativeForm?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
};

export type DiscoverChipSpec = {
  text: string;
  tone: "format" | "intent" | "topic" | "proof";
};

const firstLabel = (labels: string[]) => labels.find(Boolean) || null;

export function getDiscoverPrimaryBadge(
  categories?: DiscoverPresentationCategories | null
): string | null {
  if (!categories) return null;

  return (
    firstLabel(v2IdsToLabels(categories.contentIntent, "contentIntent")) ||
    firstLabel(v2IdsToLabels(categories.narrativeForm, "narrativeForm")) ||
    firstLabel(v25IdsToLabels(categories.proofStyle, "proofStyle")) ||
    firstLabel(v25IdsToLabels(categories.commercialMode, "commercialMode")) ||
    null
  );
}

export function getDiscoverGridChips(
  categories?: DiscoverPresentationCategories | null
): DiscoverChipSpec[] {
  if (!categories) return [];

  const candidates: Array<DiscoverChipSpec | null> = [
    (() => {
      const text = firstLabel(idsToLabels(categories.format, "format"));
      return text ? { text, tone: "format" as const } : null;
    })(),
    (() => {
      const text =
        firstLabel(v2IdsToLabels(categories.contentIntent, "contentIntent")) ||
        firstLabel(v2IdsToLabels(categories.narrativeForm, "narrativeForm"));
      return text ? { text, tone: "intent" as const } : null;
    })(),
    (() => {
      const text =
        firstLabel(idsToLabels(categories.context, "context")) ||
        firstLabel(v25IdsToLabels(categories.proofStyle, "proofStyle")) ||
        firstLabel(v25IdsToLabels(categories.commercialMode, "commercialMode")) ||
        firstLabel(idsToLabels(categories.references, "reference"));
      return text ? { text, tone: "topic" as const } : null;
    })(),
  ];

  const seen = new Set<string>();
  return candidates
    .filter((chip): chip is DiscoverChipSpec => Boolean(chip))
    .filter((chip) => {
      const key = chip.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
