import { Schema, Types, model, models, Document } from 'mongoose';

export interface IAffiliateMigrationAudit extends Document {
  userId: Types.ObjectId;
  step: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  deltas?: Record<string, number>;
  warnings?: string[];
  at: Date;
}

const affiliateMigrationAuditSchema = new Schema<IAffiliateMigrationAudit>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  step: { type: String, required: true },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  deltas: { type: Schema.Types.Mixed },
  warnings: { type: [String], default: [] },
  at: { type: Date, default: Date.now },
});

export default models.AffiliateMigrationAudit ||
  model<IAffiliateMigrationAudit>('AffiliateMigrationAudit', affiliateMigrationAuditSchema);
