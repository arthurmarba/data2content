import { createHash } from "node:crypto";
import { Types, type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import Evidence from "@/app/models/PublishedContentEvidence";
import AccountInsight from "@/app/models/AccountInsight";
import { getMcpAppBaseUrl } from "./config";
import { resolveMcpPeriodWindow, type McpPeriodContentFormat } from "./periodAnalysis";

export type AdminPopulationFilter = {
  population?: "creators" | "all_accounts";
  connection?: "all" | "connected" | "disconnected";
  query?: string;
};
export type AdminPortfolioInput = AdminPopulationFilter & {
  startDate: string; endDate: string; timeZone: string;
  format?: McpPeriodContentFormat;
  page?: number; limit?: number;
  sortBy?: "interactions" | "engagement" | "reach" | "needs_attention" | "follower_gain";
  /** Somente adaptadores administrativos autenticados podem escolher os alvos. */
  creatorIds?: string[];
};
const MAX_TIME_MS = 12000;
const connectedQuery = { isInstagramConnected: true, instagramAccountId: { $exists: true, $nin: [null, ""] } };
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function adminPopulationQuery(input: AdminPopulationFilter): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];
  if (input.population !== "all_accounts") clauses.push({ role: { $nin: ["admin", "agency"] } });
  if (input.connection === "connected") clauses.push(connectedQuery);
  if (input.connection === "disconnected") clauses.push({ $nor: [connectedQuery] });
  const query = (input.query || "").trim().replace(/^@/, "").slice(0, 160);
  if (query) {
    if (/^[a-f0-9]{24}$/i.test(query)) clauses.push({ _id: new Types.ObjectId(query) });
    else {
      const value = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      clauses.push({ $or: [{ name: value }, { username: value }] });
    }
  }
  return clauses.length ? { $and: clauses } : {};
}

function creatorIdentity(row: Record<string, any>) {
  const id = String(row._id);
  return { id: `creator:${id}`, name: typeof row.name === "string" ? row.name.slice(0,160) : null,
    username: typeof row.username === "string" ? row.username.slice(0,100) : null,
    instagramConnected: row.isInstagramConnected === true && Boolean(row.instagramAccountId),
    url: `${getMcpAppBaseUrl()}/admin/creators-management?creatorId=${id}` };
}

/** Cursor por identidade, não offset: permite percorrer a base inteira sem carregar tudo no chat. */
export async function listMcpAdminCreators(input: AdminPopulationFilter & { cursor?: string; limit?: number }) {
  const filter = adminPopulationQuery(input);
  const queryHash = fingerprint({ population: input.population || "creators", connection: input.connection || "all", query: (input.query || "").trim().replace(/^@/, "").toLowerCase() });
  let after: string | null = null;
  if (input.cursor) {
    try {
      const value = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8"));
      if (value.version !== 1 || value.queryHash !== queryHash || !/^[a-f0-9]{24}$/i.test(value.after)) throw new Error();
      after = value.after;
    } catch { throw new Error("invalid_admin_cursor"); }
  }
  const limit = Math.min(100, Math.max(1, input.limit || 50));
  await connectToDatabase();
  const [total, rows] = await Promise.all([
    User.countDocuments(filter).maxTimeMS(MAX_TIME_MS),
    User.find(after ? { $and: [filter, { _id: { $gt: new Types.ObjectId(after) } }] } : filter)
      .select("_id name username isInstagramConnected instagramAccountId")
      .sort({ _id: 1 }).limit(limit + 1).maxTimeMS(MAX_TIME_MS).lean<any[]>(),
  ]);
  const selected = rows.slice(0,limit);
  return { schemaVersion: "admin_creator_directory_v1", creators: selected.map(creatorIdentity),
    pagination: { total, returned: selected.length, hasMore: rows.length > limit,
      nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({ version: 1, queryHash, after: String(selected.at(-1)!._id) })).toString("base64url") : null },
    receipt: { generatedAt: new Date().toISOString(), population: input.population || "creators", queryHash,
      universe: input.population === "all_accounts" ? "all_registered_accounts" : "registered_accounts_except_admin_and_agency",
      includesDisconnectedAndWithoutContent: input.connection === undefined || input.connection === "all",
      snapshotIsFrozen: false, mustFollowPaginationForAllCreators: true } };
}

