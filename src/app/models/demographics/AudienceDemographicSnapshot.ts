import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IDemographicBreakdown {
  value: string;
  count: number;
}

export interface IAudienceDemographics {
  follower_demographics?: {
    city?: IDemographicBreakdown[];
    country?: IDemographicBreakdown[];
    age?: IDemographicBreakdown[];
    gender?: IDemographicBreakdown[];
  };
  engaged_audience_demographics?: {
    city?: IDemographicBreakdown[];
    country?: IDemographicBreakdown[];
    age?: IDemographicBreakdown[];
    gender?: IDemographicBreakdown[];
  };
}

export interface IAudienceDemographicSnapshot extends Document {
  user: Types.ObjectId;
  instagramAccountId: string;
  recordedAt: Date;
  demographics: IAudienceDemographics;
}

const demographicBreakdownSchema = new Schema<IDemographicBreakdown>({
  value: String,
  count: Number,
}, { _id: false });

const audienceDemographicsSchema = new Schema<IAudienceDemographics>({
  follower_demographics: {
    city: { type: [demographicBreakdownSchema], default: undefined },
    country: { type: [demographicBreakdownSchema], default: undefined },
    age: { type: [demographicBreakdownSchema], default: undefined },
    gender: { type: [demographicBreakdownSchema], default: undefined },
  },
  engaged_audience_demographics: {
    city: { type: [demographicBreakdownSchema], default: undefined },
    country: { type: [demographicBreakdownSchema], default: undefined },
    age: { type: [demographicBreakdownSchema], default: undefined },
    gender: { type: [demographicBreakdownSchema], default: undefined },
  },
}, { _id: false });

const audienceDemographicSnapshotSchema = new Schema<IAudienceDemographicSnapshot>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  instagramAccountId: { type: String, required: true },
  recordedAt: { type: Date, required: true, default: Date.now },
  demographics: { type: audienceDemographicsSchema, required: true },
}, { timestamps: true, collection: 'audience_demographic_snapshots' });

audienceDemographicSnapshotSchema.index({ user: 1, recordedAt: -1 });

const AudienceDemographicSnapshotModel = models.AudienceDemographicSnapshot
  ? (models.AudienceDemographicSnapshot as Model<IAudienceDemographicSnapshot>)
  : model<IAudienceDemographicSnapshot>('AudienceDemographicSnapshot', audienceDemographicSnapshotSchema);

export default AudienceDemographicSnapshotModel;
export type { IDemographicBreakdown, IAudienceDemographics };
