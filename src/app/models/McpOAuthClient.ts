import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IMcpOAuthClient extends Document {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: Array<"authorization_code" | "refresh_token">;
  responseTypes: Array<"code">;
  tokenEndpointAuthMethod: "none";
  scope: string[];
  createdAt: Date;
  updatedAt: Date;
}

const McpOAuthClientSchema = new Schema<IMcpOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    clientName: { type: String, required: true, maxlength: 120 },
    redirectUris: { type: [String], required: true },
    grantTypes: {
      type: [String],
      enum: ["authorization_code", "refresh_token"],
      default: ["authorization_code", "refresh_token"],
    },
    responseTypes: { type: [String], enum: ["code"], default: ["code"] },
    tokenEndpointAuthMethod: { type: String, enum: ["none"], default: "none" },
    scope: { type: [String], default: [] },
  },
  { timestamps: true, collection: "mcp_oauth_clients" },
);

const McpOAuthClientModel: Model<IMcpOAuthClient> =
  (mongoose.models.McpOAuthClient as Model<IMcpOAuthClient> | undefined) ??
  mongoose.model<IMcpOAuthClient>("McpOAuthClient", McpOAuthClientSchema);

export default McpOAuthClientModel;