const validNumber = (path: unknown) => ({ $and: [{ $isNumber: path }, { $gte: [path, 0] }, { $lte: [path, Number.MAX_VALUE] }] });
const metricKeys = ["reach", "views", "total_interactions", "saved", "shares", "comments"] as const;
const countIf = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });
const metricPath = (key: string): any => key === "views" ? { $ifNull: ["$stats.views", "$stats.video_views"] } : `$stats.${key}`;
const VIDEO_TYPES = ["REEL", "VIDEO"];
/** Foto e carrossel: sem áudio, mas com leitura visual própria. */
const STILL_TYPES = ["IMAGE", "CAROUSEL_ALBUM", "CAROUSEL"];

/** Agregação completa dos registros armazenados; não uma amostra dos maiores criadores. */
export function buildAdminPortfolioPipeline(input: AdminPortfolioInput): PipelineStage[] {
  const window = resolveMcpPeriodWindow({ ...input, maxDays: 366 });
  const previousStart = new Date(window.startInclusive.getTime() - (window.endExclusive.getTime() - window.startInclusive.getTime()));
  const current = { $gte: ["$postDate", window.startInclusive] };
  const previous = { $lt: ["$postDate", window.startInclusive] };
  const isVideo = { $in: ["$type", VIDEO_TYPES] };
  const isStill = { $in: ["$type", STILL_TYPES] };
  const readAs = (field: "speech" | "visual") => ({ $eq: [{ $arrayElemAt: [`$readingEvidence.${field}`, 0] }, true] });
  const group: Record<string, any> = { _id: null, posts: countIf(current), previousPosts: countIf(previous),
    lastMetricDocumentUpdate: { $max: "$updatedAt" },
    classified: countIf({ $and: [current, { $eq: ["$classificationStatus", "completed"] }] }),
    // Fala é coisa de vídeo. Leitura visual existe para os dois, e contá-las
    // juntas faria a foto lida desaparecer atrás de "vídeo sem transcrição".
    observed: countIf({ $and: [current, isVideo, readAs("speech")] }),
    videos: countIf({ $and: [current, isVideo] }),
    stills: countIf({ $and: [current, isStill] }),
    stillsVisuallyRead: countIf({ $and: [current, isStill, readAs("visual")] }),
  };
  for (const key of metricKeys) for (const [prefix, condition] of [["current", current], ["previous", previous]] as const) {
    const path = metricPath(key);
    const eligible = { $and: [condition, validNumber(path)] };
    group[`${prefix}_${key}`] = { $sum: { $cond: [eligible, path, 0] } };
    group[`${prefix}_${key}_available`] = countIf(eligible);
  }
  for (const [prefix, condition] of [["current", current], ["previous", previous]] as const) {
    // Numerador e denominador precisam pertencer aos mesmos posts.
    const eligible = { $and: [condition, validNumber("$stats.total_interactions"), validNumber("$stats.reach"), { $gt: ["$stats.reach", 0] }] };
    group[`${prefix}_pairedPosts`] = countIf(eligible);
    group[`${prefix}_pairedReach`] = { $sum: { $cond: [eligible, "$stats.reach", 0] } };
    group[`${prefix}_pairedInteractions`] = { $sum: { $cond: [eligible, "$stats.total_interactions", 0] } };
  }
  // Quanto voltar atrás para achar a leitura de referência do saldo de seguidores.
  const baselineFrom = new Date(window.startInclusive.getTime() - 30 * 86_400_000);
  const filter = adminPopulationQuery(input);
  if (input.creatorIds) {
    if (!input.creatorIds.length || input.creatorIds.length > 5 || input.creatorIds.some(id => !/^[a-f0-9]{24}$/i.test(id))) throw new Error("invalid_admin_creator_ids");
    filter._id = { $in: input.creatorIds.map(id => new Types.ObjectId(id)) };
  }
  const formatQuery = input.format && input.format !== "all"
    ? { type: input.format === "reel" ? { $in: VIDEO_TYPES }
        : input.format === "carousel" ? { $in: ["CAROUSEL_ALBUM", "CAROUSEL"] } : "IMAGE" } : {};
  const summary: Record<string, any> = { _id: null, totalCreators: { $sum: 1 },
    creatorsWithPosts: countIf({ $gt: ["$stats.posts", 0] }),
    disconnected: countIf({ $not: ["$connected"] }),
    followerNetGain: { $sum: { $ifNull: ["$followerGrowth.netGain", 0] } },
    creatorsWithMeasuredFollowerGain: countIf({ $ne: [{ $ifNull: ["$followerGrowth.netGain", null] }, null] }),
    creatorsGainingFollowers: countIf({ $gt: [{ $ifNull: ["$followerGrowth.netGain", 0] }, 0] }),
    creatorsLosingFollowers: countIf({ $lt: [{ $ifNull: ["$followerGrowth.netGain", 0] }, 0] }),
    creatorsMeasuredFromInsidePeriod: countIf({ $and: [{ $ne: [{ $ifNull: ["$followerGrowth.netGain", null] }, null] },
      { $eq: ["$followerGrowth.hasBaselineBeforePeriod", false] }] }),
    posts: { $sum: "$stats.posts" }, previousPosts: { $sum: "$stats.previousPosts" },
    classified: { $sum: "$stats.classified" }, observed: { $sum: "$stats.observed" }, videos: { $sum: "$stats.videos" },
    stills: { $sum: "$stats.stills" }, stillsVisuallyRead: { $sum: "$stats.stillsVisuallyRead" } };
  for (const key of Object.keys(group).filter(key => key.startsWith("current_") || key.startsWith("previous_"))) summary[key] = { $sum: `$stats.${key}` };
  const order = input.sortBy === "engagement" ? "engagement"
    : input.sortBy === "reach" ? "stats.current_reach"
    : input.sortBy === "needs_attention" ? "attentionPriority"
    : input.sortBy === "follower_gain" ? "followerGrowth.netGain"
    : "stats.current_total_interactions";
  const limit = Math.max(1,Math.min(100,input.limit || 25));
  return [
    { $match: filter },
    { $project: { _id: 1, name: 1, username: 1, isInstagramConnected: 1, instagramAccountId: 1 } },
    { $lookup: { from: Metric.collection.name, let: { owner: "$_id" }, as: "stats", pipeline: [
      { $match: { $expr: { $eq: ["$user", "$$owner"] }, postDate: { $gte: previousStart, $lt: window.endExclusive }, ...formatQuery } },
      // Uma leitura só, dois sinais: fala observada (vídeo) e cena lida (qualquer
      // formato). O array nunca traz texto, só dois booleanos.
      { $lookup: { from: Evidence.collection.name, let: { metric: "$_id", owner: "$user", isCurrent: current }, as: "readingEvidence", pipeline: [
        { $match: { $expr: { $and: ["$$isCurrent", { $eq: ["$metricId", "$$metric"] }, { $eq: ["$userId", "$$owner"] }] } } },
        { $project: { _id: 0,
          speech: { $and: [{ $eq: ["$transcript.source", "gemini_video"] }, { $gte: [{ $ifNull: ["$transcript.wordCount", 0] }, 8] }, { $eq: ["$completeness.transcript", true] }] },
          visual: { $and: [{ $eq: ["$completeness.scenes", true] }, { $gt: [{ $size: { $ifNull: ["$scenes", []] } }, 0] }] } } },
        { $limit: 1 },
      ] } },
      { $group: group },
    ] } },
    { $set: { stats: { $ifNull: [{ $arrayElemAt: ["$stats", 0] }, {}] },
      connected: { $and: [{ $eq: ["$isInstagramConnected", true] }, { $ne: [{ $ifNull: ["$instagramAccountId", ""] }, ""] }] } } },
    // Saldo de seguidores: a última leitura dentro da janela contra a última
    // anterior a ela. Um único $sort por criador resolve as duas pontas, porque
    // o $group separa "antes da janela" de "dentro dela".
    { $lookup: { from: AccountInsight.collection.name, let: { owner: "$_id" }, as: "followerReadings", pipeline: [
      { $match: { $expr: { $eq: ["$user", "$$owner"] },
        recordedAt: { $gte: baselineFrom, $lt: window.endExclusive }, followersCount: { $type: "number" } } },
      { $sort: { recordedAt: 1 } },
      { $group: { _id: { $lt: ["$recordedAt", window.startInclusive] },
        followers: { $last: "$followersCount" }, at: { $last: "$recordedAt" },
        firstFollowers: { $first: "$followersCount" }, firstAt: { $first: "$recordedAt" }, readings: { $sum: 1 } } },
    ] } },
    { $set: {
      followersBefore: { $first: { $filter: { input: "$followerReadings", as: "row", cond: { $eq: ["$$row._id", true] } } } },
      followersInside: { $first: { $filter: { input: "$followerReadings", as: "row", cond: { $eq: ["$$row._id", false] } } } },
    } },
    { $set: {
      hasBaseline: { $ne: [{ $ifNull: ["$followersBefore.followers", null] }, null] },
      readingsInPeriod: { $ifNull: ["$followersInside.readings", 0] },
    } },
    // Sem leitura anterior à janela, a primeira leitura de dentro vira o ponto de
    // partida — e o intervalo medido encolhe. Isso é dito em measuredFromDate,
    // nunca escondido atrás de um saldo que pareceria cobrir o período inteiro.
    { $set: { startFollowers: { $cond: ["$hasBaseline", "$followersBefore.followers", { $ifNull: ["$followersInside.firstFollowers", null] }] },
      startAt: { $cond: ["$hasBaseline", "$followersBefore.at", { $ifNull: ["$followersInside.firstAt", null] }] } } },
    { $set: { followerGrowth: {
      // Uma leitura só, sem referência anterior, daria saldo zero por construção:
      // início e fim seriam o mesmo número. Isso é ausência de medida, não estabilidade.
      netGain: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$startFollowers", null] }, null] },
          { $ne: [{ $ifNull: ["$followersInside.followers", null] }, null] },
          { $or: ["$hasBaseline", { $gt: ["$readingsInPeriod", 1] }] }] },
        { $subtract: ["$followersInside.followers", "$startFollowers"] }, null] },
      followersAtStart: { $ifNull: ["$startFollowers", null] },
      followersAtEnd: { $ifNull: ["$followersInside.followers", null] },
      readingsInPeriod: "$readingsInPeriod",
      hasBaselineBeforePeriod: "$hasBaseline",
      measuredFromDate: { $ifNull: ["$startAt", null] },
      lastReadingAt: { $ifNull: ["$followersInside.at", null] },
    } } },
    { $unset: ["followerReadings", "followersBefore", "followersInside", "hasBaseline", "readingsInPeriod", "startFollowers", "startAt"] },
    { $set: { engagement: { $cond: [{ $gt: ["$stats.current_pairedReach", 0] }, { $divide: ["$stats.current_pairedInteractions", "$stats.current_pairedReach"] }, null] },
      attentionPriority: { $add: [{ $cond: ["$connected", 0, 4] }, { $cond: [{ $gt: ["$stats.posts", 0] }, 0, 2] },
        { $cond: [{ $gt: ["$stats.videos", "$stats.observed"] }, 1, 0] },
        { $cond: [{ $gt: ["$stats.stills", "$stats.stillsVisuallyRead"] }, 1, 0] }] } } },
    { $facet: { summary: [{ $group: summary }], creators: [{ $sort: { [order]: -1, _id: 1 } },
      { $skip: (Math.max(1,Math.min(10000,input.page || 1))-1)*limit }, { $limit: limit }] } },
  ];
}

