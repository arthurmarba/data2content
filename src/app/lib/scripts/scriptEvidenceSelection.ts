/** Regras determinísticas: não chamam banco nem provedor de IA. */
export const SCRIPT_GOALS = ["engagement", "interactions", "shares", "saves", "attention", "depth", "conversation", "growth", "conversion", "authority"] as const;
export type ScriptGoal = typeof SCRIPT_GOALS[number];
export type EvidenceFormat = "all" | "reel" | "carousel" | "photo";
export type EvidenceRow = Record<string, any>;

export function finiteMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function medianMetric(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = sorted.length;
  return n ? n % 2 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : 0;
}
export function normalizedWords(text: string): string[] {
  return text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
export function lexicalRelevance(query: string, text: string): number {
  const ignored = new Set(["roteiro", "conteudo", "conteudos", "criar", "crie", "baseado", "meus", "minha", "meu", "mais", "engajaram", "engaja", "perfil", "sobre", "para", "segundos"]);
  const a = new Set(normalizedWords(query).filter(w => w.length >= 4 && !ignored.has(w)));
  const b = new Set(normalizedWords(text));
  return a.size ? [...a].filter(w => b.has(w)).length / a.size : 0;
}
export function inferScriptGoal(prompt: string): ScriptGoal {
  const p = normalizedWords(prompt).join(" ");
  if (/numero de interacoes|total de interacoes|interacoes absolutas/.test(p)) return "interactions";
  if (/compartilh/.test(p)) return "shares";
  if (/salvament|mais salv|salvos/.test(p)) return "saves";
  if (/engaj|interac/.test(p)) return "engagement";
  if (/coment|conversa\b|debate|opiniao/.test(p)) return "conversation";
  if (/vend|conversao|leads?\b|orcamento|clientes?\b/.test(p)) return "conversion";
  if (/seguidor|crescimento/.test(p)) return "growth";
  if (/tutorial|checklist|passo a passo/.test(p)) return "depth";
  if (/autoridade|especialista|credibilidade/.test(p)) return "authority";
  return "attention";
}
export function metricPerformance(metric: EvidenceRow) {
  const s = metric.stats || {};
  const views = finiteMetric(s.views ?? s.video_views);
  const totalTime = finiteMetric(s.ig_reels_video_view_total_time);
  return {
    reach: finiteMetric(s.reach), views,
    interactions: finiteMetric(s.total_interactions),
    saves: finiteMetric(s.saved ?? s.saves), shares: finiteMetric(s.shares),
    comments: finiteMetric(s.comments), follows: finiteMetric(s.follows),
    durationSeconds: finiteMetric(s.video_duration_seconds),
    averageWatchTimeSeconds: finiteMetric(s.average_video_watch_time_seconds)
      ?? (finiteMetric(s.ig_reels_avg_watch_time) !== null ? s.ig_reels_avg_watch_time / 1000 : null)
      ?? (views && totalTime !== null ? totalTime / 1000 / views : null),
    capturedAt: metric.lastFetchedAt ?? metric.updatedAt ?? null,
    capturedAtBasis: metric.lastFetchedAt ? "metrics_sync" : metric.updatedAt ? "document_updated_at_not_verified_sync" : "unavailable",
  };
}
export function scoreScriptMetric(performance: ReturnType<typeof metricPerformance>, goal: ScriptGoal) {
  const p = performance;
  const rate = (n: number | null) => p.reach && n !== null ? n / p.reach : null;
  if (goal === "conversion") return { value: null, method: "commercial_attribution_unavailable" };
  if (goal === "interactions") return { value: p.interactions, method: "total_interactions" };
  if (goal === "shares") return { value: rate(p.shares), method: "shares_per_reach" };
  if (goal === "saves") return { value: rate(p.saves), method: "saves_per_reach" };
  if (goal === "conversation") return { value: rate(p.comments), method: "comments_per_reach" };
  if (goal === "growth") return { value: rate(p.follows), method: "follows_per_reach" };
  if (goal === "depth") return { value: p.saves !== null && p.shares !== null ? rate(p.saves + p.shares) : null, method: "saves_and_shares_per_reach" };
  if (goal === "attention") return p.durationSeconds && p.averageWatchTimeSeconds !== null
    ? { value: p.averageWatchTimeSeconds / p.durationSeconds, method: "watch_time_per_duration" }
    : { value: rate(p.views), method: "views_per_reach_proxy" };
  // Autoridade é editorial; o sinal numérico declarado é engajamento, sem promessa de medir autoridade.
  return { value: rate(p.interactions), method: goal === "authority" ? "engagement_proxy_for_authority" : "interactions_per_reach" };
}
export function evidenceText(doc: EvidenceRow, plannedText = "") {
  const raw = typeof doc.transcript?.fullText === "string" ? doc.transcript.fullText.trim() : "";
  const observed = doc.transcript?.source === "gemini_video" ? raw : "";
  const planned = plannedText || (doc.transcript?.source === "stored_script" ? raw : "");
  const quality = doc.transcript?.quality;
  const truncated = quality?.truncated === true || raw.length >= 30_000;
  const usable = Boolean(observed && normalizedWords(observed).length >= 8 && quality?.status !== "invalid");
  return {
    observed: usable ? observed : "", planned,
    fullText: usable ? observed : planned,
    source: usable && planned ? "planned_and_observed" as const : usable ? "observed_transcript" as const : "planned_script" as const,
    quality: {
      status: !observed ? "unavailable" : truncated ? "partial" : quality?.status || "unverified",
      truncated,
      completenessVerified: usable && !truncated && quality?.status === "complete",
      speakerVerified: quality?.speakerVerified === true,
    },
  };
}
export function contentFormat(metric: EvidenceRow): EvidenceFormat {
  const t = String(metric.type || "").toUpperCase();
  return ["VIDEO", "REEL"].includes(t) ? "reel" : t === "CAROUSEL_ALBUM" ? "carousel" : t === "IMAGE" ? "photo" : "all";
}
export function rankScriptEvidence(params: {
  metrics: EvidenceRow[]; evidence: EvidenceRow[]; scripts?: Map<string, string>;
  prompt: string; goal: ScriptGoal; requestedIds?: string[]; now: Date;
}) {
  const evidence = new Map(params.evidence.map(d => [String(d.metricId), d]));
  const rows = params.metrics.map(metric => {
    const doc = evidence.get(String(metric._id));
    const performance = metricPerformance(metric);
    const score = scoreScriptMetric(performance, params.goal);
    const speechDoc = ["photo", "carousel"].includes(contentFormat(metric)) && doc?.transcript?.source === "gemini_video"
      ? { ...doc, transcript: { ...doc.transcript, source: "none" } } : doc;
    const text = evidenceText(speechDoc || {}, params.scripts?.get(String(doc?.scriptLink?.scriptId)) || "");
    const observedAvailable = Boolean(text.observed) || (speechDoc?.transcript?.source === "gemini_video"
      && speechDoc?.completeness?.transcript === true && speechDoc?.transcript?.wordCount >= 8);
    return { metric, doc, performance, ...score, ...text, observedAvailable, contentId: String(metric._id), format: contentFormat(metric) };
  });
  const cohort = (r: typeof rows[number]) => `${r.format}:${r.method}:${r.performance.durationSeconds === null ? "unknown" : r.performance.durationSeconds <= 30 ? "short" : r.performance.durationSeconds <= 60 ? "medium" : "long"}`;
  const cohorts = new Map<string, typeof rows>();
  for (const row of rows) if (row.value !== null) {
    const key = cohort(row); const group = cohorts.get(key) || []; group.push(row); cohorts.set(key,group);
  }
  const summaries = new Map([...cohorts].map(([key, peers]) => [key, {
    baseline: medianMetric(peers.map(r => r.value!)),
    priorExposure: Math.max(50, medianMetric(peers.map(r => r.performance.reach || 0)) * 0.25),
  }]));
  const ranked = rows.map(row => {
    const peers = cohorts.get(cohort(row)) || [];
    const { baseline, priorExposure } = summaries.get(cohort(row)) || { baseline: 0, priorExposure: 50 };
    const exposure = row.performance.reach || 0;
    const adjusted = row.value === null ? null : params.goal === "interactions" ? row.value
      : (row.value * exposure + baseline * priorExposure) / (exposure + priorExposure);
    const performanceIndex = adjusted === null ? null : baseline > 0 ? adjusted / baseline : adjusted > 0 ? 2 : 0;
    const rel = lexicalRelevance(params.prompt, `${row.fullText} ${(row.doc?.narrative?.subjects || []).join(" ")}`);
    const age = Math.max(0, (params.now.getTime() - new Date(row.metric.postDate).getTime()) / 86400000);
    return { ...row, baseline, performanceIndex, relevance: rel,
      requested: (params.requestedIds || []).includes(row.contentId),
      rankScore: 0.6 * Math.min(3, performanceIndex || 0) / 3 + 0.35 * rel + 0.05 * Math.exp(-age / 240),
      winner: row.value !== null && row.value > 0 && (performanceIndex || 0) >= 1 && peers.length >= 2,
    };
  });
  ranked.sort((a,b) => Number(b.requested) - Number(a.requested) || b.rankScore - a.rankScore || a.contentId.localeCompare(b.contentId));
  const usable = ranked.filter(r => r.fullText.length >= 40);
  const selected: typeof usable = [];
  const seen = new Set<string>();
  for (const row of [...usable.filter(r => r.requested || r.winner), ...usable.filter(r => !r.requested && !r.winner)]) {
    const signature = normalizedWords(row.fullText).join(" ");
    if ((!row.requested && seen.has(signature)) || selected.some(r => r.contentId === row.contentId)) continue;
    seen.add(signature); selected.push(row);
    if (selected.length >= 3) break;
  }
  const contrast = usable.filter(r => !selected.includes(r) && r.value !== null && !r.winner)
    .filter(r => selected.some(s => s.format === r.format && s.method === r.method
      && Math.abs((s.performance.durationSeconds || 0) - (r.performance.durationSeconds || 0)) <= 20
      && lexicalRelevance((s.doc?.narrative?.subjects || []).join(" "), (r.doc?.narrative?.subjects || []).join(" ")) > 0))
    .sort((a,b) => (a.performanceIndex || 0) - (b.performanceIndex || 0) || a.contentId.localeCompare(b.contentId))[0] || null;
  const leaders = [...ranked].filter(r => r.value !== null).sort((a,b) => (b.performanceIndex || 0) - (a.performanceIndex || 0) || a.contentId.localeCompare(b.contentId)).slice(0,10);
  return { ranked, selected, contrast, coverage: {
    published: rows.length,
    metricsEligible: ranked.filter(r => r.value !== null).length,
    observedAvailable: ranked.filter(r => r.observedAvailable).length,
    observedAndMetrics: ranked.filter(r => r.observedAvailable && r.value !== null).length,
    leaders: leaders.length,
    leadersWithObservedTranscript: leaders.filter(r => r.observedAvailable).length,
    missingLeaderIds: leaders.filter(r => !r.observedAvailable).map(r => r.contentId),
    requestedWithoutTranscript: ranked.filter(r => r.requested && !r.observedAvailable).map(r => r.contentId),
  } };
}
