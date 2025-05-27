// src/app/models/Metric.ts - v1.4.2 (IMetricStats expandida com métricas calculadas)
import { Schema, model, models, Document, Model, Types } from "mongoose";

// Constantes padrão
const DEFAULT_FORMAT = 'Desconhecido';
const DEFAULT_SOURCE = 'manual';
const DEFAULT_CLASSIFICATION_STATUS = 'pending';
const DEFAULT_MEDIA_TYPE = 'UNKNOWN'; // Default para o novo campo 'type'

/**
 * Interface para o subdocumento 'stats' dentro de IMetric.
 * ATUALIZADO: Adicionadas métricas calculadas por formulas.ts
 */
export interface IMetricStats {
  // Métricas Brutas da API (ou já existentes)
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  profile_visits?: number;
  follows?: number;
  ig_reels_avg_watch_time?: number; // Tempo médio de visualização de Reels (segundos)
  ig_reels_video_view_total_time?: number; // Tempo total de visualização de Reels (segundos)
  profile_activity?: { [action_type: string]: number };
  impressions?: number;
  video_views?: number; // Para vídeos não-Reels e Reels (contagem de visualizações)
  engagement?: number;  // Métrica 'engagement' se fornecida diretamente pela API
  video_duration_seconds?: number; // Duração do vídeo (segundos), pode vir da API para vídeos

  // Métricas Calculadas por formulas.ts
  total_interactions?: number; // Já existia, mas é calculada
  engagement_rate_on_reach?: number;
  engagement_rate_on_impressions?: number;
  retention_rate?: number;
  follower_conversion_rate?: number;
  like_comment_ratio?: number;
  comment_share_ratio?: number;
  save_like_ratio?: number; // Corresponde a save_like_ratio_corrected em formulas.ts
  propagation_index?: number;
  virality_weighted?: number;
  follow_reach_ratio?: number;
  engagement_deep_vs_reach?: number;
  engagement_fast_vs_reach?: number;
  deep_fast_engagement_ratio?: number;

  // Permite outras chaves dinâmicas, mas o ideal é tipar todas as importantes
  [key: string]: unknown;
}

/**
 * Interface que define a estrutura de um documento Metric.
 * ATUALIZADO v1.4: Adiciona campo 'type' para o tipo de mídia.
 */
export interface IMetric extends Document {
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;

  type: 'IMAGE' | 'CAROUSEL_ALBUM' | 'VIDEO' | 'REEL' | 'STORY' | 'UNKNOWN' | string;

  format?: string;
  proposal?: string;
  context?: string;

  instagramMediaId?: string;
  source: 'manual' | 'api';

  classificationStatus: 'pending' | 'completed' | 'failed';
  classificationError?: string | null;

  rawData: unknown[];
  stats: IMetricStats; // Agora usa a IMetricStats expandida
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema para o modelo Metric.
 * ATUALIZADO v1.4: Adiciona campo 'type' para o tipo de mídia.
 */
const metricSchema = new Schema<IMetric>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postLink: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    postDate: {
      type: Date,
      required: true,
      index: true,
    },
    type: {
      type: String,
      default: DEFAULT_MEDIA_TYPE,
      index: true,
    },
    format: {
      type: String,
      default: DEFAULT_FORMAT,
      index: true,
      trim: true,
    },
    proposal: {
      type: String,
      default: "Outro",
      index: true,
      trim: true,
    },
    context: {
      type: String,
      default: "Geral",
      index: true,
      trim: true,
    },
    instagramMediaId: {
      type: String,
      index: true,
      sparse: true,
      default: null,
    },
    source: {
      type: String,
      enum: ['manual', 'api'],
      required: [true, 'A fonte do dado (source) é obrigatória.'],
      default: DEFAULT_SOURCE,
      index: true,
    },
    classificationStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: DEFAULT_CLASSIFICATION_STATUS,
      index: true,
    },
    classificationError: {
      type: String,
      default: null,
    },
    rawData: {
      type: Array,
      default: [],
    },
    stats: { // A definição do schema para stats continua Mixed, mas a interface IMetricStats é usada para type-hinting
      type: Schema.Types.Mixed,
      default: {},
      // Os campos individuais aqui são mais para referência e não são estritamente impostos pelo Mongoose para Mixed.
      // A interface IMetricStats é a principal fonte de verdade para a estrutura esperada.
      views: { type: Number },
      reach: { type: Number },
      likes: { type: Number },
      comments: { type: Number },
      saved: { type: Number },
      shares: { type: Number },
      total_interactions: { type: Number },
      profile_visits: { type: Number },
      follows: { type: Number },
      ig_reels_avg_watch_time: { type: Number },
      ig_reels_video_view_total_time: { type: Number },
      profile_activity: { type: Schema.Types.Mixed },
      video_duration_seconds: { type: Number },
      // As novas métricas calculadas também seriam salvas aqui sob o Mixed type.
    },
  },
  {
    timestamps: true,
  }
);

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
