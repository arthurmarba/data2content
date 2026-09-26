import mongoose, { Schema, Types, type Model } from "mongoose";

/**
 * Cada chamada ao conector, com os campos que a ferramenta recebeu.
 *
 * É o que dá para saber das perguntas: a conversa fica no ChatGPT/Claude; aqui
 * chega só o que o assistente mandou para a ferramenta (tema, pedido de
 * roteiro, ideia, período). Textos cortados em 500 caracteres. Apagado em 90
 * dias, como diz a política de privacidade.
 */
export interface IMcpToolCallLog {
  userId: Types.ObjectId;
  client: "chatgpt" | "claude";
  kind: "tool" | "prompt";
  name: string;
  at: Date;
  isError: boolean;
  errorCode: string | null;
  planGate: string | null;
  durationMs: number;
  accessLevel: "free" | "pro";
  args: Record<string, unknown>;
  expiresAt: Date;
}

const McpToolCallLogSchema = new Schema<IMcpToolCallLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    client: { type: String, enum: ["chatgpt", "claude"], required: true },
    kind: { type: String, enum: ["tool", "prompt"], required: true },
    name: { type: String, required: true, maxlength: 80 },
    at: { type: Date, required: true },
    isError: { type: Boolean, default: false },
    errorCode: { type: String, default: null, maxlength: 80 },
    planGate: { type: String, default: null, maxlength: 40 },
    durationMs: { type: Number, default: 0 },
    accessLevel: { type: String, enum: ["free", "pro"], required: true },
    args: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { collection: "mcp_tool_call_logs", versionKey: false, minimize: false },
);

McpToolCallLogSchema.index({ at: -1 }, { name: "mcp_tool_call_logs_at" });
McpToolCallLogSchema.index({ userId: 1, at: -1 }, { name: "mcp_tool_call_logs_user_at" });
McpToolCallLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "mcp_tool_call_logs_ttl" });

const McpToolCallLogModel: Model<IMcpToolCallLog> =
  (mongoose.models.McpToolCallLog as Model<IMcpToolCallLog> | undefined) ??
  mongoose.model<IMcpToolCallLog>("McpToolCallLog", McpToolCallLogSchema);

export default McpToolCallLogModel;
