import mongoose, { Schema } from "mongoose";

// Sem TTL: apagar este registro autorizaria pagar novamente pelo mesmo conteúdo.
const schema = new Schema({
  _id: String,
  creatorId: { type: String, required: true },
  contentKey: { type: String, required: true },
  tag: { type: String, required: true },
  fingerprint: { type: String, required: true },
  model: { type: String, required: true },
  state: { type: String, enum: ["started", "received", "rejected"], required: true },
  response: Schema.Types.Mixed,
  responseFormat: { type: String, enum: ["scene_legacy_v1", "scene_segments_v1"] },
  durationSeconds: Number,
  outcome: { type: String, enum: ["complete", "partial", "unusable"] },
  attempts: { type: Number, default: 1 },
  reason: String,
  retryAt: Date,
  bucketIds: [String],
  reservedMicros: { type: Number, default: 0 },
  chargedEstimateMicros: Number,
  rates: Schema.Types.Mixed,
}, { timestamps: true, collection: "gemini_operations" });
schema.index({ creatorId: 1, createdAt: -1 });
export type GeminiOperationRecord = mongoose.InferSchemaType<typeof schema>;
export default (mongoose.models.GeminiOperation as mongoose.Model<GeminiOperationRecord>) || mongoose.model<GeminiOperationRecord>("GeminiOperation", schema);