export function normalizeFollowerGrowth(value: any) {
  const number = (input: unknown) => (typeof input === "number" && Number.isFinite(input) ? input : null);
  return {
    netGain: number(value?.netGain),
    followersAtStart: number(value?.followersAtStart),
    followersAtEnd: number(value?.followersAtEnd),
    readingsInPeriod: number(value?.readingsInPeriod) ?? 0,
    hasBaselineBeforePeriod: value?.hasBaselineBeforePeriod === true,
    measuredFromDate: value?.measuredFromDate ? new Date(value.measuredFromDate).toISOString() : null,
    lastReadingAt: value?.lastReadingAt ? new Date(value.lastReadingAt).toISOString() : null,
  };
}

export function summarizeAdminMetricWindow(stats: Record<string, any>, prefix: "current" | "previous") {
  const posts = Number(stats[prefix === "current" ? "posts" : "previousPosts"] || 0);
  const metrics = Object.fromEntries(metricKeys.map(key => {
    const available = Number(stats[`${prefix}_${key}_available`] || 0);
    const total = available ? Number(stats[`${prefix}_${key}`]) : null;
    return [key, { sum: total, averagePerAvailablePost: available ? total! / available : null, availablePosts: available, totalPosts: posts }];
  }));
  const reach = Number(stats[`${prefix}_pairedReach`] || 0);
  return { posts, metrics, engagement: { value: reach > 0 ? Number(stats[`${prefix}_pairedInteractions`] || 0)/reach : null,
    method: "sum_interactions_over_sum_reach_on_same_eligible_posts", eligiblePosts: Number(stats[`${prefix}_pairedPosts`] || 0) } };
}

