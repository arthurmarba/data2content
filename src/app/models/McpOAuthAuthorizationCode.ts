import mongoose, { Schema, Types, type Document, type Model } from "mongoose";

export interface IMcpOAuthAuthorizationCode extends Document {
  codeHash: string;
  clientId: string;
  userId: Types.ObjectId;
  redirectUri: string;
  scope: string[];
  resource: string;
  codeChallenge: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const McpOAuthAuthorizationCodeSchema = new Schema<IMcpOAuthAuthorizationCode>(
  {
    codeHash: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    redirectUri: { type: String, required: true },
    scope: { type: [String], required: true },
    resource: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "mcp_oauth_authorization_codes" },
);

const McpOAuthAuthorizationCodeModel: Model<IMcpOAuthAuthorizationCode> =
  (mongoose.models.McpOAuthAuthorizationCode as Model<IMcpOAuthAuthorizationCode> | undefined) ??
  mongoose.model<IMcpOAuthAuthorizationCode>(
    "McpOAuthAuthorizationCode",
    McpOAuthAuthorizationCodeSchema,
  );

export default McpOAuthAuthorizationCodeModel;
