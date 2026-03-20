// @/app/models/Metric.ts - v2.4
// ÍNDICES SEGUROS: Removidos índices compostos problemáticos (parallel arrays).
// Mantidos apenas índices simples e UM composto seguro (user, postDate).
// Adicionado índice simples em 'stats.total_interactions' para acelerar ordenações.

import mongoose, { Schema, model, Document, Model, Types } from "mongoose";
import { analyzeLegacyCategoryValues, CLASSIFICATION_DIMENSIONS, type MetricCategoryField } from "@/app/lib/classificationLegacy";
import { sanitizeLegacyProposalValues } from "@/app/lib/classification";
import {
  canonicalizeV2CategoryValues,
  toCanonicalV2CategoryId,
  V2_CLASSIFICATION_FIELDS,
  type ClassificationV2Type,
} from "@/app/lib/classificationV2";
import {
  canonicalizeV25CategoryValues,
  toCanonicalV25CategoryId,
  V25_CLASSIFICATION_FIELDS,
  type ClassificationV25Type,
} from "@/app/lib/classificationV2_5";

const DEFAULT_MEDIA_TYPE = 'UNKNOWN';

export interface IMetricStats {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  profile_visits?: number;
  follows?: number;
  ig_reels_avg_watch_time?: number;
  ig_reels_video_view_total_time?: number;
  profile_activity?: { [action_type: string]: number };
  impressions?: number;
  video_views?: number;
  engagement?: number;
  video_duration_seconds?: number;
  total_interactions?: number;
  engagement_rate_on_reach?: number;
  engagement_rate_on_impressions?: number;
  retention_rate?: number;
  follower_conversion_rate?: number;
  propagation_index?: number;
  like_comment_ratio?: number;
  comment_share_ratio?: number;
  save_like_ratio?: number;
  virality_weighted?: number;
  follow_reach_ratio?: number;
  engagement_deep_vs_reach?: number;
  engagement_fast_vs_reach?: number;
  deep_fast_engagement_ratio?: number;
  // ... outros campos de stats
  [key: string]: unknown;
}

export interface ISnapshot {
  date: Date;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
  [key: string]: any;
}

export interface IMetricClassificationQuarantine {
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
}

export interface IMetricEntityTarget {
  type:
    | "brand"
    | "product"
    | "service"
    | "person"
    | "city"
    | "country"
    | "franchise"
    | "platform";
  label: string;
  canonicalId?: string | null;
}

export interface IMetricClassificationMeta {
  confidence?: Record<string, number>;
  evidence?: Record<string, string[]>;
  primary?: string | null;
  secondary?: string | null;
}

const ENTITY_TARGET_TYPES = [
  "brand",
  "product",
  "service",
  "person",
  "city",
  "country",
  "franchise",
  "platform",
] as const;

function isEntityTargetType(value: string): value is IMetricEntityTarget["type"] {
  return (ENTITY_TARGET_TYPES as readonly string[]).includes(value);
}

