import mongoose, { Schema } from 'mongoose';

export interface VideoAnalysisJobRecord {
  _id: string;
  userId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  signedUntil: Date;
  expiresAt: Date;
  state: 'uploading' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  activeKey?: string;
  payload?: Record<string, any>;
  checkpoint?: Record<string, any>;
  result?: Record<string, any>;
  httpStatus?: number;
  attempts: number;
  leaseToken?: string;
  leaseUntil?: Date;
  acknowledged: boolean;
  cleanedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<VideoAnalysisJobRecord>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  objectKey: { type: String, required: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  signedUntil: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  state: { type: String, required: true, default: 'uploading' },
  activeKey: { type: String },
  payload: Schema.Types.Mixed,
  checkpoint: Schema.Types.Mixed,
  result: Schema.Types.Mixed,
  httpStatus: Number,
  attempts: { type: Number, default: 0 },
  leaseToken: String,
  leaseUntil: Date,
  acknowledged: { type: Boolean, default: false },
  cleanedAt: Date,
}, { timestamps: true });
// Uma análise ativa por usuário reserva a capacidade até a gravação/encerramento.
// Não expirar registros antes de reconciliar seus arquivos.
schema.index({ activeKey: 1 }, { unique: true, sparse: true });
schema.index({ state: 1, updatedAt: 1 });
export default mongoose.models.VideoAnalysisJob as mongoose.Model<VideoAnalysisJobRecord>
  || mongoose.model<VideoAnalysisJobRecord>('VideoAnalysisJob', schema);
