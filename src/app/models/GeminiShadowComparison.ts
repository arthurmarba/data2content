import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Registro pareado de um teste de qualidade "shadow": a mesma entrada foi
 * enviada ao modelo primário (produção, que o usuário vê) e a um modelo
 * candidato (shadow). Guarda as duas saídas + tokens para comparação offline.
 *
 * Uso atual: validar se gemini-2.5-flash-lite mantém a qualidade da extração
 * visual do Instagram antes de migrar (Onda B do plano de custo).
 */
export interface IGeminiShadowComparison extends Document {
  _id: Types.ObjectId;
  tag: string;
  primaryModel: string;
  shadowModel: string;
  /** Saída JSON do modelo primário (o que foi de fato usado). */
  primaryOutput: unknown;
  /** Saída JSON do modelo shadow (só para comparação). */
  shadowOutput: unknown;
  primaryTokens: { prompt: number | null; output: number | null; thoughts: number | null } | null;
  shadowTokens: { prompt: number | null; output: number | null; thoughts: number | null } | null;
  /** Se o shadow falhou (parse/erro), guarda o motivo em vez da saída. */
  shadowError: string | null;
  /** Nº de itens de entrada (ex.: thumbnails analisadas) — contexto da amostra. */
  sampleSize: number | null;
  ts: Date;
}

const TokenSchema = new Schema(
  {
    prompt: { type: Number, default: null },
    output: { type: Number, default: null },
    thoughts: { type: Number, default: null },
  },
  { _id: false },
);

const GeminiShadowComparisonSchema = new Schema<IGeminiShadowComparison>(
  {
    tag: { type: String, required: true, index: true },
    primaryModel: { type: String, required: true },
    shadowModel: { type: String, required: true },
    primaryOutput: { type: Schema.Types.Mixed, default: null },
    shadowOutput: { type: Schema.Types.Mixed, default: null },
    primaryTokens: { type: TokenSchema, default: null },
    shadowTokens: { type: TokenSchema, default: null },
    shadowError: { type: String, default: null },
    sampleSize: { type: Number, default: null },
    ts: { type: Date, required: true, default: Date.now },
  },
  { collection: "geminishadowcomparisons" },
);

GeminiShadowComparisonSchema.index({ tag: 1, ts: -1 });
// TTL 60 dias — dado de experimento, não precisa persistir para sempre.
GeminiShadowComparisonSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

const GeminiShadowComparisonModel: Model<IGeminiShadowComparison> =
  mongoose.models.GeminiShadowComparison ||
  mongoose.model<IGeminiShadowComparison>("GeminiShadowComparison", GeminiShadowComparisonSchema);

export default GeminiShadowComparisonModel;
