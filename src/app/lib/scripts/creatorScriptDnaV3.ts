import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorScriptDnaProfile, {
  CREATOR_SCRIPT_DNA_VERSION,
} from "@/app/models/CreatorScriptDnaProfile";
import AudienceDemographicSnapshot from "@/app/models/demographics/AudienceDemographicSnapshot";
import PublishedContentEvidence from "@/app/models/PublishedContentEvidence";
import { getPublishedEvidenceCoverage } from "./publishedContentEvidence";

type EvidenceDoc = Record<string, any>;

const STOPWORDS = new Set([
  "para", "como", "mais", "isso", "essa", "esse", "aqui", "porque", "então", "muito",
  "uma", "com", "que", "não", "você", "vocês", "gente", "hoje", "agora", "também",
]);

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Number.isFinite(value) ? Math.round(value * factor) / factor : 0;
}

function median(values: Array<number | null>): number | null {
  const usable = values.filter((item): item is number => item !== null).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2
    ? usable[middle] ?? null
    : ((usable[middle - 1] ?? 0) + (usable[middle] ?? 0)) / 2;
}

function percentile(values: number[], p: number): number | null {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return null;
  const idx = Math.min(usable.length - 1, Math.max(0, Math.round((usable.length - 1) * p)));
  return usable[idx] ?? null;
}

function words(value: string): string[] {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function sentenceCount(value: string): number {
  return Math.max(1, value.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean).length);
}

