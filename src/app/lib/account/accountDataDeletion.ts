import mongoose, { Types, type ClientSession } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { deleteContentAnalysisThumbnails } from "@/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage";

/**
 * O que acontece com cada dado ligado a uma conta quando ela é excluída.
 * Decisão de 09/10/2026: docs/plano-exclusao-de-conta-2026-10-09.md.
 *
 * delete: o documento sai. pull: a conta sai de uma lista e o resto fica.
 * anonymize: o registro fica e a conta vira um marcador (custo do Gemini).
 *
 * Coleção nova com dono precisa entrar aqui ou em ACCOUNT_DATA_KEPT; o teste
 * accountDataCoverage.test.ts falha se não entrar.
 */
export type AccountDataRule =
  | { collection: string; field: string; action: "delete" }
  | { collection: string; field: string; action: "pull" }
  | { collection: string; field: string; action: "anonymize"; marker: string; inArray?: string };

export const REMOVED_ACCOUNT_MARKER = "conta-removida";
export const REMOVED_CREATOR_LABEL = "Criador removido";

const del = (collection: string, field: string): AccountDataRule => ({ collection, field, action: "delete" });

export const ACCOUNT_DATA_RULES: readonly AccountDataRule[] = [
  // Instagram e números. Os filhos de metrics saem antes (ACCOUNT_DATA_CHILDREN).
  del("metrics", "user"),
  del("accountinsights", "user"),
  del("audience_demographic_snapshots", "user"),
  del("instagram_new_followers_days", "user"),
  del("storymetrics", "user"),
  del("dailymetrics", "user"),
  del("published_content_evidence", "userId"),
  del("user_usage_snapshots", "user"),
  // Mapa e estratégia
  del("mapasseed", "userId"),
  del("creatormapconfirmations", "userId"),
  del("creatorstrategicprofilesnapshots", "userId"),
  del("creatorvideonarrativediagnoses", "userId"),
  del("creator_video_narrative_real_analysis_usage", "userId"),
  del("creatorweeklyreports", "userId"),
  del("strategicreports", "user"),
  del("alerts", "user"),
  del("planner_plans", "userId"),
  del("plannerreccaches", "userId"),
  del("planning_recommendation_feedback", "userId"),
  del("creatorcontentideas", "userId"),
  del("contentideaquotas", "userId"),
  // Roteiros e criação
  del("script_entries", "userId"),
  del("creator_script_dna_profiles", "userId"),
  del("script_style_profiles", "userId"),
  del("script_outcome_profiles", "userId"),
  del("aigeneratedposts", "userId"),
  del("post_creation_drafts", "userId"),
  del("post_creation_funnel_events", "userId"),
  del("carouselcasedrafts", "creatorId"),
  // Chat antigo. Mensagens e revisões saem antes, pelo pai.
  del("threads", "userId"),
  del("chat_sessions", "userId"),
  del("chat_message_logs", "userId"),
  del("chat_message_feedback", "userId"),
  del("chat_session_feedback", "userId"),
  // Mídia kit e publis
  del("mediakitpackages", "userId"),
  del("mediakitslugaliases", "user"),
  del("mediakitaccesslogs", "user"),
  del("publicalculations", "userId"),
  del("brandproposals", "userId"),
  del("brandnarrativereports", "userId"),
  del("sharedlinks", "userId"),
  del("campaignlinks", "userId"),
  del("addeals", "userId"),
  // Collabs e comunidade. A combinação com outra pessoa sai inteira.
  del("collabinterests", "user"),
  del("collabinterests", "partner"),
  del("collabmatches", "userA"),
  del("collabmatches", "userB"),
  del("collabproposals", "originUserId"),
  { collection: "collabproposals", field: "acceptedBy", action: "pull" },
  del("collabjobs", "userId"),
  del("perpautacollabcaches", "user"),
  del("communityinspirations", "originalCreatorId"),
  // Uso do app, vídeo e acessos
  del("usage_events", "userId"),
  del("videoassets", "userId"),
  del("videoanalysisjobs", "userId"),
  del("creator_research_review_grants", "owner"),
  del("instagram_marketplace_connections", "owner"),
  // Conector (também sai na transação da exclusão, ver lib/mcp/accountDeletion.ts)
  del("mcp_oauth_refresh_tokens", "userId"),
  del("mcp_oauth_authorization_codes", "userId"),
  del("mcp_oauth_consent_requests", "userId"),
  del("mcp_tool_call_logs", "userId"),
  del("mcp_usage_daily", "userId"),
  del("script_evidence_sessions", "userId"),
  // Custo do Gemini: o gasto fica, a conta não.
  { collection: "gemini_operations", field: "creatorId", action: "anonymize", marker: REMOVED_ACCOUNT_MARKER },
  { collection: "geminiusagelogs", field: "creatorId", action: "anonymize", marker: REMOVED_ACCOUNT_MARKER },
  { collection: "gemini_batch_jobs", field: "items.creatorId", action: "anonymize", marker: REMOVED_ACCOUNT_MARKER, inArray: "items" },
];

