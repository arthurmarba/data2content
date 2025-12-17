import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatSessionFeedback extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  csat: number;
  comment?: string | null;
  reasons?: string[] | null;
  createdAt: Date;
}

const chatSessionFeedbackSchema = new Schema<IChatSessionFeedback>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    csat: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: null },
    reasons: { type: [String], default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "chat_session_feedback" }
);

chatSessionFeedbackSchema.index({ csat: 1, createdAt: -1 });
chatSessionFeedbackSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
chatSessionFeedbackSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const ChatSessionFeedbackModel: Model<IChatSessionFeedback> =
  mongoose.models.ChatSessionFeedback ||
  mongoose.model<IChatSessionFeedback>("ChatSessionFeedback", chatSessionFeedbackSchema);

export default ChatSessionFeedbackModel;
