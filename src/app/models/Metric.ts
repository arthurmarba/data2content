// @/app/models/Metric.ts - v1.5.0 (Adiciona Enums para format, proposal, context)
// - ATUALIZADO: Campos format, proposal, e context usam tipos Enum e validação.
// - Baseado na v1.4.2.
import { Schema, model, models, Document, Model, Types } from "mongoose";
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    FormatType,
    ProposalType,
    ContextType
} from "@/app/lib/constants/communityInspirations.constants"; // Importando os novos enums/constantes

// Constantes padrão alinhadas com os Enums
const DEFAULT_FORMAT_ENUM: FormatType = "Desconhecido"; // "Desconhecido" está em VALID_FORMATS
const DEFAULT_PROPOSAL_ENUM: ProposalType = "Outro Propósito"; // "Outro Propósito" está em VALID_PROPOSALS
const DEFAULT_CONTEXT_ENUM: ContextType = "Geral"; // "Geral" está em VALID_CONTEXTS
const DEFAULT_MEDIA_TYPE = 'UNKNOWN';

/**
 * Interface para o subdocumento 'stats' dentro de IMetric.
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
  ig_reels_avg_watch_time?: number;
  ig_reels_video_view_total_time?: number;
  profile_activity?: { [action_type: string]: number };
  impressions?: number;
  video_views?: number;
  engagement?: number;
  video_duration_seconds?: number;

  // Métricas Calculadas por formulas.ts
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

  [key: string]: unknown;
}

/**
 * Interface que define a estrutura de um documento Metric.
 * ATUALIZADO v1.5.0
 */
export interface IMetric extends Document {
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;

  type: 'IMAGE' | 'CAROUSEL_ALBUM' | 'VIDEO' | 'REEL' | 'STORY' | 'UNKNOWN' | string; // Poderia ser um Enum mais estrito se desejado

  format?: FormatType;   // ATUALIZADO
  proposal?: ProposalType; // ATUALIZADO
  context?: ContextType;  // ATUALIZADO

  instagramMediaId?: string;
  source: 'manual' | 'api';

  classificationStatus: 'pending' | 'completed' | 'failed';
  classificationError?: string | null;

  rawData: unknown[];
  stats: IMetricStats;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema para o modelo Metric.
 * ATUALIZADO v1.5.0
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
    type: { // Este 'type' refere-se ao tipo de mídia (IMAGE, VIDEO, etc)
      type: String,
      default: DEFAULT_MEDIA_TYPE,
      index: true,
    },
    format: { // Este 'format' é a nossa classificação de formato
      type: String,
      enum: VALID_FORMATS, // ATUALIZADO
      default: DEFAULT_FORMAT_ENUM, // ATUALIZADO
      index: true,
      trim: true,
    },
    proposal: {
      type: String,
      enum: VALID_PROPOSALS, // ATUALIZADO
      default: DEFAULT_PROPOSAL_ENUM, // ATUALIZADO
      index: true,
      trim: true,
    },
    context: {
      type: String,
      enum: VALID_CONTEXTS, // ATUALIZADO
      default: DEFAULT_CONTEXT_ENUM, // ATUALIZADO
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
      default: 'manual',
      index: true,
    },
    classificationStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
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
    stats: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

metricSchema.index({ user: 1, createdAt: -1 });
metricSchema.index({ user: 1, postDate: -1 });
metricSchema.index({ user: 1, format: 1, proposal: 1, context: 1, postDate: -1 }); // Índice atualizado com campos Enum
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });
metricSchema.index({ user: 1, type: 1, postDate: -1 });

metricSchema.index({ user: 1, format: 1, proposal: 1, context: 1, "stats.shares": -1, "stats.saved": -1 }, { name: "idx_enrichStats_sort" });
metricSchema.index({ user: 1, postDate: -1, "stats.shares": -1 }, { name: "idx_topBottom_shares" });
metricSchema.index({ user: 1, postDate: -1, "stats.video_duration_seconds": 1 }, { name: "idx_durationStats" });


const MetricModel = models.Metric
  ? (models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