/** Filhos que só se acham pelo pai: saem antes dele. */
export const ACCOUNT_DATA_CHILDREN: readonly {
  parent: string;
  ownerField: string;
  children: readonly { collection: string; field: string; key?: "string" }[];
}[] = [
  {
    parent: "metrics",
    ownerField: "user",
    children: [
      { collection: "daily_metric_snapshots", field: "metric" },
      { collection: "postreviews", field: "postId" },
      { collection: "published_content_evidence", field: "metricId" },
      // A chave do estado de leitura é o id do post em texto.
      { collection: "content_reading_states", field: "_id", key: "string" },
    ],
  },
  { parent: "threads", ownerField: "userId", children: [{ collection: "messages", field: "threadId" }] },
  { parent: "chat_sessions", ownerField: "userId", children: [{ collection: "chat_session_reviews", field: "sessionId" }] },
];

/** Estados de leitura com chave própria da conta (mapa e jeito de criar). */
export function ownedReadingStateKeys(userId: string): string[] {
  return [`dna:${userId}`, `mapa:instagram:${userId}`];
}

/**
 * Campos com conta que ficam de propósito. Coleção sem modelo não aparece aqui
 * porque o teste de cobertura só enxerga modelos.
 */
export const ACCOUNT_DATA_KEPT: Readonly<Record<string, string>> = {
  "users.mergedIntoUserId": "a própria conta",
  "users.commissionLog.affiliateUserId": "financeiro de afiliado",
  "users.commissionLog.buyerUserId": "financeiro de afiliado",
  "redemptions.userId": "financeiro de afiliado (a exclusão é bloqueada)",
  "affiliatemigrationaudits.userId": "financeiro de afiliado",
  "acquisition_journeys.userId": "jornada de anúncio: pseudônima por até 400 dias (política)",
  "acquisition_events.userId": "jornada de anúncio: pseudônima por até 400 dias (política)",
  "mcp_admin_audit_events.actorUserId": "registro da equipe",
  "mcp_admin_audit_events.targetCreatorIds": "registro da equipe",
  "script_entries.recommendedByAdminId": "equipe",
  "script_entries.adminAnnotationUpdatedById": "equipe",
  "postreviews.reviewedBy": "equipe (a revisão sai com o post)",
  "brandnarrativeprofiles.createdBy": "equipe",
  "brandnarrativeprofiles.validatedBy": "equipe",
  "strategicreports.requestedBy": "equipe",
  "featureflags.updatedBy": "equipe",
  "community_events.createdBy": "equipe",
  "community_events.updatedBy": "equipe",
  "chat_session_reviews.reviewerId": "equipe (a revisão sai com a conversa)",
  "chat_session_reviews.reviewedBy": "equipe (a revisão sai com a conversa)",
  "campaign_radar_opportunities.review.reviewedBy": "equipe",
  "affiliatebuyercommissionindexes.affiliateUserId": "financeiro de afiliado",
  "affiliatebuyercommissionindexes.buyerUserId": "financeiro de afiliado",
  "affiliateinvoiceindexes.affiliateUserId": "financeiro de afiliado",
  "affiliaterefundprogresses.affiliateUserId": "financeiro de afiliado",
  "affiliatesubscriptionindexes.affiliateUserId": "financeiro de afiliado",
  "cronlocks.owner": "não é conta: quem segura a trava do cron",
};

export interface AccountDataDeletionReport {
  /** Documentos apagados (ou que seriam, no ensaio) por coleção.campo. */
  collections: Record<string, number>;
  files: number;
}

type Document = mongoose.mongo.Document;
type Collection = mongoose.mongo.Collection<Document>;
type Filter = mongoose.mongo.Filter<Document>;

const BATCH = 500;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/** Em lotes: uma conta antiga tem dezenas de milhares de retratos diários. */
async function removeWhere(collection: Collection, filter: Filter, dryRun: boolean) {
  if (dryRun) return collection.countDocuments(filter);
  let removed = 0;
  for (;;) {
    const batch = await collection.find(filter, { projection: { _id: 1 }, limit: BATCH }).toArray();
    if (!batch.length) return removed;
    const { deletedCount } = await collection.deleteMany({ _id: { $in: batch.map((doc) => doc._id) } });
    if (!deletedCount) return removed;
    removed += deletedCount;
  }
}

