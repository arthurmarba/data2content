import { canonicalizeCategoryValues, getCategoryById, getCategoryByValue, type CategoryType } from "@/app/lib/classification";

export type MetricCategoryField = "format" | "proposal" | "context" | "tone" | "references";

export type ClassificationDimension = {
  field: MetricCategoryField;
  type: CategoryType;
};

export type StoredCategoryValueBucket = "canonical_id" | "canonical_label" | "alias" | "unknown";

export type StoredCategoryValueInspection = {
  raw: string;
  canonicalId: string | null;
  canonicalLabel: string | null;
  bucket: StoredCategoryValueBucket;
};

export type LegacyCategoryAnalysis = {
  rawValues: string[];
  canonicalValues: string[];
  unknownValues: string[];
  recognizedValues: StoredCategoryValueInspection[];
  canMigrateDeterministically: boolean;
  isAlreadyCanonical: boolean;
  hasChanges: boolean;
};

export type MetricClassificationMigrationPlan = {
  update: Partial<Record<MetricCategoryField, string[]>>;
  analysisByField: Record<MetricCategoryField, LegacyCategoryAnalysis>;
  changedFields: MetricCategoryField[];
  blockedFields: MetricCategoryField[];
};

export type MetricClassificationQuarantine = Partial<Record<MetricCategoryField, string[]>>;

export type MetricClassificationQuarantinePlan = {
  update: Partial<Record<MetricCategoryField, string[]>>;
  quarantineUpdate: MetricClassificationQuarantine;
  analysisByField: Record<MetricCategoryField, LegacyCategoryAnalysis>;
  changedFields: MetricCategoryField[];
  quarantinedFields: MetricCategoryField[];
};

export const CLASSIFICATION_DIMENSIONS: ClassificationDimension[] = [
  { field: "format", type: "format" },
  { field: "proposal", type: "proposal" },
  { field: "context", type: "context" },
  { field: "tone", type: "tone" },
  { field: "references", type: "reference" },
];

function toStringArray(values: unknown): string[] {
  if (Array.isArray(values)) {
    return values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (typeof values === "string") {
    const trimmed = values.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
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

export function inspectStoredCategoryValue(rawValue: string, type: CategoryType): StoredCategoryValueInspection {
  const raw = rawValue.trim();
  if (!raw) {
    return {
      raw,
      canonicalId: null,
      canonicalLabel: null,
      bucket: "unknown",
    };
  }

  const byId = getCategoryById(raw, type);
  if (byId) {
    return {
      raw,
      canonicalId: byId.id,
      canonicalLabel: byId.label,
      bucket: "canonical_id",
    };
  }

  const resolved = getCategoryByValue(raw, type);
  if (!resolved) {
    return {
      raw,
      canonicalId: null,
      canonicalLabel: null,
      bucket: "unknown",
    };
  }

  const bucket: StoredCategoryValueBucket = raw === resolved.label ? "canonical_label" : "alias";
  return {
    raw,
    canonicalId: resolved.id,
    canonicalLabel: resolved.label,
    bucket,
  };
}

export function analyzeLegacyCategoryValues(values: unknown, type: CategoryType): LegacyCategoryAnalysis {
  const rawValues = toStringArray(values);
  const recognizedValues = rawValues.map((raw) => inspectStoredCategoryValue(raw, type));
  const unknownValues = recognizedValues
    .filter((item) => item.bucket === "unknown")
    .map((item) => item.raw);
  const canonicalValues = canonicalizeCategoryValues(rawValues, type);
  const canMigrateDeterministically = unknownValues.length === 0;
  const isAlreadyCanonical = canMigrateDeterministically && arraysEqual(rawValues, canonicalValues);
  const hasChanges = !arraysEqual(rawValues, canonicalValues);

  return {
    rawValues,
    canonicalValues,
    unknownValues,
    recognizedValues,
    canMigrateDeterministically,
    isAlreadyCanonical,
    hasChanges,
  };
}

export function buildMetricClassificationMigrationPlan(
  metric: Partial<Record<MetricCategoryField, unknown>>
): MetricClassificationMigrationPlan {
  const analysisByField = {} as Record<MetricCategoryField, LegacyCategoryAnalysis>;
  const update: Partial<Record<MetricCategoryField, string[]>> = {};
  const changedFields: MetricCategoryField[] = [];
  const blockedFields: MetricCategoryField[] = [];

  for (const dimension of CLASSIFICATION_DIMENSIONS) {
    const analysis = analyzeLegacyCategoryValues(metric[dimension.field], dimension.type);
    analysisByField[dimension.field] = analysis;

    if (!analysis.hasChanges) continue;
    if (!analysis.canMigrateDeterministically) {
      blockedFields.push(dimension.field);
      continue;
    }

    update[dimension.field] = analysis.canonicalValues;
    changedFields.push(dimension.field);
  }

  return {
    update,
    analysisByField,
    changedFields,
    blockedFields,
  };
}

export function buildMetricClassificationQuarantinePlan(
  metric: Partial<Record<MetricCategoryField, unknown>> & {
    classificationQuarantine?: Partial<Record<MetricCategoryField, unknown>>;
  }
): MetricClassificationQuarantinePlan {
  const analysisByField = {} as Record<MetricCategoryField, LegacyCategoryAnalysis>;
  const update: Partial<Record<MetricCategoryField, string[]>> = {};
  const quarantineUpdate: MetricClassificationQuarantine = {};
  const changedFields: MetricCategoryField[] = [];
  const quarantinedFields: MetricCategoryField[] = [];
  const currentQuarantine = metric.classificationQuarantine ?? {};

  for (const dimension of CLASSIFICATION_DIMENSIONS) {
    const analysis = analyzeLegacyCategoryValues(metric[dimension.field], dimension.type);
    const existingQuarantine = uniqueStrings(toStringArray(currentQuarantine[dimension.field]));
    const nextQuarantine = uniqueStrings([...existingQuarantine, ...analysis.unknownValues]);
    analysisByField[dimension.field] = analysis;

    if (!arraysEqual(analysis.rawValues, analysis.canonicalValues)) {
      update[dimension.field] = analysis.canonicalValues;
      changedFields.push(dimension.field);
    }

    if (!arraysEqual(existingQuarantine, nextQuarantine)) {
      quarantineUpdate[dimension.field] = nextQuarantine;
      quarantinedFields.push(dimension.field);
    }
  }

  return {
    update,
    quarantineUpdate,
    analysisByField,
    changedFields,
    quarantinedFields,
  };
}
