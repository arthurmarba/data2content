"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Calendar as CalendarIcon, CheckCircle2, ChevronDown as ChevronDownIcon, Clock3, Copy, Filter as FilterIcon, LineChart as LineChartIcon, Search, Sparkles, Target, Users, Zap as ZapIcon } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import Board from "@/app/dashboard/components/Board";
import BoardPinButton from "@/app/dashboard/boards/BoardPinButton";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import useBoardMobileViewport from "@/app/dashboard/hooks/useBoardMobileViewport";
import { track } from "@/lib/track";
import {
  CATEGORY_RANKING_LIMIT,
  limitCategoryBars,
  mergeCategoryBars,
  shouldSupplementCategoryBars,
} from "@/app/lib/planning/categoryRankingUtils";
import {
  resolveRecommendationExecutionState,
  resolveRecommendationQueueStage,
  type PlanningRecommendationExecutionState,
  type PlanningRecommendationQueueStage,
} from "@/utils/buildPlanningRecommendations";
import { normalizePlanningPost } from "@/app/lib/planning/normalizePlanningPost";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { CompactMetricSectionItem } from "./PlanningChartsCompactMetricSection";
import type { MobileBarListItem } from "./PlanningChartsSharedUi";

type ProfileAnalysisDemoData = typeof import("./profileAnalysisDemoData").PROFILE_ANALYSIS_DEMO_DATA;

const PostsBySliceModal = dynamic(() => import("./components/PostsBySliceModal"), {
  ssr: false,
  loading: () => null,
});
const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  {
    ssr: false,
    loading: () => null,
  },
);
const DiscoverVideoModal = dynamic(() => import("@/app/discover/components/DiscoverVideoModal"), {
  ssr: false,
  loading: () => null,
});
const UserAvatar = dynamic(() => import("@/app/components/UserAvatar").then((mod) => mod.UserAvatar), {
  ssr: false,
  loading: () => <div className="h-11 w-11 rounded-full bg-slate-100" />,
});
const PlanningContentDesktopSection = dynamic(
  () => import("./PlanningChartsHeavySections").then((mod) => mod.PlanningContentDesktopSection),
  {
    ssr: false,
    loading: () => null,
  },
);
const PlanningFormatDesktopSection = dynamic(
  () => import("./PlanningChartsHeavySections").then((mod) => mod.PlanningFormatDesktopSection),
  {
    ssr: false,
    loading: () => null,
  },
);
const PlanningChartsAudienceTabSection = dynamic(
  () => import("./PlanningChartsAudienceTabSection"),
  {
    ssr: false,
    loading: () => null,
  },
);
const PlanningChartsDirectioningSection = dynamic(
  () =>
    import("./PlanningChartsDirectioningSection").then((mod) => mod.PlanningChartsDirectioningSection),
  {
    ssr: false,
    loading: () => null,
  },
);
const ProfileAnalysisFunnelOverlay = dynamic(
  () => import("./components/ProfileAnalysisFunnelOverlay"),
  {
    ssr: false,
    loading: () => null,
  },
);
const PlanningChartsStrategicHeroCard = dynamic(
  () =>
    import("./PlanningChartsStrategicHeroCard").then((mod) => mod.PlanningChartsStrategicHeroCard),
  {
    ssr: false,
    loading: () => null,
  },
);
const PlanningChartsRecommendationDrawer = dynamic(
  () =>
    import("./PlanningChartsRecommendationDrawer").then((mod) => mod.PlanningChartsRecommendationDrawer),
  {
    ssr: false,
    loading: () => null,
  },
);
const PlanningChartsCompactMetricSection = dynamic(
  () =>
    import("./PlanningChartsCompactMetricSection").then((mod) => mod.PlanningChartsCompactMetricSection),
  {
    ssr: false,
    loading: () => null,
  },
);

const cardBase = "dashboard-panel min-w-0 overflow-hidden rounded-[1.75rem] px-3.5 py-3.5 sm:px-4 sm:py-4";
const formatCardBase = "min-w-0 overflow-hidden rounded-[1.75rem] border border-zinc-100/90 bg-zinc-50/68 px-3.5 py-3.5 sm:px-4 sm:py-4";
const audienceCardBase = "min-w-0 overflow-hidden rounded-[1.75rem] border border-zinc-100/90 bg-zinc-50/68 px-3.5 py-3.5 sm:px-4 sm:py-4";
const tooltipStyle = { borderRadius: 18, border: "1px solid rgba(228,228,231,0.88)", boxShadow: "0 18px 44px rgba(15,23,42,0.12)", backdropFilter: "blur(14px)" };
const DEFAULT_TIME_PERIOD = "last_90_days";
const PERIOD_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Últimos 7 dias", value: "last_7_days" },
  { label: "Últimos 14 dias", value: "last_14_days" },
  { label: "Últimos 30 dias", value: "last_30_days" },
  { label: "Últimos 60 dias", value: "last_60_days" },
  { label: "Últimos 90 dias", value: "last_90_days" },
  { label: "Últimos 120 dias", value: "last_120_days" },
  { label: "Últimos 180 dias", value: "last_180_days" },
  { label: "Últimos 12 meses", value: "last_12_months" },
  { label: "Todo histórico", value: "all_time" },
];
const AUTO_PREFETCH_PAGE_CAP_BY_PERIOD: Record<string, number> = {
  last_7_days: 1,
  last_14_days: 1,
  last_30_days: 1,
  last_60_days: 2,
  last_90_days: 2,
  last_120_days: 3,
  last_180_days: 4,
  last_12_months: 4,
  all_time: 4,
};
const metricCellClass = "text-right tabular-nums font-semibold text-zinc-900";
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
const shortDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
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
const formatShortDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return shortDateTimeFormatter.format(parsed);
};

function canAutoPrefetchPlanningPosts(isCompactBoard: boolean) {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return !isCompactBoard;
  }

  if (isCompactBoard) return false;
  if (navigator.onLine === false) return false;

  const navConnection = (navigator as {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
    deviceMemory?: number;
  }).connection;

  if (navConnection?.saveData) return false;

  const effectiveType = String(navConnection?.effectiveType || "").toLowerCase();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") {
    return false;
  }

  const deviceMemory = Number((navigator as { deviceMemory?: number }).deviceMemory);
  if (Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2) {
    return false;
  }

  return true;
}

type PlanningObjectiveMode = "reach" | "engagement" | "leads";
type PlanningRecommendationAction = {
  id: string;
  feedbackKey?: string | null;
  title: string;
  action: string;
  strategicSynopsis?: string;
  recommendationType?: "maintain" | "scale" | "correct" | "test";
  observation?: string;
  meaning?: string;
  nextStep?: string;
  whatNotToDo?: string | null;
  metricLabel?: string | null;
  timeWindowLabel?: string | null;
  isProxyMetric?: boolean;
  impactEstimate: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  sampleSize?: number | null;
  expectedLiftRatio?: number | null;
  opportunityScore?: number | null;
  rankingScore?: number | null;
  signalQuality?: "high_signal" | "medium_signal" | "low_signal";
  guardrailReason?: string | null;
  experimentPlan?: {
    hypothesis: string;
    baseline: string;
    successSignal: string;
    sampleGoal: string;
  } | null;
  experimentImpact?: ExperimentImpactSummary | null;
  feedbackStatus?: RecommendationFeedbackStatus | null;
  queueStage?: PlanningRecommendationQueueStage;
  executionState?: PlanningRecommendationExecutionState;
  feedbackUpdatedAt?: string | null;
};
type RecommendationFeedbackStatus = "applied" | "not_applied";
type RecommendationActionView = PlanningRecommendationAction & {
  confidenceAdjusted: PlanningRecommendationAction["confidence"];
  sampleSize: number | null;
  hasLowSampleGuardrail: boolean;
  opportunityScore: number;
  rankingScore: number;
  feedbackStatus: RecommendationFeedbackStatus | null;
  queueStage: PlanningRecommendationQueueStage;
  executionState: PlanningRecommendationExecutionState;
  feedbackUpdatedAt?: string | null;
};
type ExperimentImpactSummary = {
  status: "improved" | "declined" | "stable" | "early" | "awaiting_posts" | "insufficient_history";
  text: string;
  beforeAvg: number | null;
  afterAvg: number | null;
  deltaRatio: number | null;
  beforeCount: number;
  afterCount: number;
};
type DirectioningSummary = {
  headline?: string;
  priorityLabel?: string;
  priorityState?: PlanningRecommendationAction["recommendationType"];
  primarySignal?: {
    text?: string;
    tone?: ExecutiveDeltaTone;
    metricLabel?: string;
  };
  confidence?: {
    label?: string;
    description?: string;
  };
  comparison?: {
    narrative?: string;
    tone?: ExecutiveDeltaTone;
    currentLabel?: string;
    previousLabel?: string;
  };
  compositeConfidence?: {
    level?: "high" | "medium" | "low";
    label?: string;
    score?: number;
    summary?: string;
    factors?: Array<{
      label: string;
      status: "strong" | "moderate" | "weak";
      text: string;
    }>;
  };
  experimentFocus?: {
    hypothesis: string;
    baseline: string;
    successSignal: string;
    sampleGoal: string;
  } | null;
  baseDescription?: string;
  proxyDisclosure?: string | null;
  noGoLine?: string;
  cards?: Array<{ title: string; body: string }>;
};
const OBJECTIVE_OPTIONS: Array<{ value: PlanningObjectiveMode; label: string }> = [
  { value: "engagement", label: "Engajamento" },
  { value: "reach", label: "Alcance" },
  { value: "leads", label: "Leads" },
];
const confidenceLabel: Record<PlanningRecommendationAction["confidence"], string> = {
  high: "mais confiável",
  medium: "direção útil",
  low: "sinal inicial",
};
const feedbackStatusLabel: Record<RecommendationFeedbackStatus, string> = {
  applied: "Fiz isso",
  not_applied: "Não agora",
};
const feedbackStatusCompactLabel: Record<RecommendationFeedbackStatus, string> = {
  applied: "Feito",
  not_applied: "Adiado",
};
const queueStageLabel: Record<PlanningRecommendationQueueStage, string> = {
  now: "Agora",
  later: "Depois",
  monitor: "Esperar",
};
const queueStageClassName: Record<PlanningRecommendationQueueStage, string> = {
  now: "border-zinc-900 bg-zinc-900 text-white",
  later: "border-pink-200 bg-pink-50 text-pink-600",
  monitor: "border-zinc-200 bg-zinc-50 text-zinc-500",
};
const executionStateLabel: Record<PlanningRecommendationExecutionState, string> = {
  planned: "Pendente",
  executed: "Feito",
  waiting_impact: "Esperando resultado",
  discarded: "Descartado",
};
const recommendationTypeLabel: Record<NonNullable<PlanningRecommendationAction["recommendationType"]>, string> = {
  maintain: "Repita",
  scale: "Aumentar",
  correct: "Ajuste",
  test: "Teste",
};
const RECOMMENDATION_TITLE_OVERRIDES: Record<string, string> = {
  duration: "Duração ideal",
  time_slot: "Melhor horário",
  tone_engagement: "Tom que mais funciona",
  proposal_engagement: "Proposta que mais funciona",
  format_reach: "Formato que mais funciona",
  context_reach: "Tema que mais funciona",
  proposal_leads: "Proposta com mais intenção",
  context_leads: "Tema com mais intenção",
  trend_recovery: "Voltar a crescer",
  trend_scale: "Aumentar o que funciona",
  trend_stability: "Manter o ritmo",
  baseline: "Montar base inicial",
};
const compactImpactEstimate = (impactEstimate: string) => {
  const normalized = String(impactEstimate || "").trim();
  if (!normalized) return "Sem estimativa";

  const percentMatch = normalized.match(/[+\-]?\d[\d.,]*%/);
  if (percentMatch) return `${percentMatch[0]} estimado`;

  if (/interações médias/i.test(normalized)) {
    const numberMatch = normalized.match(/[+\-]?\d[\d.,]*/);
    if (numberMatch) return `${numberMatch[0]} interações médias`;
  }

  return normalized.replace(/\.$/, "");
};
const formatExpectedResult = (impactEstimate: string) => {
  const normalized = String(impactEstimate || "").trim();
  if (!normalized) return "Melhora neste indicador";
  const percentMatch = normalized.match(/[+\-]?\d[\d.,]*%/);
  if (percentMatch) {
    return `Variação estimada de ${percentMatch[0]}`;
  }
  const interactionsMatch = normalized.match(/([+\-]?\d[\d.,]*)\s*intera/i);
  if (interactionsMatch?.[1]) {
    return `Cerca de ${interactionsMatch[1]} interações por post`;
  }
  return compactImpactEstimate(normalized);
};
const formatSampleBaseText = (sampleSize: number | null | undefined) => {
  if (typeof sampleSize === "number" && sampleSize > 0) {
    return `${formatPostsCount(sampleSize)} publicações analisadas`;
  }
  return "Poucos dados (fase de descoberta)";
};
const formatGuardrailText = (guardrailReason: string | null | undefined) => {
  const normalized = String(guardrailReason || "").trim();
  if (!normalized) return "Trate como teste curto e confirme nos próximos posts.";
  return normalized
    .replace(/amostra/gi, "base")
    .replace(/potencial/gi, "estimativa")
    .replace(/confiança/gi, "sinal")
    .replace(/tendência/gi, "padrão");
};
const simplifyEvidenceText = (text: string) =>
  String(text || "")
    .replace(/amostra/gi, "base")
    .replace(/potencial/gi, "estimativa")
    .replace(/confiança/gi, "sinal")
    .replace(/interações médias/gi, "interações por post")
    .replace(/engajamento/gi, "resposta")
    .replace(/alcance/gi, "pessoas alcançadas")
    .replace(/grupo líder/gi, "grupo que mais funcionou")
    .replace(/suavizaç[aã]o/gi, "ajuste de segurança")
    .replace(/estabilidade do ranking/gi, "comparação justa")
    .replace(/ranking/gi, "ordem de desempenho");
