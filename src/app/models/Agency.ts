import { Schema, model, models, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IAgency extends Document {
  name: string;
  contactEmail?: string;
  inviteCode: string;
  planStatus?: string;
  paymentGatewaySubscriptionId?: string | null;
}

const agencySchema = new Schema<IAgency>({
  name: { type: String, required: true },
  contactEmail: { type: String },
  inviteCode: { type: String, required: true, default: () => nanoid(10), unique: true },
  planStatus: { type: String, default: 'inactive' },
  paymentGatewaySubscriptionId: { type: String, default: null },
}, { timestamps: true });

agencySchema.index({ inviteCode: 1 }, { unique: true });

const AgencyModel: Model<IAgency> = models.Agency || model<IAgency>('Agency', agencySchema);
export default AgencyModel;
