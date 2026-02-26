"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock3, LineChart as LineChartIcon, Sparkles, Target } from "lucide-react";
import { TopDiscoveryTable } from "./components/TopDiscoveryTable";
import Drawer from "@/components/ui/Drawer";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { track } from "@/lib/track";

const PostsBySliceModal = dynamic(() => import("./components/PostsBySliceModal"), {
  ssr: false,
  loading: () => null,
});
const DiscoverVideoModal = dynamic(() => import("@/app/discover/components/DiscoverVideoModal"), {
  ssr: false,
  loading: () => null,
});
const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  { ssr: false, loading: () => null }
);

const cardBase = "rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm";
const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" };
const DEFAULT_TIME_PERIOD = "last_90_days";
const PERIOD_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Últimos 7 dias", value: "last_7_days" },
  { label: "Últimos 14 dias", value: "last_14_days" },
  { label: "Últimos 30 dias", value: "last_30_days" },
  { label: "Últimos 60 dias", value: "last_60_days" },
  { label: "Últimos 90 dias", value: "last_90_days" },
  { label: "Últimos 120 dias", value: "last_120_days" },
];
const AUTO_PREFETCH_PAGE_CAP_BY_PERIOD: Record<string, number> = {
  last_7_days: 1,
  last_14_days: 1,
  last_30_days: 2,
  last_60_days: 2,
  last_90_days: 3,
  last_120_days: 4,
};
const metricCellClass = "text-right tabular-nums text-slate-800 font-semibold";
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || res.statusText);
  }
  return res.json();
};
const numberFormatter = new Intl.NumberFormat("pt-BR");
const TARGET_TIMEZONE = "America/Sao_Paulo";
const WEEKDAY_SHORT_SUN_FIRST = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const WEEKDAY_LONG_SUN_FIRST = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const WEEKDAY_SHORT_EN_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const zonedDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TARGET_TIMEZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
const toNumber = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const formatPostsCount = (count: number) => {
  const rounded = Math.max(0, Math.round(count));
  return `${numberFormatter.format(rounded)} post${rounded === 1 ? "" : "s"}`;
};
type PlanningObjectiveMode = "reach" | "engagement" | "leads";
type PlanningRecommendationAction = {
  id: string;
  title: string;
  action: string;
  impactEstimate: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
};
const OBJECTIVE_OPTIONS: Array<{ value: PlanningObjectiveMode; label: string }> = [
  { value: "engagement", label: "Engajamento" },
  { value: "reach", label: "Alcance" },
  { value: "leads", label: "Leads" },
];
const confidenceLabel: Record<PlanningRecommendationAction["confidence"], string> = {
  high: "Alta confiança",
  medium: "Confiança média",
  low: "Baixa confiança",
};
const confidencePillLabel: Record<PlanningRecommendationAction["confidence"], string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const twoLineClampStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
};
const parseRolloutPercent = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
};
const PLANNING_RECOMMENDATIONS_ROLLOUT_PERCENT = parseRolloutPercent(
  process.env.NEXT_PUBLIC_PLANNING_RECOMMENDATIONS_ROLLOUT_PERCENT,
  10
);
const hashToRolloutBucket = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100);
};
const isUserInRollout = (userId: string, rolloutPercent: number) => {
  if (!userId) return false;
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  return hashToRolloutBucket(userId) < rolloutPercent;
};
type CategoryField = "format" | "proposal" | "context" | "tone" | "references";
type CategoryBarDatum = { name: string; value: number; postsCount: number };
type DurationBucketKey = "0_15" | "15_30" | "30_60" | "60_plus";
type DurationBarDatum = {
  key: DurationBucketKey;
  label: "0-15s" | "15-30s" | "30-60s" | "60s+";
  minSeconds: number;
  maxSeconds: number | null;
  postsCount: number;
  totalInteractions: number;
  averageInteractions: number;
};
type DurationSummary = {
  totalVideoPosts: number;
  totalPostsWithDuration: number;
  totalPostsWithoutDuration: number;
  durationCoverageRate: number;
};
type DurationFallbackData = {
  buckets: DurationBarDatum[];
  summary: DurationSummary;
};
const DURATION_BUCKETS: Array<{
  key: DurationBucketKey;
  label: DurationBarDatum["label"];
  minSeconds: number;
  maxSeconds: number | null;
}> = [
  { key: "0_15", label: "0-15s", minSeconds: 0, maxSeconds: 15 },
  { key: "15_30", label: "15-30s", minSeconds: 15, maxSeconds: 30 },
  { key: "30_60", label: "30-60s", minSeconds: 30, maxSeconds: 60 },
  { key: "60_plus", label: "60s+", minSeconds: 60, maxSeconds: null },
];
const DURATION_FETCH_CONCURRENCY = 4;
const getDurationBucket = (seconds: number | null | undefined) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return DURATION_BUCKETS.find(
    (bucket) => seconds >= bucket.minSeconds && (bucket.maxSeconds === null || seconds < bucket.maxSeconds)
  ) || null;
};
const getPostStableKey = (post: any): string | null =>
  post?._id || post?.id || post?.instagramMediaId || (post?.postDate ? `${post.postDate}-${post?.caption || ""}` : null);
const isVideoPost = (post: any) => {
  const type = String(post?.type || "").toUpperCase();
  if (type === "REEL" || type === "VIDEO") return true;
  const duration = toNumber(post?.stats?.video_duration_seconds) ?? 0;
  return duration > 0;
};
const getPostInteractions = (post: any) => {
  const fromTotal = toNumber(post?.stats?.total_interactions);
  if (fromTotal !== null) return fromTotal;
  const likes = toNumber(post?.stats?.likes) ?? 0;
  const comments = toNumber(post?.stats?.comments) ?? 0;
  const shares = toNumber(post?.stats?.shares) ?? 0;
  const saves = toNumber(post?.stats?.saved) ?? toNumber(post?.stats?.saves) ?? 0;
  return likes + comments + shares + saves;
};
const EMPTY_DURATION_FALLBACK: DurationFallbackData = {
  buckets: DURATION_BUCKETS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    minSeconds: definition.minSeconds,
    maxSeconds: definition.maxSeconds,
    postsCount: 0,
    totalInteractions: 0,
    averageInteractions: 0,
  })),
  summary: {
    totalVideoPosts: 0,
    totalPostsWithDuration: 0,
    totalPostsWithoutDuration: 0,
    durationCoverageRate: 0,
  },
};

const buildDurationFallbackFromPosts = (posts: any[]): DurationFallbackData => {
  const bucketTotals = new Map<DurationBucketKey, { postsCount: number; totalInteractions: number }>(
    DURATION_BUCKETS.map((bucket) => [bucket.key, { postsCount: 0, totalInteractions: 0 }])
  );

  let totalVideoPosts = 0;
  let totalPostsWithDuration = 0;
  let totalPostsWithoutDuration = 0;

  posts.forEach((post) => {
    if (!isVideoPost(post)) return;
    totalVideoPosts += 1;

    const duration = toNumber(post?.stats?.video_duration_seconds);
    const bucket = getDurationBucket(duration);
    if (!bucket) {
      totalPostsWithoutDuration += 1;
      return;
    }

    totalPostsWithDuration += 1;
    const bucketTotal = bucketTotals.get(bucket.key);
    if (!bucketTotal) return;
    bucketTotal.postsCount += 1;
    bucketTotal.totalInteractions += getPostInteractions(post);
    bucketTotals.set(bucket.key, bucketTotal);
  });

  const buckets = DURATION_BUCKETS.map((definition) => {
    const totals = bucketTotals.get(definition.key) || { postsCount: 0, totalInteractions: 0 };
    return {
      key: definition.key,
      label: definition.label,
      minSeconds: definition.minSeconds,
      maxSeconds: definition.maxSeconds,
      postsCount: totals.postsCount,
      totalInteractions: totals.totalInteractions,
      averageInteractions: totals.postsCount > 0 ? totals.totalInteractions / totals.postsCount : 0,
    };
  });

  return {
    buckets,
    summary: {
      totalVideoPosts,
      totalPostsWithDuration,
      totalPostsWithoutDuration,
      durationCoverageRate: totalVideoPosts > 0 ? totalPostsWithDuration / totalVideoPosts : 0,
    },
  };
};
const getTargetDateParts = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = zonedDatePartsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const weekdayShort = get("weekday");
  const month = Number(get("month"));
  const day = Number(get("day"));
  const year = Number(get("year"));
  const hour = Number(get("hour"));
  const weekdayIndexSun0 = typeof weekdayShort === "string" ? WEEKDAY_SHORT_EN_TO_INDEX[weekdayShort] : undefined;
  if (
    weekdayIndexSun0 === undefined ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour)
  ) {
    return null;
  }
  return {
    weekdayIndexSun0,
    dayOfWeekMongo: weekdayIndexSun0 + 1,
    year,
    month,
    day,
    hour,
  };
};

const getWeekStart = (d: string | Date) => {
  const parts = getTargetDateParts(d);
  if (!parts) return null;
  const diffToMonday = (parts.weekdayIndexSun0 + 6) % 7;
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  return start;
};

const formatDateKey = (d: Date) => {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseIsoWeekKey = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Monday = 0
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  target.setUTCHours(0, 0, 0, 0);
  return target;
};

