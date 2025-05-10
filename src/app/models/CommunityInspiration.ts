// @/app/models/CommunityInspiration.ts - v1.0.1 (Simplifica Preferência)
// - REMOVIDO: Campo 'anonymityLevel'. A atribuição será via link direto para o post.
// - Mantém estrutura da v1.0.0.

import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que define a estrutura de um documento CommunityInspiration.
 * ATUALIZADO v1.0.1: Removido 'anonymityLevel'.
 */
export interface ICommunityInspiration extends Document {
  _id: Types.ObjectId;
  postId_Instagram: string; // ID do post original do Instagram (media_id)
  originalInstagramPostUrl: string; // Link direto para o post no Instagram
  originalCreatorId: Types.ObjectId; // Referência ao IUser criador original
  
  proposal: string; // Proposta do conteúdo (ex: "educar audiência")
  context: string;  // Contexto do conteúdo (ex: "bastidores")
  format: string;   // Formato (ex: "Reel", "Carrossel")
  
  contentSummary: string; // Resumo gerado pela IA sobre os aspectos criativos/estratégicos
  performanceHighlights_Qualitative: string[]; // Destaques qualitativos (ex: ['alto_engajamento_nos_comentarios'])
  primaryObjectiveAchieved_Qualitative: string; // Principal objetivo qualitativo alcançado (ex: 'gerou_muitos_salvamentos')
  
  // anonymityLevel: 'credited' | 'anonymous_creator'; // <<< REMOVIDO >>>
  
  tags_IA?: string[]; // Tags adicionais geradas pela IA para busca e categorização
  
  addedToCommunityAt: Date; // Data de adição ao pool da comunidade
  status: 'active' | 'archived' | 'pending_review'; // Status do registro de inspiração

  // Opcional: Para lógica interna de ranqueamento da IA (NÃO EXPOSTO A OUTROS USUÁRIOS)
  internalMetricsSnapshot?: { 
    [key: string]: any; 
  };

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Definição do Schema para o CommunityInspiration.
 * ATUALIZADO v1.0.1: Removido 'anonymityLevel'.
 */
const communityInspirationSchema = new Schema<ICommunityInspiration>(
  {
    postId_Instagram: { type: String, required: true, index: true },
    originalInstagramPostUrl: { type: String, required: true },
    originalCreatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    
    proposal: { type: String, required: true, index: true, trim: true },
    context: { type: String, required: true, index: true, trim: true },
    format: { type: String, required: true, index: true, trim: true },
    
    contentSummary: { type: String, required: true },
    performanceHighlights_Qualitative: { type: [String], default: [], index: true },
    primaryObjectiveAchieved_Qualitative: { type: String, required: true, index: true },
    
    // anonymityLevel: { type: String, enum: ['credited', 'anonymous_creator'], required: true }, // <<< REMOVIDO >>>
    
    tags_IA: { type: [String], default: [], index: true },
    
    addedToCommunityAt: { type: Date, default: Date.now, index: true },
    status: { 
      type: String, 
      enum: ['active', 'archived', 'pending_review'], 
      default: 'active', 
      index: true 
    },

    internalMetricsSnapshot: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

// Índices adicionais para otimizar buscas comuns
communityInspirationSchema.index({ proposal: 1, context: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ format: 1, primaryObjectiveAchieved_Qualitative: 1, status: 1 });
communityInspirationSchema.index({ originalCreatorId: 1, status: 1 }); 


/**
 * Exporta o modelo 'CommunityInspiration', evitando recriação em dev/hot reload.
 */
const CommunityInspirationModel: Model<ICommunityInspiration> = 
  models.CommunityInspiration || model<ICommunityInspiration>("CommunityInspiration", communityInspirationSchema);

export default CommunityInspirationModel;
