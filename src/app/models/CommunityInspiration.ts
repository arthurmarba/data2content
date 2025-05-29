// @/app/models/CommunityInspiration.ts - v1.1.0 (Adiciona Enums, Índice Único e Sub-schema para Métricas Internas)
// - ATUALIZADO: Campos categóricos (proposal, context, format, etc.) usam Enums.
// - ADICIONADO: Índice único em postId_Instagram.
// - ATUALIZADO: internalMetricsSnapshot usa um sub-schema definido.
// - Baseado na v1.0.1.

import { Schema, model, models, Document, Model, Types } from "mongoose";
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    VALID_QUALITATIVE_OBJECTIVES,
    VALID_PERFORMANCE_HIGHLIGHTS,
    FormatType,
    ProposalType,
    ContextType,
    QualitativeObjectiveType,
    PerformanceHighlightType
} from "@/app/lib/constants/communityInspirations.constants"; // Importando os novos enums/constantes

/**
 * Interface para o subdocumento de métricas internas.
 */
export interface IInternalMetricsSnapshot {
  reachToFollowersRatio?: number;
  saveRate?: number;
  shareRate?: number;
  reelAvgWatchTimeSec?: number;
  // Adicione outros campos de métricas internas conforme necessário
}

/**
 * Interface que define a estrutura de um documento CommunityInspiration.
 * ATUALIZADO v1.1.0
 */
export interface ICommunityInspiration extends Document {
  _id: Types.ObjectId;
  postId_Instagram: string;
  originalInstagramPostUrl: string;
  originalCreatorId: Types.ObjectId; // Referência ao IUser criador original
  
  proposal: ProposalType; // ATUALIZADO PARA USAR ENUM TYPE
  context: ContextType;   // ATUALIZADO PARA USAR ENUM TYPE
  format: FormatType;     // ATUALIZADO PARA USAR ENUM TYPE
  
  contentSummary: string;
  performanceHighlights_Qualitative: PerformanceHighlightType[]; // ATUALIZADO PARA USAR ENUM TYPE
  primaryObjectiveAchieved_Qualitative: QualitativeObjectiveType; // ATUALIZADO PARA USAR ENUM TYPE
  
  tags_IA?: string[];
  
  addedToCommunityAt: Date;
  status: 'active' | 'archived' | 'pending_review';

  internalMetricsSnapshot?: IInternalMetricsSnapshot; // ATUALIZADO PARA USAR SUB-INTERFACE

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Schema Mongoose para o subdocumento de métricas internas.
 */
const internalMetricsSubSchema = new Schema<IInternalMetricsSnapshot>({
  reachToFollowersRatio: { type: Number },
  saveRate: { type: Number },
  shareRate: { type: Number },
  reelAvgWatchTimeSec: { type: Number },
}, { _id: false });

/**
 * Definição do Schema para o CommunityInspiration.
 * ATUALIZADO v1.1.0
 */
const communityInspirationSchema = new Schema<ICommunityInspiration>(
  {
    postId_Instagram: { type: String, required: true, index: true /* unique será adicionado abaixo */ },
    originalInstagramPostUrl: { type: String, required: true },
    originalCreatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    
    proposal: { type: String, required: true, enum: VALID_PROPOSALS, index: true, trim: true },
    context: { type: String, required: true, enum: VALID_CONTEXTS, index: true, trim: true },
    format: { type: String, required: true, enum: VALID_FORMATS, index: true, trim: true },
    
    contentSummary: { type: String, required: true },
    performanceHighlights_Qualitative: { type: [String], default: [], enum: VALID_PERFORMANCE_HIGHLIGHTS, index: true },
    primaryObjectiveAchieved_Qualitative: { type: String, required: true, enum: VALID_QUALITATIVE_OBJECTIVES, index: true },
        
    tags_IA: { type: [String], default: [], index: true },
    
    addedToCommunityAt: { type: Date, default: Date.now, index: true },
    status: { 
      type: String, 
      enum: ['active', 'archived', 'pending_review'], 
      default: 'active', // Manteremos 'active' por enquanto, conforme plano
      index: true 
    },

    internalMetricsSnapshot: { type: internalMetricsSubSchema, default: () => ({}) }, // ATUALIZADO
  },
  {
    timestamps: true,
  }
);

// Índice único para postId_Instagram
communityInspirationSchema.index({ postId_Instagram: 1 }, { unique: true });

// Índices adicionais para otimizar buscas comuns (mantidos)
communityInspirationSchema.index({ proposal: 1, context: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ format: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ originalCreatorId: 1, status: 1 }); 


/**
 * Exporta o modelo 'CommunityInspiration', evitando recriação em dev/hot reload.
 */
const CommunityInspirationModel: Model<ICommunityInspiration> = 
  models.CommunityInspiration || model<ICommunityInspiration>("CommunityInspiration", communityInspirationSchema);

export default CommunityInspirationModel;
