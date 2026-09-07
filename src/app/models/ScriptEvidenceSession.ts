import mongoose, { Schema, Types } from "mongoose";

/** Cache privado temporário do pacote efetivamente entregue ao escritor. */
export interface ScriptEvidenceSessionRecord {
  userId: Types.ObjectId;
  clientRequestId: string;
  packId: string;
  pack: Record<string, any>;
  mode: "client" | "internal";
  provider: string | null;
  draftHash: string | null;
  draftContent: string | null;
  expiresAt: Date;
  createdAt: Date;
}
const schema = new Schema<ScriptEvidenceSessionRecord>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  clientRequestId: { type: String, required: true, unique: true },
  packId: { type: String, required: true },
  pack: { type: Schema.Types.Mixed, required: true },
  mode: { type: String, enum: ["client", "internal"], required: true },
  provider: { type: String, default: null },
  draftHash: { type: String, default: null },
  draftContent: { type: String, default: null, maxlength: 20000 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: "script_evidence_sessions" });
schema.index({ userId: 1, packId: 1 });
export default (mongoose.models.ScriptEvidenceSession as mongoose.Model<ScriptEvidenceSessionRecord>)
  || mongoose.model<ScriptEvidenceSessionRecord>("ScriptEvidenceSession", schema);
