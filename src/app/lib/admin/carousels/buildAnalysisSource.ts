import { getCategoryById, getCategoryByValue } from "@/app/lib/classification";
import { findUserPosts, toProxyUrl } from "@/app/lib/dataService/marketAnalysis/postsService";
import { chooseStoryArc } from "@/app/lib/admin/carousels/chooseStoryArc";
import { TimePeriod } from "@/app/lib/constants/timePeriods";
import type {
  CarouselCaseContentIdea,
  CarouselCaseCreatorRef,
  CarouselCaseDirectioningSummary,
  CarouselCaseDurationBucket,
  CarouselCaseDurationInsight,
  CarouselCaseFeaturedPost,
  CarouselCaseFormatBar,
  CarouselCaseGuardrail,
  CarouselCaseObjective,
  CarouselCasePlannerIdea,
  CarouselCasePlannerPlanSlot,
  CarouselCasePlannerSnapshot,
  CarouselCasePlanningSnapshot,
  CarouselCasePeriod,
  CarouselCaseSource,
  CarouselCaseSourceInsight,
  CarouselCaseStrategicAction,
  CarouselCaseTimeSlot,
} from "@/types/admin/carouselCase";
import { timePeriodToDays } from "@/utils/timePeriodHelpers";
import { aggregateUserTimePerformance } from "@/utils/aggregateUserTimePerformance";
import { getAverageEngagementByGroupings } from "@/utils/getAverageEngagementByGrouping";
import { getMetricMeta, LEAD_INTENT_PROXY_FIELD, resolvePerformanceMetricValue } from "@/utils/performanceMetricResolver";

const PERIOD_TO_TIME_PERIOD: Record<CarouselCasePeriod, TimePeriod> = {
  "7d": "last_7_days",
  "30d": "last_30_days",
  "90d": "last_90_days",
};

const PERIOD_LABELS: Record<CarouselCasePeriod, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

const OBJECTIVE_LABELS: Record<CarouselCaseObjective, string> = {
  engagement: "Engajamento",
  reach: "Alcance",
  leads: "Intenção de lead",
};

const OBJECTIVE_TO_METRIC_FIELD: Record<CarouselCaseObjective, string> = {
  engagement: "stats.total_interactions",
  reach: "stats.reach",
  leads: LEAD_INTENT_PROXY_FIELD,
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Dom",
  2: "Seg",
  3: "Ter",
  4: "Qua",
  5: "Qui",
  6: "Sex",
  7: "Sáb",
};

const PLANNER_WEEKDAY_LABELS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const DISABLE_VIDEO_PROXY = ["1", "true", "yes"].includes(
  String(process.env.DISABLE_VIDEO_PROXY || "").toLowerCase(),
);

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
  if (value) return [String(value)];
  return [];
}

function resolveCategoryLabel(value: string | undefined | null, type: "format" | "proposal" | "context") {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return getCategoryById(normalized, type)?.label || getCategoryByValue(normalized, type)?.label || normalized;
}

function firstLabel(value: unknown, type: "format" | "proposal" | "context") {
  const first = asArray(value)[0];
  return resolveCategoryLabel(first, type);
}

function normalizeThumb(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("/api/proxy/thumbnail/")) return url;
  if (/^https?:\/\//i.test(url)) return toProxyUrl(url);
  return url;
}

function normalizeVideoUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("/api/proxy/video/")) return url;
  if (/^https?:\/\//i.test(url)) {
    return DISABLE_VIDEO_PROXY ? url : `/api/proxy/video/${encodeURIComponent(url)}`;
  }
  return url;
}

function formatMetricValue(value: number, objective: CarouselCaseObjective) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (objective === "leads") return value.toFixed(value >= 100 ? 0 : 1);
  return COMPACT_NUMBER_FORMATTER.format(value);
}

function trimCaption(value?: string | null) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[#@][^\s]+/g, "")
    .trim();

  if (!normalized) return "Conteúdo em destaque";
  return normalized.length > 78 ? `${normalized.slice(0, 75).trim()}...` : normalized;
}

function normalizeLabel(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatHourLabel(dayOfWeek: number, hour: number) {
  return `${WEEKDAY_LABELS[dayOfWeek]} ${String(hour).padStart(2, "0")}h`;
}

function formatPlannerHourLabel(dayOfWeek: number, blockStartHour: number) {
  return `${PLANNER_WEEKDAY_LABELS[dayOfWeek] || "Seg"} ${String(blockStartHour).padStart(2, "0")}h`;
}

function cleanIdeaText(value?: string | null) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[•]+/g, " ")
    .trim();
}

