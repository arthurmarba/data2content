import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface para o subdocumento 'stats' dentro de IStoryMetric.
 * ATENÇÃO: Esta estrutura foi COMPLETAMENTE REVISADA na v1.2 para refletir
 * as métricas recebidas via Webhook 'story_insights' da API v19.0+.
 */
interface IStoryStats {
  // --- Métricas Principais (Webhook) ---
  views?: number;                     // <<< NOVO (substitui impressions) >>> Visualizações do Story
  reach?: number;                     // Alcance do Story (mantido)
  replies?: number;                   // Respostas ao Story (mantido)
  shares?: number;                    // <<< NOVO >>> Compartilhamentos do Story
  total_interactions?: number;        // <<< NOVO >>> Soma das interações (definido pela API, ex: replies, shares, etc.)
  profile_visits?: number;            // <<< NOVO >>> Visitas ao perfil originadas deste Story
  follows?: number;                   // <<< NOVO >>> Novos seguidores originados deste Story

  // --- Métricas com Breakdown (Webhook) ---
  navigation?: { [story_navigation_action_type: string]: number }; // <<< NOVO >>> Ações de navegação (ex: taps_forward, taps_back, exits) - chave é 'story_navigation_action_type'
  profile_activity?: { [action_type: string]: number };          // <<< NOVO >>> Ações no perfil (ex: website_clicks) - chave é 'action_type'

  // --- Métricas Removidas (v1.2 - não vêm via webhook ou foram agrupadas) ---
  // impressions?: number; // Substituído por 'views'
  // tapsForward?: number; // Agrupado em 'navigation'
  // tapsBack?: number;    // Agrupado em 'navigation'
  // exits?: number;       // Agrupado em 'navigation'
  // storyPollVotes?: number; // Não disponível via webhook padrão 'story_insights'
  // storyStickerTaps?: { name: string; count: number }[]; // Não disponível via webhook padrão 'story_insights'

  // Permite outros campos caso a API adicione novas métricas no futuro
  [key: string]: unknown;
}

/**
 * Interface que define a estrutura de um documento StoryMetric.
 * ATUALIZADO v1.2: Reflete as métricas do Webhook 'story_insights' e remove 'fetchDate'.
 */
export interface IStoryMetric extends Document {
  user: Types.ObjectId;                   // Referência ao usuário
  instagramAccountId: string;             // ID da conta do Instagram
  instagramMediaId: string;               // ID único do Story na API
  mediaUrl?: string;                      // URL da mídia (opcional, pode não vir no webhook)
  mediaType?: 'IMAGE' | 'VIDEO';          // Tipo de mídia (opcional, pode não vir no webhook)
  timestamp: Date;                        // Data e hora de publicação do Story (vem do webhook ou fetch inicial)
  // fetchDate: Date;                     // <<< REMOVIDO v1.2 >>> Não relevante para webhooks
  stats: IStoryStats;                     // <<< USA A NOVA INTERFACE IStoryStats >>>
  createdAt: Date;                        // Data de criação do registro no DB
}

/**
 * Schema para o modelo StoryMetric.
 * ATUALIZADO v1.2: Reflete a estrutura IStoryStats e remove 'fetchDate'.
 */
const storyMetricSchema = new Schema<IStoryMetric>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, 'A referência ao usuário é obrigatória.'],
      index: true,
    },
    instagramAccountId: {
      type: String,
      required: [true, 'O ID da conta do Instagram é obrigatório.'],
      index: true,
    },
    instagramMediaId: {
      type: String,
      required: [true, 'O ID da mídia do Instagram (Story) é obrigatório.'],
      index: true,
    },
    mediaUrl: { type: String }, // Mantido como opcional
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'] }, // Mantido como opcional
    timestamp: { // Data de publicação do Story
      type: Date,
      required: [true, 'A data de publicação do Story (timestamp) é obrigatória.'],
      index: true,
    },
    // fetchDate: { type: Date }, // <<< REMOVIDO v1.2 >>>
    stats: { // Objeto com as métricas específicas do Story (Webhook)
      type: Schema.Types.Mixed, // Mixed para flexibilidade
      required: true,
      default: {},
      // Definir tipos aqui ajuda na clareza
      // <<< CAMPOS ATUALIZADOS v1.2 (Webhook) >>>
      views: { type: Number },
      reach: { type: Number },
      replies: { type: Number },
      shares: { type: Number },
      total_interactions: { type: Number },
      profile_visits: { type: Number },
      follows: { type: Number },
      navigation: { type: Schema.Types.Mixed },     // Objeto chave/valor
      profile_activity: { type: Schema.Types.Mixed }, // Objeto chave/valor
      // Campos removidos: impressions, tapsForward, tapsBack, exits, storyPollVotes, storyStickerTaps
      _id: false // Geralmente não precisamos de _id para o subdocumento stats
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
);

/**
 * Índices (Mantidos e ajustados)
 */
// Índice único para garantir que não haja duplicatas do mesmo story para o mesmo usuário
storyMetricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true });

// Índice para buscar stories de um usuário por data de publicação
storyMetricSchema.index({ user: 1, instagramAccountId: 1, timestamp: -1 });

// Índice por ID da mídia (pode ser útil para atualizações via webhook)
storyMetricSchema.index({ instagramMediaId: 1 });


const StoryMetricModel = models.StoryMetric
  ? (models.StoryMetric as Model<IStoryMetric>)
  : model<IStoryMetric>("StoryMetric", storyMetricSchema);

export default StoryMetricModel;
// Exporta a interface de stats para referência externa, se necessário
export type { IStoryStats };
