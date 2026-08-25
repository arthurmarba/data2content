import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import PublishedContentEvidence from "@/app/models/PublishedContentEvidence";
import ScriptEntry from "@/app/models/ScriptEntry";
import { getCreatorScriptDnaV3, sanitizeCreatorScriptDnaForMcp } from "./creatorScriptDnaV3";

export type CreatorScriptGoal = "attention" | "depth" | "conversation" | "conversion" | "authority";

export type CreatorScriptEvidenceExemplar = {
  contentId: string;
  scriptId: string | null;
  source: "planned_script" | "observed_transcript" | "planned_and_observed";
  fullText: string;
  plannedScriptText: string | null;
  observedTranscriptText: string | null;
  hook: string | null;
  cta: string | null;
  structure: string[];
  subjects: string[];
  durationSeconds: number | null;
  performanceIndex: number;
  relevance: number;
};

export type CreatorScriptEvidencePack = {
  schemaVersion: "creator_script_evidence_pack_v1";
  generatedAt: string;
  request: {
    prompt: string;
    goal: CreatorScriptGoal;
    targetDurationSeconds: number | null;
  };
  dna: ReturnType<typeof sanitizeCreatorScriptDnaForMcp>;
  winningExemplars: CreatorScriptEvidenceExemplar[];
  contrastExemplar: CreatorScriptEvidenceExemplar | null;
  generationConstraints: {
    targetDurationSeconds: number;
    preferredSceneCount: number;
    creatorFitConfidence: "low" | "medium" | "high";
    avoidVerbatimCopy: boolean;
    audienceGuidance: string[];
    visualGuidance: string[];
  };
  receipt: {
    profileVersion: string;
    evidenceRecordsConsidered: number;
    fullExemplarsUsed: number;
    linkedPlannedScriptsUsed: number;
    observedTranscriptsUsed: number;
    demographicsUsed: boolean;
    status: "complete" | "partial" | "insufficient";
    warnings: string[];
  };
};

function normalizedTokens(value: string): Set<string> {
  return new Set(value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 4));
}

