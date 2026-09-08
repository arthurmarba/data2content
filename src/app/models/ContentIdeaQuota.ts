import mongoose, { Schema } from 'mongoose';
export interface ContentIdeaQuotaRecord { _id: string; userId: string; month: string; consumed: number; reserved: string[]; }
const schema = new Schema<ContentIdeaQuotaRecord>({
  _id: String, userId: { type: String, required: true }, month: { type: String, required: true },
  consumed: { type: Number, default: 0 }, reserved: { type: [String], default: [] },
}, { timestamps: true, collection: 'contentideaquotas' });
export default (mongoose.models.ContentIdeaQuota as mongoose.Model<ContentIdeaQuotaRecord>) || mongoose.model('ContentIdeaQuota', schema);
