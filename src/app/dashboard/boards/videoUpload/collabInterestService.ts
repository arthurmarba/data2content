/**
 * collabInterestService.ts
 *
 * Persistência do swipe de collab + detecção de match mútuo.
 *
 * Modelo (decisões travadas — docs/brief-collabs-gamificada-fable.md):
 *   - Interesse PARALELO: cada lado registra "quero fazer" sem saber do outro.
 *     Ninguém convida ninguém; o sistema casa quando os dois toparam.
 *   - "Não agora" é silencioso: registra e nada acontece pro outro lado.
 *   - Match V1 é por PAR de criadores (A→B e B→A), cada um a partir da própria
 *     pauta — a pauta conjunta nascida dos dois mapas é track paralelo.
 *   - Aviso de WhatsApp SÓ no match, pros dois lados, best-effort (falha de
 *     envio nunca derruba o match).
 *
 * Concorrência: o recíproco é "reivindicado" com findOneAndUpdate atômico
 * (matchedAt: null → now). Se dois swipes cruzados chegarem juntos, só um
 * claim vence — o outro lado já encontra matchedAt preenchido e devolve o
 * match existente em vez de duplicar.
 */

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import CollabInterest, {
  COLLAB_INTEREST_TTL_DAYS,
  COLLAB_DISMISSED_TTL_DAYS,
  type CollabInterestDecision,
  type ICollabInterest,
} from "@/app/models/CollabInterest";
import UserModel from "@/app/models/User";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
import { logger } from "@/app/lib/logger";
import { cleanIdeaText } from "./contentIdeasTextHygiene";
import type { NarrativeCollabMatch } from "./narrativeCollabMatchingService";
import type { ContentIdeaCollabBlueprint } from "./contentIdeaBlueprint";

const TAG = "[collabInterestService]";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterCollabDecisionInput {
  userId: string;
  partnerId: string;
  pautaId: string;
  pautaTitle: string;
  pautaTerritory?: string | null;
  /** Snapshot do fit no momento do gesto — vira o texto do match confirmado. */
  fitReason?: string | null;
  sharedSignal?: string | null;
  /** Como gravar juntos (ciente de distância) — sobrevive pro pós-match. */
  recordingIdea?: string | null;
  collabBlueprint?: ContentIdeaCollabBlueprint | null;
  collabMode?: "presencial" | "remoto" | null;
  decision: CollabInterestDecision;
}

export interface RegisterCollabDecisionResult {
  ok: boolean;
  matched: boolean;
  /** Preenchido quando matched=true — o parceiro no shape que o front já usa. */
  match: NarrativeCollabMatch | null;
  error?: string;
}