const recommendationTypeFallback = (
  value: PlanningRecommendationAction["recommendationType"] | undefined
): NonNullable<PlanningRecommendationAction["recommendationType"]> => value || "test";
const buildRecommendationMetaLine = ({
  recommendationType,
  executionState,
  feedbackStatus,
  feedbackUpdatedAt,
}: {
  recommendationType?: PlanningRecommendationAction["recommendationType"] | null;
  executionState?: PlanningRecommendationExecutionState | null;
  feedbackStatus?: RecommendationFeedbackStatus | null;
  feedbackUpdatedAt?: string | null;
}) => {
  const parts = [
    recommendationTypeLabel[recommendationTypeFallback(recommendationType || undefined)],
    executionStateLabel[executionState || "planned"],
  ];
  if (feedbackStatus) parts.push(feedbackStatusCompactLabel[feedbackStatus]);
  const formattedFeedbackDate = formatShortDateTime(feedbackUpdatedAt || undefined);
  if (formattedFeedbackDate) parts.push(`Atualizado ${formattedFeedbackDate}`);
  return parts.join(" • ");
};
const extractImpactSignal = (impactEstimate: string): number => {
  const normalized = String(impactEstimate || "").trim();
  if (!normalized) return 0.3;

  const percentMatch = normalized.match(/([+\-]?\d[\d.,]*)%/);
  if (percentMatch?.[1]) {
    const raw = Number(percentMatch[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(raw)) return Math.min(Math.abs(raw) / 100, 1.4);
  }

  const interactionsMatch = normalized.match(/([+\-]?\d[\d.,]*)\s*intera/i);
  if (interactionsMatch?.[1]) {
    const raw = Number(interactionsMatch[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(raw)) return Math.min(Math.abs(raw) / 5000, 1.2);
  }

  return 0.35;
};
const getSampleWeight = (sampleSize: number | null): number => {
  if (typeof sampleSize !== "number" || !Number.isFinite(sampleSize) || sampleSize <= 0) return 0.4;
  if (sampleSize >= 15) return 1;
  if (sampleSize >= 8) return 0.85;
  if (sampleSize >= 5) return 0.7;
  if (sampleSize >= 3) return 0.5;
  return 0.35;
};
const confidenceScoreMap: Record<PlanningRecommendationAction["confidence"], number> = {
  high: 1,
  medium: 0.72,
  low: 0.45,
};
const feedbackRankingWeight = (status: RecommendationFeedbackStatus | null): number => {
  if (status === "applied") return 0.62;
  if (status === "not_applied") return 1.14;
  return 1;
};
type DeltaInsight = {
  deltaRatio: number;
  recentAvg: number;
  previousAvg: number;
};
type ExecutiveDeltaTone = "positive" | "neutral" | "negative" | "warning";
type ExecutiveDeltaSummary = { text: string; tone: ExecutiveDeltaTone };
const buildPeriodDelta = <T,>(rows: T[], readValue: (row: T) => number | null, minPoints = 4): DeltaInsight | null => {
  if (!Array.isArray(rows) || rows.length < minPoints) return null;
  const values = rows
    .map((row) => readValue(row))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  if (values.length < minPoints) return null;

  const windowSize = Math.max(2, Math.floor(values.length / 2));
  if (values.length < windowSize * 2) return null;
  const previousSlice = values.slice(values.length - windowSize * 2, values.length - windowSize);
  const recentSlice = values.slice(values.length - windowSize);
  if (!previousSlice.length || !recentSlice.length) return null;

  const previousAvg = previousSlice.reduce((sum, value) => sum + value, 0) / previousSlice.length;
  const recentAvg = recentSlice.reduce((sum, value) => sum + value, 0) / recentSlice.length;
  if (!Number.isFinite(previousAvg) || previousAvg <= 0 || !Number.isFinite(recentAvg)) return null;

  return {
    deltaRatio: (recentAvg - previousAvg) / previousAvg,
    recentAvg,
    previousAvg,
  };
};
const deltaToneClassMap: Record<ExecutiveDeltaTone, string> = {
  positive: "text-emerald-700",
  neutral: "text-slate-500",
  negative: "text-amber-700",
  warning: "text-amber-700",
};

type ActiveChartTab = "content" | "format" | "audience" | "directioning";

const CHART_TABS = [
  { id: "content", label: "O que postar" },
  { id: "format", label: "Hora/Tempo" },
  { id: "audience", label: "Meus Conteúdos" },
  { id: "directioning", label: "Próximo passo" },
];

const buildCategoryExecutiveSummary = (
  rows: Array<{ name: string; value: number; postsCount?: number }>,
  dimensionLabel: string
): ExecutiveDeltaSummary => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { text: `Sem base suficiente para leitura por ${dimensionLabel}.`, tone: "warning" };
  }

  const top = rows[0];
  const runnerUp = rows[1];
  const topName = String(top?.name || "grupo líder");
  const topValue = toNumber(top?.value) ?? 0;
  const sampleSize = typeof top?.postsCount === "number" && Number.isFinite(top.postsCount) ? top.postsCount : null;

  if (typeof sampleSize === "number" && sampleSize > 0 && sampleSize < 5) {
    return {
      text: `Base pequena: ${topName} lidera em ${dimensionLabel} com ${formatPostsCount(sampleSize)}.`,
      tone: "warning",
    };
  }

  if (!runnerUp) {
    return {
      text: `Estável: ${topName} é a principal referência em ${dimensionLabel}.`,
      tone: "neutral",
    };
  }

  const runnerUpValue = toNumber(runnerUp.value) ?? 0;
  if (!runnerUpValue || runnerUpValue <= 0 || topValue <= 0) {
    return {
      text: `Estável: ${topName} lidera em ${dimensionLabel}.`,
      tone: "neutral",
    };
  }

  const deltaRatio = (topValue - runnerUpValue) / runnerUpValue;
  const pct = Math.round(deltaRatio * 100);
  if (pct >= 5) {
    return {
      text: `Em alta: ${topName} lidera ${dimensionLabel} com +${pct}% vs 2º lugar.`,
      tone: "positive",
    };
  }
  return {
    text: `Estável: ${topName} lidera ${dimensionLabel} sem distância relevante.`,
    tone: "neutral",
  };
};
const buildHeatmapExecutiveSummary = (rows: Array<{ day: number; hour: number; score: number }>): ExecutiveDeltaSummary => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { text: "Ainda faltam dados para indicar melhor horário.", tone: "warning" };
  }

  const windowMap = new Map<string, { day: number; startHour: number; endHour: number; scoreSum: number; count: number }>();
  rows.forEach((row) => {
    const day = toNumber(row?.day);
    const hour = toNumber(row?.hour);
    const score = toNumber(row?.score);
    if (day === null || hour === null || score === null) return;
    const startHour = Math.floor(hour / 4) * 4;
    const endHour = Math.min(startHour + 3, 23);
    const key = `${day}-${startHour}`;
    const current = windowMap.get(key) || { day, startHour, endHour, scoreSum: 0, count: 0 };
    current.scoreSum += score;
    current.count += 1;
    windowMap.set(key, current);
  });

  const windows = Array.from(windowMap.values())
    .map((window) => ({
      ...window,
      avgScore: window.count > 0 ? window.scoreSum / window.count : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
  const top = windows[0];
  if (!top) return { text: "Ainda não apareceu um horário claramente melhor.", tone: "neutral" };

  const runnerUp = windows[1];
  const dayLabel = WEEKDAY_SHORT_SUN_FIRST[top.day - 1] || `Dia ${top.day}`;
  const windowLabel = `${dayLabel} ${top.startHour}h-${top.endHour}h`;

  if (top.avgScore < 0.35) {
    return { text: "Sem horário claramente dominante nas últimas semanas.", tone: "neutral" };
  }
  if (!runnerUp || runnerUp.avgScore <= 0) {
    return { text: `Melhor janela recente: ${windowLabel}.`, tone: "positive" };
  }

  const dominancePct = Math.round(((top.avgScore - runnerUp.avgScore) / runnerUp.avgScore) * 100);
  if (dominancePct >= 12) {
    return { text: `Melhor janela recente: ${windowLabel} (+${dominancePct}% vs próxima faixa).`, tone: "positive" };
  }
  return { text: `${windowLabel} está na frente, mas por margem curta.`, tone: "neutral" };
};
const buildConsistencyExecutiveSummary = (
  rows: Array<{ posts: number; avgInteractions: number }>
): ExecutiveDeltaSummary => {
  if (!Array.isArray(rows) || rows.length < 3) {
    return { text: "Ainda faltam dados para avaliar ritmo.", tone: "warning" };
  }

  const postsSeries = rows.map((row) => Math.max(0, toNumber(row?.posts) ?? 0));
  const avgPosts = postsSeries.reduce((sum, value) => sum + value, 0) / postsSeries.length;
  if (avgPosts <= 0) return { text: "Sem frequência suficiente para avaliar ritmo.", tone: "warning" };

  const variance = postsSeries.reduce((sum, value) => sum + (value - avgPosts) ** 2, 0) / postsSeries.length;
  const std = Math.sqrt(Math.max(variance, 0));
  const cv = std / avgPosts;

  const delta = buildPeriodDelta(rows, (row) => toNumber((row as any)?.avgInteractions), 3);
  if (cv > 0.45) {
    return {
      text: `Atenção: frequência irregular (${numberFormatter.format(Math.round(avgPosts))} posts por semana).`,
      tone: "negative",
    };
  }
  if (delta && delta.deltaRatio > 0.05) {
    return {
      text: "Boa evolução: ritmo estável e resposta por post subindo.",
      tone: "positive",
    };
  }
  if (delta && delta.deltaRatio < -0.05) {
    return {
      text: "Atenção: ritmo estável, mas resposta por post caiu.",
      tone: "negative",
    };
  }
  return {
    text: `Ritmo estável de ${numberFormatter.format(Math.round(avgPosts))} posts por semana.`,
    tone: "neutral",
  };
};
const getStrongestLeader = (
  entries: Array<{
    dimension: string;
    rows: CategoryBarDatum[];
    tone: ExecutiveDeltaTone;
  }>
) => {
  const ranked = entries
    .map((entry) => ({
      ...entry,
      top: entry.rows[0],
    }))
    .filter((entry) => entry.top?.name && typeof entry.top?.value === "number")
    .sort((a, b) => (b.top?.value || 0) - (a.top?.value || 0));
  return ranked[0] || null;
};
const getContentDimensionLabel = (dimension?: string | null): string => {
  switch (dimension) {
    case "contexto":
      return "contexto";
    case "proposta":
      return "proposta";
    case "tom":
      return "tom";
    case "intenção":
      return "intenção";
    case "narrativa":
      return "narrativa";
    case "postura":
      return "postura";
    case "prova":
      return "prova";
    case "sinal":
      return "sinal";
    case "modo comercial":
      return "modo comercial";
    default:
      return "leitura";
  }
};
const getContentLeaderMeaning = (dimension: string | undefined, leaderName: string): string => {
  switch (dimension) {
    case "contexto":
      return `${leaderName} é o tema que mais puxa resposta.`;
    case "proposta":
      return `${leaderName} é a proposta que mais funciona.`;
    case "tom":
      return `${leaderName} é o tom que mais funciona.`;
    case "intenção":
      return `${leaderName} é o objetivo que mais funciona.`;
    case "narrativa":
      return `${leaderName} é o jeito de contar que mais funciona.`;
    case "postura":
      return `${leaderName} é a postura que mais sustenta o post.`;
    case "prova":
      return `${leaderName} é a prova que mais convence.`;
    case "sinal":
      return `${leaderName} aparece bastante, mas não deve guiar a ideia sozinho.`;
    case "modo comercial":
      return `${leaderName} é a forma de venda que mais aparece nos melhores posts.`;
    default:
      return `${leaderName} é o sinal mais forte agora.`;
  }
};
const getContentLeaderAction = (dimension: string | undefined, leaderName: string): string => {
  switch (dimension) {
    case "contexto":
      return `Repita ${leaderName} por 2 ou 3 posts.`;
    case "proposta":
      return `Repita ${leaderName} por 2 ou 3 posts.`;
    case "tom":
      return `Use ${leaderName} em sequência e compare com uma opção só.`;
    case "intenção":
      return `Segure ${leaderName} por alguns posts.`;
    case "narrativa":
      return `Repita ${leaderName} por 2 ou 3 posts.`;
    case "postura":
      return `Use ${leaderName} em sequência por alguns posts.`;
    case "prova":
      return `Repita ${leaderName} antes de trocar a prova.`;
    default:
      return `Repita ${leaderName} por alguns posts.`;
  }
};
const getContentLeaderStatusChip = (dimension?: string | null): string => {
  switch (dimension) {
    case "contexto":
      return "Tema";
    case "proposta":
      return "Proposta";
    case "tom":
      return "Tom";
    case "intenção":
      return "Intenção";
    case "narrativa":
      return "Narrativa";
    case "postura":
      return "Postura";
    case "prova":
      return "Prova";
    case "sinal":
      return "Sinal";
    case "modo comercial":
      return "Comercial";
    default:
      return "Conteúdo";
  }
};
const formatActionSample = (postsCount?: number) => {
  if (typeof postsCount !== "number" || !Number.isFinite(postsCount) || postsCount <= 0) return null;
  return `${formatPostsCount(postsCount)} na base`;
};
const medianOfNumbers = (values: number[]): number => {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1] ?? 0;
    const right = sorted[middle] ?? left;
    return (left + right) / 2;
  }
  return sorted[middle] ?? 0;
};
const resolveLeadIntentProxy = (stats: any): number => {
  const profileVisits = toNumber(stats?.profile_visits) ?? 0;
  const follows = toNumber(stats?.follows) ?? 0;
  const shares = toNumber(stats?.shares) ?? 0;
  const saves = toNumber(stats?.saved) ?? toNumber(stats?.saves) ?? 0;
  const comments = toNumber(stats?.comments) ?? 0;
  const reach = toNumber(stats?.reach) ?? 0;
  const rawScore = profileVisits * 3 + follows * 8 + shares * 2 + saves * 1.5 + comments * 0.5;
  if (rawScore <= 0) return 0;
  if (reach > 0) return (rawScore / reach) * 1000;
  return rawScore;
};
const getObjectiveMetricValue = (post: any, objectiveMode: PlanningObjectiveMode): number | null => {
  if (objectiveMode === "reach") {
    return toNumber(post?.stats?.reach) ?? toNumber(post?.stats?.views);
  }
  if (objectiveMode === "leads") {
    const leadIntent = resolveLeadIntentProxy(post?.stats);
    return Number.isFinite(leadIntent) ? leadIntent : null;
  }
  return getPostInteractions(post);
};
const parseFeedbackVariant = (feedbackKey?: string | null) => {
  const normalized = String(feedbackKey || "").trim().toLowerCase();
  if (!normalized.includes(":")) return "";
  return normalized.split(":").slice(1).join(":");
};
const matchesRecommendationVariant = (post: any, action: PlanningRecommendationAction): boolean => {
  const variant = parseFeedbackVariant(action.feedbackKey);
  if (!variant) return true;

  if (action.id === "time_slot") {
    const match = variant.match(/^d(\d+)_h(\d+)$/);
    if (!match) return true;
    const dayOfWeekMongo = Number(match[1]);
    const hour = Number(match[2]);
    const parts = getTargetDateParts(post?.postDate || post?.createdAt || post?.timestamp);
    if (!parts) return false;
    return parts.dayOfWeekMongo === dayOfWeekMongo && parts.hour === hour;
  }

  if (action.id === "duration") {
    const duration = toNumber(post?.stats?.video_duration_seconds);
    const bucket = getDurationBucket(duration);
    return bucket?.key === variant;
  }

  if (action.id === "format_reach") {
    return matchesValue(toArray(post?.format), variant.replace(/_/g, " "));
  }

  if (action.id === "proposal_engagement" || action.id === "proposal_leads") {
    return matchesValue(toArray(post?.proposal), variant.replace(/_/g, " "));
  }

  if (action.id === "context_reach" || action.id === "context_leads") {
    return matchesValue(toArray(post?.context), variant.replace(/_/g, " "));
  }

  if (action.id === "tone_engagement") {
    return matchesValue(toArray(post?.tone), variant.replace(/_/g, " "));
  }

  return true;
};
const buildExperimentImpactSummary = ({
  action,
  feedbackUpdatedAt,
  posts,
  objectiveMode,
  metricLabel,
}: {
  action: PlanningRecommendationAction;
  feedbackUpdatedAt?: string | null;
  posts: any[];
  objectiveMode: PlanningObjectiveMode;
  metricLabel: string;
}): ExperimentImpactSummary | null => {
  if (!feedbackUpdatedAt) return null;
  const feedbackDate = new Date(feedbackUpdatedAt);
  if (Number.isNaN(feedbackDate.getTime())) return null;

  const datedPosts = posts
    .map((post) => {
      const rawDate = post?.postDate || post?.createdAt || post?.timestamp;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const metricValue = getObjectiveMetricValue(post, objectiveMode);
      if (!parsedDate || Number.isNaN(parsedDate.getTime()) || metricValue === null || !Number.isFinite(metricValue)) {
        return null;
      }
      return { post, parsedDate, metricValue };
    })
    .filter((entry) => Boolean(entry) && matchesRecommendationVariant((entry as any)?.post, action))
    .filter(Boolean)
    .sort((a, b) => b!.parsedDate.getTime() - a!.parsedDate.getTime()) as Array<{
      post: any;
      parsedDate: Date;
      metricValue: number;
    }>;

  const postsAfter = datedPosts.filter((entry) => entry.parsedDate.getTime() > feedbackDate.getTime());
  const postsBefore = datedPosts.filter((entry) => entry.parsedDate.getTime() <= feedbackDate.getTime());

  if (!postsAfter.length) {
    return {
      status: "awaiting_posts",
      text: "Ainda não há posts novos aderentes a esse teste para medir impacto.",
      beforeAvg: null,
      afterAvg: null,
      deltaRatio: null,
      beforeCount: 0,
      afterCount: 0,
    };
  }

  const comparisonCount = Math.min(postsAfter.length, postsBefore.length, 5);
  if (comparisonCount <= 0) {
    return {
      status: "insufficient_history",
      text: "Há posts depois do teste, mas falta base anterior comparável dentro dessa mesma hipótese.",
      beforeAvg: null,
      afterAvg: null,
      deltaRatio: null,
      beforeCount: postsBefore.length,
      afterCount: postsAfter.length,
    };
  }

  const afterWindow = postsAfter.slice(0, comparisonCount);
  const beforeWindow = postsBefore.slice(0, comparisonCount);
  const afterAvg = afterWindow.reduce((sum, entry) => sum + entry.metricValue, 0) / comparisonCount;
  const beforeAvg = beforeWindow.reduce((sum, entry) => sum + entry.metricValue, 0) / comparisonCount;
  const deltaRatio = beforeAvg > 0 ? (afterAvg - beforeAvg) / beforeAvg : null;

  if (comparisonCount < 2) {
    return {
      status: "early",
      text: `Ainda cedo: existe só ${formatPostsCount(comparisonCount)} depois do teste para comparar ${metricLabel.toLowerCase()}.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }

  if (typeof deltaRatio !== "number" || !Number.isFinite(deltaRatio)) {
    return {
      status: "early",
      text: `Já há ${formatPostsCount(comparisonCount)} depois do teste, mas a comparação ainda não é conclusiva.`,
      beforeAvg,
      afterAvg,
      deltaRatio: null,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }

  const pct = Math.round(deltaRatio * 100);
  if (Math.abs(pct) < 5) {
    return {
      status: "stable",
      text: `Nos últimos ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} ficou no mesmo nível.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }
  if (pct > 0) {
    return {
      status: "improved",
      text: `Nos últimos ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} ficou ${pct}% acima dos posts anteriores.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }
  return {
    status: "declined",
    text: `Nos últimos ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} ficou ${Math.abs(pct)}% abaixo dos posts anteriores.`,
    beforeAvg,
    afterAvg,
    deltaRatio,
    beforeCount: comparisonCount,
    afterCount: comparisonCount,
  };
};
const twoLineClampStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
};
const chartHeaderTextClassName = "min-h-[40px] space-y-1 sm:min-h-[52px]";
const chartHeightClassName = "mt-3 h-56 sm:h-56";
const chartTallHeightClassName = "mt-3 h-64 sm:h-64";
const chartCompactHeightClassName = "mt-3 h-44 sm:h-44";

type CategoryField =
  | "format"
  | "proposal"
  | "context"
  | "tone"
  | "references"
  | "contentIntent"
  | "narrativeForm"
  | "contentSignals"
  | "stance"
  | "proofStyle"
  | "commercialMode";
type CategoryBarDatum = { name: string; value: number; postsCount?: number };
type CategoryDataResponse = { chartData?: Array<{ name: string; value: number; postsCount?: number }> };
type TabBrief = {
  eyebrow: string;
  headline: string;
  reading?: string | null;
  bulletPoints?: string[];
  action: string;
  supportingNote?: string | null;
  statusChip?: string | null;
};
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
type TimingBenchmarkConfidence = "high" | "medium" | "low";
type TimingBenchmarkData = {
  cohort?: {
    canShow?: boolean;
    strategy?: "context_band" | "context_only" | "band_only" | "insufficient";
    label?: string | null;
    contextId?: string | null;
    contextLabel?: string | null;
    followerBandId?: string | null;
    followerBandLabel?: string | null;
    creatorCount?: number;
    postsCount?: number;
    confidence?: TimingBenchmarkConfidence;
    reason?: string | null;
  };
  hourly?: {
    buckets?: Array<{ hour: number; average: number; postsCount: number }>;
    topHoursByPosts?: number[];
    topHoursByAverage?: number[];
  };
  weekly?: {
    buckets?: Array<{ dayOfWeek: number; hour: number; average: number; postsCount: number }>;
    topWindowsByPosts?: Array<{ dayOfWeek: number; startHour: number; endHour: number; average: number; postsCount: number }>;
    topWindowsByAverage?: Array<{ dayOfWeek: number; startHour: number; endHour: number; average: number; postsCount: number }>;
  };
  duration?: {
    buckets?: Array<{ key: DurationBucketKey; label: DurationBarDatum["label"]; average: number; postsCount: number }>;
    topBucketByPostsKey?: DurationBucketKey | null;
    topBucketByAverageKey?: DurationBucketKey | null;
    totalVideoPosts?: number;
  };
  format?: {
    buckets?: Array<{ name: string; average: number; postsCount: number }>;
    topFormatByPosts?: string | null;
    topFormatByAverage?: string | null;
  };
};
type SimilarCreatorItem = {
  id: string;
  rankByFollowers: number;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  followers?: number | null;
  mediaKitSlug?: string | null;
  contextLabel?: string | null;
};
type SimilarCreatorsData = {
  canShow?: boolean;
  strategy?: "context_band" | "context_only" | "band_only" | "insufficient";
  label?: string | null;
  contextId?: string | null;
  contextLabel?: string | null;
  followerBandId?: string | null;
  followerBandLabel?: string | null;
  creatorCount?: number;
  reason?: string | null;
  items?: SimilarCreatorItem[];
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

const normalizePost = normalizePlanningPost;

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

const benchmarkConfidenceLabel: Record<TimingBenchmarkConfidence, string> = {
  high: "boa base para comparar",
  medium: "base suficiente para comparar",
  low: "leitura ainda inicial",
};

const formatHourList = (hours: number[]) => {
  const unique = Array.from(new Set(hours.filter((hour) => Number.isFinite(hour))))
    .sort((a, b) => a - b)
    .slice(0, 3);
  if (!unique.length) return null;
  return unique.map((hour) => `${hour}h`).join(", ");
};

const formatBenchmarkWindowLabel = (window?: { dayOfWeek: number; startHour: number; endHour: number } | null) => {
  if (!window) return null;
  const day = WEEKDAY_SHORT_SUN_FIRST[window.dayOfWeek - 1];
  if (!day) return null;
  return `${day} ${window.startHour}h-${window.endHour}h`;
};

const formatBenchmarkWindowList = (
  windows: Array<{ dayOfWeek: number; startHour: number; endHour: number }> | undefined
) => {
  const labels = (windows || [])
    .map((window) => formatBenchmarkWindowLabel(window))
    .filter((value): value is string => Boolean(value))
    .slice(0, 2);
  return labels.length ? labels.join(" • ") : null;
};

const formatBenchmarkDelta = (current: number | null | undefined, benchmark: number | null | undefined) => {
  const safeCurrent = typeof current === "number" && Number.isFinite(current) ? current : null;
  const safeBenchmark = typeof benchmark === "number" && Number.isFinite(benchmark) ? benchmark : null;
  if (safeCurrent === null || safeBenchmark === null || safeBenchmark <= 0) return null;
  return (safeCurrent - safeBenchmark) / safeBenchmark;
};

const formatPercentLabel = (value: number | null | undefined, digits = 0) => {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(digits)}%`;
};

const copyTextToClipboard = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && typeof window !== "undefined" && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard indisponível");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Clipboard indisponível");
};

