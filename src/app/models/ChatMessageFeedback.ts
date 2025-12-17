import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatMessageFeedback extends Document {
  _id: Types.ObjectId;
  sessionId?: Types.ObjectId | null;
  messageId?: string | null;
  rating: "up" | "down";
  reason?: string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  userId?: Types.ObjectId | null;
  createdAt: Date;
}

const chatMessageFeedbackSchema = new Schema<IChatMessageFeedback>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession", default: null, index: true },
    messageId: { type: String, index: true, default: null },
    rating: { type: String, enum: ["up", "down"], required: true },
    reason: { type: String, default: null },
    reasonCode: { type: String, default: null },
    reasonDetail: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "chat_message_feedback" }
);

chatMessageFeedbackSchema.index({ rating: 1, createdAt: -1 });
chatMessageFeedbackSchema.index({ messageId: 1, userId: 1 }, { unique: true, partialFilterExpression: { messageId: { $type: "string" } } });
chatMessageFeedbackSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const ChatMessageFeedbackModel: Model<IChatMessageFeedback> =
  mongoose.models.ChatMessageFeedback ||
  mongoose.model<IChatMessageFeedback>("ChatMessageFeedback", chatMessageFeedbackSchema);

export default ChatMessageFeedbackModel;
