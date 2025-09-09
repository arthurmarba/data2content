// src/app/models/PlannerPlan.ts
import mongoose, { Schema, model, models, Types, Document } from 'mongoose';

export type PlannerStatus = 'planned' | 'drafted' | 'test' | 'posted';
export type PlannerFormat = 'reel' | 'photo' | 'carousel' | 'story' | 'live' | 'long_video';

export interface PlannerExpectedMetrics {
  viewsP50?: number;
  viewsP90?: number;
  sharesP50?: number;
}

export interface PlannerCategories {
  context?: string[];
  proposal?: string[];
  reference?: string[];
  tone?: string;
}

export interface PlannerSlot {
  slotId: string;
  dayOfWeek: number;       // 1..7 (ISO; 1=Seg)
  blockStartHour: number;  // ex: 9 | 12 | 15 | 18
  format: PlannerFormat;
  categories?: PlannerCategories;
  status: PlannerStatus;
  isExperiment?: boolean;
  expectedMetrics?: PlannerExpectedMetrics;
  recordingTimeSec?: number;
  aiVersionId?: string | null;
  title?: string;
  scriptShort?: string;
  notes?: string;
  themeKeyword?: string;   // 1 palavra (sanitizada no server)
}

export interface IPlannerPlan extends Document {
  userId: Types.ObjectId;
  platform: 'instagram';
  weekStart: Date;           // Monday 00:00 no fuso do planner (instante UTC)
  userTimeZone?: string;
  slots: PlannerSlot[];
  createdAt: Date;
  updatedAt: Date;
}

const CategoriesSchema = new Schema<PlannerCategories>(
  {
    context: [{ type: String }],
    proposal: [{ type: String }],
    reference: [{ type: String }],
    tone: { type: String },
  },
  { _id: false }
);

const ExpectedMetricsSchema = new Schema<PlannerExpectedMetrics>(
  {
    viewsP50: { type: Number, min: 0 },
    viewsP90: { type: Number, min: 0 },
    sharesP50: { type: Number, min: 0 },
  },
  { _id: false }
);

const SlotSchema = new Schema<PlannerSlot>(
  {
    slotId: { type: String, required: true },
    dayOfWeek: { type: Number, min: 1, max: 7, required: true },
    blockStartHour: { type: Number, min: 0, max: 23, required: true },
    format: {
      type: String,
      enum: ['reel', 'photo', 'carousel', 'story', 'live', 'long_video'],
      default: 'reel',
      required: true,
    },
    categories: { type: CategoriesSchema, default: undefined },
    status: {
      type: String,
      enum: ['planned', 'drafted', 'test', 'posted'],
      default: 'planned',
      required: true,
    },
    isExperiment: { type: Boolean, default: false },
    expectedMetrics: { type: ExpectedMetricsSchema, default: undefined },
    recordingTimeSec: { type: Number, min: 0 },
    aiVersionId: { type: String, default: null },
    title: { type: String },
    scriptShort: { type: String },
    notes: { type: String },
    themeKeyword: { type: String, trim: true },
  },
  { _id: false }
);

const PlannerPlanSchema = new Schema<IPlannerPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: ['instagram'], default: 'instagram', required: true },
    weekStart: { type: Date, required: true, index: true },
    userTimeZone: { type: String },
    slots: { type: [SlotSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'planner_plans',
  }
);

// Evita duplicidade de plano por usuário/plataforma/semana
PlannerPlanSchema.index(
  { userId: 1, platform: 1, weekStart: 1 },
  { unique: true, name: 'uniq_user_platform_week' }
);

const PlannerPlanModel =
  (models.PlannerPlan as mongoose.Model<IPlannerPlan>) ||
  model<IPlannerPlan>('PlannerPlan', PlannerPlanSchema);

export default PlannerPlanModel;
// exports nomeados para o loader dinâmico encontrar em qualquer cenário
export { PlannerPlanModel };
export { PlannerPlanModel as PlannerPlan };
