import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import Evidence from "@/app/models/PublishedContentEvidence";
import Metric from "@/app/models/Metric";
import ScriptEntry from "@/app/models/ScriptEntry";
import { metricPerformance } from "./scriptEvidenceSelection";
import { buildCreatorScriptDnaV3 } from "./creatorScriptDnaV3";

/** Reconciliação sem leitura multimodal; dryRun é o padrão para auditorias. */
export async function maintainScriptEvidence(userId: string, dryRun = true) {
  if (!Types.ObjectId.isValid(userId)) throw new Error("invalid_user_id");
  await connectToDatabase();
  const owner = new Types.ObjectId(userId);
  const docs = await Evidence.find({ userId: owner }).sort({ publishedAt: -1 }).limit(500)
    .select("_id metricId transcript.source scriptLink").lean<any[]>();
  const ids = docs.map(d => d.metricId);
  const [metrics, scripts] = await Promise.all([
    Metric.find({ user: owner, _id: { $in: ids } }).select("_id type stats postDate updatedAt lastFetchedAt").lean<any[]>(),
    ScriptEntry.find({ userId: owner, "postedContent.metricId": { $in: ids } }).select("_id postedContent evidenceProvenance publicationLearning").lean<any[]>(),
  ]);
  const metricById = new Map(metrics.map(m => [String(m._id),m]));
  const scriptByMetric = new Map(scripts.map(s => [String(s.postedContent.metricId),s]));
  const updates = docs.flatMap(doc => {
    const metric = metricById.get(String(doc.metricId));
    if (!metric) return [];
    const performance = metricPerformance(metric);
    const script = scriptByMetric.get(String(doc.metricId));
    const fields: Record<string, unknown> = { performance: { ...performance, capturedAt: performance.capturedAt || new Date() },
      "completeness.performance": performance.reach !== null || performance.views !== null || performance.interactions !== null };
    if (doc.transcript?.source !== "gemini_video" || ["IMAGE", "CAROUSEL_ALBUM"].includes(metric.type)) fields["completeness.transcript"] = false;
    if (script) {
      fields.scriptLink = { scriptId: script._id, confidence: "confirmed", source: "user", similarity: 1 };
      fields["completeness.scriptLink"] = true;
    } else if (doc.scriptLink?.source === "user") {
      fields.scriptLink = { scriptId: null, confidence: "unlinked", source: "none", similarity: null };
      fields["completeness.scriptLink"] = false;
    }
    return [{ updateOne: { filter: { _id: doc._id, userId: owner }, update: { $set: fields } } }];
  });
  if (!dryRun && updates.length) await Evidence.bulkWrite(updates);
  const learningUpdates = scripts.flatMap(script => {
    const metric = metricById.get(String(script.postedContent.metricId));
    if (!metric?.postDate) return [];
    const ageDays = (Date.now()-new Date(metric.postDate).getTime())/86400000;
    // Só captura uma janela quando observada no prazo; não preenche retrospectivamente resultados de 1/7/30 dias.
    const day = [1,7,30].find(d => ageDays >= d && ageDays < d + (d === 1 ? 1 : 2));
    if (!day || script.publicationLearning?.[`day${day}`]) return [];
    return [{ updateOne: { filter: { _id: script._id, userId: owner, [`publicationLearning.day${day}`]: { $exists: false } },
      update: { $set: { [`publicationLearning.day${day}`]: { observedAt: new Date(), ageDays, performance: metricPerformance(metric),
        windowBasis: "current_metrics_observed_in_age_window_not_exact_day",
        metricId: String(metric._id), packId: script.evidenceProvenance?.packId || null } } } } }];
  });
  if (!dryRun && learningUpdates.length) await ScriptEntry.bulkWrite(learningUpdates);
  if (!dryRun) await buildCreatorScriptDnaV3({ userId });
  return { dryRun, evidenceConsidered: docs.length, metricsAvailable: metrics.length, confirmedLinks: scripts.length, updates: updates.length,
    outcomeWindows: learningUpdates.length, corpusLimited: docs.length === 500 };
}
