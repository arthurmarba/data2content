import mongoose, { Schema } from "mongoose";

/**
 * Um job de leitura em lote no Gemini.
 *
 * Sem TTL, pelo mesmo motivo de `GeminiOperation`: o registro é o que liga cada item
 * pago ao post correspondente. Apagar autorizaria pagar de novo.
 *
 * `_id` é o nome do job no provedor (`batches/...`), que é a chave natural da coleta.
 */
const itemSchema = new Schema({
  metricId: { type: String, required: true },
  creatorId: { type: String, required: true },
  /** Operação da governança (`GeminiOperation._id`) reservada no envio. */
  operationId: { type: String, required: true },
  /** Arquivo na Files API; só é apagado depois que o job termina. */
  fileName: { type: String, default: null },
  state: { type: String, enum: ["sent", "done", "failed"], default: "sent" },
  error: { type: String, default: null, maxlength: 300 },
}, { _id: false });

const schema = new Schema({
  _id: { type: String, required: true },
  model: { type: String, required: true },
  state: { type: String, required: true, default: "open" },
  items: { type: [itemSchema], default: [] },
  /** Prazo do provedor para o job: passou disso, os itens voltam a pendente. */
  expiresAt: { type: Date, required: true },
  collectedAt: { type: Date, default: null },
}, { timestamps: true, collection: "gemini_batch_jobs" });

schema.index({ state: 1, createdAt: 1 });

export type GeminiBatchJobRecord = mongoose.InferSchemaType<typeof schema>;
export default (mongoose.models.GeminiBatchJob as mongoose.Model<GeminiBatchJobRecord>)
  || mongoose.model<GeminiBatchJobRecord>("GeminiBatchJob", schema);
