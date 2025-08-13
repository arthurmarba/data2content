import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAffiliateInvoiceIndex extends Document {
  invoiceId: string;
  affiliateUserId: Types.ObjectId;
  createdAt: Date;
}

const affiliateInvoiceIndexSchema = new Schema<IAffiliateInvoiceIndex>({
  invoiceId: { type: String, required: true },
  affiliateUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

affiliateInvoiceIndexSchema.index(
  { invoiceId: 1, affiliateUserId: 1 },
  { unique: true, name: "uniq_invoice_affiliate" }
);

const AffiliateInvoiceIndex: Model<IAffiliateInvoiceIndex> =
  mongoose.models.AffiliateInvoiceIndex ||
  mongoose.model<IAffiliateInvoiceIndex>(
    "AffiliateInvoiceIndex",
    affiliateInvoiceIndexSchema
  );

export default AffiliateInvoiceIndex;
