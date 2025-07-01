// @/app/models/Metric.ts - v2.3
// CORREÇÃO DEFINITIVA: Removidos TODOS os índices compostos que poderiam causar
// o erro 'cannot index parallel arrays'. Apenas índices individuais e seguros foram mantidos.

import mongoose, { Schema, model, Document, Model, Types } from "mongoose";

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
  // ... e todos os outros campos de stats
  [key: string]: unknown;
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
  theme?: string;
  collab?: boolean;
  collabCreator?: string;
  coverUrl?: string;
  instagramMediaId?: string;
  source: 'manual' | 'api' | 'document_ai';
  classificationStatus: 'pending' | 'completed' | 'failed';
  classificationError?: string | null;
  rawData: unknown[];
  stats: IMetricStats;
  createdAt: Date;
  updatedAt: Date;
}

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
    theme: { type: String, trim: true, default: null },
    collab: { type: Boolean, default: false },
    collabCreator: { type: String, trim: true, default: null },
    coverUrl: { type: String, trim: true, default: null },
    instagramMediaId: { type: String, index: true, sparse: true, default: null },
    source: { type: String, enum: ['manual', 'api', 'document_ai'], required: true, default: 'manual', index: true },
    classificationStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    classificationError: { type: String, default: null },
    rawData: { type: Array, default: [] },
    stats: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// --- ESTRATÉGIA DE INDEXAÇÃO FINAL E SEGURA ---
// Apenas índices simples e um composto que não envolve múltiplos arrays.
metricSchema.index({ user: 1, postDate: -1 });
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });

const MetricModel = mongoose.models.Metric
  ? (mongoose.models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