/**
 * Apaga o que a conta deixou no banco e no R2, depois que o User já saiu.
 * Pode rodar de novo sem estragar nada: o que já saiu não é achado outra vez.
 * Com dryRun, só conta.
 */
export async function deleteAccountData(
  userId: string,
  options: { dryRun?: boolean } = {},
): Promise<AccountDataDeletionReport> {
  if (!Types.ObjectId.isValid(userId)) throw new Error("invalid_user_id");
  const dryRun = options.dryRun === true;
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("database_unavailable");

  // O dono aparece como ObjectId ou como texto, conforme a coleção.
  const owner = { $in: [new Types.ObjectId(userId), userId] };
  const counts: Record<string, number> = {};
  const add = (key: string, count: number) => { counts[key] = (counts[key] ?? 0) + count; };

  // Primeiro as capas no R2: a pasta não pode ser listada, então o nome de cada
  // capa sai das análises de vídeo, que precisam ainda estar no banco. Se o R2
  // falhar, nada do banco saiu e a fila tenta de novo.
  const analyses = await db.collection("creatorvideonarrativediagnoses")
    .find({ userId: owner, thumbnailStatus: "available" }, { projection: { diagnosisId: 1 } })
    .toArray();
  const files = await deleteContentAnalysisThumbnails(
    userId,
    analyses.map((analysis) => String(analysis.diagnosisId ?? "")).filter(Boolean),
    { dryRun },
  );

  for (const group of ACCOUNT_DATA_CHILDREN) {
    const parents = await db.collection(group.parent)
      .find({ [group.ownerField]: owner }, { projection: { _id: 1 } })
      .toArray();
    for (const ids of chunks(parents.map((doc) => doc._id), BATCH)) {
      for (const child of group.children) {
        const values = child.key === "string" ? ids.map(String) : [...ids, ...ids.map(String)];
        add(
          `${child.collection}.${child.field}`,
          await removeWhere(db.collection(child.collection), { [child.field]: { $in: values } }, dryRun),
        );
      }
    }
  }

  add(
    "content_reading_states._id",
    await removeWhere(
      db.collection("content_reading_states"),
      { _id: { $in: ownedReadingStateKeys(userId) } } as unknown as Filter,
      dryRun,
    ),
  );

  for (const rule of ACCOUNT_DATA_RULES) {
    const collection = db.collection(rule.collection);
    const filter = { [rule.field]: owner };
    const key = `${rule.collection}.${rule.field}`;
    if (rule.action === "delete") {
      add(key, await removeWhere(collection, filter, dryRun));
    } else if (dryRun) {
      add(key, await collection.countDocuments(filter));
    } else if (rule.action === "pull") {
      add(key, (await collection.updateMany(filter, { $pull: { [rule.field]: owner } } as Document)).modifiedCount);
    } else if (rule.inArray) {
      // O id mora dentro de uma lista: troca só nos itens da conta.
      const leaf = rule.field.slice(rule.inArray.length + 1);
      add(key, (await collection.updateMany(
        filter,
        { $set: { [`${rule.inArray}.$[item].${leaf}`]: rule.marker } },
        { arrayFilters: [{ [`item.${leaf}`]: owner }] },
      )).modifiedCount);
    } else {
      add(key, (await collection.updateMany(filter, { $set: { [rule.field]: rule.marker } })).modifiedCount);
    }
  }

  return { collections: counts, files };
}

/**
 * Os relatórios semanais da comunidade já fechados guardam o nome de quem se
 * destacou. O nome sai; os números da semana ficam (decisão de 09/10/2026).
 * Roda na transação da exclusão, enquanto o nome ainda é conhecido.
 */
export async function anonymizeCreatorInCommunityReports(
  creatorName: string | null | undefined,
  session?: ClientSession,
): Promise<number> {
  const name = creatorName?.trim();
  if (!name) return 0;
  const db = mongoose.connection.db;
  if (!db) throw new Error("database_unavailable");
  const result = await db.collection("weekly_territory_reports").updateMany(
    { highlightWinners: name },
    { $set: { "highlightWinners.$[winner]": REMOVED_CREATOR_LABEL } },
    { arrayFilters: [{ winner: name }], ...(session ? { session } : {}) },
  );
  return result.modifiedCount;
}
