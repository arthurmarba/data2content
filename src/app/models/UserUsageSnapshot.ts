import { Schema, model, models, Document, Types, Model } from 'mongoose';

export interface IUserUsageSnapshot extends Document {
  user: Types.ObjectId;
  date: Date;
  messageCount: number;
}

const userUsageSnapshotSchema = new Schema<IUserUsageSnapshot>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    messageCount: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    collection: 'user_usage_snapshots',
  }
);

userUsageSnapshotSchema.index({ user: 1, date: -1 });

const UserUsageSnapshotModel: Model<IUserUsageSnapshot> =
  models.UserUsageSnapshot ||
  model<IUserUsageSnapshot>('UserUsageSnapshot', userUsageSnapshotSchema);

export default UserUsageSnapshotModel;
