import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IRedemption extends Document {
  userId: Types.ObjectId;
  currency: string;           // 'brl' | 'usd' | ...
  amountCents: number;        // valor sacado (em cents) naquela moeda
  status: 'requested' | 'paid' | 'rejected';
  transferId?: string | null;
  reasonCode?: string | null;
  notes?: string;
  idempotencyKey?: string;
  accountId?: string | null;
  payoutEntryIds?: Types.ObjectId[];
  balanceReservedAt?: Date | null;
  processedAt?: Date | null;
  transactionId?: string | null;
  reversedAmountCents?: number;
}

const redemptionSchema = new Schema<IRedemption>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  currency: { type: String, required: true, lowercase: true, trim: true },
  amountCents: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['requested','paid','rejected'], default: 'requested', index: true },
  transferId: { type: String, default: undefined },
  reasonCode: { type: String, default: null },
  notes: { type: String, default: '' },
  idempotencyKey: { type: String, default: undefined },
  accountId: { type: String, default: null },
  payoutEntryIds: [{ type: Schema.Types.ObjectId }],
  balanceReservedAt: { type: Date, default: null },
  processedAt: { type: Date, default: null },
  transactionId: { type: String, default: null },
  reversedAmountCents: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

redemptionSchema.index({ userId: 1, createdAt: -1 });
redemptionSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "uniq_redemption_idempotency",
  },
);
redemptionSchema.index(
  { transferId: 1 },
  {
    unique: true,
    partialFilterExpression: { transferId: { $type: "string" } },
    name: "uniq_redemption_transfer",
  },
);
redemptionSchema.index(
  { userId: 1, currency: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'requested' }, name: 'uniq_active_redemption' },
);

const Redemption: Model<IRedemption> = mongoose.models.Redemption || mongoose.model<IRedemption>('Redemption', redemptionSchema);
export default Redemption;
