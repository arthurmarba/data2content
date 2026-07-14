import mongoose, { Schema, Document, models, Types } from "mongoose";

/**
 * PerPautaCollabCache — cache do resultado do matcher por-pauta (aba Collabs).
 *
 * Por quê: a atribuição de collab por pauta roda `assignCollabsByTerritory`
 * (1 chamada Gemini) toda vez que a aba carrega. Sem cache isso significa:
 *   1. CUSTO — Gemini a cada abertura/reload.
 *   2. INSTABILIDADE — o LLM não é determinístico; a mesma pauta podia mostrar
 *      um parceiro diferente entre sessões, quebrando a confiança e reduzindo a
 *      chance de match mútuo (o outro lado pode nem estar mais sendo sugerido).
 *
 * O cache guarda o Record serializado (pautaId → match) chaveado por
 * `cacheKey` = hash(userId + conjunto de pautas ativas + narrativa). Quando as
 * pautas mudam (nova geração), o hash muda → cache novo. TTL curto cobre
 * mudanças de dado do parceiro (nome/avatar) e evolução do mapa.
 */

/** Cache expira sozinho — pautas novas invalidam via hash; TTL cobre o resto. */
export const PER_PAUTA_COLLAB_CACHE_TTL_HOURS = 12;

export interface IPerPautaCollabCache extends Document {
  user: Types.ObjectId;
  /** hash(userId + pautas + narrativa) — muda quando qualquer entrada muda. */
  cacheKey: string;
  /** Record<pautaId, NarrativeCollabMatch> serializado (só pautas com match). */
  matches: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PerPautaCollabCacheSchema = new Schema<IPerPautaCollabCache>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cacheKey: { type: String, required: true },
    matches: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Uma entrada por (criador, chave) — recomputar sobrescreve.
PerPautaCollabCacheSchema.index({ user: 1, cacheKey: 1 }, { unique: true });
// TTL — o Mongo apaga o doc quando expiresAt passa.
PerPautaCollabCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PerPautaCollabCache =
  (models.PerPautaCollabCache as mongoose.Model<IPerPautaCollabCache>) ||
  mongoose.model<IPerPautaCollabCache>("PerPautaCollabCache", PerPautaCollabCacheSchema);

export default PerPautaCollabCache;
