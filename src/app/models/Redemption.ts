import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IRedemption extends Document {
  userId: Types.ObjectId;
  currency: string;           // 'brl' | 'usd' | ...
  amountCents: number;        // valor sacado (em cents) naquela moeda
  status: 'processing' | 'paid' | 'rejected';
  transferId?: string | null;
  reasonCode?: string | null;
  notes?: string;
}

const redemptionSchema = new Schema<IRedemption>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  currency: { type: String, required: true, lowercase: true, trim: true },
  amountCents: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['processing','paid','rejected'], default: 'processing', index: true },
  transferId: { type: String, index: true, default: null },
  reasonCode: { type: String, default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

redemptionSchema.index({ userId: 1, createdAt: -1 });

const Redemption: Model<IRedemption> = mongoose.models.Redemption || mongoose.model<IRedemption>('Redemption', redemptionSchema);
export default Redemption;