function capitalizeSentence(value?: string | null) {
  const normalized = cleanIdeaText(value);
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function shortenNarrativeLabel(value?: string | null) {
  const normalized = cleanIdeaText(value);
  if (!normalized) return "";

  if (/bem-estar/i.test(normalized)) return "Bem-estar";
  if (/estilo de vida/i.test(normalized)) return "Lifestyle";

  const slashParts = normalized.split("/");
  if (slashParts.length > 1) return cleanIdeaText(slashParts[0]);

  const andParts = normalized.split(/\se\s/i).map((item) => cleanIdeaText(item)).filter(Boolean);
  if (andParts.length > 1) return andParts[andParts.length - 1] || normalized;

  return normalized.length > 18 ? normalized.split(" ").slice(0, 2).join(" ") : normalized;
}

function sentenceCase(value?: string | null) {
  const normalized = cleanIdeaText(value);
  if (!normalized) return "";
  const lowered = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  return lowered;
}

function isGenericIdeaTitle(value?: string | null) {
  const normalized = normalizeLabel(value);
  if (!normalized) return true;
  if (normalized.length <= 18) return true;
  if (/3 passos|passos praticos|passo a passo|tutorial|lista|dicas|segredos|como fazer|guia/.test(normalized)) return true;
  return /^(cena|eventos?|rotina|bastidor|humor|conteudo|reel|carrossel)\b/.test(normalized);
}

function joinIdeaParts(...values: Array<string | null | undefined>) {
  return values
    .map((value) => cleanIdeaText(value))
    .filter(Boolean)
    .join(" ");
}

function uniqueNormalized(values: string[]) {
  return values.filter((value, index) => values.findIndex((item) => normalizeLabel(item) === normalizeLabel(value)) === index);
}

function getPostDurationSeconds(post: any) {
  const raw = post?.stats?.video_duration_seconds ?? post?.video_duration_seconds;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getPostViewsValue(post: any) {
  const candidates = [
    post?.stats?.views,
    post?.stats?.video_views,
    post?.stats?.plays,
    post?.stats?.reach,
    post?.stats?.impressions,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function getDurationBucketLabelFromSeconds(seconds?: number | null) {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return null;
  if (seconds < 15) return "0-15s";
  if (seconds < 30) return "15-30s";
  if (seconds < 60) return "30-60s";
  return "60s+";
}

function toFeaturedPost(post: any, metricLabel: string, objective: CarouselCaseObjective): CarouselCaseFeaturedPost {
  const mediaType = String(post?.type || "").trim().toUpperCase() || null;
  const isVideo = mediaType === "VIDEO" || mediaType === "REEL";
  const durationSeconds = getPostDurationSeconds(post);
  const viewsValue = getPostViewsValue(post);

  return {
    id: String(post._id),
    title: trimCaption(post.caption || post.description),
    thumbnailUrl: post.thumbnailUrl,
    videoUrl: isVideo ? normalizeVideoUrl(post.mediaUrl || post.media_url || null) : null,
    mediaType,
    isVideo,
    durationSeconds,
    viewsValue,
    viewsValueLabel: viewsValue ? COMPACT_NUMBER_FORMATTER.format(viewsValue) : null,
    metricValue: post.metricValue,
    metricValueLabel: formatMetricValue(post.metricValue, objective),
    metricLabel,
    formatLabel: firstLabel(post.format, "format"),
    durationLabel: getDurationBucketLabelFromSeconds(durationSeconds),
    contextLabel: firstLabel(post.context, "context"),
    proposalLabel: firstLabel(post.proposal, "proposal"),
    postedAtLabel: post.postDate ? DATE_LABEL_FORMATTER.format(new Date(post.postDate)) : null,
  };
}

function pickPostsByCategory(args: {
  posts: any[];
  titles: string[];
  type: "format" | "context" | "proposal";
  limit?: number;
}) {
  const { posts, titles, type, limit = 2 } = args;
  const titleSet = new Set(titles.map((item) => normalizeLabel(item)).filter(Boolean));
  if (!titleSet.size) return [];

  return posts
    .filter((post) => {
      const labels = asArray(post[type]).map((value) => resolveCategoryLabel(value, type)).filter(Boolean);
      return labels.some((label) => titleSet.has(normalizeLabel(label)));
    })
    .slice(0, limit);
}

function pickExecutionEvidencePosts(args: {
  posts: any[];
  formatTitle?: string | null;
  durationLabel?: string | null;
  limit?: number;
}) {
  const { posts, formatTitle, durationLabel, limit = 2 } = args;
  const normalizedFormat = normalizeLabel(formatTitle);
  const normalizedDuration = normalizeLabel(durationLabel);
  const matchesFormat = (post: any) => {
    if (!normalizedFormat) return false;
    const labels = asArray(post?.format).map((value) => resolveCategoryLabel(value, "format")).filter(Boolean);
    return labels.some((label) => normalizeLabel(label) === normalizedFormat);
  };
  const matchesDuration = (post: any) => {
    if (!normalizedDuration) return false;
    return normalizeLabel(getDurationBucketLabelFromSeconds(getPostDurationSeconds(post))) === normalizedDuration;
  };

  const pools = [
    normalizedFormat && normalizedDuration ? posts.filter((post) => matchesFormat(post) && matchesDuration(post)) : [],
    normalizedFormat ? posts.filter((post) => matchesFormat(post)) : [],
    normalizedDuration ? posts.filter((post) => matchesDuration(post)) : [],
    posts,
  ];

  const seenIds = new Set<string>();
  const picked: any[] = [];

  for (const pool of pools) {
    for (const post of pool) {
      const postId = String(post?._id || "");
      if (!postId || seenIds.has(postId)) continue;
      seenIds.add(postId);
      picked.push(post);
      if (picked.length >= limit) return picked;
    }
  }

  return picked;
}

function countPostsAboveAverageByCategory(args: {
  posts: any[];
  title: string;
  type: "format" | "context" | "proposal";
  threshold: number;
}) {
  if (!Number.isFinite(args.threshold) || args.threshold <= 0) return null;

  const matches = pickPostsByCategory({
    posts: args.posts,
    titles: [args.title],
    type: args.type,
    limit: Number.MAX_SAFE_INTEGER,
  });

  if (!matches.length) return 0;
  return matches.filter((post) => Number(post?.metricValue || 0) > args.threshold).length;
}

function pickNarrativeEvidencePosts(args: {
  topNarratives: CarouselCaseSourceInsight[];
  topPosts: any[];
}) {
  const usedIds = new Set<string>();

  return args.topNarratives
    .slice(0, 2)
    .map((item) => {
      const kind = item.kind;
      const matches =
        kind === "context" || kind === "proposal" || kind === "format"
          ? pickPostsByCategory({
              posts: args.topPosts,
              titles: [item.title],
              type: kind,
              limit: 4,
            })
          : [];

      const selected =
        matches.find((post) => !usedIds.has(String(post?._id))) ||
        args.topPosts.find((post) => !usedIds.has(String(post?._id))) ||
        null;

      if (!selected?._id) return null;
      usedIds.add(String(selected._id));
      return selected;
    })
    .filter(Boolean);
}

function pickPostsByTiming(args: {
  posts: any[];
  slots: Array<{ dayOfWeek: number; hour: number }>;
  limit?: number;
}) {
  const { posts, slots, limit = 2 } = args;
  const slotKeys = new Set(slots.map((slot) => `${slot.dayOfWeek}-${slot.hour}`));
  if (!slotKeys.size) return [];

  return posts
    .filter((post) => {
      const date = post?.postDate ? new Date(post.postDate) : null;
      if (!date || Number.isNaN(date.getTime())) return false;
      const weekday = date.getDay() + 1;
      const hour = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "numeric",
        hourCycle: "h23",
      }).formatToParts(date).find((part) => part.type === "hour")?.value;
      const normalizedHour = Number(hour);
      if (!Number.isFinite(normalizedHour)) return false;
      return slotKeys.has(`${weekday}-${normalizedHour}`);
    })
    .slice(0, limit);
}

function buildNarrativeInsights(args: {
  topContexts: Array<{ name: string; value: number; postsCount: number }>;
  topProposals: Array<{ name: string; value: number; postsCount: number }>;
  posts: Array<any>;
  topPosts: Array<any>;
  objective: CarouselCaseObjective;
  metricShortLabel: string;
  overallAverage: number;
}): CarouselCaseSourceInsight[] {
  const { topContexts, topProposals, posts, topPosts, objective, metricShortLabel, overallAverage } = args;
  const insights: CarouselCaseSourceInsight[] = [];
  const resolveLift = (value: number, postsCount: number, minPosts: number) => {
    if (!Number.isFinite(value) || !Number.isFinite(overallAverage) || overallAverage <= 0 || postsCount < minPosts) {
      return null;
    }

    return Number((((value - overallAverage) / overallAverage) * 100).toFixed(1));
  };

  if (topContexts[0]) {
    const postsCount = topContexts[0].postsCount;
    const aboveAverageCount = countPostsAboveAverageByCategory({
      posts,
      title: topContexts[0].name,
      type: "context",
      threshold: overallAverage,
    });
    insights.push({
      title: topContexts[0].name,
      reason: `No recorte atual, essa narrativa aparece com força consistente e média de ${formatMetricValue(topContexts[0].value, objective)} em ${metricShortLabel.toLowerCase()}.`,
      evidence: `${postsCount} posts sustentam esse sinal.`,
      confidence: postsCount >= 6 ? "high" : postsCount >= 3 ? "medium" : "low",
      kind: "context",
      postsCount,
      avgMetricValue: topContexts[0].value,
      avgMetricValueLabel: formatMetricValue(topContexts[0].value, objective),
      liftVsProfileAverage: resolveLift(topContexts[0].value, postsCount, 4),
      aboveAverageCount,
    });
  }

  if (topProposals[0]) {
    const postsCount = topProposals[0].postsCount;
    const aboveAverageCount = countPostsAboveAverageByCategory({
      posts,
      title: topProposals[0].name,
      type: "proposal",
      threshold: overallAverage,
    });
    insights.push({
      title: topProposals[0].name,
      reason: `Quando ${topProposals[0].name.toLowerCase()} entra na construção, o conteúdo tende a responder melhor dentro do objetivo escolhido.`,
      evidence: `${postsCount} posts analisados nessa linha.`,
      confidence: postsCount >= 5 ? "high" : postsCount >= 3 ? "medium" : "low",
      kind: "proposal",
      postsCount,
      avgMetricValue: topProposals[0].value,
      avgMetricValueLabel: formatMetricValue(topProposals[0].value, objective),
      liftVsProfileAverage: resolveLift(topProposals[0].value, postsCount, 4),
      aboveAverageCount,
    });
  }

  if (topPosts[0]) {
    const topMetricValue = Number(topPosts[0].metricValue || 0);
    insights.push({
      title: firstLabel(topPosts[0].format, "format") || "Formato líder",
      reason: `O post de melhor desempenho reforça que a execução e a embalagem visual também puxam o resultado, não só o tema.`,
      evidence: trimCaption(topPosts[0].caption || topPosts[0].description),
      confidence: "low",
      kind: "format",
      postsCount: 1,
      avgMetricValue: topMetricValue,
      avgMetricValueLabel: formatMetricValue(topMetricValue, objective),
      liftVsProfileAverage: null,
      aboveAverageCount: topMetricValue > overallAverage ? 1 : 0,
    });
  }

  return insights.slice(0, 3);
}

function resolveTimeSlotsFromSnapshot(
  timeData?: CarouselCasePlanningSnapshot["timeData"] | null,
): CarouselCaseTimeSlot[] {
  const bestSlots = Array.isArray(timeData?.bestSlots) ? timeData?.bestSlots || [] : [];
  const buckets = Array.isArray(timeData?.buckets) ? timeData?.buckets || [] : [];
  const source = bestSlots.length ? bestSlots : buckets;

  return source
    .map((slot) => ({
      dayOfWeek: Number(slot?.dayOfWeek || 0),
      hour: Number(slot?.hour || 0),
      average: Number(slot?.average || 0),
      count: Number(slot?.count || 0),
    }))
    .filter((slot) => slot.dayOfWeek > 0 && Number.isFinite(slot.hour))
    .sort((a, b) => b.average - a.average);
}

function resolveDurationInsight(args: {
  durationData?: CarouselCasePlanningSnapshot["durationData"] | null;
}): CarouselCaseDurationInsight | null {
  const buckets = Array.isArray(args.durationData?.buckets)
    ? (args.durationData?.buckets as CarouselCaseDurationBucket[])
    : [];

  const withData = buckets
    .map((bucket) => ({
      label: String(bucket?.label || "").trim(),
      postsCount: Number(bucket?.postsCount || 0),
      averageInteractions: Number(bucket?.averageInteractions || 0),
    }))
    .filter((bucket) => bucket.label && bucket.postsCount > 0);

  if (!withData.length) return null;

  const overallAverage =
    withData.reduce((sum, bucket) => sum + bucket.averageInteractions, 0) / withData.length || 0;
  const ranked = withData
    .map((bucket) => ({
      ...bucket,
      smoothedAverage: (bucket.averageInteractions * bucket.postsCount + overallAverage * 3) / (bucket.postsCount + 3),
    }))
    .sort((a, b) => b.smoothedAverage - a.smoothedAverage);

  const best = ranked[0];
  if (!best) return null;

  return {
    label: best.label,
    reason: `${best.postsCount} vídeos nessa faixa com média de ${formatMetricValue(best.averageInteractions, "engagement")} em engajamento.`,
    postsCount: best.postsCount,
    averageMetricValue: best.averageInteractions,
    averageMetricValueLabel: formatMetricValue(best.averageInteractions, "engagement"),
    metricLabel: "engajamento",
  };
}

function resolveTopFormatsFromSnapshot(
  formatData?: CarouselCasePlanningSnapshot["formatData"] | null,
): Array<CarouselCaseFormatBar> {
  const chartData = Array.isArray(formatData?.chartData) ? (formatData?.chartData as CarouselCaseFormatBar[]) : [];
  return chartData
    .map((item) => ({
      name: String(item?.name || "").trim(),
      value: Number(item?.value || 0),
      postsCount: typeof item?.postsCount === "number" ? item.postsCount : undefined,
    }))
    .filter((item) => item.name)
    .sort((a, b) => b.value - a.value);
}

function resolveRelativeLeadPct(winner?: number | null, runnerUp?: number | null) {
  if (
    typeof winner !== "number" ||
    typeof runnerUp !== "number" ||
    !Number.isFinite(winner) ||
    !Number.isFinite(runnerUp) ||
    runnerUp <= 0
  ) {
    return null;
  }

  return ((winner - runnerUp) / runnerUp) * 100;
}

function resolvePlannerFormatLabel(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const resolved = resolveCategoryLabel(normalized, "format");
  if (resolved) return resolved;
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstSentence(value?: string | null) {
  const normalized = cleanIdeaText(value);
  if (!normalized) return "";
  const match = normalized.match(/^[^.?!]+[.?!]?/);
  return (match?.[0] || normalized).trim();
}

function buildIdeaTitle(args: {
  slot: CarouselCasePlannerIdea;
  primaryNarrative?: string | null;
  secondaryNarrative?: string | null;
  usedTitles?: string[];
}) {
  const { slot, primaryNarrative, secondaryNarrative, usedTitles = [] } = args;
  const theme = Array.isArray(slot.themes) ? slot.themes.find(Boolean) : null;
  const proposalLabel = resolveCategoryLabel(slot.categories?.proposal?.[0], "proposal");
  const contextLabel = resolveCategoryLabel(slot.categories?.context?.[0], "context");
  const narrativeLabel = shortenNarrativeLabel(primaryNarrative);
  const supportNarrativeLabel = shortenNarrativeLabel(secondaryNarrative);
  const rationaleCandidate = capitalizeSentence(Array.isArray(slot.rationale) ? slot.rationale[0] : slot.rationale);
  const themeCandidate = capitalizeSentence(theme || slot.themeKeyword || slot.title || slot.scriptShort);
  const explicitCandidates = uniqueNormalized(
    [themeCandidate, rationaleCandidate, capitalizeSentence(slot.scriptShort), capitalizeSentence(slot.title)].filter(Boolean) as string[],
  );

  const pickedExplicit = explicitCandidates.find(
    (candidate) =>
      !isGenericIdeaTitle(candidate) &&
      !usedTitles.some((item) => normalizeLabel(item) === normalizeLabel(candidate)),
  );

  if (pickedExplicit) return pickedExplicit;

  const synthesizedCandidates = uniqueNormalized(
    [
      proposalLabel && narrativeLabel
        ? capitalizeSentence(joinIdeaParts(proposalLabel, "com", sentenceCase(narrativeLabel)))
        : "",
      contextLabel && narrativeLabel
        ? capitalizeSentence(joinIdeaParts(contextLabel, "com", sentenceCase(narrativeLabel)))
        : "",
      themeCandidate && narrativeLabel
        ? capitalizeSentence(joinIdeaParts(themeCandidate, "com", sentenceCase(narrativeLabel)))
        : "",
      themeCandidate && supportNarrativeLabel
        ? capitalizeSentence(joinIdeaParts(themeCandidate, "com", sentenceCase(supportNarrativeLabel)))
        : "",
      contextLabel && proposalLabel
        ? capitalizeSentence(joinIdeaParts(contextLabel, "em", proposalLabel.toLowerCase()))
        : "",
      proposalLabel ? capitalizeSentence(proposalLabel) : "",
      contextLabel ? capitalizeSentence(contextLabel) : "",
    ].filter(Boolean) as string[],
  );

  const pickedSynthesized = synthesizedCandidates.find(
    (candidate) => !usedTitles.some((item) => normalizeLabel(item) === normalizeLabel(candidate)),
  );

  if (pickedSynthesized) return pickedSynthesized;

  const formatLabel = resolvePlannerFormatLabel(slot.format);

  if (themeCandidate) return themeCandidate;
  if (contextLabel && proposalLabel) return `${contextLabel} + ${proposalLabel}`;
  if (contextLabel) return contextLabel;
  if (proposalLabel) return proposalLabel;
  if (formatLabel) return `${formatLabel} com tese clara`;
  return "Pauta recomendada";
}

function buildContentIdeas(args: {
  plannerSnapshot?: CarouselCasePlannerSnapshot | null;
  plannerPlanSlots?: CarouselCasePlannerPlanSlot[];
  topNarratives: CarouselCaseSourceInsight[];
  topFormats: Array<{ label: string }>;
  winningWindows: Array<{ label: string }>;
  topDuration?: CarouselCaseDurationInsight | null;
}): CarouselCaseContentIdea[] {
  const savedPlanSlots = Array.isArray(args.plannerPlanSlots) ? args.plannerPlanSlots : [];
  const plannerRecommendations = Array.isArray(args.plannerSnapshot?.recommendations)
    ? (args.plannerSnapshot?.recommendations as CarouselCasePlannerIdea[])
    : [];

  const topFormatLabel = args.topFormats[0]?.label || null;
  const primaryNarrative = args.topNarratives[0]?.title || null;
  const secondaryNarrative = args.topNarratives[1]?.title || null;
  const winningTimingSet = new Set(args.winningWindows.map((item) => normalizeLabel(item.label)));

  const savedIdeas = savedPlanSlots
    .map((slot) => {
      const titleCandidate = capitalizeSentence(slot.title || firstSentence(slot.scriptShort) || slot.themeKeyword);
      if (!titleCandidate) return null;

      const timingLabel = formatPlannerHourLabel(slot.dayOfWeek, slot.blockStartHour);
      const formatLabel = resolvePlannerFormatLabel(slot.format);
      const contextLabel = resolveCategoryLabel(slot.categories?.context?.[0], "context");
      const proposalLabel = resolveCategoryLabel(slot.categories?.proposal?.[0], "proposal");
      const note = [contextLabel, proposalLabel].filter(Boolean).join(" • ") || primaryNarrative || null;

      let score = 0;
      if (winningTimingSet.has(normalizeLabel(timingLabel))) score += 4;
      if (topFormatLabel && normalizeLabel(formatLabel) === normalizeLabel(topFormatLabel)) score += 2;
      if (primaryNarrative && normalizeLabel(`${contextLabel || ""} ${proposalLabel || ""}`).includes(normalizeLabel(shortenNarrativeLabel(primaryNarrative)))) score += 2;
      if (secondaryNarrative && normalizeLabel(`${contextLabel || ""} ${proposalLabel || ""}`).includes(normalizeLabel(shortenNarrativeLabel(secondaryNarrative)))) score += 1;
      if (slot.scriptShort) score += 1;
      if (slot.title) score += 1;

      return {
        title: titleCandidate,
        timingLabel,
        formatLabel,
        note,
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.score || 0) - (a?.score || 0)) as Array<CarouselCaseContentIdea & { score: number }>;

  const dedupedSavedIdeas = savedIdeas.filter(
    (idea, index, array) =>
      array.findIndex((item) => normalizeLabel(item.title) === normalizeLabel(idea.title)) === index,
  );

  if (dedupedSavedIdeas.length) {
    return dedupedSavedIdeas.slice(0, 3).map(({ score: _score, ...idea }) => idea);
  }

  const usedTitles: string[] = [];
  const plannerIdeas = plannerRecommendations
    .map((slot, index) => {
      const mappedPrimaryNarrative = args.topNarratives[index]?.title || args.topNarratives[0]?.title || null;
      const mappedSecondaryNarrative = args.topNarratives.find((item) => normalizeLabel(item.title) !== normalizeLabel(mappedPrimaryNarrative))?.title || null;
      const title = buildIdeaTitle({ slot, primaryNarrative: mappedPrimaryNarrative, secondaryNarrative: mappedSecondaryNarrative, usedTitles });
      const timingLabel = formatPlannerHourLabel(slot.dayOfWeek, slot.blockStartHour);
      const formatLabel = resolvePlannerFormatLabel(slot.format);
      const note = mappedPrimaryNarrative || mappedSecondaryNarrative || args.topDuration?.label || null;

      usedTitles.push(title);

      return {
        title,
        timingLabel,
        formatLabel,
        note,
      };
    })
    .filter((idea) => idea.title && idea.timingLabel);

  const dedupedPlannerIdeas = plannerIdeas.filter(
    (idea, index, array) =>
      array.findIndex(
        (item) => normalizeLabel(item.title) === normalizeLabel(idea.title),
      ) === index,
  );

  if (dedupedPlannerIdeas.length) {
    return dedupedPlannerIdeas.slice(0, 3);
  }

  return args.topNarratives.slice(0, 3).map((item, index) => ({
    title: item.title,
    timingLabel: args.winningWindows[index]?.label || args.winningWindows[0]?.label || "Qui 10h",
    formatLabel: args.topFormats[0]?.label || null,
    note: args.topDuration?.label || null,
  }));
}

function normalizeStrategicAction(action: CarouselCaseStrategicAction | null | undefined): CarouselCaseStrategicAction | null {
  if (!action?.id || !action?.title || !action?.action) return null;

  return {
    id: String(action.id),
    title: String(action.title),
    action: String(action.action),
    strategicSynopsis: action.strategicSynopsis || null,
    recommendationType: action.recommendationType || null,
    observation: action.observation || null,
    meaning: action.meaning || null,
    nextStep: action.nextStep || null,
    whatNotToDo: action.whatNotToDo || null,
    metricLabel: action.metricLabel || null,
    timeWindowLabel: action.timeWindowLabel || null,
    isProxyMetric: Boolean(action.isProxyMetric),
    impactEstimate: action.impactEstimate || null,
    confidence: action.confidence || "medium",
    evidence: Array.isArray(action.evidence) ? action.evidence.filter(Boolean).slice(0, 4) : [],
    sampleSize: typeof action.sampleSize === "number" ? action.sampleSize : null,
    expectedLiftRatio: typeof action.expectedLiftRatio === "number" ? action.expectedLiftRatio : null,
    opportunityScore: typeof action.opportunityScore === "number" ? action.opportunityScore : null,
    rankingScore: typeof action.rankingScore === "number" ? action.rankingScore : null,
    signalQuality: action.signalQuality || null,
    guardrailReason: action.guardrailReason || null,
    experimentPlan: action.experimentPlan || null,
    feedbackStatus: action.feedbackStatus || null,
    queueStage: action.queueStage || null,
    executionState: action.executionState || null,
    feedbackUpdatedAt: action.feedbackUpdatedAt || null,
  };
}

function pickTopStrategicAction(actions: CarouselCaseStrategicAction[]): CarouselCaseStrategicAction | null {
  return (
    actions.find((action) => action.executionState === "planned" && action.queueStage === "now") ||
    actions.find((action) => action.executionState === "planned") ||
    actions[0] ||
    null
  );
}

function buildDirectioning(args: {
  planningSnapshot?: CarouselCasePlanningSnapshot | null;
  metricMeta: ReturnType<typeof getMetricMeta>;
}): CarouselCaseDirectioningSummary | null {
  const snapshot = args.planningSnapshot?.directioningSummary;
  if (!snapshot) return null;

  return {
    headline: snapshot.headline || null,
    priorityLabel: snapshot.priorityLabel || null,
    priorityState: snapshot.priorityState || null,
    primarySignalText: snapshot.primarySignal?.text || null,
    comparisonNarrative: snapshot.comparison?.narrative || null,
    confidenceLabel: snapshot.confidence?.label || null,
    confidenceDescription: snapshot.confidence?.description || null,
    compositeConfidence: snapshot.compositeConfidence
      ? {
          level: snapshot.compositeConfidence.level || null,
          label: snapshot.compositeConfidence.label || null,
          score:
            typeof snapshot.compositeConfidence.score === "number"
              ? snapshot.compositeConfidence.score
              : null,
          summary: snapshot.compositeConfidence.summary || null,
        }
      : null,
    experimentFocus:
      snapshot.experimentFocus?.successSignal || snapshot.experimentFocus?.sampleGoal
        ? {
            successSignal: String(snapshot.experimentFocus?.successSignal || ""),
            sampleGoal: String(snapshot.experimentFocus?.sampleGoal || ""),
          }
        : null,
    baseDescription: snapshot.baseDescription || null,
    proxyDisclosure:
      snapshot.proxyDisclosure ||
      (args.metricMeta.isProxy && args.metricMeta.description
        ? `Objetivo baseado em proxy: ${args.metricMeta.description}`
        : null),
    noGoLine: snapshot.noGoLine || null,
    cards: Array.isArray(snapshot.cards)
      ? snapshot.cards
          .filter((card) => card?.title && card?.body)
          .slice(0, 3)
          .map((card) => ({ title: String(card.title), body: String(card.body) }))
      : [],
  };
}

function buildGuardrails(args: {
  postsAnalyzed: number;
  metricMeta: ReturnType<typeof getMetricMeta>;
  strategicAction: CarouselCaseStrategicAction | null;
}): CarouselCaseGuardrail[] {
  const items: CarouselCaseGuardrail[] = [];

  if (args.postsAnalyzed < 6 || args.strategicAction?.guardrailReason) {
    items.push({
      type: "low_sample",
      message:
        args.strategicAction?.guardrailReason ||
        `Base curta: ${args.postsAnalyzed} posts ainda pedem leitura mais prudente.`,
    });
  }

  if (args.metricMeta.isProxy && args.metricMeta.description) {
    items.push({
      type: "proxy_metric",
      message: `A métrica principal usa proxy: ${args.metricMeta.description}`,
    });
  }

  items.push({
    type: "causality",
    message: "Os sinais mostram padrão e oportunidade de teste, não garantia causal de resultado.",
  });

  return items;
}

export async function buildAnalysisSource(args: {
  creator: CarouselCaseCreatorRef;
  period: CarouselCasePeriod;
  objective: CarouselCaseObjective;
  planningSnapshot?: CarouselCasePlanningSnapshot | null;
  plannerSnapshot?: CarouselCasePlannerSnapshot | null;
  plannerPlanSlots?: CarouselCasePlannerPlanSlot[];
}): Promise<CarouselCaseSource | null> {
  const { creator, period, objective, planningSnapshot, plannerSnapshot, plannerPlanSlots } = args;
  const timePeriod = PERIOD_TO_TIME_PERIOD[period];
  const periodLabel = PERIOD_LABELS[period];
  const objectiveLabel = OBJECTIVE_LABELS[objective];
  const metricField = OBJECTIVE_TO_METRIC_FIELD[objective];
  const metricMeta = getMetricMeta(metricField);
  const days = timePeriodToDays(timePeriod);

  const [postsResult, grouped, timePerformanceFallback] = await Promise.all([
    findUserPosts({
      userId: creator.id,
      timePeriod,
      sortBy: "postDate",
      sortOrder: "desc",
      page: 1,
      limit: 80,
      filters: {},
    }),
    getAverageEngagementByGroupings(
      creator.id,
      timePeriod,
      metricField,
      ["context", "proposal", "format"],
      undefined,
      { creditMode: "fractional" },
    ),
    aggregateUserTimePerformance(creator.id, days, metricField),
  ]);

  const posts = (postsResult.posts || [])
    .map((post: any) => ({
      ...post,
      metricValue: resolvePerformanceMetricValue(post, metricField) ?? 0,
      thumbnailUrl: normalizeThumb(post.coverUrl || post.mediaUrl || post.thumbnailUrl || null),
    }))
    .filter((post: any) => Number.isFinite(post.metricValue));

  if (!posts.length) return null;

  const topPosts = posts
    .filter((post: any) => post.metricValue > 0)
    .sort((a: any, b: any) => b.metricValue - a.metricValue)
    .slice(0, 6);
  const overallMetricAverage =
    posts.reduce((sum: number, post: any) => sum + Number(post.metricValue || 0), 0) / Math.max(posts.length, 1);

  const topFormatsFromSnapshot = resolveTopFormatsFromSnapshot(planningSnapshot?.formatData);
  const formatBars = (topFormatsFromSnapshot.length ? topFormatsFromSnapshot : grouped.format || []) as Array<{
    name: string;
    value: number;
    postsCount?: number;
  }>;
  const topFormats = formatBars.slice(0, 3);
  const topContexts = (grouped.context || []).slice(0, 3);
  const topProposals = (grouped.proposal || []).slice(0, 3);
  const timeSlotsFromSnapshot = resolveTimeSlotsFromSnapshot(planningSnapshot?.timeData);
  const timePerformance = {
    buckets: timeSlotsFromSnapshot.length ? timeSlotsFromSnapshot : timePerformanceFallback.buckets,
    bestSlots: timeSlotsFromSnapshot.length ? timeSlotsFromSnapshot.slice(0, 3) : timePerformanceFallback.bestSlots,
    worstSlots: timeSlotsFromSnapshot.length ? timeSlotsFromSnapshot.slice(-3).reverse() : timePerformanceFallback.worstSlots,
  };
  const rawActions = [
    ...(Array.isArray(planningSnapshot?.topActions) ? planningSnapshot.topActions : []),
    ...(Array.isArray(planningSnapshot?.recommendations?.actions)
      ? planningSnapshot?.recommendations?.actions || []
      : []),
  ];
  const strategicActions = rawActions
    .map((action) => normalizeStrategicAction(action))
    .filter(Boolean) as CarouselCaseStrategicAction[];
  const strategicAction = pickTopStrategicAction(strategicActions);
  const directioning = buildDirectioning({ planningSnapshot, metricMeta });
  const topDuration = resolveDurationInsight({
    durationData: planningSnapshot?.durationData,
  });
  const durationBuckets = Array.isArray(planningSnapshot?.durationData?.buckets)
    ? (planningSnapshot?.durationData?.buckets as CarouselCaseDurationBucket[])
        .map((bucket) => ({
          key: String(bucket?.key || "").trim(),
          label: String(bucket?.label || "").trim(),
          postsCount: Number(bucket?.postsCount || 0),
          averageInteractions: Number(bucket?.averageInteractions || 0),
        }))
        .filter((bucket) => bucket.label)
    : [];
  const rankedDurationBuckets = durationBuckets
    .filter((bucket) => bucket.postsCount > 0)
    .slice()
    .sort((a, b) => (b.averageInteractions === a.averageInteractions ? b.postsCount - a.postsCount : b.averageInteractions - a.averageInteractions));
  const topDurationByAverageBucket = rankedDurationBuckets[0] || null;
  const runnerUpDurationBucket = rankedDurationBuckets[1] || null;
  const topDurationUsageBucket = durationBuckets
    .filter((bucket) => bucket.postsCount > 0)
    .slice()
    .sort((a, b) => (b.postsCount === a.postsCount ? b.averageInteractions - a.averageInteractions : b.postsCount - a.postsCount))[0] || null;
  const totalDurationBucketPosts = durationBuckets.reduce((sum, bucket) => sum + Math.max(0, bucket.postsCount || 0), 0);
  const durationCoverageRate =
    typeof planningSnapshot?.durationData?.durationCoverageRate === "number"
      ? planningSnapshot.durationData.durationCoverageRate
      : typeof planningSnapshot?.durationData?.totalVideoPosts === "number" &&
          planningSnapshot.durationData.totalVideoPosts > 0 &&
          typeof planningSnapshot?.durationData?.totalPostsWithDuration === "number"
        ? planningSnapshot.durationData.totalPostsWithDuration / planningSnapshot.durationData.totalVideoPosts
        : null;
  const lowSampleDurationBuckets = durationBuckets.filter((bucket) => bucket.postsCount > 0 && bucket.postsCount < 5).length;
  const topFormatByAverage = formatBars[0] || null;
  const runnerUpFormat = formatBars[1] || null;
  const topFormatByPosts = formatBars
    .filter((item) => typeof item.postsCount === "number" && item.postsCount > 0)
    .slice()
    .sort((a, b) => ((b.postsCount || 0) === (a.postsCount || 0) ? b.value - a.value : (b.postsCount || 0) - (a.postsCount || 0)))[0] || null;
  const totalFormatPosts = formatBars.reduce((sum, item) => sum + Math.max(0, Number(item.postsCount || 0)), 0);
  const timingBenchmark = planningSnapshot?.timingBenchmark || null;

  const strongestFormat = topFormats[0]?.name || firstLabel(topPosts[0]?.format, "format") || "formato líder";
  const strongestNarrative = topContexts[0]?.name || topProposals[0]?.name || "uma linha editorial clara";
  const strongestWindow = timePerformance.bestSlots[0]
    ? `${WEEKDAY_LABELS[timePerformance.bestSlots[0].dayOfWeek]} ${String(timePerformance.bestSlots[0].hour).padStart(2, "0")}h`
    : null;

  const featuredPosts = topPosts.slice(0, 3).map((post: any) => ({
    ...toFeaturedPost(post, metricMeta.shortLabel, objective),
  }));

  const topNarratives = buildNarrativeInsights({
    topContexts,
    topProposals,
    posts,
    topPosts,
    objective,
    metricShortLabel: metricMeta.shortLabel,
    overallAverage: overallMetricAverage,
  });

  const winningWindows = timePerformance.bestSlots.slice(0, 3).map((slot) => ({
    label: `${WEEKDAY_LABELS[slot.dayOfWeek]} ${String(slot.hour).padStart(2, "0")}h`,
    reason: `${slot.count} posts nessa faixa com média de ${formatMetricValue(slot.average, objective)} em ${metricMeta.shortLabel.toLowerCase()}.`,
  }));

  const analysisMeta = {
    postsAnalyzed: posts.length,
    metricLabel: metricMeta.label,
    metricShortLabel: metricMeta.shortLabel,
  };
  const guardrails = buildGuardrails({
    postsAnalyzed: posts.length,
    metricMeta,
    strategicAction,
  });

  const narrativePostMatches = pickNarrativeEvidencePosts({
    topNarratives,
    topPosts,
  });

  const formatPostMatches = pickExecutionEvidencePosts({
    posts: topPosts,
    formatTitle: topFormatByAverage?.name || topFormats[0]?.name || null,
    durationLabel: topDurationByAverageBucket?.label || topDuration?.label || null,
    limit: 2,
  });

  const timingPostMatches = pickPostsByTiming({
    posts: topPosts,
    slots: timePerformance.bestSlots.slice(0, 3),
    limit: 2,
  });

  const timingChart = timePerformance.bestSlots.slice(0, 4).map((slot) => ({
    label: formatHourLabel(slot.dayOfWeek, slot.hour),
    value: slot.average,
    helper: `${slot.count} posts`,
  }));
  const contentIdeas = buildContentIdeas({
    plannerSnapshot,
    plannerPlanSlots,
    topNarratives,
    topFormats: topFormats.map((item) => ({ label: item.name })),
    winningWindows,
    topDuration,
  });
  const benchmarkDurationByPostsLabel =
    durationBuckets.find((bucket) => bucket.key === String(timingBenchmark?.duration?.topBucketByPostsKey || ""))?.label || null;
  const benchmarkDurationByAverageLabel =
    durationBuckets.find((bucket) => bucket.key === String(timingBenchmark?.duration?.topBucketByAverageKey || ""))?.label || null;
  const executionSummary = {
    comboLabel:
      topFormatByAverage?.name && (topDurationByAverageBucket?.label || topDuration?.label)
        ? `${topFormatByAverage.name} + ${topDurationByAverageBucket?.label || topDuration?.label}`
        : topFormatByAverage?.name || topDurationByAverageBucket?.label || topDuration?.label || "Padrão de execução",
    formatLeaderLabel: topFormatByAverage?.name || null,
    formatUsageLeaderLabel: topFormatByPosts?.name || null,
    formatLeadVsRunnerUpPct: resolveRelativeLeadPct(topFormatByAverage?.value, runnerUpFormat?.value),
    formatUsageSharePct:
      topFormatByAverage && totalFormatPosts > 0 && typeof topFormatByAverage.postsCount === "number"
        ? (topFormatByAverage.postsCount / totalFormatPosts) * 100
        : null,
    durationLeaderLabel: topDurationByAverageBucket?.label || topDuration?.label || null,
    durationUsageLeaderLabel: topDurationUsageBucket?.label || null,
    durationLeadVsRunnerUpPct: resolveRelativeLeadPct(
      topDurationByAverageBucket?.averageInteractions,
      runnerUpDurationBucket?.averageInteractions,
    ),
    durationUsageSharePct:
      topDurationByAverageBucket && totalDurationBucketPosts > 0
        ? (topDurationByAverageBucket.postsCount / totalDurationBucketPosts) * 100
        : null,
    durationCoverageRate,
    lowSampleDurationBuckets,
    benchmark: timingBenchmark?.cohort?.canShow
      ? {
          canShow: true,
          label: timingBenchmark.cohort.label || null,
          creatorCount:
            typeof timingBenchmark.cohort.creatorCount === "number" ? timingBenchmark.cohort.creatorCount : null,
          confidence: timingBenchmark.cohort.confidence || null,
          formatLeaderByPosts: timingBenchmark.format?.topFormatByPosts || null,
          formatLeaderByAverage: timingBenchmark.format?.topFormatByAverage || null,
          durationLeaderByPosts: benchmarkDurationByPostsLabel,
          durationLeaderByAverage: benchmarkDurationByAverageLabel,
        }
      : null,
  } satisfies CarouselCaseSource["executionSummary"];

  const source: CarouselCaseSource = {
    mode: "analysis",
    creator,
    analysisMeta,
    period: {
      value: period,
      label: periodLabel,
    },
    objective: {
      value: objective,
      label: objectiveLabel,
    },
    insightSummary: {
      strongestPattern:
        directioning?.headline ||
        directioning?.primarySignalText ||
        `${creator.name} ganha mais força quando ${strongestNarrative.toLowerCase()} aparece em ${strongestFormat.toLowerCase()}.${strongestWindow ? ` O melhor timing aparece em ${strongestWindow}.` : ""}`,
      strongestPatternReason:
        directioning?.comparisonNarrative ||
        `${posts.length} posts reais sustentam essa leitura em ${metricMeta.shortLabel.toLowerCase()}.`,
    },
    topNarratives,
    topFormats: topFormats.map((item) => ({
      label: item.name,
      whyItWorks: `Média de ${formatMetricValue(item.value, objective)} em ${metricMeta.shortLabel.toLowerCase()} no período.`,
      evidence:
        typeof item.postsCount === "number"
          ? `${item.postsCount} posts contribuíram para esse sinal.`
          : `Melhor média recente em ${metricMeta.shortLabel.toLowerCase()}.`,
      postsCount: typeof item.postsCount === "number" ? item.postsCount : null,
      avgMetricValue: item.value,
      avgMetricValueLabel: formatMetricValue(item.value, objective),
      metricLabel: metricMeta.shortLabel,
    })),
    winningWindows,
    recommendations: strategicAction
      ? [
          strategicAction.nextStep || strategicAction.action,
          strategicAction.meaning || strategicAction.strategicSynopsis || "",
          strategicAction.whatNotToDo || directioning?.noGoLine || "",
        ].filter(Boolean)
      : [
          `Repetir a tese central de ${strongestNarrative.toLowerCase()} com novas aberturas e mesma promessa principal.`,
          `Usar ${strongestFormat.toLowerCase()} como eixo de repetição antes de expandir para variações secundárias.`,
          strongestWindow
            ? `Testar escala nas janelas próximas de ${strongestWindow} para validar recorrência do padrão.`
            : "Usar os horários de melhor resposta como base para o próximo ciclo de publicação.",
        ],
    caveats: [
      `Leitura baseada em ${posts.length} posts reais no recorte de ${periodLabel.toLowerCase()}.`,
      metricMeta.isProxy
        ? "A métrica principal usa proxy de intenção de lead; trate como sinal comparativo, não como dado absoluto."
        : `A métrica principal do case é ${metricMeta.label.toLowerCase()}.`,
      "Os sinais indicam padrão e oportunidade de teste, não garantia causal de resultado.",
    ],
    directioning,
    strategicAction,
    guardrails,
    storyArc: "thesis_proof_action",
    topDuration,
    executionSummary,
    contentIdeas,
    featuredPosts,
    evidence: {
      narrativePosts: narrativePostMatches.map((post) => toFeaturedPost(post, metricMeta.shortLabel, objective)),
      formatPosts: formatPostMatches.map((post) => toFeaturedPost(post, metricMeta.shortLabel, objective)),
      timingPosts: timingPostMatches.map((post) => toFeaturedPost(post, metricMeta.shortLabel, objective)),
      timingChart,
      formatChart: topFormats,
      durationChart: durationBuckets,
    },
  };

  const storyDecision = chooseStoryArc(source);

  return {
    ...source,
    storyArc: storyDecision.arc,
  };
}