function topValues(values: string[], limit: number): string[] {
  const counter = new Map<string, number>();
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    counter.set(normalized, (counter.get(normalized) || 0) + 1);
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function recurringExpressions(transcripts: string[], limit = 12): string[] {
  const perDocument = new Map<string, number>();
  for (const transcript of transcripts) {
    const tokens = words(transcript);
    const seen = new Set<string>();
    for (const size of [2, 3]) {
      for (let i = 0; i <= tokens.length - size; i += 1) {
        const slice = tokens.slice(i, i + size);
        if (slice.some((item) => STOPWORDS.has(item)) || slice.join(" ").length < 9) continue;
        seen.add(slice.join(" "));
      }
    }
    for (const expression of seen) perDocument.set(expression, (perDocument.get(expression) || 0) + 1);
  }
  return [...perDocument.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([value]) => value);
}

function rawPerformance(doc: EvidenceDoc) {
  const p = doc.performance || {};
  const reach = finite(p.reach);
  const views = finite(p.views);
  const duration = finite(p.durationSeconds);
  const averageWatch = finite(p.averageWatchTimeSeconds);
  const attention = duration && averageWatch !== null
    ? averageWatch / duration
    : reach && views !== null ? views / reach : null;
  const depth = reach ? ((finite(p.saves) || 0) + (finite(p.shares) || 0)) / reach : null;
  const conversation = reach ? (finite(p.comments) || 0) / reach : null;
  const conversion = reach ? (finite(p.follows) || 0) / reach : null;
  const fallback = reach ? (finite(p.interactions) || 0) / reach : finite(p.interactions);
  return { attention, depth, conversation, conversion, fallback, exposure: reach || views || 0 };
}

function performanceIndices(docs: EvidenceDoc[]): Map<string, number> {
  const rows = docs.map((doc) => ({ id: String(doc._id), values: rawPerformance(doc) }));
  const baselines = {
    attention: median(rows.map((row) => row.values.attention)) || 1,
    depth: median(rows.map((row) => row.values.depth)) || 0.001,
    conversation: median(rows.map((row) => row.values.conversation)) || 0.001,
    conversion: median(rows.map((row) => row.values.conversion)) || 0.0001,
    fallback: median(rows.map((row) => row.values.fallback)) || 1,
  };
  const priorExposure = Math.max(50, (median(rows.map((row) => row.values.exposure)) || 0) * 0.25);
  const shrink = (value: number | null, baseline: number, exposure: number) => value === null
    ? null
    : (value * exposure + baseline * priorExposure) / Math.max(1, exposure + priorExposure);
  const normalize = (value: number | null, baseline: number) =>
    value === null ? null : Math.max(0.2, Math.min(3, value / Math.max(0.000001, baseline)));

  return new Map(rows.map((row) => {
    const parts = [
      [normalize(shrink(row.values.attention, baselines.attention, row.values.exposure), baselines.attention), 0.35],
      [normalize(shrink(row.values.depth, baselines.depth, row.values.exposure), baselines.depth), 0.35],
      [normalize(shrink(row.values.conversation, baselines.conversation, row.values.exposure), baselines.conversation), 0.15],
      [normalize(shrink(row.values.conversion, baselines.conversion, row.values.exposure), baselines.conversion), 0.15],
    ] as Array<[number | null, number]>;
    const available = parts.filter((item): item is [number, number] => item[0] !== null);
    const weighted = available.length
      ? available.reduce((sum, [value, weight]) => sum + value * weight, 0)
        / available.reduce((sum, [, weight]) => sum + weight, 0)
      : normalize(shrink(row.values.fallback, baselines.fallback, row.values.exposure), baselines.fallback) || 1;
    return [row.id, round(weighted, 4)];
  }));
}

function topBreakdown(value: unknown, limit: number): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const rows = Object.entries(value as Record<string, unknown>)
    .map(([label, count]) => ({ label, count: typeof count === "number" ? count : 0 }))
    .filter((item) => item.label && item.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  return rows
    .slice(0, limit)
    .map((item) => `${item.label} (${Math.round((item.count / Math.max(1, total)) * 100)}%)`);
}

function audienceFromSnapshot(snapshot: any) {
  const demographics = snapshot?.demographics || {};
  const engaged = demographics.engaged_audience_demographics || {};
  const followers = demographics.follower_demographics || {};
  const engagedHasData = [engaged.age, engaged.gender, engaged.city, engaged.country]
    .some((item) => item && typeof item === "object" && Object.keys(item).length > 0);
  const selected = engagedHasData ? engaged : followers;
  return {
    source: engagedHasData ? "engaged" as const : Object.keys(selected || {}).length ? "followers" as const : "none" as const,
    age: topBreakdown(selected.age, 4),
    gender: topBreakdown(selected.gender, 4),
    cities: topBreakdown(selected.city, 6),
    countries: topBreakdown(selected.country, 4),
    recordedAt: snapshot?.recordedAt ? new Date(snapshot.recordedAt) : null,
  };
}

function uniqueStructures(docs: EvidenceDoc[], limit: number): string[][] {
  const map = new Map<string, { value: string[]; count: number }>();
  for (const doc of docs) {
    const structure = Array.isArray(doc.narrative?.structure)
      ? doc.narrative.structure.map(String).filter(Boolean).slice(0, 12)
      : [];
    if (!structure.length) continue;
    const key = structure.join("→");
    const current = map.get(key);
    map.set(key, { value: structure, count: (current?.count || 0) + 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit).map((item) => item.value);
}

export async function buildCreatorScriptDnaV3(params: { userId: string; lookbackDays?: number }) {
  if (!Types.ObjectId.isValid(params.userId)) throw new Error("invalid_user_id");
  await connectToDatabase();
  const userId = new Types.ObjectId(params.userId);
  const lookbackDays = Math.max(30, Math.min(365, Math.floor(params.lookbackDays || 365)));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const [docs, demographicSnapshot] = await Promise.all([
    PublishedContentEvidence.find({ userId, publishedAt: { $gte: since } })
      .sort({ publishedAt: -1 }).limit(500).lean<any[]>(),
    AudienceDemographicSnapshot.findOne({ user: userId }).sort({ recordedAt: -1 }).lean<any>(),
  ]);
  const audience = audienceFromSnapshot(demographicSnapshot);
  const coverage = await getPublishedEvidenceCoverage({
    userId: params.userId,
    lookbackDays,
    demographicsAvailable: audience.source !== "none",
  });
  const indices = performanceIndices(docs);
  const ranked = [...docs].sort((a, b) => (indices.get(String(b._id)) || 0) - (indices.get(String(a._id)) || 0));
  const winnerCount = ranked.length ? Math.max(1, Math.ceil(ranked.length * 0.35)) : 0;
  const winners = ranked.slice(0, winnerCount);
  const transcriptDocs = docs.filter((doc) => String(doc.transcript?.fullText || "").trim());
  const transcripts = transcriptDocs.map((doc) => String(doc.transcript?.fullText || "").trim());
  const transcriptWords = transcripts.map((item) => words(item).length);
  const totalWords = transcriptWords.reduce((sum, item) => sum + item, 0);
  const totalSentences = transcripts.reduce((sum, item) => sum + sentenceCount(item), 0);
  const durations = docs.map((doc) => finite(doc.performance?.durationSeconds)).filter((item): item is number => item !== null);
  const winnerDurations = winners.map((doc) => finite(doc.performance?.durationSeconds)).filter((item): item is number => item !== null);
  const totalDuration = transcriptDocs.reduce((sum, doc) => sum + (finite(doc.performance?.durationSeconds) || 0), 0);
  const hookDelivery = winners.flatMap((doc) => {
    const hook = (doc.scenes || []).find((scene: any) => /hook|gancho/i.test(String(scene.role || "")));
    const end = finite(hook?.endMs);
    return end === null ? [] : [end / 1000];
  });

  const subjectStats = new Map<string, { count: number; score: number }>();
  for (const doc of docs) {
    const score = indices.get(String(doc._id)) || 1;
    for (const raw of doc.narrative?.subjects || []) {
      const label = String(raw || "").trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase("pt-BR");
      const current = subjectStats.get(key) || { count: 0, score: 0 };
      current.count += 1;
      current.score += score;
      subjectStats.set(key, current);
    }
  }

  const confidence = docs.length >= 12 && coverage.fullTranscriptAvailable >= 8
    ? "high" as const
    : docs.length >= 5 && coverage.fullTranscriptAvailable >= 3 ? "medium" as const : "low" as const;
  const profile = {
    userId,
    profileVersion: CREATOR_SCRIPT_DNA_VERSION,
    lookbackDays,
    confidence,
    sampleSize: docs.length,
    voice: {
      avgWords: docs.length ? round(totalWords / Math.max(1, transcripts.length), 1) : 0,
      avgWordsPerSentence: totalSentences ? round(totalWords / totalSentences, 1) : 0,
      wordsPerSecond: totalDuration > 0 ? round(totalWords / totalDuration, 2) : null,
      recurringExpressions: recurringExpressions(transcripts),
      hookPatterns: topValues(winners.map((doc) => String(doc.narrative?.hook || "")).filter(Boolean), 8),
      ctaPatterns: topValues(winners.map((doc) => String(doc.narrative?.cta || "")).filter(Boolean), 8),
      toneSignals: topValues(winners.flatMap((doc) => doc.narrative?.toneSignals || []), 8),
    },
    narrative: {
      winningStructures: uniqueStructures(winners, 6),
      medianDurationSeconds: median(durations),
      winningDurationRange: {
        min: percentile(winnerDurations, 0.25),
        max: percentile(winnerDurations, 0.75),
      },
      hookDeliverySeconds: median(hookDelivery),
    },
    visual: {
      settings: topValues(winners.map((doc) => String(doc.visual?.setting || "")).filter(Boolean), 8),
      objects: topValues(winners.flatMap((doc) => doc.visual?.objects || []), 12),
      framing: topValues(winners.flatMap((doc) => doc.visual?.framing || []), 10),
      aesthetics: topValues(winners.flatMap((doc) => doc.visual?.aesthetics || []), 10),
    },
    subjects: [...subjectStats.entries()]
      .map(([label, item]) => ({ label, count: item.count, performanceIndex: round(item.score / item.count, 4) }))
      .sort((a, b) => b.performanceIndex - a.performanceIndex || b.count - a.count)
      .slice(0, 16),
    audience,
    winners: winners.slice(0, 12).map((doc) => ({
      metricId: doc.metricId,
      scriptId: doc.scriptLink?.scriptId || null,
      performanceIndex: indices.get(String(doc._id)) || 1,
      durationSeconds: finite(doc.performance?.durationSeconds),
      hook: typeof doc.narrative?.hook === "string" ? doc.narrative.hook : null,
      subjects: Array.isArray(doc.narrative?.subjects) ? doc.narrative.subjects.slice(0, 8) : [],
    })),
    coverage: {
      publishedContent: coverage.publishedContent,
      evidenceRecords: coverage.evidenceRecords,
      transcripts: coverage.fullTranscriptAvailable,
      scenes: coverage.scenesAvailable,
      performance: coverage.performanceAvailable,
      linkedScripts: coverage.scriptsLinked,
      demographics: coverage.demographicsAvailable,
    },
    generatedAt: new Date(),
  };

  return CreatorScriptDnaProfile.findOneAndUpdate(
    { userId },
    { $set: profile },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<any>();
}

export async function getCreatorScriptDnaV3(params: {
  userId: string;
  maxAgeMs?: number;
  rebuildIfStale?: boolean;
}) {
  if (!Types.ObjectId.isValid(params.userId)) return null;
  await connectToDatabase();
  const userId = new Types.ObjectId(params.userId);
  const existing = await CreatorScriptDnaProfile.findOne({ userId }).lean<any>();
  const maxAgeMs = params.maxAgeMs ?? 6 * 60 * 60 * 1000;
  const generatedAt = existing?.generatedAt ? new Date(existing.generatedAt).getTime() : 0;
  if (existing && Date.now() - generatedAt <= maxAgeMs) return existing;
  if (params.rebuildIfStale === false) return existing;
  return buildCreatorScriptDnaV3({ userId: params.userId });
}

export function sanitizeCreatorScriptDnaForMcp(profile: any) {
  if (!profile) return null;
  return {
    schemaVersion: CREATOR_SCRIPT_DNA_VERSION,
    generatedAt: profile.generatedAt ? new Date(profile.generatedAt).toISOString() : null,
    lookbackDays: profile.lookbackDays,
    confidence: profile.confidence,
    sampleSize: profile.sampleSize,
    voice: profile.voice,
    narrative: profile.narrative,
    visual: profile.visual,
    subjects: profile.subjects,
    audience: profile.audience ? {
      source: profile.audience.source,
      age: profile.audience.age || [],
      gender: profile.audience.gender || [],
      cities: profile.audience.cities || [],
      countries: profile.audience.countries || [],
      recordedAt: profile.audience.recordedAt ? new Date(profile.audience.recordedAt).toISOString() : null,
    } : null,
    winners: (profile.winners || []).map((item: any) => ({
      contentId: String(item.metricId || ""),
      performanceIndex: item.performanceIndex,
      durationSeconds: item.durationSeconds ?? null,
      hook: item.hook ?? null,
      subjects: item.subjects || [],
    })),
    coverage: profile.coverage,
    interpretationRules: [
      "Padrões descrevem correlação histórica, não garantia causal de resultado.",
      "Demografia orienta clareza e contexto; nunca deve ser usada para estereotipar pessoas.",
      "Confiança baixa exige linguagem de hipótese e experimentação.",
    ],
  };
}
