// src/app/models/PubliCalculation.ts

import mongoose, { Schema, Types, Document, models, model } from 'mongoose';

export interface IPubliCalculationMetrics {
  reach?: number;
  engagement?: number;
  profileSegment?: string;
}

export interface IPubliCalculationParams {
  format: string;
  exclusivity: string;
  usageRights: string;
  complexity: string;
  authority: string;
}

export interface IPubliCalculationResult {
  estrategico: number;
  justo: number;
  premium: number;
}

export interface IPubliCalculation extends Document {
  userId: Types.ObjectId;
  createdAt: Date;
  metrics: IPubliCalculationMetrics;
  params: IPubliCalculationParams;
  result: IPubliCalculationResult;
  cpmApplied: number;
  cpmSource?: 'seed' | 'dynamic';
  explanation?: string;
  avgTicket?: number;
  totalDeals?: number;
}

const PubliCalculationSchema = new Schema<IPubliCalculation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    metrics: {
      reach: { type: Number },
      engagement: { type: Number },
      profileSegment: { type: String, trim: true },
    },
    params: {
      format: { type: String, required: true, trim: true },
      exclusivity: { type: String, required: true, trim: true },
      usageRights: { type: String, required: true, trim: true },
      complexity: { type: String, required: true, trim: true },
      authority: { type: String, required: true, trim: true },
    },
    result: {
      estrategico: { type: Number, required: true },
      justo: { type: Number, required: true },
      premium: { type: Number, required: true },
    },
    cpmApplied: {
      type: Number,
      required: true,
    },
    cpmSource: {
      type: String,
      enum: ['seed', 'dynamic'],
      default: undefined,
    },
    explanation: {
      type: String,
      trim: true,
    },
    avgTicket: {
      type: Number,
    },
    totalDeals: {
      type: Number,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

PubliCalculationSchema.index({ userId: 1, createdAt: -1 });

const PubliCalculation =
  (models.PubliCalculation as mongoose.Model<IPubliCalculation>) ||
  model<IPubliCalculation>('PubliCalculation', PubliCalculationSchema);

export default PubliCalculation;
