import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import PublishedContentEvidence, {
  PUBLISHED_CONTENT_EVIDENCE_VERSION,
  type PublishedSceneEvidence,
  type PublishedTranscriptSegment,
} from "@/app/models/PublishedContentEvidence";
import ScriptEntry from "@/app/models/ScriptEntry";
import AudienceDemographicSnapshot from "@/app/models/demographics/AudienceDemographicSnapshot";

export type PublishedEvidenceCoverage = {
  schemaVersion: "published_evidence_coverage_v1";
  generatedAt: string;
  lookbackDays: number;
  publishedContent: number;
  videoContent: number;
  evidenceRecords: number;
  fullTranscriptAvailable: number;
  scenesAvailable: number;
  durationAvailable: number;
  performanceAvailable: number;
  scriptsLinked: number;
  demographicsAvailable: boolean;
  ratios: Record<string, number>;
  status: "complete" | "partial" | "insufficient";
};

type SceneEvaluationLike = {
  transcript?: string | null;
  transcriptSegments?: Array<{ startMs?: number | null; endMs?: number | null; text?: string }>;
  sceneTimeline?: Array<{
    startMs?: number | null;
    endMs?: number | null;
    role?: string;
    description?: string;
    spokenText?: string | null;
    onScreenText?: string | null;
    setting?: string | null;
    objects?: string[];
    framing?: string[];
  }>;
  narrativeStructure?: string[];
  promise?: string | null;
  cta?: string | null;
  subjects?: string[];
  toneIds?: string[];
  objects?: string[];
  framingIds?: string[];
  aestheticIds?: string[];
  placeId?: string | null;
  screenTitle?: string | null;
  openingLine?: string | null;
  quotes?: string[];
  provider?: string;
};

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function cleanList(value: unknown, limit: number, max = 160): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = cleanText(item, max);
    if (!text) continue;
    const key = text.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function words(value: string | null): number {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function normalizeSegments(value: SceneEvaluationLike["transcriptSegments"]): PublishedTranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 160).flatMap((item) => {
    const text = cleanText(item?.text, 1600);
    if (!text) return [];
    const startMs = finite(item?.startMs);
    const endMs = finite(item?.endMs);
    return [{
      startMs,
      endMs: endMs !== null && (startMs === null || endMs >= startMs) ? endMs : null,
      text,
    }];
  });
}

function normalizeScenes(value: SceneEvaluationLike["sceneTimeline"]): PublishedSceneEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item, index) => {
    const description = cleanText(item?.description, 800);
    if (!description) return [];
    const startMs = finite(item?.startMs);
    const endMs = finite(item?.endMs);
    return [{
      startMs,
      endMs: endMs !== null && (startMs === null || endMs >= startMs) ? endMs : null,
      role: cleanText(item?.role, 60) || `scene_${index + 1}`,
      description,
      spokenText: cleanText(item?.spokenText, 2000),
      onScreenText: cleanText(item?.onScreenText, 500),
      setting: cleanText(item?.setting, 120),
      objects: cleanList(item?.objects, 8, 80),
      framing: cleanList(item?.framing, 8, 80),
    }];
  });
}

function averageWatchTime(stats: Record<string, unknown>): number | null {
  const direct = finite(stats.average_video_watch_time_seconds);
  if (direct !== null) return direct;
  const totalMs = finite(stats.ig_reels_video_view_total_time);
  const views = finite(stats.views ?? stats.video_views);
  if (totalMs !== null && views && views > 0) return totalMs / 1000 / views;
  return null;
}

function tokenSet(value: string): Set<string> {
  return new Set(value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 4));
}

export function scriptTranscriptSimilarity(script: string, transcript: string): number {
  const a = tokenSet(script);
  const b = tokenSet(transcript);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union ? Number((intersection / union).toFixed(4)) : 0;
}

