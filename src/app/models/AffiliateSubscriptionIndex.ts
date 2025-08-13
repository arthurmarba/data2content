import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAffiliateSubscriptionIndex extends Document {
  subscriptionId: string;
  affiliateUserId: Types.ObjectId;
  createdAt: Date;
}

const affiliateSubscriptionIndexSchema = new Schema<IAffiliateSubscriptionIndex>({
  subscriptionId: { type: String, required: true },
  affiliateUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

affiliateSubscriptionIndexSchema.index(
  { subscriptionId: 1, affiliateUserId: 1 },
  { unique: true, name: "uniq_subscription_affiliate" }
);

const AffiliateSubscriptionIndex: Model<IAffiliateSubscriptionIndex> =
  mongoose.models.AffiliateSubscriptionIndex ||
  mongoose.model<IAffiliateSubscriptionIndex>(
    "AffiliateSubscriptionIndex",
    affiliateSubscriptionIndexSchema
  );

export default AffiliateSubscriptionIndex;
