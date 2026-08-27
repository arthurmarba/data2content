import { researchMcpInspirationContent } from "./communityResearch";

type RadarSignal = {
  value: string;
  count: number;
  shareOfSample: number;
};

type InspirationItem = {
  content?: {
    format?: unknown;
    durationSeconds?: unknown;
  };
  creativeSignals?: {
    hookPatternLabel?: unknown;
    tones?: unknown;
    subjects?: unknown;
    narratives?: unknown;
  };
};

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function rankedSignals(values: string[], sampleSize: number, limit = 5): RadarSignal[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of values) {
    const key = value.toLocaleLowerCase("pt-BR");
    const current = counts.get(key);
    counts.set(key, { value: current?.value ?? value, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "pt-BR"))
    .slice(0, limit)
    .map((signal) => ({
      ...signal,
      shareOfSample: sampleSize > 0 ? Math.round((signal.count / sampleSize) * 1000) / 1000 : 0,
    }));
}

export function aggregateCreatorRadarItems(rawItems: unknown[]) {
  const items = rawItems as InspirationItem[];
  const sampleSize = items.length;
  const durations = items
    .map((item) => item.content?.durationSeconds)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

  return {
    sampleSize,
    formats: rankedSignals(
      items.map((item) => item.content?.format).filter((value): value is string => typeof value === "string"),
      sampleSize,
    ),
    hooks: rankedSignals(
      items
        .map((item) => item.creativeSignals?.hookPatternLabel)
        .filter((value): value is string => typeof value === "string"),
      sampleSize,
    ),
    tones: rankedSignals(items.flatMap((item) => stringValues(item.creativeSignals?.tones)), sampleSize),
    subjects: rankedSignals(items.flatMap((item) => stringValues(item.creativeSignals?.subjects)), sampleSize),
    narratives: rankedSignals(items.flatMap((item) => stringValues(item.creativeSignals?.narratives)), sampleSize),
    averageDurationSeconds: durations.length
      ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10
      : null,
  };
}

export async function buildMcpCreatorRadar(params: {
  userId: string;
  creatorNorth: string;
  periodDays?: number;
}) {
  const research = await researchMcpInspirationContent({
    userId: params.userId,
    mode: "winning_patterns",
    query: params.creatorNorth,
    filters: {
      formats: [],
      tones: [],
      hookPatterns: [],
      sceneKeywords: [],
      objects: [],
      framing: [],
      aesthetics: [],
    },
    periodDays: params.periodDays ?? 180,
    limit: 10,
  });
  const panorama = aggregateCreatorRadarItems(research.items);

  return {
    schemaVersion: "creator_radar_v1" as const,
    creatorNorth: params.creatorNorth,
    narrativePreview: {
      source: "creator_declared_north" as const,
      instruction:
        "Apresente uma leitura breve da direção narrativa declarada pelo creator, sem tratá-la como diagnóstico definitivo.",
    },
    communityPanorama: panorama,
    creationBrief: {
      instruction:
        "Cruze o Norte com os padrões agregados para responder ao pedido do usuário. Gere quantas pautas, estratégias ou roteiros ele solicitar; adapte os padrões e nunca copie creators específicos.",
      suggestedFirstOutput:
        "Uma prévia narrativa curta, os padrões mais relacionados encontrados e cinco caminhos iniciais de pauta.",
    },
    coverage: research.coverage,
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_opt_in_community_content_aggregate" as const,
      onlyAggregateSignalsReturned: true as const,
      sampleIsNotWholeCommunity: true as const,
      exactPrivateMetricsExposed: false as const,
      creatorIdentitiesExposed: false as const,
      mustNotPresentAsGuaranteedPerformance: true as const,
    },
  };
}
