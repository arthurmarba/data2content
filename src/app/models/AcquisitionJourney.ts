import mongoose, { Schema, Types } from 'mongoose';
import type { AcquisitionTouch } from '@/lib/analytics/acquisition';

export interface AcquisitionJourneyRecord {
  _id: Types.ObjectId;
  tokenHash: string;
  userId?: Types.ObjectId | null;
  firstTouch: AcquisitionTouch;
  lastPaidTouch: AcquisitionTouch;
  consent: boolean;
  oppref?: string | null;
  obref?: string | null;
  internal: boolean;
  newAccount?: boolean;
  followers?: number | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}
export const AcquisitionTouchSchema = new Schema({
  source: String, medium: String, campaign: String, content: String, at: Date,
}, { _id: false });
const schema = new Schema<AcquisitionJourneyRecord>({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  firstTouch: { type: AcquisitionTouchSchema, required: true },
  lastPaidTouch: { type: AcquisitionTouchSchema, required: true },
  consent: { type: Boolean, default: true },
  oppref: { type: String, maxlength: 2048 }, obref: { type: String, maxlength: 2048 },
  internal: { type: Boolean, default: false }, followers: { type: Number, default: null },
  newAccount: Boolean,
  expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: 'acquisition_journeys' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ 'lastPaidTouch.at': -1 });
export default (mongoose.models.AcquisitionJourney as mongoose.Model<AcquisitionJourneyRecord>)
  || mongoose.model<AcquisitionJourneyRecord>('AcquisitionJourney', schema);
