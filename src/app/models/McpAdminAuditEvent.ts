import mongoose, { Schema, Types, type Document, type Model } from "mongoose";

export type McpAdminAuditStatus = "started" | "success" | "error";

export interface IMcpAdminAuditPeriod {
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  lookbackDays?: number;
  periodDays?: number;
}

export interface IMcpAdminAuditEvent extends Document {
  invocationId: string;
  requestId: string;
  actorUserId: Types.ObjectId;
  targetCreatorIds: Types.ObjectId[];
  clientId: string | null;
  tool: string;
  scopes: string[];
  period: IMcpAdminAuditPeriod | null;
  status: McpAdminAuditStatus;
  durationMs: number;
  resultCount: number | null;
  errorCode: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const McpAdminAuditEventSchema = new Schema<IMcpAdminAuditEvent>(
  {
    invocationId: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetCreatorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    clientId: { type: String, default: null },
    tool: { type: String, required: true, index: true },
    scopes: { type: [String], required: true, default: [] },
    period: {
      type: new Schema<IMcpAdminAuditPeriod>(
        {
          startDate: { type: String },
          endDate: { type: String },
          timeZone: { type: String },
          lookbackDays: { type: Number, min: 1 },
          periodDays: { type: Number, min: 1 },
        },
        { _id: false },
      ),
      default: null,
    },
    status: { type: String, enum: ["started", "success", "error"], required: true },
    durationMs: { type: Number, required: true, min: 0 },
    resultCount: { type: Number, default: null, min: 0 },
    errorCode: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "mcp_admin_audit_events" },
);

McpAdminAuditEventSchema.index({ actorUserId: 1, createdAt: -1 });
McpAdminAuditEventSchema.index({ targetCreatorIds: 1, createdAt: -1 });
McpAdminAuditEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const McpAdminAuditEventModel: Model<IMcpAdminAuditEvent> =
  (mongoose.models.McpAdminAuditEvent as Model<IMcpAdminAuditEvent> | undefined) ??
  mongoose.model<IMcpAdminAuditEvent>("McpAdminAuditEvent", McpAdminAuditEventSchema);

export default McpAdminAuditEventModel;
