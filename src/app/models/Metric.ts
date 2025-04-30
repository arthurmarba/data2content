import { Schema, model, models, Document, Model, Types } from "mongoose";

// Constantes padrão
const DEFAULT_FORMAT = 'Desconhecido';
const DEFAULT_SOURCE = 'manual';

/**
 * Interface para o subdocumento 'stats' dentro de IMetric.
 * ATENÇÃO: Esta estrutura foi ATUALIZADA na v1.2 para refletir as métricas da API v19.0+.
 * Inclui métricas da API e permite flexibilidade para dados manuais/Document AI.
 */
interface IMetricStats {
  // --- Métricas da API Instagram v19.0+ (Opcionais) ---
  views?: number;                     // Visualizações (substitui impressions/video_views)
  reach?: number;                     // Alcance
  likes?: number;                     // Curtidas
  comments?: number;                  // Comentários
  saved?: number;                     // Posts salvos
  shares?: number;                    // Compartilhamentos (posts/reels)
  total_interactions?: number;        // Soma de interações principais (API)
  profile_visits?: number;            // Visitas ao perfil via mídia
  follows?: number;                   // Novos seguidores via mídia

  // Métricas Específicas de Reels (API)
  ig_reels_avg_watch_time?: number;   // Tempo médio de visualização (Reels)
  ig_reels_video_view_total_time?: number; // Tempo total de visualização (Reels)

  // Métricas com Breakdown (API)
  profile_activity?: { [action_type: string]: number }; // Ações no perfil (ex: website_clicks)

  // --- Campos Mantidos da v4.0 (Podem ser usados por dados manuais/Document AI) ---
  impressions?: number;               // Mantido para compatibilidade ou dados manuais
  video_views?: number;               // Mantido para compatibilidade ou dados manuais
  engagement?: number;                // Mantido para compatibilidade ou dados manuais

  // Permite outros campos não definidos explicitamente (para flexibilidade com Document AI)
  [key: string]: unknown;
}

/**
 * Interface que define a estrutura de um documento Metric.
 * ATUALIZADO v1.2: Usa a nova interface IMetricStats.
 */
export interface IMetric extends Document {
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;
  // --- CAMPOS DE CLASSIFICAÇÃO (Mantidos) ---
  format?: string;
  proposal?: string;
  context?: string;
  // --- FIM CAMPOS DE CLASSIFICAÇÃO ---

  // --- CAMPOS PARA API INSTAGRAM / FONTE (Mantidos) ---
  instagramMediaId?: string;          // ID da API (opcional, usado para source: 'api')
  source: 'manual' | 'api';           // Origem dos dados
  // --- FIM CAMPOS API / FONTE ---

  rawData: unknown[];                 // Mantido para dados manuais ou debug
  stats: IMetricStats;                // <<< USA A INTERFACE ATUALIZADA >>>
  createdAt: Date;
}

/**
 * Schema para o modelo Metric.
 * ATUALIZADO v1.2: Reflete a estrutura IMetricStats no subdocumento 'stats'.
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
    // --- CAMPOS DE CLASSIFICAÇÃO (Mantidos) ---
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
    // --- FIM CAMPOS DE CLASSIFICAÇÃO ---

    // --- CAMPOS PARA API INSTAGRAM / FONTE (Mantidos) ---
    instagramMediaId: {
      type: String,
      index: true,
      sparse: true, // Crucial para o índice único não afetar dados manuais
      default: null,
    },
    source: {
      type: String,
      enum: ['manual', 'api'],
      required: [true, 'A fonte do dado (source) é obrigatória.'],
      default: DEFAULT_SOURCE,
      index: true,
    },
    // --- FIM CAMPOS API / FONTE ---

    rawData: { // Mantido
      type: Array,
      default: [],
    },
    stats: { // Schema para stats
      type: Schema.Types.Mixed, // Mantém Mixed para flexibilidade máxima com dados manuais/Document AI
      default: {},
      // Define explicitamente os tipos APENAS para os campos da API v19.0+ para clareza
      // Não removemos os antigos daqui para não quebrar dados existentes,
      // mas a interface IMetricStats é a referência principal para novos dados da API.
      // <<< CAMPOS DA API v19.0+ >>>
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
      profile_activity: { type: Schema.Types.Mixed }, // Objeto chave/valor
      // Campos antigos (impressions, video_views, engagement) não são explicitamente removidos
      // do schema Mixed, mas não serão o foco do mapeamento da API v19.0+.
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
);

/**
 * Índices (Mantidos)
 */
metricSchema.index({ user: 1, createdAt: -1 });
metricSchema.index({ user: 1, postDate: -1 });
metricSchema.index({ user: 1, format: 1, proposal: 1, context: 1, postDate: -1 });
// Índice único para API (Mantido com sparse: true)
metricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true, sparse: true });


const MetricModel = models.Metric
  ? (models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
// Exporta a interface de stats para referência externa, se necessário
export type { IMetricStats };
