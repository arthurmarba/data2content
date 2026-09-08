import { randomUUID } from "node:crypto";
import State from "@/app/models/ContentReadingState";
import Metric from "@/app/models/Metric";
import Evidence from "@/app/models/PublishedContentEvidence";
import { connectToDatabase } from "@/app/lib/mongoose";

const EPOCH = new Date(0);
export function classifyReadingFailure(message: string) {
  if (/temporariamente pausado/i.test(message)) return { reason: "provider_paused", delayMs: 6*3600000, terminal: false };
  if (/prepayment.*depleted|insufficient.*credit|saldo|billing|payment.required/i.test(message)) return { reason: "provider_balance", delayMs: 6*3600000, terminal: false };
  if (/sem token|token.*invalid|oauth|HTTP 401/i.test(message)) return { reason: "instagram_auth", delayMs: 24*3600000, terminal: false };
  if (/HTTP 404|deleted|exclu[ií]d|m[eé]trica n[aã]o encontrada/i.test(message)) return { reason: "media_deleted", delayMs: 30*86400000, terminal: true };
  if (/acima do teto|grande demais|incompat[ií]vel|sem m[ií]dia compat[ií]vel|sem instagramMediaId/i.test(message)) return { reason: "unsupported_media", delayMs: 30*86400000, terminal: true };
  if (/rate.?limit|quota|429|resource_exhausted/i.test(message)) return { reason: "provider_rate_limit", delayMs: 15*60000, terminal: false };
  if (/403/i.test(message)) return { reason: "media_url_expired", delayMs: 15*60000, terminal: false };
  return { reason: "temporary_failure", delayMs: 30*60000, terminal: false };
}
async function ensure(id: string, revision: string) {
  try {
    await State.updateOne({ _id: id }, { $setOnInsert: { revision, state: "pending", attempts: 0, nextAttemptAt: EPOCH, leaseUntil: EPOCH } }, { upsert: true });
  } catch (e: any) { if (e.code !== 11000) throw e; }
}
export async function acquireReading(metricId: string, revision: string) {
  await connectToDatabase();
  await ensure(metricId, revision);
  const now = new Date();
  const token = randomUUID();
  const state = await State.findOneAndUpdate({ _id: metricId, leaseUntil: { $lte: now },
    $or: [{ revision: { $ne: revision } }, { state: { $ne: "unsupported" }, nextAttemptAt: { $lte: now } }] },
  { $set: { state: "processing", leaseToken: token, leaseUntil: new Date(now.getTime()+360000) }, $inc: { attempts: 1 } }, { new: true }).lean();
  if (!state) return null;
  const result = state.revision === revision ? state.result : null;
  if (state.revision !== revision) await State.updateOne({ _id: metricId, leaseToken: token }, { $set: { revision, result: null, attempts: 1 } });
  return { token, result };
}
export async function checkpointReading(metricId: string, token: string, result: Record<string, any>) {
  const saved = await State.updateOne({ _id: metricId, leaseToken: token, state: "processing" }, { $set: { result } });
  if (saved.matchedCount !== 1) throw new Error("reading_lease_lost");
}
export async function finishReading(metricId: string, token: string, error?: string) {
  const failure = error ? classifyReadingFailure(error) : null;
  await State.updateOne({ _id: metricId, leaseToken: token }, { $set: {
    state: failure ? failure.terminal ? "unsupported" : "deferred" : "complete",
    reason: failure?.reason || null, leaseUntil: EPOCH, leaseToken: null,
    nextAttemptAt: failure ? new Date(Date.now()+failure.delayMs) : EPOCH,
  } });
  if (failure?.reason === "provider_balance") await pauseGemini();
}
export async function pauseGemini() {
  await connectToDatabase();
  await ensure("provider:gemini", "v1");
  await State.updateOne({ _id: "provider:gemini" }, { $set: { state: "paused", reason: "provider_balance", nextAttemptAt: new Date(Date.now()+6*3600000), leaseUntil: EPOCH } });
}
/** Após a pausa, somente um job pode testar a recuperação do provedor. */
export async function claimGeminiAvailability(): Promise<boolean> {
  await connectToDatabase();
  const state = await State.findById("provider:gemini").lean();
  if (!state || state.state === "healthy") return true;
  if (state.nextAttemptAt > new Date()) return false;
  const probe = await State.findOneAndUpdate({ _id: "provider:gemini", nextAttemptAt: { $lte: new Date() }, leaseUntil: { $lte: new Date() } },
    { $set: { state: "probing", leaseUntil: new Date(Date.now()+360000) } }, { new: true }).lean();
  return Boolean(probe);
}
export async function markGeminiHealthy() {
  await State.updateOne({ _id: "provider:gemini", state: "probing" }, { $set: { state: "healthy", nextAttemptAt: EPOCH, leaseUntil: EPOCH, reason: null } });
}
export async function eligibleReadingIds(ids: string[], revision: string) {
  const blocked = await State.find({ _id: { $in: ids }, revision, $or: [
    { state: "unsupported" }, { nextAttemptAt: { $gt: new Date() } }, { leaseUntil: { $gt: new Date() } },
  ] }).select("_id").lean();
  const excluded = new Set(blocked.map(s => s._id));
  return ids.filter(id => !excluded.has(id));
}
export function fairReadingBatch<T extends { _id: unknown; user?: unknown; stats?: Record<string, any> }>(rows: T[], limit: number): T[] {
  const groups = new Map<string,T[]>();
  const sorted = [...rows].sort((a,b) => {
    const score = (r: T) => r.stats?.reach > 0 && typeof r.stats?.total_interactions === "number" ? r.stats.total_interactions / r.stats.reach : -1;
    return score(b)-score(a) || String(a._id).localeCompare(String(b._id));
  });
  for (const r of sorted) { const id = String(r.user); groups.set(id,[...(groups.get(id)||[]),r]); }
  const result: T[] = [];
  while (result.length < limit && groups.size) for (const [id,list] of groups) {
    if (result.length === limit) break;
    result.push(list.shift()!); if (!list.length) groups.delete(id);
  }
  return result;
}

