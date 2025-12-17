import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatEvalCaseResult {
  caseId: Types.ObjectId;
  variant: string;
  ragEnabled?: boolean | null;
  modelVersion?: string | null;
  response: string;
  intent?: string | null;
  fallbackReason?: string | null;
  llmLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  resolveScore?: number | null; // 1 if resolved, 0 if not
  usedContext?: boolean | null;
  hallucination?: boolean | null;
  objectiveScore?: number | null; // 1-5
}

export interface IChatEvalRun extends Document {
  _id: Types.ObjectId;
  name?: string | null;
  variantA: string;
  variantB?: string | null;
  ragEnabled?: boolean | null;
  modelVersion?: string | null;
  caseIds: Types.ObjectId[];
  results: IChatEvalCaseResult[];
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const chatEvalRunSchema = new Schema<IChatEvalRun>(
  {
    name: { type: String, default: null },
    variantA: { type: String, required: true },
    variantB: { type: String, default: null },
    ragEnabled: { type: Boolean, default: null },
    modelVersion: { type: String, default: null },
    caseIds: { type: [Schema.Types.ObjectId], ref: "ChatEvalCase", required: true },
    results: { type: [Schema.Types.Mixed as any], default: [] },
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: "chat_eval_runs" }
);

chatEvalRunSchema.index({ status: 1, createdAt: -1 });

const ChatEvalRunModel: Model<IChatEvalRun> =
  mongoose.models.ChatEvalRun || mongoose.model<IChatEvalRun>("ChatEvalRun", chatEvalRunSchema);

export default ChatEvalRunModel;