export interface CollabInterestState {
  ok: boolean;
  /** Decisões pendentes (sem match) — hidrata a pilha/aguardando do front. */
  decisions: Array<{ pautaId: string; decision: CollabInterestDecision }>;
  /**
   * Matches confirmados — hidrata a fileira Combinadas + status no card.
   * `isNew` = casou enquanto o criador estava fora e ele ainda não viu a
   * comemoração → o shell dispara a festa na volta e marca como visto.
   */
  matches: Array<{ pautaId: string; collab: NarrativeCollabMatch; isNew: boolean }>;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PartnerUserLean {
  _id: Types.ObjectId;
  name?: string | null;
  username?: string | null;
  instagramUsername?: string | null;
  image?: string | null;
  mediaKitSlug?: string | null;
  whatsappPhone?: string | null;
  whatsappVerified?: boolean;
}

const PARTNER_FIELDS = "_id name username instagramUsername image mediaKitSlug whatsappPhone whatsappVerified";

/** Monta o parceiro no shape NarrativeCollabMatch que a UI de match já consome. */
function buildMatchPayload(
  user: PartnerUserLean,
  interest: Pick<ICollabInterest, "fitReason" | "sharedSignal" | "recordingIdea" | "collabBlueprint" | "collabMode">,
): NarrativeCollabMatch {
  const handle = user.username ?? user.instagramUsername ?? null;
  return {
    id: user._id.toString(),
    name: user.name ?? "Criador",
    username: typeof handle === "string" ? handle : null,
    avatarUrl: user.image ?? null,
    mediaKitSlug: user.mediaKitSlug ?? null,
    // Campos de sugestão não se aplicam a um match já confirmado — a UI de
    // "combinada" usa nome/@/avatar + fit/recording/mode do snapshot.
    narrativeExample: "",
    suggestedNarrativeLabel: "",
    narrativeFitReason: interest.fitReason ?? "",
    // Sobrevive ao match: "como gravar juntos" é o que o criador precisa AGORA.
    collabRecordingIdea: interest.recordingIdea ?? null,
    collabBlueprint: interest.collabBlueprint ?? null,
    collabMode: interest.collabMode ?? null,
    sharedSignal: interest.sharedSignal ?? null,
    distinctSignals: [],
    narrativeMatch: true,
  };
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Normaliza o território pro casamento recíproco: lowercase, sem acento, trim.
 * "Paternidade" e "paternidade " casam; "" vira "" (sem território → não casa).
 */
function normalizeTerritory(t?: string | null): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Aviso calmo no match — um por lado, falha silenciosa (nunca derruba o match).
 *
 * LIMITAÇÃO conhecida (decisão de ops pendente): usa free-text
 * (`sendWhatsAppMessage`), que a Meta só entrega DENTRO da janela de 24h desde
 * a última mensagem do criador pro número. Um match com quem não falou nas
 * últimas 24h NÃO recebe o aviso. Pra entrega garantida (proativa fora da
 * janela) é preciso um TEMPLATE aprovado no Meta Business e trocar por
 * `sendTemplateMessage` (já existe em whatsappService.ts). Criar/aprovar o
 * template é tarefa no painel da Meta — não dá pra fazer só no código.
 */
async function notifyMatchedPair(
  a: { user: PartnerUserLean; pautaTitle: string; partnerName: string },
  b: { user: PartnerUserLean; pautaTitle: string; partnerName: string },
): Promise<void> {
  const sendTo = async (target: PartnerUserLean, partnerName: string, pautaTitle: string) => {
    if (!target.whatsappVerified || !target.whatsappPhone) return;
    const firstName = partnerName.trim().split(" ")[0] || partnerName;
    const body =
      `Você e ${firstName} toparam fazer uma collab juntos. ` +
      `A pauta: "${pautaTitle}". Abra o app pra ver e chamar no Instagram.`;
    await sendWhatsAppMessage(target.whatsappPhone, body);
  };
  const results = await Promise.allSettled([
    sendTo(a.user, a.partnerName, a.pautaTitle),
    sendTo(b.user, b.partnerName, b.pautaTitle),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      logger.warn(`${TAG} aviso de match no WhatsApp falhou (non-fatal)`, r.reason);
    }
  }
}

// ─── Registro da decisão ──────────────────────────────────────────────────────

export async function registerCollabDecision(
  input: RegisterCollabDecisionInput,
): Promise<RegisterCollabDecisionResult> {
  const { userId, partnerId, pautaId, decision } = input;
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(partnerId)) {
    return { ok: false, matched: false, match: null, error: "invalid_ids" };
  }
  if (userId === partnerId) {
    return { ok: false, matched: false, match: null, error: "self_match" };
  }

  await connectToDatabase();
  const userOid = new Types.ObjectId(userId);
  const partnerOid = new Types.ObjectId(partnerId);
  const now = new Date();
  const pautaTitle = cleanIdeaText(input.pautaTitle);
  const territoryNorm = normalizeTerritory(input.pautaTerritory);

  // 1. Upsert da própria decisão (idempotente por user+pauta; re-swipe sobrescreve).
  //    matchedAt não é tocado aqui — um doc já casado não volta a "pendente".
  const ttlDays = decision === "interested" ? COLLAB_INTEREST_TTL_DAYS : COLLAB_DISMISSED_TTL_DAYS;
  const own = await CollabInterest.findOneAndUpdate(
    { user: userOid, pautaId },
    {
      $set: {
        partner: partnerOid,
        decision,
        pautaTitle,
        pautaTerritory: input.pautaTerritory ?? null,
        pautaTerritoryNorm: territoryNorm,
        fitReason: input.fitReason ?? null,
        sharedSignal: input.sharedSignal ?? null,
        recordingIdea: input.recordingIdea ?? null,
        collabBlueprint: input.collabBlueprint ?? null,
        collabMode: input.collabMode ?? null,
        expiresAt: daysFromNow(ttlDays),
      },
    },
    { upsert: true, new: true },
  );

  // "Não agora" para aqui — silencioso por decisão de produto.
  if (decision !== "interested") {
    return { ok: true, matched: false, match: null };
  }

  // Sem território não há como exigir "mesmo tema" — não casa (fica aguardando).
  // Na prática toda pauta tem território (o matcher é por-território), mas isto
  // protege contra dado incompleto casar dois lados em temas diferentes.
  if (!territoryNorm) {
    return { ok: true, matched: false, match: null };
  }

  // 2. Reivindica o recíproco vigente (atômico — ver nota de concorrência no topo).
  //    Agora exige MESMO território: os dois só casam quando toparam o mesmo tema
  //    — a collab fica óbvia e coerente (gravam sobre a mesma coisa).
  const reciprocal = await CollabInterest.findOneAndUpdate(
    {
      user: partnerOid,
      partner: userOid,
      decision: "interested",
      matchedAt: null,
      pautaTerritoryNorm: territoryNorm,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    { $set: { matchedAt: now }, $unset: { expiresAt: 1 } },
    { new: true },
  );

  if (!reciprocal) {
    // Sem recíproco (ainda): interesse fica aguardando o outro lado.
    return { ok: true, matched: false, match: null };
  }

  // 3. UMA ideia de gravação pros DOIS lados. Cada lado gerou a sua ("como
  //    gravar juntos") ao topar — no mesmo território, mas com texto possivelmente
  //    diferente. A collab é uma coisa só: escolhemos uma (a de quem topou
  //    primeiro = o doc recíproco; fallback pro deste lado) e gravamos nos dois
  //    docs, pra ambos verem exatamente a mesma orientação. O modo (presencial/
  //    remoto) já é simétrico (mesma checagem de cidade), então basta um.
  const sharedRecordingIdea = reciprocal.recordingIdea ?? own.recordingIdea ?? null;
  const sharedCollabBlueprint = reciprocal.collabBlueprint ?? own.collabBlueprint ?? null;
  const sharedMode = own.collabMode ?? reciprocal.collabMode ?? null;

  // O próprio doc também vira match, deixa de expirar E já nasce celebrado: quem
  // topou por último (este request) vê a festa ao vivo, então não deve revê-la na
  // próxima visita. O outro doc fica sem celebratedAt.
  await CollabInterest.updateOne(
    { _id: own._id },
    { $set: { matchedAt: now, celebratedAt: now, recordingIdea: sharedRecordingIdea, collabBlueprint: sharedCollabBlueprint, collabMode: sharedMode }, $unset: { expiresAt: 1 } },
  );
  // Recíproco recebe a MESMA ideia/modo (o dele pode ter sido escolhido, mas
  // reescrever é idempotente e garante consistência se o fallback entrou).
  await CollabInterest.updateOne(
    { _id: reciprocal._id },
    { $set: { recordingIdea: sharedRecordingIdea, collabBlueprint: sharedCollabBlueprint, collabMode: sharedMode } },
  );
  // Reflete no objeto em memória pro payload de retorno deste lado.
  own.recordingIdea = sharedRecordingIdea;
  own.collabBlueprint = sharedCollabBlueprint;
  own.collabMode = sharedMode;

  // 4. Perfis pros payloads + aviso.
  const [viewer, partner] = await Promise.all([
    UserModel.findById(userOid).select(PARTNER_FIELDS).lean<PartnerUserLean>(),
    UserModel.findById(partnerOid).select(PARTNER_FIELDS).lean<PartnerUserLean>(),
  ]);
  if (!partner) {
    // Parceiro sumiu entre o match e o fetch — improvável; match fica registrado.
    logger.warn(`${TAG} match registrado mas parceiro ${partnerId} não encontrado`);
    return { ok: true, matched: true, match: null };
  }

  if (viewer) {
    await notifyMatchedPair(
      { user: viewer, pautaTitle: cleanIdeaText(own.pautaTitle), partnerName: partner.name ?? "outro criador" },
      { user: partner, pautaTitle: cleanIdeaText(reciprocal.pautaTitle), partnerName: viewer.name ?? "outro criador" },
    );
  }

  return { ok: true, matched: true, match: buildMatchPayload(partner, own) };
}

// ─── Hidratação do estado ─────────────────────────────────────────────────────

export async function getCollabInterestState(userId: string): Promise<CollabInterestState> {
  if (!Types.ObjectId.isValid(userId)) {
    return { ok: false, decisions: [], matches: [], error: "invalid_user" };
  }
  await connectToDatabase();
  const now = new Date();

  // Filtro de expiração defensivo — o TTL do Mongo pode atrasar até ~60s.
  const docs = await CollabInterest.find({
    user: new Types.ObjectId(userId),
    $or: [{ matchedAt: { $ne: null } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ updatedAt: -1 })
    .lean<ICollabInterest[]>();

  const pending = docs.filter((d) => !d.matchedAt);
  const matched = docs.filter((d) => d.matchedAt);

  let matches: CollabInterestState["matches"] = [];
  if (matched.length > 0) {
    const partnerIds = [...new Set(matched.map((d) => d.partner.toString()))];
    const partners = await UserModel.find({ _id: { $in: partnerIds } })
      .select(PARTNER_FIELDS)
      .lean<PartnerUserLean[]>();
    const byId = new Map(partners.map((p) => [p._id.toString(), p]));
    matches = matched.flatMap((d) => {
      const partner = byId.get(d.partner.toString());
      // isNew = casou mas este criador ainda não viu a comemoração (estava fora
      // quando o outro topou) → o shell dispara a festa na volta.
      return partner ? [{ pautaId: d.pautaId, collab: buildMatchPayload(partner, d), isNew: !d.celebratedAt }] : [];
    });
  }

  return {
    ok: true,
    decisions: pending.map((d) => ({ pautaId: d.pautaId, decision: d.decision })),
    matches,
  };
}

/**
 * Marca os matches como "comemorados" por este criador — chamado pelo shell logo
 * depois de disparar a festa na volta, pra ela não tocar de novo. Idempotente:
 * só toca docs matchados ainda sem celebratedAt.
 */
export async function markMatchesCelebrated(userId: string, pautaIds: string[]): Promise<{ ok: boolean }> {
  if (!Types.ObjectId.isValid(userId) || pautaIds.length === 0) return { ok: false };
  await connectToDatabase();
  await CollabInterest.updateMany(
    {
      user: new Types.ObjectId(userId),
      pautaId: { $in: pautaIds },
      matchedAt: { $ne: null },
      celebratedAt: null,
    },
    { $set: { celebratedAt: new Date() } },
  );
  return { ok: true };
}
