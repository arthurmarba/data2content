import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { PlannerPlatform, PlannerFormat } from '@/types/planner';

export interface IAIGeneratedPost extends Document {
  userId: Types.ObjectId;
  platform: PlannerPlatform; // 'instagram'
  // Ligações opcionais para rastrear origem
  planId?: Types.ObjectId | null;
  slotId?: string | null; // corresponde a slots[].slotId

  // Conteúdo gerado
  title: string;
  script: string;
  hashtags?: string[];
  tone?: string;
  format?: PlannerFormat;

  // Contexto de geração (flexível para evolução do prompt)
  promptContext?: Record<string, any>;
  strategy?: string; // ex.: 'more_humor' | 'focus_shares' | 'shorter'

  createdAt?: Date;
  updatedAt?: Date;
}

const AIGeneratedPostSchema = new Schema<IAIGeneratedPost>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  platform: { type: String, enum: ['instagram'], default: 'instagram', index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'PlannerPlan', default: null, index: true },
  slotId: { type: String, default: null, index: true },

  title: { type: String, required: true },
  script: { type: String, required: true },
  hashtags: { type: [String], default: [] },
  tone: { type: String, default: undefined },
  format: { type: String, enum: ['reel','photo','carousel','story','live','long_video'], default: undefined },

  promptContext: { type: Schema.Types.Mixed, default: undefined },
  strategy: { type: String, default: undefined },
}, { timestamps: true });

const AIGeneratedPostModel: Model<IAIGeneratedPost> = mongoose.models.AIGeneratedPost || mongoose.model<IAIGeneratedPost>('AIGeneratedPost', AIGeneratedPostSchema);

if (!mongoose.models.AIGeneratedPost) {
  AIGeneratedPostModel.createIndexes().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[AIGeneratedPost] Erro ao criar índices:', err);
  });
}

export default AIGeneratedPostModel;

