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
import { logger } from "@/app/lib/logger";
import { resolveCreatorAvatar } from "@/app/lib/avatar/creatorAvatar";
import { cleanIdeaText } from "./contentIdeasTextHygiene";
import type { NarrativeCollabMatch } from "./narrativeCollabMatchingService";
import type { ContentIdeaCollabBlueprint } from "./contentIdeaBlueprint";
import { simplifyUserFacingText } from "./contentIdeaOpportunity";
import { invalidateCachedPerPautaMatches } from "./perPautaCollabCache";

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
  viewerContribution?: string | null;
  partnerContribution?: string | null;
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
  decisions: Array<{ pautaTitle?: string; territory?: string | null; pautaId: string; decision: CollabInterestDecision; collab?: NarrativeCollabMatch; expiresAt?: string }>;
  /**
   * Matches confirmados — hidrata a fileira Combinadas + status no card.
   * `isNew` = casou enquanto o criador estava fora e ele ainda não viu a
   * comemoração → o shell dispara a festa na volta e marca como visto.
   */
  matches: Array<{
    pautaId: string;
    pautaSnapshot: { id: string; title: string; territory: string | null };
    collab: NarrativeCollabMatch;
    isNew: boolean;
  }>;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PartnerUserLean {
  _id: Types.ObjectId;
  name?: string | null;
  username?: string | null;
  instagramUsername?: string | null;
  image?: string | null;
  providerImage?: string | null;
  profile_picture_url?: string | null;
  isInstagramConnected?: boolean | null;
  instagramAccountId?: string | null;
  availableIgAccounts?: Array<{
    igAccountId?: string | null;
    profile_picture_url?: string | null;
  }> | null;
  mediaKitSlug?: string | null;
  whatsappPhone?: string | null;
  whatsappVerified?: boolean;
}

const PARTNER_FIELDS = "_id name username instagramUsername image providerImage profile_picture_url isInstagramConnected instagramAccountId availableIgAccounts mediaKitSlug whatsappPhone whatsappVerified";

/** Monta o parceiro no shape NarrativeCollabMatch que a UI de match já consome. */
function buildMatchPayload(
  user: PartnerUserLean,
  interest: Pick<
    ICollabInterest,
    | "fitReason"
    | "sharedSignal"
    | "recordingIdea"
    | "collabBlueprint"
    | "collabMode"
    | "viewerContribution"
    | "partnerContribution"
  >,
): NarrativeCollabMatch {
  const handle = user.username ?? user.instagramUsername ?? null;
  return {
    id: user._id.toString(),
    name: user.name ?? "Criador",
    username: typeof handle === "string" ? handle : null,
    avatarUrl: resolveCreatorAvatar(user),
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
    viewerContribution: interest.viewerContribution ?? null,
    partnerContribution: interest.partnerContribution ?? null,
    narrativeMatch: true,
    planNeedsReview: true,
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

// ─── Registro da decisão ──────────────────────────────────────────────────────

export async function registerCollabDecision(
  input: RegisterCollabDecisionInput,
): Promise<RegisterCollabDecisionResult> {
  // Escritas novas exigem proposta versionada. Este adaptador só existe para
  // clientes legados receberem uma resposta clara em vez de criar matches por território.
  return { ok: false, matched: false, match: null, error: "refresh_required" };
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
  let partnersById = new Map<string, PartnerUserLean>();
  if (docs.length > 0) {
    const partnerIds = [...new Set(docs.map((d) => String(d.partner)))];
    const partners = await UserModel.find({ _id: { $in: partnerIds } })
      .select(PARTNER_FIELDS)
      .lean<PartnerUserLean[]>();
    const byId = new Map(partners.map((p) => [p._id.toString(), p]));
    partnersById = byId;
    matches = matched.flatMap((d) => {
      const partner = byId.get(String(d.partner)) || (d.partner ? { _id: d.partner, name: 'Perfil indisponível' } : null);
      // isNew = casou mas este criador ainda não viu a comemoração (estava fora
      // quando o outro topou) → o shell dispara a festa na volta.
      return partner ? [{
        pautaId: d.pautaId,
        pautaSnapshot: {
          id: d.pautaId,
          title: cleanIdeaText(d.pautaTitle ?? ""),
          territory: d.pautaTerritory ?? null,
        },
        collab: buildMatchPayload(partner, d),
        isNew: !d.celebratedAt,
      }] : [];
    });
  }

  return {
    ok: true,
    decisions: pending.map((d) => ({ pautaId: d.pautaId, pautaTitle: d.pautaTitle, territory: d.pautaTerritory, decision: d.decision, expiresAt: d.expiresAt?.toISOString(), collab: partnersById.has(String(d.partner)) ? buildMatchPayload(partnersById.get(String(d.partner))!, d) : undefined })),
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
