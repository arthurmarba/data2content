import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import PublishedContentEvidence from "@/app/models/PublishedContentEvidence";
import Metric from "@/app/models/Metric";
import ScriptEntry from "@/app/models/ScriptEntry";
import { loadMcpCreatorMap, summarizeMcpCreatorMap } from "@/app/lib/mcp/creatorMap";
import { getCreatorScriptDnaV3, sanitizeCreatorScriptDnaForMcp } from "./creatorScriptDnaV3";
import { inferScriptGoal, rankScriptEvidence, type ScriptGoal, type EvidenceFormat } from "./scriptEvidenceSelection";
import { recordScriptsStageDuration } from "./performanceTelemetry";

export type CreatorScriptGoal = ScriptGoal;
export type CreatorScriptEvidenceExemplar = {
  contentId: string; scriptId: string | null;
  source: "planned_script" | "observed_transcript" | "planned_and_observed";
  fullText: string; plannedScriptText: string | null; observedTranscriptText: string | null;
  hook: string | null; cta: string | null; structure: string[]; subjects: string[];
  durationSeconds: number | null; performanceIndex: number; relevance: number;
  role?: "winner" | "voice_example" | "requested" | "contrast";
  url?: string | null; publishedAt?: string | null;
  quality?: { status: string; truncated: boolean; completenessVerified: boolean; speakerVerified: boolean };
  metrics?: Record<string, unknown>;
  selectionReason?: string;
  segments?: Array<{ startMs: number | null; endMs: number | null; text: string }>;
};
export type CreatorScriptEvidencePack = {
  schemaVersion: "creator_script_evidence_pack_v1";
  generatedAt: string;
  request: { prompt: string; goal: CreatorScriptGoal; targetDurationSeconds: number | null; lookbackDays?: number; startsAt?: string; endsAt?: string; format?: EvidenceFormat; requestedIds?: string[] };
  dna: ReturnType<typeof sanitizeCreatorScriptDnaForMcp>;
  editorialContext?: ReturnType<typeof summarizeMcpCreatorMap>;
  creatorPreferences?: Array<{ scriptId: string; voiceMatch?: boolean; preferredDirection?: string; notes?: string }>;
  winningExemplars: CreatorScriptEvidenceExemplar[];
  contrastExemplar: CreatorScriptEvidenceExemplar | null;
  generationConstraints: { targetDurationSeconds: number; preferredSceneCount: number; creatorFitConfidence: "low" | "medium" | "high"; avoidVerbatimCopy: boolean; audienceGuidance: string[]; visualGuidance: string[] };
  receipt: {
    profileVersion: string; evidenceRecordsConsidered: number; fullExemplarsUsed: number;
    linkedPlannedScriptsUsed: number; observedTranscriptsUsed: number; demographicsUsed: boolean;
    status: "complete" | "partial" | "insufficient"; warnings: string[];
    packId?: string; rankingVersion?: string; selectedContentIds?: string[];
    coverage?: ReturnType<typeof rankScriptEvidence>["coverage"];
    selectionStage?: "prepared" | "delivered_to_client" | "sent_to_generator" | "local_without_evidence";
    selectedExamples?: number; sentExamples?: number; validatedExamples?: number;
    corpusLimited?: boolean; periodStart?: string; periodEnd?: string;
  };
};
export type BuildScriptEvidenceInput = {
  userId: string; prompt: string; goal?: CreatorScriptGoal; targetDurationSeconds?: number | null;
  lookbackDays?: number; format?: EvidenceFormat; ownContentIds?: string[];
  startsAt?: string; endsAt?: string;
  /** O adaptador autenticado deve impedir a leitura antes de entrar no corpus. */
  includePrivateIntelligence?: boolean;
};
const iso = (value: unknown) => {
  const date = value ? new Date(String(value)) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export async function buildCreatorScriptEvidencePack(params: BuildScriptEvidenceInput): Promise<CreatorScriptEvidencePack> {
  if (params.includePrivateIntelligence === false) throw new Error("private_creator_evidence_unavailable");
  if (!Types.ObjectId.isValid(params.userId)) throw new Error("invalid_user_id");
  const prompt = params.prompt.trim().slice(0, 2000);
  if (!prompt) throw new Error("prompt_required");
  const startedAt = Date.now();
  const now = new Date();
  const lookbackDays = Math.max(7, Math.min(365, Math.floor(params.lookbackDays || 180)));
  const end = params.endsAt ? new Date(params.endsAt.length === 10 ? `${params.endsAt}T23:59:59.999Z` : params.endsAt) : now;
  const since = params.startsAt ? new Date(params.startsAt) : new Date(end.getTime() - lookbackDays * 86400000);
  if (![since.getTime(),end.getTime()].every(Number.isFinite) || since > end || end > now || end.getTime()-since.getTime() > 366*86400000) throw new Error("invalid_evidence_period");
  const goal = params.goal || inferScriptGoal(prompt);
  const format = params.format || "all";
  const ids = [...new Set(params.ownContentIds || [])];
  if (ids.length > 3 || ids.some(id => !Types.ObjectId.isValid(id))) throw new Error("invalid_own_content_ids");
  await connectToDatabase();
  const userId = new Types.ObjectId(params.userId);
  const query: Record<string, unknown> = { user: userId, postDate: { $gte: since, $lte: end } };
  if (format !== "all") query.type = format === "reel" ? { $in: ["REEL", "VIDEO"] } : format === "photo" ? "IMAGE" : "CAROUSEL_ALBUM";
  if (ids.length) {
    const authorized = await Metric.find({ ...query, _id: { $in: ids.map(id => new Types.ObjectId(id)) } }).select("_id").lean();
    if (authorized.length !== ids.length) throw new Error("own_content_unavailable_in_period_or_account");
  }
  const [metrics, total, dnaDoc, creatorMap] = await Promise.all([
    Metric.find(query).sort({ postDate: -1, _id: 1 }).limit(2000)
      .select("_id postDate postLink type stats updatedAt lastFetchedAt").lean<any[]>(),
    Metric.countDocuments(query),
    getCreatorScriptDnaV3({ userId: params.userId, rebuildIfStale: false }),
    loadMcpCreatorMap(params.userId),
  ]);
  // Referências explícitas não podem desaparecer por causa do limite da janela de consulta.
  const missing = ids.filter(id => !metrics.some(m => String(m._id) === id));
  if (missing.length) metrics.push(...await Metric.find({ ...query, _id: { $in: missing.map(id => new Types.ObjectId(id)) } })
    .select("_id postDate postLink type stats updatedAt lastFetchedAt").lean<any[]>());
  const candidates = metrics.length ? await PublishedContentEvidence.find({ userId, metricId: { $in: metrics.map(m => m._id) } })
    .select("metricId transcript.source transcript.quality transcript.wordCount narrative visual scriptLink completeness evidenceVersion analyzedAt updatedAt").lean<any[]>() : [];
  const preview = rankScriptEvidence({ metrics, evidence: candidates, prompt, goal, requestedIds: ids, now });
  const textIds = preview.ranked.filter(r => r.observedAvailable || r.doc?.completeness?.scriptLink || r.doc?.transcript?.source === "stored_script" || r.fullText)
    .slice(0,40).map(r => new Types.ObjectId(r.contentId));
  const texts = textIds.length ? await PublishedContentEvidence.find({ userId, metricId: { $in: textIds } })
    .select("metricId transcript").lean<any[]>() : [];
  const textById = new Map(texts.map(d => [String(d.metricId), d.transcript]));
  for (const candidate of candidates) if (textById.has(String(candidate.metricId))) candidate.transcript = textById.get(String(candidate.metricId));
  const linkedIds = candidates.filter(d => textById.has(String(d.metricId)) && ["confirmed", "high"].includes(d.scriptLink?.confidence))
    .map(d => String(d.scriptLink?.scriptId)).filter(id => Types.ObjectId.isValid(id));
  const scripts = linkedIds.length ? await ScriptEntry.find({ userId, _id: { $in: linkedIds.map(id => new Types.ObjectId(id)) } }).select("_id content").lean<any[]>() : [];
  const ranked = rankScriptEvidence({ metrics, evidence: candidates, scripts: new Map(scripts.map(s => [String(s._id), s.content])), prompt, goal, requestedIds: ids, now });
  const dna = sanitizeCreatorScriptDnaForMcp(dnaDoc);
  // O pacote não exige audience:read; não exporta demografia por essa ferramenta.
  if (dna) dna.audience = null;
  const feedback = await ScriptEntry.find({ userId, "creatorFeedback.updatedAt": { $exists: true } })
    .sort({ "creatorFeedback.updatedAt": -1 }).limit(5).select("_id creatorFeedback").lean<any[]>();
  const creatorPreferences = feedback.map(s => ({ scriptId: String(s._id), voiceMatch: s.creatorFeedback?.voiceMatch,
    preferredDirection: String(s.creatorFeedback?.preferredDirection || "").slice(0,500), notes: String(s.creatorFeedback?.notes || "").slice(0,1000) }));
  let budget = 48000;
  const toExemplar = (row: typeof ranked.selected[number], contrast = false): CreatorScriptEvidenceExemplar => {
    const original = row.observed || row.planned;
    const limit = Math.min(16000, budget);
    const text = original.slice(0, limit);
    budget -= text.length;
    const truncated = text.length < original.length || row.quality.truncated;
    return {
      contentId: row.contentId, scriptId: row.planned ? String(row.doc?.scriptLink?.scriptId || "") || null : null,
      source: row.observed ? "observed_transcript" : "planned_script", fullText: text,
      plannedScriptText: row.observed ? null : text || null,
      observedTranscriptText: row.observed ? text : null,
      hook: row.doc?.narrative?.hook || null, cta: row.doc?.narrative?.cta || null,
      structure: (row.doc?.narrative?.structure || []).slice(0,12), subjects: (row.doc?.narrative?.subjects || []).slice(0,10),
      durationSeconds: row.performance.durationSeconds, performanceIndex: row.performanceIndex || 0, relevance: row.relevance,
      role: contrast ? "contrast" : row.requested ? "requested" : row.winner ? "winner" : "voice_example",
      url: /^https?:\/\//.test(row.metric.postLink || "") ? row.metric.postLink : null,
      publishedAt: iso(row.metric.postDate), quality: { ...row.quality, truncated, completenessVerified: row.quality.completenessVerified && !truncated, status: truncated ? "partial" : row.quality.status },
      metrics: { ...row.performance, capturedAt: iso(row.performance.capturedAt), value: row.value, method: row.method, baseline: row.baseline },
      selectionReason: row.requested ? "Referência indicada pelo criador." : row.winner ? "Desempenho igual ou superior à mediana comparável; proximidade lexical com o pedido." : "Referência de voz disponível; não comprova desempenho vencedor.",
      segments: row.observed ? (row.doc?.transcript?.segments || []).slice(0,12).map((s: any) => ({ startMs: s.startMs ?? null, endMs: s.endMs ?? null, text: String(s.text || "").slice(0,600) })) : [],
    };
  };
  const winningExemplars = ranked.selected.map(r => toExemplar(r));
  const contrastExemplar = ranked.contrast && budget >= 2000 ? toExemplar(ranked.contrast, true) : null;
  const inferredDuration = Number(prompt.match(/(\d{1,3})\s*(?:s|seg|segundos?)\b/i)?.[1]) || null;
  const target = Math.max(5, Math.min(180, params.targetDurationSeconds || inferredDuration || dna?.narrative?.medianDurationSeconds || 35));
  const warnings: string[] = [];
  if (!winningExemplars.length) warnings.push("Sem exemplos utilizáveis; não afirme conhecer a voz do criador.");
  if (winningExemplars.some(e => !e.observedTranscriptText)) warnings.push("Parte dos exemplos é roteiro planejado, não fala observada.");
  if (winningExemplars.some(e => !e.quality?.completenessVerified)) warnings.push("Há textos cuja integralidade não foi verificada; não os anuncie como transcrição completa.");
  if (ranked.coverage.missingLeaderIds.length) warnings.push(`${ranked.coverage.missingLeaderIds.length} dos ${ranked.coverage.leaders} líderes não têm transcrição observada utilizável.`);
  if (total > metrics.length) warnings.push(`Corpus limitado aos ${metrics.length} posts consultados de ${total} no período.`);
  if (!dna) warnings.push("DNA agregado ainda não disponível; use somente as referências deste pacote.");
  if (dnaDoc?.generatedAt && now.getTime() - new Date(dnaDoc.generatedAt).getTime() > 6*3600000) warnings.push("DNA agregado aguardando atualização; referências e métricas foram consultadas agora.");
  if (goal === "conversion") warnings.push("Sem atribuição comercial disponível; exemplos orientam voz, não comprovam vendas.");
  if (goal === "authority") warnings.push("Autoridade é objetivo editorial; o ranking utiliza engajamento como sinal auxiliar.");
  if ((params.targetDurationSeconds || inferredDuration || 0) > 180) warnings.push("Este motor atende roteiros de até 180 segundos; duração ajustada ao limite.");
  const packId = createHash("sha256").update(JSON.stringify({ userId: params.userId, prompt, goal, target, lookbackDays, startsAt: params.startsAt, endsAt: params.endsAt, format, ids,
    examples: winningExemplars, contrastExemplar, map: creatorMap, creatorPreferences, dnaUpdatedAt: dna?.generatedAt })).digest("hex");
  recordScriptsStageDuration("evidence.total", Date.now()-startedAt);
  return {
    schemaVersion: "creator_script_evidence_pack_v1", generatedAt: now.toISOString(),
    request: { prompt, goal, targetDurationSeconds: params.targetDurationSeconds ?? inferredDuration, lookbackDays, startsAt: since.toISOString(), endsAt: end.toISOString(), format, requestedIds: ids },
    dna, editorialContext: summarizeMcpCreatorMap(creatorMap), creatorPreferences, winningExemplars, contrastExemplar,
    generationConstraints: { targetDurationSeconds: target, preferredSceneCount: target <= 20 ? 3 : target <= 35 ? 4 : target <= 50 ? 5 : 6,
      creatorFitConfidence: winningExemplars.filter(e => e.observedTranscriptText).length >= 2 ? "medium" : "low",
      avoidVerbatimCopy: true, audienceGuidance: [],
      visualGuidance: [creatorMap.tone ? `Tom declarado no mapa: ${creatorMap.tone}` : "", ...(dna?.visual?.settings || []).slice(0,3).map((s: string) => `Cenário recorrente: ${s}`)].filter(Boolean) },
    receipt: { profileVersion: dna?.schemaVersion || "unavailable", evidenceRecordsConsidered: candidates.length,
      fullExemplarsUsed: winningExemplars.length, linkedPlannedScriptsUsed: winningExemplars.filter(e => e.plannedScriptText).length,
      observedTranscriptsUsed: winningExemplars.filter(e => e.observedTranscriptText).length, demographicsUsed: false,
      status: winningExemplars.length >= 2 && winningExemplars.every(e => e.quality?.completenessVerified) && !ranked.coverage.missingLeaderIds.length ? "complete" : winningExemplars.length ? "partial" : "insufficient",
      warnings, packId, rankingVersion: "script_ranking_v2", selectedContentIds: winningExemplars.map(e => e.contentId),
      coverage: ranked.coverage, selectionStage: "prepared", selectedExamples: winningExemplars.length, sentExamples: 0,
      corpusLimited: total > metrics.length, periodStart: since.toISOString(), periodEnd: end.toISOString() },
  };
}

/** Uma representação textual por fonte. Referências são dados, não instruções. */
export function serializeScriptEvidence(pack: CreatorScriptEvidencePack): string {
  const example = (e: CreatorScriptEvidenceExemplar) => ({ ...e, fullText: undefined, segments: undefined });
  return JSON.stringify({ ...pack, winningExemplars: pack.winningExemplars.map(example), contrastExemplar: pack.contrastExemplar ? example(pack.contrastExemplar) : null });
}
