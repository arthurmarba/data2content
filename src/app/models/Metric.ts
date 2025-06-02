// @/app/models/Metric.ts - v1.5.2 (Expande IMetricStats para campos do Document AI)
// - ATUALIZADO: IMetricStats inclui campos mais explícitos para dados do Document AI.
// - Baseado na v1.5.1.
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
const DEFAULT_FORMAT_ENUM: FormatType = "Desconhecido"; 
const DEFAULT_PROPOSAL_ENUM: ProposalType = "Outro Propósito"; 
const DEFAULT_CONTEXT_ENUM: ContextType = "Geral"; 
const DEFAULT_MEDIA_TYPE = 'UNKNOWN';

/**
 * Interface para o subdocumento 'stats' dentro de IMetric.
 * ATUALIZADO v1.5.2
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
  ig_reels_avg_watch_time?: number; // API: Média de tempo de visualização de Reels
  ig_reels_video_view_total_time?: number; // API: Tempo total de visualização de Reels
  profile_activity?: { [action_type: string]: number };
  impressions?: number;
  video_views?: number; // Pode ser um alias mais antigo para 'views' ou específico de vídeos não-Reels
  engagement?: number; // Normalmente um total fornecido pela API
  video_duration_seconds?: number; // Duração do vídeo em segundos

  // Métricas Calculadas por formulas.ts
  total_interactions?: number; // Pode ser calculado ou vir da API (total_interactions_manual se for do DocAI)
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

  // === INÍCIO DAS MÉTRICAS ADICIONAIS (PRINCIPALMENTE DO DOCUMENT AI) ===
  initial_plays?: number;                     // Mapeado de "reproduções iniciais"
  repeats?: number;                           // Mapeado de "repetições"
  reel_interactions?: number;                 // Mapeado de "interações do reel"
  engaged_accounts?: number;                  // Mapeado de "contas com engajamento"
  average_video_watch_time_seconds?: number;  // Mapeado de "tempo médio de visualização" (Document AI)
  total_watch_time_seconds?: number;          // Mapeado de "tempo de visualização" (Document AI)
  
  // Ratios que podem vir diretamente do Document AI como percentuais (convertidos para 0-1)
  // Ou podem ser calculados se os dados brutos de seguidores/não seguidores estiverem disponíveis.
  reach_followers_ratio?: number;             // Mapeado de "contas alcançadas de seguidores"
  reach_non_followers_ratio?: number;         // Mapeado de "contas alcançadas de não seguidores"

  // Valores manuais/totais do Document AI que podem ser distintos
  total_plays_manual?: number;                // Mapeado de "reproduções totais" (se diferente de views)
  total_interactions_manual?: number;         // Mapeado de "interações totais" (se diferente do calculado ou API)
  // === FIM DAS MÉTRICAS ADICIONAIS ===

  [key: string]: unknown; // Permite outros campos dinamicamente
}

/**
 * Interface que define a estrutura de um documento Metric.
 * ATUALIZADO v1.5.1 (já continha os campos de nível superior)
 */
export interface IMetric extends Document {
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
  stats: IMetricStats; // Agora referencia a IMetricStats expandida
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema para o modelo Metric.
 * ATUALIZADO v1.5.1 (já continha os campos de nível superior)
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
      enum: VALID_FORMATS, 
      default: DEFAULT_FORMAT_ENUM, 
      index: true,
      trim: true,
    },
    proposal: {
      type: String,
      enum: VALID_PROPOSALS, 
      default: DEFAULT_PROPOSAL_ENUM, 
      index: true,
      trim: true,
    },
    context: {
      type: String,
      enum: VALID_CONTEXTS, 
      default: DEFAULT_CONTEXT_ENUM, 
      index: true,
      trim: true,
    },
    theme: {
      type: String,
      trim: true,
      default: null,
    },
    collab: {
      type: Boolean,
      default: false,
    },
    collabCreator: {
      type: String,
      trim: true,
      default: null,
    },
    coverUrl: {
      type: String,
      trim: true,
      default: null,
    },
    instagramMediaId: {
      type: String,
      index: true,
      sparse: true,
      default: null,
    },
    source: {
      type: String,
      enum: ['manual', 'api', 'document_ai'], 
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
    stats: { // O schema Mongoose continua como Mixed, mas nossa interface IMetricStats é mais rica
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