const classifyBenchmarkDelta = (deltaRatio: number | null) => {
  if (deltaRatio === null || !Number.isFinite(deltaRatio)) {
    return { tone: "neutral" as const, label: "Ainda cedo para comparar" };
  }
  if (deltaRatio >= 0.4) return { tone: "positive" as const, label: "Acima da média com folga" };
  if (deltaRatio >= 0.12) return { tone: "positive" as const, label: "Acima da média" };
  if (deltaRatio > -0.12) return { tone: "neutral" as const, label: "Bem perto da média" };
  if (deltaRatio > -0.4) return { tone: "negative" as const, label: "Abaixo da média" };
  return { tone: "negative" as const, label: "Bem abaixo da média" };
};

const benchmarkToneClassName: Record<"positive" | "neutral" | "negative", string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  negative: "border-amber-200 bg-amber-50 text-amber-700",
};

const filterPostsByCategory = (posts: any[], field: CategoryField, value: string) =>
  posts.filter((p) => Array.isArray(p?.[field]) && matchesValue(p[field], value));

const STRATEGY_QUADRANT_LABEL: Record<string, string> = {
  winner: "Mais alcance e mais resposta",
  attracts: "Mais alcance, menos resposta",
  nurtures: "Menos alcance, mais resposta",
  low_priority: "Menos alcance e menos resposta",
};

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

const hasCategoryDataWithCounts = (rows: any): boolean =>
  Array.isArray(rows) &&
  rows.length > 0 &&
  rows.every((row) => typeof row?.postsCount === "number");

type ViewerInfo = {
  id: string;
  role?: string | null;
  name?: string | null;
  affiliateCode?: string | null;
};

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
};