const getWeekKey = (d: string | Date) => {
  const start = getWeekStart(d);
  return start ? formatDateKey(start) : null;
};

const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizeLabel = (value: string) => stripAccents(value).trim().toLowerCase();

const toArray = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v));
  if (value) return [String(value)];
  return [];
};

const normalizeWeekKey = (value: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return getWeekKey(value);
  if (typeof value === "string") {
    const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (direct) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return getWeekKey(parsed);
  }
  return null;
};

const formatWeekLabel = (weekKey?: string | null) => {
  if (!weekKey) return "";
  const key = normalizeWeekKey(weekKey);
  if (!key) return weekKey;
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return key;
  const labelDate = new Date(Number(year), Number(month) - 1, Number(day));
  return labelDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const toVideoProxyUrl = (raw?: string | null) => {
  if (!raw) return raw;
  if (raw.startsWith("/api/proxy/video/")) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/video/${encodeURIComponent(raw)}`;
  return raw;
};

const normalizePost = (post: any) => {
  const formatRaw = toArray(post?.format).length ? toArray(post?.format) : toArray(post?.mediaType);
  const format = formatRaw.map((f) => f.trim());
  const proposal = toArray(post?.proposal);
  const context = toArray(post?.context);
  const tone = toArray(post?.tone);
  const references = toArray(post?.references ?? post?.reference);
  const metaLabel = [
    format.length ? `Formato: ${format.join(", ")}` : null,
    proposal.length ? `Proposta: ${proposal.join(", ")}` : null,
    context.length ? `Contexto: ${context.join(", ")}` : null,
    tone.length ? `Tom: ${tone.join(", ")}` : null,
    references.length ? `Ref: ${references.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    ...post,
    format,
    proposal,
    context,
    tone,
    references,
    metaLabel,
    postDate: post?.postDate,
    stats: post?.stats ?? {},
  };
};

const filterPostsByWeek = (posts: any[], weekKey: string | null) => {
  const target = normalizeWeekKey(weekKey);
  if (!target) return [];
  return posts.filter((p) => p?.postDate && normalizeWeekKey(p.postDate) === target);
};

const filterPostsByHour = (posts: any[], hour: number) =>
  posts.filter((p) => {
    if (!p?.postDate) return false;
    const parts = getTargetDateParts(p.postDate);
    return !!parts && parts.hour === hour;
  });

const filterPostsByDayHour = (posts: any[], day: number, startHour: number, endHour: number) =>
  posts.filter((p) => {
    if (!p?.postDate) return false;
    const parts = getTargetDateParts(p.postDate);
    if (!parts) return false;
    return parts.dayOfWeekMongo === day && parts.hour >= startHour && parts.hour <= endHour;
  });

const formatAliases: Record<string, string> = {
  photo: "foto",
  imagem: "foto",
  image: "foto",
  carousel: "carrossel",
  carrossel: "carrossel",
  reel: "reels",
  reels: "reels",
  video: "video",
  "vídeo": "video",
};

const matchesValue = (list: string[], target: string) => {
  const targetNorm = normalizeLabel(target);
  return list.some((item) => {
    const norm = normalizeLabel(item);
    if (norm === targetNorm) return true;
    const alias = formatAliases[norm];
    const aliasTarget = formatAliases[targetNorm];
    if (alias && alias === targetNorm) return true;
    if (aliasTarget && aliasTarget === norm) return true;
    return false;
  });
};

const filterPostsByCategory = (posts: any[], field: CategoryField, value: string) =>
  posts.filter((p) => Array.isArray(p?.[field]) && matchesValue(p[field], value));

const sortPostsByDateDesc = (posts: any[]) =>
  posts.slice().sort((a, b) => {
    const aDate = a?.postDate ? new Date(a.postDate).getTime() : 0;
    const bDate = b?.postDate ? new Date(b.postDate).getTime() : 0;
    return bDate - aDate;
  });

const aggregateAverageInteractionsByCategory = (posts: any[], field: CategoryField): CategoryBarDatum[] => {
  if (!Array.isArray(posts) || !posts.length) return [];
  const acc = new Map<string, { interactionsSum: number; postsCount: number }>();

  posts.forEach((post) => {
    const categories = Array.from(
      new Set(
        toArray(post?.[field])
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );
    if (!categories.length) return;

    const interactions = toNumber(post?.stats?.total_interactions) ?? 0;
    categories.forEach((category) => {
      const current = acc.get(category) || { interactionsSum: 0, postsCount: 0 };
      current.interactionsSum += interactions;
      current.postsCount += 1;
      acc.set(category, current);
    });
  });

  return Array.from(acc.entries())
    .map(([name, data]) => ({
      name,
      value: data.postsCount ? data.interactionsSum / data.postsCount : 0,
      postsCount: data.postsCount,
    }))
    .sort((a, b) => b.value - a.value);
};

const hydrateBarsWithCounts = (
  bars: Array<{ name: string; value: number; postsCount?: number }>,
  fallback: CategoryBarDatum[] | undefined
) =>
  bars.map((bar) => {
    if (typeof bar.postsCount === "number") return bar;
    const fallbackBar = fallback?.find((row) => matchesValue([row.name], bar.name));
    return {
      ...bar,
      postsCount: fallbackBar?.postsCount ?? 0,
    };
  });

const hasCategoryDataWithCounts = (rows: any): boolean =>
  Array.isArray(rows) &&
  rows.length > 0 &&
  rows.every((row) => typeof row?.postsCount === "number");

type ViewerInfo = {
  id: string;
  role?: string | null;
  name?: string | null;
};

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
};

export default function PlanningChartsPage({ viewer }: { viewer: ViewerInfo }) {
  const router = useRouter();
  const sessionUserId = viewer?.id;
  const viewerRole = viewer?.role ?? null;
  const isAdminViewer = viewerRole === "admin";
  const { enabled: recommendationsFlagEnabled, loading: recommendationsFlagLoading } = useFeatureFlag(
    "planning.recommendations_v1",
    false
  );
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const targetUserId = isAdminViewer && adminTargetUser?.id ? adminTargetUser.id : null;
  const activeUserId = targetUserId ?? sessionUserId;
  const isActingOnBehalf = Boolean(
    isAdminViewer &&
      targetUserId &&
      sessionUserId &&
      targetUserId !== sessionUserId
  );
  const swrOptions = useMemo(
    () => ({
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
    }),
    []
  );
  const [timePeriod, setTimePeriod] = useState<string>(DEFAULT_TIME_PERIOD);
  const [objectiveMode, setObjectiveMode] = useState<PlanningObjectiveMode>("engagement");
  const [selectedRecommendation, setSelectedRecommendation] = useState<PlanningRecommendationAction | null>(null);
  const [page, setPage] = useState(1);
  const [postsCache, setPostsCache] = useState<any[]>([]);
  const [autoPaginating, setAutoPaginating] = useState(false);
  const [showAdvancedSections, setShowAdvancedSections] = useState(false);
  const durationBucketPostsCacheRef = useRef<Map<string, any[]>>(new Map());
  const fetchedPagesRef = useRef<Set<number>>(new Set());
  const paginationScopeRef = useRef<string>("");
  const advancedSectionsSentinelRef = useRef<HTMLDivElement | null>(null);
  const PAGE_LIMIT = 200;
  const MAX_PAGES = 6; // hard cap de segurança
  const paginationScopeKey = `${activeUserId || "none"}:${timePeriod}`;
  const recommendationsFeatureEnabled = useMemo(() => {
    if (isAdminViewer) return true;
    if (recommendationsFlagLoading) return false;
    if (!recommendationsFlagEnabled) return false;
    return isUserInRollout(activeUserId, PLANNING_RECOMMENDATIONS_ROLLOUT_PERCENT);
  }, [activeUserId, isAdminViewer, recommendationsFlagEnabled, recommendationsFlagLoading]);
  const autoPrefetchPagesCap = Math.min(
    MAX_PAGES,
    AUTO_PREFETCH_PAGE_CAP_BY_PERIOD[timePeriod] ?? 2
  );

  const resetPaginationState = React.useCallback(() => {
    setPage(1);
    setPostsCache([]);
    setAutoPaginating(false);
  }, []);

  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value);
    resetPaginationState();
  };

  const handleObjectiveModeChange = React.useCallback(
    (nextObjective: PlanningObjectiveMode) => {
      if (nextObjective === objectiveMode) return;
      track("planning_charts_objective_changed", {
        creator_id: activeUserId || null,
        from_objective: objectiveMode,
        to_objective: nextObjective,
        time_period: timePeriod,
      });
      setObjectiveMode(nextObjective);
    },
    [activeUserId, objectiveMode, timePeriod]
  );

  const openRecommendationEvidence = React.useCallback(
    (action: PlanningRecommendationAction) => {
      track("planning_charts_action_clicked", {
        creator_id: activeUserId || null,
        action_id: action.id,
        objective_mode: objectiveMode,
        confidence: action.confidence,
        time_period: timePeriod,
      });
      setSelectedRecommendation(action);
    },
    [activeUserId, objectiveMode, timePeriod]
  );

  const closeRecommendationEvidence = React.useCallback(() => {
    setSelectedRecommendation(null);
  }, []);

  const handleGoToPlanner = React.useCallback(
    (source: "recommendations_card" | "recommendation_drawer") => {
      track("planning_charts_go_to_planner_clicked", {
        creator_id: activeUserId || null,
        source,
        objective_mode: objectiveMode,
        time_period: timePeriod,
      });
      router.push("/planning/planner");
    },
    [activeUserId, objectiveMode, router, timePeriod]
  );

  useEffect(() => {
    durationBucketPostsCacheRef.current.clear();
  }, [activeUserId, timePeriod]);

  useEffect(() => {
    if (!recommendationsFeatureEnabled) {
      setSelectedRecommendation(null);
    }
  }, [recommendationsFeatureEnabled]);

  useEffect(() => {
    setSelectedRecommendation(null);
  }, [activeUserId, objectiveMode, timePeriod]);

  useEffect(() => {
    if (showAdvancedSections) return;
    const target = advancedSectionsSentinelRef.current;
    if (!target || typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setShowAdvancedSections(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setShowAdvancedSections(true);
        observer.disconnect();
      },
      { rootMargin: "520px 0px 520px 0px", threshold: 0.01 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [showAdvancedSections]);

  const { data: chartsBatchData, isLoading: loadingBatch } = useSWR(
    activeUserId
      ? `/api/v1/users/${activeUserId}/planning/charts-batch?timePeriod=${timePeriod}&granularity=weekly&metric=stats.total_interactions&engagementMetricField=stats.total_interactions&objectiveMode=${objectiveMode}&limit=${PAGE_LIMIT}`
      : null,
    fetcher,
    swrOptions
  );

  const trendData = chartsBatchData?.trendData;
  const timeData = chartsBatchData?.timeData;
  const durationData = chartsBatchData?.durationData;
  const formatData = chartsBatchData?.formatData;
  const proposalData = chartsBatchData?.proposalData;
  const toneData = chartsBatchData?.toneData;
  const referenceData = chartsBatchData?.referenceData;
  const contextData = chartsBatchData?.contextData;
  const recommendationActions = useMemo(
    () =>
      recommendationsFeatureEnabled
        ? ((chartsBatchData?.recommendations?.actions || []) as PlanningRecommendationAction[])
        : [],
    [chartsBatchData?.recommendations?.actions, recommendationsFeatureEnabled]
  );

  const hasDurationDataFromApi =
    Array.isArray(durationData?.buckets) && typeof durationData?.totalVideoPosts === "number";
  const hasTimeBucketsFromApi = Array.isArray(timeData?.buckets) && timeData.buckets.length > 0;
  const requiresExtendedPosts =
    !hasDurationDataFromApi ||
    !hasTimeBucketsFromApi ||
    !hasCategoryDataWithCounts(proposalData?.chartData) ||
    !hasCategoryDataWithCounts(toneData?.chartData) ||
    !hasCategoryDataWithCounts(referenceData?.chartData) ||
    !hasCategoryDataWithCounts(contextData?.chartData);

  const { data: pagedPostsData } = useSWR(
    activeUserId && page > 1 && requiresExtendedPosts && !fetchedPagesRef.current.has(page)
      ? `/api/v1/users/${activeUserId}/videos/list?timePeriod=${timePeriod}&limit=${PAGE_LIMIT}&page=${page}&sortBy=postDate&sortOrder=desc`
      : null,
    fetcher,
    swrOptions
  );
  const loadingTrend = loadingBatch;
  const loadingTime = loadingBatch;
  const loadingDuration = loadingBatch;
  const loadingFormat = loadingBatch;
  const loadingProposal = loadingBatch;
  const loadingTone = loadingBatch;
  const loadingReference = loadingBatch;
  const loadingPosts = loadingBatch && postsCache.length === 0;

  const trendSeries = useMemo(() => {
    const rows = (trendData?.chartData || []).map((point: any) => ({
      date: point.date,
      reach: typeof point.reach === "number" ? point.reach : 0,
      interactions: typeof point.totalInteractions === "number" ? point.totalInteractions : 0,
    }));
    if (!rows.length) return [];
    const agg = new Map<string, { reach: number; interactions: number; count: number }>();
    rows.forEach((row: { date: string; reach: number; interactions: number }) => {
      const isoWeekDate = typeof row.date === "string" ? parseIsoWeekKey(row.date) : null;
      const key = isoWeekDate ? formatDateKey(isoWeekDate) : getWeekKey(row.date) ?? (row.date ? String(row.date) : null);
      if (!key) return; // descarta pontos sem data válida
      const bucket = agg.get(key) || { reach: 0, interactions: 0, count: 0 };
      bucket.reach += row.reach;
      bucket.interactions += row.interactions;
      bucket.count += 1;
      agg.set(key, bucket);
    });
    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        reach: data.count ? data.reach / data.count : 0,
        interactions: data.count ? data.interactions / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [trendData]);

  const postsSource = postsCache;

  const normalizedPosts = useMemo(
    () => (Array.isArray(postsSource) ? postsSource.map((p) => normalizePost(p)) : []),
    [postsSource]
  );

  const durationFallback = useMemo(() => {
    if (hasDurationDataFromApi) return null;
    if (!normalizedPosts.length) return EMPTY_DURATION_FALLBACK;
    return buildDurationFallbackFromPosts(normalizedPosts);
  }, [hasDurationDataFromApi, normalizedPosts]);

  const getLocalDurationPosts = React.useCallback(
    (bucketKey: DurationBucketKey) =>
      sortPostsByDateDesc(
        normalizedPosts.filter((post) => {
          const duration = toNumber(post?.stats?.video_duration_seconds);
          const bucket = getDurationBucket(duration);
          return bucket?.key === bucketKey;
        })
      ),
    [normalizedPosts]
  );

  const [sliceModal, setSliceModal] = useState<{ open: boolean; title: string; subtitle?: string; posts: any[] }>({
    open: false,
    title: "",
    subtitle: "",
    posts: [],
  });

  const openSliceModal = React.useCallback(
    ({ title, subtitle, posts }: { title: string; subtitle?: string; posts: any[] }) => {
      setSliceModal({ open: true, title, subtitle, posts });
    },
    []
  );

  const closeSliceModal = React.useCallback(() => {
    setSliceModal((prev) => ({ ...prev, open: false }));
  }, []);

  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<any>(null);

  const handlePlayVideo = React.useCallback((post: any) => {
    setSelectedVideoForPlayer(post);
    setIsVideoPlayerOpen(true);
  }, []);


  const handleWeekClick = React.useCallback(
    (weekKey: string | null, subtitle: string) => {
      if (!weekKey) return;
      const posts = sortPostsByDateDesc(filterPostsByWeek(normalizedPosts, weekKey));
      openSliceModal({
        title: `Posts da semana ${weekKey}`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  const handleHourClick = React.useCallback(
    async (hour: number, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByHour(normalizedPosts, hour));
      if (posts.length > 0) {
        openSliceModal({
          title: `Posts no horário ${hour}h`,
          subtitle,
          posts,
        });
        return;
      }

      // Fallback: busca posts do horário no back-end usando o período selecionado.
      if (!activeUserId) return;
      try {
        const res = await fetch(
          `/api/v1/users/${activeUserId}/videos/list?timePeriod=${timePeriod}&hour=${hour}&limit=200&page=1&sortBy=postDate&sortOrder=desc`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          openSliceModal({
            title: `Posts no horário ${hour}h`,
            subtitle,
            posts: [],
          });
          return;
        }
        const data = await res.json();
        const apiPosts = Array.isArray(data?.posts) ? data.posts : [];
        const normalized = apiPosts.map((p: any) => normalizePost(p));
        openSliceModal({
          title: `Posts no horário ${hour}h`,
          subtitle,
          posts: sortPostsByDateDesc(normalized),
        });
      } catch (err) {
        console.warn("[PlanningCharts] Falha ao buscar posts por hora", err);
        openSliceModal({
          title: `Posts no horário ${hour}h`,
          subtitle,
          posts: [],
        });
      }
    },
    [activeUserId, normalizedPosts, openSliceModal, timePeriod]
  );

  const handleDurationBucketClick = React.useCallback(
    async (bucketKey: DurationBucketKey, subtitle: string) => {
      const bucket = DURATION_BUCKETS.find((item) => item.key === bucketKey);
      if (!bucket) return;

      const localPosts = getLocalDurationPosts(bucketKey);
      if (!activeUserId) {
        openSliceModal({
          title: `Posts com duração real ${bucket.label}`,
          subtitle,
          posts: localPosts,
        });
        return;
      }

      const cacheKey = `${activeUserId}:${timePeriod}:${bucketKey}`;
      const cachedPosts = durationBucketPostsCacheRef.current.get(cacheKey);
      if (cachedPosts && cachedPosts.length > 0) {
        openSliceModal({
          title: `Posts com duração real ${bucket.label}`,
          subtitle,
          posts: cachedPosts,
        });
        return;
      }

      try {
        const pageLimit = 200;
        const buildUrl = (page: number) =>
          `/api/v1/users/${activeUserId}/videos/list?timePeriod=${timePeriod}&durationBucket=${bucketKey}&types=REEL,VIDEO&limit=${pageLimit}&page=${page}&sortBy=postDate&sortOrder=desc`;
        const parsePagePosts = (data: any) =>
          (Array.isArray(data?.posts) ? data.posts : []).map((post: any) => normalizePost(post));

        const firstRes = await fetch(buildUrl(1), { cache: "no-store" });
        if (!firstRes.ok) throw new Error(`duration page 1 failed with status ${firstRes.status}`);

        const firstData = await firstRes.json();
        const fetchedPosts: any[] = parsePagePosts(firstData);

        let totalPages = Number(firstData?.pagination?.totalPages);
        if (!Number.isFinite(totalPages) || totalPages < 1) {
          totalPages = fetchedPosts.length < pageLimit ? 1 : 2;
        }

        const remainingPages = Array.from(
          { length: Math.max(0, totalPages - 1) },
          (_, index) => index + 2
        );

        for (let i = 0; i < remainingPages.length; i += DURATION_FETCH_CONCURRENCY) {
          const batch = remainingPages.slice(i, i + DURATION_FETCH_CONCURRENCY);
          const batchResults = await Promise.allSettled(
            batch.map(async (page) => {
              const res = await fetch(buildUrl(page), { cache: "no-store" });
              if (!res.ok) return [];
              const data = await res.json();
              return parsePagePosts(data);
            })
          );

          batchResults.forEach((result) => {
            if (result.status !== "fulfilled" || !Array.isArray(result.value)) return;
            if (result.value.length > 0) fetchedPosts.push(...result.value);
          });
        }

        const dedupedPosts: any[] = [];
        const seenKeys = new Set<string>();
        fetchedPosts.forEach((post) => {
          const key = getPostStableKey(post);
          if (!key) {
            dedupedPosts.push(post);
            return;
          }
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
          dedupedPosts.push(post);
        });

        const postsForModal = dedupedPosts.length > 0 ? sortPostsByDateDesc(dedupedPosts) : localPosts;
        durationBucketPostsCacheRef.current.set(cacheKey, postsForModal);
        openSliceModal({
          title: `Posts com duração real ${bucket.label}`,
          subtitle,
          posts: postsForModal,
        });
      } catch (error) {
        console.warn("[PlanningCharts] Falha ao buscar posts por duração", error);
        openSliceModal({
          title: `Posts com duração real ${bucket.label}`,
          subtitle,
          posts: localPosts,
        });
      }
    },
    [activeUserId, getLocalDurationPosts, openSliceModal, timePeriod]
  );

  const handleDayHourClick = React.useCallback(
    (day: number, startHour: number, endHour: number, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByDayHour(normalizedPosts, day, startHour, endHour));
      openSliceModal({
        title: `Posts em ${WEEKDAY_SHORT_SUN_FIRST[day - 1] || `Dia ${day}`} entre ${startHour}h e ${endHour}h`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  const handleCategoryClick = React.useCallback(
    (field: "format" | "proposal" | "context" | "tone" | "references", value: string, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByCategory(normalizedPosts, field, value));
      openSliceModal({
        title: `Posts com ${field}: ${value}`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  const mergePosts = (prev: any[], next: any[]) => {
    const map = new Map<string, any>();
    let uniqueAdded = 0;

    prev.forEach((post) => {
      const key = getPostStableKey(post) ?? Math.random().toString(36);
      map.set(key, post);
    });

    next.forEach((post) => {
      const key = getPostStableKey(post) ?? Math.random().toString(36);
      if (!map.has(key)) uniqueAdded += 1;
      map.set(key, { ...map.get(key), ...post });
    });

    return { merged: Array.from(map.values()), uniqueAdded };
  };

  // carrega a primeira página junto do batch para reduzir round-trips no primeiro paint
  useEffect(() => {
    const list = Array.isArray(chartsBatchData?.postsData?.posts) ? chartsBatchData.postsData.posts : [];
    const totalPagesFromBatch = Number(chartsBatchData?.postsData?.pagination?.totalPages || 1);
    const maxPrefetchPages = Math.min(
      autoPrefetchPagesCap,
      Number.isFinite(totalPagesFromBatch) && totalPagesFromBatch > 0 ? totalPagesFromBatch : 1
    );
    const scopeChanged = paginationScopeRef.current !== paginationScopeKey;
    if (scopeChanged) {
      paginationScopeRef.current = paginationScopeKey;
      fetchedPagesRef.current = new Set();
    }
    if (!chartsBatchData) return;

    if (!list.length) {
      if (scopeChanged) {
        setPostsCache([]);
        setPage(1);
        setAutoPaginating(false);
      }
      return;
    }

    const incomingFirstKey = getPostStableKey(list[0]);
    const currentFirstKey = getPostStableKey(postsCache[0]);
    const shouldRefreshSeedPage = scopeChanged || postsCache.length === 0 || incomingFirstKey !== currentFirstKey;
    if (!shouldRefreshSeedPage) return;

    fetchedPagesRef.current = new Set([1]);
    setPostsCache(list);
    const shouldPrefetch = requiresExtendedPosts && list.length === PAGE_LIMIT && maxPrefetchPages > 1;
    setPage(shouldPrefetch ? 2 : 1);
    setAutoPaginating(false);
  }, [chartsBatchData, requiresExtendedPosts, autoPrefetchPagesCap, paginationScopeKey, postsCache]);

  // acumula páginas adicionais em baixa prioridade para não competir com interação inicial
  useEffect(() => {
    if (page <= 1) return;

    const list = Array.isArray(pagedPostsData?.posts)
      ? pagedPostsData.posts
      : Array.isArray(pagedPostsData?.videos)
        ? pagedPostsData.videos
        : [];
    if (!list.length) return;

    fetchedPagesRef.current.add(page);
    const { merged, uniqueAdded } = mergePosts(postsCache, list);
    if (uniqueAdded > 0) {
      setPostsCache(merged);
    }

    const totalPagesFromResponse = Number(pagedPostsData?.pagination?.totalPages || 0);
    const maxPrefetchPages = Math.min(
      autoPrefetchPagesCap,
      Number.isFinite(totalPagesFromResponse) && totalPagesFromResponse > 0 ? totalPagesFromResponse : autoPrefetchPagesCap
    );

    const shouldLoadMore =
      requiresExtendedPosts &&
      uniqueAdded > 0 &&
      list.length === PAGE_LIMIT &&
      page < maxPrefetchPages;
    if (shouldLoadMore && !autoPaginating) {
      setAutoPaginating(true);
      const queueNextPage = () => {
        setPage((p) => Math.min(p + 1, maxPrefetchPages));
        setAutoPaginating(false);
      };
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(queueNextPage, { timeout: 1200 });
      } else {
        window.setTimeout(queueNextPage, 180);
      }
    }
  }, [pagedPostsData, page, autoPaginating, requiresExtendedPosts, autoPrefetchPagesCap, postsCache]);

  const hourBars = useMemo(() => {
    const buckets: Array<{ hour: number; average: number; count?: number }> = timeData?.buckets || [];
    const source =
      buckets.length > 0
        ? buckets.map(({ hour, average, count }) => ({
            hour,
            average: average || 0,
            count: typeof count === "number" && count > 0 ? count : null,
          }))
        : Array.isArray(postsSource)
          ? postsSource
            .filter((p) => p?.postDate)
            .map((p) => {
              const parts = getTargetDateParts(p.postDate);
              if (!parts) return null;
              return {
                hour: parts.hour,
                average: toNumber(p?.stats?.total_interactions) ?? 0,
                count: 1,
              };
            })
            .filter(Boolean)
          : [];

    if (!source.length) return [];
    const acc = new Map<number, { weightedSum: number; weight: number; fallbackSum: number; fallbackCount: number; postsCount: number }>();
    source.forEach((item: any) => {
      const current = acc.get(item.hour) || {
        weightedSum: 0,
        weight: 0,
        fallbackSum: 0,
        fallbackCount: 0,
        postsCount: 0,
      };
      if (typeof item.count === "number" && item.count > 0) {
        current.weightedSum += item.average * item.count;
        current.weight += item.count;
        current.postsCount += item.count;
      } else {
        current.fallbackSum += item.average;
        current.fallbackCount += 1;
      }
      acc.set(item.hour, {
        weightedSum: current.weightedSum,
        weight: current.weight,
        fallbackSum: current.fallbackSum,
        fallbackCount: current.fallbackCount,
        postsCount: current.postsCount,
      });
    });

    return Array.from(acc.entries())
      .map(([hour, { weightedSum, weight, fallbackSum, fallbackCount, postsCount }]) => ({
        hour,
        average: weight > 0 ? weightedSum / weight : fallbackCount > 0 ? fallbackSum / fallbackCount : 0,
        postsCount: weight > 0 ? postsCount : undefined,
      }))
      .sort((a, b) => a.hour - b.hour);
  }, [postsSource, timeData]);

  const bestHour = useMemo(() => hourBars?.slice().sort((a, b) => b.average - a.average)?.[0]?.hour ?? null, [hourBars]);

  const durationBuckets = useMemo<DurationBarDatum[]>(() => {
    const fromApi = Array.isArray(durationData?.buckets) ? durationData.buckets : [];
    if (fromApi.length > 0) {
      return DURATION_BUCKETS.map((definition) => {
        const row = fromApi.find((item: any) => item?.key === definition.key);
        const postsCount = Number(row?.postsCount || 0);
        const totalInteractions = Number(row?.totalInteractions || 0);
        const averageInteractions = Number(row?.averageInteractions || 0);
        return {
          key: definition.key,
          label: definition.label,
          minSeconds: definition.minSeconds,
          maxSeconds: definition.maxSeconds,
          postsCount,
          totalInteractions,
          averageInteractions: Number.isFinite(averageInteractions)
            ? averageInteractions
            : postsCount > 0
              ? totalInteractions / postsCount
              : 0,
        };
      });
    }

    return durationFallback?.buckets || EMPTY_DURATION_FALLBACK.buckets;
  }, [durationData, durationFallback]);

  const durationSummary = useMemo(() => {
    if (durationData && typeof durationData.totalVideoPosts === "number") {
      const totalVideoPosts = Number(durationData.totalVideoPosts || 0);
      const totalPostsWithDuration = Number(durationData.totalPostsWithDuration || 0);
      const totalPostsWithoutDuration = Number(durationData.totalPostsWithoutDuration || 0);
      const durationCoverageRate =
        typeof durationData.durationCoverageRate === "number"
          ? durationData.durationCoverageRate
          : totalVideoPosts > 0
            ? totalPostsWithDuration / totalVideoPosts
            : 0;
      return {
        totalVideoPosts,
        totalPostsWithDuration,
        totalPostsWithoutDuration,
        durationCoverageRate,
      };
    }

    return durationFallback?.summary || EMPTY_DURATION_FALLBACK.summary;
  }, [durationData, durationFallback]);

  const bestDurationBucket = useMemo(() => {
    return durationBuckets
      .filter((bucket) => bucket.postsCount > 0)
      .sort((a, b) => b.averageInteractions - a.averageInteractions)[0] || null;
  }, [durationBuckets]);

  const lowSampleDurationBuckets = useMemo(() => {
    return durationBuckets.filter((bucket) => bucket.postsCount > 0 && bucket.postsCount < 5).length;
  }, [durationBuckets]);

  const formatBars = useMemo(() => formatData?.chartData || [], [formatData]);
  const proposalBarsFromApi = useMemo(
    () => (proposalData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>,
    [proposalData]
  );
  const toneBarsFromApi = useMemo(
    () => (toneData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>,
    [toneData]
  );
  const referenceBarsFromApi = useMemo(
    () => (referenceData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>,
    [referenceData]
  );
  const contextBarsFromApi = useMemo(
    () => (contextData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>,
    [contextData]
  );

  const needsCategoryFallback = useMemo(() => {
    if (!showAdvancedSections) return false;
    if (!proposalBarsFromApi.length || !toneBarsFromApi.length || !referenceBarsFromApi.length || !contextBarsFromApi.length) {
      return true;
    }
    const hasMissingCount = (bars: Array<{ postsCount?: number }>) =>
      bars.some((bar) => typeof bar.postsCount !== "number");
    return (
      hasMissingCount(proposalBarsFromApi) ||
      hasMissingCount(toneBarsFromApi) ||
      hasMissingCount(referenceBarsFromApi) ||
      hasMissingCount(contextBarsFromApi)
    );
  }, [proposalBarsFromApi, toneBarsFromApi, referenceBarsFromApi, contextBarsFromApi, showAdvancedSections]);

  const categoryFallback = useMemo(() => {
    if (!needsCategoryFallback) return null;
    return {
      proposal: aggregateAverageInteractionsByCategory(normalizedPosts, "proposal"),
      tone: aggregateAverageInteractionsByCategory(normalizedPosts, "tone"),
      references: aggregateAverageInteractionsByCategory(normalizedPosts, "references"),
      context: aggregateAverageInteractionsByCategory(normalizedPosts, "context"),
    };
  }, [needsCategoryFallback, normalizedPosts]);

  const proposalBars = useMemo(() => {
    if (proposalBarsFromApi.length) {
      return hydrateBarsWithCounts(proposalBarsFromApi, categoryFallback?.proposal);
    }
    return (categoryFallback?.proposal || []).slice(0, 6);
  }, [proposalBarsFromApi, categoryFallback]);

  const toneBars = useMemo(() => {
    if (toneBarsFromApi.length) {
      return hydrateBarsWithCounts(toneBarsFromApi, categoryFallback?.tone);
    }
    return (categoryFallback?.tone || []).slice(0, 6);
  }, [toneBarsFromApi, categoryFallback]);

  const referenceBars = useMemo(() => {
    if (referenceBarsFromApi.length) {
      return hydrateBarsWithCounts(referenceBarsFromApi, categoryFallback?.references);
    }
    return (categoryFallback?.references || []).slice(0, 6);
  }, [referenceBarsFromApi, categoryFallback]);

  const contextBars = useMemo(() => {
    if (contextBarsFromApi.length) {
      return hydrateBarsWithCounts(contextBarsFromApi, categoryFallback?.context);
    }
    return (categoryFallback?.context || []).slice(0, 6);
  }, [contextBarsFromApi, categoryFallback]);

  const followerMix = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const mapped = posts
      .map((p: any, idx: number) => {
        const rawNf = toNumber(p?.stats?.reach_non_followers_ratio);
        const rawF = toNumber(p?.stats?.reach_followers_ratio);
        const pv = toNumber(p?.stats?.profile_visits);
        const reach = toNumber(p?.stats?.reach);

        // Fallback: usa visitas ao perfil como proxy de descoberta (assume maioria não seguidor)
        let nfRatio = rawNf;
        let fRatio = rawF;
        if (nfRatio === null && pv !== null) {
          const base = reach && reach > 0 ? reach : pv;
          nfRatio = base > 0 ? Math.min(Math.max(pv / base, 0), 1) : null;
          fRatio = nfRatio !== null ? Math.max(1 - nfRatio, 0) : null;
        }

        if (nfRatio === null || fRatio === null) {
          nfRatio = 0;
          fRatio = 1;
        }

        const label = p?.caption ? p.caption.slice(0, 22) : `Post ${idx + 1}`;
        return {
          id: p._id || idx,
          label,
          date: p?.postDate,
          nf: Math.min(Math.max(nfRatio * 100, 0), 100),
          f: Math.min(Math.max(fRatio * 100, 0), 100),
          profileVisits: pv,
          reach,
        };
      })
      .filter(Boolean) as Array<{
        id: string | number;
        label: string;
        date?: string;
        nf: number;
        f: number;
        profileVisits?: number;
        reach?: number;
      }>;
    return mapped.slice(0, 8);
  }, [postsSource]);

  const topDiscovery = useMemo(() => {
    if (!showAdvancedSections) return [];
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const normalizeCategories = (value: any): string[] =>
      Array.isArray(value)
        ? value.filter(Boolean).map((v) => String(v))
        : value
          ? [String(value)]
          : [];
    const buildMetaLabel = (p: any) => {
      const pieces = [
        { label: "Proposta", values: normalizeCategories(p?.proposal) },
        { label: "Contexto", values: normalizeCategories(p?.context) },
        { label: "Tom", values: normalizeCategories(p?.tone) },
        { label: "Referência", values: normalizeCategories(p?.references) },
        { label: "Formato", values: normalizeCategories(p?.format) },
      ]
        .map(({ label, values }) => (values.length ? `${label}: ${values.join(", ")}` : null))
        .filter(Boolean);
      return pieces.join(" • ");
    };
    return posts
      .map((p: any) => {
        const nf = (() => {
          const direct = toNumber(p?.stats?.reach_non_followers_ratio);
          if (direct !== null) return direct;
          const pv = toNumber(p?.stats?.profile_visits);
          const reach = toNumber(p?.stats?.reach);
          if (pv === null) return 0;
          const base = reach && reach > 0 ? reach : pv;
          return base > 0 ? Math.min(Math.max(pv / base, 0), 1) : null;
        })();
        const pv = toNumber(p?.stats?.profile_visits);
        const reach = toNumber(p?.stats?.reach);
        if (nf === null && pv === null) return null;
        const metaLabel = buildMetaLabel(p);
        const proposal = normalizeCategories(p?.proposal);
        const context = normalizeCategories(p?.context);
        const tone = normalizeCategories(p?.tone);
        const reference = normalizeCategories(p?.references);
        const format = normalizeCategories(p?.format);
        const mediaType = String(p?.type || "").toUpperCase();
        const isVideo =
          mediaType === "VIDEO" ||
          mediaType === "REEL" ||
          format.some((f) => /reel|video/i.test(f));
        const rawMediaUrl = p?.mediaUrl || p?.media_url || null;
        const videoUrl = isVideo ? toVideoProxyUrl(rawMediaUrl) : undefined;
        const postLink = p?.permalink || p?.postLink || null;
        return {
          id: p._id,
          caption: p.caption || "Post",
          date: p.postDate,
          metaLabel,
          proposal,
          context,
          tone,
          reference,
          format,
          postLink,
          videoUrl,
          nf,
          pv,
          reach,
          likes: toNumber(p?.stats?.likes) ?? 0,
          comments: toNumber(p?.stats?.comments) ?? 0,
          shares: toNumber(p?.stats?.shares) ?? 0,
          saves: (toNumber(p?.stats?.saved) ?? toNumber(p?.stats?.saves) ?? 0) || 0,
          thumbnail: p.thumbnailUrl || p.coverUrl || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.nf ?? 0) - (a?.nf ?? 0))
      .slice(0, 10) as Array<{
        id?: string;
        caption: string;
        date?: string;
        metaLabel: string;
        proposal: string[];
        context: string[];
        tone: string[];
        reference: string[];
        format: string[];
        postLink?: string | null;
        videoUrl?: string | null;
        nf: number | null;
        pv: number | null;
        reach: number | null;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        thumbnail?: string | null;
      }>;
  }, [postsSource, showAdvancedSections]);

  const heatmap = useMemo(() => {
    if (!showAdvancedSections) return [];
    const buckets: Array<{ dayOfWeek: number; hour: number; average: number }> = timeData?.buckets || [];
    let source: Array<{ day: number; hour: number; value: number }> = [];
    if (buckets.length) {
      source = buckets.map((b) => ({ day: b.dayOfWeek, hour: b.hour, value: b.average }));
    } else if (Array.isArray(postsSource)) {
      source = postsSource
        .filter((p) => p?.postDate)
        .map((p) => {
          const parts = getTargetDateParts(p.postDate);
          if (!parts) return null;
          return {
            day: parts.dayOfWeekMongo,
            hour: parts.hour,
            value: toNumber(p?.stats?.total_interactions) ?? 0,
          };
        })
        .filter(Boolean) as Array<{ day: number; hour: number; value: number }>;
    }
    if (!source.length) return [];
    const maxVal = Math.max(...source.map((s) => s.value || 0), 0.0001);
    return source.map((s) => ({
      day: s.day,
      hour: s.hour,
      score: (s.value || 0) / maxVal,
    }));
  }, [postsSource, timeData, showAdvancedSections]);

  const weeklyConsistency = useMemo(() => {
    if (!showAdvancedSections) return [];
    const posts = Array.isArray(postsSource) ? postsSource : [];
    if (!posts.length) return [];
    const weeks = new Map<
      string,
      { date: string; posts: number; totalInteractions: number; avgInteractions: number }
    >();
    posts.forEach((p: any) => {
      if (!p?.postDate) return;
      const key = getWeekKey(p.postDate);
      if (!key) return;
      const bucket = weeks.get(key) || { date: key, posts: 0, totalInteractions: 0, avgInteractions: 0 };
      const inter = typeof p?.stats?.total_interactions === "number" ? p.stats.total_interactions : 0;
      bucket.posts += 1;
      bucket.totalInteractions += inter;
      weeks.set(key, bucket);
    });
    return Array.from(weeks.values())
      .map((w) => ({ ...w, avgInteractions: w.posts ? w.totalInteractions / w.posts : 0 }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource, showAdvancedSections]);

  const deepEngagement = useMemo(() => {
    if (!showAdvancedSections) return [];
    const posts = Array.isArray(postsSource) ? postsSource : [];
    if (!posts.length) return [];
    const acc = new Map<string, { saves: number; shares: number; reach: number; count: number }>();
    posts.forEach((p: any) => {
      const formatKey = Array.isArray(p?.format) && p.format[0] ? p.format[0] : "Outro";
      const savesRaw = toNumber(p?.stats?.saved) ?? toNumber(p?.stats?.saves) ?? 0;
      const sharesRaw = toNumber(p?.stats?.shares) ?? 0;
      const reachRaw = toNumber(p?.stats?.reach) ?? 0;
      const bucket = acc.get(formatKey) || { saves: 0, shares: 0, reach: 0, count: 0 };
      bucket.saves += savesRaw;
      bucket.shares += sharesRaw;
      bucket.reach += reachRaw;
      bucket.count += 1;
      acc.set(formatKey, bucket);
    });
    return Array.from(acc.entries())
      .map(([format, data]) => ({
        format,
        savesPerThousand: data.reach > 0 ? (data.saves / data.reach) * 1000 : 0,
        sharesPerThousand: data.reach > 0 ? (data.shares / data.reach) * 1000 : 0,
        postsCount: data.count,
      }))
      .sort((a, b) => b.savesPerThousand + b.sharesPerThousand - (a.savesPerThousand + a.sharesPerThousand));
  }, [postsSource, showAdvancedSections]);

  const weeklyEngagementRate = useMemo(() => {
    if (!showAdvancedSections) return [];
    const posts = Array.isArray(postsSource) ? postsSource : [];
    if (!posts.length) return [];
    const weeks = new Map<string, { date: string; totalInteractions: number; totalReach: number; count: number }>();
    posts.forEach((p: any) => {
      if (!p?.postDate) return;
      const reach = toNumber(p?.stats?.reach);
      const interactions = toNumber(p?.stats?.total_interactions);
      if (!reach || reach <= 0 || interactions === null) return;
      const key = getWeekKey(p.postDate);
      if (!key) return;
      const bucket = weeks.get(key) || { date: key, totalInteractions: 0, totalReach: 0, count: 0 };
      bucket.totalInteractions += Math.max(interactions, 0);
      bucket.totalReach += reach;
      bucket.count += 1;
      weeks.set(key, bucket);
    });
    return Array.from(weeks.values())
      .map((w) => ({ ...w, avgRate: w.totalReach > 0 ? w.totalInteractions / w.totalReach : 0 }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource, showAdvancedSections]);

  const shareVelocitySeries = useMemo(() => {
    if (!showAdvancedSections) return [];
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const shares =
          toNumber(p?.stats?.shares) ??
          toNumber((p as any)?.stats?.share_count) ??
          toNumber((p as any)?.stats?.share) ??
          0;
        const visits = toNumber(p?.stats?.profile_visits) ?? 0;
        const reach = toNumber(p?.stats?.reach);
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { shares, visits, reach, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { shares: number; visits: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { shares: 0, visits: 0, count: 0 };
      bucket.shares += row.shares;
      bucket.visits += row.visits;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        shares: data.count ? data.shares / data.count : 0,
        visits: data.count ? data.visits / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource, showAdvancedSections]);

  const saveVelocitySeries = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const saves =
          toNumber(p?.stats?.saved) ??
          toNumber(p?.stats?.saves) ??
          toNumber((p as any)?.stats?.save_count) ??
          0;
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { saves, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { saves: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { saves: 0, count: 0 };
      bucket.saves += row.saves;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        avgSaves: data.count ? data.saves / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const commentVelocitySeries = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const comments =
          toNumber(p?.stats?.comments) ??
          toNumber((p as any)?.stats?.comment_count) ??
          0;
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { comments, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { comments: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { comments: 0, count: 0 };
      bucket.comments += row.comments;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        avgComments: data.count ? data.comments / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const discoveryStats = useMemo(() => {
    if (!followerMix.length) return null;
    const avgShare =
      followerMix.reduce((sum, p) => sum + (typeof p.nf === "number" ? p.nf : 0), 0) / followerMix.length;
    const avgVisits =
      followerMix.reduce((sum, p) => sum + (typeof p.profileVisits === "number" ? p.profileVisits : 0), 0) /
      followerMix.length;
    const peak = followerMix.slice().sort((a, b) => b.nf - a.nf)[0];
    return {
      avgShare,
      avgVisits,
      peakLabel: peak?.label,
      peakShare: peak?.nf,
    };
  }, [followerMix]);

  const objectiveLabel = OBJECTIVE_OPTIONS.find((option) => option.value === objectiveMode)?.label || "Engajamento";

  return (
    <>
      <main className="w-full pb-12 pt-8">
        <div className="dashboard-page-shell space-y-5">
          <header className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <LineChartIcon className="h-4 w-4" />
              Gráficos do planejamento
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Leituras com dados reais</h1>
            {isAdminViewer ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-md">
                  <CreatorQuickSearch
                    onSelect={(creator) => {
                      resetPaginationState();
                      setAdminTargetUser({
                        id: creator.id,
                        name: creator.name,
                        profilePictureUrl: creator.profilePictureUrl,
                      });
                    }}
                    selectedCreatorName={adminTargetUser?.name || null}
                    selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                    onClear={() => {
                      resetPaginationState();
                      setAdminTargetUser(null);
                    }}
                    apiPrefix="/api/admin"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {isActingOnBehalf
                    ? `Visualizando dados de ${adminTargetUser?.name}.`
                    : "Visualizando seus próprios dados."}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">Dados reais do período selecionado.</p>
                <div className="flex flex-wrap items-center gap-3">
                  {recommendationsFeatureEnabled ? (
                    <label htmlFor="objectiveMode" className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      Objetivo
                      <select
                        id="objectiveMode"
                        value={objectiveMode}
                        onChange={(e) => handleObjectiveModeChange(e.target.value as PlanningObjectiveMode)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {OBJECTIVE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label htmlFor="timePeriod" className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    Período
                    <select
                      id="timePeriod"
                      value={timePeriod}
                      onChange={(e) => handleTimePeriodChange(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </header>

          {recommendationsFeatureEnabled ? (
            <section className="grid gap-4">
              <article className={cardBase}>
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Direcionamento</p>
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">
                      Próximas ações para {objectiveLabel.toLowerCase()}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">3 ações diretas para a próxima semana.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-indigo-500" />
                    <button
                      type="button"
                      onClick={() => handleGoToPlanner("recommendations_card")}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Ir para planejamento
                    </button>
                  </div>
                </header>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {loadingBatch ? (
                    <p className="text-sm text-slate-500 md:col-span-3">Carregando recomendações...</p>
                  ) : recommendationActions.length === 0 ? (
                    <p className="text-sm text-slate-500 md:col-span-3">
                      Sem ação acionável agora. Mantenha cadência e reavalie após novos posts.
                    </p>
                  ) : (
                    recommendationActions.map((item) => (
                      <article key={item.id} className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{item.title}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900" style={twoLineClampStyle}>
                          {item.action}
                        </p>
                        <p className="mt-2 text-xs text-slate-600" style={twoLineClampStyle}>
                          {item.impactEstimate}
                        </p>
                        <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {confidencePillLabel[item.confidence]}
                        </span>
                        <button
                          type="button"
                          onClick={() => openRecommendationEvidence(item)}
                          className="mt-auto pt-3 text-left text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          Ver evidência
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </article>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Alcance x Interações</p>
                  <h2 className="text-base font-semibold text-slate-900">Evolução semanal</h2>
                </div>
                <Sparkles className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingTrend ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : trendSeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendSeries}
                      margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Alcance x Interações")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="reach"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <YAxis
                        yAxisId="interactions"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <Line yAxisId="reach" type="monotone" dataKey="reach" name="Alcance médio" stroke="#2563eb" strokeWidth={3} dot={false} />
                      <Line yAxisId="interactions" type="monotone" dataKey="interactions" name="Interações médias" stroke="#7c3aed" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Horário</p>
                  <h2 className="text-base font-semibold text-slate-900">Entrega média por hora</h2>
                  {bestHour !== null && (
                    <p className="text-xs text-emerald-700">Melhor janela recente: {bestHour}h</p>
                  )}
                </div>
                <Clock3 className="h-5 w-5 text-emerald-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingTime ? (
                  <p className="text-sm text-slate-500">Carregando horários...</p>
                ) : hourBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hourBars}
                      margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h) => `${h}h`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount;
                          return typeof postsCount === "number"
                            ? `${label}h • ${formatPostsCount(postsCount)}`
                            : `${label}h`;
                        }}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                      />
                      <Bar
                        dataKey="average"
                        name="Interações médias"
                        fill="#0ea5e9"
                        radius={[6, 6, 0, 0]}
                        onClick={({ payload }) => {
                          const hour = typeof payload?.hour === "number" ? payload.hour : null;
                          if (hour !== null) {
                            handleHourClick(hour, "Entrega média por hora");
                          }
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="top"
                          formatter={(value: number) => numberFormatter.format(Math.max(0, Math.round(value)))}
                          fill="#64748b"
                          fontSize={10}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duração do Vídeo (Real)</p>
                  <h2 className="text-base font-semibold text-slate-900">Quantidade de posts por faixa de duração real</h2>
                  {durationSummary.totalVideoPosts > 0 ? (
                    <p className="text-xs text-slate-500">
                      Cobertura de duração real: {(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos (
                      {numberFormatter.format(durationSummary.totalPostsWithDuration)}/
                      {numberFormatter.format(durationSummary.totalVideoPosts)}).
                    </p>
                  ) : null}
                </div>
                <Clock3 className="h-5 w-5 text-cyan-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingDuration ? (
                  <p className="text-sm text-slate-500">Carregando duração real...</p>
                ) : durationSummary.totalVideoPosts === 0 ? (
                  <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                ) : durationSummary.totalPostsWithDuration === 0 ? (
                  <p className="text-sm text-slate-500">
                    Os vídeos deste período ainda não possuem duração real (`video_duration_seconds`).
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationBuckets} margin={{ top: 20, right: 8, left: -6, bottom: 0 }} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label, payload: any[]) => {
                          const avg = payload?.[0]?.payload?.averageInteractions ?? 0;
                          return `${label} de duração real • ${numberFormatter.format(Math.round(avg))} interações médias`;
                        }}
                        formatter={(value: number) => [formatPostsCount(value), "Posts"]}
                      />
                      <Bar
                        dataKey="postsCount"
                        name="Posts"
                        fill="#06b6d4"
                        radius={[6, 6, 0, 0]}
                        onClick={({ payload }) => {
                          const bucketKey = payload?.key as DurationBucketKey | undefined;
                          if (bucketKey) handleDurationBucketClick(bucketKey, "Quantidade de posts por faixa de duração real");
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="top"
                          formatter={(value: number) => numberFormatter.format(Math.max(0, Math.round(value)))}
                          fill="#64748b"
                          fontSize={10}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duração Real x Interações</p>
                  <h2 className="text-base font-semibold text-slate-900">Interações médias por faixa de duração real</h2>
                  {bestDurationBucket ? (
                    <p className="text-xs text-emerald-700">
                      Melhor faixa recente: {bestDurationBucket.label} ({numberFormatter.format(Math.round(bestDurationBucket.averageInteractions))} interações médias).
                    </p>
                  ) : null}
                  {lowSampleDurationBuckets > 0 ? (
                    <p className="text-xs text-amber-700">
                      {lowSampleDurationBuckets} faixa(s) têm menos de 5 posts.
                    </p>
                  ) : null}
                </div>
                <LineChartIcon className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingDuration ? (
                  <p className="text-sm text-slate-500">Carregando duração real...</p>
                ) : durationSummary.totalVideoPosts === 0 ? (
                  <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                ) : durationSummary.totalPostsWithDuration === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados de duração real para calcular interações por faixa.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={durationBuckets}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => {
                        const label = state?.activeLabel ? String(state.activeLabel) : null;
                        if (!label) return;
                        const bucket = DURATION_BUCKETS.find((item) => item.label === label);
                        if (!bucket) return;
                        handleDurationBucketClick(bucket.key, "Interações médias por faixa de duração real");
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="posts"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <YAxis
                        yAxisId="interactions"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount ?? 0;
                          return `${label} de duração real • ${formatPostsCount(postsCount)}`;
                        }}
                        formatter={(value: number, name: string) =>
                          name === "postsCount"
                            ? [formatPostsCount(value), "Posts"]
                            : [numberFormatter.format(Math.round(value)), "Interações médias"]
                        }
                      />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        iconType="circle"
                        formatter={(value) => (value === "postsCount" ? "Posts" : "Interações médias")}
                      />
                      <Bar yAxisId="posts" dataKey="postsCount" name="postsCount" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                      <Line
                        yAxisId="interactions"
                        type="monotone"
                        dataKey="averageInteractions"
                        name="averageInteractions"
                        stroke="#7c3aed"
                        strokeWidth={3}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Salvamentos</p>
                  <h2 className="text-base font-semibold text-slate-900">Média de salvamentos por semana</h2>
                  <p className="text-xs text-slate-500">Quantidade média de salvamentos por post, agregada por semana.</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-rose-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : saveVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={saveVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Média de salvamentos por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Salvamentos médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Salvamentos médios"]}
                      />
                      <Line type="monotone" dataKey="avgSaves" name="Salvamentos médios" stroke="#ec4899" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Comentários</p>
                  <h2 className="text-base font-semibold text-slate-900">Média de comentários por semana</h2>
                  <p className="text-xs text-slate-500">Quantidade média de comentários por post, agregada por semana.</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : commentVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={commentVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Média de comentários por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Comentários médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Comentários médios"]}
                      />
                      <Line type="monotone" dataKey="avgComments" name="Comentários médios" stroke="#6366f1" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>

          <div ref={advancedSectionsSentinelRef} className="h-px w-full" />
          {showAdvancedSections ? (
            <>
          <section className="grid gap-4 md:grid-cols-2">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contexto</p>
                  <h2 className="text-base font-semibold text-slate-900">Interação média por contexto</h2>
                </div>
                <Target className="h-5 w-5 text-slate-600" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando contextos...</p>
                ) : contextBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem contextos registrados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={contextBars}
                      layout="vertical"
                      margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount;
                          return typeof postsCount === "number"
                            ? `${label} • ${formatPostsCount(postsCount)}`
                            : label;
                        }}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                      />
                      <Bar
                        dataKey="value"
                        name="Interações médias"
                        fill="#0ea5e9"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("context", value, "Interação média por contexto");
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="right"
                          formatter={(value: number) => formatPostsCount(value)}
                          fill="#64748b"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Proposta</p>
                  <h2 className="text-base font-semibold text-slate-900">Interação média por proposta</h2>
                </div>
                <Sparkles className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingProposal ? (
                  <p className="text-sm text-slate-500">Carregando propostas...</p>
                ) : proposalBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem propostas registradas no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={proposalBars}
                      layout="vertical"
                      margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount;
                          return typeof postsCount === "number"
                            ? `${label} • ${formatPostsCount(postsCount)}`
                            : label;
                        }}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                      />
                      <Bar
                        dataKey="value"
                        name="Interações médias"
                        fill="#6366f1"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("proposal", value, "Interação média por proposta");
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="right"
                          formatter={(value: number) => formatPostsCount(value)}
                          fill="#64748b"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tom</p>
                  <h2 className="text-base font-semibold text-slate-900">Interação média por tom</h2>
                </div>
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingTone ? (
                  <p className="text-sm text-slate-500">Carregando tons...</p>
                ) : toneBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem tons registrados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={toneBars}
                      layout="vertical"
                      margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount;
                          return typeof postsCount === "number"
                            ? `${label} • ${formatPostsCount(postsCount)}`
                            : label;
                        }}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                      />
                      <Bar
                        dataKey="value"
                        name="Interações médias"
                        fill="#10b981"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("tone", value, "Interação média por tom");
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="right"
                          formatter={(value: number) => formatPostsCount(value)}
                          fill="#64748b"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Referência</p>
                  <h2 className="text-base font-semibold text-slate-900">Interação média por referência</h2>
                </div>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingReference ? (
                  <p className="text-sm text-slate-500">Carregando referências...</p>
                ) : referenceBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem referências registradas no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={referenceBars}
                      layout="vertical"
                      margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount;
                          return typeof postsCount === "number"
                            ? `${label} • ${formatPostsCount(postsCount)}`
                            : label;
                        }}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                      />
                      <Bar
                        dataKey="value"
                        name="Interações médias"
                        fill="#f59e0b"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("references", value, "Interação média por referência");
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="right"
                          formatter={(value: number) => formatPostsCount(value)}
                          fill="#64748b"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Heatmap</p>
                  <h2 className="text-base font-semibold text-slate-900">Melhores janelas por dia e hora</h2>
                  <p className="text-xs text-slate-500">Quanto mais escuro, mais interações médias.</p>
                </div>
                <Clock3 className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4">
                {loadingTime ? (
                  <p className="text-sm text-slate-500">Carregando heatmap...</p>
                ) : heatmap.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados para montar o heatmap.</p>
                ) : (
                  <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500">
                    <div />
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="text-center">{`${idx * 4}h`}</div>
                    ))}
                    {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                      <React.Fragment key={dow}>
                        <div className="pr-2 text-right">{WEEKDAY_SHORT_SUN_FIRST[dow - 1] || `Dia ${dow}`}</div>
                        {Array.from({ length: 6 }).map((_, hIdx) => {
                          const h = hIdx * 4;
                          const startHour = h;
                          const endHour = Math.min(h + 3, 23);
                          const windowPoints = heatmap.filter((curr) => curr.day === dow && curr.hour >= startHour && curr.hour <= endHour);
                          const score = windowPoints.length
                            ? windowPoints.reduce((sum, curr) => sum + curr.score, 0) / windowPoints.length
                            : 0;
                          const bg = `rgba(14,165,233,${0.12 + score * 0.6})`;
                          return (
                            <button
                              key={hIdx}
                              type="button"
                              className="aspect-square rounded border border-slate-100 transition hover:border-slate-300"
                              style={{ background: bg }}
                              onClick={() => handleDayHourClick(dow, startHour, endHour, "Heatmap de janelas")}
                              aria-label={`Posts em ${WEEKDAY_LONG_SUN_FIRST[dow - 1] || `Dia ${dow}`} entre ${startHour}h e ${endHour}h`}
                            />
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Formato</p>
                  <h2 className="text-base font-semibold text-slate-900">Distribuição de interações</h2>
                </div>
                <LineChartIcon className="h-5 w-5 text-amber-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingFormat ? (
                  <p className="text-sm text-slate-500">Carregando formatos...</p>
                ) : formatBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados de formato neste período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={formatBars}
                      margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações"]}
                      />
                      <Bar
                        dataKey="value"
                        name="Interações"
                        fill="#f97316"
                        radius={[6, 6, 0, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("format", value, "Distribuição de interações");
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Consistência</p>
                  <h2 className="text-base font-semibold text-slate-900">Posts por semana vs. média de interações</h2>
                </div>
                <LineChartIcon className="h-5 w-5 text-emerald-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando consistência...</p>
                ) : weeklyConsistency.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem posts suficientes no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyConsistency}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Posts por semana vs. média de interações")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Posts", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Interações médias", angle: 90, position: "insideRight", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => `Semana ${formatWeekLabel(String(label)).replace(/\sW/, " W")}`}
                        formatter={(value: number, name) => [
                          numberFormatter.format(Math.round(value)),
                          name === "posts" ? "Posts/semana" : "Média de interações",
                        ]}
                      />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        iconType="circle"
                        formatter={(value) => (value === "posts" ? "Posts/semana" : "Média de interações")}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="posts" name="posts" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgInteractions"
                        name="avgInteractions"
                        stroke="#a855f7"
                        strokeWidth={3}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Profundidade</p>
                  <h2 className="text-base font-semibold text-slate-900">Salvos e compartilhamentos a cada 1.000 de alcance</h2>
                  <p className="text-xs text-slate-500">Quanto cada formato gera de profundidade ajustada por alcance.</p>
                </div>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando engajamento profundo...</p>
                ) : deepEngagement.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados de salvos/compartilhamentos no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={deepEngagement}
                      layout="vertical"
                      margin={{ top: 6, right: 12, left: 40, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="format"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string, { payload }: any) => {
                          const perK = (value || 0).toFixed(2);
                          const count = payload?.postsCount ?? 0;
                          if (name === "savesPerThousand") {
                            return [`${perK} por 1.000 de alcance · ${count} posts`, "Salvos"];
                          }
                          if (name === "sharesPerThousand") {
                            return [`${perK} por 1.000 de alcance · ${count} posts`, "Compartilhamentos"];
                          }
                          return [`${perK}`, name];
                        }}
                      />
                      <Bar
                        dataKey="savesPerThousand"
                        name="Salvos"
                        stackId="depth"
                        fill="#22c55e"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.format ? String(payload.format) : null;
                          if (value) handleCategoryClick("format", value, "Salvos e compartilhamentos por formato");
                        }}
                      />
                      <Bar
                        dataKey="sharesPerThousand"
                        name="Compartilhamentos"
                        stackId="depth"
                        fill="#0ea5e9"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.format ? String(payload.format) : null;
                          if (value) handleCategoryClick("format", value, "Salvos e compartilhamentos por formato");
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Engajamento</p>
                  <h2 className="text-base font-semibold text-slate-900">Taxa média de engajamento por semana</h2>
                  <p className="text-xs text-slate-500">Interações / alcance por semana.</p>
                </div>
                <Sparkles className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : weeklyEngagementRate.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyEngagementRate}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Taxa média de engajamento por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "Taxa de engajamento (interações/alcance)"]}
                      />
                      <Line type="monotone" dataKey="avgRate" name="Engajamento semanal" stroke="#7c3aed" strokeWidth={3} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Propagação</p>
                  <h2 className="text-base font-semibold text-slate-900">Compartilhamentos x Visitas</h2>
                  <p className="text-xs text-slate-500">Veja se os shares estão puxando visitas ao perfil.</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-slate-600" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : shareVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={shareVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Compartilhamentos x Visitas")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number, name) =>
                          name === "shares"
                            ? [numberFormatter.format(Math.round(value)), "Compartilhamentos"]
                            : [numberFormatter.format(Math.round(value)), "Visitas ao perfil"]
                        }
                      />
                      <Line yAxisId="left" type="monotone" dataKey="shares" name="Compartilhamentos" stroke="#f97316" strokeWidth={3} dot />
                      <Line yAxisId="right" type="monotone" dataKey="visits" name="Visitas ao perfil" stroke="#0ea5e9" strokeWidth={3} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>



          <section className={cardBase}>
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Top descoberta</p>
                <h3 className="text-base font-semibold text-slate-900">Posts que mais puxam não seguidores</h3>
                <p className="text-xs text-slate-500">Ordenados pelo maior share de não seguidores (ou visitas/reach).</p>
              </div>
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </header>
            {loadingPosts ? (
              <p className="text-sm text-slate-500 mt-3">Carregando lista...</p>
            ) : (
              <TopDiscoveryTable posts={topDiscovery} isLoading={loadingPosts} />
            )}
          </section>
            </>
          ) : (
            <section className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((index) => (
                <article key={index} className={cardBase}>
                  <div className="h-[340px] animate-pulse rounded-xl bg-slate-100/80" />
                </article>
              ))}
            </section>
          )}
        </div>
      </main>
      <Drawer
        open={Boolean(selectedRecommendation)}
        onClose={closeRecommendationEvidence}
        title={selectedRecommendation ? `Evidência — ${selectedRecommendation.title}` : "Evidência"}
      >
        {selectedRecommendation ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ação sugerida</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecommendation.action}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Impacto estimado</p>
              <p className="mt-1 text-sm text-slate-700">{selectedRecommendation.impactEstimate}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confiança</p>
              <p className="mt-1 text-sm text-slate-700">{confidenceLabel[selectedRecommendation.confidence]}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidência</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {selectedRecommendation.evidence.map((item, index) => (
                  <li key={`${selectedRecommendation.id}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleGoToPlanner("recommendation_drawer")}
                className="text-sm font-semibold text-indigo-600 underline-offset-2 hover:underline"
              >
                Abrir planejamento
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
      {sliceModal.open ? (
        <PostsBySliceModal
          isOpen={sliceModal.open}
          title={sliceModal.title}
          subtitle={sliceModal.subtitle}
          posts={sliceModal.posts}
          enableMetricSort
          onClose={closeSliceModal}
          onPlayClick={handlePlayVideo}
        />
      ) : null}

      {isVideoPlayerOpen ? (
        <DiscoverVideoModal
          open={isVideoPlayerOpen}
          onClose={() => setIsVideoPlayerOpen(false)}
          videoUrl={selectedVideoForPlayer?.mediaUrl || selectedVideoForPlayer?.media_url || undefined}
          posterUrl={selectedVideoForPlayer?.thumbnailUrl || selectedVideoForPlayer?.coverUrl || undefined}
          postLink={selectedVideoForPlayer?.permalink || undefined}
        />
      ) : null}
    </>

  );
}
