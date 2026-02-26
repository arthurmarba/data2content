import mongoose, { Schema, model } from 'mongoose';

const CronLockSchema = new Schema(
  {
    _id: { type: String, required: true },
    lockedAt: { type: Date, default: null },
    owner: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const CronLock = mongoose.models.CronLock || model('CronLock', CronLockSchema);