function relevance(query: string, candidate: string): number {
  const q = normalizedTokens(query);
  const c = normalizedTokens(candidate);
  if (!q.size || !c.size) return 0;
  let overlap = 0;
  for (const token of q) if (c.has(token)) overlap += 1;
  return Number((overlap / q.size).toFixed(4));
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function median(values: number[]): number {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return 0;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2
    ? usable[middle] ?? 0
    : ((usable[middle - 1] ?? 0) + (usable[middle] ?? 0)) / 2;
}

function scorePerformance(doc: any, goal: CreatorScriptGoal): number {
  const p = doc.performance || {};
  const reach = Math.max(1, finite(p.reach) || 0);
  const duration = finite(p.durationSeconds);
  const avgWatch = finite(p.averageWatchTimeSeconds);
  const attention = duration && avgWatch !== null
    ? avgWatch / duration
    : (finite(p.views) || 0) / reach;
  const depth = ((finite(p.saves) || 0) + (finite(p.shares) || 0)) / reach;
  const conversation = (finite(p.comments) || 0) / reach;
  const conversion = (finite(p.follows) || 0) / reach;
  const fallback = (finite(p.interactions) || 0) / reach;
  const selected = goal === "attention" ? attention
    : goal === "depth" ? depth
      : goal === "conversation" ? conversation
        : goal === "conversion" ? conversion
          : 0.35 * attention + 0.35 * depth + 0.15 * conversation + 0.15 * conversion;
  return Number((Number.isFinite(selected) && selected > 0 ? selected : fallback).toFixed(6));
}

function inferGoal(prompt: string): CreatorScriptGoal {
  if (/vend|convers|lead|direct|or[cç]amento|cliente/i.test(prompt)) return "conversion";
  if (/coment|conversa|debate|opini[aã]o|resposta/i.test(prompt)) return "conversation";
  if (/salv|compart|util|passo|tutorial|checklist/i.test(prompt)) return "depth";
  if (/autoridade|especialista|posicion|credibilidade/i.test(prompt)) return "authority";
  return "attention";
}

function inferDuration(prompt: string): number | null {
  const match = prompt.match(/(\d{1,3})\s*(?:s|seg|segundos?)(?:\b|$)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 8 && value <= 180 ? value : null;
}

function audienceGuidance(dna: any): string[] {
  const audience = dna?.audience;
  if (!audience || audience.source === "none") return [];
  const lines: string[] = [];
  if (audience.age?.length) lines.push(`Faixas etárias mais presentes: ${audience.age.join(", ")}.`);
  if (audience.cities?.length) lines.push(`Contextos geográficos recorrentes: ${audience.cities.slice(0, 3).join(", ")}.`);
  lines.push("Use demografia apenas para clareza e escolha de exemplos; não presuma crenças ou comportamento.");
  return lines;
}

export async function buildCreatorScriptEvidencePack(params: {
  userId: string;
  prompt: string;
  goal?: CreatorScriptGoal;
  targetDurationSeconds?: number | null;
}): Promise<CreatorScriptEvidencePack> {
  if (!Types.ObjectId.isValid(params.userId)) throw new Error("invalid_user_id");
  const prompt = params.prompt.replace(/\s+/g, " ").trim();
  if (!prompt) throw new Error("prompt_required");
  await connectToDatabase();
  const userId = new Types.ObjectId(params.userId);
  const goal = params.goal || inferGoal(prompt);
  const explicitDuration = params.targetDurationSeconds ?? inferDuration(prompt);
  const dnaDoc = await getCreatorScriptDnaV3({ userId: params.userId });
  const dna = sanitizeCreatorScriptDnaForMcp(dnaDoc);
  const candidates = await PublishedContentEvidence.find({
    userId,
    "completeness.performance": true,
    $or: [
      { "completeness.transcript": true },
      { "completeness.scriptLink": true },
    ],
  }).sort({ publishedAt: -1 }).limit(500).lean<any[]>();

  const linkedScriptIds = [...new Set(candidates
    .map((doc) => String(doc.scriptLink?.scriptId || ""))
    .filter((id) => Types.ObjectId.isValid(id)))];
  const scripts = linkedScriptIds.length
    ? await ScriptEntry.find({ userId, _id: { $in: linkedScriptIds.map((id) => new Types.ObjectId(id)) } })
      .select("_id content").lean<any[]>()
    : [];
  const scriptById = new Map(scripts.map((item) => [String(item._id), String(item.content || "").trim()]));

  const rawScores = candidates.map((doc) => scorePerformance(doc, goal));
  const reaches = candidates.map((doc) => finite(doc.performance?.reach) || 0);
  const priorScore = median(rawScores.filter((score) => score > 0));
  const priorExposure = Math.max(50, median(reaches.filter((reach) => reach > 0)) * 0.25);
  const adjustedScores = rawScores.map((score, index) => {
    const exposure = reaches[index] ?? 0;
    return (score * exposure + priorScore * priorExposure) / Math.max(1, exposure + priorExposure);
  });
  const maxPerformance = Math.max(0.000001, ...adjustedScores);
  const ranked = candidates.map((doc, index) => {
    const scriptId = String(doc.scriptLink?.scriptId || "");
    const planned = scriptById.get(scriptId) || "";
    const observed = String(doc.transcript?.fullText || "").trim();
    const fullText = observed || planned;
    const rel = relevance(prompt, [fullText, ...(doc.narrative?.subjects || [])].join(" "));
    const performanceIndex = (adjustedScores[index] ?? 0) / maxPerformance;
    const ageDays = doc.publishedAt ? Math.max(0, (Date.now() - new Date(doc.publishedAt).getTime()) / 86_400_000) : 365;
    const recency = Math.max(0.2, Math.exp(-ageDays / 240));
    return {
      doc,
      fullText,
      scriptId: planned ? scriptId : null,
      source: planned && observed
        ? "planned_and_observed" as const
        : planned ? "planned_script" as const : "observed_transcript" as const,
      planned,
      observed,
      rel,
      performanceIndex,
      rankScore: 0.5 * performanceIndex + 0.4 * rel + 0.1 * recency,
    };
  }).filter((item) => item.fullText.length >= 80)
    .sort((a, b) => b.rankScore - a.rankScore);

  const selected: typeof ranked = [];
  const seenContent = new Set<string>();
  for (const item of ranked) {
    const signature = [...normalizedTokens(item.fullText)].slice(0, 30).join("|");
    if (seenContent.has(signature)) continue;
    seenContent.add(signature);
    selected.push(item);
    if (selected.length >= 3) break;
  }
  const bottom = [...ranked].sort((a, b) => a.performanceIndex - b.performanceIndex)
    .find((item) => !selected.includes(item)) || null;

  const toExemplar = (item: typeof ranked[number]): CreatorScriptEvidenceExemplar => ({
    contentId: String(item.doc.metricId || ""),
    scriptId: item.scriptId,
    source: item.source,
    fullText: item.fullText.slice(0, 20_000),
    plannedScriptText: item.planned ? item.planned.slice(0, 20_000) : null,
    observedTranscriptText: item.observed ? item.observed.slice(0, 30_000) : null,
    hook: typeof item.doc.narrative?.hook === "string" ? item.doc.narrative.hook : null,
    cta: typeof item.doc.narrative?.cta === "string" ? item.doc.narrative.cta : null,
    structure: Array.isArray(item.doc.narrative?.structure) ? item.doc.narrative.structure.slice(0, 12) : [],
    subjects: Array.isArray(item.doc.narrative?.subjects) ? item.doc.narrative.subjects.slice(0, 10) : [],
    durationSeconds: finite(item.doc.performance?.durationSeconds),
    performanceIndex: Number(item.performanceIndex.toFixed(4)),
    relevance: item.rel,
  });
  const winningExemplars = selected.map(toExemplar);
  const targetDurationSeconds = explicitDuration
    || finite(dna?.narrative?.medianDurationSeconds)
    || 35;
  const warnings: string[] = [];
  if (!winningExemplars.length) warnings.push("Sem roteiro integral vencedor; a geração usará o DNA agregado e regras base.");
  if (!dna?.coverage?.demographics) warnings.push("Demografia indisponível; nenhuma personalização demográfica será inferida.");
  if ((dna?.confidence || "low") === "low") warnings.push("Amostra pequena; trate as recomendações como experimento.");

  return {
    schemaVersion: "creator_script_evidence_pack_v1",
    generatedAt: new Date().toISOString(),
    request: { prompt, goal, targetDurationSeconds: explicitDuration },
    dna,
    winningExemplars,
    contrastExemplar: bottom ? toExemplar(bottom) : null,
    generationConstraints: {
      targetDurationSeconds: Math.round(targetDurationSeconds),
      preferredSceneCount: targetDurationSeconds <= 25 ? 4 : targetDurationSeconds <= 50 ? 5 : 6,
      creatorFitConfidence: dna?.confidence || "low",
      avoidVerbatimCopy: true,
      audienceGuidance: audienceGuidance(dna),
      visualGuidance: [
        dna?.visual?.settings?.length ? `Cenários recorrentes: ${dna.visual.settings.join(", ")}.` : "",
        dna?.visual?.objects?.length ? `Objetos recorrentes: ${dna.visual.objects.join(", ")}.` : "",
        dna?.visual?.framing?.length ? `Enquadramentos recorrentes: ${dna.visual.framing.join(", ")}.` : "",
      ].filter(Boolean),
    },
    receipt: {
      profileVersion: dna?.schemaVersion || "unavailable",
      evidenceRecordsConsidered: candidates.length,
      fullExemplarsUsed: winningExemplars.length,
      linkedPlannedScriptsUsed: winningExemplars.filter((item) => Boolean(item.plannedScriptText)).length,
      observedTranscriptsUsed: winningExemplars.filter((item) => Boolean(item.observedTranscriptText)).length,
      demographicsUsed: Boolean(dna?.coverage?.demographics),
      status: winningExemplars.length >= 2 && dna?.confidence !== "low"
        ? "complete" : winningExemplars.length ? "partial" : "insufficient",
      warnings,
    },
  };
}
