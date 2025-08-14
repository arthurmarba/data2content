import mongoose, { Schema } from "mongoose";

const invoiceIdx = new Schema({
  invoiceId: { type: String, required: true, index: true },
  affiliateUserId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });
invoiceIdx.index({ invoiceId: 1, affiliateUserId: 1 }, { unique: true });

const subIdx = new Schema({
  subscriptionId: { type: String, required: true, index: true },
  affiliateUserId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });
subIdx.index({ subscriptionId: 1, affiliateUserId: 1 }, { unique: true });

const refundProg = new Schema({
  invoiceId: { type: String, required: true, index: true, unique: true },
  refundedPaidCentsTotal: { type: Number, default: 0 },
}, { timestamps: true });

export const AffiliateInvoiceIndex = mongoose.models.AffiliateInvoiceIndex || mongoose.model("AffiliateInvoiceIndex", invoiceIdx);
export const AffiliateSubscriptionIndex = mongoose.models.AffiliateSubscriptionIndex || mongoose.model("AffiliateSubscriptionIndex", subIdx);
export const AffiliateRefundProgress = mongoose.models.AffiliateRefundProgress || mongoose.model("AffiliateRefundProgress", refundProg);