export interface IMetric extends Document {
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;
  type: string;
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
  contentIntent: string[];
  narrativeForm: string[];
  contentSignals: string[];
  stance: string[];
  proofStyle: string[];
  commercialMode: string[];
  entityTargets?: IMetricEntityTarget[];
  classificationMeta?: IMetricClassificationMeta;
  classificationQuarantine?: IMetricClassificationQuarantine;
  theme?: string;
  collab?: boolean;
  collabCreator?: string;
  coverUrl?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  instagramMediaId?: string;
  source: 'manual' | 'api' | 'document_ai';
  classificationStatus: 'pending' | 'completed' | 'failed';
  classificationError?: string | null;
  dailySnapshots?: ISnapshot[];
  rawData: unknown[];
  stats: IMetricStats;
  isPubli: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

function buildClassificationValidationError(field: string, values: string[]) {
  const error = new mongoose.Error.ValidationError();
  error.addError(
    field,
    new mongoose.Error.ValidatorError({
      path: field,
      message: `Unknown classification values for ${field}: ${values.join(", ")}`,
      value: values,
    })
  );
  return error;
}

function analyzeV2CategoryValues(values: unknown, type: ClassificationV2Type) {
  const rawValues = toStringArray(values);
  const canonicalValues = canonicalizeV2CategoryValues(rawValues, type);
  const unknownValues = rawValues.filter((value) => !toCanonicalV2CategoryId(value, type));

  return {
    rawValues,
    canonicalValues,
    unknownValues,
  };
}

function analyzeV25CategoryValues(values: unknown, type: ClassificationV25Type) {
  const rawValues = toStringArray(values);
  const canonicalValues = canonicalizeV25CategoryValues(rawValues, type);
  const unknownValues = rawValues.filter((value) => !toCanonicalV25CategoryId(value, type));

  return {
    rawValues,
    canonicalValues,
    unknownValues,
  };
}

function normalizeEntityTargets(values: unknown): IMetricEntityTarget[] {
  if (!Array.isArray(values)) return [];

  const normalized: IMetricEntityTarget[] = [];

  for (const value of values) {
    if (typeof value !== "object" || value === null) continue;

    const type = typeof value.type === "string" ? value.type.trim() : "";
    const label = typeof value.label === "string" ? value.label.trim() : "";

    if (!isEntityTargetType(type) || !label) continue;

    const canonicalId =
      typeof value.canonicalId === "string" && value.canonicalId.trim()
        ? value.canonicalId.trim()
        : null;

    normalized.push({
      type,
      label,
      canonicalId,
    });
  }

  return normalized;
}

function normalizeClassificationMeta(values: unknown): IMetricClassificationMeta | undefined {
  if (!values || typeof values !== "object" || Array.isArray(values)) return undefined;

  const raw = values as Record<string, unknown>;
  const confidence =
    raw.confidence && typeof raw.confidence === "object" && !Array.isArray(raw.confidence)
      ? Object.entries(raw.confidence as Record<string, unknown>).reduce<Record<string, number>>(
          (acc, [key, value]) => {
            if (typeof value === "number" && Number.isFinite(value)) {
              acc[key] = value;
            }
            return acc;
          },
          {}
        )
      : undefined;
  const evidence =
    raw.evidence && typeof raw.evidence === "object" && !Array.isArray(raw.evidence)
      ? Object.entries(raw.evidence as Record<string, unknown>).reduce<Record<string, string[]>>(
          (acc, [key, value]) => {
            acc[key] = toStringArray(value);
            return acc;
          },
          {}
        )
      : undefined;
  const primary = typeof raw.primary === "string" && raw.primary.trim() ? raw.primary.trim() : null;
  const secondary =
    typeof raw.secondary === "string" && raw.secondary.trim() ? raw.secondary.trim() : null;

  return {
    ...(confidence && Object.keys(confidence).length > 0 ? { confidence } : {}),
    ...(evidence && Object.keys(evidence).length > 0 ? { evidence } : {}),
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
  };
}

function normalizeClassificationDocument(doc: mongoose.Document & { invalidate: (path: string, message: string, value?: unknown, kind?: string) => void }) {
  const currentQuarantine = (doc.get("classificationQuarantine") ?? {}) as Partial<Record<MetricCategoryField, unknown>>;
  const nextQuarantine: IMetricClassificationQuarantine = {};

  for (const dimension of CLASSIFICATION_DIMENSIONS) {
    const analysis = analyzeLegacyCategoryValues(doc.get(dimension.field), dimension.type);
    doc.set(
      dimension.field,
      dimension.field === "proposal"
        ? sanitizeLegacyProposalValues(analysis.canonicalValues)
        : analysis.canonicalValues
    );

    if (analysis.unknownValues.length > 0) {
      doc.invalidate(
        dimension.field,
        `Unknown classification values for ${dimension.field}: ${analysis.unknownValues.join(", ")}`,
        analysis.unknownValues
      );
    }

    const quarantineValues = uniqueStrings(toStringArray(currentQuarantine[dimension.field]));
    if (quarantineValues.length > 0) {
      nextQuarantine[dimension.field] = quarantineValues;
    }
  }

  for (const field of V2_CLASSIFICATION_FIELDS) {
    const analysis = analyzeV2CategoryValues(doc.get(field.field), field.type);
    doc.set(field.field, analysis.canonicalValues);

    if (analysis.unknownValues.length > 0) {
      doc.invalidate(
        field.field,
        `Unknown classification values for ${field.field}: ${analysis.unknownValues.join(", ")}`,
        analysis.unknownValues
      );
    }
  }

  for (const field of V25_CLASSIFICATION_FIELDS) {
    const analysis = analyzeV25CategoryValues(doc.get(field.field), field.type);
    doc.set(field.field, analysis.canonicalValues);

    if (analysis.unknownValues.length > 0) {
      doc.invalidate(
        field.field,
        `Unknown classification values for ${field.field}: ${analysis.unknownValues.join(", ")}`,
        analysis.unknownValues
      );
    }
  }

  doc.set("entityTargets", normalizeEntityTargets(doc.get("entityTargets")));
  doc.set("classificationMeta", normalizeClassificationMeta(doc.get("classificationMeta")));

  doc.set("classificationQuarantine", nextQuarantine);
}

function normalizeClassificationUpdatePayload(update: Record<string, unknown>) {
  const candidateTargets = [update];
  const setUpdate = update.$set;
  const setOnInsertUpdate = update.$setOnInsert;

  if (setUpdate && typeof setUpdate === "object" && !Array.isArray(setUpdate)) {
    candidateTargets.push(setUpdate as Record<string, unknown>);
  }
  if (setOnInsertUpdate && typeof setOnInsertUpdate === "object" && !Array.isArray(setOnInsertUpdate)) {
    candidateTargets.push(setOnInsertUpdate as Record<string, unknown>);
  }

  for (const target of candidateTargets) {
    for (const dimension of CLASSIFICATION_DIMENSIONS) {
      if (!Object.prototype.hasOwnProperty.call(target, dimension.field)) continue;

      const analysis = analyzeLegacyCategoryValues(target[dimension.field], dimension.type);
      target[dimension.field] =
        dimension.field === "proposal"
          ? sanitizeLegacyProposalValues(analysis.canonicalValues)
          : analysis.canonicalValues;

      if (analysis.unknownValues.length > 0) {
        throw buildClassificationValidationError(dimension.field, analysis.unknownValues);
      }
    }

    for (const field of V2_CLASSIFICATION_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(target, field.field)) continue;

      const analysis = analyzeV2CategoryValues(target[field.field], field.type);
      target[field.field] = analysis.canonicalValues;

      if (analysis.unknownValues.length > 0) {
        throw buildClassificationValidationError(field.field, analysis.unknownValues);
      }
    }

    for (const field of V25_CLASSIFICATION_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(target, field.field)) continue;

      const analysis = analyzeV25CategoryValues(target[field.field], field.type);
      target[field.field] = analysis.canonicalValues;

      if (analysis.unknownValues.length > 0) {
        throw buildClassificationValidationError(field.field, analysis.unknownValues);
      }
    }

