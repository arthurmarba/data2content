import mongoose, { Schema } from "mongoose";

// Configuração no banco, em milionésimos de dólar. Ausente = apenas observação.
const policySchema = new Schema({
  _id: String,
  enabled: { type: Boolean, default: false },
  globalDailyMicros: Number,
  creatorDailyMicros: Number,
  // Taxas conservadoras: maior preço de entrada entre modalidades/faixas;
  // saída inclui raciocínio. A ativação exige revisão dos preços do provedor.
  rates: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: "gemini_budget_policies" });
const bucketSchema = new Schema({
  _id: String,
  allocatedMicros: { type: Number, default: 0 },
}, { timestamps: true, collection: "gemini_budget_buckets" });
type PolicyRecord = mongoose.InferSchemaType<typeof policySchema>;
export const GeminiBudgetPolicy = (mongoose.models.GeminiBudgetPolicy as mongoose.Model<PolicyRecord>) || mongoose.model<PolicyRecord>("GeminiBudgetPolicy", policySchema);
type BucketRecord = mongoose.InferSchemaType<typeof bucketSchema>;
export const GeminiBudgetBucket = (mongoose.models.GeminiBudgetBucket as mongoose.Model<BucketRecord>) || mongoose.model<BucketRecord>("GeminiBudgetBucket", bucketSchema);
