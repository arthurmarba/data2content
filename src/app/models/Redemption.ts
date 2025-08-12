import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IRedemption extends Document {
  userId: Types.ObjectId;
  currency: string;           // 'brl' | 'usd' | ...
  amountCents: number;        // valor sacado (em cents) naquela moeda
  status: 'requested' | 'rejected' | 'paid';
  method?: 'manual' | 'connect';
  requestedAt: Date;
  processedAt?: Date | null;
  notes?: string;
  transactionId?: string;
}

const redemptionSchema = new Schema<IRedemption>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  currency: { type: String, required: true, lowercase: true, trim: true },
  amountCents: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['requested','rejected','paid'], default: 'requested', index: true },
  method: { type: String, enum: ['manual','connect'], default: 'manual' },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
  transactionId: { type: String, index: true },
}, { timestamps: true });

redemptionSchema.index({ userId: 1, createdAt: -1 });

const Redemption: Model<IRedemption> = mongoose.models.Redemption || mongoose.model<IRedemption>('Redemption', redemptionSchema);
export default Redemption;