    if (Object.prototype.hasOwnProperty.call(target, "entityTargets")) {
      target.entityTargets = normalizeEntityTargets(target.entityTargets);
    }

    if (Object.prototype.hasOwnProperty.call(target, "classificationMeta")) {
      target.classificationMeta = normalizeClassificationMeta(target.classificationMeta);
    }
  }
}

const classificationQuarantineSchema = new Schema<IMetricClassificationQuarantine>(
  {
    format: { type: [String], default: [] },
    proposal: { type: [String], default: [] },
    context: { type: [String], default: [] },
    tone: { type: [String], default: [] },
    references: { type: [String], default: [] },
  },
  { _id: false }
);

const entityTargetSchema = new Schema<IMetricEntityTarget>(
  {
    type: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    canonicalId: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const metricSchema = new Schema<IMetric>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postLink: { type: String, default: "" },
    description: { type: String, default: "" },
    postDate: { type: Date, required: true, index: true },
    type: { type: String, default: DEFAULT_MEDIA_TYPE, index: true },
    format: { type: [String], default: [], index: true },
    proposal: { type: [String], default: [], index: true },
    context: { type: [String], default: [], index: true },
    tone: { type: [String], default: [], index: true },
    references: { type: [String], default: [], index: true },
    contentIntent: { type: [String], default: [], index: true },
    narrativeForm: { type: [String], default: [], index: true },
    contentSignals: { type: [String], default: [], index: true },
    stance: { type: [String], default: [], index: true },
    proofStyle: { type: [String], default: [], index: true },
    commercialMode: { type: [String], default: [], index: true },
    entityTargets: { type: [entityTargetSchema], default: [] },
    classificationMeta: { type: Schema.Types.Mixed, default: undefined },
    classificationQuarantine: { type: classificationQuarantineSchema, default: undefined },
    theme: { type: String, trim: true, default: null },
    collab: { type: Boolean, default: false },
    collabCreator: { type: String, trim: true, default: null },
    coverUrl: { type: String, trim: true, default: null },
    mediaUrl: { type: String, trim: true, default: null },
    thumbnailUrl: { type: String, trim: true, default: null },
    instagramMediaId: { type: String, index: true, sparse: true, default: null },
    source: { type: String, enum: ['manual', 'api', 'document_ai'], required: true, default: 'manual', index: true },
    classificationStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    classificationError: { type: String, default: null },
    dailySnapshots: { type: Array, default: [] },
    rawData: { type: Array, default: [] },
    stats: { type: Schema.Types.Mixed, default: { total_interactions: 0, engagement: 0 } },
    isPubli: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// --- ÍNDICES ---
// Seguro (não envolve arrays em conjunto):
metricSchema.index({ user: 1, postDate: -1 });
metricSchema.index({ user: 1, postDate: -1, updatedAt: -1, _id: -1 });

// Único por usuário (mantém integridade sem parallel arrays):
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });

// Suporte a ordenação/consulta frequente (simples):
metricSchema.index({ 'stats.total_interactions': -1 });

metricSchema.pre("validate", function metricClassificationValidation(next) {
  try {
    normalizeClassificationDocument(this as mongoose.Document & { invalidate: (path: string, message: string, value?: unknown, kind?: string) => void });
    next();
  } catch (error) {
    next(error as Error);
  }
});

const metricClassificationQueryHooks = ["updateOne", "updateMany", "findOneAndUpdate"] as const;
for (const hook of metricClassificationQueryHooks) {
  metricSchema.pre(hook, function metricClassificationUpdateValidation(next) {
    try {
      const update = this.getUpdate();
      if (update && typeof update === "object" && !Array.isArray(update)) {
        normalizeClassificationUpdatePayload(update as Record<string, unknown>);
      }
      next();
    } catch (error) {
      next(error as Error);
    }
  });
}

const MetricModel = mongoose.models.Metric
  ? (mongoose.models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
