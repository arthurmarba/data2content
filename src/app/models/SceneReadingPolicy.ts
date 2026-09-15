import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  _id: String,
  // Documento rollout: percentual; demais documentos: atribuição imutável por operação.
  compactPercent: { type: Number, min: 0, max: 100 },
  format: { type: String, enum: ["scene_legacy_v1", "scene_segments_v1"] },
}, { timestamps: true, collection: "scene_reading_policies" });
type Record = mongoose.InferSchemaType<typeof schema>;
export default (mongoose.models.SceneReadingPolicy as mongoose.Model<Record>) || mongoose.model<Record>("SceneReadingPolicy", schema);
