// @/app/models/Metric.ts - v2.0
// OTIMIZAÇÃO: Modelo atualizado para suportar a nova estrutura de classificação de 5 dimensões.
// Os campos de classificação agora são arrays de strings para permitir múltiplos rótulos.
// Novos campos 'tone' e 'references' foram adicionados com indexação para otimizar consultas.

import { Schema, model, models, Document, Model, Types } from "mongoose";

// NOTA: As importações de constantes (VALID_FORMATS, etc.) foram removidas.
// A validação agora deve ser feita na camada de serviço, usando os dados
// do arquivo 'classification.ts' como única fonte da verdade. Isso torna o sistema mais coeso.

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

// ATUALIZADO: Interface IMetric com os novos campos e tipos de dados
export interface IMetric extends Document {
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;
  type: string; // Simplificado para string, a validação ocorre na lógica de negócio
  format: string[]; // Alterado para array de strings
  proposal: string[]; // Alterado para array de strings
  context: string[]; // Alterado para array de strings
  tone: string[]; // NOVO: Campo para Tom/Sentimento
  references: string[]; // NOVO: Campo para Referências
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

// ATUALIZADO: Schema do Mongoose alinhado com a nova interface
const metricSchema = new Schema<IMetric>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postLink: { type: String, default: "" },
    description: { type: String, default: "" },
    postDate: { type: Date, required: true, index: true },
    type: { type: String, default: DEFAULT_MEDIA_TYPE, index: true },
    format: { type: [String], default: [], index: true }, // Alterado para array
    proposal: { type: [String], default: [], index: true }, // Alterado para array
    context: { type: [String], default: [], index: true }, // Alterado para array
    tone: { type: [String], default: [], index: true }, // NOVO
    references: { type: [String], default: [], index: true }, // NOVO
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

// --- ESTRATÉGIA DE INDEXAÇÃO ATUALIZADA ---
// Mantém os índices essenciais e adiciona um novo índice composto abrangente.
metricSchema.index({ user: 1, postDate: -1 });
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });

// NOVO ÍNDICE COMPOSTO: Otimizado para consultas complexas de dashboard
// envolvendo todas as dimensões da classificação.
metricSchema.index({
  user: 1,
  format: 1,
  proposal: 1,
  context: 1,
  tone: 1,
  references: 1,
  postDate: -1
}, { name: "idx_full_classification_filter" });


// Índices para ordenações específicas podem ser mantidos se necessário
metricSchema.index({ user: 1, postDate: -1, "stats.shares": -1 }, { name: "idx_topBottom_shares" });


const MetricModel = models.Metric
  ? (models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
