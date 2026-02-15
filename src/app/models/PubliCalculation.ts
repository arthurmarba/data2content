// src/app/models/PubliCalculation.ts

import mongoose, { Schema, Types, Document, models, model } from 'mongoose';

export interface IPubliCalculationMetrics {
  reach?: number;
  engagement?: number;
  profileSegment?: string;
}

export interface IPubliCalculationFormatQuantities {
  reels?: number;
  post?: number;
  stories?: number;
}

export interface IPubliCalculationEventDetails {
  durationHours?: number;
  travelTier?: 'local' | 'nacional' | 'internacional' | string;
  hotelNights?: number;
}

export interface IPubliCalculationParams {
  format: string;
  deliveryType?: 'conteudo' | 'evento' | string;
  formatQuantities?: IPubliCalculationFormatQuantities;
  eventDetails?: IPubliCalculationEventDetails;
  eventCoverageQuantities?: IPubliCalculationFormatQuantities;
  exclusivity: string;
  usageRights: string;
  paidMediaDuration?: string | null;
  repostTikTok?: boolean;
  instagramCollab?: boolean;
  brandSize?: 'pequena' | 'media' | 'grande' | string;
  imageRisk?: 'baixo' | 'medio' | 'alto' | string;
  strategicGain?: 'baixo' | 'medio' | 'alto' | string;
  contentModel?: 'publicidade_perfil' | 'ugc_whitelabel' | string;
  allowStrategicWaiver?: boolean;
  complexity: string;
  authority: string;
  seasonality?: string;
}

export interface IPubliCalculationResult {
  estrategico: number;
  justo: number;
  premium: number;
}

export interface IPubliCalculationBreakdown {
  contentUnits?: number;
  contentJusto?: number;
  eventPresenceJusto?: number;
  coverageUnits?: number;
  coverageJusto?: number;
  travelCost?: number;
  hotelCost?: number;
  logisticsSuggested?: number;
  logisticsIncludedInCache?: boolean;
}

export interface IPubliCalculationCalibration {
  enabled?: boolean;
  baseJusto?: number;
  factorRaw?: number;
  factorApplied?: number;
  guardrailApplied?: boolean;
  confidence?: number;
  confidenceBand?: 'alta' | 'media' | 'baixa' | string;
  segmentSampleSize?: number;
  creatorSampleSize?: number;
  windowDaysSegment?: number;
  windowDaysCreator?: number;
  lowConfidenceRangeExpanded?: boolean;
  linkQuality?: 'high' | 'mixed' | 'low' | string;
}

export interface IPubliCalculation extends Document {
  userId: Types.ObjectId;
  createdAt: Date;
  metrics: IPubliCalculationMetrics;
  params: IPubliCalculationParams;
  result: IPubliCalculationResult;
  breakdown?: IPubliCalculationBreakdown;
  calibration?: IPubliCalculationCalibration;
  cpmApplied: number;
  cpmSource?: 'seed' | 'dynamic';
  explanation?: string;
  avgTicket?: number;
  totalDeals?: number;
}

const quantitySchema = new Schema<IPubliCalculationFormatQuantities>(
  {
    reels: { type: Number },
    post: { type: Number },
    stories: { type: Number },
  },
  { _id: false }
);

const eventDetailsSchema = new Schema<IPubliCalculationEventDetails>(
  {
    durationHours: { type: Number },
    travelTier: { type: String, trim: true },
    hotelNights: { type: Number },
  },
  { _id: false }
);

const breakdownSchema = new Schema<IPubliCalculationBreakdown>(
  {
    contentUnits: { type: Number },
    contentJusto: { type: Number },
    eventPresenceJusto: { type: Number },
    coverageUnits: { type: Number },
    coverageJusto: { type: Number },
    travelCost: { type: Number },
    hotelCost: { type: Number },
    logisticsSuggested: { type: Number },
    logisticsIncludedInCache: { type: Boolean },
  },
  { _id: false }
);

const calibrationSchema = new Schema<IPubliCalculationCalibration>(
  {
    enabled: { type: Boolean, default: false },
    baseJusto: { type: Number },
    factorRaw: { type: Number },
    factorApplied: { type: Number },
    guardrailApplied: { type: Boolean, default: false },
    confidence: { type: Number },
    confidenceBand: { type: String, trim: true },
    segmentSampleSize: { type: Number },
    creatorSampleSize: { type: Number },
    windowDaysSegment: { type: Number },
    windowDaysCreator: { type: Number },
    lowConfidenceRangeExpanded: { type: Boolean, default: false },
    linkQuality: { type: String, trim: true },
  },
  { _id: false }
);

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
      deliveryType: { type: String, trim: true },
      formatQuantities: { type: quantitySchema },
      eventDetails: { type: eventDetailsSchema },
      eventCoverageQuantities: { type: quantitySchema },
      exclusivity: { type: String, required: true, trim: true },
      usageRights: { type: String, required: true, trim: true },
      paidMediaDuration: { type: String, trim: true, default: null },
      repostTikTok: { type: Boolean, default: false },
      instagramCollab: { type: Boolean, default: false },
      brandSize: { type: String, trim: true, default: 'media' },
      imageRisk: { type: String, trim: true, default: 'medio' },
      strategicGain: { type: String, trim: true, default: 'baixo' },
      contentModel: { type: String, trim: true, default: 'publicidade_perfil' },
      allowStrategicWaiver: { type: Boolean, default: false },
      complexity: { type: String, required: true, trim: true },
      authority: { type: String, required: true, trim: true },
      seasonality: { type: String, trim: true },
    },
    result: {
      estrategico: { type: Number, required: true },
      justo: { type: Number, required: true },
      premium: { type: Number, required: true },
    },
    breakdown: {
      type: breakdownSchema,
    },
    calibration: {
      type: calibrationSchema,
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
