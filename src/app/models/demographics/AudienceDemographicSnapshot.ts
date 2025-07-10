import mongoose, { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IDemographicBreakdown {
  value: string;
  count: number;
}

export interface IAudienceDemographics {
  follower_demographics?: {
    city?: Record<string, number>;
    country?: Record<string, number>;
    age?: Record<string, number>;
    gender?: Record<string, number>;
  };
  engaged_audience_demographics?: {
    city?: Record<string, number>;
    country?: Record<string, number>;
    age?: Record<string, number>;
    gender?: Record<string, number>;
  };
}

export interface IAudienceDemographicSnapshot extends Document {
  user: Types.ObjectId;
  instagramAccountId: string;
  recordedAt: Date;
  demographics: IAudienceDemographics;
}

// O schema agora espera um objeto de chave-valor, que é mais limpo
const audienceDemographicsSchema = new Schema<IAudienceDemographics>({
  follower_demographics: {
    city: { type: Schema.Types.Mixed, default: {} },
    country: { type: Schema.Types.Mixed, default: {} },
    age: { type: Schema.Types.Mixed, default: {} },
    gender: { type: Schema.Types.Mixed, default: {} },
  },
  engaged_audience_demographics: {
    city: { type: Schema.Types.Mixed, default: {} },
    country: { type: Schema.Types.Mixed, default: {} },
    age: { type: Schema.Types.Mixed, default: {} },
    gender: { type: Schema.Types.Mixed, default: {} },
  },
}, { _id: false });

const audienceDemographicSnapshotSchema = new Schema<IAudienceDemographicSnapshot>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  instagramAccountId: { type: String, required: true },
  recordedAt: { type: Date, required: true, default: Date.now },
  demographics: { type: audienceDemographicsSchema, required: true },
}, { timestamps: true, collection: 'audience_demographic_snapshots' });

audienceDemographicSnapshotSchema.index({ user: 1, recordedAt: -1 });
audienceDemographicSnapshotSchema.index({ instagramAccountId: 1 });

// ** CORREÇÃO PRINCIPAL APLICADA AQUI **
const AudienceDemographicSnapshotModel = mongoose.models.AudienceDemographicSnapshot
  ? (mongoose.models.AudienceDemographicSnapshot as Model<IAudienceDemographicSnapshot>)
  : mongoose.model<IAudienceDemographicSnapshot>('AudienceDemographicSnapshot', audienceDemographicSnapshotSchema);

export default AudienceDemographicSnapshotModel;
