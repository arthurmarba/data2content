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

export const AffiliateInvoiceIndex = mongoose.models.AffiliateInvoiceIndex || mongoose.model("AffiliateInvoiceIndex", invoiceIdx);
export const AffiliateSubscriptionIndex = mongoose.models.AffiliateSubscriptionIndex || mongoose.model("AffiliateSubscriptionIndex", subIdx);
