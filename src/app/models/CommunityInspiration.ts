// @/app/models/CommunityInspiration.ts - v1.1.1 (Adiciona índice composto para otimizar busca de inspirações)
// - ADICIONADO: Índice composto em status, addedToCommunityAt e internalMetricsSnapshot.saveRate.
// - Baseado na v1.1.0 (Enums, Índice Único em postId_Instagram, Sub-schema para Métricas Internas).

import { Schema, model, models, Document, Model, Types } from "mongoose";
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    VALID_QUALITATIVE_OBJECTIVES,
    VALID_PERFORMANCE_HIGHLIGHTS,
    VALID_TONES,
    VALID_REFERENCES,
    FormatType,
    ProposalType,
    ContextType,
    ToneType,
    ReferenceType,
    QualitativeObjectiveType,
    PerformanceHighlightType,
    DEFAULT_TONE_ENUM,
    DEFAULT_REFERENCE_ENUM
} from "@/app/lib/constants/communityInspirations.constants";

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
 * ATUALIZADO v1.1.0 (e mantido na v1.1.1)
 */
export interface ICommunityInspiration extends Document {
  _id: Types.ObjectId;
  postId_Instagram: string;
  originalInstagramPostUrl: string;
  originalCreatorId: Types.ObjectId; 
  
  proposal: ProposalType; 
  context: ContextType;
  format: FormatType;
  tone?: ToneType;
  reference?: ReferenceType;
  
  contentSummary: string;
  performanceHighlights_Qualitative: PerformanceHighlightType[]; 
  primaryObjectiveAchieved_Qualitative: QualitativeObjectiveType; 
  
  tags_IA?: string[];
  
  addedToCommunityAt: Date;
  status: 'active' | 'archived' | 'pending_review';

  internalMetricsSnapshot?: IInternalMetricsSnapshot; 

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Schema Mongoose para o subdocumento de métricas internas.
 */
const internalMetricsSubSchema = new Schema<IInternalMetricsSnapshot>({
  reachToFollowersRatio: { type: Number },
  saveRate: { type: Number, index: true }, // Indexado se for usado para ordenação frequentemente
  shareRate: { type: Number },
  reelAvgWatchTimeSec: { type: Number },
}, { _id: false });

/**
 * Definição do Schema para o CommunityInspiration.
 * ATUALIZADO v1.1.1: Adicionado novo índice composto.
 */
const communityInspirationSchema = new Schema<ICommunityInspiration>(
  {
    postId_Instagram: { type: String, required: true, index: true },
    originalInstagramPostUrl: { type: String, required: true },
    originalCreatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    
    proposal: { type: String, required: true, enum: VALID_PROPOSALS, index: true, trim: true },
    context: { type: String, required: true, enum: VALID_CONTEXTS, index: true, trim: true },
    format: { type: String, required: true, enum: VALID_FORMATS, index: true, trim: true },
    tone: { type: String, enum: VALID_TONES, index: true, trim: true, default: DEFAULT_TONE_ENUM },
    reference: { type: String, enum: VALID_REFERENCES, index: true, trim: true, default: DEFAULT_REFERENCE_ENUM },
    
    contentSummary: { type: String, required: true },
    performanceHighlights_Qualitative: { type: [String], default: [], enum: VALID_PERFORMANCE_HIGHLIGHTS, index: true },
    primaryObjectiveAchieved_Qualitative: { type: String, required: true, enum: VALID_QUALITATIVE_OBJECTIVES, index: true },
        
    tags_IA: { type: [String], default: [], index: true },
    
    addedToCommunityAt: { type: Date, default: Date.now, index: true },
    status: { 
      type: String, 
      enum: ['active', 'archived', 'pending_review'], 
      default: 'active', 
      index: true 
    },

    internalMetricsSnapshot: { type: internalMetricsSubSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

// Índice único para postId_Instagram (mantido da v1.1.0)
communityInspirationSchema.index({ postId_Instagram: 1 }, { unique: true });

// Índices adicionais para otimizar buscas comuns (mantidos da v1.1.0)
communityInspirationSchema.index({ proposal: 1, context: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ format: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ tone: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ reference: 1, status: 1 });
communityInspirationSchema.index({ originalCreatorId: 1, status: 1 });

// NOVO ÍNDICE para otimizar a query principal em communityService.getInspirations (v1.1.1)
// Suporta filtro por status: 'active' e ordenação por addedToCommunityAt e internalMetricsSnapshot.saveRate
communityInspirationSchema.index({ status: 1, addedToCommunityAt: -1, "internalMetricsSnapshot.saveRate": -1 }); 

/**
 * Exporta o modelo 'CommunityInspiration', evitando recriação em dev/hot reload.
 */
const CommunityInspirationModel: Model<ICommunityInspiration> = 
  models.CommunityInspiration || model<ICommunityInspiration>("CommunityInspiration", communityInspirationSchema);

export default CommunityInspirationModel;