export default function PlanningChartsPage({
  viewer,
  showPinButton = false,
  pinButtonRedirectOnPin = true,
  compactView = false,
  mobileAppView = false,
  showTitleMarker = true,
  initialHasAccess,
  initialInstagramConnected,
  isHighlighted = false,
}: {
  viewer?: ViewerInfo;
  showPinButton?: boolean;
  pinButtonRedirectOnPin?: boolean;
  compactView?: boolean;
  mobileAppView?: boolean;
  showTitleMarker?: boolean;
  initialHasAccess?: boolean;
  initialInstagramConnected?: boolean;
  isHighlighted?: boolean;
}) {
  const dedicatedDesktopWidthClassName = "lg:max-w-[1640px]";
  const router = useRouter();
  const sessionUserId = viewer?.id;
  const viewerRole = viewer?.role ?? null;
  const isAdminViewer = viewerRole === "admin";
  const { enabled: recommendationsFlagEnabled, loading: recommendationsFlagLoading } = useFeatureFlag(
    "planning.recommendations_v1",
    true
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
  const [feedbackMutationByActionId, setFeedbackMutationByActionId] = useState<Record<string, boolean>>({});
  const [affiliateCopyStatus, setAffiliateCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [page, setPage] = useState(1);
  const [postsCache, setPostsCache] = useState<any[]>([]);
  const [autoPaginating, setAutoPaginating] = useState(false);
  const [extendedPostsHydrated, setExtendedPostsHydrated] = useState(false);
  const [showAdvancedSections, setShowAdvancedSections] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveChartTab>("content");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const isBoardMobileViewport = useBoardMobileViewport();
  const [mobileAudienceTrendMetric, setMobileAudienceTrendMetric] = useState<"reach" | "interactions" | "response">("reach");
  const [mobileDepthMetric, setMobileDepthMetric] = useState<"saves" | "comments">("saves");
  const [demoBatchData, setDemoBatchData] = useState<ProfileAnalysisDemoData | null>(null);
  const shouldResolveBillingInClient =
    isAdminViewer ||
    Boolean(targetUserId) ||
    typeof initialHasAccess !== "boolean" ||
    typeof initialInstagramConnected !== "boolean";
  const billing = useBillingStatus({ auto: shouldResolveBillingInClient });
  const hasPremiumAccess = shouldResolveBillingInClient
    ? Boolean(billing.hasPremiumAccess)
    : Boolean(initialHasAccess);
  const instagramConnected = shouldResolveBillingInClient
    ? Boolean(billing.instagram?.connected)
    : Boolean(initialInstagramConnected);

  const billingAccessPending =
    shouldResolveBillingInClient &&
    Boolean(activeUserId) &&
    billing.isLoading &&
    !billing.hasResolvedOnce;
  const isDemoMode = useMemo(() => {
    if (billingAccessPending) return false;
    // Se não há usuário logado ou não tem Instagram conectado ou não é Pro, entra em modo Demo
    return !activeUserId || !hasPremiumAccess || !instagramConnected;
  }, [activeUserId, billingAccessPending, hasPremiumAccess, instagramConnected]);

  const durationBucketPostsCacheRef = useRef<Map<string, any[]>>(new Map());
  const fetchedPagesRef = useRef<Set<number>>(new Set());
  const paginationScopeRef = useRef<string>("");
  const advancedSectionsSentinelRef = useRef<HTMLDivElement | null>(null);
  const compactControlsRef = useRef<HTMLDivElement | null>(null);
  const PAGE_LIMIT = 120;
  const MAX_PAGES = 6; // hard cap de segurança
  const paginationScopeKey = `${activeUserId || "none"}:${timePeriod}`;
  const recommendationsFeatureEnabled = useMemo(() => {
    if (isAdminViewer) return true;
    if (recommendationsFlagLoading) return false;
    return recommendationsFlagEnabled;
  }, [isAdminViewer, recommendationsFlagEnabled, recommendationsFlagLoading]);
  const canShowAffiliateInvite = !isActingOnBehalf && Boolean(viewer?.affiliateCode);
  const useMobileAppView = mobileAppView && isBoardMobileViewport;
  const isCompactBoard = compactView || useMobileAppView;
  const [allowPostsAutoPrefetch, setAllowPostsAutoPrefetch] = useState(!isCompactBoard);
  const advancedSectionsReady = showAdvancedSections;
  const isContentTabActive = activeTab === "content";
  const isFormatTabActive = activeTab === "format";
  const isAudienceTabActive = activeTab === "audience";
  const chartsBatchSurface = isCompactBoard && !advancedSectionsReady ? "board" : "full";
  const listSurface = isCompactBoard ? "board" : "full";
  const useCompactContentCharts = isCompactBoard || isMobileViewport;
  const useCompactFormatCharts = isCompactBoard || isMobileViewport;
  const autoPrefetchPagesCap = useMemo(() => {
    if (!allowPostsAutoPrefetch) return 1;
    return Math.min(
      MAX_PAGES,
      AUTO_PREFETCH_PAGE_CAP_BY_PERIOD[timePeriod] ?? 2
    );
  }, [allowPostsAutoPrefetch, timePeriod]);

  const resetPaginationState = React.useCallback(() => {
    setPage(1);
    setPostsCache([]);
    setAutoPaginating(false);
    setExtendedPostsHydrated(false);
  }, []);

  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value);
    resetPaginationState();
    setShowMobileControls(false);
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
      setShowMobileControls(false);
    },
    [activeUserId, objectiveMode, timePeriod]
  );

  const openRecommendationEvidence = React.useCallback(
    (action: PlanningRecommendationAction) => {
      const actionKey = String(action.feedbackKey || action.id || "").trim().toLowerCase();
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
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    setAllowPostsAutoPrefetch(canAutoPrefetchPlanningPosts(isCompactBoard));
  }, [isCompactBoard]);

  useEffect(() => {
    if (!isDemoMode || demoBatchData) return;

    let cancelled = false;

    void import("./profileAnalysisDemoData")
      .then((mod) => {
        if (cancelled) return;
        setDemoBatchData(mod.PROFILE_ANALYSIS_DEMO_DATA);
      })
      .catch((error) => {
        console.warn("[PlanningCharts] Falha ao carregar dados de demo", error);
      });

    return () => {
      cancelled = true;
    };
  }, [demoBatchData, isDemoMode]);

  useEffect(() => {
    if (isMobileViewport) return;
    setShowMobileControls(false);
  }, [isMobileViewport]);

  useEffect(() => {
    if (!showMobileControls || !isCompactBoard || isMobileViewport) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (compactControlsRef.current?.contains(target)) return;
      setShowMobileControls(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMobileControls(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMobileControls, isCompactBoard, isMobileViewport]);

  useEffect(() => {
    if (!recommendationsFeatureEnabled) {
      setSelectedRecommendation(null);
    }
  }, [recommendationsFeatureEnabled]);

  useEffect(() => {
    setSelectedRecommendation(null);
  }, [activeUserId, objectiveMode, timePeriod]);

  useEffect(() => {
    if (affiliateCopyStatus === "idle") return;
    const timeoutId = window.setTimeout(() => setAffiliateCopyStatus("idle"), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [affiliateCopyStatus]);

  useEffect(() => {
    if (!isCompactBoard || showAdvancedSections) return;
    if (typeof window === "undefined") {
      setShowAdvancedSections(true);
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const revealAdvancedSections = () => setShowAdvancedSections(true);

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(revealAdvancedSections, { timeout: 1800 });
      return () => {
        if (idleId !== null && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    timeoutId = window.setTimeout(revealAdvancedSections, 1200);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [isCompactBoard, showAdvancedSections]);

  useEffect(() => {
    if (advancedSectionsReady) return;
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
  }, [advancedSectionsReady]);

  const { data: chartsBatchData, isLoading: chartsBatchLoading, mutate: mutateChartsBatch } = useSWR(
    activeUserId && !billingAccessPending && !isDemoMode
      ? `/api/v1/users/${activeUserId}/planning/charts-batch?timePeriod=${timePeriod}&granularity=weekly&objectiveMode=${objectiveMode}&limit=${PAGE_LIMIT}&surface=${chartsBatchSurface}`
      : null,
    fetcher,
    swrOptions
  );

  // Dados reais ou de demonstração
  const effectiveBatchData = isDemoMode ? demoBatchData : chartsBatchData;
  const loadingBatch = billingAccessPending || (isDemoMode ? !demoBatchData : chartsBatchLoading);

  const { data: recommendationFeedbackData, mutate: mutateRecommendationFeedback } = useSWR(
    activeUserId && !isDemoMode && recommendationsFeatureEnabled && advancedSectionsReady
      ? `/api/v1/users/${activeUserId}/planning/recommendation-feedback?objectiveMode=${objectiveMode}&timePeriod=${timePeriod}`
      : null,
    fetcher,
    swrOptions
  );

  const trendData = effectiveBatchData?.trendData;
  const timeData = effectiveBatchData?.timeData;
  const durationData = effectiveBatchData?.durationData;
  const timingBenchmark = effectiveBatchData?.timingBenchmark as TimingBenchmarkData | undefined;
  const similarCreators = effectiveBatchData?.similarCreators as SimilarCreatorsData | undefined;
  const formatData = effectiveBatchData?.formatData;
  const proposalData = effectiveBatchData?.proposalData;
  const toneData = effectiveBatchData?.toneData;
  const referenceData = effectiveBatchData?.referenceData;
  const contextData = effectiveBatchData?.contextData;
  const contentIntentData = effectiveBatchData?.contentIntentData as CategoryDataResponse | undefined;
  const narrativeFormData = effectiveBatchData?.narrativeFormData as CategoryDataResponse | undefined;
  const contentSignalsData = effectiveBatchData?.contentSignalsData as CategoryDataResponse | undefined;
  const stanceData = effectiveBatchData?.stanceData as CategoryDataResponse | undefined;
  const proofStyleData = effectiveBatchData?.proofStyleData as CategoryDataResponse | undefined;
  const commercialModeData = effectiveBatchData?.commercialModeData as CategoryDataResponse | undefined;
  const metricMeta = effectiveBatchData?.metricMeta as
    | {
        field?: string;
        label?: string;
        shortLabel?: string;
        tooltipLabel?: string;
        unitLabel?: string;
        isProxy?: boolean;
        description?: string | null;
      }
    | undefined;
  const directioningSummary = effectiveBatchData?.directioningSummary as DirectioningSummary | undefined;
  const similarCreatorItems = useMemo(
    () => ((similarCreators?.items || []) as SimilarCreatorItem[]).filter((item) => Boolean(item?.id)),
    [similarCreators?.items]
  );
  const similarCreatorsEnabled = Boolean(similarCreators?.canShow && similarCreatorItems.length > 0);
  const totalSimilarCreatorsCount = typeof similarCreators?.creatorCount === "number" ? similarCreators.creatorCount : similarCreatorItems.length;
  const visibleSimilarCreatorsCount = similarCreatorItems.length;
  const similarCreatorsSummaryLabel =
    totalSimilarCreatorsCount > visibleSimilarCreatorsCount && visibleSimilarCreatorsCount > 0
      ? `${numberFormatter.format(visibleSimilarCreatorsCount)} de ${numberFormatter.format(totalSimilarCreatorsCount)} contas exibidas`
      : `${numberFormatter.format(totalSimilarCreatorsCount)} contas na base`;
  const affiliateInviteLink = useMemo(() => {
    if (!canShowAffiliateInvite || !viewer?.affiliateCode) return null;
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "https://data2content.ai";
    return `${origin}/?ref=${encodeURIComponent(viewer.affiliateCode)}`;
  }, [canShowAffiliateInvite, viewer?.affiliateCode]);
  const primaryMetricLabel =
    metricMeta?.label ||
    (objectiveMode === "reach"
      ? "Alcance por post"
      : objectiveMode === "leads"
        ? "Intenção de lead por 1 mil alcançadas"
        : "Interações por post");
  const primaryMetricShortLabel =
    metricMeta?.shortLabel ||
    (objectiveMode === "reach" ? "Alcance" : objectiveMode === "leads" ? "Intenção de lead" : "Engajamento");
  const primaryMetricTooltipLabel = metricMeta?.tooltipLabel || primaryMetricLabel;
  const handleCopyAffiliateInvite = React.useCallback(async () => {
    if (!affiliateInviteLink) return;
    try {
      await copyTextToClipboard(affiliateInviteLink);
      setAffiliateCopyStatus("copied");
      track("planning_similar_creators_affiliate_copied", {
        creator_id: activeUserId || null,
        affiliate_code: viewer?.affiliateCode || null,
      });
    } catch {
      setAffiliateCopyStatus("error");
    }
  }, [activeUserId, affiliateInviteLink, viewer?.affiliateCode]);
  const primaryMetricUnitLabel = metricMeta?.unitLabel || primaryMetricShortLabel;
  const rawRecommendationActions = useMemo(
    () =>
      recommendationsFeatureEnabled
        ? ((effectiveBatchData?.recommendations?.actions || []) as PlanningRecommendationAction[])
        : [],
    [effectiveBatchData?.recommendations?.actions, recommendationsFeatureEnabled]
  );
  const feedbackByActionId = useMemo(
    () =>
      (recommendationFeedbackData?.feedbackByActionId || {}) as Record<
        string,
        RecommendationFeedbackStatus
      >,
    [recommendationFeedbackData?.feedbackByActionId]
  );
  const feedbackMetaByActionId = useMemo(
    () =>
      (recommendationFeedbackData?.feedbackMetaByActionId || {}) as Record<
        string,
        { status: RecommendationFeedbackStatus; updatedAt?: string | null }
      >,
    [recommendationFeedbackData?.feedbackMetaByActionId]
  );
  const submitRecommendationFeedback = React.useCallback(
    async (action: PlanningRecommendationAction, status: RecommendationFeedbackStatus) => {
      if (!activeUserId) return;

      const actionKey = String(action.feedbackKey || action.id || "").trim().toLowerCase();
      if (!actionKey) return;

      const currentStatus = feedbackByActionId[actionKey] || null;
      const nextStatus: RecommendationFeedbackStatus | "clear" =
        currentStatus === status ? "clear" : status;
      const previousPayload = recommendationFeedbackData;

      setFeedbackMutationByActionId((prev) => ({ ...prev, [actionKey]: true }));

      await mutateRecommendationFeedback(
        (current: any) => {
          const currentMap = { ...(current?.feedbackByActionId || {}) };
          const currentMetaMap = { ...(current?.feedbackMetaByActionId || {}) };
          if (nextStatus === "clear") {
            delete currentMap[actionKey];
            delete currentMetaMap[actionKey];
          } else {
            currentMap[actionKey] = nextStatus;
            currentMetaMap[actionKey] = {
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            };
          }
          return { ...(current || {}), feedbackByActionId: currentMap, feedbackMetaByActionId: currentMetaMap };
        },
        false
      );

      try {
        const response = await fetch(
          `/api/v1/users/${activeUserId}/planning/recommendation-feedback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actionId: actionKey,
              status: nextStatus,
              objectiveMode,
              timePeriod,
              actionTitle: action.title,
              confidence: action.confidence,
              opportunityScore: action.opportunityScore,
              sampleSize: action.sampleSize,
            }),
          }
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || `HTTP ${response.status}`);
        }

        track("planning_charts_action_feedback_submitted", {
          creator_id: activeUserId || null,
          action_id: action.id,
          feedback_status: nextStatus,
          objective_mode: objectiveMode,
          time_period: timePeriod,
        });
        await Promise.all([mutateRecommendationFeedback(), mutateChartsBatch()]);
      } catch (error) {
        console.warn("[PlanningCharts] Falha ao salvar feedback da recomendação", error);
        await mutateRecommendationFeedback(previousPayload, false);
      } finally {
        setFeedbackMutationByActionId((prev) => {
          const next = { ...prev };
          delete next[actionKey];
          return next;
        });
      }
    },
    [
      activeUserId,
      feedbackByActionId,
      mutateChartsBatch,
      mutateRecommendationFeedback,
      objectiveMode,
      recommendationFeedbackData,
      timePeriod,
    ]
  );

  const hasDurationDataFromApi =
    Array.isArray(durationData?.buckets) && typeof durationData?.totalVideoPosts === "number";
  const hasTimeBucketsFromApi = Array.isArray(timeData?.buckets) && timeData.buckets.length > 0;
  const needsMoreCategoryRowsFromPosts =
    shouldSupplementCategoryBars(proposalData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(toneData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(referenceData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(contextData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(contentIntentData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(narrativeFormData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(contentSignalsData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(stanceData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(proofStyleData?.chartData || [], CATEGORY_RANKING_LIMIT) ||
    shouldSupplementCategoryBars(commercialModeData?.chartData || [], CATEGORY_RANKING_LIMIT);
  const contentTabRequiresExtendedPosts =
    advancedSectionsReady &&
    (!hasCategoryDataWithCounts(proposalData?.chartData) ||
      !hasCategoryDataWithCounts(toneData?.chartData) ||
      !hasCategoryDataWithCounts(referenceData?.chartData) ||
      !hasCategoryDataWithCounts(contextData?.chartData) ||
      !hasCategoryDataWithCounts(contentIntentData?.chartData) ||
      !hasCategoryDataWithCounts(narrativeFormData?.chartData) ||
      !hasCategoryDataWithCounts(contentSignalsData?.chartData) ||
      !hasCategoryDataWithCounts(stanceData?.chartData) ||
      !hasCategoryDataWithCounts(proofStyleData?.chartData) ||
      !hasCategoryDataWithCounts(commercialModeData?.chartData) ||
      needsMoreCategoryRowsFromPosts);
  const formatTabRequiresExtendedPosts = !hasDurationDataFromApi || !hasTimeBucketsFromApi;
  const audienceTabRequiresExtendedPosts = advancedSectionsReady;
  const directioningTabRequiresExtendedPosts = advancedSectionsReady;
  const requiresExtendedPosts =
    activeTab === "content"
      ? contentTabRequiresExtendedPosts
      : activeTab === "format"
        ? formatTabRequiresExtendedPosts
        : activeTab === "audience"
          ? audienceTabRequiresExtendedPosts
          : directioningTabRequiresExtendedPosts;

  useEffect(() => {
    setExtendedPostsHydrated(false);
    if (!requiresExtendedPosts) return;
    if (typeof window === "undefined") {
      setExtendedPostsHydrated(true);
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const enableExtendedPosts = () => setExtendedPostsHydrated(true);

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(enableExtendedPosts, { timeout: 900 });
      return () => {
        if (idleId !== null && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    timeoutId = window.setTimeout(enableExtendedPosts, 420);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [paginationScopeKey, requiresExtendedPosts]);

  const { data: pagedPostsData } = useSWR(
    activeUserId &&
      !isDemoMode &&
      extendedPostsHydrated &&
      page > 1 &&
      requiresExtendedPosts &&
      !fetchedPagesRef.current.has(page)
      ? `/api/v1/users/${activeUserId}/videos/list?timePeriod=${timePeriod}&limit=${PAGE_LIMIT}&page=${page}&sortBy=postDate&sortOrder=desc${listSurface === "board" ? "&surface=board" : ""}`
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
      postsCount: typeof point.postsCount === "number" ? point.postsCount : 0,
    }));
    if (!rows.length) return [];
    const agg = new Map<string, { reach: number; interactions: number; postsCount: number }>();
    rows.forEach((row: { date: string; reach: number; interactions: number; postsCount: number }) => {
      const isoWeekDate = typeof row.date === "string" ? parseIsoWeekKey(row.date) : null;
      const key = isoWeekDate ? formatDateKey(isoWeekDate) : getWeekKey(row.date) ?? (row.date ? String(row.date) : null);
      if (!key) return; // descarta pontos sem data válida
      const bucket = agg.get(key) || { reach: 0, interactions: 0, postsCount: 0 };
      bucket.reach += row.reach;
      bucket.interactions += row.interactions;
      bucket.postsCount += row.postsCount;
      agg.set(key, bucket);
    });
    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        reach: data.postsCount ? data.reach / data.postsCount : 0,
        interactions: data.postsCount ? data.interactions / data.postsCount : 0,
        postsCount: data.postsCount,
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
    (field: CategoryField, value: string, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByCategory(normalizedPosts, field, value));
      openSliceModal({
        title: `Posts com ${field}: ${value}`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  const handleStrategyPointClick = React.useCallback(
    (point: {
      label: string;
      quadrant: string;
      reach: number;
      depth: number;
      post?: any;
    }) => {
      if (!point?.post) return;
      const quadrantLabel = STRATEGY_QUADRANT_LABEL[point.quadrant] || "Post da matriz";
      const depthValue =
        objectiveMode === "leads"
          ? `${point.depth.toFixed(point.depth >= 10 ? 1 : 2)} de intenção`
          : `${point.depth.toFixed(point.depth >= 10 ? 1 : 2)} de resposta`;
      openSliceModal({
        title: point.label || "Post da matriz",
        subtitle: `${quadrantLabel} • ${numberFormatter.format(Math.round(point.reach))} de alcance • ${depthValue}`,
        posts: [point.post],
      });
    },
    [objectiveMode, openSliceModal]
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
    const list = Array.isArray(effectiveBatchData?.postsData?.posts) ? effectiveBatchData.postsData.posts : [];
    const scopeChanged = paginationScopeRef.current !== paginationScopeKey;
    if (scopeChanged) {
      paginationScopeRef.current = paginationScopeKey;
      fetchedPagesRef.current = new Set();
    }
    if (!effectiveBatchData) return;

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
    setPage(1);
    setAutoPaginating(false);
  }, [effectiveBatchData, paginationScopeKey, postsCache]);

  useEffect(() => {
    const list = Array.isArray(effectiveBatchData?.postsData?.posts) ? effectiveBatchData.postsData.posts : [];
    if (!extendedPostsHydrated || !requiresExtendedPosts || page > 1 || list.length !== PAGE_LIMIT) return;

    const totalPagesFromBatch = Number(effectiveBatchData?.postsData?.pagination?.totalPages || 1);
    const hasMoreFromBatch =
      Boolean(effectiveBatchData?.postsData?.pagination?.hasMore) ||
      (Number.isFinite(totalPagesFromBatch) && totalPagesFromBatch > 1);
    const maxPrefetchPages = Math.min(
      autoPrefetchPagesCap,
      Number.isFinite(totalPagesFromBatch) && totalPagesFromBatch > 0 ? totalPagesFromBatch : 1
    );
    if (!hasMoreFromBatch || maxPrefetchPages <= 1 || fetchedPagesRef.current.has(2)) return;

    setPage(2);
  }, [
    autoPrefetchPagesCap,
    effectiveBatchData,
    extendedPostsHydrated,
    page,
    requiresExtendedPosts,
  ]);

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
    const hasMoreFromResponse =
      Boolean(pagedPostsData?.pagination?.hasMore) ||
      (Number.isFinite(totalPagesFromResponse) && totalPagesFromResponse > page);
    const maxPrefetchPages = Math.min(
      autoPrefetchPagesCap,
      Number.isFinite(totalPagesFromResponse) && totalPagesFromResponse > 0 ? totalPagesFromResponse : autoPrefetchPagesCap
    );

    const shouldLoadMore =
      extendedPostsHydrated &&
      requiresExtendedPosts &&
      uniqueAdded > 0 &&
      hasMoreFromResponse &&
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
  }, [
    pagedPostsData,
    page,
    autoPaginating,
    extendedPostsHydrated,
    requiresExtendedPosts,
    autoPrefetchPagesCap,
    listSurface,
    postsCache,
  ]);

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

  const timingBenchmarkEnabled = Boolean(timingBenchmark?.cohort?.canShow);
  const benchmarkCohortLabel = timingBenchmark?.cohort?.label || null;
  const benchmarkCohortConfidence =
    (timingBenchmark?.cohort?.confidence as TimingBenchmarkConfidence | undefined) || null;
  const benchmarkHourlyMap = useMemo(() => {
    const map = new Map<number, { average: number; postsCount: number }>();
    (timingBenchmark?.hourly?.buckets || []).forEach((bucket) => {
      if (typeof bucket?.hour !== "number") return;
      map.set(bucket.hour, {
        average: typeof bucket.average === "number" ? bucket.average : 0,
        postsCount: typeof bucket.postsCount === "number" ? bucket.postsCount : 0,
      });
    });
    return map;
  }, [timingBenchmark?.hourly?.buckets]);

  const hourBenchmarkSeries = useMemo(
    () =>
      hourBars.map((bucket) => ({
        ...bucket,
        benchmarkAverage: benchmarkHourlyMap.get(bucket.hour)?.average ?? null,
        benchmarkPostsCount: benchmarkHourlyMap.get(bucket.hour)?.postsCount ?? 0,
      })),
    [benchmarkHourlyMap, hourBars]
  );

  const bestHour = useMemo(() => hourBars?.slice().sort((a, b) => b.average - a.average)?.[0]?.hour ?? null, [hourBars]);
  const bestBenchmarkHourByAverage = useMemo(
    () => (timingBenchmark?.hourly?.topHoursByAverage || [])[0] ?? null,
    [timingBenchmark?.hourly?.topHoursByAverage]
  );
  const benchmarkPostingHoursLabel = useMemo(
    () => formatHourList((timingBenchmark?.hourly?.topHoursByPosts || []) as number[]),
    [timingBenchmark?.hourly?.topHoursByPosts]
  );
  const bestHourBenchmarkDelta = useMemo(() => {
    if (bestHour === null) return null;
    const userHour = hourBars.find((bucket) => bucket.hour === bestHour);
    const benchmarkHour = benchmarkHourlyMap.get(bestHour);
    return formatBenchmarkDelta(userHour?.average, benchmarkHour?.average);
  }, [benchmarkHourlyMap, bestHour, hourBars]);
  const bestHourBenchmarkStatus = useMemo(
    () => classifyBenchmarkDelta(bestHourBenchmarkDelta),
    [bestHourBenchmarkDelta]
  );

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

  const benchmarkDurationMap = useMemo(() => {
    const map = new Map<DurationBucketKey, { average: number; postsCount: number }>();
    (timingBenchmark?.duration?.buckets || []).forEach((bucket) => {
      if (!bucket?.key) return;
      map.set(bucket.key, {
        average: typeof bucket.average === "number" ? bucket.average : 0,
        postsCount: typeof bucket.postsCount === "number" ? bucket.postsCount : 0,
      });
    });
    return map;
  }, [timingBenchmark?.duration?.buckets]);

  const durationBenchmarkSeries = useMemo(
    () =>
      durationBuckets.map((bucket) => ({
        ...bucket,
        benchmarkAverage: benchmarkDurationMap.get(bucket.key)?.average ?? null,
        benchmarkPostsCount: benchmarkDurationMap.get(bucket.key)?.postsCount ?? 0,
      })),
    [benchmarkDurationMap, durationBuckets]
  );
  const totalUserDurationBucketsPosts = useMemo(
    () => durationBuckets.reduce((sum, bucket) => sum + Math.max(0, bucket.postsCount || 0), 0),
    [durationBuckets]
  );
  const totalBenchmarkDurationBucketsPosts = useMemo(
    () =>
      (timingBenchmark?.duration?.buckets || []).reduce(
        (sum, bucket) => sum + Math.max(0, Number(bucket?.postsCount || 0)),
        0
      ),
    [timingBenchmark?.duration?.buckets]
  );
  const durationCoverageBenchmarkSeries = useMemo(
    () =>
      durationBuckets.map((bucket) => ({
        ...bucket,
        usageSharePct:
          totalUserDurationBucketsPosts > 0 ? (bucket.postsCount / totalUserDurationBucketsPosts) * 100 : 0,
        benchmarkUsagePosts: benchmarkDurationMap.get(bucket.key)?.postsCount ?? 0,
        benchmarkUsageSharePct:
          totalBenchmarkDurationBucketsPosts > 0
            ? ((benchmarkDurationMap.get(bucket.key)?.postsCount ?? 0) / totalBenchmarkDurationBucketsPosts) * 100
            : null,
      })),
    [benchmarkDurationMap, durationBuckets, totalBenchmarkDurationBucketsPosts, totalUserDurationBucketsPosts]
  );

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
  const topDurationUsageBucket = useMemo(() => {
    return durationBuckets
      .filter((bucket) => bucket.postsCount > 0)
      .slice()
      .sort((a, b) => (b.postsCount === a.postsCount ? b.averageInteractions - a.averageInteractions : b.postsCount - a.postsCount))[0] || null;
  }, [durationBuckets]);
  const benchmarkDurationPostingBucket = useMemo(
    () =>
      DURATION_BUCKETS.find((bucket) => bucket.key === (timingBenchmark?.duration?.topBucketByPostsKey || null)) || null,
    [timingBenchmark?.duration?.topBucketByPostsKey]
  );
  const benchmarkDurationPerformanceBucket = useMemo(
    () =>
      DURATION_BUCKETS.find((bucket) => bucket.key === (timingBenchmark?.duration?.topBucketByAverageKey || null)) || null,
    [timingBenchmark?.duration?.topBucketByAverageKey]
  );
  const bestDurationBenchmarkDelta = useMemo(() => {
    if (!bestDurationBucket) return null;
    const benchmarkBucket = benchmarkDurationMap.get(bestDurationBucket.key);
    return formatBenchmarkDelta(bestDurationBucket.averageInteractions, benchmarkBucket?.average);
  }, [benchmarkDurationMap, bestDurationBucket]);
  const bestDurationBenchmarkStatus = useMemo(
    () => classifyBenchmarkDelta(bestDurationBenchmarkDelta),
    [bestDurationBenchmarkDelta]
  );

  const lowSampleDurationBuckets = useMemo(() => {
    return durationBuckets.filter((bucket) => bucket.postsCount > 0 && bucket.postsCount < 5).length;
  }, [durationBuckets]);

  const formatBars = useMemo(() => formatData?.chartData || [], [formatData]);
  const benchmarkFormatMap = useMemo(() => {
    const map = new Map<string, { average: number; postsCount: number }>();
    (timingBenchmark?.format?.buckets || []).forEach((bucket) => {
      const name = String(bucket?.name || "").trim();
      if (!name) return;
      map.set(name.toLowerCase(), {
        average: typeof bucket.average === "number" ? bucket.average : 0,
        postsCount: typeof bucket.postsCount === "number" ? bucket.postsCount : 0,
      });
    });
    return map;
  }, [timingBenchmark?.format?.buckets]);
  const formatBenchmarkSeries = useMemo(
    () =>
      (formatBars as Array<{ name: string; value: number; postsCount?: number }>).map((bucket) => ({
        ...bucket,
        benchmarkAverage: benchmarkFormatMap.get(String(bucket.name || "").toLowerCase())?.average ?? null,
        benchmarkPostsCount: benchmarkFormatMap.get(String(bucket.name || "").toLowerCase())?.postsCount ?? 0,
      })),
    [benchmarkFormatMap, formatBars]
  );
  const benchmarkTopFormatByPosts = useMemo(
    () => timingBenchmark?.format?.topFormatByPosts || null,
    [timingBenchmark?.format?.topFormatByPosts]
  );
  const benchmarkTopFormatByAverage = useMemo(
    () => timingBenchmark?.format?.topFormatByAverage || null,
    [timingBenchmark?.format?.topFormatByAverage]
  );
  const comparableFormatBenchmarkCount = useMemo(
    () => formatBenchmarkSeries.filter((bucket) => typeof bucket.benchmarkAverage === "number").length,
    [formatBenchmarkSeries]
  );
  const canShowFormatBenchmarkLine = useMemo(
    () => timingBenchmarkEnabled && formatBenchmarkSeries.length >= 2 && comparableFormatBenchmarkCount >= 2,
    [comparableFormatBenchmarkCount, formatBenchmarkSeries.length, timingBenchmarkEnabled]
  );
  const bestFormatBenchmarkDelta = useMemo(() => {
    const bestFormat = (formatBars as Array<{ name: string; value: number }>)[0];
    if (!bestFormat?.name) return null;
    const benchmarkFormat = benchmarkFormatMap.get(String(bestFormat.name || "").toLowerCase());
    return formatBenchmarkDelta(bestFormat.value, benchmarkFormat?.average);
  }, [benchmarkFormatMap, formatBars]);
  const bestFormatBenchmarkStatus = useMemo(
    () => classifyBenchmarkDelta(bestFormatBenchmarkDelta),
    [bestFormatBenchmarkDelta]
  );
  const proposalBarsFromApi = useMemo(
    () => (proposalData?.chartData || []) as Array<{ name: string; value: number; postsCount?: number }>,
    [proposalData]
  );
  const toneBarsFromApi = useMemo(
    () => (toneData?.chartData || []) as Array<{ name: string; value: number; postsCount?: number }>,
    [toneData]
  );
  const referenceBarsFromApi = useMemo(
    () => (referenceData?.chartData || []) as Array<{ name: string; value: number; postsCount?: number }>,
    [referenceData]
  );
  const contextBarsFromApi = useMemo(
    () => (contextData?.chartData || []) as Array<{ name: string; value: number; postsCount?: number }>,
    [contextData]
  );
  const contentIntentBarsFromApi = useMemo(
    () =>
      (contentIntentData?.chartData || []) as Array<{
        name: string;
        value: number;
        postsCount?: number;
      }>,
    [contentIntentData]
  );
  const narrativeFormBarsFromApi = useMemo(
    () =>
      (narrativeFormData?.chartData || []) as Array<{
        name: string;
        value: number;
        postsCount?: number;
      }>,
    [narrativeFormData]
  );
  const contentSignalsBarsFromApi = useMemo(
    () =>
      (contentSignalsData?.chartData || []) as Array<{
        name: string;
        value: number;
        postsCount?: number;
      }>,
    [contentSignalsData]
  );
  const stanceBarsFromApi = useMemo(
    () =>
      (stanceData?.chartData || []) as Array<{
        name: string;
        value: number;
        postsCount?: number;
      }>,
    [stanceData]
  );
  const proofStyleBarsFromApi = useMemo(
    () =>
      (proofStyleData?.chartData || []) as Array<{
        name: string;
        value: number;
        postsCount?: number;
      }>,
    [proofStyleData]
  );
  const commercialModeBarsFromApi = useMemo(
    () =>
      (commercialModeData?.chartData || []) as Array<{
        name: string;
        value: number;
        postsCount?: number;
      }>,
    [commercialModeData]
  );

  const needsCategoryFallback = useMemo(() => {
    if (!advancedSectionsReady || normalizedPosts.length === 0) return false;
    return (
      shouldSupplementCategoryBars(proposalBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(toneBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(referenceBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(contextBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(contentIntentBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(narrativeFormBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(contentSignalsBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(stanceBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(proofStyleBarsFromApi, CATEGORY_RANKING_LIMIT) ||
      shouldSupplementCategoryBars(commercialModeBarsFromApi, CATEGORY_RANKING_LIMIT)
    );
  }, [
    commercialModeBarsFromApi,
    contentIntentBarsFromApi,
    contentSignalsBarsFromApi,
    contextBarsFromApi,
    narrativeFormBarsFromApi,
    proofStyleBarsFromApi,
    proposalBarsFromApi,
    referenceBarsFromApi,
    advancedSectionsReady,
    normalizedPosts,
    stanceBarsFromApi,
    toneBarsFromApi,
  ]);

  const categoryFallback = useMemo(() => {
    if (!needsCategoryFallback) return null;
    return {
      proposal: aggregateAverageInteractionsByCategory(normalizedPosts, "proposal"),
      tone: aggregateAverageInteractionsByCategory(normalizedPosts, "tone"),
      references: aggregateAverageInteractionsByCategory(normalizedPosts, "references"),
      context: aggregateAverageInteractionsByCategory(normalizedPosts, "context"),
      contentIntent: aggregateAverageInteractionsByCategory(normalizedPosts, "contentIntent"),
      narrativeForm: aggregateAverageInteractionsByCategory(normalizedPosts, "narrativeForm"),
      contentSignals: aggregateAverageInteractionsByCategory(normalizedPosts, "contentSignals"),
      stance: aggregateAverageInteractionsByCategory(normalizedPosts, "stance"),
      proofStyle: aggregateAverageInteractionsByCategory(normalizedPosts, "proofStyle"),
      commercialMode: aggregateAverageInteractionsByCategory(normalizedPosts, "commercialMode"),
    };
  }, [needsCategoryFallback, normalizedPosts]);

  const proposalBars = useMemo(() => {
    if (shouldSupplementCategoryBars(proposalBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(proposalBarsFromApi, categoryFallback?.proposal);
    }
    return proposalBarsFromApi;
  }, [proposalBarsFromApi, categoryFallback]);

  const toneBars = useMemo(() => {
    if (shouldSupplementCategoryBars(toneBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(toneBarsFromApi, categoryFallback?.tone);
    }
    return toneBarsFromApi;
  }, [toneBarsFromApi, categoryFallback]);

  const referenceBars = useMemo(() => {
    if (shouldSupplementCategoryBars(referenceBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(referenceBarsFromApi, categoryFallback?.references);
    }
    return referenceBarsFromApi;
  }, [referenceBarsFromApi, categoryFallback]);

  const contextBars = useMemo(() => {
    if (shouldSupplementCategoryBars(contextBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(contextBarsFromApi, categoryFallback?.context);
    }
    return contextBarsFromApi;
  }, [contextBarsFromApi, categoryFallback]);
  const contentIntentBars = useMemo(() => {
    if (shouldSupplementCategoryBars(contentIntentBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(contentIntentBarsFromApi, categoryFallback?.contentIntent);
    }
    return contentIntentBarsFromApi;
  }, [contentIntentBarsFromApi, categoryFallback]);
  const narrativeFormBars = useMemo(() => {
    if (shouldSupplementCategoryBars(narrativeFormBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(narrativeFormBarsFromApi, categoryFallback?.narrativeForm);
    }
    return narrativeFormBarsFromApi;
  }, [narrativeFormBarsFromApi, categoryFallback]);
  const contentSignalsBars = useMemo(() => {
    if (shouldSupplementCategoryBars(contentSignalsBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(contentSignalsBarsFromApi, categoryFallback?.contentSignals);
    }
    return contentSignalsBarsFromApi;
  }, [contentSignalsBarsFromApi, categoryFallback]);
  const stanceBars = useMemo(() => {
    if (shouldSupplementCategoryBars(stanceBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(stanceBarsFromApi, categoryFallback?.stance);
    }
    return stanceBarsFromApi;
  }, [stanceBarsFromApi, categoryFallback]);
  const proofStyleBars = useMemo(() => {
    if (shouldSupplementCategoryBars(proofStyleBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(proofStyleBarsFromApi, categoryFallback?.proofStyle);
    }
    return proofStyleBarsFromApi;
  }, [proofStyleBarsFromApi, categoryFallback]);
  const commercialModeBars = useMemo(() => {
    if (shouldSupplementCategoryBars(commercialModeBarsFromApi, CATEGORY_RANKING_LIMIT)) {
      return mergeCategoryBars(commercialModeBarsFromApi, categoryFallback?.commercialMode);
    }
    return commercialModeBarsFromApi;
  }, [commercialModeBarsFromApi, categoryFallback]);
  const displayProposalBars = useMemo(() => limitCategoryBars(proposalBars), [proposalBars]);
  const displayContextBars = useMemo(() => limitCategoryBars(contextBars), [contextBars]);
  const displayToneBars = useMemo(() => limitCategoryBars(toneBars), [toneBars]);
  const displayReferenceBars = useMemo(() => limitCategoryBars(referenceBars), [referenceBars]);
  const contextExecutiveSummary = useMemo(
    () => buildCategoryExecutiveSummary(contextBars, "contexto"),
    [contextBars]
  );
  const proposalExecutiveSummary = useMemo(
    () => buildCategoryExecutiveSummary(proposalBars, "proposta"),
    [proposalBars]
  );
  const toneExecutiveSummary = useMemo(
    () => buildCategoryExecutiveSummary(toneBars, "tom"),
    [toneBars]
  );
  const referenceExecutiveSummary = useMemo(
    () => buildCategoryExecutiveSummary(referenceBars, "referência"),
    [referenceBars]
  );
  const formatExecutiveSummary = useMemo(
    () => buildCategoryExecutiveSummary(formatBars as Array<{ name: string; value: number; postsCount?: number }>, "formato"),
    [formatBars]
  );

  const heatmap = useMemo(() => {
    if (!showAdvancedSections || !isFormatTabActive) return [];
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
  }, [isFormatTabActive, postsSource, timeData, showAdvancedSections]);
  const benchmarkTopWindowsByPosts = useMemo(
    () => (timingBenchmark?.weekly?.topWindowsByPosts || []) as Array<{ dayOfWeek: number; startHour: number; endHour: number }>,
    [timingBenchmark?.weekly?.topWindowsByPosts]
  );
  const benchmarkTopWindowsByAverage = useMemo(
    () =>
      (timingBenchmark?.weekly?.topWindowsByAverage || []) as Array<{
        dayOfWeek: number;
        startHour: number;
        endHour: number;
      }>,
    [timingBenchmark?.weekly?.topWindowsByAverage]
  );
  const benchmarkTopWindowKeys = useMemo(
    () =>
      new Set(
        benchmarkTopWindowsByPosts.map((window) => `${window.dayOfWeek}:${window.startHour}`)
      ),
    [benchmarkTopWindowsByPosts]
  );
  const benchmarkPostingWindowLabel = useMemo(
    () => formatBenchmarkWindowList(benchmarkTopWindowsByPosts),
    [benchmarkTopWindowsByPosts]
  );
  const benchmarkPerformanceWindowLabel = useMemo(
    () => formatBenchmarkWindowList(benchmarkTopWindowsByAverage),
    [benchmarkTopWindowsByAverage]
  );

  const weeklyConsistency = useMemo(() => {
    if (!showAdvancedSections || !isFormatTabActive) return [];
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
  }, [isFormatTabActive, postsSource, showAdvancedSections]);
  const heatmapExecutiveSummary = useMemo(() => buildHeatmapExecutiveSummary(heatmap), [heatmap]);
  const consistencyExecutiveSummary = useMemo(
    () => buildConsistencyExecutiveSummary(weeklyConsistency as Array<{ posts: number; avgInteractions: number }>),
    [weeklyConsistency]
  );
  const benchmarkMetaLine = useMemo(() => {
    if (!timingBenchmarkEnabled || !benchmarkCohortLabel) return null;
    const creatorCount = Number(timingBenchmark?.cohort?.creatorCount || 0);
    const confidence =
      benchmarkCohortConfidence ? benchmarkConfidenceLabel[benchmarkCohortConfidence] : null;
    const parts = [
      creatorCount > 0 ? `${numberFormatter.format(creatorCount)} criadores` : null,
      benchmarkCohortLabel,
      confidence,
    ].filter(Boolean);
    return parts.join(" • ");
  }, [
    benchmarkCohortConfidence,
    benchmarkCohortLabel,
    timingBenchmark?.cohort?.creatorCount,
    timingBenchmarkEnabled,
  ]);

  const topFormatSample = useMemo(() => {
    const topRow = Array.isArray(formatData?.chartData) ? formatData.chartData[0] : null;
    const sample = toNumber(topRow?.postsCount ?? topRow?.count ?? topRow?.sampleSize);
    return typeof sample === "number" && sample > 0 ? Math.round(sample) : null;
  }, [formatData?.chartData]);

  const bestHourSample = useMemo(() => {
    const bestHourBar =
      hourBars
        .filter((bar) => typeof bar?.average === "number")
        .slice()
        .sort((a, b) => (b.average || 0) - (a.average || 0))[0] || null;
    const sample = toNumber(bestHourBar?.postsCount);
    return typeof sample === "number" && sample > 0 ? Math.round(sample) : null;
  }, [hourBars]);

  const recommendationActions = useMemo<RecommendationActionView[]>(() => {
    if (!rawRecommendationActions.length) return [];

    const resolveSampleSize = (action: PlanningRecommendationAction): number | null => {
      const explicitSample = toNumber(action.sampleSize);
      if (typeof explicitSample === "number" && explicitSample > 0) return Math.round(explicitSample);
      const actionId = action.id;
      switch (actionId) {
        case "duration":
          return typeof bestDurationBucket?.postsCount === "number" ? bestDurationBucket.postsCount : null;
        case "time_slot":
          return bestHourSample;
        case "tone_engagement":
          return typeof toneBars?.[0]?.postsCount === "number" ? toneBars[0].postsCount : null;
        case "proposal_engagement":
        case "proposal_leads":
          return typeof proposalBars?.[0]?.postsCount === "number" ? proposalBars[0].postsCount : null;
        case "context_reach":
        case "context_leads":
          return typeof contextBars?.[0]?.postsCount === "number" ? contextBars[0].postsCount : null;
        case "format_reach":
          return topFormatSample;
        case "trend_recovery":
        case "trend_scale":
        case "trend_stability":
          return trendSeries.length || null;
        case "baseline":
          return normalizedPosts.length || null;
        default:
          return null;
      }
    };

    const scored = rawRecommendationActions
      .map((action) => {
        const normalizedActionId = String(action.id || "").trim().toLowerCase();
        const normalizedFeedbackKey = String(action.feedbackKey || "").trim().toLowerCase();
        const feedbackMeta =
          feedbackMetaByActionId[normalizedFeedbackKey] ||
          feedbackMetaByActionId[normalizedActionId] ||
          null;
        const feedbackStatus =
          feedbackMeta?.status ||
          feedbackByActionId[normalizedFeedbackKey] ||
          feedbackByActionId[normalizedActionId] ||
          action.feedbackStatus ||
          null;
        const feedbackUpdatedAt = feedbackMeta?.updatedAt || action.feedbackUpdatedAt || null;
        const sampleSize = resolveSampleSize(action);
        const hasLowSampleGuardrail = Boolean(action.guardrailReason) ||
          (typeof sampleSize === "number" && sampleSize > 0 && sampleSize < 5);
        const confidenceAdjusted: PlanningRecommendationAction["confidence"] = hasLowSampleGuardrail
          ? "low"
          : action.confidence;
        const confidenceWeight = confidenceScoreMap[confidenceAdjusted] ?? 0.45;
        const sampleWeight = getSampleWeight(sampleSize);
        const impactSignal = extractImpactSignal(action.impactEstimate);
        const fallbackOpportunityScore = confidenceWeight * sampleWeight * (1 + impactSignal) * 100;
        const backendOpportunityScore = toNumber(action.opportunityScore);
        const opportunityScore =
          typeof backendOpportunityScore === "number" && backendOpportunityScore > 0
            ? backendOpportunityScore
            : fallbackOpportunityScore;
        const backendRankingScore = toNumber(action.rankingScore);
        const rankingScore =
          typeof backendRankingScore === "number" && backendRankingScore > 0
            ? backendRankingScore
            : Number((opportunityScore * feedbackRankingWeight(feedbackStatus)).toFixed(1));
        return {
          ...action,
          feedbackKey: normalizedFeedbackKey || normalizedActionId,
          confidenceAdjusted,
          sampleSize,
          hasLowSampleGuardrail,
          opportunityScore,
          rankingScore,
          feedbackStatus,
          feedbackUpdatedAt,
          executionState: action.executionState || "planned",
          queueStage: action.queueStage || "monitor",
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);

    let pendingIndex = 0;
    return scored.map((action) => {
      const executionState = resolveRecommendationExecutionState(action.feedbackStatus, action.feedbackUpdatedAt);
      const queueStage = resolveRecommendationQueueStage({
        executionState,
        pendingIndex,
        recommendationType: action.recommendationType,
      });
      if (executionState === "planned") pendingIndex += 1;
      return {
        ...action,
        executionState,
        queueStage,
      };
    });
  }, [
    bestDurationBucket?.postsCount,
    bestHourSample,
    contextBars,
    feedbackByActionId,
    feedbackMetaByActionId,
    normalizedPosts.length,
    proposalBars,
    rawRecommendationActions,
    toneBars,
    topFormatSample,
    trendSeries.length,
  ]);

  const appliedRecommendationCount = useMemo(
    () => recommendationActions.filter((action) => action.feedbackStatus === "applied").length,
    [recommendationActions]
  );
  const topStrategicAction = useMemo(
    () =>
      recommendationActions.find((action) => action.executionState === "planned" && action.queueStage === "now") ||
      recommendationActions.find((action) => action.executionState === "planned") ||
      recommendationActions[0] ||
      null,
    [recommendationActions]
  );
  const waitingImpactRecommendation = useMemo(
    () => recommendationActions.find((action) => action.executionState === "waiting_impact") || null,
    [recommendationActions]
  );
  const selectedRecommendationKey = useMemo(
    () =>
      selectedRecommendation
        ? String(selectedRecommendation.feedbackKey || selectedRecommendation.id || "").trim().toLowerCase()
        : "",
    [selectedRecommendation]
  );
  const directioningImpactKeys = useMemo(() => {
    const keys = new Set<string>();
    const waitingKey = waitingImpactRecommendation
      ? String(waitingImpactRecommendation.feedbackKey || waitingImpactRecommendation.id || "").trim().toLowerCase()
      : "";
    if (waitingKey) keys.add(waitingKey);
    if (selectedRecommendationKey) keys.add(selectedRecommendationKey);
    return keys;
  }, [selectedRecommendationKey, waitingImpactRecommendation]);
  const experimentImpactByActionKey = useMemo<Record<string, ExperimentImpactSummary>>(
    () => {
      if (directioningImpactKeys.size === 0) return {};
      return recommendationActions.reduce<Record<string, ExperimentImpactSummary>>((acc, action) => {
        const actionKey = String(action.feedbackKey || action.id || "").trim().toLowerCase();
        if (!actionKey || !directioningImpactKeys.has(actionKey)) return acc;
        const impactSummary =
          action.feedbackStatus === "applied"
            ? action.experimentImpact ||
              buildExperimentImpactSummary({
                action,
                feedbackUpdatedAt: action.feedbackUpdatedAt,
                posts: normalizedPosts,
                objectiveMode,
                metricLabel: action.metricLabel || primaryMetricLabel,
              })
            : null;
        if (actionKey && impactSummary) acc[actionKey] = impactSummary;
        return acc;
      }, {});
    },
    [directioningImpactKeys, normalizedPosts, objectiveMode, primaryMetricLabel, recommendationActions]
  );
  const waitingImpactSummary = useMemo(() => {
    if (!waitingImpactRecommendation) return null;
    const actionKey = String(waitingImpactRecommendation.feedbackKey || waitingImpactRecommendation.id || "").trim().toLowerCase();
    return experimentImpactByActionKey[actionKey] || null;
  }, [experimentImpactByActionKey, waitingImpactRecommendation]);
  const recentlyExecutedRecommendation = useMemo(
    () => recommendationActions.find((action) => action.executionState === "executed") || null,
    [recommendationActions]
  );
  const strategicDecisionLine = useMemo(() => {
    if (waitingImpactRecommendation && topStrategicAction && waitingImpactRecommendation.id !== topStrategicAction.id) {
      return waitingImpactSummary
        ? `${waitingImpactSummary.text} Enquanto isso, faça ${RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title}.`
        : `Você já fez ${RECOMMENDATION_TITLE_OVERRIDES[waitingImpactRecommendation.id] || waitingImpactRecommendation.title}. Agora faça ${RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title}.`;
    }
    if (waitingImpactRecommendation) {
      return waitingImpactSummary?.text || `Você já fez ${RECOMMENDATION_TITLE_OVERRIDES[waitingImpactRecommendation.id] || waitingImpactRecommendation.title}. Agora espere o resultado.`;
    }
    if (recentlyExecutedRecommendation && topStrategicAction && recentlyExecutedRecommendation.id !== topStrategicAction.id) {
      return `A última ação já foi feita. Agora faça ${RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title}.`;
    }
    if (directioningSummary?.headline) return directioningSummary.headline;
    if (!topStrategicAction) return "Ainda sem prioridade clara.";
    if (recommendationActions.length > 0 && appliedRecommendationCount >= recommendationActions.length) {
      return "Tudo desta lista já foi feito. Espere os próximos dados.";
    }
    if ((topStrategicAction as any).strategicSynopsis) {
      return (topStrategicAction as any).strategicSynopsis;
    }

    const focusTitle = RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title;
    if (topStrategicAction.hasLowSampleGuardrail) {
      return `Teste ${focusTitle}.`;
    }
    return `Faça ${focusTitle}.`;
  }, [
    appliedRecommendationCount,
    directioningSummary?.headline,
    recentlyExecutedRecommendation,
    recommendationActions.length,
    topStrategicAction,
    waitingImpactSummary,
    waitingImpactRecommendation,
  ]);
  const directioningNoGoLine = useMemo(() => {
    if (directioningSummary?.noGoLine) return directioningSummary.noGoLine;
    if (topStrategicAction?.whatNotToDo) return topStrategicAction.whatNotToDo;
    return "Não teste muitas coisas ao mesmo tempo.";
  }, [directioningSummary?.noGoLine, topStrategicAction]);
  const contentTabBrief = useMemo<TabBrief>(() => {
    const editorialLeader = getStrongestLeader([
      { dimension: "contexto", rows: contextBars, tone: contextExecutiveSummary.tone },
      { dimension: "proposta", rows: proposalBars, tone: proposalExecutiveSummary.tone },
      { dimension: "tom", rows: toneBars, tone: toneExecutiveSummary.tone },
    ]);
    const strategicLeader = getStrongestLeader([
      { dimension: "intenção", rows: contentIntentBars, tone: "neutral" },
      { dimension: "narrativa", rows: narrativeFormBars, tone: "neutral" },
      { dimension: "postura", rows: stanceBars, tone: "neutral" },
      { dimension: "prova", rows: proofStyleBars, tone: "neutral" },
    ]);
    const supportLeader = getStrongestLeader([
      { dimension: "sinal", rows: contentSignalsBars, tone: "neutral" },
      { dimension: "modo comercial", rows: commercialModeBars, tone: "neutral" },
    ]);

    if (!editorialLeader?.top?.name && !strategicLeader?.top?.name) {
      return {
        eyebrow: "O que postar",
        headline: "Ainda não repita uma linha só.",
        bulletPoints: [
          "Ainda não existe um caminho claro.",
          "Agora vale testar menos coisas ao mesmo tempo.",
        ],
        action: "Fixe uma ideia por alguns posts.",
        supportingNote: "Trocar muita coisa agora só confunde a leitura.",
        statusChip: "Exploração",
      };
    }
    const primaryLeader = strategicLeader || editorialLeader;
    const secondaryLeader = primaryLeader === editorialLeader ? strategicLeader : editorialLeader;
    const hasDistinctSecondary = Boolean(
      secondaryLeader?.top?.name &&
        (secondaryLeader.top.name !== primaryLeader?.top?.name || secondaryLeader.dimension !== primaryLeader?.dimension)
    );
    const leaderName = primaryLeader?.top?.name || "linha líder";
    const primaryMeaning = getContentLeaderMeaning(primaryLeader?.dimension, leaderName);
    const primarySampleLabel = formatActionSample(primaryLeader?.top?.postsCount);
    const secondaryMeaning =
      hasDistinctSecondary && secondaryLeader?.top?.name
        ? getContentLeaderMeaning(secondaryLeader.dimension, secondaryLeader.top.name)
        : null;
    const secondarySampleLabel =
      hasDistinctSecondary && secondaryLeader?.top?.name
        ? formatActionSample(secondaryLeader.top.postsCount)
        : null;
    const supportNoteLeader =
      supportLeader?.top?.name && supportLeader.top.name !== leaderName
        ? `${getContentDimensionLabel(supportLeader.dimension)} em destaque: ${supportLeader.top.name}${
            formatActionSample(supportLeader.top.postsCount) ? ` (${formatActionSample(supportLeader.top.postsCount)})` : ""
          }.`
        : null;
    const supportingNote =
      typeof primaryLeader?.top?.postsCount === "number" && primaryLeader.top.postsCount < 5
        ? `${primarySampleLabel || "Base curta"}. Confirme antes de expandir essa linha.${supportNoteLeader ? ` ${supportNoteLeader}` : ""}`
        : primarySampleLabel
          ? `${primarySampleLabel}. Use isso para decidir a próxima sequência.${supportNoteLeader ? ` ${supportNoteLeader}` : ""}`
          : `Use isso para decidir a próxima sequência, não para congelar a linha editorial.${supportNoteLeader ? ` ${supportNoteLeader}` : ""}`;
    return {
      eyebrow: "O que repetir",
      headline: `Repita ${leaderName}.`,
      bulletPoints: [
        primaryMeaning,
        hasDistinctSecondary && secondaryMeaning
          ? `${secondaryMeaning}${secondarySampleLabel ? ` ${secondarySampleLabel}.` : ""}`
          : typeof primaryLeader?.top?.postsCount === "number" && primaryLeader.top.postsCount < 5
          ? "Confirme isso antes de virar padrão."
          : "Hoje, esse é o caminho mais seguro.",
      ],
      action: hasDistinctSecondary && secondaryLeader?.top?.name
        ? `Junte ${leaderName} com ${secondaryLeader.top.name} nos próximos 2 ou 3 posts.`
        : getContentLeaderAction(primaryLeader?.dimension, leaderName),
      supportingNote,
      statusChip: getContentLeaderStatusChip(primaryLeader?.dimension),
    };
  }, [
    commercialModeBars,
    contentIntentBars,
    contextBars,
    contextExecutiveSummary.tone,
    contentSignalsBars,
    narrativeFormBars,
    proofStyleBars,
    proposalBars,
    proposalExecutiveSummary.tone,
    stanceBars,
    toneBars,
    toneExecutiveSummary.tone,
  ]);

  const combinedStrategicInsight = useMemo(() => {
    const topProposal = proposalBars[0]?.name;
    const topContext = contextBars[0]?.name;
    const topTone = toneBars[0]?.name;
    const topReference = referenceBars[0]?.name;

    if (!topProposal && !topContext) return strategicDecisionLine;

    let sentence = "Fazer conteúdo de ";
    sentence += topProposal || "sua linha principal";

    if (topContext) {
      sentence += ` em um tema ${topContext.toLowerCase()}`;
    }

    if (topTone) {
      sentence += `, utilizando um tom de voz ${topTone.toLowerCase()}`;
    }

    if (topReference) {
      sentence += ` e referência de ${topReference.toLowerCase()}`;
    }

    return sentence + ".";
  }, [proposalBars, contextBars, toneBars, referenceBars, strategicDecisionLine]);

	  const formatTabBrief = useMemo<TabBrief>(() => {
	    const bestFormat = formatBars[0];
	    const benchmarkNote = timingBenchmarkEnabled
	      ? [
          benchmarkPostingHoursLabel ? `Teste mais posts em ${benchmarkPostingHoursLabel}.` : null,
          benchmarkDurationPostingBucket ? `A duração mais comum nesse grupo é ${benchmarkDurationPostingBucket.label}.` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
    const strategicSetup =
      bestHour !== null && bestDurationBucket?.label && bestFormat?.name
        ? `Repita ${bestFormat.name} às ${bestHour}h em ${bestDurationBucket.label}.`
        : bestHour !== null && bestDurationBucket?.label
          ? `Repita perto de ${bestHour}h em ${bestDurationBucket.label}.`
          : bestDurationBucket?.label && bestFormat?.name
            ? `Repita ${bestFormat.name} em ${bestDurationBucket.label}.`
            : bestHour !== null
              ? `Repita perto de ${bestHour}h.`
              : bestDurationBucket?.label
                ? `Repita vídeos em ${bestDurationBucket.label}.`
                : bestFormat?.name
                  ? `Repita ${bestFormat.name}.`
                  : durationSummary.totalVideoPosts === 0
                    ? "Ainda não feche um padrão de execução."
                    : "Ainda não repita um padrão só.";
    const formatCaveat =
      durationSummary.durationCoverageRate < 0.7
        ? `Duração lida em ${(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos.`
        : lowSampleDurationBuckets > 0
          ? `${lowSampleDurationBuckets} faixa(s) com pouca base.`
          : null;
    return {
      eyebrow: "Como repetir",
      headline: strategicSetup,
      bulletPoints: formatCaveat ? [formatCaveat] : undefined,
      action:
        bestHour !== null && bestDurationBucket?.label && bestFormat?.name
          ? "Repita esse padrão por 3 posts."
          : bestHour !== null && bestDurationBucket?.label
          ? "Repita esse padrão por 3 posts."
          : "Teste um padrão por alguns posts.",
      supportingNote: benchmarkNote ?? null,
      statusChip:
        bestFormat?.name || (bestDurationBucket?.label ? `Faixa ${bestDurationBucket.label}` : bestHour !== null ? `${bestHour}h` : "Execução"),
    };
  }, [
    bestDurationBucket,
    bestHour,
    durationSummary.durationCoverageRate,
    durationSummary.totalVideoPosts,
    formatBars,
    benchmarkDurationPostingBucket,
    benchmarkPostingHoursLabel,
    lowSampleDurationBuckets,
    timingBenchmarkEnabled,
  ]);
  const audienceBriefStats = useMemo(() => {
    if (!isAudienceTabActive) {
      return {
        winnerCount: 0,
        attractsCount: 0,
        nurturesCount: 0,
      };
    }

    const rows = normalizedPosts
      .map((post: any) => {
        const reach = Math.max(0, toNumber(post?.stats?.reach) ?? toNumber(post?.stats?.views) ?? 0);
        if (reach <= 0) return null;
        const interactions = Math.max(0, toNumber(post?.stats?.total_interactions) ?? 0);
        const leadIntent = resolveLeadIntentProxy(post?.stats);
        const depth =
          objectiveMode === "leads"
            ? leadIntent
            : reach > 0
              ? (interactions / reach) * 1000
              : 0;
        return { reach, depth };
      })
      .filter(Boolean) as Array<{ reach: number; depth: number }>;

    if (rows.length < 4) {
      return {
        winnerCount: 0,
        attractsCount: 0,
        nurturesCount: 0,
      };
    }

    const reachMedian = medianOfNumbers(rows.map((row) => row.reach));
    const depthMedian = medianOfNumbers(rows.map((row) => row.depth));

    let winnerCount = 0;
    let attractsCount = 0;
    let nurturesCount = 0;

    rows.forEach((row) => {
      const isHighReach = row.reach >= reachMedian;
      const isHighDepth = row.depth >= depthMedian;
      if (isHighReach && isHighDepth) {
        winnerCount += 1;
        return;
      }
      if (isHighReach) {
        attractsCount += 1;
        return;
      }
      if (isHighDepth) {
        nurturesCount += 1;
      }
    });

    return {
      winnerCount,
      attractsCount,
      nurturesCount,
    };
  }, [isAudienceTabActive, normalizedPosts, objectiveMode]);
  const audienceTabBrief = useMemo<TabBrief>(() => {
    const balanceFact =
      audienceBriefStats.winnerCount > 0
        ? "Repita os posts que unem alcance e resposta."
        : audienceBriefStats.attractsCount > audienceBriefStats.nurturesCount
          ? "Mantenha o que atrai e ajuste a mensagem."
          : audienceBriefStats.nurturesCount > 0
            ? "Pegue o que responde bem e aumente a entrega."
            : "Ainda não abra novas frentes.";
    const discoveryMeaning =
      objectiveMode === "leads"
        ? "O post que chama atenção nem sempre é o que mais gera intenção."
        : "O post que alcança mais gente nem sempre é o que mais faz a audiência reagir.";
    const action =
      audienceBriefStats.attractsCount > audienceBriefStats.nurturesCount
        ? "Ajuste a mensagem antes de trocar o tema."
        : audienceBriefStats.nurturesCount > audienceBriefStats.attractsCount
          ? "Mude a abertura desse tipo de post antes de trocar a ideia."
          : "Repita esse padrão antes de testar novas variações.";
    return {
      eyebrow: "Resposta do público",
      headline: balanceFact,
      bulletPoints: [
        discoveryMeaning,
        audienceBriefStats.winnerCount > 0
          ? "Esses posts já mostraram alcance e resposta juntos."
          : audienceBriefStats.attractsCount > audienceBriefStats.nurturesCount
            ? "O problema está mais na mensagem."
            : audienceBriefStats.nurturesCount > 0
              ? "O problema está mais na entrega."
              : "Ainda falta padrão claro.",
      ],
      action,
      supportingNote: metricMeta?.isProxy
        ? `Parte desta leitura é estimada: ${metricMeta.description}`
        : "Alcance alto sozinho não prova interesse.",
      statusChip:
        audienceBriefStats.winnerCount > 0
          ? "Equilíbrio"
          : audienceBriefStats.attractsCount > audienceBriefStats.nurturesCount
            ? "Mais alcance"
            : audienceBriefStats.nurturesCount > 0
              ? "Mais resposta"
              : "Leitura inicial",
    };
  }, [
    audienceBriefStats.attractsCount,
    audienceBriefStats.nurturesCount,
    audienceBriefStats.winnerCount,
    metricMeta?.description,
    metricMeta?.isProxy,
    objectiveMode,
  ]);
  const currentTabBrief = useMemo<TabBrief | null>(() => {
    if (activeTab === "content") return contentTabBrief;
    if (activeTab === "format") return formatTabBrief;
    if (activeTab === "audience") return audienceTabBrief;
    return null;
  }, [activeTab, audienceTabBrief, contentTabBrief, formatTabBrief]);
  const currentTabGuardrails = useMemo<string[]>(() => {
    if (activeTab === "content") {
      const lowSampleLeader = [
        contextBars[0],
        proposalBars[0],
        toneBars[0],
        contentIntentBars[0],
        narrativeFormBars[0],
        stanceBars[0],
        proofStyleBars[0],
        contentSignalsBars[0],
        commercialModeBars[0],
      ].find(
        (item) => typeof item?.postsCount === "number" && item.postsCount > 0 && item.postsCount < 5
      );
        const notes = [
          lowSampleLeader
          ? `${lowSampleLeader.name} está na frente, mas com base curta.`
          : "A categoria líder mostra direção, não regra.",
        "Vencer no período não significa servir para todo objetivo.",
      ];
      return notes;
    }

    if (activeTab === "format") {
      const notes = [
        durationSummary.durationCoverageRate < 0.7
          ? `A leitura de duração cobre ${(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos.`
          : "Horário forte e duração forte não garantem resultado sozinhos.",
        lowSampleDurationBuckets > 0
          ? `${lowSampleDurationBuckets} faixa(s) de duração ainda têm pouca base.`
          : "Formato líder ajuda, mas não substitui um bom assunto.",
      ];
      return notes;
    }

    if (activeTab === "audience") {
      const notes = [
        metricMeta?.isProxy
          ? `Parte desta leitura é estimada: ${metricMeta.description}`
          : "Alcance alto não prova resposta forte.",
        "Post de descoberta pode não ser o mesmo post de conversão.",
      ];
      return notes.filter(Boolean) as string[];
    }

    const notes = [
      directioningNoGoLine,
      metricMeta?.isProxy && metricMeta?.description
        ? `Parte dessa leitura é estimada: ${metricMeta.description}`
        : "Faça a ação principal antes de abrir novas interpretações.",
    ];
    return notes.filter(Boolean) as string[];
  }, [
    activeTab,
    commercialModeBars,
    contentIntentBars,
    contentSignalsBars,
    contextBars,
    directioningNoGoLine,
    durationSummary.durationCoverageRate,
    lowSampleDurationBuckets,
    metricMeta?.description,
    metricMeta?.isProxy,
    narrativeFormBars,
    proofStyleBars,
    proposalBars,
    stanceBars,
    toneBars,
  ]);
  const objectiveLabel = OBJECTIVE_OPTIONS.find((option) => option.value === objectiveMode)?.label || "Engajamento";
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === timePeriod)?.label || timePeriod;
  const selectedRecommendationView = useMemo(
    () =>
      selectedRecommendation
        ? recommendationActions.find((action) => {
          const actionKey = String(action.feedbackKey || action.id || "").trim().toLowerCase();
          const selectedKey = String(selectedRecommendation.feedbackKey || selectedRecommendation.id || "")
            .trim()
            .toLowerCase();
          return actionKey === selectedKey;
        }) || null
        : null,
    [recommendationActions, selectedRecommendation]
  );
  const selectedRecommendationImpactSummary = useMemo(() => {
    if (!selectedRecommendationView) return null;
    const actionKey = String(selectedRecommendationView.feedbackKey || selectedRecommendationView.id || "").trim().toLowerCase();
    return experimentImpactByActionKey[actionKey] || null;
  }, [experimentImpactByActionKey, selectedRecommendationView]);
  const selectedRecommendationFeedbackKey = selectedRecommendationKey;
  const selectedRecommendationFeedbackLoading = selectedRecommendationFeedbackKey
    ? Boolean(feedbackMutationByActionId[selectedRecommendationFeedbackKey])
    : false;
  const handleTabChange = React.useCallback((nextTab: ActiveChartTab) => {
    setActiveTab(nextTab);
    setShowMobileControls(false);
  }, []);
  const directioningSectionItems = useMemo(
    () => {
      if (activeTab !== "directioning") return [];
      return recommendationActions.map((item) => {
        const actionFeedbackKey = String(item.feedbackKey || item.id || "").trim().toLowerCase();
        return {
          id: item.id,
          key: item.feedbackKey || item.id,
          title: RECOMMENDATION_TITLE_OVERRIDES[item.id] || item.title,
          nextStepOrAction: item.nextStep || item.action,
          metaLine: `${recommendationTypeLabel[recommendationTypeFallback(item.recommendationType)]} • ${
            executionStateLabel[item.executionState || "planned"]
          }`,
          queueStageClassName: queueStageClassName[item.queueStage],
          queueStageLabel: queueStageLabel[item.queueStage],
          feedbackStatus: item.feedbackStatus,
          isFeedbackUpdating: Boolean(feedbackMutationByActionId[actionFeedbackKey]),
        };
      });
    },
    [activeTab, feedbackMutationByActionId, recommendationActions]
  );
  const mobileHourItems = useMemo<MobileBarListItem[]>(
    () => {
      if (!isFormatTabActive) return [];
      return hourBenchmarkSeries
        .slice()
        .sort((a, b) => (b.average || 0) - (a.average || 0))
        .slice(0, 4)
        .map((item) => ({
          id: `hour-${item.hour}`,
          label: `${item.hour}h`,
          value: item.average,
          postsCount: item.postsCount,
          helper:
            !useCompactFormatCharts && timingBenchmarkEnabled && typeof item.benchmarkAverage === "number"
              ? `Grupo parecido: ${numberFormatter.format(Math.round(item.benchmarkAverage))}`
              : null,
        }));
    },
    [hourBenchmarkSeries, isFormatTabActive, timingBenchmarkEnabled, useCompactFormatCharts]
  );
  const mobileDurationItems = useMemo<MobileBarListItem[]>(
    () => {
      if (!isFormatTabActive) return [];
      return durationBenchmarkSeries
        .filter((item) => item.postsCount > 0)
        .slice()
        .sort((a, b) => (b.averageInteractions || 0) - (a.averageInteractions || 0))
        .map((item) => ({
          id: `duration-${item.key}`,
          label: item.label,
          value: item.averageInteractions,
          postsCount: item.postsCount,
          helper:
            !useCompactFormatCharts && timingBenchmarkEnabled && typeof item.benchmarkAverage === "number"
              ? `Grupo parecido: ${numberFormatter.format(Math.round(item.benchmarkAverage))}`
              : null,
        }));
    },
    [durationBenchmarkSeries, isFormatTabActive, timingBenchmarkEnabled, useCompactFormatCharts]
  );
  const mobileDurationCoverageItems = useMemo<MobileBarListItem[]>(
    () => {
      if (!isFormatTabActive) return [];
      return durationCoverageBenchmarkSeries
        .filter((item) => item.usageSharePct > 0)
        .slice()
        .sort((a, b) => (b.usageSharePct || 0) - (a.usageSharePct || 0))
        .map((item) => ({
          id: `coverage-${item.key}`,
          label: item.label,
          value: item.usageSharePct,
          postsCount: item.postsCount,
          helper:
            !useCompactFormatCharts && timingBenchmarkEnabled && typeof item.benchmarkUsageSharePct === "number"
              ? `Grupo parecido: ${formatPercentLabel(item.benchmarkUsageSharePct)}`
              : null,
        }));
    },
    [durationCoverageBenchmarkSeries, isFormatTabActive, timingBenchmarkEnabled, useCompactFormatCharts]
  );
  const mobileWeekWindowItems = useMemo<MobileBarListItem[]>(() => {
    if (!isFormatTabActive) return [];
    if (!heatmap.length) return [];
    const windowMap = new Map<string, { day: number; startHour: number; endHour: number; scoreSum: number; count: number }>();
    heatmap.forEach((row) => {
      const startHour = Math.floor(row.hour / 4) * 4;
      const endHour = Math.min(startHour + 3, 23);
      const key = `${row.day}-${startHour}`;
      const current = windowMap.get(key) || { day: row.day, startHour, endHour, scoreSum: 0, count: 0 };
      current.scoreSum += row.score;
      current.count += 1;
      windowMap.set(key, current);
    });
    return Array.from(windowMap.values())
      .map((window) => {
        const avgScore = window.count > 0 ? window.scoreSum / window.count : 0;
        const benchmarkHit = benchmarkTopWindowKeys.has(`${window.day}:${window.startHour}`);
        return {
          id: `week-${window.day}-${window.startHour}`,
          label: `${WEEKDAY_SHORT_SUN_FIRST[window.day - 1] || `Dia ${window.day}`} ${window.startHour}h-${window.endHour}h`,
          value: avgScore * 100,
          helper: !useCompactFormatCharts && benchmarkHit ? "Janela também forte no grupo parecido" : null,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [benchmarkTopWindowKeys, heatmap, isFormatTabActive, useCompactFormatCharts]);
  const compactChartTabs = useMemo(
    () =>
      CHART_TABS
        .filter((tab) => tab.id !== "directioning"),
    []
  );
  const compactObjectiveOptions = useMemo(
    () => OBJECTIVE_OPTIONS.filter((option) => option.value !== "leads"),
    []
  );
  const compactPeriodOptions = useMemo(
    () =>
      PERIOD_OPTIONS.map((option) => ({
        ...option,
        label:
          option.value === "all_time"
            ? "Todo período"
            : option.label.replace(/^Últimos\s+/i, "").replace(/^Todo histórico$/i, "Todo período"),
      })),
    []
  );
  const compactContentMetricRows = useMemo<CompactMetricSectionItem[]>(
    () => [
      {
        key: "proposal",
        title: "Proposta",
        rows: proposalBars,
        loading: loadingProposal,
        visualKey: "proposal",
        icon: <Sparkles className="h-4 w-4" />,
        emptyText: loadingProposal ? "Carregando propostas..." : "Sem propostas registradas no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("proposal", row.name, `${primaryMetricShortLabel} por proposta`),
      },
      {
        key: "context",
        title: "Tema",
        rows: contextBars,
        loading: loadingPosts,
        visualKey: "context",
        icon: <Target className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando temas..." : "Sem temas registrados no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("context", row.name, `${primaryMetricShortLabel} por tema`),
      },
      {
        key: "tone",
        title: "Tom",
        rows: toneBars,
        loading: loadingTone,
        visualKey: "tone",
        icon: <ZapIcon className="h-4 w-4" />,
        emptyText: loadingTone ? "Carregando tons..." : "Sem tons registrados no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("tone", row.name, `${primaryMetricShortLabel} por tom`),
      },
      {
        key: "references",
        title: "Referência",
        rows: referenceBars,
        loading: loadingReference,
        visualKey: "references",
        icon: <Copy className="h-4 w-4" />,
        emptyText: loadingReference ? "Carregando referências..." : "Sem referências registradas.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("references", row.name, `${primaryMetricShortLabel} por referência`),
      },
      {
        key: "content-intent",
        title: "Intenção",
        rows: contentIntentBars,
        loading: loadingPosts,
        visualKey: "content-intent",
        icon: <Sparkles className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando intenções..." : "Sem intenções registradas no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("contentIntent", row.name, `${primaryMetricShortLabel} por intenção`),
      },
      {
        key: "narrative-form",
        title: "Narrativa",
        rows: narrativeFormBars,
        loading: loadingPosts,
        visualKey: "narrative-form",
        icon: <LineChartIcon className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando narrativas..." : "Sem narrativas registradas no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("narrativeForm", row.name, `${primaryMetricShortLabel} por narrativa`),
      },
      {
        key: "content-signals",
        title: "Sinais",
        rows: contentSignalsBars,
        loading: loadingPosts,
        visualKey: "content-signals",
        icon: <FilterIcon className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando sinais..." : "Sem sinais registrados no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("contentSignals", row.name, `${primaryMetricShortLabel} por sinal`),
      },
      {
        key: "stance",
        title: "Postura",
        rows: stanceBars,
        loading: loadingPosts,
        visualKey: "stance",
        icon: <Users className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando posturas..." : "Sem posturas registradas no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("stance", row.name, `${primaryMetricShortLabel} por postura`),
      },
      {
        key: "proof-style",
        title: "Prova",
        rows: proofStyleBars,
        loading: loadingPosts,
        visualKey: "proof-style",
        icon: <CheckCircle2 className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando provas..." : "Sem provas registradas no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("proofStyle", row.name, `${primaryMetricShortLabel} por prova`),
      },
      {
        key: "commercial-mode",
        title: "Modo comercial",
        rows: commercialModeBars,
        loading: loadingPosts,
        visualKey: "commercial-mode",
        icon: <LineChartIcon className="h-4 w-4" />,
        emptyText: loadingPosts ? "Carregando sinais comerciais..." : "Sem sinais comerciais registrados no período.",
        onSelect: (row: CategoryBarDatum) =>
          handleCategoryClick("commercialMode", row.name, `${primaryMetricShortLabel} por modo comercial`),
      },
    ],
    [
      commercialModeBars,
      contentIntentBars,
      contentSignalsBars,
      contextBars,
      handleCategoryClick,
      loadingPosts,
      loadingProposal,
      loadingReference,
      loadingTone,
      narrativeFormBars,
      primaryMetricShortLabel,
      proofStyleBars,
      proposalBars,
      referenceBars,
      stanceBars,
      toneBars,
    ]
  );
  const compactFormatMetricRows = useMemo<CompactMetricSectionItem[]>(
    () => [
      {
        key: "hour",
        title: "Horário",
        rows: mobileHourItems.map((item) => ({ name: item.label, value: item.value, postsCount: item.postsCount ?? undefined })),
        loading: loadingTime,
        visualKey: "context",
        icon: <Clock3 className="h-4 w-4" />,
        emptyText: "Sem dados no período.",
        onSelect: (row: CategoryBarDatum) => {
          const hour = Number(row.name.replace("h", ""));
          if (Number.isFinite(hour)) {
            handleHourClick(hour, `Melhor horário para ${primaryMetricShortLabel.toLowerCase()}`);
          }
        },
      },
      {
        key: "duration",
        title: "Duração",
        rows: mobileDurationItems.map((item: any) => ({ name: item.label, value: item.value, postsCount: item.postsCount ?? undefined })),
        loading: loadingDuration,
        visualKey: "narrative-form",
        icon: <LineChartIcon className="h-4 w-4" />,
        emptyText: durationSummary.totalVideoPosts === 0 ? "Sem vídeos no período." : "Sem base para comparar.",
        onSelect: (row: CategoryBarDatum) => {
          const bucket = DURATION_BUCKETS.find((entry) => entry.label === row.name);
          if (bucket) {
            handleDurationBucketClick(bucket.key, `${primaryMetricShortLabel} por faixa de duração`);
          }
        },
      },
      {
        key: "format",
        title: "Formato",
        rows: formatBars.map((item: any) => ({ name: item.name, value: item.value, postsCount: item.postsCount })),
        loading: loadingFormat,
        visualKey: "references",
        icon: <LineChartIcon className="h-4 w-4" />,
        emptyText: "Sem formato no período.",
        onSelect: (row: CategoryBarDatum) => handleCategoryClick("format", row.name, `${primaryMetricShortLabel} por formato`),
      },
      {
        key: "week",
        title: "Semana",
        rows: mobileWeekWindowItems.map((item: any) => ({ name: item.label, value: item.value, postsCount: item.postsCount ?? undefined })),
        loading: loadingTime,
        visualKey: "proposal",
        icon: <CalendarIcon className="h-4 w-4" />,
        emptyText: "Sem base para o mapa.",
        valueFormatter: (value: number) => `${Math.round(value)} pts`,
        onSelect: (row: CategoryBarDatum) => {
          const source = mobileWeekWindowItems.find((item) => item.label === row.name);
          if (!source) return;
          const sourceMatch = source.id.match(/^week-(\d+)-(\d+)$/);
          if (!sourceMatch) return;
          const dow = Number(sourceMatch[1]);
          const startHour = Number(sourceMatch[2]);
          handleDayHourClick(dow, startHour, Math.min(startHour + 3, 23), "Mapa de horários");
        },
      },
      {
        key: "coverage",
        title: "Cobertura",
        rows: mobileDurationCoverageItems.map((item: any) => ({ name: item.label, value: item.value, postsCount: item.postsCount ?? undefined })),
        loading: loadingDuration,
        visualKey: "content-signals",
        icon: <Clock3 className="h-4 w-4" />,
        emptyText:
          durationSummary.totalVideoPosts === 0 ? "Sem vídeos no período." : durationSummary.totalPostsWithDuration === 0 ? "Leitura indisponível." : "Leitura indisponível.",
        valueFormatter: (value: number) => formatPercentLabel(value),
        onSelect: (row: CategoryBarDatum) => {
          const bucket = DURATION_BUCKETS.find((entry) => entry.label === row.name);
          if (bucket) {
            handleDurationBucketClick(bucket.key, "Vídeos por faixa de duração");
          }
        },
      },
    ],
    [
      durationSummary.totalPostsWithDuration,
      durationSummary.totalVideoPosts,
      formatBars,
      handleCategoryClick,
      handleDayHourClick,
      handleDurationBucketClick,
      handleHourClick,
      loadingDuration,
      loadingFormat,
      loadingTime,
      mobileDurationCoverageItems,
      mobileDurationItems,
      mobileHourItems,
      mobileWeekWindowItems,
      primaryMetricShortLabel,
    ]
  );

  React.useEffect(() => {
    if (!isCompactBoard) return;
    if (activeTab === "directioning") {
      setActiveTab("content");
    }
  }, [activeTab, isCompactBoard]);

  return (
    <>
		      <Board 
		          title="Análise de Perfil" 
            promoteHeaderOnMobile
            mobilePresentation={useMobileAppView ? "flat" : "surface"}
	          titleInlineAction={showPinButton ? (
                <BoardPinButton
                  boardId="profile-analysis"
                  boardTitle="Análise de Perfil"
                  redirectOnPin={pinButtonRedirectOnPin}
                />
              ) : null}
		          titleMarkerVariant="chip"
          showTitleMarker={showTitleMarker}
		          variant="card"
          desktopWidthClassName={!isCompactBoard ? dedicatedDesktopWidthClassName : ""}
	          showChevron={false}
          showOptions={false}
          className="mx-auto h-full"
          contentClassName={useMobileAppView ? "bg-transparent" : ""}
          disableMobilePaddingTop={useMobileAppView}
          titleClassName={useMobileAppView ? "text-lg leading-tight" : ""}
          isHighlighted={isHighlighted}
          headerActions={
            <div className="flex items-center gap-2">
              {isAdminViewer && !isCompactBoard && (
                <div className="w-64 sm:w-72 relative z-[100]">
                  <CreatorQuickSearch 
                    onSelect={(user) => setAdminTargetUser({ id: user.id, name: user.name, profilePictureUrl: user.profilePictureUrl || "" })}
                    selectedCreatorName={adminTargetUser?.name || null}
                    selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                    onClear={() => setAdminTargetUser(null)}
                  />
                </div>
              )}
            </div>
          }
        >
          <div className={`sticky top-0 z-30 shrink-0 backdrop-blur-md ${
            useMobileAppView
              ? "bg-[linear-gradient(180deg,rgba(243,244,246,0.96),rgba(243,244,246,0.92)_74%,rgba(243,244,246,0))]"
              : "border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))]"
          }`}>
            {/* Board Header & Tabs */}
            <div className={`${useMobileAppView ? "px-2 pt-0.5" : "px-6"} ${useMobileAppView ? "bg-transparent" : ""}`}>
              {isActingOnBehalf && (
                <div className="mb-3 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Visualizando: {adminTargetUser?.name}
                </div>
              )}

              {isAdminViewer && isCompactBoard ? (
                <div className="pb-2 pt-3">
                  <div className="relative z-[100] w-full">
                    <CreatorQuickSearch
                      onSelect={(user) => setAdminTargetUser({ id: user.id, name: user.name, profilePictureUrl: user.profilePictureUrl || "" })}
                      selectedCreatorName={adminTargetUser?.name || null}
                      selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                      onClear={() => setAdminTargetUser(null)}
                    />
                  </div>
                </div>
              ) : null}
              {!isAdminViewer && isCompactBoard ? (
                <div className="pb-2 pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/planning/graficos")}
                    className="dashboard-input dashboard-type-body flex min-h-[2.5rem] w-full items-center gap-2.5 border-rose-100/80 bg-[radial-gradient(circle_at_left,rgba(244,114,182,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,244,0.88))] px-4 py-3 text-left text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] hover:border-amber-100/80 hover:bg-[radial-gradient(circle_at_left,rgba(251,191,36,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,1),rgba(255,247,250,0.9))]"
                  >
                    <Search className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>Buscar criador...</span>
                  </button>
                </div>
              ) : null}

              {isCompactBoard ? (
                <div className="mt-0.5 flex items-center gap-2 px-0 pb-2">
                  <div className="min-w-0 flex-1">
                    <ThreadsTabs
                      tabs={compactChartTabs}
                      activeTab={activeTab}
                      onChange={(id) => handleTabChange(id as ActiveChartTab)}
                      compact
                      variant="segmented"
                      segmentedTheme="mono"
                      className="w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,247,248,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(24,24,27,0.035)] ring-1 ring-white/75"
                    />
                  </div>

                  {useMobileAppView ? (
                    <div ref={compactControlsRef} className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowMobileControls((current) => !current)}
                        className={`relative inline-flex h-[2.375rem] w-[2.375rem] items-center justify-center rounded-full border transition-all duration-200 ${
                          showMobileControls
                            ? "border-zinc-900 bg-zinc-950 text-white shadow-[0_8px_18px_rgba(24,24,27,0.16)]"
                            : "border-zinc-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,244,245,0.86))] text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                        }`}
                        aria-label="Abrir filtros"
                        aria-expanded={showMobileControls}
                        aria-haspopup="dialog"
                      >
                        <FilterIcon className="h-4 w-4" />
                        {((objectiveMode !== "engagement") || timePeriod !== DEFAULT_TIME_PERIOD) ? (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-zinc-300" />
                        ) : null}
                      </button>

                      {!isMobileViewport && showMobileControls ? (
                        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[228px] rounded-[1.2rem] border border-zinc-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(246,246,247,0.95))] p-3 shadow-[0_16px_36px_rgba(24,24,27,0.08)] backdrop-blur-xl">
                          <div className="space-y-3">
                            {recommendationsFeatureEnabled ? (
                              <div className="space-y-2">
                                <p className="dashboard-muted-label text-zinc-400">Base</p>
                                <div className="dashboard-segmented flex w-fit max-w-full items-center gap-1 overflow-x-auto no-scrollbar p-0.5">
                                  {compactObjectiveOptions.map((opt) => (
                                    <button
                                      key={opt.value}
                                      onClick={() => handleObjectiveModeChange(opt.value)}
                                      className={`dashboard-type-control min-h-[2.125rem] rounded-full px-3 py-1.5 whitespace-nowrap transition-all duration-200 ${
                                        objectiveMode === opt.value
                                          ? "bg-zinc-950 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950"
                                          : "text-zinc-500 hover:bg-white/80 hover:text-zinc-800"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-2">
                              <p className="dashboard-muted-label text-zinc-400">Janela</p>
                              <div className="relative group">
                                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-700" />
                                <select
                                  id="timePeriod"
                                  value={timePeriod}
                                  onChange={(e) => handleTimePeriodChange(e.target.value)}
                                  className="dashboard-type-control dashboard-select min-h-[2.25rem] w-full cursor-pointer bg-white/78 pl-9 pr-9 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                                >
                                  {compactPeriodOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400 transition-transform group-focus-within:rotate-180" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <ThreadsTabs
                  tabs={CHART_TABS}
                  activeTab={activeTab}
                  onChange={(id) => handleTabChange(id as ActiveChartTab)}
                  compact={false}
                  variant="underline"
                />
              )}
            </div>

            {!isCompactBoard ? (
              <div className="border-t border-zinc-100/70 bg-zinc-50/32 px-6 py-3">
              <div className="flex items-center gap-3">
	                  {recommendationsFeatureEnabled ? (
                      <div className="dashboard-segmented flex items-center gap-1 p-1">
                        {OBJECTIVE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleObjectiveModeChange(opt.value)}
                            className={`dashboard-type-control min-h-[2.5rem] rounded-full px-3 py-1.5 transition-all duration-200 ${
                              objectiveMode === opt.value
                                ? "bg-[linear-gradient(180deg,#fff,#fff7fa)] text-zinc-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-pink-100/70"
                                : "text-zinc-500 hover:text-zinc-800"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
	                  ) : null}

                  <div className="relative group ml-auto shrink-0">
                    <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-700" />
                    <select
                      id="timePeriod"
                      value={timePeriod}
                      onChange={(e) => handleTimePeriodChange(e.target.value)}
                      className="dashboard-type-control dashboard-select min-w-[138px] cursor-pointer pl-9 pr-9 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400 transition-transform group-focus-within:rotate-180" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className={`${isCompactBoard ? "px-2 pb-6 pt-2" : "px-4 pb-4 pt-2.5"} relative space-y-3.5`}>
            {isDemoMode && <ProfileAnalysisFunnelOverlay />}
            <div className={isDemoMode ? "pointer-events-none select-none opacity-50 blur-[2px]" : ""}>

          <Drawer open={isMobileViewport && showMobileControls} onClose={() => setShowMobileControls(false)} title="Ajustar análise">
            <div className="space-y-4 sm:hidden">
              {recommendationsFeatureEnabled ? (
                <section className="space-y-2">
                  <p className="dashboard-muted-label text-zinc-400">Meta</p>
                  <div className="dashboard-segmented grid grid-cols-3 gap-2 p-1.5">
                    {OBJECTIVE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleObjectiveModeChange(opt.value)}
                        className={`rounded-xl px-2 py-2.5 text-[11px] font-bold transition ${objectiveMode === opt.value
                          ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                          : "text-zinc-500"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="dashboard-muted-label text-zinc-400">Janela de tempo</p>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <select
                    id="timePeriodMobile"
                    value={timePeriod}
                    onChange={(e) => handleTimePeriodChange(e.target.value)}
                    className="dashboard-select w-full min-h-[46px] pl-10 pr-10 text-sm font-bold text-zinc-700"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-zinc-100/90 bg-zinc-50/68 p-3.5">
                <p className="dashboard-muted-label text-zinc-400">Métrica-base</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{primaryMetricLabel}</p>
                {metricMeta?.isProxy && metricMeta?.description ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{metricMeta.description}</p>
                ) : null}
              </section>

              {recommendationsFeatureEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    handleGoToPlanner("recommendations_card");
                    setShowMobileControls(false);
                  }}
                  className="dashboard-primary-button w-full px-4 py-3 text-sm font-semibold"
                >
                  Abrir Planejamento
                </button>
              ) : null}
            </div>
          </Drawer>


	            <div ref={advancedSectionsSentinelRef} className="h-px w-full" />
            {advancedSectionsReady ? (
              <>

                {activeTab === "directioning" && (
                  <PlanningChartsDirectioningSection
                    recommendationsFeatureEnabled={recommendationsFeatureEnabled}
                    directioningNoGoLine={directioningNoGoLine}
                    loadingBatch={loadingBatch}
                    items={directioningSectionItems}
                    onApply={(itemId) => {
                      const target = recommendationActions.find((item) => item.id === itemId);
                      if (target) submitRecommendationFeedback(target, "applied");
                    }}
                    onSkip={(itemId) => {
                      const target = recommendationActions.find((item) => item.id === itemId);
                      if (target) submitRecommendationFeedback(target, "not_applied");
                    }}
                    onOpenEvidence={(itemId) => {
                      const target = recommendationActions.find((item) => item.id === itemId);
                      if (target) openRecommendationEvidence(target);
                    }}
                  />
                )}
                {activeTab !== "directioning" && activeTab !== "format" && activeTab !== "audience" && currentTabBrief && !(isCompactBoard && activeTab === "content") ? (
                  <section className="mb-4">
                    <PlanningChartsStrategicHeroCard
                      variant="inline"
                      eyebrow={currentTabBrief.eyebrow}
                      headline={activeTab === "content" ? combinedStrategicInsight : currentTabBrief.headline}
                      reading={currentTabBrief.reading}
                      bulletPoints={currentTabBrief.bulletPoints}
                      action={currentTabBrief.action}
                      supportingNote={currentTabBrief.supportingNote}
                      statusChip={currentTabBrief.statusChip}
                    />
                  </section>
                ) : null}
                {activeTab === "content" && isCompactBoard ? (
                  <PlanningChartsCompactMetricSection items={compactContentMetricRows} />
                ) : null}
	                {activeTab === "content" && !isCompactBoard && (
                    <PlanningContentDesktopSection
                      chartHeaderTextClassName={chartHeaderTextClassName}
                      chartHeightClassName={chartHeightClassName}
                      useCompactContentCharts={useCompactContentCharts}
                      isCompactBoard={isCompactBoard}
                      loadingProposal={loadingProposal}
                      displayProposalBars={displayProposalBars}
                      loadingPosts={loadingPosts}
                      displayContextBars={displayContextBars}
                      loadingTone={loadingTone}
                      displayToneBars={displayToneBars}
                      loadingReference={loadingReference}
                      displayReferenceBars={displayReferenceBars}
                      primaryMetricShortLabel={primaryMetricShortLabel}
                      primaryMetricUnitLabel={primaryMetricUnitLabel}
                      handleCategoryClick={handleCategoryClick}
                      contentIntentBars={contentIntentBars}
                      narrativeFormBars={narrativeFormBars}
                      contentSignalsBars={contentSignalsBars}
                      stanceBars={stanceBars}
                      proofStyleBars={proofStyleBars}
                      commercialModeBars={commercialModeBars}
                    />
                )}

                {activeTab === "format" && isCompactBoard ? (
                  <PlanningChartsCompactMetricSection items={compactFormatMetricRows} />
                ) : null}

	                {activeTab === "format" && !isCompactBoard && (
                    <PlanningFormatDesktopSection
                      UserAvatarComponent={UserAvatar}
                      chartHeaderTextClassName={chartHeaderTextClassName}
                      chartHeightClassName={chartHeightClassName}
                      chartCompactHeightClassName={chartCompactHeightClassName}
                      useCompactFormatCharts={useCompactFormatCharts}
                      isCompactBoard={isCompactBoard}
                      bestHour={bestHour}
                      timingBenchmark={timingBenchmark}
                      timingBenchmarkEnabled={timingBenchmarkEnabled}
                      benchmarkToneClassName={benchmarkToneClassName}
                      bestHourBenchmarkStatus={bestHourBenchmarkStatus}
                      benchmarkMetaLine={benchmarkMetaLine}
                      loadingTime={loadingTime}
                      hourBars={hourBars}
                      timePeriod={timePeriod}
                      handleTimePeriodChange={handleTimePeriodChange}
                      mobileHourItems={mobileHourItems}
                      handleHourClick={handleHourClick}
                      hourBenchmarkSeries={hourBenchmarkSeries}
                      primaryMetricShortLabel={primaryMetricShortLabel}
                      primaryMetricTooltipLabel={primaryMetricTooltipLabel}
                      bestDurationBucket={bestDurationBucket}
                      bestDurationBenchmarkStatus={bestDurationBenchmarkStatus}
                      loadingDuration={loadingDuration}
                      durationSummary={durationSummary}
                      mobileDurationItems={mobileDurationItems}
                      DURATION_BUCKETS={DURATION_BUCKETS}
                      handleDurationBucketClick={handleDurationBucketClick}
                      durationBenchmarkSeries={durationBenchmarkSeries}
                      loadingFormat={loadingFormat}
                      formatBars={formatBars}
                      formatBenchmarkSeries={formatBenchmarkSeries}
                      bestFormatBenchmarkStatus={bestFormatBenchmarkStatus}
                      canShowFormatBenchmarkLine={canShowFormatBenchmarkLine}
                      primaryMetricUnitLabel={primaryMetricUnitLabel}
                      handleCategoryClick={handleCategoryClick}
                      heatmapExecutiveSummary={heatmapExecutiveSummary}
                      heatmap={heatmap}
                      mobileWeekWindowItems={mobileWeekWindowItems}
                      handleDayHourClick={handleDayHourClick}
                      benchmarkTopWindowKeys={benchmarkTopWindowKeys}
                      mobileDurationCoverageItems={mobileDurationCoverageItems}
                      durationCoverageBenchmarkSeries={durationCoverageBenchmarkSeries}
                      totalSimilarCreatorsCount={totalSimilarCreatorsCount}
                      similarCreatorsSummaryLabel={similarCreatorsSummaryLabel}
                      loadingBatch={loadingBatch}
                      chartsBatchData={chartsBatchData}
                      similarCreatorsEnabled={similarCreatorsEnabled}
                      similarCreators={similarCreators}
                      similarCreatorItems={similarCreatorItems}
                      activeUserId={activeUserId}
                      canShowAffiliateInvite={canShowAffiliateInvite}
                      handleCopyAffiliateInvite={handleCopyAffiliateInvite}
                      viewer={viewer}
                      affiliateCopyStatus={affiliateCopyStatus}
                    />
                  )}

			                {activeTab === "audience" && (
                    <PlanningChartsAudienceTabSection
                      chartHeaderTextClassName={chartHeaderTextClassName}
                      chartTallHeightClassName={chartTallHeightClassName}
                      chartHeightClassName={chartHeightClassName}
                      chartCompactHeightClassName={chartCompactHeightClassName}
                      objectiveMode={objectiveMode}
                      isMobileViewport={isMobileViewport}
                      handleStrategyPointClick={handleStrategyPointClick}
                      handlePlayVideo={handlePlayVideo}
                      loadingPosts={loadingPosts}
                      loadingTrend={loadingTrend}
                      mobileAudienceTrendMetric={mobileAudienceTrendMetric}
                      setMobileAudienceTrendMetric={setMobileAudienceTrendMetric}
                      trendSeries={trendSeries}
                      handleWeekClick={handleWeekClick}
                      formatWeekLabel={formatWeekLabel}
                      mobileDepthMetric={mobileDepthMetric}
                      setMobileDepthMetric={setMobileDepthMetric}
                      handleCategoryClick={handleCategoryClick}
                      showAdvancedSections={showAdvancedSections}
                      isAudienceTabActive={isAudienceTabActive}
                      isCompactBoard={isCompactBoard}
                      postsSource={postsSource}
                      normalizedPosts={normalizedPosts}
                    />
                )}
              </>
            ) : (
                <section className="grid gap-4 grid-cols-1">
                {[0, 1].map((index) => (
                  <article key={index} className={cardBase}>
                    <div className="h-[340px] animate-pulse rounded-xl bg-slate-100/80" />
                  </article>
                ))}
              </section>
            )}
            </div>
          </div>
        </Board>
      <Drawer
        open={Boolean(selectedRecommendation)}
        onClose={closeRecommendationEvidence}
        title="Entenda a sugestão"
      >
        {selectedRecommendation ? (
          <PlanningChartsRecommendationDrawer
            title={RECOMMENDATION_TITLE_OVERRIDES[selectedRecommendation.id] || selectedRecommendation.title}
            queueStageClassName={queueStageClassName[selectedRecommendation.queueStage || "monitor"]}
            queueStageLabel={queueStageLabel[selectedRecommendation.queueStage || "monitor"]}
            headline={selectedRecommendation.nextStep || selectedRecommendation.action}
            description={simplifyEvidenceText(
              selectedRecommendation.meaning ||
                selectedRecommendation.strategicSynopsis ||
                "Resumo direto para orientar a próxima ação."
            )}
            metaLine={buildRecommendationMetaLine({
              recommendationType: selectedRecommendation.recommendationType,
              executionState: selectedRecommendation.executionState,
              feedbackStatus: selectedRecommendationView?.feedbackStatus,
              feedbackUpdatedAt: selectedRecommendationView?.feedbackUpdatedAt,
            })}
            sampleBaseText={formatSampleBaseText(selectedRecommendationView?.sampleSize)}
            confidenceText={`Sinal ${confidenceLabel[
              selectedRecommendationView?.confidenceAdjusted || selectedRecommendation.confidence
            ]?.toLowerCase()}`}
            compositeConfidenceText={
              directioningSummary?.compositeConfidence?.label
                ? `${directioningSummary.compositeConfidence.label}${
                    typeof directioningSummary.compositeConfidence.score === "number"
                      ? ` (${Math.round(directioningSummary.compositeConfidence.score)}/100)`
                      : ""
                  }`
                : null
            }
            metricLabel={selectedRecommendation.metricLabel || primaryMetricLabel}
            periodLabel={selectedRecommendation.timeWindowLabel || periodLabel}
            completedAtText={
              selectedRecommendationView?.feedbackUpdatedAt
                ? formatShortDateTime(selectedRecommendationView.feedbackUpdatedAt)
                : null
            }
            impactText={
              selectedRecommendationView?.feedbackUpdatedAt
                ? simplifyEvidenceText(
                    selectedRecommendationImpactSummary?.text ||
                      `Desde então: ${directioningSummary?.primarySignal?.text || strategicDecisionLine}`
                  )
                : null
            }
            beforeAfterText={
              selectedRecommendationImpactSummary &&
              typeof selectedRecommendationImpactSummary.beforeAvg === "number" &&
              typeof selectedRecommendationImpactSummary.afterAvg === "number"
                ? `Antes: ${numberFormatter.format(
                    Math.round(selectedRecommendationImpactSummary.beforeAvg)
                  )} • Depois: ${numberFormatter.format(
                    Math.round(selectedRecommendationImpactSummary.afterAvg)
                  )}`
                : null
            }
            evidenceItems={selectedRecommendation.evidence.slice(0, 2).map((item) => simplifyEvidenceText(item))}
            evidenceOverflowCount={Math.max(0, selectedRecommendation.evidence.length - 2)}
            confidenceFactorsText={
              directioningSummary?.compositeConfidence?.factors?.length
                ? `${directioningSummary.compositeConfidence.factors
                    .slice(0, 2)
                    .map((factor) => factor.label)
                    .join(" e ")}.`
                : null
            }
            guardrailText={
              selectedRecommendationView?.hasLowSampleGuardrail
                ? formatGuardrailText(selectedRecommendationView.guardrailReason)
                : null
            }
            experimentSuccessSignal={selectedRecommendation.experimentPlan?.successSignal ?? null}
            experimentSampleGoal={selectedRecommendation.experimentPlan?.sampleGoal ?? null}
            feedbackStatus={selectedRecommendationView?.feedbackStatus ?? null}
            feedbackLoading={selectedRecommendationFeedbackLoading}
            onApply={() => submitRecommendationFeedback(selectedRecommendation, "applied")}
            onSkip={() => submitRecommendationFeedback(selectedRecommendation, "not_applied")}
            onGoToPlanner={() => handleGoToPlanner("recommendation_drawer")}
          />
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
