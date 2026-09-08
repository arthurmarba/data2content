import mongoose, { Schema, Types } from 'mongoose';
export interface CollabJobRecord {
  _id: Types.ObjectId; userId: string; kind: 'ideas' | 'matching' | 'notification'; key: string; activeKey?: string;
  state: 'queued' | 'running' | 'completed' | 'failed'; payload: Record<string, any>; result?: Record<string, any>;
  checkpoint?: string; leaseToken?: string; leaseUntil?: Date; attempts: number; nextAttemptAt: Date;
  error?: string; quotaKey?: string; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<CollabJobRecord>({
  userId: { type: String, required: true, index: true }, kind: { type: String, required: true },
  key: { type: String, required: true, unique: true }, activeKey: String,
  state: { type: String, default: 'queued', required: true }, payload: { type: Schema.Types.Mixed, default: {} },
  result: Schema.Types.Mixed, checkpoint: String, leaseToken: String, leaseUntil: Date,
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now }, error: String, quotaKey: String,
}, { timestamps: true, collection: 'collabjobs' });
schema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: 'string' } } });
schema.index({ state: 1, nextAttemptAt: 1 });
export default (mongoose.models.CollabJob as mongoose.Model<CollabJobRecord>) || mongoose.model('CollabJob', schema);
