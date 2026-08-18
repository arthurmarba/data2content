import {
  canonicalAestheticById,
  canonicalAssetRoleById,
  canonicalFramingById,
  canonicalPlaceById,
  canonicalToneById,
} from "@/app/lib/relatorio/mapRegistry";
import {
  gridPosition,
  SLOT_LABELS,
  WEEKDAY_LABELS_SHORT,
  type WeekWindow,
} from "@/app/lib/relatorio/weekWindow";
import {
  CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
  type CreatorWeeklyReportDetail,
  type CreatorWeeklyReportEvidence,
  type CreatorWeeklyReportPayload,
  type CreatorWeeklyReportRankGroup,
  type CreatorWeeklyReportRankItem,
  type CreatorWeeklyReportVideo,
} from "./types";

type MetricStats = Record<string, unknown>;

export interface CreatorWeeklyReportMetricInput {
  instagramMediaId?: string | null;
  postLink?: string | null;
  postDate: Date | string;
  description?: string | null;
  thumbnailUrl?: string | null;
  coverUrl?: string | null;
  stats?: MetricStats | null;
  updatedAt?: Date | string | null;
  sceneElements?: {
    subjects?: unknown;
    subjectIds?: unknown;
    objects?: unknown;
    placeId?: unknown;
    toneIds?: unknown;
    framingIds?: unknown;
    openingLine?: unknown;
    version?: unknown;
  } | null;
}

type PreparedMetric = Omit<CreatorWeeklyReportMetricInput, "postDate"> & {
  postDate: Date;
  views: number | null;
  saved: number | null;
  shares: number | null;
};

type ExtractedItem = { id: string; label: string };

