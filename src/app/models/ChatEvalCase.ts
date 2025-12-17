import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatEvalRubric {
  shouldResolve: boolean;
  shouldUseContext?: boolean;
  avoidHallucination?: boolean;
  beObjectiveScore?: number; // target 1-5
}

export interface IChatEvalCase extends Document {
  _id: Types.ObjectId;
  userPrompt: string;
  surveySnapshot?: Record<string, any> | null;
  contextNotes?: string | null;
  intentHint?: string | null;
  fallbackCategory?: string | null;
  category?: string | null;
  rubric: IChatEvalRubric;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const chatEvalCaseSchema = new Schema<IChatEvalCase>(
  {
    userPrompt: { type: String, required: true },
    surveySnapshot: { type: Schema.Types.Mixed, default: null },
    contextNotes: { type: String, default: null },
    intentHint: { type: String, default: null },
    fallbackCategory: { type: String, default: null },
    category: { type: String, default: null },
    rubric: {
      shouldResolve: { type: Boolean, required: true },
      shouldUseContext: { type: Boolean, default: false },
      avoidHallucination: { type: Boolean, default: true },
      beObjectiveScore: { type: Number, min: 1, max: 5, default: 4 },
    },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, collection: "chat_eval_cases" }
);

chatEvalCaseSchema.index({ category: 1, createdAt: -1 });
chatEvalCaseSchema.index({ intentHint: 1 });

const ChatEvalCaseModel: Model<IChatEvalCase> =
  mongoose.models.ChatEvalCase || mongoose.model<IChatEvalCase>("ChatEvalCase", chatEvalCaseSchema);

export default ChatEvalCaseModel;
