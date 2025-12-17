import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatSession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  threadId?: Types.ObjectId | null;
  sourcePage?: string | null;
  model?: string | null;
  userSurveySnapshot?: Record<string, any> | null;
  surveySchemaVersion?: string | null;
  promptVariant?: string | null;
  experimentId?: string | null;
  modelVersion?: string | null;
  ragEnabled?: boolean | null;
  contextSourcesUsed?: string[] | null;
  csatPromptedAt?: Date | null;
  csatSubmitted?: boolean | null;
  metadata?: Record<string, any> | null;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date | null;
  endReason?: "user_closed" | "inactive_timeout" | "new_session_started" | "error" | "user_feedback" | "csat_submitted" | null;
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    threadId: { type: Schema.Types.ObjectId, ref: "Thread", index: true, default: null },
    sourcePage: { type: String, default: null },
    model: { type: String, default: null },
    userSurveySnapshot: { type: Schema.Types.Mixed, default: null },
    surveySchemaVersion: { type: String, default: null },
    promptVariant: { type: String, default: null },
    experimentId: { type: String, default: null },
    modelVersion: { type: String, default: null },
    ragEnabled: { type: Boolean, default: null },
    contextSourcesUsed: { type: [String], default: null },
    csatPromptedAt: { type: Date, default: null },
    csatSubmitted: { type: Boolean, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    startedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endReason: { type: String, default: null },
  },
  { timestamps: true, collection: "chat_sessions" }
);

chatSessionSchema.index({ userId: 1, startedAt: -1 });
chatSessionSchema.index({ threadId: 1 });
chatSessionSchema.index({ endedAt: 1 });
chatSessionSchema.index({ lastActivityAt: -1 });
// Retenção simples: 180 dias
chatSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const ChatSessionModel: Model<IChatSession> =
  mongoose.models.ChatSession || mongoose.model<IChatSession>("ChatSession", chatSessionSchema);

export default ChatSessionModel;
