import mongoose, { Schema, Types, type Document, type Model } from "mongoose";

export interface IMcpOAuthRefreshToken extends Document {
  tokenHash: string;
  clientId: string;
  userId: Types.ObjectId;
  scope: string[];
  resource: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const McpOAuthRefreshTokenSchema = new Schema<IMcpOAuthRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scope: { type: [String], required: true },
    resource: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
  },
  { timestamps: true, collection: "mcp_oauth_refresh_tokens" },
);

McpOAuthRefreshTokenSchema.index({ userId: 1, clientId: 1, revokedAt: 1 });

const McpOAuthRefreshTokenModel: Model<IMcpOAuthRefreshToken> =
  (mongoose.models.McpOAuthRefreshToken as Model<IMcpOAuthRefreshToken> | undefined) ??
  mongoose.model<IMcpOAuthRefreshToken>("McpOAuthRefreshToken", McpOAuthRefreshTokenSchema);

export default McpOAuthRefreshTokenModel;
