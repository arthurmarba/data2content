import mongoose, { Schema, Types, type Model } from "mongoose";

/**
 * Uso diário do conector por pessoa: contagens, sem texto.
 *
 * Um documento por pessoa, dia e chat. Mede adesão (dias de uso, quem volta),
 * sessões e um tempo estimado. Guardado por 12 meses, como diz a política de
 * privacidade; a expiração é declarada uma vez só (ver a armadilha "Expiração
 * declarada não garante limpeza no MongoDB").
 */
export interface IMcpUsageDaily {
  userId: Types.ObjectId;
  /** Dia civil em America/Sao_Paulo, YYYY-MM-DD. */
  day: string;
  client: "chatgpt" | "claude";
  calls: number;
  errorCount: number;
  planGates: number;
  /** Conversas estimadas: chamadas separadas por mais de 30 minutos contam como nova sessão. */
  sessions: number;
  /** Soma dos intervalos entre chamadas da mesma sessão. Subestima o tempo real de conversa. */
  activeMs: number;
  tools: Record<string, number>;
  firstAt: Date;
  lastAt: Date;
  expiresAt: Date;
}

const McpUsageDailySchema = new Schema<IMcpUsageDaily>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    client: { type: String, enum: ["chatgpt", "claude"], required: true },
    calls: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    planGates: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    activeMs: { type: Number, default: 0 },
    tools: { type: Schema.Types.Mixed, default: {} },
    firstAt: { type: Date, required: true },
    lastAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "mcp_usage_daily", versionKey: false, minimize: false },
);

McpUsageDailySchema.index({ userId: 1, day: 1, client: 1 }, { unique: true, name: "mcp_usage_daily_user_day_client" });
McpUsageDailySchema.index({ day: 1 }, { name: "mcp_usage_daily_day" });
McpUsageDailySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "mcp_usage_daily_ttl" });

const McpUsageDailyModel: Model<IMcpUsageDaily> =
  (mongoose.models.McpUsageDaily as Model<IMcpUsageDaily> | undefined) ??
  mongoose.model<IMcpUsageDaily>("McpUsageDaily", McpUsageDailySchema);

export default McpUsageDailyModel;
