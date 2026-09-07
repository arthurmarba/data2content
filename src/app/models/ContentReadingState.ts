import mongoose, { Schema } from "mongoose";

export interface ContentReadingStateRecord {
  _id: string; revision: string; state: string; attempts: number;
  reason: string | null; nextAttemptAt: Date; leaseUntil: Date;
  leaseToken: string | null; result: Record<string, any> | null; updatedAt: Date;
}
const schema = new Schema<ContentReadingStateRecord>({
  _id: { type: String, required: true }, revision: { type: String, required: true },
  state: { type: String, required: true, default: "pending" }, attempts: { type: Number, default: 0 },
  reason: { type: String, default: null, maxlength: 120 },
  nextAttemptAt: { type: Date, default: () => new Date(0) },
  leaseUntil: { type: Date, default: () => new Date(0) },
  leaseToken: { type: String, default: null }, result: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true, collection: "content_reading_states" });
schema.index({ state: 1, nextAttemptAt: 1 });
export default (mongoose.models.ContentReadingState as mongoose.Model<ContentReadingStateRecord>)
  || mongoose.model<ContentReadingStateRecord>("ContentReadingState", schema);
