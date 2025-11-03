import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface ICpmHistory extends Document {
  segment: string;
  cpm: number;
  source: 'seed' | 'dynamic';
  createdAt: Date;
}

const CpmHistorySchema = new Schema<ICpmHistory>(
  {
    segment: { type: String, required: true, index: true, trim: true },
    cpm: { type: Number, required: true },
    source: { type: String, enum: ['seed', 'dynamic'], required: true },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

CpmHistorySchema.index({ segment: 1, createdAt: -1 });

const CpmHistory =
  (models.CpmHistory as mongoose.Model<ICpmHistory>) ||
  model<ICpmHistory>('CpmHistory', CpmHistorySchema);

export default CpmHistory;
