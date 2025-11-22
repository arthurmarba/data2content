import mongoose, { Schema, Document, models } from 'mongoose';

export type AlertSeverity = 'info' | 'warning' | 'success' | 'critical';
export type AlertChannel = 'whatsapp' | 'system' | 'email' | 'other';

export interface IAlert extends Document {
  user: Schema.Types.ObjectId;
  title: string;
  body: string;
  channel?: AlertChannel;
  severity?: AlertSeverity;
  metadata?: Record<string, unknown>;
  sourceMessageId?: string | null;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ['whatsapp', 'system', 'email', 'other'], default: 'whatsapp' },
    severity: { type: String, enum: ['info', 'warning', 'success', 'critical'], default: 'info' },
    metadata: { type: Schema.Types.Mixed, default: null },
    sourceMessageId: { type: String, default: null },
    readAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

AlertSchema.index({ user: 1, createdAt: -1 });

const Alert =
  (models.Alert as mongoose.Model<IAlert>) ||
  mongoose.model<IAlert>('Alert', AlertSchema);

export default Alert;
