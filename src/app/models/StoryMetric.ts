// src/app/models/StoryMetric.ts - v1.2.1 (Exportação de IStoryStats Corrigida)
// - CORRIGIDO: A interface IStoryStats agora é exportada diretamente para permitir
//   a importação nomeada padrão em outros módulos.

import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface para o subdocumento 'stats' dentro de IStoryMetric.
 * ATENÇÃO: Esta estrutura foi COMPLETAMENTE REVISADA na v1.2 para refletir
 * as métricas recebidas via Webhook 'story_insights' da API v19.0+.
 * CORRIGIDO v1.2.1: Exportada diretamente.
 */
export interface IStoryStats { // <<< CORREÇÃO: Adicionado 'export' aqui
  // --- Métricas Principais (Webhook) ---
  views?: number;                     // Visualizações do Story
  reach?: number;                     // Alcance do Story
  replies?: number;                   // Respostas ao Story
  shares?: number;                    // Compartilhamentos do Story
  total_interactions?: number;        // Soma das interações
  profile_visits?: number;            // Visitas ao perfil originadas deste Story
  follows?: number;                   // Novos seguidores originados deste Story

  // --- Métricas com Breakdown (Webhook) ---
  navigation?: { [story_navigation_action_type: string]: number }; // Ações de navegação
  profile_activity?: { [action_type: string]: number };          // Ações no perfil

  // Permite outros campos caso a API adicione novas métricas no futuro
  [key: string]: unknown;
}

/**
 * Interface que define a estrutura de um documento StoryMetric.
 * ATUALIZADO v1.2: Reflete as métricas do Webhook 'story_insights' e remove 'fetchDate'.
 */
export interface IStoryMetric extends Document {
  user: Types.ObjectId;                   
  instagramAccountId: string;             
  instagramMediaId: string;               
  mediaUrl?: string;                      
  mediaType?: 'IMAGE' | 'VIDEO';          
  timestamp: Date;                        
  stats: IStoryStats;                     // Agora usa a IStoryStats exportada
  createdAt: Date;                        
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
    mediaUrl: { type: String }, 
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'] }, 
    timestamp: { 
      type: Date,
      required: [true, 'A data de publicação do Story (timestamp) é obrigatória.'],
      index: true,
    },
    stats: { 
      type: Schema.Types.Mixed, 
      required: true,
      default: {},
      views: { type: Number },
      reach: { type: Number },
      replies: { type: Number },
      shares: { type: Number },
      total_interactions: { type: Number },
      profile_visits: { type: Number },
      follows: { type: Number },
      navigation: { type: Schema.Types.Mixed },     
      profile_activity: { type: Schema.Types.Mixed }, 
      _id: false 
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
);

storyMetricSchema.index({ user: 1, instagramMediaId: 1 }, { unique: true });
storyMetricSchema.index({ user: 1, instagramAccountId: 1, timestamp: -1 });
storyMetricSchema.index({ instagramMediaId: 1 });

const StoryMetricModel = models.StoryMetric
  ? (models.StoryMetric as Model<IStoryMetric>)
  : model<IStoryMetric>("StoryMetric", storyMetricSchema);

export default StoryMetricModel;
// A linha 'export type { IStoryStats };' foi removida pois a interface já é exportada diretamente.
