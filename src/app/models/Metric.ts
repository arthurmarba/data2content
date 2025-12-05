// @/app/models/Metric.ts - v2.4
// ÍNDICES SEGUROS: Removidos índices compostos problemáticos (parallel arrays).
// Mantidos apenas índices simples e UM composto seguro (user, postDate).
// Adicionado índice simples em 'stats.total_interactions' para acelerar ordenações.

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
  dailySnapshots?: ISnapshot[];
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
    dailySnapshots: { type: Array, default: [] },
    rawData: { type: Array, default: [] },
    stats: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// --- ÍNDICES ---
// Seguro (não envolve arrays em conjunto):
metricSchema.index({ user: 1, postDate: -1 });

// Único por usuário (mantém integridade sem parallel arrays):
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });

// Suporte a ordenação/consulta frequente (simples):
metricSchema.index({ 'stats.total_interactions': -1 });

const MetricModel = mongoose.models.Metric
  ? (mongoose.models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
