import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatMessageLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  threadId?: Types.ObjectId | null;
  messageId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string | null;
  confidence?: number | null;
  latencyMs?: number | null;
  llmLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  tokensEstimatedIn?: number | null;
  tokensEstimatedOut?: number | null;
  tokensActualIn?: number | null;
  tokensActualOut?: number | null;
  hadFallback?: boolean | null;
  fallbackReason?: string | null;
  errorType?: string | null;
  httpStatus?: number | null;
  wasStreamed?: boolean | null;
  promptVariant?: string | null;
  experimentId?: string | null;
  modelVersion?: string | null;
  ragEnabled?: boolean | null;
  contextSourcesUsed?: string[] | null;
  createdAt: Date;
}

const chatMessageLogSchema = new Schema<IChatMessageLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
    threadId: { type: Schema.Types.ObjectId, ref: "Thread", default: null, index: true },
    messageId: { type: String, default: null, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    intent: { type: String, default: null },
    confidence: { type: Number, default: null },
    latencyMs: { type: Number, default: null },
    llmLatencyMs: { type: Number, default: null },
    totalLatencyMs: { type: Number, default: null },
    tokensEstimatedIn: { type: Number, default: null },
    tokensEstimatedOut: { type: Number, default: null },
    tokensActualIn: { type: Number, default: null },
    tokensActualOut: { type: Number, default: null },
    hadFallback: { type: Boolean, default: null },
    fallbackReason: { type: String, default: null },
    errorType: { type: String, default: null },
    httpStatus: { type: Number, default: null },
    wasStreamed: { type: Boolean, default: null },
    promptVariant: { type: String, default: null },
    experimentId: { type: String, default: null },
    modelVersion: { type: String, default: null },
    ragEnabled: { type: Boolean, default: null },
    contextSourcesUsed: { type: [String], default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "chat_message_logs" }
);

chatMessageLogSchema.index({ sessionId: 1, createdAt: -1 });
chatMessageLogSchema.index({ role: 1, createdAt: -1 });
chatMessageLogSchema.index({ messageId: 1 });
// Retenção: 180 dias
chatMessageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const ChatMessageLogModel: Model<IChatMessageLog> =
  mongoose.models.ChatMessageLog || mongoose.model<IChatMessageLog>("ChatMessageLog", chatMessageLogSchema);

export default ChatMessageLogModel;
