import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';

// Lightweight persisted cache for generated strategic reports (Phase 0)

export type StrategicReportStatus = 'building' | 'ready' | 'error';

export interface IStrategicReportDoc extends Document {
  user: Types.ObjectId;
  periodDays: number;
  version: string;
  status: StrategicReportStatus;
  errorMessage?: string | null;
  generatedAt: Date;
  expiresAt: Date; // used by TTL index
  requestedBy?: Types.ObjectId | null;
  report?: unknown; // StrategicReport payload; kept as unknown to avoid import cycles
  createdAt: Date;
  updatedAt: Date;
}

const strategicReportSchema = new Schema<IStrategicReportDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    periodDays: { type: Number, required: true, index: true },
    version: { type: String, required: true, index: true },
    status: { type: String, enum: ['building', 'ready', 'error'], required: true, default: 'building', index: true },
    errorMessage: { type: String, default: null },
    generatedAt: { type: Date, required: true, default: () => new Date(), index: true },
    expiresAt: { type: Date, required: true, index: true },
    report: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// TTL index (MongoDB will delete documents after expiresAt)
strategicReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Helper index to fetch latest ready report quickly
strategicReportSchema.index({ user: 1, periodDays: 1, version: 1, status: 1, generatedAt: -1 });

const StrategicReportModel: Model<IStrategicReportDoc> =
  (mongoose.models.StrategicReport as Model<IStrategicReportDoc>) ||
  model<IStrategicReportDoc>('StrategicReport', strategicReportSchema);

export default StrategicReportModel;