async function resolveScriptLink(params: {
  userId: Types.ObjectId;
  metricId: Types.ObjectId;
  transcript: string | null;
  postDate: Date | null;
}) {
  const confirmed = await ScriptEntry.findOne({
    userId: params.userId,
    "postedContent.metricId": params.metricId,
  }).select("_id content").lean();
  if (confirmed?._id) {
    return {
      scriptId: confirmed._id,
      confidence: "confirmed" as const,
      similarity: 1,
      source: "user" as const,
      scriptContent: cleanText(confirmed.content, 20000),
    };
  }
  if (!params.transcript || !params.postDate) {
    return { scriptId: null, confidence: "unlinked" as const, similarity: null, source: "none" as const, scriptContent: null };
  }

  const windowMs = 45 * 24 * 60 * 60 * 1000;
  const candidates = await ScriptEntry.find({
    userId: params.userId,
    updatedAt: {
      $gte: new Date(params.postDate.getTime() - windowMs),
      $lte: new Date(params.postDate.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
    isAdminRecommendation: { $ne: true },
  }).select("_id content").sort({ updatedAt: -1 }).limit(40).lean();

  const ranked = candidates.map((item) => ({
    id: item._id,
    similarity: scriptTranscriptSimilarity(String(item.content || ""), params.transcript || ""),
  })).sort((a, b) => b.similarity - a.similarity);
  const winner = ranked[0];
  if (!winner || winner.similarity < 0.28) {
    return { scriptId: null, confidence: "unlinked" as const, similarity: winner?.similarity ?? null, source: "none" as const, scriptContent: null };
  }
  return {
    scriptId: winner.id,
    confidence: winner.similarity >= 0.48 ? "high" as const : "possible" as const,
    similarity: winner.similarity,
    source: "automatic" as const,
    scriptContent: cleanText(candidates.find((item) => String(item._id) === String(winner.id))?.content, 20000),
  };
}

export async function upsertPublishedContentEvidence(params: {
  metricId: string;
  scene: SceneEvaluationLike;
}) {
  if (!Types.ObjectId.isValid(params.metricId)) throw new Error("invalid_metric_id");
  await connectToDatabase();
  const metric = await MetricModel.findById(params.metricId)
    .select("user instagramMediaId postDate description stats sceneElements")
    .lean<any>();
  if (!metric) throw new Error("metric_not_found");

  const observedTranscript = cleanText(params.scene.transcript, 30000);
  const segments = normalizeSegments(params.scene.transcriptSegments);
  const scenes = normalizeScenes(params.scene.sceneTimeline);
  const stats = (metric.stats || {}) as Record<string, unknown>;
  const durationSeconds = finite(stats.video_duration_seconds);
  const reach = finite(stats.reach);
  const views = finite(stats.views ?? stats.video_views);
  const interactions = finite(stats.total_interactions);
  const avgWatch = averageWatchTime(stats);
  const retention = finite(stats.retention_rate)
    ?? (avgWatch !== null && durationSeconds && durationSeconds > 0 ? avgWatch / durationSeconds : null);
  const scriptLink = await resolveScriptLink({
    userId: metric.user as Types.ObjectId,
    metricId: metric._id as Types.ObjectId,
    transcript: observedTranscript,
    postDate: metric.postDate ? new Date(metric.postDate) : null,
  });
  const fullTranscript = observedTranscript || scriptLink.scriptContent || null;
  const transcriptSource = observedTranscript
    ? "gemini_video" as const
    : scriptLink.scriptContent ? "stored_script" as const : "none" as const;
  const performanceAvailable = reach !== null || views !== null || interactions !== null;

  return PublishedContentEvidence.findOneAndUpdate(
    { metricId: metric._id },
    {
      $set: {
        userId: metric.user,
        instagramMediaId: metric.instagramMediaId || null,
        publishedAt: metric.postDate || null,
        evidenceVersion: PUBLISHED_CONTENT_EVIDENCE_VERSION,
        transcript: {
          fullText: fullTranscript,
          segments,
          wordCount: words(fullTranscript),
          language: fullTranscript ? "pt-BR" : null,
          source: transcriptSource,
        },
        scenes,
        narrative: {
          hook: cleanText(params.scene.openingLine, 500),
          promise: cleanText(params.scene.promise, 500),
          structure: cleanList(params.scene.narrativeStructure, 12, 80),
          cta: cleanText(params.scene.cta, 500),
          subjects: cleanList(params.scene.subjects, 12, 160),
          toneSignals: cleanList(params.scene.toneIds, 8, 80),
        },
        visual: {
          setting: cleanText(params.scene.placeId, 120),
          objects: cleanList(params.scene.objects, 12, 80),
          framing: cleanList(params.scene.framingIds, 12, 80),
          aesthetics: cleanList(params.scene.aestheticIds, 12, 80),
          screenTitle: cleanText(params.scene.screenTitle, 500),
        },
        performance: {
          durationSeconds,
          views,
          reach,
          interactions,
          saves: finite(stats.saved ?? stats.saves),
          shares: finite(stats.shares),
          comments: finite(stats.comments),
          follows: finite(stats.follows),
          averageWatchTimeSeconds: avgWatch,
          retentionRate: retention,
          capturedAt: new Date(),
        },
        scriptLink: {
          scriptId: scriptLink.scriptId,
          confidence: scriptLink.confidence,
          similarity: scriptLink.similarity,
          source: scriptLink.source,
        },
        completeness: {
          transcript: Boolean(fullTranscript && words(fullTranscript) >= 8),
          scenes: scenes.length > 0,
          performance: performanceAvailable,
          duration: durationSeconds !== null,
          scriptLink: scriptLink.confidence === "confirmed" || scriptLink.confidence === "high",
        },
        provider: cleanText(params.scene.provider, 80) || "gemini_video",
        analyzedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

function ratio(value: number, total: number): number {
  return total ? Number((value / total).toFixed(4)) : 0;
}

function hasDemographicData(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const demographics = (snapshot as { demographics?: Record<string, unknown> }).demographics;
  if (!demographics || typeof demographics !== "object") return false;
  for (const sourceKey of ["engaged_audience_demographics", "follower_demographics"]) {
    const source = demographics[sourceKey];
    if (!source || typeof source !== "object") continue;
    for (const dimension of Object.values(source)) {
      if (!dimension || typeof dimension !== "object") continue;
      if (Object.values(dimension).some((value) => Number(value) > 0)) return true;
    }
  }
  return false;
}

export async function getPublishedEvidenceCoverage(params: {
  userId: string;
  lookbackDays?: number;
  demographicsAvailable?: boolean;
}): Promise<PublishedEvidenceCoverage> {
  if (!Types.ObjectId.isValid(params.userId)) throw new Error("invalid_user_id");
  await connectToDatabase();
  const lookbackDays = Math.max(7, Math.min(365, Math.floor(params.lookbackDays || 180)));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const userId = new Types.ObjectId(params.userId);
  const [publishedContent, videoContent, aggregates, demographicSnapshot] = await Promise.all([
    MetricModel.countDocuments({ user: userId, postDate: { $gte: since } }),
    MetricModel.countDocuments({
      user: userId,
      postDate: { $gte: since },
      $or: [{ format: "reel" }, { type: /reel|video/i }, { "stats.video_duration_seconds": { $gt: 0 } }],
    }),
    PublishedContentEvidence.aggregate([
      { $match: { userId, publishedAt: { $gte: since } } },
      { $group: {
        _id: null,
        evidenceRecords: { $sum: 1 },
        fullTranscriptAvailable: { $sum: { $cond: ["$completeness.transcript", 1, 0] } },
        scenesAvailable: { $sum: { $cond: ["$completeness.scenes", 1, 0] } },
        durationAvailable: { $sum: { $cond: ["$completeness.duration", 1, 0] } },
        performanceAvailable: { $sum: { $cond: ["$completeness.performance", 1, 0] } },
        scriptsLinked: { $sum: { $cond: ["$completeness.scriptLink", 1, 0] } },
      } },
    ]),
    params.demographicsAvailable === undefined
      ? AudienceDemographicSnapshot.findOne({ user: userId })
          .sort({ recordedAt: -1 })
          .select("demographics")
          .lean()
      : null,
  ]);
  const row = aggregates[0] || {};
  const evidenceRecords = Number(row.evidenceRecords || 0);
  const fullTranscriptAvailable = Number(row.fullTranscriptAvailable || 0);
  const scenesAvailable = Number(row.scenesAvailable || 0);
  const durationAvailable = Number(row.durationAvailable || 0);
  const performanceAvailable = Number(row.performanceAvailable || 0);
  const scriptsLinked = Number(row.scriptsLinked || 0);
  const coreRatio = ratio(Math.min(fullTranscriptAvailable, performanceAvailable), Math.max(1, videoContent));
  return {
    schemaVersion: "published_evidence_coverage_v1",
    generatedAt: new Date().toISOString(),
    lookbackDays,
    publishedContent,
    videoContent,
    evidenceRecords,
    fullTranscriptAvailable,
    scenesAvailable,
    durationAvailable,
    performanceAvailable,
    scriptsLinked,
    demographicsAvailable: params.demographicsAvailable ?? hasDemographicData(demographicSnapshot),
    ratios: {
      evidence: ratio(evidenceRecords, Math.max(1, videoContent)),
      transcript: ratio(fullTranscriptAvailable, Math.max(1, videoContent)),
      scenes: ratio(scenesAvailable, Math.max(1, videoContent)),
      duration: ratio(durationAvailable, Math.max(1, videoContent)),
      performance: ratio(performanceAvailable, Math.max(1, videoContent)),
      scriptsLinked: ratio(scriptsLinked, Math.max(1, videoContent)),
    },
    status: coreRatio >= 0.8 ? "complete" : coreRatio >= 0.3 ? "partial" : "insufficient",
  };
}