export async function analyzeMcpAdminPortfolio(input: AdminPortfolioInput) {
  const window = resolveMcpPeriodWindow(input);
  const previousStart = new Date(window.startInclusive.getTime() - (window.endExclusive.getTime()-window.startInclusive.getTime()));
  const pipeline = buildAdminPortfolioPipeline(input);
  await connectToDatabase();
  const [result] = await User.aggregate(pipeline).option({ maxTimeMS: MAX_TIME_MS, allowDiskUse: false });
  const summary = result?.summary?.[0] || {};
  const creators = (result?.creators || []).map((row: any) => {
    const stats = row.stats || {};
    const current = summarizeAdminMetricWindow(stats,"current");
    const previous = summarizeAdminMetricWindow(stats,"previous");
    const warnings = [!row.connected ? "instagram_disconnected_historical_data" : "",
      !current.posts ? "no_posts_in_period" : "", stats.videos > stats.observed ? "observed_transcript_coverage_partial" : "",
      stats.stills > stats.stillsVisuallyRead ? "photo_visual_reading_coverage_partial" : "",
      current.engagement.eligiblePosts < current.posts ? "engagement_coverage_partial" : "",
      typeof row.followerGrowth?.netGain !== "number" ? "follower_balance_unavailable" : ""].filter(Boolean);
    return { creator: creatorIdentity(row), current, previous,
      followerGrowth: normalizeFollowerGrowth(row.followerGrowth),
      change: { engagementPercentagePoints: current.engagement.value !== null && previous.engagement.value !== null
        ? (current.engagement.value-previous.engagement.value)*100 : null,
        comparableCoverage: current.posts > 0 && previous.posts > 0 && current.engagement.eligiblePosts === current.posts && previous.engagement.eligiblePosts === previous.posts },
      coverage: { classifiedPosts: Number(stats.classified || 0),
        videos: Number(stats.videos || 0), observedTranscripts: Number(stats.observed || 0),
        photosAndCarousels: Number(stats.stills || 0), photosAndCarouselsVisuallyRead: Number(stats.stillsVisuallyRead || 0), warnings },
      lastMetricDocumentUpdate: stats.lastMetricDocumentUpdate || null };
  });
  const total = Number(summary.totalCreators || 0), limit = Math.max(1,Math.min(100,input.limit || 25)), page = Math.max(1,Math.min(10000,input.page || 1));
  return { schemaVersion: "admin_creator_portfolio_v1", requestedPeriod: { ...window, previousStartInclusive: previousStart, previousEndExclusive: window.startInclusive },
    summary: { totalCreators: total, creatorsWithPosts: Number(summary.creatorsWithPosts || 0), disconnectedCreators: Number(summary.disconnected || 0),
      current: summarizeAdminMetricWindow(summary,"current"), previous: summarizeAdminMetricWindow(summary,"previous"),
      classifiedPosts: Number(summary.classified || 0), observedTranscripts: Number(summary.observed || 0), videos: Number(summary.videos || 0),
      photosAndCarousels: Number(summary.stills || 0), photosAndCarouselsVisuallyRead: Number(summary.stillsVisuallyRead || 0),
      followerGrowth: {
        // Só entra na soma quem tem as duas pontas medidas; os demais aparecem
        // na diferença entre creatorsMeasured e totalCreators.
        netGain: Number(summary.creatorsWithMeasuredFollowerGain || 0) ? Number(summary.followerNetGain || 0) : null,
        creatorsMeasured: Number(summary.creatorsWithMeasuredFollowerGain || 0),
        creatorsGaining: Number(summary.creatorsGainingFollowers || 0),
        creatorsLosing: Number(summary.creatorsLosingFollowers || 0),
        // Estes entram na soma, mas o intervalo deles começa dentro do período:
        // o saldo cobre menos dias que o dos demais.
        creatorsMeasuredFromInsidePeriod: Number(summary.creatorsMeasuredFromInsidePeriod || 0),
      } },
    creators, pagination: { page, limit, total, nextPage: page*limit < total ? page+1 : null },
    receipt: { generatedAt: new Date().toISOString(), queryFingerprint: fingerprint(input), source: "stored_metrics_complete_filtered_population",
      population: input.population || "creators", format: input.format || "all", sortBy: input.sortBy || "interactions",
      summaryCoversAllMatchingCreators: true, rowsArePaginated: true, snapshotIsFrozen: false, usesCurrentLifetimeMetricsOfPostsPublishedInWindow: true,
      priorWindowIsEqualElapsedDuration: true, reachIsSumAcrossPostsNotUniquePeople: true, noPaidModelCalls: true,
      followerGainIsNetAndDerivedFromAccountReadings: true,
      warnings: ["Resultado histórico é associação, não causalidade.", "Posts mais antigos tiveram mais tempo para acumular resultado; períodos não são retratos congelados.",
        "Sem publicações no banco não comprova ausência de publicações no Instagram.", "Prioridade de atenção representa lacunas operacionais, não qualidade do criador.",
        "observedTranscripts conta fala e só existe em vídeo; foto e carrossel têm leitura visual própria em photosAndCarouselsVisuallyRead.",
        "Saldo de seguidores é líquido e derivado de duas leituras de conta; não é o total de quem começou a seguir, e não pertence a nenhum post.",
        "Criador sem leitura antes do período tem o saldo medido a partir da primeira leitura de dentro dele; measuredFromDate diz onde a conta começou.",
        "Criador com uma única leitura no período fica sem saldo — início e fim seriam o mesmo número, o que não é estabilidade.",
        "Compare taxas somente junto da cobertura e do tamanho da amostra; não misture ranking absoluto com qualidade editorial."] } };
}