const MAX_RANK_ITEMS = 10;
const EVIDENCE_K = 5;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricValue(stats: MetricStats | null | undefined, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = finiteNumber(stats?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function median(values: Array<number | null>): number | null {
  const usable = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 0
    ? ((usable[middle - 1] as number) + (usable[middle] as number)) / 2
    : (usable[middle] as number);
}

function indexAgainst(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null || baseline <= 0) return null;
  return value / baseline;
}

function evidenceFor(nPosts: number): CreatorWeeklyReportEvidence {
  const confidence = nPosts <= 0 ? 0 : nPosts / (nPosts + EVIDENCE_K);
  if (confidence < 0.35) return "indicio";
  if (confidence < 0.6) return "sinal";
  return "tendencia";
}

function rankStrength(index: number | null, nPosts: number): number {
  if (index === null || !Number.isFinite(index)) return 0;
  return 1 + (index - 1) * (nPosts / (nPosts + EVIDENCE_K));
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text || null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = normalizeText(item);
    if (!text) continue;
    const key = text.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function bestPerformanceIndex(
  metrics: Pick<PreparedMetric, "shares" | "saved" | "views">,
  baseline: { shares: number | null; saved: number | null; views: number | null },
): number | null {
  return (
    indexAgainst(metrics.shares, baseline.shares) ??
    indexAgainst(metrics.saved, baseline.saved) ??
    indexAgainst(metrics.views, baseline.views)
  );
}

function prepareMetrics(metrics: CreatorWeeklyReportMetricInput[]): PreparedMetric[] {
  return metrics
    .map((metric) => {
      const postDate = metric.postDate instanceof Date ? metric.postDate : new Date(metric.postDate);
      if (Number.isNaN(postDate.getTime())) return null;
      return {
        ...metric,
        postDate,
        views: metricValue(metric.stats, "views", "video_views", "impressions"),
        saved: metricValue(metric.stats, "saved"),
        shares: metricValue(metric.stats, "shares"),
      } satisfies PreparedMetric;
    })
    .filter((metric): metric is PreparedMetric => metric !== null);
}

function buildRankGroup(params: {
  id: string;
  title: string;
  subtitle: string;
  metrics: PreparedMetric[];
  weekStartsAt: Date;
  baseline: { shares: number | null; saved: number | null; views: number | null };
  extract: (metric: PreparedMetric) => ExtractedItem[];
  minimumPosts?: number;
}): CreatorWeeklyReportRankGroup {
  const groups = new Map<string, { label: string; metrics: PreparedMetric[] }>();
  for (const metric of params.metrics) {
    for (const item of params.extract(metric)) {
      const current = groups.get(item.id) ?? { label: item.label, metrics: [] };
      current.metrics.push(metric);
      groups.set(item.id, current);
    }
  }

  const items: CreatorWeeklyReportRankItem[] = [];
  for (const [id, group] of groups) {
    if (group.metrics.length < (params.minimumPosts ?? 1)) continue;
    const aggregate = {
      shares: median(group.metrics.map((metric) => metric.shares)),
      saved: median(group.metrics.map((metric) => metric.saved)),
      views: median(group.metrics.map((metric) => metric.views)),
    };
    items.push({
      id,
      label: group.label,
      nPosts: group.metrics.length,
      index: bestPerformanceIndex(aggregate, params.baseline),
      evidence: evidenceFor(group.metrics.length),
      weeklyOccurrences: group.metrics.filter((metric) => metric.postDate >= params.weekStartsAt).length,
    });
  }

  items.sort((a, b) => rankStrength(b.index, b.nPosts) - rankStrength(a.index, a.nPosts));

  return {
    id: params.id,
    title: params.title,
    subtitle: params.subtitle,
    items: items.slice(0, MAX_RANK_ITEMS),
  };
}

function buildTextExtremesGroup(params: {
  id: string;
  title: string;
  subtitle: string;
  metrics: PreparedMetric[];
  weekStartsAt: Date;
  baseline: { shares: number | null; saved: number | null; views: number | null };
  extract: (metric: PreparedMetric) => string | null;
  ascending?: boolean;
}): CreatorWeeklyReportRankGroup {
  const items = params.metrics
    .map<CreatorWeeklyReportRankItem | null>((metric) => {
      const label = params.extract(metric);
      if (!label) return null;
      return {
        id: `${params.id}-${metric.instagramMediaId ?? metric.postDate.toISOString()}`,
        label,
        nPosts: 1,
        index: bestPerformanceIndex(metric, params.baseline),
        evidence: "indicio" as const,
        weeklyOccurrences: metric.postDate >= params.weekStartsAt ? 1 : 0,
      };
    })
    .filter((item): item is CreatorWeeklyReportRankItem => item !== null && item.index !== null)
    .sort((a, b) => (params.ascending ? 1 : -1) * ((a.index ?? 0) - (b.index ?? 0)))
    .slice(0, 6);

  return { id: params.id, title: params.title, subtitle: params.subtitle, items };
}

function formatCompactNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function truncateDescription(value: string | null | undefined): string {
  const text = normalizeText(value);
  if (!text) return "O conteúdo que mais se destacou na semana.";
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence.length > 150 ? `${sentence.slice(0, 147).trim()}…` : sentence;
}

function buildWeeklyVideo(
  weekMetrics: PreparedMetric[],
  baseline: { shares: number | null; saved: number | null; views: number | null },
): CreatorWeeklyReportVideo | null {
  const sorted = [...weekMetrics].sort((a, b) => {
    const aIndex = bestPerformanceIndex(a, baseline);
    const bIndex = bestPerformanceIndex(b, baseline);
    if (aIndex !== null || bIndex !== null) return (bIndex ?? -1) - (aIndex ?? -1);
    return (b.shares ?? 0) + (b.saved ?? 0) - ((a.shares ?? 0) + (a.saved ?? 0));
  });
  const metric = sorted[0];
  if (!metric) return null;
  const subjects = stringList(metric.sceneElements?.subjects);
  const placeId = normalizeText(metric.sceneElements?.placeId);
  return {
    postId: metric.instagramMediaId ?? null,
    postLink: normalizeText(metric.postLink),
    thumbnailUrl: normalizeText(metric.thumbnailUrl) ?? normalizeText(metric.coverUrl),
    publishedAt: metric.postDate.toISOString(),
    description: truncateDescription(metric.description),
    views: metric.views,
    saved: metric.saved,
    shares: metric.shares,
    performanceIndex: bestPerformanceIndex(metric, baseline),
    openingLine: normalizeText(metric.sceneElements?.openingLine),
    subject: subjects[0] ?? null,
    place: placeId ? canonicalPlaceById(placeId)?.label ?? null : null,
  };
}

/**
 * Uma frase de dica, não de relatório. "Natureza chegou a 7,5× do seu normal"
 * descreve a tabela; "Natureza rendeu 7,5× o seu normal" conta o que aconteceu —
 * e usa a mesma régua que aparece em todo o resto da tela.
 */
function detailSummary(groups: CreatorWeeklyReportRankGroup[], fallback: string): string {
  const best = groups.flatMap((group) => group.items).find((item) => item.index !== null);
  if (!best) return fallback;
  if (!best.index) return `${best.label} rendeu acima do seu normal.`;
  return `${best.label} rendeu ${best.index.toFixed(1).replace(".", ",")}× o seu normal.`;
}

export function buildCreatorWeeklyReport(params: {
  metrics: CreatorWeeklyReportMetricInput[];
  week: WeekWindow;
  generatedAt?: Date;
}): CreatorWeeklyReportPayload {
  const generatedAt = params.generatedAt ?? new Date();
  const metrics = prepareMetrics(params.metrics).filter(
    (metric) => metric.postDate >= params.week.windowStartsAt && metric.postDate <= params.week.endsAt,
  );
  const weekMetrics = metrics.filter(
    (metric) => metric.postDate >= params.week.startsAt && metric.postDate <= params.week.endsAt,
  );
  const sceneMetrics = metrics.filter((metric) => Boolean(metric.sceneElements?.version));
  const baseline = {
    shares: median(metrics.map((metric) => metric.shares)),
    saved: median(metrics.map((metric) => metric.saved)),
    views: median(metrics.map((metric) => metric.views)),
  };

  const timingGroups = [
    buildRankGroup({
      id: "weekday",
      title: "Ranking dos dias",
      subtitle: "Contra o que você costuma fazer nos últimos 90 dias.",
      metrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => {
        const { dayOfWeek } = gridPosition(metric.postDate);
        return [{ id: `day-${dayOfWeek}`, label: WEEKDAY_LABELS_SHORT[dayOfWeek] ?? "Dia" }];
      },
    }),
    buildRankGroup({
      id: "time-slot",
      title: "Ranking dos horários",
      subtitle: "Faixas de quatro horas, no horário de Brasília.",
      metrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => {
        const { slot } = gridPosition(metric.postDate);
        return [{ id: `slot-${slot}`, label: SLOT_LABELS[slot] ?? "Horário" }];
      },
    }),
  ];

  const sceneGroups = [
    buildRankGroup({
      id: "place",
      title: "Onde você grava",
      subtitle: "Onde você gravou.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => {
        const id = normalizeText(metric.sceneElements?.placeId);
        const label = id ? canonicalPlaceById(id)?.label : null;
        return id && label ? [{ id, label }] : [];
      },
    }),
    buildRankGroup({
      id: "tone",
      title: "Seu jeito de falar",
      subtitle: "Como você fala nos vídeos.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => stringList(metric.sceneElements?.toneIds)
        .map((id) => ({ id, label: canonicalToneById(id)?.label ?? id })),
    }),
    buildRankGroup({
      id: "framing",
      title: "Como a câmera te mostra",
      subtitle: "Como a câmera te mostra.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => stringList(metric.sceneElements?.framingIds)
        .map((id) => ({ id, label: canonicalFramingById(id)?.label ?? id })),
    }),
    // Objeto em cena é decisão de gravação tanto quanto o cenário: a caneca, o
    // carrinho, a prancheta. A leitura já identificava e ninguém via.
    buildRankGroup({
      id: "objects",
      title: "Objetos em cena",
      subtitle: "O que aparece junto com você nos vídeos.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      minimumPosts: 2,
      extract: (metric) => stringList(metric.sceneElements?.objects)
        .map((label) => ({ id: label.toLocaleLowerCase("pt-BR"), label })),
    }),
    // Elenco pelo PAPEL, nunca pelo nome da pessoa — "parceiro em cena", não o
    // nome de quem aparece (Regra 3 do registro canônico).
    buildRankGroup({
      id: "cast",
      title: "Quem aparece com você",
      subtitle: "Papéis identificados em cena, nunca nomes.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => stringList(metric.sceneElements?.assetRoleIds)
        .map((id) => ({ id, label: canonicalAssetRoleById(id)?.label ?? id })),
    }),
    buildRankGroup({
      id: "aesthetics",
      title: "Clima da imagem",
      subtitle: "Traços visuais recorrentes: luz, textura, acabamento.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => stringList(metric.sceneElements?.aestheticIds)
        .map((id) => ({ id, label: canonicalAestheticById(id)?.label ?? id })),
    }),
  ].filter((group) => group.items.length > 0);

  const subjectGroups = [
    buildRankGroup({
      id: "subjects-repeated",
      title: "Assuntos que você repetiu",
      subtitle: "Temas que você repetiu em mais de um vídeo.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      minimumPosts: 2,
      extract: (metric) => stringList(metric.sceneElements?.subjects)
        .map((label) => ({ id: label.toLocaleLowerCase("pt-BR"), label })),
    }),
    buildTextExtremesGroup({
      id: "subjects-best",
      title: "Assuntos mais fortes",
      subtitle: "O tema exato dos vídeos que mais renderam.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => stringList(metric.sceneElements?.subjects).join(" · ") || null,
    }),
  ].filter((group) => group.items.length > 0);

  const openingGroups = [
    buildTextExtremesGroup({
      id: "openings-best",
      title: "Aberturas mais fortes",
      subtitle: "Como começaram os vídeos que mais renderam.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      extract: (metric) => normalizeText(metric.sceneElements?.openingLine),
    }),
    buildTextExtremesGroup({
      id: "openings-weak",
      title: "Aberturas que renderam menos",
      subtitle: "Serve de contraste, não de regra.",
      metrics: sceneMetrics,
      weekStartsAt: params.week.startsAt,
      baseline,
      ascending: true,
      extract: (metric) => normalizeText(metric.sceneElements?.openingLine),
    }),
  ].filter((group) => group.items.length > 0);

  const scenePercent = metrics.length > 0 ? Math.round((sceneMetrics.length / metrics.length) * 100) : 0;
  const coverageLabel = `${sceneMetrics.length} de ${metrics.length} posts já analisados`;
  const details: CreatorWeeklyReportDetail[] = [
    {
      id: "timing",
      title: "Dia e horário",
      subtitle: "Quando seus posts rendem mais — e quando rendem menos.",
      summary: detailSummary(timingGroups, "Ainda faltam posts para comparar dias e horários."),
      interpretation: weekMetrics.length > 0
        ? `Você postou ${weekMetrics.length} ${weekMetrics.length === 1 ? "vez" : "vezes"} nesta semana. O ranking olha os últimos 90 dias.`
        : "Você não postou nesta semana. O ranking continua com os últimos 90 dias.",
      coverageLabel: `${metrics.length} posts nos últimos 90 dias`,
      groups: timingGroups.filter((group) => group.items.length > 0),
    },
    {
      id: "scene",
      title: "Cena, elenco e câmera",
      subtitle: "Onde gravar, com o quê, com quem, como se enquadrar e como falar.",
      summary: detailSummary(sceneGroups, "Seus vídeos ainda não foram analisados o bastante para comparar cena."),
      interpretation: sceneGroups.length > 0
        ? "Olhe o resultado e quantos posts tem atrás dele. Um acerto só vale um teste, não uma regra."
        : "Isto aparece assim que seus vídeos publicados forem analisados.",
      coverageLabel,
      groups: sceneGroups,
    },
    {
      id: "subjects",
      title: "Assuntos",
      subtitle: "Os temas que a sua audiência mais compartilha.",
      summary: detailSummary(subjectGroups, "Ainda faltam vídeos analisados para comparar assuntos."),
      interpretation: subjectGroups.length > 0
        ? "Repare no assunto exato, não na categoria: \u201cmaternidade sem idealização\u201d rende diferente de \u201cmaternidade\u201d."
        : "Os assuntos entram aqui depois que seus vídeos forem analisados.",
      coverageLabel,
      groups: subjectGroups,
    },
    {
      id: "openings",
      title: "Frases de abertura",
      subtitle: "Como você começa os vídeos que mais renderam.",
      summary: detailSummary(openingGroups, "Ainda faltam aberturas identificadas para comparar."),
      interpretation: openingGroups.length > 0
        ? "Não copie a frase: repita o jeito de começar que aparece nas melhores."
        : "As aberturas entram aqui quando a primeira frase for identificada.",
      coverageLabel,
      groups: openingGroups,
    },
  ];

  const observedSubjects = Array.from(
    new Set(sceneMetrics.flatMap((metric) => stringList(metric.sceneElements?.subjects))),
  ).slice(0, 12);
  const weeklySaved = weekMetrics.reduce((total, metric) => total + (metric.saved ?? 0), 0);
  const weeklyShares = weekMetrics.reduce((total, metric) => total + (metric.shares ?? 0), 0);
  const newestMetric = [...metrics].sort((a, b) => {
    const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bUpdated - aUpdated;
  })[0];

  return {
    schemaVersion: CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
    weekKey: params.week.weekKey,
    period: {
      startsAt: params.week.startsAt.toISOString(),
      endsAt: params.week.endsAt.toISOString(),
      rangeLabel: params.week.rangeLabel,
    },
    status: metrics.length > 0 && scenePercent >= 40 ? "ready" : "partial",
    generatedAt: generatedAt.toISOString(),
    sourceMetricsUpdatedAt: newestMetric?.updatedAt
      ? new Date(newestMetric.updatedAt).toISOString()
      : null,
    coverage: {
      posts90d: metrics.length,
      postsWeek: weekMetrics.length,
      postsWithScene: sceneMetrics.length,
      scenePercent,
    },
    overview: {
      summary: weekMetrics.length === 0
        ? "Você não postou nesta semana. O que já funcionou nos últimos 90 dias continua valendo para a próxima gravação."
        : weekMetrics.length === 1
          ? "Você postou uma vez nesta semana. Um post dá pista, não padrão — compare com o que já está firme aqui embaixo."
          : `Você postou ${weekMetrics.length} vezes nesta semana. Veja o que cada escolha rendeu contra o seu próprio normal.`,
      numbers: [
        { value: String(weekMetrics.length), label: weekMetrics.length === 1 ? "post" : "posts" },
        { value: formatCompactNumber(weeklySaved), label: "salvamentos" },
        { value: formatCompactNumber(weeklyShares), label: "compartilhamentos" },
      ],
      observedSubjects,
    },
    weeklyVideo: buildWeeklyVideo(weekMetrics, baseline),
    details,
  };
}
