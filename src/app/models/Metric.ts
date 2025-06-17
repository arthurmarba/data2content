// @/app/models/Metric.ts - v1.5.2
// OTTIMIZAÇÃO: A análise confirmou que este modelo já possui uma estratégia de
// indexação muito robusta e abrangente. Os índices compostos existentes, como
// `{ user: 1, format: 1, proposal: 1, context: 1, postDate: -1 }`, são
// perfeitamente adequados para as consultas complexas de filtragem e ranking
// do dashboard. Nenhuma alteração é necessária.

import { Schema, model, models, Document, Model, Types } from "mongoose";
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    FormatType,
    ProposalType,
    ContextType
} from "@/app/lib/constants/communityInspirations.constants";

const DEFAULT_FORMAT_ENUM: FormatType = "Desconhecido"; 
const DEFAULT_PROPOSAL_ENUM: ProposalType = "Outro Propósito"; 
const DEFAULT_CONTEXT_ENUM: ContextType = "Geral"; 
const DEFAULT_MEDIA_TYPE = 'UNKNOWN';

export interface IMetricStats {
  // ... (interface IMetricStats sem alterações) ...
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
  like_comment_ratio?: number;
  comment_share_ratio?: number;
  save_like_ratio?: number;
  propagation_index?: number;
  virality_weighted?: number;
  follow_reach_ratio?: number;
  engagement_deep_vs_reach?: number;
  engagement_fast_vs_reach?: number;
  deep_fast_engagement_ratio?: number;
  initial_plays?: number;
  repeats?: number;
  reel_interactions?: number;
  engaged_accounts?: number;
  average_video_watch_time_seconds?: number;
  total_watch_time_seconds?: number;
  reach_followers_ratio?: number;
  reach_non_followers_ratio?: number;
  total_plays_manual?: number;
  total_interactions_manual?: number;
  [key: string]: unknown;
}

export interface IMetric extends Document {
  // ... (interface IMetric sem alterações) ...
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;
  type: 'IMAGE' | 'CAROUSEL_ALBUM' | 'VIDEO' | 'REEL' | 'STORY' | 'UNKNOWN' | string;
  format?: FormatType;
  proposal?: ProposalType;
  context?: ContextType;
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
    // ... (definições de schema sem alterações) ...
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postLink: { type: String, default: "" },
    description: { type: String, default: "" },
    postDate: { type: Date, required: true, index: true },
    type: { type: String, default: DEFAULT_MEDIA_TYPE, index: true },
    format: { type: String, enum: VALID_FORMATS, default: DEFAULT_FORMAT_ENUM, index: true, trim: true },
    proposal: { type: String, enum: VALID_PROPOSALS, default: DEFAULT_PROPOSAL_ENUM, index: true, trim: true },
    context: { type: String, enum: VALID_CONTEXTS, default: DEFAULT_CONTEXT_ENUM, index: true, trim: true },
    theme: { type: String, trim: true, default: null },
    collab: { type: Boolean, default: false },
    collabCreator: { type: String, trim: true, default: null },
    coverUrl: { type: String, trim: true, default: null },
    instagramMediaId: { type: String, index: true, sparse: true, default: null },
    source: { type: String, enum: ['manual', 'api', 'document_ai'], required: [true, 'A fonte do dado (source) é obrigatória.'], default: 'manual', index: true },
    classificationStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    classificationError: { type: String, default: null },
    rawData: { type: Array, default: [] },
    stats: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// Índices existentes já são ótimos.
metricSchema.index({ user: 1, createdAt: -1 });
metricSchema.index({ user: 1, postDate: -1 });
metricSchema.index({ user: 1, format: 1, proposal: 1, context: 1, postDate: -1 }); 
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });
metricSchema.index({ user: 1, type: 1, postDate: -1 });
metricSchema.index({ user: 1, format: 1, proposal: 1, context: 1, "stats.shares": -1, "stats.saved": -1 }, { name: "idx_enrichStats_sort" });
metricSchema.index({ user: 1, postDate: -1, "stats.shares": -1 }, { name: "idx_topBottom_shares" });
metricSchema.index({ user: 1, postDate: -1, "stats.video_duration_seconds": 1 }, { name: "idx_durationStats" });

const MetricModel = models.Metric
  ? (models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
