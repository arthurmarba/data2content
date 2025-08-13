import { Schema, Types, model, models, Document } from 'mongoose';

export interface IAffiliateRefundProgress extends Document {
  invoiceId: string;
  affiliateUserId: Types.ObjectId;
  refundedPaidCentsTotal: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const affiliateRefundProgressSchema = new Schema<IAffiliateRefundProgress>(
  {
    invoiceId: { type: String, required: true, index: true },
    affiliateUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    refundedPaidCentsTotal: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

affiliateRefundProgressSchema.index(
  { invoiceId: 1, affiliateUserId: 1 },
  { unique: true, name: 'uniq_refund_progress' }
);

export default models.AffiliateRefundProgress || model<IAffiliateRefundProgress>('AffiliateRefundProgress', affiliateRefundProgressSchema);
