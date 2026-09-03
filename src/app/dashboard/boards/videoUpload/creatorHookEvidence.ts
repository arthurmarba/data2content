export type CreatorHookPattern =
  | "question"
  | "diagnostic"
  | "comparison"
  | "specific_number"
  | "contrarian"
  | "personal_confession"
  | "direct_statement";

export const CREATOR_HOOK_PATTERN_LABELS: Record<CreatorHookPattern, string> = {
  question: "Pergunta direta",
  diagnostic: "Diagnóstico de um problema",
  comparison: "Comparação",
  specific_number: "Número específico",
  contrarian: "Quebra de crença",
  personal_confession: "Relato pessoal",
  direct_statement: "Afirmação direta",
};

export type CreatorHookEvidence = {
  spokenLine: string | null;
  screenTitle: string | null;
  pattern: CreatorHookPattern;
  subject: string | null;
  tone: string | null;
  performanceIndex: number;
  outcomeSignals: Array<"retention" | "watch_time" | "replay" | "deep_engagement">;
};

export type CreatorHookEvidenceMetric = {
  stats?: Record<string, unknown> | null;
  sceneElements?: {
    openingLine?: string | null;
    screenTitle?: string | null;
    subjects?: string[];
    subjectIds?: string[];
    toneIds?: string[];
  } | null;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function median(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 0
    ? ((usable[middle - 1] ?? 0) + (usable[middle] ?? 0)) / 2
    : usable[middle] ?? null;
}

function clean(value: string | null | undefined, max = 160): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim().slice(0, max);
  return normalized || null;
}

function watchTimeSeconds(stats: Record<string, unknown>): number | null {
  const direct = finite(stats.average_video_watch_time_seconds) ?? finite(stats.avg_watch_time_seconds);
  if (direct !== null) return direct;
  const milliseconds = finite(stats.ig_reels_avg_watch_time);
  return milliseconds !== null ? milliseconds / 1000 : null;
}

function signals(metric: CreatorHookEvidenceMetric) {
  const stats = metric.stats ?? {};
  const reach = finite(stats.reach ?? stats.accounts_reached);
  const duration = finite(stats.video_duration_seconds);
  const watchTime = watchTimeSeconds(stats);
  const retention = finite(stats.retention_rate);
  const views = finite(stats.views ?? stats.video_views ?? stats.plays);
  const comments = finite(stats.comments) ?? 0;
  const saves = finite(stats.saved ?? stats.saves) ?? 0;
  const shares = finite(stats.shares) ?? 0;
  return {
    retention: retention !== null && retention > 0 ? retention : null,
    watchRatio: watchTime !== null && duration !== null && duration > 0 ? Math.min(2, watchTime / duration) : null,
    replay: views !== null && reach !== null && reach > 0 ? Math.min(3, views / reach) : null,
    deep: reach !== null && reach > 0 ? (comments + saves + shares) / reach : null,
  };
}

function relative(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null || baseline <= 0) return null;
  return Math.max(0, Math.min(3, value / baseline));
}

export function classifyCreatorHookPattern(line: string): CreatorHookPattern {
  const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  if (line.includes("?") || /^(voce|por que|como|quando|qual|sera que)\b/.test(normalized)) return "question";
  if (/\b(erros?|errad[oa]s?|problemas?|trava|dor|falhas?)\b/.test(normalized)) return "diagnostic";
  if (/\b(antes|depois|versus|vs\.?|mais que|menos que)\b/.test(normalized)) return "comparison";
  if (/\d/.test(normalized)) return "specific_number";
  if (/\b(ninguem|mito|ao contrario|na verdade|pare de|nao e)\b/.test(normalized)) return "contrarian";
  if (/^(eu|meu|minha|quando eu|eu nunca|eu quase)\b/.test(normalized)) return "personal_confession";
  return "direct_statement";
}

export function buildCreatorHookEvidenceFromMetrics(
  metrics: CreatorHookEvidenceMetric[],
  limit = 5,
): CreatorHookEvidence[] {
  const eligible = metrics
    .map((metric) => ({ metric, values: signals(metric) }))
    .filter(({ metric }) => clean(metric.sceneElements?.openingLine) || clean(metric.sceneElements?.screenTitle));
  const baselines = {
    retention: median(eligible.map(({ values }) => values.retention)),
    watchRatio: median(eligible.map(({ values }) => values.watchRatio)),
    replay: median(eligible.map(({ values }) => values.replay)),
    deep: median(eligible.map(({ values }) => values.deep)),
  };

  return eligible
    .map(({ metric, values }) => {
      const weighted = [
        { key: "retention" as const, value: relative(values.retention, baselines.retention), weight: 0.35 },
        { key: "watch_time" as const, value: relative(values.watchRatio, baselines.watchRatio), weight: 0.35 },
        { key: "replay" as const, value: relative(values.replay, baselines.replay), weight: 0.15 },
        { key: "deep_engagement" as const, value: relative(values.deep, baselines.deep), weight: 0.15 },
      ].filter((item): item is { key: "retention" | "watch_time" | "replay" | "deep_engagement"; value: number; weight: number } => item.value !== null);
      const usedWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
      const performanceIndex = usedWeight > 0
        ? weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / usedWeight
        : 1;
      const spokenLine = clean(metric.sceneElements?.openingLine);
      const screenTitle = clean(metric.sceneElements?.screenTitle);
      const representative = spokenLine ?? screenTitle ?? "";
      return {
        spokenLine,
        screenTitle,
        pattern: classifyCreatorHookPattern(representative),
        subject: clean(metric.sceneElements?.subjects?.[0] ?? metric.sceneElements?.subjectIds?.[0], 100),
        tone: clean(metric.sceneElements?.toneIds?.[0], 80),
        performanceIndex: Math.round(performanceIndex * 100) / 100,
        outcomeSignals: weighted.map((item) => item.key),
      } satisfies CreatorHookEvidence;
    })
    .sort((a, b) => b.performanceIndex - a.performanceIndex || (a.spokenLine ?? a.screenTitle ?? "").localeCompare(b.spokenLine ?? b.screenTitle ?? ""))
    .filter((item, index, all) => {
      const key = `${item.spokenLine ?? ""}|${item.screenTitle ?? ""}`.toLocaleLowerCase("pt-BR");
      return all.findIndex((candidate) => `${candidate.spokenLine ?? ""}|${candidate.screenTitle ?? ""}`.toLocaleLowerCase("pt-BR") === key) === index;
    })
    .slice(0, Math.max(0, limit));
}