export async function findPendingReadingBatch(query: Record<string, unknown>, revision: string, limit: number) {
  const now = new Date();
  const rows = await Metric.aggregate([
    { $match: query },
    { $lookup: { from: Evidence.collection.name, localField: "_id", foreignField: "metricId", as: "readingEvidence", pipeline: [{ $project: { _id: 1 } }] } },
    { $match: { $or: [{ "sceneElements.version": { $ne: revision } }, { readingEvidence: { $size: 0 } }] } },
    { $addFields: { readingKey: { $toString: "$_id" } } },
    { $lookup: { from: State.collection.name, localField: "readingKey", foreignField: "_id", as: "readingState" } },
    { $match: { readingState: { $not: { $elemMatch: { revision, $or: [
      { state: "unsupported" }, { nextAttemptAt: { $gt: now } }, { leaseUntil: { $gt: now } },
    ] } } } } },
    { $project: { _id: 1, user: 1, postDate: 1, stats: 1, instagramMediaId: 1, type: 1 } },
    { $facet: {
      recent: [{ $match: { postDate: { $gte: new Date(now.getTime() - 14 * 86400000) } } }, { $sort: { postDate: -1, _id: 1 } }, { $limit: limit * 10 }],
      middle: [{ $match: { postDate: { $lt: new Date(now.getTime() - 14 * 86400000), $gte: new Date(now.getTime() - 28 * 86400000) } } }, { $sort: { postDate: 1, _id: 1 } }, { $limit: limit * 10 }],
      older: [{ $match: { postDate: { $lt: new Date(now.getTime() - 28 * 86400000) } } }, { $sort: { postDate: 1, _id: 1 } }, { $limit: limit * 10 }],
    } },

  ]);
  const buckets = rows[0] ?? {};
  const oldLimit = Math.max(1, Math.floor(limit * 0.2));
  const old = fairReadingBatch(buckets.older ?? [], oldLimit);
  const middle = fairReadingBatch(buckets.middle ?? [], Math.max(1, Math.floor(limit * 0.2)));
  const recent = fairReadingBatch(buckets.recent ?? [], Math.max(0, limit - old.length - middle.length));
  const selected = [...recent, ...middle, ...old].slice(0, limit);
  const ids = new Set(selected.map(row => String(row._id)));
  return [...selected, ...fairReadingBatch([...(buckets.recent ?? []), ...(buckets.middle ?? []), ...(buckets.older ?? [])].filter(row => !ids.has(String(row._id))), limit - selected.length)];
}
