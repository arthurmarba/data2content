import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatSessionReview extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  reviewerId?: Types.ObjectId | null;
  reviewedBy?: Types.ObjectId | null; // alias for reviewerId
  category?: string | null;
  severity?: number | null;
  status: "new" | "reviewed" | "fixed" | "ignored";
  note?: string | null;
  suggestedAction?: string | null;
  ticketUrl?: string | null;
  fixedAt?: Date | null;
  isAuto?: boolean | null;
  autoReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionReviewSchema = new Schema<IChatSessionReview>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, unique: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    category: { type: String, default: null },
    severity: { type: Number, min: 1, max: 3, default: null },
    status: { type: String, enum: ["new", "reviewed", "fixed", "ignored"], default: "new" },
    note: { type: String, default: null },
    suggestedAction: { type: String, default: null },
    ticketUrl: { type: String, default: null },
    fixedAt: { type: Date, default: null },
    isAuto: { type: Boolean, default: false },
    autoReason: { type: String, default: null },
  },
  { timestamps: true, collection: "chat_session_reviews" }
);

chatSessionReviewSchema.index({ status: 1, updatedAt: -1 });

const ChatSessionReviewModel: Model<IChatSessionReview> =
  mongoose.models.ChatSessionReview || mongoose.model<IChatSessionReview>("ChatSessionReview", chatSessionReviewSchema);

export default ChatSessionReviewModel;
