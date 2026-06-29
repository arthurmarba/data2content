import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IGeminiUsageLog extends Document {
  _id: Types.ObjectId;
  tag: string;
  geminiModel: string;
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
  ts: Date;
}

const GeminiUsageLogSchema = new Schema<IGeminiUsageLog>(
  {
    tag: { type: String, required: true, index: true },
    geminiModel: { type: String, required: true },
    promptTokens: { type: Number, default: null },
    outputTokens: { type: Number, default: null },
    thoughtsTokens: { type: Number, default: null },
    cachedTokens: { type: Number, default: null },
    totalTokens: { type: Number, default: null },
    ts: { type: Date, required: true, default: Date.now },
  },
  { collection: "geminiusagelogs" }
);

// Índice composto para queries de agregação por tag + janela de tempo.
GeminiUsageLogSchema.index({ tag: 1, ts: -1 });

// TTL: expira docs após 90 dias para não acumular para sempre.
GeminiUsageLogSchema.index({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const GeminiUsageLogModel: Model<IGeminiUsageLog> =
  mongoose.models.GeminiUsageLog ||
  mongoose.model<IGeminiUsageLog>("GeminiUsageLog", GeminiUsageLogSchema);

export default GeminiUsageLogModel;
