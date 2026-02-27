import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type PlanningRecommendationFeedbackStatus = "applied" | "not_applied";
export type PlanningRecommendationConfidence = "high" | "medium" | "low";

export interface IPlanningRecommendationFeedback extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  objectiveMode: "reach" | "engagement" | "leads";
  timePeriod: string;
  actionId: string;
  actionBaseId?: string | null;
  actionVariant?: string | null;
  status: PlanningRecommendationFeedbackStatus;
  actionTitle?: string | null;
  confidence?: PlanningRecommendationConfidence | null;
  opportunityScore?: number | null;
  sampleSize?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const planningRecommendationFeedbackSchema = new Schema<IPlanningRecommendationFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    objectiveMode: {
      type: String,
      enum: ["reach", "engagement", "leads"],
      required: true,
      index: true,
    },
    timePeriod: { type: String, required: true, index: true },
    actionId: { type: String, required: true, trim: true },
    actionBaseId: { type: String, default: null, trim: true },
    actionVariant: { type: String, default: null, trim: true },
    status: { type: String, enum: ["applied", "not_applied"], required: true },
    actionTitle: { type: String, default: null, trim: true },
    confidence: { type: String, enum: ["high", "medium", "low"], default: null },
    opportunityScore: { type: Number, default: null },
    sampleSize: { type: Number, default: null },
  },
  {
    timestamps: true,
    collection: "planning_recommendation_feedback",
  }
);

planningRecommendationFeedbackSchema.index(
  { userId: 1, objectiveMode: 1, timePeriod: 1, actionId: 1 },
  { unique: true, name: "uniq_user_objective_period_action" }
);
planningRecommendationFeedbackSchema.index({ userId: 1, updatedAt: -1 });

const PlanningRecommendationFeedbackModel: Model<IPlanningRecommendationFeedback> =
  mongoose.models.PlanningRecommendationFeedback ||
  mongoose.model<IPlanningRecommendationFeedback>(
    "PlanningRecommendationFeedback",
    planningRecommendationFeedbackSchema
  );

export default PlanningRecommendationFeedbackModel;
