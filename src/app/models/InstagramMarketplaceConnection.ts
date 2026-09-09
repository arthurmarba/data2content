import mongoose, { Schema } from 'mongoose';

// Credencial exclusiva do administrativo; não substitui a conexão dos criadores.
const schema = new Schema({
  owner: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
  sealedToken: { type: String, select: false },
  accountId: String,
  pageName: String,
  expiresAt: Date,
  stateHash: { type: String, select: false },
  stateExpiresAt: Date,
}, { timestamps: true, collection: 'instagram_marketplace_connections' });

type MarketplaceConnection = mongoose.InferSchemaType<typeof schema>;
export default (mongoose.models.InstagramMarketplaceConnection as mongoose.Model<MarketplaceConnection> | undefined) ||
  mongoose.model<MarketplaceConnection>('InstagramMarketplaceConnection', schema);
