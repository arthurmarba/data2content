"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { AlertCircle, ArrowUpRight, Calendar as CalendarIcon, CheckCircle2, ChevronDown as ChevronDownIcon, Clock3, Copy, Database, ExternalLink, Filter as FilterIcon, Gift, LineChart as LineChartIcon, Search, Sparkles, Target, Users, Zap as ZapIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer as RechartsResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Drawer from "@/components/ui/Drawer";
import Board from "@/app/dashboard/components/Board";
import BoardPinButton from "@/app/dashboard/boards/BoardPinButton";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import CreatorQuickSearch from "@/app/admin/creator-dashboard/components/CreatorQuickSearch";
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
import { PROFILE_ANALYSIS_DEMO_DATA } from "./profileAnalysisDemoData";
import ProfileAnalysisFunnelOverlay from "./components/ProfileAnalysisFunnelOverlay";

const PostsBySliceModal = dynamic(() => import("./components/PostsBySliceModal"), {
  ssr: false,
  loading: () => null,
});
const DiscoverVideoModal = dynamic(() => import("@/app/discover/components/DiscoverVideoModal"), {
  ssr: false,
  loading: () => null,
});
const UserAvatar = dynamic(() => import("@/app/components/UserAvatar").then((mod) => mod.UserAvatar), {
  ssr: false,
  loading: () => <div className="h-11 w-11 rounded-full bg-slate-100" />,
});
const TopDiscoveryTable = dynamic(() => import("./components/TopDiscoveryTable").then((mod) => mod.TopDiscoveryTable), {
  ssr: false,
  loading: () => null,
});

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
const compactNumberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
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
type BackendStrategicMetricDelta = {
  currentAvg: number | null;
  previousAvg: number | null;
  deltaRatio: number | null;
  currentPosts: number;
  previousPosts: number;
  hasMinimumSample: boolean;
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
  { id: "format", label: "Formato & Timing" },
  { id: "audience", label: "Sua Audiência" },
  { id: "directioning", label: "Próximo passo" },
];

const formatDeltaSummary = (delta: DeltaInsight | null, metricLabel: string): ExecutiveDeltaSummary => {
  if (!delta) {
    return { text: "Ainda faltam dados para comparar.", tone: "warning" };
  }
  const pct = Math.round(delta.deltaRatio * 100);
  if (Math.abs(pct) < 3) {
    return { text: `${metricLabel}: sem mudança forte no período recente.`, tone: "neutral" };
  }
  if (pct > 0) {
    return { text: `${metricLabel}: +${pct}% no período recente.`, tone: "positive" };
  }
  return { text: `${metricLabel}: ${pct}% no período recente.`, tone: "negative" };
};
const formatStrategicDeltaSummary = (
  metric: BackendStrategicMetricDelta | null | undefined,
  metricLabel: string
): ExecutiveDeltaSummary | null => {
  if (!metric) return null;
  if (!metric.hasMinimumSample) {
    return {
      text: `Base pequena: ${formatPostsCount(metric.currentPosts)} agora e ${formatPostsCount(metric.previousPosts)} antes.`,
      tone: "warning",
    };
  }
  if (typeof metric.deltaRatio !== "number" || !Number.isFinite(metric.deltaRatio)) {
    return { text: "Ainda falta base para comparar com o período anterior.", tone: "warning" };
  }
  const pct = Math.round(metric.deltaRatio * 100);
  if (Math.abs(pct) < 3) {
    return { text: `${metricLabel}: ficou no mesmo nível.`, tone: "neutral" };
  }
  if (pct > 0) {
    return { text: `${metricLabel}: ${pct}% acima do período anterior.`, tone: "positive" };
  }
  return { text: `${metricLabel}: ${Math.abs(pct)}% abaixo do período anterior.`, tone: "negative" };
};
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
const buildDeepEngagementExecutiveSummary = (
  rows: Array<{ format: string; savesPerThousand: number; sharesPerThousand: number; postsCount: number }>
): ExecutiveDeltaSummary => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { text: "Ainda faltam dados para avaliar salvos e compartilhamentos.", tone: "warning" };
  }
  const top = rows[0];
  const topScore = (toNumber(top?.savesPerThousand) ?? 0) + (toNumber(top?.sharesPerThousand) ?? 0);
  const topSample = toNumber(top?.postsCount) ?? 0;
  const topLabel = String(top?.format || "formato líder");
  if (topSample > 0 && topSample < 5) {
    return {
      text: `Base pequena: ${topLabel} está na frente com ${formatPostsCount(topSample)}.`,
      tone: "warning",
    };
  }
  if (topScore <= 0.5) {
    return {
      text: "Atenção: poucos salvos e compartilhamentos no período.",
      tone: "negative",
    };
  }

  const runnerUp = rows[1];
  const runnerScore = runnerUp
    ? (toNumber(runnerUp.savesPerThousand) ?? 0) + (toNumber(runnerUp.sharesPerThousand) ?? 0)
    : 0;
  if (!runnerScore || runnerScore <= 0) {
    return {
      text: `${topLabel} puxou mais salvos e compartilhamentos no período.`,
      tone: "positive",
    };
  }
  const dominancePct = Math.round(((topScore - runnerScore) / runnerScore) * 100);
  if (dominancePct >= 12) {
    return {
      text: `${topLabel} está na frente (+${dominancePct}% vs 2º formato).`,
      tone: "positive",
    };
  }
  return {
    text: `${topLabel} está na frente, mas por margem curta.`,
    tone: "neutral",
  };
};
const buildWeeklyRateExecutiveSummary = (
  rows: Array<{ avgRate: number }>
): ExecutiveDeltaSummary => {
  if (!Array.isArray(rows) || rows.length < 3) {
    return { text: "Ainda faltam dados para avaliar resposta semanal.", tone: "warning" };
  }
  const latest = rows[rows.length - 1];
  const latestRate = Math.max(0, toNumber(latest?.avgRate) ?? 0);
  const latestPct = `${(latestRate * 100).toFixed(1)}%`;
  const delta = buildPeriodDelta(rows, (row) => toNumber((row as any)?.avgRate), 3);
  if (!delta) {
    return { text: `Resposta recente em ${latestPct}.`, tone: "neutral" };
  }
  const pct = Math.round(delta.deltaRatio * 100);
  if (Math.abs(pct) < 3) {
    return { text: `Resposta recente em ${latestPct}, sem mudança forte.`, tone: "neutral" };
  }
  if (pct > 0) {
    return { text: `Boa evolução: resposta semanal em ${latestPct} (+${pct}% no bloco recente).`, tone: "positive" };
  }
  return { text: `Atenção: resposta semanal em ${latestPct} (${pct}% no bloco recente).`, tone: "negative" };
};
const buildTopDiscoveryExecutiveSummary = (
  stats: { avgShare: number; avgVisits: number; peakLabel?: string; peakShare?: number } | null,
  rows: Array<{ caption: string; nf: number | null }>
): ExecutiveDeltaSummary => {
  if (!stats || !Array.isArray(rows) || rows.length === 0) {
    return { text: "Ainda faltam dados para avaliar público novo.", tone: "warning" };
  }
  const top = rows[0];
  if (!top) {
    return { text: "Ainda faltam dados para avaliar público novo.", tone: "warning" };
  }
  const topShare = Math.max(0, toNumber(top?.nf) ?? toNumber(stats.peakShare) ?? 0);
  const runnerShare = rows[1] ? Math.max(0, toNumber(rows[1]?.nf) ?? 0) : 0;
  const topLabel = (stats.peakLabel || top.caption || "post líder").slice(0, 32);

  if (topShare < 30) {
    return { text: `Atenção: pouco público novo no topo (${Math.round(topShare)}%).`, tone: "negative" };
  }

  if (runnerShare > 0) {
    const dominancePct = Math.round(((topShare - runnerShare) / runnerShare) * 100);
    if (dominancePct >= 15) {
      return {
        text: `"${topLabel}" puxou público novo (+${dominancePct}% vs 2º post).`,
        tone: "positive",
      };
    }
  }

  return {
    text: `Topo em público novo: ${Math.round(topShare)}%.`,
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

function ResponsiveContainer({
  children,
  width = "100%",
  height = "100%",
  ...rest
}: React.ComponentProps<typeof RechartsResponsiveContainer>) {
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [isMeasured, setIsMeasured] = React.useState(false);

  React.useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof window === "undefined") return;

    let frameId: number | null = null;

    const updateMeasuredState = () => {
      frameId = null;
      const rect = node.getBoundingClientRect();
      const nextMeasured = rect.width > 0 && rect.height > 0;
      setIsMeasured((current) => (current === nextMeasured ? current : nextMeasured));
    };

    updateMeasuredState();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
        frameId = window.requestAnimationFrame(updateMeasuredState);
      });

      observer.observe(node);

      return () => {
        observer.disconnect();
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const timeoutId = window.setTimeout(updateMeasuredState, 0);
    return () => {
      window.clearTimeout(timeoutId);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <div ref={frameRef} className="h-full w-full min-h-[176px] min-w-0">
      {isMeasured ? (
        <RechartsResponsiveContainer width={width} height={height} {...rest}>
          {children}
        </RechartsResponsiveContainer>
      ) : null}
    </div>
  );
}

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
type CategoryCardConfig = {
  field: CategoryField;
  title: string;
  emptyText: string;
  color: string;
  accentClassName: string;
  subtitle: string;
  loadingText: string;
};
type CompactCategoryVisual = {
  accentClassName: string;
  iconClassName: string;
  iconContainerClassName: string;
  rankBadgeClassName: string;
  trackClassName: string;
  buttonClassName: string;
  arrowClassName: string;
  summaryHintClassName: string;
};
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

type MobileBarListItem = {
  id: string;
  label: string;
  value: number;
  postsCount?: number | null;
  helper?: string | null;
};

const COMPACT_CATEGORY_VISUALS = {
  proposal: {
    accentClassName: "bg-indigo-500",
    iconClassName: "text-indigo-600",
    iconContainerClassName: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90",
    rankBadgeClassName: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90",
    trackClassName: "bg-indigo-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-indigo-100 hover:bg-indigo-50/45 focus:outline-none focus-visible:border-indigo-200 focus-visible:bg-indigo-50/60",
    arrowClassName: "text-indigo-300 group-hover:text-indigo-500 group-focus-visible:text-indigo-500",
    summaryHintClassName: "text-indigo-500",
  },
  context: {
    accentClassName: "bg-sky-500",
    iconClassName: "text-sky-600",
    iconContainerClassName: "bg-sky-50 text-sky-600 ring-1 ring-sky-100/90",
    rankBadgeClassName: "bg-sky-50 text-sky-600 ring-1 ring-sky-100/90",
    trackClassName: "bg-sky-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-sky-100 hover:bg-sky-50/45 focus:outline-none focus-visible:border-sky-200 focus-visible:bg-sky-50/60",
    arrowClassName: "text-sky-300 group-hover:text-sky-500 group-focus-visible:text-sky-500",
    summaryHintClassName: "text-sky-500",
  },
  tone: {
    accentClassName: "bg-emerald-500",
    iconClassName: "text-emerald-600",
    iconContainerClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90",
    rankBadgeClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90",
    trackClassName: "bg-emerald-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-emerald-100 hover:bg-emerald-50/45 focus:outline-none focus-visible:border-emerald-200 focus-visible:bg-emerald-50/60",
    arrowClassName: "text-emerald-300 group-hover:text-emerald-500 group-focus-visible:text-emerald-500",
    summaryHintClassName: "text-emerald-500",
  },
  references: {
    accentClassName: "bg-amber-500",
    iconClassName: "text-amber-600",
    iconContainerClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    rankBadgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    trackClassName: "bg-amber-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-amber-100 hover:bg-amber-50/45 focus:outline-none focus-visible:border-amber-200 focus-visible:bg-amber-50/60",
    arrowClassName: "text-amber-300 group-hover:text-amber-500 group-focus-visible:text-amber-500",
    summaryHintClassName: "text-amber-600",
  },
  "content-intent": {
    accentClassName: "bg-blue-600",
    iconClassName: "text-blue-600",
    iconContainerClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100/90",
    rankBadgeClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100/90",
    trackClassName: "bg-blue-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-blue-100 hover:bg-blue-50/45 focus:outline-none focus-visible:border-blue-200 focus-visible:bg-blue-50/60",
    arrowClassName: "text-blue-300 group-hover:text-blue-500 group-focus-visible:text-blue-500",
    summaryHintClassName: "text-blue-500",
  },
  "narrative-form": {
    accentClassName: "bg-violet-600",
    iconClassName: "text-violet-600",
    iconContainerClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100/90",
    rankBadgeClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100/90",
    trackClassName: "bg-violet-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-violet-100 hover:bg-violet-50/45 focus:outline-none focus-visible:border-violet-200 focus-visible:bg-violet-50/60",
    arrowClassName: "text-violet-300 group-hover:text-violet-500 group-focus-visible:text-violet-500",
    summaryHintClassName: "text-violet-500",
  },
  "content-signals": {
    accentClassName: "bg-teal-600",
    iconClassName: "text-teal-600",
    iconContainerClassName: "bg-teal-50 text-teal-600 ring-1 ring-teal-100/90",
    rankBadgeClassName: "bg-teal-50 text-teal-600 ring-1 ring-teal-100/90",
    trackClassName: "bg-teal-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-teal-100 hover:bg-teal-50/45 focus:outline-none focus-visible:border-teal-200 focus-visible:bg-teal-50/60",
    arrowClassName: "text-teal-300 group-hover:text-teal-500 group-focus-visible:text-teal-500",
    summaryHintClassName: "text-teal-500",
  },
  stance: {
    accentClassName: "bg-rose-500",
    iconClassName: "text-rose-600",
    iconContainerClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100/90",
    rankBadgeClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100/90",
    trackClassName: "bg-rose-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-rose-100 hover:bg-rose-50/45 focus:outline-none focus-visible:border-rose-200 focus-visible:bg-rose-50/60",
    arrowClassName: "text-rose-300 group-hover:text-rose-500 group-focus-visible:text-rose-500",
    summaryHintClassName: "text-rose-500",
  },
  "proof-style": {
    accentClassName: "bg-amber-700",
    iconClassName: "text-amber-700",
    iconContainerClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    rankBadgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    trackClassName: "bg-amber-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-amber-100 hover:bg-amber-50/45 focus:outline-none focus-visible:border-amber-200 focus-visible:bg-amber-50/60",
    arrowClassName: "text-amber-300 group-hover:text-amber-600 group-focus-visible:text-amber-600",
    summaryHintClassName: "text-amber-700",
  },
  "commercial-mode": {
    accentClassName: "bg-pink-600",
    iconClassName: "text-pink-600",
    iconContainerClassName: "bg-pink-50 text-pink-600 ring-1 ring-pink-100/90",
    rankBadgeClassName: "bg-pink-50 text-pink-600 ring-1 ring-pink-100/90",
    trackClassName: "bg-pink-100/80",
    buttonClassName: "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-pink-100 hover:bg-pink-50/45 focus:outline-none focus-visible:border-pink-200 focus-visible:bg-pink-50/60",
    arrowClassName: "text-pink-300 group-hover:text-pink-500 group-focus-visible:text-pink-500",
    summaryHintClassName: "text-pink-500",
  },
} satisfies Record<string, CompactCategoryVisual>;

