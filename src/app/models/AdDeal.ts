// src/app/models/AdDeal.ts

import mongoose, { Schema, model, models, Document, Types } from 'mongoose';

// Interface para tipagem do documento AdDeal
export interface IAdDeal extends Document {
  userId: Types.ObjectId; // Ligação ao criador
  brandName: string; // Nome da marca/anunciante
  brandSegment?: string; // Segmento/Indústria da marca
  dealDate: Date; // Data em que a parceria foi fechada
  campaignStartDate?: Date; // Opcional - Início da campanha/publicação
  campaignEndDate?: Date; // Opcional - Fim da campanha/publicação
  deliverables: string[]; // Array com a descrição das entregas
  platform?: 'Instagram' | 'TikTok' | 'YouTube' | 'Blog' | 'Outro' | 'Múltiplas'; // Plataforma principal
  compensationType: 'Valor Fixo' | 'Comissão' | 'Permuta' | 'Misto'; // Tipo de compensação
  compensationValue?: number; // Opcional - Valor monetário recebido (em BRL por defeito)
  compensationCurrency?: string; // Moeda do pagamento
  productValue?: number; // Opcional - Valor estimado dos produtos em permuta
  notes?: string; // Opcional - Notas adicionais
  relatedPostId?: Types.ObjectId; // Opcional - Ligação ao post específico (Metric)
  createdAt?: Date; // Gerido por timestamps
  updatedAt?: Date; // Gerido por timestamps
}

// Schema Mongoose para AdDeal
const AdDealSchema = new Schema<IAdDeal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Referencia o modelo User
      required: [true, 'O ID do usuário é obrigatório.'],
      index: true, // Index para otimizar buscas por usuário
    },
    brandName: {
      type: String,
      required: [true, 'O nome da marca é obrigatório.'],
      trim: true,
    },
    brandSegment: {
      type: String,
      trim: true,
      // Considerar adicionar um enum no futuro se quiser padronizar
    },
    dealDate: {
      type: Date,
      required: [true, 'A data do acordo é obrigatória.'],
      default: Date.now, // Define a data atual por defeito
    },
    campaignStartDate: {
      type: Date,
    },
    campaignEndDate: {
      type: Date,
    },
    deliverables: {
      type: [String], // Array de strings
      required: [true, 'Pelo menos uma entrega é obrigatória.'],
      validate: { // Garante que o array não está vazio
          validator: (v: string[]) => Array.isArray(v) && v.length > 0,
          message: 'A lista de entregas não pode estar vazia.'
      }
    },
    platform: {
      type: String,
      enum: ['Instagram', 'TikTok', 'YouTube', 'Blog', 'Outro', 'Múltiplas'],
      default: 'Instagram',
    },
    compensationType: {
      type: String,
      enum: ['Valor Fixo', 'Comissão', 'Permuta', 'Misto'],
      required: [true, 'O tipo de compensação é obrigatório.'],
    },
    compensationValue: {
      type: Number,
      min: [0, 'O valor da compensação não pode ser negativo.'],
      // Considerar validação para garantir que existe se compensationType for 'Valor Fixo' ou 'Misto'
    },
    compensationCurrency: {
      type: String,
      default: 'BRL',
      trim: true,
      uppercase: true, // Guarda em maiúsculas (ex: BRL, USD)
    },
    productValue: {
      type: Number,
      min: [0, 'O valor do produto não pode ser negativo.'],
       // Considerar validação para garantir que existe se compensationType for 'Permuta' ou 'Misto'
    },
    notes: {
      type: String,
      trim: true,
    },
    relatedPostId: {
      type: Schema.Types.ObjectId,
      ref: 'Metric', // Referencia o modelo Metric (onde estão os detalhes do post)
      required: false, // Opcional
      index: true, // Index se for fazer buscas por posts relacionados
    },
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

// Evita recompilar o modelo se ele já existir (comum em Next.js)
const AdDeal = (models.AdDeal || model<IAdDeal>('AdDeal', AdDealSchema)) as mongoose.Model<IAdDeal>;

export default AdDeal;
