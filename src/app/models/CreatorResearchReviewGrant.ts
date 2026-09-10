import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

// Concessão operacional restrita à pesquisa externa; nunca equivale a role=admin.
const schema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: 'creator_research_review_grants' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
type Grant = InferSchemaType<typeof schema>;
export default (mongoose.models.CreatorResearchReviewGrant as Model<Grant>) || mongoose.model<Grant>('CreatorResearchReviewGrant', schema);
