import mongoose, { Schema, Types } from 'mongoose';
import { ACQUISITION_STEPS, type AcquisitionStep, type AcquisitionTouch } from '@/lib/analytics/acquisition';
import { AcquisitionTouchSchema } from './AcquisitionJourney';

export interface AcquisitionEventRecord {
  _id: Types.ObjectId; key: string; journeyId: Types.ObjectId; userId?: Types.ObjectId | null;
  step: AcquisitionStep; at: Date; touch: AcquisitionTouch; firstTouch: AcquisitionTouch;
  internal: boolean; followers?: number | null; subscriptionId?: string; amount?: number; currency?: string;
  capiState: 'pending' | 'sent' | 'skipped' | 'failed'; attempts: number;
  nextAttemptAt: Date; leaseUntil?: Date | null; capiSentAt?: Date; capiError?: string;
  expiresAt: Date;
  oppref?: string | null; obref?: string | null;
}
const schema = new Schema<AcquisitionEventRecord>({
  key: { type: String, required: true, unique: true, maxlength: 240 },
  journeyId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  step: { type: String, enum: Object.keys(ACQUISITION_STEPS), required: true },
  at: { type: Date, required: true }, touch: { type: AcquisitionTouchSchema, required: true },
  firstTouch: { type: AcquisitionTouchSchema, required: true }, internal: { type: Boolean, default: false },
  followers: { type: Number, default: null }, subscriptionId: String, amount: Number, currency: String,
  capiState: { type: String, enum: ['pending', 'sent', 'skipped', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: Date, capiSentAt: Date, capiError: { type: String, maxlength: 100 },
  expiresAt: { type: Date, required: true },
  oppref: { type: String, maxlength: 2048 }, obref: { type: String, maxlength: 2048 },
}, { collection: 'acquisition_events' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ capiState: 1, nextAttemptAt: 1, leaseUntil: 1 });
schema.index({ 'touch.at': -1, 'touch.content': 1 });
export default (mongoose.models.AcquisitionEvent as mongoose.Model<AcquisitionEventRecord>)
  || mongoose.model<AcquisitionEventRecord>('AcquisitionEvent', schema);
