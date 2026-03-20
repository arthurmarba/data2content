import {
  canonicalizeCategoryValues,
  sanitizeLegacyProposalValues,
} from "@/app/lib/classification";
import { buildMetricClassificationUpdate } from "@/app/lib/classificationRuntime";

export type StrategicRankableCategory =
  | "format"
  | "proposal"
  | "context"
  | "tone"
  | "references"
  | "contentIntent"
  | "narrativeForm"
  | "contentSignals"
  | "stance"
  | "proofStyle"
  | "commercialMode";

export interface MetricClassificationSource {
  source?: string | null;
  type?: string | null;
  description?: string | null;
  format?: unknown;
  proposal?: unknown;
  context?: unknown;
  tone?: unknown;
  references?: unknown;
  contentIntent?: unknown;
  narrativeForm?: unknown;
  contentSignals?: unknown;
  stance?: unknown;
  proofStyle?: unknown;
  commercialMode?: unknown;
}

const NON_TONE_LEGACY_VALUES = new Set(["educational", "promotional"]);

function toStringArray(values: unknown): string[] {
  if (Array.isArray(values)) {
    return values.filter((value): value is string => typeof value === "string");
  }
  if (typeof values === "string") {
    return [values];
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function buildMetricClassificationSnapshot(metric: MetricClassificationSource) {
  return buildMetricClassificationUpdate(
    {
      source: metric.source,
      type: metric.type,
      description: metric.description,
    },
    {
      format: toStringArray(metric.format),
      proposal: toStringArray(metric.proposal),
      context: toStringArray(metric.context),
      tone: toStringArray(metric.tone),
      references: toStringArray(metric.references),
      contentIntent: toStringArray(metric.contentIntent),
      narrativeForm: toStringArray(metric.narrativeForm),
      contentSignals: toStringArray(metric.contentSignals),
      stance: toStringArray(metric.stance),
      proofStyle: toStringArray(metric.proofStyle),
      commercialMode: toStringArray(metric.commercialMode),
    }
  );
}

export function getMetricCategoryValuesForAnalytics(
  metric: MetricClassificationSource,
  category: StrategicRankableCategory
): string[] {
  const snapshot = buildMetricClassificationSnapshot(metric);
  if (category === "proposal") {
    return sanitizeLegacyProposalValues(snapshot.proposal);
  }
  return snapshot[category];
}

export function sanitizeLegacyProposalForV2(values: unknown): string[] {
  return sanitizeLegacyProposalValues(values);
}

export function sanitizeLegacyToneForV2(values: unknown): string[] {
  return canonicalizeCategoryValues(values, "tone").filter(
    (value) => !NON_TONE_LEGACY_VALUES.has(value)
  );
}

export function buildClassificationV2BackfillUpdate(
  metric: MetricClassificationSource,
  options?: { rewriteLegacy?: boolean }
) {
  const snapshot = buildMetricClassificationSnapshot(metric);

  return {
    contentIntent: snapshot.contentIntent,
    narrativeForm: snapshot.narrativeForm,
    contentSignals: snapshot.contentSignals,
    stance: snapshot.stance,
    proofStyle: snapshot.proofStyle,
    commercialMode: snapshot.commercialMode,
    ...(options?.rewriteLegacy
      ? {
          proposal: uniqueStrings([
            ...sanitizeLegacyProposalForV2(metric.proposal),
          ]),
          tone: uniqueStrings([...sanitizeLegacyToneForV2(metric.tone)]),
        }
      : {}),
  };
}

export function hasClassificationV2BackfillChanges(
  metric: MetricClassificationSource,
  options?: { rewriteLegacy?: boolean }
) {
  const nextValues = buildClassificationV2BackfillUpdate(metric, options);
  const fields = Object.keys(nextValues) as Array<keyof typeof nextValues>;

  return fields.some((field) => {
    const current = uniqueStrings(toStringArray(metric[field]));
    const next = uniqueStrings(toStringArray(nextValues[field]));
    return current.length !== next.length || current.some((value, index) => value !== next[index]);
  });
}
