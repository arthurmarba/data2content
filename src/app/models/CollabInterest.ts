import mongoose, { Schema, Document, models, Types } from "mongoose";

/**
 * CollabInterest — a decisão de swipe de um criador sobre uma collab sugerida.
 *
 * Modelo do match (decisão de produto — ver docs/brief-collabs-gamificada-fable.md):
 *   - Interesse PARALELO, nunca convite→aceite: cada lado registra "quero fazer"
 *     sem saber do outro; o sistema casa quando os dois toparam.
 *   - "Não agora" (dismissed) é silencioso — nunca vira notificação nem rejeição.
 *   - Interesse EXPIRA sozinho (o mapa muda; um match velho pode não fazer mais
 *     sentido). Match confirmado NÃO expira: ao casar, `expiresAt` é limpo — o
 *     TTL index do Mongo só apaga docs cuja data passou, então unset = imortal.
 *
 * V1 — match por PAR de criadores: hoje cada lado topa a partir da SUA pauta
 * (a pauta conjunta nascida dos dois mapas é track paralelo da geração). O doc
 * guarda a pauta do próprio lado como snapshot; quando a geração conjunta
 * existir, os dois lados passam a apontar a mesma pauta sem mudar o schema.
 */

export type CollabInterestDecision = "interested" | "dismissed";

/** Interesse não respondido some depois disso — ver decisão travada nº 10. */
export const COLLAB_INTEREST_TTL_DAYS = 45;
/** "Não agora" também expira (mais cedo): a sugestão pode voltar num momento melhor. */
export const COLLAB_DISMISSED_TTL_DAYS = 30;

export interface ICollabInterest extends Document {
  /** Quem decidiu. */
  user: Types.ObjectId;
  /** O criador sugerido do outro lado. */
  partner: Types.ObjectId;
  decision: CollabInterestDecision;

  /** Pauta do lado de quem decidiu (id do ContentIdea) + snapshot pro overlay. */
  pautaId: string;
  pautaTitle: string;
  pautaTerritory: string | null;
  /** Snapshot do fit no momento do "quero fazer" — o texto que convenceu. */
  fitReason: string | null;
  sharedSignal: string | null;
  /** Como gravar juntos (respeitando a distância) — sobrevive ao match, que é
   * quando o criador mais precisa dessa orientação ("casamos, e agora?"). */
  recordingIdea: string | null;
  /** "presencial" (mesma cidade) | "remoto" (longe/desconhecido). */
  collabMode: "presencial" | "remoto" | null;

  /** Preenchido nos DOIS docs quando o par casa. */
  matchedAt: Date | null;
  /**
   * Quando ESTE criador viu a comemoração do match. Quem topa por último vê ao
   * vivo (marcado na hora); quem estava fora fica null → comemora na próxima
   * visita e só então marca. Garante que a festa toca UMA vez, não a cada abertura.
   */
  celebratedAt?: Date | null;
  /** TTL — limpo (undefined) no match para o doc nunca ser apagado. */
  expiresAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const CollabInterestSchema = new Schema<ICollabInterest>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    partner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decision: { type: String, enum: ["interested", "dismissed"], required: true },

    pautaId: { type: String, required: true },
    pautaTitle: { type: String, required: true },
    pautaTerritory: { type: String, default: null },
    fitReason: { type: String, default: null },
    sharedSignal: { type: String, default: null },
    recordingIdea: { type: String, default: null },
    collabMode: { type: String, enum: ["presencial", "remoto", null], default: null },

    matchedAt: { type: Date, default: null },
    celebratedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Uma decisão por (criador, pauta) — o swipe é idempotente; re-decidir sobrescreve.
CollabInterestSchema.index({ user: 1, pautaId: 1 }, { unique: true });
// Busca do recíproco: "o parceiro já topou comigo?" + hidratação por criador.
CollabInterestSchema.index({ partner: 1, user: 1, decision: 1, matchedAt: 1 });
CollabInterestSchema.index({ user: 1, matchedAt: 1 });
// TTL — o Mongo apaga o doc quando expiresAt passa; docs sem expiresAt ficam.
CollabInterestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CollabInterest =
  (models.CollabInterest as mongoose.Model<ICollabInterest>) ||
  mongoose.model<ICollabInterest>("CollabInterest", CollabInterestSchema);

export default CollabInterest;
