import { researchMcpInspirationContent } from "./communityResearch";
import { loadMcpCreatorMap } from "./creatorMap";

/** Abaixo disso, a amostra do assunto é pequena demais para chamar de padrão. */
const MIN_RELATED_SAMPLE = 3;

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
  // O mapa é o dicionário: territórios e temas são substantivos e descrevem o
  // assunto melhor do que a frase do Norte. Sem mapa, o Norte é o que há.
  const map = await loadMcpCreatorMap(params.userId).catch(() => null);
  const mapTopics = [...(map?.territories ?? []), ...(map?.themes ?? [])].slice(0, 8);
  const topicBasis = mapTopics.length ? "map_territories" as const : "creator_north" as const;
  const topicQuery = mapTopics.length ? mapTopics.join(" ") : params.creatorNorth;
  const baseParams = {
    userId: params.userId,
    mode: "winning_patterns" as const,
    query: topicQuery,
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
  };
  const related = await researchMcpInspirationContent({ ...baseParams, topicPrefilter: topicQuery });
  const usedGeneralPatterns = related.items.length < MIN_RELATED_SAMPLE;
  const research = usedGeneralPatterns
    ? await researchMcpInspirationContent(baseParams)
    : related;
  const panorama = aggregateCreatorRadarItems(research.items);
  const panoramaScope = usedGeneralPatterns ? "general_community" as const : "related_to_creator_topics" as const;

  return {
    schemaVersion: "creator_radar_v1" as const,
    creatorNorth: params.creatorNorth,
    panoramaScope,
    topicBasis: {
      source: topicBasis,
      terms: mapTopics.length ? mapTopics : [],
      relatedPostsFound: related.items.length,
    },
    narrativePreview: {
      source: "creator_declared_north" as const,
      instruction:
        "Apresente uma leitura breve da direção narrativa declarada pelo creator, sem tratá-la como diagnóstico definitivo.",
    },
    communityPanorama: panorama,
    creationBrief: {
      instruction: usedGeneralPatterns
        ? "A comunidade ainda não tem posts suficientes do assunto do creator: os padrões abaixo são gerais, " +
          "de posts de vários temas que performaram acima da base dos próprios autores. Diga isso com clareza " +
          "e não os apresente como padrões do assunto dele. Use-os só como forma (gancho, duração, formato), " +
          "com o conteúdo vindo do Norte e do mapa. Nunca copie creators específicos."
        : "Os padrões abaixo vêm de posts da comunidade sobre os assuntos do creator que performaram acima da " +
          "base dos próprios autores. Cruze com o Norte e com os territórios de get_creator_map para responder ao " +
          "pedido. Adapte os padrões e nunca copie creators específicos.",
      suggestedFirstOutput:
        "Uma prévia narrativa curta, os padrões encontrados (dizendo se são do assunto dele ou gerais) e até " +
        "cinco caminhos iniciais, cada um ligado a um território do mapa quando houver.",
    },
    coverage: {
      ...research.coverage,
      warnings: [
        ...research.coverage.warnings,
        ...(usedGeneralPatterns ? ["radar_used_general_community_patterns"] : []),
        ...(topicBasis === "creator_north" ? ["creator_map_topics_unavailable_used_north"] : []),
      ],
    },
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
