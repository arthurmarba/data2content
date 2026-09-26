import mongoose, { Schema, Types } from 'mongoose';

export interface IPlannerRecCache {
  userId: Types.ObjectId;
  platform: 'instagram';
  weekStart: Date;                 // Monday 00:00 no fuso do planner (instante UTC)
  recommendations: any[];          // payload já pronto para o frontend
  heatmap: any[];                  // payload do heatmap
  frozenAt: Date;                  // quando o snapshot foi gerado

  // 👇 novos campos de controle
  algoVersion?: string;            // ex.: 'v2-views'
  metricBase?: 'views' | 'interactions';
}

const DEFAULT_ALGO_VERSION = process.env.PLANNER_ALGO_VERSION || 'v2-views';

const PlannerRecCacheSchema = new Schema<IPlannerRecCache>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: ['instagram'], default: 'instagram', required: true },
    weekStart: { type: Date, required: true }, // chave da semana

    // Arrays livres: usar Mixed com default como função (evita array compartilhado)
    recommendations: { type: Schema.Types.Mixed, default: () => [] },
    heatmap: { type: Schema.Types.Mixed, default: () => [] },

    frozenAt: { type: Date, default: Date.now },

    // 👇 novos campos
    algoVersion: { type: String, default: DEFAULT_ALGO_VERSION },
    metricBase: { type: String, enum: ['views', 'interactions'], default: 'views' },
  },
  { timestamps: true }
);

// snapshot único por (userId, platform, weekStart)
PlannerRecCacheSchema.index({ userId: 1, platform: 1, weekStart: 1 }, { unique: true });

// Expira 30 dias depois do último congelamento. Era opcional por variável que nunca foi
// definida, e o banco acumulava semanas de 2025 (auditoria de 26/09/2026). O índice real
// foi criado com o mesmo nome e prazo; mudar o prazo aqui exige collMod no banco.
PlannerRecCacheSchema.index(
  { frozenAt: 1 },
  { name: 'frozenAt_ttl', expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export default (mongoose.models.PlannerRecCache as mongoose.Model<IPlannerRecCache>) ||
  mongoose.model<IPlannerRecCache>('PlannerRecCache', PlannerRecCacheSchema);