function MobileBarList({
  items,
  emptyText,
  accentClassName,
  valueFormatter,
  onSelect,
  dense = false,
  maxItems,
}: {
  items: MobileBarListItem[];
  emptyText: string;
  accentClassName: string;
  valueFormatter: (value: number) => string;
  onSelect?: (item: MobileBarListItem) => void;
  dense?: boolean;
  maxItems?: number;
}) {
  const visibleItems = typeof maxItems === "number" ? items.slice(0, maxItems) : items;

  if (!visibleItems.length) {
    return <p className="text-sm text-zinc-500">{emptyText}</p>;
  }

  const maxValue = visibleItems.reduce((currentMax, item) => Math.max(currentMax, item.value), 0);

  return (
    <div className={dense ? "space-y-2" : "space-y-2.5"}>
      {visibleItems.map((item) => {
        const width = maxValue > 0 ? Math.max(12, (item.value / maxValue) * 100) : 12;
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`dashboard-muted-label ${dense ? "text-[10px]" : "text-[11px]"} text-zinc-400`}>
                  {item.label}
                </p>
                {item.helper ? (
                  <p className={`dashboard-type-meta ${dense ? "mt-0.5 text-[11px]" : "mt-1"} leading-relaxed text-zinc-500`}>
                    {item.helper}
                  </p>
                ) : null}
              </div>
              <p className={`dashboard-type-kpi-sm ${dense ? "text-[13px]" : "text-sm"} shrink-0 tabular-nums`}>
                {valueFormatter(item.value)}
              </p>
            </div>
            <div className={`${dense ? "mt-1.5 h-3" : "mt-2 h-2.5"} dashboard-progress-track`}>
              <div className={`h-full rounded-full ${accentClassName}`} style={{ width: `${width}%` }} />
            </div>
            {typeof item.postsCount === "number" && item.postsCount > 0 ? (
              <p className={`dashboard-type-meta ${dense ? "mt-1 text-[10px]" : "mt-1 text-[11px]"} text-zinc-400`}>
                {formatPostsCount(item.postsCount)}
              </p>
            ) : null}
          </>
        );

        if (!onSelect) {
          return (
            <div
              key={item.id}
              className={
                dense
                  ? "rounded-[1.05rem] border border-zinc-100/90 bg-zinc-50/62 p-2.5"
                  : "rounded-[1.35rem] border border-zinc-100/90 bg-zinc-50/68 p-3"
              }
            >
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full text-left transition ${
              dense
                ? "rounded-[1.05rem] border border-zinc-100/90 bg-zinc-50/62 p-2.5 hover:border-zinc-200 hover:bg-white/86"
                : "rounded-[1.35rem] border border-zinc-100/90 bg-zinc-50/68 p-3 hover:border-zinc-200 hover:bg-white/86"
            }`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function CompactCategoryRankingSummary({
  title,
  rows,
  loading,
  visual,
  icon,
  emptyText,
  onSelect,
  valueFormatter,
}: {
  title: string;
  rows: CategoryBarDatum[];
  loading: boolean;
  visual: CompactCategoryVisual;
  icon: React.ReactNode;
  emptyText: string;
  onSelect?: (row: CategoryBarDatum) => void;
  valueFormatter?: (value: number) => string;
}) {
  if (loading) {
    return (
      <div className="py-3.5">
        <p className="dashboard-type-section-title">{title}</p>
        <p className="dashboard-type-body mt-2">{emptyText}</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="py-3.5">
        <p className="dashboard-type-section-title">{title}</p>
        <p className="dashboard-type-body mt-2">{emptyText}</p>
      </div>
    );
  }

  const visibleRows = limitCategoryBars(rows);
  const maxValue = Math.max(...visibleRows.map((row) => row.value), 0);

  return (
    <div className="border-t border-zinc-100/75 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${visual.iconContainerClassName}`}>
          <span className={visual.iconClassName}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="dashboard-type-section-title text-zinc-950">{title}</p>
        </div>
      </div>
      </div>

      <div className="mt-3.5 space-y-3">
        {visibleRows.map((row, index) => {
          const width = maxValue > 0 ? Math.max(12, Math.min(100, (row.value / maxValue) * 100)) : 0;
          const content = (
            <>
              <div className="flex items-start gap-3.5">
                <span className={`dashboard-type-control inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${visual.rankBadgeClassName}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="dashboard-type-item-title line-clamp-2 pr-2 leading-snug text-zinc-900">{row.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="dashboard-type-meta text-zinc-400">
                          {typeof row.postsCount === "number" && row.postsCount > 0 ? formatPostsCount(row.postsCount) : "Sem posts suficientes"}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="dashboard-type-kpi-sm block tabular-nums text-zinc-900">
                        {valueFormatter ? valueFormatter(row.value) : numberFormatter.format(Math.round(row.value))}
                      </span>
                    </div>
                  </div>
                  <div className={`dashboard-progress-track mt-3 h-1.5 rounded-full ${visual.trackClassName}`}>
                    <div className={`h-full rounded-full ${visual.accentClassName}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              </div>
            </>
          );

          if (!onSelect) {
            return (
              <div key={`${title}-${row.name}-${index}`} className="rounded-[1.15rem] px-2 py-2">
                {content}
              </div>
            );
          }

          return (
            <button
              key={`${title}-${row.name}-${index}`}
              type="button"
              onClick={() => onSelect(row)}
              className={`group w-full cursor-pointer text-left ${visual.buttonClassName}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">{content}</div>
                <span className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 transition ${visual.arrowClassName}`}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

const STRATEGIC_CATEGORY_CARDS: CategoryCardConfig[] = [
  {
    field: "contentIntent",
    title: "Intenção",
    emptyText: "Sem intenções no período.",
    color: "#2563eb",
    accentClassName: "bg-blue-600",
    subtitle: "Intenção",
    loadingText: "Carregando intenções...",
  },
  {
    field: "narrativeForm",
    title: "Narrativa",
    emptyText: "Sem narrativas no período.",
    color: "#7c3aed",
    accentClassName: "bg-violet-600",
    subtitle: "Forma narrativa",
    loadingText: "Carregando narrativas...",
  },
  {
    field: "contentSignals",
    title: "Sinais",
    emptyText: "Sem sinais no período.",
    color: "#0f766e",
    accentClassName: "bg-teal-600",
    subtitle: "Sinais de conteúdo",
    loadingText: "Carregando sinais...",
  },
  {
    field: "stance",
    title: "Postura",
    emptyText: "Sem posturas registradas no período.",
    color: "#dc2626",
    accentClassName: "bg-rose-600",
    subtitle: "Postura",
    loadingText: "Carregando posturas...",
  },
  {
    field: "proofStyle",
    title: "Prova",
    emptyText: "Sem provas no período.",
    color: "#a16207",
    accentClassName: "bg-amber-700",
    subtitle: "Estilo de prova",
    loadingText: "Carregando provas...",
  },
  {
    field: "commercialMode",
    title: "Modo comercial",
    emptyText: "Sem sinais de venda no período.",
    color: "#db2777",
    accentClassName: "bg-pink-600",
    subtitle: "Modo comercial",
    loadingText: "Carregando modos comerciais...",
  },
];

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

const formatCompactFollowers = (value: number | null | undefined) => {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (safeValue === null || safeValue <= 0) return "base não informada";
  return `${compactNumberFormatter.format(safeValue)} seguidores`;
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

type StrategicHeroCardProps = {
  variant?: "default" | "compact" | "inline";
  eyebrow: string;
  headline: string;
  reading?: string | null;
  bulletPoints?: string[];
  action?: string | null;
  supportingNote?: string | null;
  statusChip?: string | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

const StrategicHeroCard = ({
  variant = "default",
  eyebrow,
  headline,
  reading,
  bulletPoints,
  action,
  supportingNote,
  statusChip,
  children,
  footer,
}: StrategicHeroCardProps) => {
  const isCompact = variant === "compact";
  const isInline = variant === "inline";

  if (isInline) {
    return (
      <article className="dashboard-dark-spotlight relative overflow-hidden rounded-[1.2rem] border border-white/5 px-3 py-2 shadow-[0_18px_30px_rgba(15,23,42,0.18)]">
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 py-0.5">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pink-500/10">
              <Sparkles className="h-2.5 w-2.5 text-pink-300" />
            </div>
            <h2 className="text-[11px] font-semibold text-white/95 leading-tight">
              {headline}
            </h2>
          </div>
          {statusChip && (
            <span className="dashboard-glass-pill shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
              {statusChip}
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`dashboard-dark-spotlight relative overflow-hidden rounded-[1.75rem] ${
        isCompact ? "px-3.5 py-3 shadow-lg sm:px-4 sm:py-3.5" : "px-4 py-3.5 shadow-xl"
      }`}
    >
      <div
        className={`absolute rounded-full bg-pink-500/20 ${
          isCompact ? "-right-6 -top-6 h-28 w-28 blur-2xl" : "-right-10 -top-10 h-40 w-40 blur-3xl"
        }`}
      />
      <div
        className={`absolute rounded-full bg-amber-400/10 ${
          isCompact ? "-bottom-8 -left-8 h-28 w-28 blur-2xl" : "-bottom-10 -left-10 h-40 w-40 blur-3xl"
        }`}
      />

      <div className={`relative ${isCompact ? "space-y-2.5" : "space-y-1.5"}`}>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2">
              <Sparkles className={`text-pink-300 ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-200">{eyebrow}</span>
            </div>
            {statusChip ? (
              <span
                className={`dashboard-glass-pill inline-flex items-center rounded-full font-semibold text-white/80 ${
                  isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
                }`}
              >
                {statusChip}
              </span>
            ) : null}
          </div>
          <h2
            className={`font-semibold leading-tight text-white ${
              isCompact ? "max-w-4xl text-[1.05rem] sm:text-[1.2rem]" : "max-w-3xl text-xl sm:text-2xl"
            }`}
          >
            {headline}
          </h2>
        </div>

        {isCompact && bulletPoints && bulletPoints.length > 0 ? (
          <ul className="space-y-1.5">
            {bulletPoints.slice(0, 2).map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-white sm:text-sm">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-pink-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : reading ? (
          <p className={`leading-relaxed text-white ${isCompact ? "max-w-4xl text-[13px] sm:text-sm" : "text-sm"}`}>{reading}</p>
        ) : null}

        {children}

        {action || supportingNote ? (
          isCompact ? (
            <div className="border-t border-white/10 pt-2">
              {action ? (
                <p className="text-sm font-medium leading-relaxed text-white">
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-100">Faça agora</span>
                  {action}
                </p>
              ) : null}
              {supportingNote ? (
                <p className={`${action ? "mt-1" : ""} text-[11px] leading-relaxed text-white/80`}>{supportingNote}</p>
              ) : null}
            </div>
          ) : (
            <div className="pt-1">
              {action ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pink-100">Faça agora</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-white">{action}</p>
                </>
              ) : null}
              {supportingNote ? (
                <p className={`${action ? "mt-1.5" : ""} text-xs leading-relaxed text-white/80`}>{supportingNote}</p>
              ) : null}
            </div>
          )
        ) : null}

        {footer}
      </div>
    </article>
  );
};

function CategoryPerformanceCard({
  config,
  rows,
  isLoading,
  isMobileViewport,
  primaryMetricShortLabel,
  primaryMetricUnitLabel,
  onCategoryClick,
}: {
  config: CategoryCardConfig;
  rows: CategoryBarDatum[];
  isLoading: boolean;
  isMobileViewport: boolean;
  primaryMetricShortLabel: string;
  primaryMetricUnitLabel: string;
  onCategoryClick: (field: CategoryField, value: string, subtitle: string) => void;
}) {
  const visibleRows = limitCategoryBars(rows);

  return (
    <article className={cardBase}>
      <header className="flex items-center justify-between gap-3">
        <div className={chartHeaderTextClassName}>
          <h2 className="text-base font-semibold text-slate-900">{config.title}</h2>
        </div>
        <Sparkles className="h-5 w-5 text-slate-500" />
      </header>
      <div className={isMobileViewport ? "mt-3" : chartHeightClassName}>
        {isLoading ? (
          <p className="text-sm text-slate-500">{config.loadingText}</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-slate-500">{config.emptyText}</p>
        ) : isMobileViewport ? (
          <MobileBarList
            items={visibleRows.map((item) => ({
              id: item.name,
              label: item.name,
              value: item.value,
              postsCount: item.postsCount,
            }))}
            emptyText={config.emptyText}
            accentClassName={config.accentClassName}
            valueFormatter={(value) => numberFormatter.format(Math.round(value))}
            onSelect={(item) =>
              onCategoryClick(config.field, item.label, `${primaryMetricShortLabel} por ${config.subtitle.toLowerCase()}`)
            }
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={visibleRows}
              layout="vertical"
              margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
              style={{ cursor: "pointer" }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#475569", fontSize: 12 }}
                width={150}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="value"
                name={primaryMetricUnitLabel}
                fill={config.color}
                radius={[0, 6, 6, 0]}
                onClick={(state: any) => {
                  const value = state?.payload?.name ? String(state.payload.name) : null;
                  if (value) {
                    onCategoryClick(config.field, value, `${primaryMetricShortLabel} por ${config.subtitle.toLowerCase()}`);
                  }
                }}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value: number) => numberFormatter.format(Math.round(value))}
                  fill="#64748b"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}

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
}: {
  viewer?: ViewerInfo;
  showPinButton?: boolean;
  pinButtonRedirectOnPin?: boolean;
  compactView?: boolean;
  mobileAppView?: boolean;
  showTitleMarker?: boolean;
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
  const billing = useBillingStatus();
  
  const isDemoMode = useMemo(() => {
    // Se não há usuário logado ou não tem Instagram conectado ou não é Pro, entra em modo Demo
    return !activeUserId || !billing.hasPremiumAccess || !billing.instagram?.connected;
  }, [activeUserId, billing.hasPremiumAccess, billing.instagram?.connected]);

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
  const advancedSectionsReady = showAdvancedSections;
  const chartsBatchSurface = isCompactBoard && !advancedSectionsReady ? "board" : "full";
  const listSurface = isCompactBoard ? "board" : "full";
  const useCompactContentCharts = isCompactBoard || isMobileViewport;
  const useCompactFormatCharts = isCompactBoard || isMobileViewport;
  const autoPrefetchPagesCap = Math.min(
    MAX_PAGES,
    AUTO_PREFETCH_PAGE_CAP_BY_PERIOD[timePeriod] ?? 2
  );

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

  const { data: chartsBatchData, isLoading: loadingBatch, mutate: mutateChartsBatch } = useSWR(
    activeUserId
      ? `/api/v1/users/${activeUserId}/planning/charts-batch?timePeriod=${timePeriod}&granularity=weekly&objectiveMode=${objectiveMode}&limit=${PAGE_LIMIT}&surface=${chartsBatchSurface}`
      : null,
    fetcher,
    swrOptions
  );

  // Dados reais ou de demonstração
  const effectiveBatchData = isDemoMode ? PROFILE_ANALYSIS_DEMO_DATA : chartsBatchData;

  const { data: recommendationFeedbackData, mutate: mutateRecommendationFeedback } = useSWR(
    activeUserId && recommendationsFeatureEnabled && advancedSectionsReady
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
  const requiresExtendedPosts =
    !hasDurationDataFromApi ||
    !hasTimeBucketsFromApi ||
    (advancedSectionsReady &&
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
        needsMoreCategoryRowsFromPosts));

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
    const posts = normalizedPosts;
    const normalizeCategories = (value: any): string[] =>
      Array.isArray(value)
        ? value.filter(Boolean).map((v) => String(v))
        : value
          ? [String(value)]
          : [];
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
        const metaLabel = p?.metaLabel || "";
        const proposal = normalizeCategories(p?.proposal);
        const context = normalizeCategories(p?.context);
        const tone = normalizeCategories(p?.tone);
        const reference = normalizeCategories(p?.references);
        const format = normalizeCategories(p?.format);
        const contentIntent = normalizeCategories(p?.contentIntent);
        const narrativeForm = normalizeCategories(p?.narrativeForm);
        const contentSignals = normalizeCategories(p?.contentSignals);
        const stance = normalizeCategories(p?.stance);
        const proofStyle = normalizeCategories(p?.proofStyle);
        const commercialMode = normalizeCategories(p?.commercialMode);
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
          contentIntent,
          narrativeForm,
          contentSignals,
          stance,
          proofStyle,
          commercialMode,
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
        contentIntent: string[];
        narrativeForm: string[];
        contentSignals: string[];
        stance: string[];
        proofStyle: string[];
        commercialMode: string[];
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
  }, [normalizedPosts, showAdvancedSections]);

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
  const deepEngagementExecutiveSummary = useMemo(
    () =>
      buildDeepEngagementExecutiveSummary(
        deepEngagement as Array<{ format: string; savesPerThousand: number; sharesPerThousand: number; postsCount: number }>
      ),
    [deepEngagement]
  );
  const weeklyRateExecutiveSummary = useMemo(
    () => buildWeeklyRateExecutiveSummary(weeklyEngagementRate as Array<{ avgRate: number }>),
    [weeklyEngagementRate]
  );

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
  const topDiscoveryExecutiveSummary = useMemo(
    () =>
      buildTopDiscoveryExecutiveSummary(
        discoveryStats,
        topDiscovery as Array<{ caption: string; nf: number | null }>
      ),
    [discoveryStats, topDiscovery]
  );

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

  const trendInteractionsDelta = useMemo(
    () => buildPeriodDelta(trendSeries, (row) => toNumber((row as any)?.interactions)),
    [trendSeries]
  );
  const saveVelocityDelta = useMemo(
    () => buildPeriodDelta(saveVelocitySeries, (row) => toNumber((row as any)?.avgSaves)),
    [saveVelocitySeries]
  );
  const commentVelocityDelta = useMemo(
    () => buildPeriodDelta(commentVelocitySeries, (row) => toNumber((row as any)?.avgComments)),
    [commentVelocitySeries]
  );
  const strategicDeltas = chartsBatchData?.strategicDeltas;
  const interactionsDeltaSummary = useMemo(() => {
    const backendSummary = formatStrategicDeltaSummary(
      strategicDeltas?.metrics?.interactionsPerPost as BackendStrategicMetricDelta | undefined,
      "interações por post"
    );
    return backendSummary || formatDeltaSummary(trendInteractionsDelta, "interações");
  }, [strategicDeltas?.metrics?.interactionsPerPost, trendInteractionsDelta]);
  const savesDeltaSummary = useMemo(() => {
    const backendSummary = formatStrategicDeltaSummary(
      strategicDeltas?.metrics?.savesPerPost as BackendStrategicMetricDelta | undefined,
      "salvamentos médios"
    );
    return backendSummary || formatDeltaSummary(saveVelocityDelta, "salvamentos médios");
  }, [saveVelocityDelta, strategicDeltas?.metrics?.savesPerPost]);
  const commentsDeltaSummary = useMemo(() => {
    const backendSummary = formatStrategicDeltaSummary(
      strategicDeltas?.metrics?.commentsPerPost as BackendStrategicMetricDelta | undefined,
      "comentários médios"
    );
    return backendSummary || formatDeltaSummary(commentVelocityDelta, "comentários médios");
  }, [commentVelocityDelta, strategicDeltas?.metrics?.commentsPerPost]);

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
  const experimentImpactByActionKey = useMemo<Record<string, ExperimentImpactSummary>>(
    () =>
      recommendationActions.reduce<Record<string, ExperimentImpactSummary>>((acc, action) => {
        const actionKey = String(action.feedbackKey || action.id || "").trim().toLowerCase();
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
      }, {}),
    [normalizedPosts, objectiveMode, primaryMetricLabel, recommendationActions]
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
  const directioningDiagnosisCards = useMemo(() => {
    const cards = [
      {
        title: "Por quê",
        body: directioningSummary?.comparison?.narrative || directioningSummary?.primarySignal?.text || interactionsDeltaSummary.text,
      },
      {
        title: "Base",
        body: directioningSummary?.compositeConfidence?.summary || directioningSummary?.confidence?.description || (topStrategicAction
          ? `${formatSampleBaseText(topStrategicAction.sampleSize)} • ${confidenceLabel[topStrategicAction.confidenceAdjusted].toLowerCase()}`
          : "Ainda falta base para confiar nisso."),
      },
    ];
    if (metricMeta?.isProxy && metricMeta?.description) {
      cards.push({
        title: "Cuidado",
        body: metricMeta.description,
      });
    }
    return cards;
  }, [
    directioningSummary?.comparison?.narrative,
    directioningSummary?.compositeConfidence?.summary,
    directioningSummary?.confidence?.description,
    directioningSummary?.primarySignal?.text,
    interactionsDeltaSummary.text,
    metricMeta?.description,
    metricMeta?.isProxy,
    topStrategicAction,
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
  const strategyMatrix = useMemo(() => {
    const rows = normalizedPosts
      .map((post: any, index) => {
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
        const label = String(post?.caption || `Post ${index + 1}`).slice(0, 36) || `Post ${index + 1}`;
        return {
          id: getPostStableKey(post) || `${index}`,
          label,
          reach,
          depth,
          caption: post?.caption || "Post",
          post,
        };
      })
      .filter(Boolean) as Array<{ id: string; label: string; reach: number; depth: number; caption: string; post: any }>;

    if (rows.length < 4) {
      return {
        points: [],
        reachMedian: 0,
        depthMedian: 0,
        winnerCount: 0,
        attractsCount: 0,
        nurturesCount: 0,
        lowPriorityCount: 0,
        summary: "Base curta para montar a matriz.",
        depthLabel: objectiveMode === "leads" ? "Intenção de lead" : "Resposta por 1 mil alcançadas",
      };
    }

    const reachMedian = medianOfNumbers(rows.map((row) => row.reach));
    const depthMedian = medianOfNumbers(rows.map((row) => row.depth));
    const points = rows.map((row) => {
      const isHighReach = row.reach >= reachMedian;
      const isHighDepth = row.depth >= depthMedian;
      const quadrant = isHighReach && isHighDepth
        ? "winner"
        : isHighReach
          ? "attracts"
          : isHighDepth
            ? "nurtures"
            : "low_priority";
      const fill =
        quadrant === "winner"
          ? "#2563eb"
          : quadrant === "attracts"
            ? "#0ea5e9"
            : quadrant === "nurtures"
              ? "#10b981"
              : "#94a3b8";
      return { ...row, quadrant, fill };
    });
    const winnerCount = points.filter((point) => point.quadrant === "winner").length;
    const attractsCount = points.filter((point) => point.quadrant === "attracts").length;
    const nurturesCount = points.filter((point) => point.quadrant === "nurtures").length;
    const summary =
      winnerCount > 0
        ? `${winnerCount} post${winnerCount === 1 ? "" : "s"} equilibram alcance e resposta.`
        : attractsCount > nurturesCount
          ? "Seu conteúdo atrai mais do que aprofunda."
          : nurturesCount > 0
            ? "Há posts que respondem bem, mas com pouco alcance."
            : "Ainda não há padrão forte entre alcance e resposta.";

    return {
      points,
      reachMedian,
      depthMedian,
      winnerCount,
      attractsCount,
      nurturesCount,
      lowPriorityCount: points.length - winnerCount - attractsCount - nurturesCount,
      summary,
      depthLabel: objectiveMode === "leads" ? "Intenção de lead" : "Resposta por 1 mil alcançadas",
    };
  }, [normalizedPosts, objectiveMode]);
  const audienceTabBrief = useMemo<TabBrief>(() => {
    const balanceFact =
      strategyMatrix.winnerCount > 0
        ? "Repita os posts que unem alcance e resposta."
        : strategyMatrix.attractsCount > strategyMatrix.nurturesCount
          ? "Mantenha o que atrai e ajuste a mensagem."
          : strategyMatrix.nurturesCount > 0
            ? "Pegue o que responde bem e aumente a entrega."
            : "Ainda não abra novas frentes.";
    const discoveryMeaning =
      objectiveMode === "leads"
        ? "O post que chama atenção nem sempre é o que mais gera intenção."
        : "O post que alcança mais gente nem sempre é o que mais faz a audiência reagir.";
    const action =
      strategyMatrix.attractsCount > strategyMatrix.nurturesCount
        ? "Ajuste a mensagem antes de trocar o tema."
        : strategyMatrix.nurturesCount > strategyMatrix.attractsCount
          ? "Mude a abertura desse tipo de post antes de trocar a ideia."
          : "Repita esse padrão antes de testar novas variações.";
    return {
      eyebrow: "Resposta do público",
      headline: balanceFact,
      bulletPoints: [
        discoveryMeaning,
        strategyMatrix.winnerCount > 0
          ? "Esses posts já mostraram alcance e resposta juntos."
          : strategyMatrix.attractsCount > strategyMatrix.nurturesCount
            ? "O problema está mais na mensagem."
            : strategyMatrix.nurturesCount > 0
              ? "O problema está mais na entrega."
              : "Ainda falta padrão claro.",
      ],
      action,
      supportingNote: metricMeta?.isProxy
        ? `Parte desta leitura é estimada: ${metricMeta.description}`
        : "Alcance alto sozinho não prova interesse.",
      statusChip:
        strategyMatrix.winnerCount > 0
          ? "Equilíbrio"
          : strategyMatrix.attractsCount > strategyMatrix.nurturesCount
            ? "Mais alcance"
            : strategyMatrix.nurturesCount > 0
              ? "Mais resposta"
              : "Leitura inicial",
    };
  }, [
    metricMeta?.description,
    metricMeta?.isProxy,
    objectiveMode,
    strategyMatrix.attractsCount,
    strategyMatrix.nurturesCount,
    strategyMatrix.winnerCount,
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
  const selectedRecommendationFeedbackKey = selectedRecommendation
    ? String(selectedRecommendation.feedbackKey || selectedRecommendation.id || "").trim().toLowerCase()
    : "";
  const selectedRecommendationFeedbackLoading = selectedRecommendationFeedbackKey
    ? Boolean(feedbackMutationByActionId[selectedRecommendationFeedbackKey])
    : false;
  const handleTabChange = React.useCallback((nextTab: ActiveChartTab) => {
    setActiveTab(nextTab);
    setShowMobileControls(false);
  }, []);
  const mobileStrategyHighlights = useMemo(() => {
    const quadrantLabel: Record<string, string> = {
      winner: "Equilíbrio forte",
      attracts: "Puxa alcance",
      nurtures: "Puxa resposta",
      low_priority: "Prioridade baixa",
    };
    return [...strategyMatrix.points]
      .sort((a: any, b: any) => {
        const scoreA = (a.quadrant === "winner" ? 3 : a.quadrant === "nurtures" ? 2 : a.quadrant === "attracts" ? 1 : 0) * 100000 + a.depth;
        const scoreB = (b.quadrant === "winner" ? 3 : b.quadrant === "nurtures" ? 2 : b.quadrant === "attracts" ? 1 : 0) * 100000 + b.depth;
        return scoreB - scoreA;
      })
      .slice(0, 3)
      .map((point: any) => ({
        id: point.id,
        label: point.label,
        value: point.depth,
        helper: `${quadrantLabel[point.quadrant] || "Leitura"} • ${numberFormatter.format(Math.round(point.reach))} de alcance`,
        post: point.post,
      }));
  }, [strategyMatrix.points]);
  const mobileHourItems = useMemo<MobileBarListItem[]>(
    () =>
      hourBenchmarkSeries
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
        })),
    [hourBenchmarkSeries, timingBenchmarkEnabled, useCompactFormatCharts]
  );
  const mobileDurationItems = useMemo<MobileBarListItem[]>(
    () =>
      durationBenchmarkSeries
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
        })),
    [durationBenchmarkSeries, timingBenchmarkEnabled, useCompactFormatCharts]
  );
  const mobileDurationCoverageItems = useMemo<MobileBarListItem[]>(
    () =>
      durationCoverageBenchmarkSeries
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
        })),
    [durationCoverageBenchmarkSeries, timingBenchmarkEnabled, useCompactFormatCharts]
  );
  const mobileWeekWindowItems = useMemo<MobileBarListItem[]>(() => {
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
  }, [benchmarkTopWindowKeys, heatmap, useCompactFormatCharts]);
  const compactChartTabs = useMemo(
    () =>
      CHART_TABS
        .filter((tab) => tab.id !== "directioning")
        .map((tab) => (tab.id === "format" ? { ...tab, label: "Formato" } : tab)),
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
  const compactContentMetricRows = useMemo(
    () => [
      {
        key: "proposal",
        title: "Proposta",
        rows: proposalBars,
        loading: loadingProposal,
        visual: COMPACT_CATEGORY_VISUALS.proposal,
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
        visual: COMPACT_CATEGORY_VISUALS.context,
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
        visual: COMPACT_CATEGORY_VISUALS.tone,
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
        visual: COMPACT_CATEGORY_VISUALS.references,
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
        visual: COMPACT_CATEGORY_VISUALS["content-intent"],
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
        visual: COMPACT_CATEGORY_VISUALS["narrative-form"],
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
        visual: COMPACT_CATEGORY_VISUALS["content-signals"],
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
        visual: COMPACT_CATEGORY_VISUALS.stance,
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
        visual: COMPACT_CATEGORY_VISUALS["proof-style"],
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
        visual: COMPACT_CATEGORY_VISUALS["commercial-mode"],
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
  const compactFormatMetricRows = useMemo(
    () => [
      {
        key: "hour",
        title: "Horário",
        rows: mobileHourItems.map((item) => ({ name: item.label, value: item.value, postsCount: item.postsCount ?? undefined })),
        loading: loadingTime,
        visual: COMPACT_CATEGORY_VISUALS.context,
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
        visual: COMPACT_CATEGORY_VISUALS["narrative-form"],
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
        visual: COMPACT_CATEGORY_VISUALS.references,
        icon: <LineChartIcon className="h-4 w-4" />,
        emptyText: "Sem formato no período.",
        onSelect: (row: CategoryBarDatum) => handleCategoryClick("format", row.name, `${primaryMetricShortLabel} por formato`),
      },
      {
        key: "week",
        title: "Semana",
        rows: mobileWeekWindowItems.map((item: any) => ({ name: item.label, value: item.value, postsCount: item.postsCount ?? undefined })),
        loading: loadingTime,
        visual: COMPACT_CATEGORY_VISUALS.proposal,
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
        visual: COMPACT_CATEGORY_VISUALS["content-signals"],
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
                  <div className="space-y-3.5">
                    {recommendationsFeatureEnabled ? (
                    <section className="space-y-2">
                        <div className="dashboard-section-panel flex items-center gap-2 rounded-[1rem] px-3 py-2">
                          <Target className="h-2.5 w-2.5 text-pink-500" />
                          <h3 className="dashboard-muted-label text-pink-500">Antes de agir</h3>
                          <p className="dashboard-type-meta italic text-zinc-600">
                            {directioningNoGoLine}
                          </p>
                        </div>

                          <div className="dashboard-section-stack overflow-hidden rounded-[1.35rem]">
                            {loadingBatch ? (
                              <p className="px-4 py-4 text-sm text-zinc-500">Carregando plano de ação...</p>
                            ) : recommendationActions.length === 0 ? (
                              <p className="px-4 py-4 text-sm text-zinc-500">Sem ação aberta agora. Volte quando entrar post novo.</p>
                            ) : (
                              recommendationActions.map((item, index) => {
                                const actionFeedbackKey = String(item.feedbackKey || item.id || "").trim().toLowerCase();
                                const isFeedbackUpdating = Boolean(feedbackMutationByActionId[actionFeedbackKey]);
                                return (
                                  <article
                                    key={item.feedbackKey || item.id}
                                    className="bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.05),transparent_30%),rgba(250,250,250,0.56)] px-4 py-4 transition hover:bg-white/72"
                                  >
                                    <div className="flex items-start gap-4">
                                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl font-bold text-xs ${index === 0 ? "bg-zinc-900 text-white" : "bg-white/86 text-zinc-500 ring-1 ring-zinc-100/90"}`}>
                                        {index + 1}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className={`dashboard-type-control inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] ${queueStageClassName[item.queueStage]}`}>
                                            {queueStageLabel[item.queueStage]}
                                          </span>
                                          <p className="dashboard-muted-label text-zinc-400">
                                            {RECOMMENDATION_TITLE_OVERRIDES[item.id] || item.title}
                                          </p>
                                        </div>
                                        <h4 className="dashboard-type-item-title mb-1 text-base">
                                          {item.nextStep || item.action}
                                        </h4>
                                        <p className="dashboard-type-meta text-zinc-500">
                                          {recommendationTypeLabel[recommendationTypeFallback(item.recommendationType)]} • {executionStateLabel[item.executionState || "planned"]}
                                        </p>
                                      </div>

                                      <div className="flex flex-col items-end gap-2 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            disabled={isFeedbackUpdating}
                                            onClick={() => submitRecommendationFeedback(item, "applied")}
                                            className={`inline-flex h-8 items-center justify-center rounded-2xl px-3 text-[11px] font-bold transition-all ${item.feedbackStatus === "applied"
                                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                              : "dashboard-secondary-button text-zinc-600"
                                              } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                          >
                                            {item.feedbackStatus === "applied" ? "Feito" : "Concluir"}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isFeedbackUpdating}
                                            onClick={() => submitRecommendationFeedback(item, "not_applied")}
                                            className={`inline-flex h-8 items-center justify-center rounded-2xl px-3 text-[11px] font-bold transition-all ${item.feedbackStatus === "not_applied"
                                              ? "bg-pink-50 text-pink-600 ring-1 ring-pink-200"
                                              : "dashboard-secondary-button text-zinc-600"
                                              } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                          >
                                            {item.feedbackStatus === "not_applied" ? "Ignorado" : "Pular"}
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => openRecommendationEvidence(item)}
                                          className="flex items-center gap-1.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-pink-500 transition-colors hover:text-pink-600"
                                        >
                                          Ver por que
                                          <ArrowUpRight className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })
                            )}
                          </div>
                      </section>
                    ) : (
                      <div className="rounded-[1.25rem] border border-zinc-100/90 bg-zinc-50/62 p-6 text-center">
                        <p className="text-sm text-slate-500">Sem próximo passo claro por enquanto.</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab !== "directioning" && activeTab !== "format" && currentTabBrief && !(isCompactBoard && activeTab === "content") ? (
                  <section className="mb-4">
                    <StrategicHeroCard
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
                  <div className="space-y-3.5">
                    <section className="space-y-4">
                      {compactContentMetricRows.map((item) => (
                        <CompactCategoryRankingSummary
                          key={item.key}
                          title={item.title}
                          rows={item.rows}
                          loading={item.loading}
                          visual={item.visual}
                          icon={item.icon}
                          emptyText={item.emptyText}
                          onSelect={item.onSelect}
                        />
                      ))}
                    </section>
                  </div>
                ) : null}
	                {activeTab === "content" && !isCompactBoard && (
	                  <div className="space-y-3.5">
                    <section className="space-y-2.5">
                      <div className="space-y-2.5">
                      <div className="grid gap-4 grid-cols-1">
                        <article className={cardBase}>
                          <header className="flex items-center justify-between gap-3">
                            <div className={chartHeaderTextClassName}>
                              <h2 className="text-base font-semibold text-slate-900">Proposta</h2>
                              <p className="text-xs text-slate-500">Apoio</p>
                            </div>
                            <Sparkles className="h-5 w-5 text-indigo-500" />
                          </header>
                          <div className={useCompactContentCharts ? "mt-3" : chartHeightClassName}>
                            {loadingProposal ? (
                              <p className="text-sm text-slate-500">Carregando propostas...</p>
                            ) : displayProposalBars.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem propostas registradas no período.</p>
                            ) : useCompactContentCharts ? (
                              <MobileBarList
                                items={displayProposalBars.map((item) => ({
                                  id: item.name,
                                  label: item.name,
                                  value: item.value,
                                  postsCount: item.postsCount,
                                }))}
                                emptyText="Sem propostas registradas no período."
                                accentClassName="bg-indigo-500"
                                valueFormatter={(value) => numberFormatter.format(Math.round(value))}
                                dense={isCompactBoard}
                                onSelect={(item) => handleCategoryClick("proposal", item.label, `${primaryMetricShortLabel} por proposta`)}
                              />
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={displayProposalBars}
                                  layout="vertical"
                                  margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                                  style={{ cursor: "pointer" }}
                                >
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#6366f1" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) handleCategoryClick("proposal", val, `${primaryMetricShortLabel} por proposta`); }}>
                                    <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
	                      </article>
		                      <article className={audienceCardBase}>
                          <header className="flex items-center justify-between gap-3">
                            <div className={chartHeaderTextClassName}>
                              <h2 className="text-base font-semibold text-slate-900">Tema</h2>
                              <p className="text-xs text-slate-500">Apoio</p>
                            </div>
                            <Target className="h-5 w-5 text-slate-600" />
                          </header>
                          <div className={useCompactContentCharts ? "mt-3" : chartHeightClassName}>
                            {loadingPosts ? (
                              <p className="text-sm text-slate-500">Carregando temas...</p>
                            ) : displayContextBars.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem temas registrados no período.</p>
                            ) : useCompactContentCharts ? (
                              <MobileBarList
                                items={displayContextBars.map((item) => ({
                                  id: item.name,
                                  label: item.name,
                                  value: item.value,
                                  postsCount: item.postsCount,
                                }))}
                                emptyText="Sem temas registrados no período."
                                accentClassName="bg-sky-500"
                                valueFormatter={(value) => numberFormatter.format(Math.round(value))}
                                dense={isCompactBoard}
                                onSelect={(item) => handleCategoryClick("context", item.label, `${primaryMetricShortLabel} por tema`)}
                              />
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={displayContextBars}
                                  layout="vertical"
                                  margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                                  style={{ cursor: "pointer" }}
                                >
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) handleCategoryClick("context", val, `${primaryMetricShortLabel} por tema`); }}>
                                    <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </article>
                      </div>
                      <div className="grid gap-4 grid-cols-1">
	                      <article className={cardBase}>
                          <header className="flex items-center justify-between gap-3">
                            <div className={chartHeaderTextClassName}>
                              <h2 className="text-base font-semibold text-slate-900">Tom</h2>
                              <p className="text-xs text-slate-500">Apoio</p>
                            </div>
                            <Sparkles className="h-5 w-5 text-emerald-500" />
                          </header>
                          <div className={useCompactContentCharts ? "mt-3" : chartHeightClassName}>
                            {loadingTone ? (
                              <p className="text-sm text-slate-500">Carregando tons...</p>
                            ) : displayToneBars.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem tons registrados no período.</p>
                            ) : useCompactContentCharts ? (
                              <MobileBarList
                                items={displayToneBars.map((item) => ({
                                  id: item.name,
                                  label: item.name,
                                  value: item.value,
                                  postsCount: item.postsCount,
                                }))}
                                emptyText="Sem tons registrados no período."
                                accentClassName="bg-emerald-500"
                                valueFormatter={(value) => numberFormatter.format(Math.round(value))}
                                dense={isCompactBoard}
                                onSelect={(item) => handleCategoryClick("tone", item.label, `${primaryMetricShortLabel} por tom`)}
                              />
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={displayToneBars}
                                  layout="vertical"
                                  margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                                  style={{ cursor: "pointer" }}
                                >
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#10b981" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) handleCategoryClick("tone", val, `${primaryMetricShortLabel} por tom`); }}>
                                    <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
	                      </article>
		                      <article className={cardBase}>
                          <header className="flex items-center justify-between gap-3">
                            <div className={chartHeaderTextClassName}>
                              <h2 className="text-base font-semibold text-slate-900">Referência</h2>
                              <p className="text-xs text-slate-500">Apoio</p>
                            </div>
                            <Sparkles className="h-5 w-5 text-amber-500" />
                          </header>
                          <div className={useCompactContentCharts ? "mt-3" : chartHeightClassName}>
                            {loadingReference ? (
                              <p className="text-sm text-slate-500">Carregando referências...</p>
                            ) : displayReferenceBars.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem referências registradas.</p>
                            ) : useCompactContentCharts ? (
                              <MobileBarList
                                items={displayReferenceBars.map((item) => ({
                                  id: item.name,
                                  label: item.name,
                                  value: item.value,
                                  postsCount: item.postsCount,
                                }))}
                                emptyText="Sem referências registradas."
                                accentClassName="bg-amber-500"
                                valueFormatter={(value) => numberFormatter.format(Math.round(value))}
                                dense={isCompactBoard}
                                onSelect={(item) => handleCategoryClick("references", item.label, `${primaryMetricShortLabel} por referência`)}
                              />
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={displayReferenceBars}
                                  layout="vertical"
                                  margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                                  style={{ cursor: "pointer" }}
                                >
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#f59e0b" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) handleCategoryClick("references", val, `${primaryMetricShortLabel} por referência legada`); }}>
                                    <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </article>
                      </div>
                      </div>
                    </section>
                    <section className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">O que mais pesa</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          Aqui vale olhar objetivo, jeito de contar, prova e venda.
                        </p>
                      </div>
                      <div className="grid gap-4 grid-cols-1">
                        {STRATEGIC_CATEGORY_CARDS.map((config) => {
                          const rowsByField: Record<CategoryCardConfig["field"], CategoryBarDatum[]> = {
                            format: [],
                            proposal: [],
                            context: [],
                            tone: [],
                            references: [],
                            contentIntent: contentIntentBars,
                            narrativeForm: narrativeFormBars,
                            contentSignals: contentSignalsBars,
                            stance: stanceBars,
                            proofStyle: proofStyleBars,
                            commercialMode: commercialModeBars,
                          };

                          return (
                            <CategoryPerformanceCard
                              key={config.field}
                              config={config}
                              rows={rowsByField[config.field] || []}
                              isLoading={loadingPosts}
                              isMobileViewport={useCompactContentCharts}
                              primaryMetricShortLabel={primaryMetricShortLabel}
                              primaryMetricUnitLabel={primaryMetricUnitLabel}
                              onCategoryClick={handleCategoryClick}
                            />
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === "format" && isCompactBoard ? (
                  <div className="space-y-3.5">
                    <section className="space-y-4">
                      {compactFormatMetricRows.map((item) => (
                        <CompactCategoryRankingSummary
                          key={item.key}
                          title={item.title}
                          rows={item.rows}
                          loading={item.loading}
                          visual={item.visual}
                          icon={item.icon}
                          emptyText={item.emptyText}
                          onSelect={item.onSelect}
                          valueFormatter={item.valueFormatter}
                        />
                      ))}
                    </section>
                  </div>
                ) : null}

	                {activeTab === "format" && !isCompactBoard && (
                    <div className="space-y-3.5">
		                      <section className="space-y-3">
		                        <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
		                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Padrão para repetir</p>
		                        </div>
	                  <div className="grid gap-4 grid-cols-1">
                      <div className="min-w-0 space-y-4">
                      <article className={formatCardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-semibold text-slate-900">Horário</h2>
                              {bestHour !== null && (
                                <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                  Melhor: {bestHour}h
                                </span>
                              )}
                            </div>
                            {!useCompactFormatCharts && timingBenchmark?.cohort?.reason ? (
                              <p className="text-[11px] text-slate-400">{timingBenchmark.cohort.reason}</p>
                            ) : null}
                          </div>
                          <Clock3 className="h-5 w-5 text-emerald-500" />
                        </header>
                        {timingBenchmarkEnabled ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {bestHour !== null ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${benchmarkToneClassName[bestHourBenchmarkStatus.tone]}`}
                              >
                                {bestHourBenchmarkStatus.label}
                              </span>
                            ) : null}
                            {benchmarkMetaLine && !useCompactFormatCharts ? (
                              <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {benchmarkMetaLine}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={useCompactFormatCharts ? "mt-3" : chartHeightClassName}>
                          {loadingTime ? (
                            <p className="text-sm text-slate-500">Carregando horários...</p>
                          ) : hourBars.length === 0 ? (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-500">Sem dados no período.</p>
                              {timePeriod !== "all_time" ? (
                                <button
                                  type="button"
                                  onClick={() => handleTimePeriodChange("all_time")}
                                  className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Ver todo histórico
                                </button>
                              ) : (
                                <p className="text-xs text-slate-400">
                                  Publique mais para liberar leitura.
                                </p>
                              )}
                            </div>
                          ) : useCompactFormatCharts ? (
                            <MobileBarList
                              items={mobileHourItems}
                              emptyText="Sem dados no período."
                              accentClassName="bg-sky-500"
                              valueFormatter={(value) => numberFormatter.format(Math.round(value))}
                              dense={isCompactBoard}
                              maxItems={isCompactBoard ? 3 : 4}
                              onSelect={(item) => {
                                const hour = Number(item.label.replace("h", ""));
                                if (Number.isFinite(hour)) {
                                  handleHourClick(hour, `Melhor horário para ${primaryMetricShortLabel.toLowerCase()}`);
                                }
                              }}
                            />
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={hourBenchmarkSeries}
                                margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis
                                  dataKey="hour"
                                  tickFormatter={(h: number) => `${h}h`}
                                  tickLine={false}
                                  axisLine={false}
                                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                                />
                                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={(label: string | number, payload: any[]) => {
                                    const postsCount = payload?.[0]?.payload?.postsCount;
                                    const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkPostsCount;
                                    const benchmarkInfo =
                                      timingBenchmarkEnabled && typeof benchmarkPostsCount === "number" && benchmarkPostsCount > 0
                                        ? ` • base de comparação: ${formatPostsCount(benchmarkPostsCount)}`
                                        : "";
                                    return typeof postsCount === "number"
                                      ? `${label}h • ${formatPostsCount(postsCount)}${benchmarkInfo}`
                                      : `${label}h`;
                                  }}
                                  formatter={(value: number, name: string) => [
                                    numberFormatter.format(Math.round(value)),
                                    name === "benchmarkAverage" ? "Linha pontilhada: média de contas parecidas com a sua" : primaryMetricTooltipLabel,
                                  ]}
                                />
                                <Bar
                                  dataKey="average"
                                  name={primaryMetricTooltipLabel}
                                  fill="#0ea5e9"
                                  radius={[6, 6, 0, 0]}
                                  onClick={(state: any) => {
                                    const hour = typeof state?.payload?.hour === "number" ? state.payload.hour : null;
                                    if (hour !== null) {
                                      handleHourClick(hour, `Melhor horário para ${primaryMetricShortLabel.toLowerCase()}`);
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
                                {timingBenchmarkEnabled ? (
                                  <Line
                                    type="monotone"
                                    dataKey="benchmarkAverage"
                                    name="benchmarkAverage"
                                    stroke="#94a3b8"
                                    strokeWidth={2}
                                    dot={false}
                                    strokeDasharray="4 4"
                                    activeDot={{ r: 3 }}
                                  />
                                ) : null}
                              </ComposedChart>
                            </ResponsiveContainer>
                          )}
                        </div>
	                      </article>
			                      <article className={formatCardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-semibold text-slate-900">Duração</h2>
                              {bestDurationBucket ? (
                                <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                  Melhor: {bestDurationBucket.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <LineChartIcon className="h-5 w-5 text-indigo-500" />
                        </header>
                        {timingBenchmarkEnabled && bestDurationBucket ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${benchmarkToneClassName[bestDurationBenchmarkStatus.tone]}`}
                            >
                              {bestDurationBenchmarkStatus.label}
                            </span>
                            {benchmarkMetaLine && !useCompactFormatCharts ? (
                              <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {benchmarkMetaLine}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={useCompactFormatCharts ? "mt-3" : chartHeightClassName}>
                          {loadingDuration ? (
                            <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
                          ) : durationSummary.totalVideoPosts === 0 ? (
                            <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                          ) : durationSummary.totalPostsWithDuration === 0 ? (
                            <p className="text-sm text-slate-500">Sem base para comparar.</p>
                          ) : useCompactFormatCharts ? (
                            <MobileBarList
                              items={mobileDurationItems}
                              emptyText="Sem base para comparar."
                              accentClassName="bg-violet-500"
                              valueFormatter={(value) => numberFormatter.format(Math.round(value))}
                              dense={isCompactBoard}
                              maxItems={isCompactBoard ? 3 : undefined}
                              onSelect={(item) => {
                                const bucket = DURATION_BUCKETS.find((entry) => entry.label === item.label);
                                if (bucket) {
                                  handleDurationBucketClick(bucket.key, `${primaryMetricShortLabel} por faixa de duração`);
                                }
                              }}
                            />
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={durationBenchmarkSeries}
                                margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                                onClick={(state: any) => {
                                  const label = state?.activeLabel ? String(state.activeLabel) : null;
                                  if (!label) return;
                                  const bucket = DURATION_BUCKETS.find((item) => item.label === label);
                                  if (!bucket) return;
                                  handleDurationBucketClick(bucket.key, `${primaryMetricShortLabel} por faixa de duração`);
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis
                                  dataKey="label"
                                  tickLine={false}
                                  axisLine={false}
                                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                                />
                                <YAxis
                                  tickLine={false}
                                  axisLine={false}
                                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                                  tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                                />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={(label: string | number, payload: any[]) => {
                                    const postsCount = payload?.[0]?.payload?.postsCount ?? 0;
                                    const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkPostsCount ?? 0;
                                    return `${label} • ${formatPostsCount(postsCount)}${
                                      timingBenchmarkEnabled && benchmarkPostsCount > 0
                                        ? ` • base de comparação: ${formatPostsCount(benchmarkPostsCount)}`
                                        : ""
                                    }`;
                                  }}
                                  formatter={(value: number, name: string) => [
                                    numberFormatter.format(Math.round(value)),
                                    name === "benchmarkAverage" ? "Linha pontilhada: média de contas parecidas com a sua" : primaryMetricTooltipLabel,
                                  ]}
                                />
                                <Bar
                                  dataKey="averageInteractions"
                                  name={primaryMetricTooltipLabel}
                                  stroke="#7c3aed"
                                  fill="#7c3aed"
                                  radius={[6, 6, 0, 0]}
                                >
                                  <LabelList
                                    dataKey="averageInteractions"
                                    position="top"
                                    formatter={(value: number) => numberFormatter.format(Math.round(value))}
                                    fill="#64748b"
                                    fontSize={10}
                                  />
                                </Bar>
                                {timingBenchmarkEnabled ? (
                                  <Line
                                    type="monotone"
                                    dataKey="benchmarkAverage"
                                    name="benchmarkAverage"
                                    stroke="#94a3b8"
                                    strokeWidth={2}
                                    dot={false}
                                    strokeDasharray="4 4"
                                    activeDot={{ r: 3 }}
                                  />
                                ) : null}
                              </ComposedChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
			                      <article className={formatCardBase}>
	                        <header className="flex items-center justify-between gap-3">
	                          <div className={chartHeaderTextClassName}>
	                            <h2 className="text-base font-semibold text-slate-900">Formato</h2>
	                          </div>
	                          <LineChartIcon className="h-5 w-5 text-amber-500" />
	                        </header>
	                        {timingBenchmarkEnabled ? (
	                          <div className="mt-3 flex flex-wrap gap-2">
	                            {formatBars.length > 0 ? (
	                              <span
	                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${benchmarkToneClassName[bestFormatBenchmarkStatus.tone]}`}
	                              >
	                                {bestFormatBenchmarkStatus.label}
	                              </span>
	                            ) : null}
	                            {benchmarkMetaLine && !useCompactFormatCharts ? (
	                              <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
	                                {benchmarkMetaLine}
	                              </span>
	                            ) : null}
	                          </div>
	                        ) : null}
	                        <div className={useCompactFormatCharts ? "mt-3" : chartHeightClassName}>
	                          {loadingFormat ? (
	                            <p className="text-sm text-slate-500">Carregando formatos...</p>
	                          ) : formatBars.length === 0 ? (
	                            <p className="text-sm text-slate-500">Sem formato no período.</p>
	                          ) : useCompactFormatCharts ? (
	                            <MobileBarList
	                              items={formatBars.map((item: CategoryBarDatum) => ({
	                                id: item.name,
	                                label: item.name,
	                                value: item.value,
	                                postsCount: item.postsCount,
	                              }))}
	                              emptyText="Sem formato no período."
	                              accentClassName="bg-orange-500"
	                              valueFormatter={(value) => numberFormatter.format(Math.round(value))}
	                              dense={isCompactBoard}
	                              maxItems={isCompactBoard ? 3 : undefined}
	                              onSelect={(item) => handleCategoryClick("format", item.label, `${primaryMetricShortLabel} por formato`)}
	                            />
	                          ) : (
	                            <ResponsiveContainer width="100%" height="100%">
	                              <ComposedChart
	                                data={formatBenchmarkSeries}
	                                margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
	                                style={{ cursor: "pointer" }}
	                              >
	                                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
	                                <YAxis hide />
	                                <Tooltip
	                                  contentStyle={tooltipStyle}
	                                  labelFormatter={(label: string | number, payload: any[]) => {
	                                    const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkPostsCount ?? 0;
	                                    return `${label}${
	                                      timingBenchmarkEnabled && benchmarkPostsCount > 0
	                                        ? ` • grupo: ${formatPostsCount(benchmarkPostsCount)}`
	                                        : ""
	                                    }`;
	                                  }}
	                                  formatter={(value: number, name: string) => [
	                                    numberFormatter.format(Math.round(value)),
	                                    name === "benchmarkAverage" ? "Linha pontilhada: média de contas parecidas com a sua" : primaryMetricUnitLabel,
	                                  ]}
	                                />
	                                <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#f97316" radius={[6, 6, 0, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) handleCategoryClick("format", val, `${primaryMetricShortLabel} por formato`); }}>
	                                  <LabelList dataKey="value" position="top" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
	                                </Bar>
	                                {canShowFormatBenchmarkLine ? (
	                                  <Line
	                                    type="monotone"
	                                    dataKey="benchmarkAverage"
	                                    name="benchmarkAverage"
	                                    stroke="#94a3b8"
	                                    strokeWidth={2}
	                                    dot={false}
	                                    strokeDasharray="4 4"
	                                    activeDot={{ r: 3 }}
	                                  />
	                                ) : null}
	                              </ComposedChart>
	                            </ResponsiveContainer>
	                          )}
	                        </div>
	                      </article>
                      </div>
                      </div>
                    </section>
		                    <section className="space-y-3">
		                      <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
		                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Consistência e comparação</p>
		                      </div>
                      <div className="min-w-0 space-y-4">
		                      <article className={formatCardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900 leading-tight">Semana</h2>
                          </div>
                          <Clock3 className="h-5 w-5 text-indigo-500" />
                        </header>
                        {timingBenchmarkEnabled && benchmarkMetaLine && !useCompactFormatCharts ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {benchmarkMetaLine}
                            </span>
                          </div>
                        ) : null}
                        {useCompactFormatCharts ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{heatmapExecutiveSummary.text}</p> : null}
                        <div className="mt-3">
                          {loadingTime ? (
                            <p className="text-sm text-slate-500">Carregando mapa de horários...</p>
                          ) : heatmap.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem base para o mapa.</p>
                          ) : useCompactFormatCharts ? (
                            <MobileBarList
                              items={mobileWeekWindowItems}
                              emptyText="Sem base para o mapa."
                              accentClassName="bg-indigo-500"
                              valueFormatter={(value) => `${Math.round(value)} pts`}
                              dense={isCompactBoard}
                              maxItems={isCompactBoard ? 3 : 6}
                              onSelect={(item) => {
                                const match = item.id.match(/^week-(\d+)-(\d+)$/);
                                if (!match) return;
                                const dow = Number(match[1]);
                                const startHour = Number(match[2]);
                                handleDayHourClick(dow, startHour, Math.min(startHour + 3, 23), "Mapa de horários");
                              }}
                            />
                          ) : (
                            <div className="space-y-4">
                              <div className="rounded-[1.2rem] border border-zinc-100/90 bg-zinc-50/62 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Melhores janelas</p>
                                <div className="mt-3">
                                  <MobileBarList
                                    items={mobileWeekWindowItems}
                                    emptyText="Sem base para o mapa."
                                    accentClassName="bg-indigo-500"
                                    valueFormatter={(value) => `${Math.round(value)} pts`}
                                    maxItems={3}
                                    onSelect={(item) => {
                                      const match = item.id.match(/^week-(\d+)-(\d+)$/);
                                      if (!match) return;
                                      const dow = Number(match[1]);
                                      const startHour = Number(match[2]);
                                      handleDayHourClick(dow, startHour, Math.min(startHour + 3, 23), "Mapa de horários");
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <div className="grid min-w-[320px] grid-cols-7 gap-1 text-[11px] text-slate-500">
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
                                        const isBenchmarkWindow = benchmarkTopWindowKeys.has(`${dow}:${startHour}`);
                                        return (
                                          <button
                                            key={hIdx}
                                            type="button"
                                            className={`aspect-square rounded border transition hover:border-slate-300 ${
                                              isBenchmarkWindow ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-100"
                                            }`}
                                            style={{ background: bg }}
                                            onClick={() => handleDayHourClick(dow, startHour, endHour, "Mapa de horários")}
                                            aria-label={`Posts em ${WEEKDAY_LONG_SUN_FIRST[dow - 1] || `Dia ${dow}`} entre ${startHour}h e ${endHour}h`}
                                          />
                                        );
                                      })}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
	                      </article>
	                      <article className={formatCardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Cobertura de duração</h2>
                            {durationSummary.totalVideoPosts > 0 ? (
                              <p className="text-xs text-slate-500">{(durationSummary.durationCoverageRate * 100).toFixed(0)}% lidos</p>
                            ) : null}
                          </div>
                          <Clock3 className="h-5 w-5 text-cyan-500" />
                        </header>
                            {timingBenchmarkEnabled && benchmarkMetaLine && !useCompactFormatCharts ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {benchmarkMetaLine}
                            </span>
                          </div>
                        ) : null}
                        <div className={useCompactFormatCharts ? "mt-3" : chartCompactHeightClassName}>
                          {loadingDuration ? (
                            <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
                          ) : durationSummary.totalVideoPosts === 0 ? (
                            <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                          ) : durationSummary.totalPostsWithDuration === 0 ? (
                            <p className="text-sm text-slate-500">
                              Leitura de duração indisponível.
                            </p>
                          ) : useCompactFormatCharts ? (
                            <MobileBarList
                              items={mobileDurationCoverageItems}
                              emptyText="Leitura de duração indisponível."
                              accentClassName="bg-cyan-500"
                              valueFormatter={(value) => formatPercentLabel(value)}
                              dense={isCompactBoard}
                              maxItems={isCompactBoard ? 3 : undefined}
                              onSelect={(item) => {
                                const bucket = DURATION_BUCKETS.find((entry) => entry.label === item.label);
                                if (bucket) {
                                  handleDurationBucketClick(bucket.key, "Vídeos por faixa de duração");
                                }
                              }}
                            />
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={durationCoverageBenchmarkSeries} margin={{ top: 20, right: 8, left: -6, bottom: 0 }} style={{ cursor: "pointer" }}>
                                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis
                                  tickLine={false}
                                  axisLine={false}
                                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                                  tickFormatter={(value: number) => formatPercentLabel(value)}
                                />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={(label: string | number, payload: any[]) => {
                                    const postsCount = payload?.[0]?.payload?.postsCount ?? 0;
                                    const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkUsagePosts ?? 0;
                                    return `${label} • ${formatPostsCount(postsCount)}${
                                      timingBenchmarkEnabled && benchmarkPostsCount > 0
                                        ? ` • grupo: ${formatPostsCount(benchmarkPostsCount)}`
                                        : ""
                                    }`;
                                  }}
                                  formatter={(value: number, name: string) => [
                                    formatPercentLabel(value, 1),
                                    name === "benchmarkUsageSharePct" ? "Linha pontilhada: % dos videos desse grupo" : "% dos seus videos",
                                  ]}
                                />
                                <Bar
                                  dataKey="usageSharePct"
                                  name="usageSharePct"
                                  fill="#06b6d4"
                                  radius={[6, 6, 0, 0]}
                                  onClick={(state: any) => {
                                    const bucketKey = state?.payload?.key as DurationBucketKey | undefined;
                                    if (bucketKey) handleDurationBucketClick(bucketKey, "Vídeos por faixa de duração");
                                  }}
                                >
                                  <LabelList
                                    dataKey="usageSharePct"
                                    position="top"
                                    formatter={(value: number) => formatPercentLabel(value)}
                                    fill="#64748b"
                                    fontSize={10}
                                  />
                                </Bar>
                                {timingBenchmarkEnabled ? (
                                  <Line
                                    type="monotone"
                                    dataKey="benchmarkUsageSharePct"
                                    name="benchmarkUsageSharePct"
                                    stroke="#94a3b8"
                                    strokeWidth={2}
                                    dot={false}
                                    strokeDasharray="4 4"
                                    activeDot={{ r: 3 }}
                                  />
                                ) : null}
                              </ComposedChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
			                      <article className={formatCardBase}>
			                        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			                          <div className="space-y-1">
			                            <div className="flex items-center gap-2">
			                              <Users className="h-5 w-5 text-slate-700" />
		                              <h2 className="text-base font-semibold text-slate-900">Criadores similares</h2>
		                            </div>
		                          </div>
	                          <div className="flex flex-wrap gap-2">
	                            {totalSimilarCreatorsCount > 0 ? (
	                              <span className="inline-flex items-center rounded-full border border-zinc-200/80 bg-zinc-50/78 px-2.5 py-1 text-[11px] font-medium text-slate-600">
	                                {similarCreatorsSummaryLabel}
	                              </span>
	                            ) : null}
	                          </div>
	                        </header>
	                        <div className="mt-4 rounded-[1.35rem] border border-zinc-100/90 bg-zinc-50/56 p-2 sm:p-3">
	                          {loadingBatch && !chartsBatchData ? (
	                            <p className="px-2 py-8 text-sm text-slate-500">Carregando base...</p>
	                          ) : similarCreatorsEnabled ? (
	                            <div className="space-y-2">
	                              {similarCreators?.reason ? (
	                                <div className="rounded-[1rem] border border-amber-200/80 bg-amber-50/78 px-3 py-2 text-xs text-amber-800">
	                                  {similarCreators.reason}
	                                </div>
	                              ) : null}
	                              <ol className="space-y-1">
	                                {similarCreatorItems.map((creator) => {
	                                  const creatorName = creator.name || creator.username || "Criador similar";
	                                  const creatorHandle = creator.username ? `@${creator.username}` : "Conta parecida";
	                                  return (
	                                    <li
	                                      key={creator.id}
	                                      className="flex min-w-0 flex-wrap items-center gap-3 rounded-[1.1rem] border border-zinc-100/90 bg-zinc-50/72 px-3 py-3 sm:flex-nowrap"
	                                    >
	                                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
	                                        #{creator.rankByFollowers}
	                                      </span>
	                                      <UserAvatar
	                                        name={creatorName}
	                                        src={creator.avatarUrl || null}
	                                        size={44}
	                                        className="h-11 w-11 rounded-full ring-1 ring-slate-200"
	                                      />
	                                      <div className="min-w-0 flex-1">
	                                        <p className="truncate text-sm font-semibold text-slate-900">{creatorName}</p>
	                                        <p className="truncate text-xs text-slate-500">
	                                          {creatorHandle} • {formatCompactFollowers(creator.followers)}
	                                        </p>
	                                      </div>
	                                      {creator.mediaKitSlug ? (
	                                        <a
	                                          href={`/mediakit/${creator.mediaKitSlug}`}
	                                          target="_blank"
	                                          rel="noreferrer"
	                                          onClick={() =>
	                                            track("planning_similar_creator_mediakit_clicked", {
	                                              creator_id: activeUserId || null,
	                                              similar_creator_id: creator.id,
	                                              rank: creator.rankByFollowers,
	                                            })
	                                          }
	                                        className="inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full border border-zinc-200/80 bg-white/84 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-zinc-300 hover:bg-white sm:w-auto sm:shrink-0"
	                                        >
	                                          Mídia kit
	                                          <ExternalLink className="h-3.5 w-3.5" />
	                                        </a>
	                                      ) : (
	                                        <span className="inline-flex min-h-[36px] w-full items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-50/68 px-3 py-1.5 text-xs font-medium text-slate-500 sm:w-auto sm:shrink-0">
	                                          Sem mídia kit
	                                        </span>
	                                      )}
	                                    </li>
	                                  );
	                                })}
	                              </ol>
	                            </div>
	                          ) : (
	                            <div className="rounded-[1.1rem] border border-zinc-100/90 bg-white/76 px-4 py-6 text-sm text-slate-500">
	                              {similarCreators?.reason || "Ainda faltam contas parecidas suficientes para montar esse ranking."}
	                            </div>
	                          )}
	                          {canShowAffiliateInvite ? (
	                            <div className="mt-3 rounded-[1.1rem] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.62)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4">
	                              <div className="flex items-start gap-3">
	                                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
	                                  <Gift className="h-5 w-5" />
	                                </div>
		                                <div className="min-w-0 flex-1">
		                                  <h3 className="text-sm font-semibold text-slate-900">Convide pares</h3>
		                                  <p className="mt-1 text-xs leading-5 text-slate-600">
		                                    Amplie sua base com o seu link.
		                                  </p>
		                                </div>
	                              </div>
	                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
	                                <button
	                                  type="button"
	                                  onClick={handleCopyAffiliateInvite}
	                                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
	                                >
	                                  <Copy className="h-4 w-4" />
	                                  Copiar link de convite
	                                </button>
	                                <a
	                                  href="/dashboard/afiliados"
	                                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/84 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
	                                >
	                                  Ver afiliados
	                                  <ArrowUpRight className="h-4 w-4" />
	                                </a>
	                              </div>
		                              <p className="mt-2 text-[11px] text-slate-500">
		                                Código: <span className="font-semibold text-slate-700">{viewer?.affiliateCode ?? "—"}</span>
		                              </p>
		                              {affiliateCopyStatus === "copied" ? (
		                                <p className="mt-2 text-xs font-medium text-emerald-700">Link copiado. Você já pode compartilhar.</p>
		                              ) : affiliateCopyStatus === "error" ? (
		                                <p className="mt-2 text-xs font-medium text-amber-700">Não deu para copiar agora. Tente novamente.</p>
		                              ) : null}
		                            </div>
	                          ) : null}
	                        </div>
	                      </article>
	                    </div>
	                  </section>
	                </div>
	                  )}

			                {activeTab === "audience" && (
		                  <div className="space-y-4">
		                    <section className="space-y-3">
                          <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura da audiência</p>
                          </div>
		                    <div className="grid items-start gap-4 grid-cols-1">
		                      <article className={cardBase}>
		                        <header className="flex items-center justify-between gap-3">
		                          <div className={chartHeaderTextClassName}>
		                            <h2 className="text-base font-semibold text-slate-900">Alcance x resposta</h2>
                                <p className="text-xs text-slate-500">
                                  Direita = mais gente alcançada. Alto = {objectiveMode === "leads" ? "mais intenção de lead" : "mais resposta"}.
                                </p>
		                          </div>
		                          <Target className="h-5 w-5 text-slate-500" />
		                        </header>
		                        <div className={chartTallHeightClassName}>
		                          {strategyMatrix.points.length === 0 ? (
		                            <p className="text-sm text-slate-500">Ainda faltam posts suficientes para comparar alcance e profundidade.</p>
		                          ) : (
                                <div className="relative h-full">
		                              <ResponsiveContainer width="100%" height="100%">
		                                <ScatterChart margin={{ top: 16, right: 12, left: 0, bottom: 14 }}>
		                                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
		                                  <XAxis
		                                    type="number"
		                                    dataKey="reach"
		                                    tickLine={false}
		                                    axisLine={false}
		                                    tick={{ fill: "#94a3b8", fontSize: 11 }}
		                                    tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
		                                    name="Pessoas alcançadas"
		                                  />
		                                  <YAxis
		                                    type="number"
		                                    dataKey="depth"
		                                    tickLine={false}
		                                    axisLine={false}
		                                    tick={{ fill: "#94a3b8", fontSize: 11 }}
		                                    tickFormatter={(value: number) => value.toFixed(value >= 10 ? 0 : 1)}
		                                    name={strategyMatrix.depthLabel}
		                                  />
		                                  <Tooltip
		                                    cursor={{ strokeDasharray: "3 3" }}
		                                    contentStyle={tooltipStyle}
		                                    formatter={(value: number, name: string) => [
		                                      name === "Pessoas alcançadas"
		                                        ? numberFormatter.format(Math.round(value))
		                                        : value.toFixed(value >= 10 ? 1 : 2),
		                                      name,
		                                    ]}
		                                    labelFormatter={(_label: string | number, payload: any[]) => payload?.[0]?.payload?.label || "Post"}
		                                  />
		                                  <ReferenceLine x={strategyMatrix.reachMedian} stroke="#cbd5e1" strokeDasharray="4 4" />
		                                  <ReferenceLine y={strategyMatrix.depthMedian} stroke="#cbd5e1" strokeDasharray="4 4" />
		                                  <Scatter
		                                    data={strategyMatrix.points}
		                                    name="Pessoas alcançadas"
		                                    shape={(props: any) => (
		                                      <circle
		                                        cx={props.cx}
		                                        cy={props.cy}
		                                        r={isMobileViewport ? 8 : 5}
		                                        fill={props.payload.fill}
		                                        fillOpacity={0.9}
		                                        stroke="#ffffff"
		                                        strokeWidth={1.5}
                                        className="cursor-pointer"
                                        onClick={() => handleStrategyPointClick(props.payload)}
		                                      />
		                                    )}
		                                  />
		                                </ScatterChart>
		                              </ResponsiveContainer>
                                  <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-zinc-100/90 bg-white/82 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                    Mais resposta
                                  </div>
                                  <div className="pointer-events-none absolute bottom-0 right-2 rounded-full border border-zinc-100/90 bg-white/82 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                    Mais alcance
                                  </div>
                                </div>
		                          )}
		                        </div>
                            {isMobileViewport && mobileStrategyHighlights.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Posts que merecem atenção</p>
                                {mobileStrategyHighlights.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handlePlayVideo(item.post)}
                                    className="w-full rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5 text-left"
                                  >
                                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                    <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
                                  </button>
                                ))}
                              </div>
                            ) : null}
		                      </article>
		                      <div className="space-y-3">
                            <article className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 p-4">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura</p>
                              <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{strategyMatrix.summary}</p>
                            </article>
                            <article className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 p-3.5">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Legenda</p>
                              <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-slate-700">
                                <div className="rounded-lg border border-zinc-100/90 bg-zinc-50/74 px-2 py-1.5"><strong className="text-slate-900 font-bold">Azul escuro:</strong> repetir.</div>
                                <div className="rounded-lg border border-zinc-100/90 bg-zinc-50/74 px-2 py-1.5"><strong className="text-slate-900 font-bold">Azul claro:</strong> atrai, mas pede ajuste.</div>
                                <div className="rounded-lg border border-zinc-100/90 bg-zinc-50/74 px-2 py-1.5"><strong className="text-slate-900 font-bold">Verde:</strong> bom retorno, precisa alcance.</div>
                              </div>
                            </article>
                          </div>
		                    </div>
                    </section>
                    <section className="space-y-3">
                      <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Posts de descoberta</p>
                      </div>
                    <section className={audienceCardBase}>
                      <header className="flex items-center justify-between gap-3">
                        <div className={chartHeaderTextClassName}>
                          <h3 className="text-base font-semibold text-slate-900">Posts de descoberta</h3>
                        </div>
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                      </header>
                      {loadingPosts ? (
                        <p className="mt-3 text-sm text-slate-500">Carregando lista...</p>
                      ) : (
                        <TopDiscoveryTable posts={topDiscovery} isLoading={loadingPosts} />
                      )}
                    </section>
                    </section>
		                    <section className="space-y-3">
                          <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Evolução e sinais</p>
                          </div>
		                    <section className="grid items-start gap-4 grid-cols-1">
		                      <article className={audienceCardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Evolução</h2>
                          </div>
                          <Sparkles className="h-5 w-5 text-indigo-500" />
                        </header>
                        {isMobileViewport ? (
                          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-100/90 bg-zinc-50/72 p-1">
                            <button
                              type="button"
                              onClick={() => setMobileAudienceTrendMetric("reach")}
                              className={`rounded-xl px-2 py-2 text-[11px] font-bold ${mobileAudienceTrendMetric === "reach" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                            >
                              Alcance
                            </button>
                            <button
                              type="button"
                              onClick={() => setMobileAudienceTrendMetric("interactions")}
                              className={`rounded-xl px-2 py-2 text-[11px] font-bold ${mobileAudienceTrendMetric === "interactions" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                            >
                              Interações
                            </button>
                            <button
                              type="button"
                              onClick={() => setMobileAudienceTrendMetric("response")}
                              className={`rounded-xl px-2 py-2 text-[11px] font-bold ${mobileAudienceTrendMetric === "response" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                            >
                              Resposta
                            </button>
                          </div>
                        ) : null}
                        <div className={chartHeightClassName}>
                          {loadingTrend || (isMobileViewport && mobileAudienceTrendMetric === "response" && loadingPosts) ? (
                            <p className="text-sm text-slate-500">Carregando série...</p>
                          ) : isMobileViewport && mobileAudienceTrendMetric === "response" ? (
                            weeklyEngagementRate.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={weeklyEngagementRate}
                                  margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                                  onClick={(state: any) => handleWeekClick(state?.activeLabel ?? null, "Percentual de resposta")}
                                  style={{ cursor: "pointer" }}
                                >
                                  <XAxis dataKey="date" tickFormatter={formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                  <YAxis hide />
                                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string | number) => formatWeekLabel(String(l))} />
                                  <Line type="monotone" dataKey="avgRate" name="Resposta" stroke="#7c3aed" strokeWidth={3} dot>
                                    <LabelList dataKey="avgRate" position="top" formatter={(v: number) => `${(v * 100).toFixed(1)}%`} fill="#64748b" fontSize={11} />
                                  </Line>
                                </LineChart>
                              </ResponsiveContainer>
                            )
                          ) : trendSeries.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem dados no período.</p>
                          ) : isMobileViewport ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={trendSeries}
                                margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                                onClick={(state: any) =>
                                  handleWeekClick(
                                    state?.activeLabel ?? null,
                                    mobileAudienceTrendMetric === "interactions" ? "Interações por post" : "Pessoas alcançadas por post"
                                  )
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis dataKey="date" tickFormatter={formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                <YAxis
                                  tickLine={false}
                                  axisLine={false}
                                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                                  tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                                />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={(label: string | number) => formatWeekLabel(String(label))}
                                  formatter={(value: number) => [
                                    numberFormatter.format(Math.round(value)),
                                    mobileAudienceTrendMetric === "interactions" ? "Interações por post" : "Pessoas alcançadas por post",
                                  ]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey={mobileAudienceTrendMetric === "interactions" ? "interactions" : "reach"}
                                  name={mobileAudienceTrendMetric === "interactions" ? "Interações por post" : "Pessoas alcançadas por post"}
                                  stroke={mobileAudienceTrendMetric === "interactions" ? "#7c3aed" : "#2563eb"}
                                  strokeWidth={3}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={trendSeries}
                                margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                                onClick={(state: any) => handleWeekClick(state?.activeLabel ?? null, "Alcance x Interações")}
                                style={{ cursor: "pointer" }}
                              >
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
                                  labelFormatter={(label: string | number) => formatWeekLabel(String(label))}
                                  formatter={(value: number, name: string) => [numberFormatter.format(Math.round(value)), name]}
                                />
                                <Line yAxisId="reach" type="monotone" dataKey="reach" name="Pessoas alcançadas por post" stroke="#2563eb" strokeWidth={3} dot={false} />
                                <Line yAxisId="interactions" type="monotone" dataKey="interactions" name="Interações por post" stroke="#7c3aed" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                      <article className={`${audienceCardBase} ${isMobileViewport ? "hidden" : ""}`}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Resposta</h2>
                          </div>
                          <Sparkles className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className={chartHeightClassName}>
                          {loadingPosts ? (
                            <p className="text-sm text-slate-500">Carregando série...</p>
                          ) : weeklyEngagementRate.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={weeklyEngagementRate}
                                margin={{ top: 20, right: 12, left: -6, bottom: 0 }}
                                onClick={(state: any) => handleWeekClick(state?.activeLabel ?? null, "Percentual de resposta")}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis dataKey="date" tickFormatter={formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                <YAxis hide />
                                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string | number) => formatWeekLabel(String(l))} />
                                <Line type="monotone" dataKey="avgRate" name="Resposta" stroke="#7c3aed" strokeWidth={3} dot>
                                  <LabelList dataKey="avgRate" position="top" formatter={(v: number) => `${(v * 100).toFixed(1)}%`} fill="#64748b" fontSize={11} />
                                </Line>
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </section>
                    <section className="grid gap-3 grid-cols-1">
	                      <article className={audienceCardBase}>
	                        <header className="flex items-center justify-between gap-3">
	                          <div className={chartHeaderTextClassName}>
	                            <h2 className="text-base font-semibold text-slate-900">
                                {isMobileViewport ? (mobileDepthMetric === "saves" ? "Salvamentos" : "Comentários") : "Salvamentos"}
                              </h2>
	                          </div>
	                          <LineChartIcon className={`h-5 w-5 ${isMobileViewport && mobileDepthMetric === "comments" ? "text-indigo-500" : "text-rose-500"}`} />
	                        </header>
                        {isMobileViewport ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-100/90 bg-zinc-50/72 p-1">
                            <button
                              type="button"
                              onClick={() => setMobileDepthMetric("saves")}
                              className={`rounded-xl px-2 py-2 text-[11px] font-bold ${mobileDepthMetric === "saves" ? "bg-white text-rose-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                            >
                              Salvamentos
                            </button>
                            <button
                              type="button"
                              onClick={() => setMobileDepthMetric("comments")}
                              className={`rounded-xl px-2 py-2 text-[11px] font-bold ${mobileDepthMetric === "comments" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                            >
                              Comentários
                            </button>
                          </div>
                        ) : null}
	                        <div className={isMobileViewport ? "mt-3" : chartCompactHeightClassName}>
	                          {loadingPosts ? (
	                            <p className="text-sm text-slate-500">Carregando série...</p>
	                          ) : isMobileViewport && mobileDepthMetric === "comments" ? (
                            commentVelocitySeries.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={commentVelocitySeries}
                                  margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                                  onClick={(state: any) => handleWeekClick(state?.activeLabel ?? null, "Média de comentários por semana")}
                                  style={{ cursor: "pointer" }}
                                >
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
                                  />
                                  <Tooltip
                                    contentStyle={tooltipStyle}
                                    labelFormatter={(label: string | number) => formatWeekLabel(String(label))}
                                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Comentários médios"]}
                                  />
                                  <Line type="monotone" dataKey="avgComments" name="Comentários médios" stroke="#6366f1" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            )
                          ) : saveVelocitySeries.length === 0 ? (
	                            <p className="text-sm text-slate-500">Sem dados suficientes.</p>
	                          ) : (
	                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={saveVelocitySeries}
                                margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                                onClick={(state: any) => handleWeekClick(state?.activeLabel ?? null, "Média de salvamentos por semana")}
                                style={{ cursor: "pointer" }}
                              >
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
                                  label={isMobileViewport ? undefined : { value: "Salvamentos médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                                />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={(label: string | number) => formatWeekLabel(String(label))}
                                  formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Salvamentos médios"]}
                                />
                                <Line type="monotone" dataKey="avgSaves" name="Salvamentos médios" stroke="#ec4899" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
	                              </LineChart>
	                            </ResponsiveContainer>
	                          )}
	                        </div>
	                      </article>
	                      <article className={`${audienceCardBase} ${isMobileViewport ? "hidden" : ""}`}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Comentários</h2>
                          </div>
                          <LineChartIcon className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className={isMobileViewport ? "mt-3" : chartCompactHeightClassName}>
                          {loadingPosts ? (
                            <p className="text-sm text-slate-500">Carregando série...</p>
                          ) : commentVelocitySeries.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={commentVelocitySeries}
                                margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                                onClick={(state: any) => handleWeekClick(state?.activeLabel ?? null, "Média de comentários por semana")}
                                style={{ cursor: "pointer" }}
                              >
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
                                  label={isMobileViewport ? undefined : { value: "Comentários médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                                />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={(label: string | number) => formatWeekLabel(String(label))}
                                  formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Comentários médios"]}
                                />
                                <Line type="monotone" dataKey="avgComments" name="Comentários médios" stroke="#6366f1" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
	                      <article className={audienceCardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Compartilhamentos</h2>
                          </div>
                          <Sparkles className="h-5 w-5 text-amber-500" />
                        </header>
                        <div className={chartCompactHeightClassName}>
                          {loadingPosts ? (
                            <p className="text-sm text-slate-500">Carregando dados...</p>
                          ) : deepEngagement.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                          ) : isMobileViewport ? (
                            <MobileBarList
                              items={deepEngagement.map((item: any) => ({
                                id: item.format,
                                label: item.format,
                                value: item.sharesPerThousand,
                              }))}
                              emptyText="Sem dados suficientes."
                              accentClassName="bg-sky-500"
                              valueFormatter={(value) => value.toFixed(1)}
                              onSelect={(item) => handleCategoryClick("format", item.label, "Compartilhamentos por formato")}
                            />
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={deepEngagement}
                                layout="vertical"
                                margin={{ top: 6, right: 12, left: 40, bottom: 0 }}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="format" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="sharesPerThousand" name="Compartilhamentos" fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.format ? String(state.payload.format) : null; if (val) handleCategoryClick("format", val, "Compartilhamentos por formato"); }}>
                                  <LabelList dataKey="sharesPerThousand" position="right" formatter={(v: number) => v.toFixed(1)} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </section>
                    </section>
                  </div>
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
          <div className="space-y-3 pb-2">
            <div className="space-y-3">
              <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 px-3.5 py-3 shadow-lg sm:p-4">
                <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl"></div>

                <div className="relative space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 backdrop-blur-sm">
                      <Sparkles className="h-3 w-3" />
                      {RECOMMENDATION_TITLE_OVERRIDES[selectedRecommendation.id] || selectedRecommendation.title}
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${queueStageClassName[selectedRecommendation.queueStage || "monitor"]}`}>
                      {queueStageLabel[selectedRecommendation.queueStage || "monitor"]}
                    </span>
                  </div>
                  <h3 className="text-base font-medium leading-snug text-white sm:text-lg">
                    {selectedRecommendation.nextStep || selectedRecommendation.action}
                  </h3>
                  <p className="text-sm leading-relaxed text-indigo-100/90">
                    {simplifyEvidenceText(
                      selectedRecommendation.meaning ||
                        selectedRecommendation.strategicSynopsis ||
                        "Resumo direto para orientar a próxima ação."
                    )}
                  </p>
                  <p className="text-xs font-medium text-indigo-100/70">
                    {buildRecommendationMetaLine({
                      recommendationType: selectedRecommendation.recommendationType,
                      executionState: selectedRecommendation.executionState,
                      feedbackStatus: selectedRecommendationView?.feedbackStatus,
                      feedbackUpdatedAt: selectedRecommendationView?.feedbackUpdatedAt,
                    })}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-500" />
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Por que fazer isso</h4>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatSampleBaseText(selectedRecommendationView?.sampleSize)}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Sinal {confidenceLabel[selectedRecommendationView?.confidenceAdjusted || selectedRecommendation.confidence]?.toLowerCase()}
                </p>
                {directioningSummary?.compositeConfidence?.label ? (
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {directioningSummary.compositeConfidence.label}
                    {typeof directioningSummary.compositeConfidence.score === "number"
                      ? ` (${Math.round(directioningSummary.compositeConfidence.score)}/100)`
                      : ""}
                  </p>
                ) : null}
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Métrica</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecommendation.metricLabel || primaryMetricLabel}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Período</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecommendation.timeWindowLabel || periodLabel}</p>
                  </div>
                </div>
              </section>

              {selectedRecommendationView?.feedbackUpdatedAt ? (
                <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-100/90 bg-zinc-50/72 text-slate-500">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Depois disso</h4>
                      <p className="text-xs font-medium text-slate-500">
                        Você marcou isso em {formatShortDateTime(selectedRecommendationView.feedbackUpdatedAt)}.
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">
                        {simplifyEvidenceText(
                          selectedRecommendationImpactSummary?.text ||
                            `Desde então: ${directioningSummary?.primarySignal?.text || strategicDecisionLine}`
                        )}
                      </p>
                      {selectedRecommendationImpactSummary &&
                      typeof selectedRecommendationImpactSummary.beforeAvg === "number" &&
                      typeof selectedRecommendationImpactSummary.afterAvg === "number" ? (
                        <p className="text-xs text-slate-500">
                          Antes: {numberFormatter.format(Math.round(selectedRecommendationImpactSummary.beforeAvg))} • Depois: {numberFormatter.format(Math.round(selectedRecommendationImpactSummary.afterAvg))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Por que isso faz sentido</h4>
                </div>
                <div className="space-y-3">
                  {selectedRecommendation.evidence.length ? (
                    <ul className="space-y-2">
                      {selectedRecommendation.evidence.slice(0, 2).map((item, index) => (
                        <li key={`${selectedRecommendation.id}-${index}`} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                          <p className="text-sm leading-relaxed text-slate-700">{simplifyEvidenceText(item)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : directioningSummary?.comparison?.narrative ? (
                    <p className="text-sm leading-relaxed text-slate-700">{directioningSummary.comparison.narrative}</p>
                  ) : null}
                  {selectedRecommendation.evidence.length > 2 ? (
                    <p className="text-xs text-slate-500">+{selectedRecommendation.evidence.length - 2} observações a mais no detalhe completo.</p>
                  ) : null}
                  {directioningSummary?.compositeConfidence?.factors?.length ? (
                    <div className="border-t border-zinc-100/90 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Também entrou</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                        {directioningSummary.compositeConfidence.factors
                          .slice(0, 2)
                          .map((factor) => factor.label)
                          .join(" e ")}
                        .
                      </p>
                    </div>
                  ) : null}
                  {selectedRecommendationView?.hasLowSampleGuardrail ? (
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/72 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-xs font-medium leading-relaxed text-amber-800">
                          {formatGuardrailText(selectedRecommendationView.guardrailReason)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {selectedRecommendation.experimentPlan ? (
                <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Como validar</h4>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Sinal de que deu certo</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{selectedRecommendation.experimentPlan.successSignal}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Quantos posts</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{selectedRecommendation.experimentPlan.sampleGoal}</p>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 -mx-1 border-t border-zinc-100/90 bg-white/88 px-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-3 backdrop-blur">
              <div className="mx-auto max-w-lg space-y-2">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Marcar</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedRecommendationFeedbackLoading}
                    onClick={() => submitRecommendationFeedback(selectedRecommendation, "applied")}
                    className={`flex min-h-[38px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${selectedRecommendationView?.feedbackStatus === "applied"
                      ? "border-emerald-300 bg-emerald-50/78 text-emerald-700"
                      : "border-zinc-200/80 bg-white/82 text-slate-700 hover:border-zinc-300 hover:bg-zinc-50/82"
                      } ${selectedRecommendationFeedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className="mr-1.5 text-base leading-none">{selectedRecommendationView?.feedbackStatus === "applied" ? "✅" : "👍"}</span>
                    Fazer isso
                  </button>
                  <button
                    type="button"
                    disabled={selectedRecommendationFeedbackLoading}
                    onClick={() => submitRecommendationFeedback(selectedRecommendation, "not_applied")}
                    className={`flex min-h-[38px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${selectedRecommendationView?.feedbackStatus === "not_applied"
                      ? "border-amber-300 bg-amber-50/78 text-amber-700"
                      : "border-zinc-200/80 bg-white/82 text-slate-700 hover:border-zinc-300 hover:bg-zinc-50/82"
                      } ${selectedRecommendationFeedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className="mr-1.5 text-base leading-none">{selectedRecommendationView?.feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
                    Não fazer agora
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleGoToPlanner("recommendation_drawer")}
                  className="flex min-h-[36px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Ir para roteiros
                </button>
              </div>
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
