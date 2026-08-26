import mongoose, { Schema, Types, type Document, type Model } from "mongoose";

export interface IMcpOAuthConsentRequest extends Document {
  requestHash: string;
  userId: Types.ObjectId;
  clientId: string;
  clientName: string;
  redirectUri: string;
  scope: string[];
  resource: string;
  codeChallenge: string;
  state: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const McpOAuthConsentRequestSchema = new Schema<IMcpOAuthConsentRequest>(
  {
    requestHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    redirectUri: { type: String, required: true },
    scope: { type: [String], required: true },
    resource: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    state: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "mcp_oauth_consent_requests" },
);

const McpOAuthConsentRequestModel: Model<IMcpOAuthConsentRequest> =
  (mongoose.models.McpOAuthConsentRequest as Model<IMcpOAuthConsentRequest> | undefined) ??
  mongoose.model<IMcpOAuthConsentRequest>("McpOAuthConsentRequest", McpOAuthConsentRequestSchema);

export default McpOAuthConsentRequestModel;
