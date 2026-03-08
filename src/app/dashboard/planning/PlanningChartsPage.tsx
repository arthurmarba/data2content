"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import useSWR from "swr";
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
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, ArrowUpRight, Calendar as CalendarIcon, CheckCircle2, ChevronDown as ChevronDownIcon, Clock3, Copy, Database, ExternalLink, Filter as FilterIcon, Gift, LineChart as LineChartIcon, Sparkles, Target, Users, Zap as ZapIcon } from "lucide-react";
import { UserAvatar } from "@/app/components/UserAvatar";
import { TopDiscoveryTable } from "./components/TopDiscoveryTable";
import Drawer from "@/components/ui/Drawer";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { track } from "@/lib/track";
import {
  resolveRecommendationExecutionState,
  resolveRecommendationQueueStage,
  type PlanningRecommendationExecutionState,
  type PlanningRecommendationQueueStage,
} from "@/utils/buildPlanningRecommendations";

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

const cardBase = "rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm sm:px-4 sm:py-4";
const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" };
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
  last_30_days: 2,
  last_60_days: 2,
  last_90_days: 3,
  last_120_days: 4,
  last_180_days: 5,
  last_12_months: 6,
  all_time: 6,
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
  applied: "Marcada como feita",
  not_applied: "Marcada como adiada",
};
const queueStageLabel: Record<PlanningRecommendationQueueStage, string> = {
  now: "Agora",
  later: "Depois",
  monitor: "Observar",
};
const queueStageClassName: Record<PlanningRecommendationQueueStage, string> = {
  now: "border-slate-900 bg-slate-900 text-white",
  later: "border-slate-200 bg-slate-50 text-slate-700",
  monitor: "border-slate-200 bg-white text-slate-500",
};
const executionStateLabel: Record<PlanningRecommendationExecutionState, string> = {
  planned: "Ainda não feito",
  executed: "Já foi feito",
  waiting_impact: "Esperando resultado",
  discarded: "Descartado",
};
const recommendationTypeLabel: Record<NonNullable<PlanningRecommendationAction["recommendationType"]>, string> = {
  maintain: "Repetir",
  scale: "Aumentar",
  correct: "Corrigir",
  test: "Testar",
};
const RECOMMENDATION_TITLE_OVERRIDES: Record<string, string> = {
  duration: "Duração ideal",
  time_slot: "Melhor horário",
  tone_engagement: "Tom que mais funciona",
  proposal_engagement: "Ideia que mais funciona",
  format_reach: "Formato que mais funciona",
  context_reach: "Contexto que mais funciona",
  proposal_leads: "Ideia com mais intenção",
  context_leads: "Contexto com mais intenção",
  trend_recovery: "Voltar a crescer",
  trend_scale: "Aumentar o que funciona",
  trend_stability: "Manter o ritmo",
  baseline: "Criar referência",
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
      text: `Base pequena: ${formatPostsCount(metric.currentPosts)} agora vs ${formatPostsCount(metric.previousPosts)} antes.`,
      tone: "warning",
    };
  }
  if (typeof metric.deltaRatio !== "number" || !Number.isFinite(metric.deltaRatio)) {
    return { text: "Sem base suficiente no período anterior equivalente.", tone: "warning" };
  }
  const pct = Math.round(metric.deltaRatio * 100);
  if (Math.abs(pct) < 3) {
    return { text: `Estável: ${metricLabel} sem variação relevante vs período anterior.`, tone: "neutral" };
  }
  if (pct > 0) {
    return { text: `Em alta: +${pct}% em ${metricLabel} vs período anterior.`, tone: "positive" };
  }
  return { text: `Atenção: ${pct}% em ${metricLabel} vs período anterior.`, tone: "negative" };
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
      text: `Depois de ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} ficou estável contra os posts imediatamente anteriores.`,
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
      text: `Depois de ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} subiu ${pct}% contra os posts imediatamente anteriores.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }
  return {
    status: "declined",
    text: `Depois de ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} caiu ${Math.abs(pct)}% contra os posts imediatamente anteriores.`,
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
const chartHeightClassName = "mt-3 h-48 sm:h-56";
const chartTallHeightClassName = "mt-3 h-56 sm:h-64";
const chartCompactHeightClassName = "mt-3 h-40 sm:h-44";
type CategoryField = "format" | "proposal" | "context" | "tone" | "references";
type CategoryBarDatum = { name: string; value: number; postsCount?: number };
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
  variant?: "default" | "compact";
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

  return (
    <article
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 ${
        isCompact ? "px-3.5 py-3 shadow-lg sm:px-4 sm:py-3.5" : "px-4 py-3.5 shadow-xl"
      }`}
    >
      <div
        className={`absolute rounded-full bg-indigo-500/20 ${
          isCompact ? "-right-6 -top-6 h-28 w-28 blur-2xl" : "-right-10 -top-10 h-40 w-40 blur-3xl"
        }`}
      />
      <div
        className={`absolute rounded-full bg-cyan-500/10 ${
          isCompact ? "-bottom-8 -left-8 h-28 w-28 blur-2xl" : "-bottom-10 -left-10 h-40 w-40 blur-3xl"
        }`}
      />

      <div className={`relative ${isCompact ? "space-y-2.5" : "space-y-1.5"}`}>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2">
              <Sparkles className={`text-indigo-300 ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-200">{eyebrow}</span>
            </div>
            {statusChip ? (
              <span
                className={`inline-flex items-center rounded-full border border-white/10 bg-white/10 font-semibold text-white/80 ${
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
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
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
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-100">Faça agora</span>
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-100">Faça agora</p>
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
  affiliateCode?: string | null;
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
  const [showAdvancedSections, setShowAdvancedSections] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showMobileDirectioning, setShowMobileDirectioning] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveChartTab>("content");
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
    return recommendationsFlagEnabled;
  }, [isAdminViewer, recommendationsFlagEnabled, recommendationsFlagLoading]);
  const canShowAffiliateInvite = !isActingOnBehalf && Boolean(viewer?.affiliateCode);
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

  const { data: chartsBatchData, isLoading: loadingBatch, mutate: mutateChartsBatch } = useSWR(
    activeUserId
      ? `/api/v1/users/${activeUserId}/planning/charts-batch?timePeriod=${timePeriod}&granularity=weekly&objectiveMode=${objectiveMode}&limit=${PAGE_LIMIT}`
      : null,
    fetcher,
    swrOptions
  );
  const { data: recommendationFeedbackData, mutate: mutateRecommendationFeedback } = useSWR(
    activeUserId && recommendationsFeatureEnabled
      ? `/api/v1/users/${activeUserId}/planning/recommendation-feedback?objectiveMode=${objectiveMode}&timePeriod=${timePeriod}`
      : null,
    fetcher,
    swrOptions
  );

  const trendData = chartsBatchData?.trendData;
  const timeData = chartsBatchData?.timeData;
  const durationData = chartsBatchData?.durationData;
  const timingBenchmark = chartsBatchData?.timingBenchmark as TimingBenchmarkData | undefined;
  const similarCreators = chartsBatchData?.similarCreators as SimilarCreatorsData | undefined;
  const formatData = chartsBatchData?.formatData;
  const proposalData = chartsBatchData?.proposalData;
  const toneData = chartsBatchData?.toneData;
  const referenceData = chartsBatchData?.referenceData;
  const contextData = chartsBatchData?.contextData;
  const metricMeta = chartsBatchData?.metricMeta as
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
  const directioningSummary = chartsBatchData?.directioningSummary as DirectioningSummary | undefined;
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
        ? ((chartsBatchData?.recommendations?.actions || []) as PlanningRecommendationAction[])
        : [],
    [chartsBatchData?.recommendations?.actions, recommendationsFeatureEnabled]
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
        ? `${waitingImpactSummary.text} Enquanto isso, siga com ${RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title}.`
        : `Você já fez ${RECOMMENDATION_TITLE_OVERRIDES[waitingImpactRecommendation.id] || waitingImpactRecommendation.title}. Enquanto espera o resultado, siga com ${RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title}.`;
    }
    if (waitingImpactRecommendation) {
      return waitingImpactSummary?.text || `Você já fez ${RECOMMENDATION_TITLE_OVERRIDES[waitingImpactRecommendation.id] || waitingImpactRecommendation.title}. Agora espere o resultado antes de abrir uma nova frente.`;
    }
    if (recentlyExecutedRecommendation && topStrategicAction && recentlyExecutedRecommendation.id !== topStrategicAction.id) {
      return `A última ação já foi feita. Agora siga com ${RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title}.`;
    }
    if (directioningSummary?.headline) return directioningSummary.headline;
    if (!topStrategicAction) return "Ainda não há uma prioridade clara nesta semana.";
    if (recommendationActions.length > 0 && appliedRecommendationCount >= recommendationActions.length) {
      return "Tudo desta lista já foi feito. Agora espere os próximos dados.";
    }
    if ((topStrategicAction as any).strategicSynopsis) {
      return (topStrategicAction as any).strategicSynopsis;
    }

    const focusTitle = RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title;
    if (topStrategicAction.hasLowSampleGuardrail) {
      return `Comece testando ${focusTitle}.`;
    }
    return `Agora, foque em ${focusTitle}.`;
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
        title: "O que vimos",
        body: directioningSummary?.comparison?.narrative || directioningSummary?.primarySignal?.text || interactionsDeltaSummary.text,
      },
      {
        title: "Quão confiável é",
        body: directioningSummary?.compositeConfidence?.summary || directioningSummary?.confidence?.description || (topStrategicAction
          ? `${formatSampleBaseText(topStrategicAction.sampleSize)} • ${confidenceLabel[topStrategicAction.confidenceAdjusted].toLowerCase()}`
          : "Ainda faltam dados para confiar nessa leitura."),
      },
    ];
    if (metricMeta?.isProxy && metricMeta?.description) {
      cards.push({
        title: "Como ler isso",
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
  const directioningPriorityLabel = useMemo(() => {
    if (directioningSummary?.priorityLabel) return directioningSummary.priorityLabel;
    if (!topStrategicAction) return "Sem prioridade";
    return RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title;
  }, [directioningSummary?.priorityLabel, topStrategicAction]);
  const contentTabBrief = useMemo<TabBrief>(() => {
    const strongestLeader = getStrongestLeader([
      { dimension: "contexto", rows: contextBars, tone: contextExecutiveSummary.tone },
      { dimension: "proposta", rows: proposalBars, tone: proposalExecutiveSummary.tone },
      { dimension: "tom", rows: toneBars, tone: toneExecutiveSummary.tone },
    ]);
    if (!strongestLeader?.top?.name) {
      return {
        eyebrow: "O que postar",
        headline: "Ainda não repita uma linha só.",
        bulletPoints: [
          "Os sinais ainda se dividem entre proposta, contexto e tom.",
          "Seu ganho agora vem de manter o teste estável, não de abrir novas variações.",
        ],
        action: "Fixe uma proposta, um contexto e um tom por alguns posts.",
        supportingNote: "Trocar muitas variáveis agora só aumenta ruído.",
        statusChip: "Exploração",
      };
    }
    const leaderName = strongestLeader.top.name;
    const sampleLabel = formatActionSample(strongestLeader.top.postsCount);
    const statusChipByDimension: Record<string, string> = {
      contexto: "Contexto",
      proposta: "Proposta",
      tom: "Tom",
    };
    const meaningByDimension: Record<string, string> = {
      contexto: `${leaderName} está ajudando o tema a entrar pelo ângulo que mais prende atenção.`,
      proposta: `${leaderName} está deixando mais claro o valor da postagem.`,
      tom: `${leaderName} está tornando a mensagem mais convincente do que as alternativas.`,
    };
    const actionByDimension: Record<string, string> = {
      contexto: `Repita ${leaderName} por 2 ou 3 posts antes de abrir outro contexto.`,
      proposta: `Repita ${leaderName} antes de trocar proposta e tom ao mesmo tempo.`,
      tom: `Use ${leaderName} em sequência e compare só com um tom alternativo.`,
    };
    const supportingNote =
      typeof strongestLeader.top.postsCount === "number" && strongestLeader.top.postsCount < 5
        ? `${sampleLabel || "Base curta"}. Confirme antes de expandir essa linha.`
        : sampleLabel
          ? `${sampleLabel}. Use isso para decidir a próxima sequência.`
          : "Use isso para decidir a próxima sequência, não para congelar a linha editorial.";
    return {
      eyebrow: "O que postar",
      headline: `Repita ${leaderName}.`,
      bulletPoints: [
        meaningByDimension[strongestLeader.dimension] ||
          `${leaderName} é o sinal mais útil para orientar a próxima sequência.`,
        typeof strongestLeader.top.postsCount === "number" && strongestLeader.top.postsCount < 5
          ? "Vale confirmar primeiro antes de transformar isso em padrão."
          : "Esse é hoje o caminho mais seguro para repetir sem embaralhar a leitura.",
      ],
      action:
        strongestLeader.dimension === "contexto"
          ? `Use por 2 ou 3 posts antes de trocar o contexto.`
          : strongestLeader.dimension === "proposta"
            ? `Repita antes de trocar proposta e tom juntos.`
            : strongestLeader.dimension === "tom"
              ? `Use em sequência e compare com só um tom alternativo.`
              : `Repita ${leaderName} por alguns posts antes de abrir novas hipóteses.`,
      supportingNote,
      statusChip: statusChipByDimension[strongestLeader.dimension] || "Conteúdo",
    };
  }, [
    contextBars,
    contextExecutiveSummary.tone,
    proposalBars,
    proposalExecutiveSummary.tone,
    toneBars,
    toneExecutiveSummary.tone,
  ]);
  const formatTabBrief = useMemo<TabBrief>(() => {
    const bestFormat = formatBars[0];
    const durationSample = formatActionSample(bestDurationBucket?.postsCount);
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
    return {
      eyebrow: "Formato & timing",
      headline: strategicSetup,
      bulletPoints: [
        "Quando formato, horário e duração apontam juntos, o teste fica mais limpo e comparável.",
        durationSummary.durationCoverageRate < 0.7
          ? `A leitura de duração ainda cobre só ${(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos.`
          : lowSampleDurationBuckets > 0
            ? `${lowSampleDurationBuckets} faixa(s) ainda têm pouca base para fechar uma regra de execução.`
            : "Esse padrão reduz dispersão e ajuda a saber se o ganho veio mesmo da execução.",
      ],
      action:
        bestHour !== null && bestDurationBucket?.label && bestFormat?.name
          ? "Publique 2 ou 3 posts nesse padrão."
          : bestHour !== null && bestDurationBucket?.label
            ? "Publique 2 ou 3 posts nesse padrão."
            : "Fixe esse padrão por alguns posts.",
      supportingNote:
        benchmarkNote
          ? benchmarkNote
          : durationSample
            ? `${durationSample}.`
          : durationSummary.durationCoverageRate < 0.7
            ? `A leitura de duração cobre ${(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos. Ainda falta base para fechar regra.`
            : lowSampleDurationBuckets > 0
              ? `${lowSampleDurationBuckets} faixa(s) ainda têm poucos posts comparáveis.`
              : "Timing melhora a entrega, mas não compensa uma mensagem fraca.",
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
            ? "Pegue o que responde bem e melhore a distribuição."
            : "Ainda não abra novas frentes.";
    const discoveryMeaning =
      objectiveMode === "leads"
        ? "O post que chama atenção nem sempre é o que mais gera intenção."
        : "O post que alcança mais gente nem sempre é o que mais faz a audiência reagir.";
    const action =
      strategyMatrix.attractsCount > strategyMatrix.nurturesCount
        ? "Ajuste a mensagem antes de trocar o tema."
        : strategyMatrix.nurturesCount > strategyMatrix.attractsCount
          ? "Teste uma embalagem mais distribuível nesse tipo de post."
          : "Repita esse padrão antes de testar novas variações.";
    return {
      eyebrow: "Sua audiência",
      headline: balanceFact,
      bulletPoints: [
        discoveryMeaning,
        strategyMatrix.winnerCount > 0
          ? "Eles já mostraram que conseguem distribuir e gerar reação ao mesmo tempo."
          : strategyMatrix.attractsCount > strategyMatrix.nurturesCount
            ? "O gargalo agora está mais na mensagem do que na distribuição."
            : strategyMatrix.nurturesCount > 0
              ? "O gargalo agora está mais na distribuição do que na qualidade da resposta."
              : "Ainda falta padrão para separar o que só atrai do que realmente responde.",
      ],
      action,
      supportingNote: metricMeta?.isProxy
        ? `Parte desta leitura usa um sinal indireto: ${metricMeta.description}`
        : "Alcance alto sozinho não prova interesse forte.",
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
      const lowSampleLeader = [contextBars[0], proposalBars[0], toneBars[0]].find(
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
          ? `Parte desta leitura usa proxy: ${metricMeta.description}`
          : "Alcance alto não prova resposta forte.",
        "Post de descoberta pode não ser o mesmo post de conversão.",
      ];
      return notes.filter(Boolean) as string[];
    }

    const notes = [
      directioningNoGoLine,
      metricMeta?.isProxy && metricMeta?.description
        ? `Parte dessa leitura usa um sinal indireto: ${metricMeta.description}`
        : "Faça a ação principal antes de abrir novas interpretações.",
    ];
    return notes.filter(Boolean) as string[];
  }, [
    activeTab,
    contextBars,
    directioningNoGoLine,
    durationSummary.durationCoverageRate,
    lowSampleDurationBuckets,
    metricMeta?.description,
    metricMeta?.isProxy,
    proposalBars,
    toneBars,
  ]);
  const objectiveLabel = OBJECTIVE_OPTIONS.find((option) => option.value === objectiveMode)?.label || "Engajamento";
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === timePeriod)?.label || timePeriod;
  const shouldShowDirectioningOnMobile = showMobileDirectioning;
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

  return (
    <>
      <main className="w-full pb-12 pt-4 sm:pt-8">
        <div className="dashboard-page-shell space-y-5">
          <header className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <LineChartIcon className="h-4 w-4" />
              Análise de Perfil
            </div>
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">O que seu perfil está mostrando agora</h1>
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
          </header>

          {/* Sticky Filter Bar */}
          <div className="sticky top-0 z-20 isolate -mx-4 mb-2 border-b border-slate-200 bg-white px-4 py-3 supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:py-2.5 sm:shadow-sm">
              <div className="flex items-center justify-between sm:hidden">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FilterIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtros Ativos</p>
                    <p className="text-xs font-semibold text-slate-700">{objectiveLabel} • {periodLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileControls((prev) => !prev)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 active:scale-95 transition-transform"
                >
                  {showMobileControls ? "Fechar" : "Ajustar"}
                  <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${showMobileControls ? "rotate-180" : ""}`} />
                </button>
              </div>

              <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between tracking-tight">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <ZapIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Objetivo: <span className="text-indigo-600">{objectiveLabel}</span></p>
                    <p className="text-[11px] text-slate-500">
                      Base: {primaryMetricLabel}
                      {metricMeta?.isProxy && metricMeta?.description ? ` • ${metricMeta.description}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {recommendationsFeatureEnabled ? (
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/50">
                      {OBJECTIVE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleObjectiveModeChange(opt.value)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${objectiveMode === opt.value
                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden lg:block" />

                  <div className="relative group">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none group-focus-within:text-indigo-500 transition-colors" />
                    <select
                      id="timePeriod"
                      value={timePeriod}
                      onChange={(e) => handleTimePeriodChange(e.target.value)}
                      className="min-h-[36px] min-w-[160px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-bold text-slate-700 transition-all hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/5"
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180" />
                  </div>

                  {recommendationsFeatureEnabled ? (
                    <button
                      type="button"
                      onClick={() => handleGoToPlanner("recommendations_card")}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all"
                    >
                      Abrir Planejamento
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Mobile Expanded Controls */}
              <div className={`${showMobileControls ? "mt-4 grid gap-4 animate-in slide-in-from-top-2 duration-200" : "hidden"} sm:hidden border-t border-slate-100 pt-4 pb-1`}>
                {recommendationsFeatureEnabled ? (
                  <div className="grid gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Objetivo Estratégico</p>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/50">
                      {OBJECTIVE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleObjectiveModeChange(opt.value)}
                          className={`py-2 text-[11px] font-bold rounded-lg transition-all ${objectiveMode === opt.value
                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                            : "text-slate-500"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Janela de Tempo</p>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      id="timePeriodMobile"
                      value={timePeriod}
                      onChange={(e) => handleTimePeriodChange(e.target.value)}
                      className="w-full min-h-[44px] appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-bold text-slate-700"
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Métrica-base</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{primaryMetricLabel}</p>
                  {metricMeta?.isProxy && metricMeta?.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{metricMeta.description}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleGoToPlanner("recommendations_card");
                    setShowMobileControls(false);
                  }}
                  className="mt-2 w-full min-h-[44px] rounded-xl bg-slate-900 text-sm font-bold text-white active:scale-[0.98] transition-transform"
                >
                  Abrir Planejamento
                </button>
              </div>
            </div>

	          <div className="flex w-full items-center gap-2 overflow-x-auto border-b border-slate-200 pb-1.5 scrollbar-none">
            <button
              onClick={() => setActiveTab("directioning")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${activeTab === "directioning"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Direcionamento
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${activeTab === "content"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              O que postar
            </button>
            <button
              onClick={() => setActiveTab("format")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${activeTab === "format"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Formato & Timing
            </button>
            <button
              onClick={() => setActiveTab("audience")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${activeTab === "audience"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Sua Audiência
	            </button>
	          </div>

	          <div className="mt-4 pb-12">
	            <div ref={advancedSectionsSentinelRef} className="h-px w-full" />
            {showAdvancedSections ? (
              <>

                {activeTab === "directioning" && (
                  <div className="space-y-4">
                    {recommendationsFeatureEnabled ? (
                      <section className="space-y-3">
                        <StrategicHeroCard
                          eyebrow="Foco agora"
                          headline={strategicDecisionLine}
                          footer={
                            topStrategicAction ? (
                              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-white/75">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${queueStageClassName[topStrategicAction.queueStage]}`}
                                >
                                  {queueStageLabel[topStrategicAction.queueStage]}
                                </span>
                                <span className="font-semibold uppercase tracking-[0.12em] text-indigo-100">
                                  {directioningPriorityLabel}
                                </span>
                              </div>
                            ) : null
                          }
                        >
                          <div className="space-y-0.5 text-sm leading-relaxed text-white/80">
                            {directioningDiagnosisCards.map((card) => (
                              <p key={card.title}>
                                <span className="font-semibold text-white">{card.title}:</span> {card.body}
                              </p>
                            ))}
                          </div>
                        </StrategicHeroCard>

                        <article className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                          <div className="space-y-1 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-slate-400" />
                              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">O que fazer</h3>
                            </div>
                            <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
                              Evite {directioningNoGoLine.toLowerCase()}{" "}
                              <span className="text-slate-300">•</span>{" "}
                              {currentTabGuardrails[1] || "Faça a ação principal antes de abrir novos testes."}
                            </p>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {loadingBatch ? (
                              <p className="text-sm text-slate-500">Carregando plano de ação...</p>
                            ) : recommendationActions.length === 0 ? (
                              <p className="text-sm text-slate-500">Sem tarefas pendentes no momento. Volte após novos posts.</p>
                            ) : (
                              recommendationActions.map((item, index) => {
                                const actionFeedbackKey = String(item.feedbackKey || item.id || "").trim().toLowerCase();
                                const isFeedbackUpdating = Boolean(feedbackMutationByActionId[actionFeedbackKey]);
                                return (
                                  <article
                                    key={item.feedbackKey || item.id}
                                    className={`transition ${index === 0
                                      ? "rounded-xl bg-indigo-50/15 px-2.5 py-3"
                                      : "px-1 py-3.5"
                                      }`}
                                  >
                                    <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-3">
                                      <div className="flex min-w-0 items-start gap-3.5">
                                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold text-[10px] ${index === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                                          {index + 1}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${queueStageClassName[item.queueStage]}`}>
                                              {queueStageLabel[item.queueStage]}
                                            </span>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                              {RECOMMENDATION_TITLE_OVERRIDES[item.id] || item.title}
                                            </p>
                                          </div>
                                          <h4 className="text-sm font-semibold leading-snug text-slate-900" style={index === 0 ? undefined : twoLineClampStyle}>
                                            {item.nextStep || item.action}
                                          </h4>
                                          <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden">
                                            <button
                                              type="button"
                                              disabled={isFeedbackUpdating}
                                              onClick={() => submitRecommendationFeedback(item, "applied")}
                                              className={`inline-flex min-h-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition ${item.feedbackStatus === "applied"
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                                } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                            >
                                              <span className="mr-1.5 text-sm leading-none">{item.feedbackStatus === "applied" ? "✅" : "👍"}</span>
                                              {feedbackStatusLabel.applied}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isFeedbackUpdating}
                                              onClick={() => submitRecommendationFeedback(item, "not_applied")}
                                              className={`inline-flex min-h-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition ${item.feedbackStatus === "not_applied"
                                                ? "bg-amber-50 text-amber-700"
                                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                                } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                            >
                                              <span className="mr-1.5 text-sm leading-none">{item.feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
                                              {feedbackStatusLabel.not_applied}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openRecommendationEvidence(item)}
                                              className="inline-flex min-h-[28px] items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-slate-100 hover:text-indigo-800"
                                            >
                                              Ler análise
                                              <ArrowUpRight className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                                            {recommendationTypeLabel[recommendationTypeFallback(item.recommendationType)]} • {executionStateLabel[item.executionState || "planned"]}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="hidden flex-wrap items-center gap-0.5 lg:flex lg:shrink-0">
                                        <button
                                          type="button"
                                          disabled={isFeedbackUpdating}
                                          onClick={() => submitRecommendationFeedback(item, "applied")}
                                          className={`inline-flex min-h-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition ${item.feedbackStatus === "applied"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                            } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                        >
                                          <span className="mr-1.5 text-sm leading-none">{item.feedbackStatus === "applied" ? "✅" : "👍"}</span>
                                          {feedbackStatusLabel.applied}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isFeedbackUpdating}
                                          onClick={() => submitRecommendationFeedback(item, "not_applied")}
                                          className={`inline-flex min-h-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition ${item.feedbackStatus === "not_applied"
                                            ? "bg-amber-50 text-amber-700"
                                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                            } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                        >
                                          <span className="mr-1.5 text-sm leading-none">{item.feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
                                          {feedbackStatusLabel.not_applied}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openRecommendationEvidence(item)}
                                          className="inline-flex min-h-[28px] items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-slate-100 hover:text-indigo-800"
                                        >
                                          Ler análise
                                          <ArrowUpRight className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })
                            )}
                          </div>
                        </article>
                      </section>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                        <p className="text-sm text-slate-500">O Direcionamento Estratégico não está disponível no momento.</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab !== "directioning" && currentTabBrief ? (
                  <section className="mb-4">
                    <StrategicHeroCard
                      variant="compact"
                      eyebrow={currentTabBrief.eyebrow}
                      headline={currentTabBrief.headline}
                      reading={currentTabBrief.reading}
                      bulletPoints={currentTabBrief.bulletPoints}
                      action={currentTabBrief.action}
                      supportingNote={currentTabBrief.supportingNote}
                      statusChip={currentTabBrief.statusChip}
                    />
                  </section>
                ) : null}
	                {activeTab === "content" && (
	                  <div className="space-y-4">
	                    <section>
	                    <div className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Proposta</h2>
                          </div>
                          <Sparkles className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className={chartHeightClassName}>
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
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#6366f1" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("proposal", val, `${primaryMetricShortLabel} por proposta`); }}>
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
                            <h2 className="text-base font-semibold text-slate-900">Contexto</h2>
                          </div>
                          <Target className="h-5 w-5 text-slate-600" />
                        </header>
                        <div className={chartHeightClassName}>
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
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("context", val, `${primaryMetricShortLabel} por contexto`); }}>
                                  <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </div>
                    </section>
                    <section>
                    <div className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Tom</h2>
                          </div>
                          <Sparkles className="h-5 w-5 text-emerald-500" />
                        </header>
                        <div className={chartHeightClassName}>
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
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#10b981" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("tone", val, `${primaryMetricShortLabel} por tom`); }}>
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
                          </div>
                          <Sparkles className="h-5 w-5 text-amber-500" />
                        </header>
                        <div className={chartHeightClassName}>
                          {loadingReference ? (
                            <p className="text-sm text-slate-500">Carregando referências...</p>
                          ) : referenceBars.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem referências registradas.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={referenceBars}
                                layout="vertical"
                                margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#f59e0b" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("references", val, `${primaryMetricShortLabel} por referência`); }}>
                                  <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </div>
                    </section>
                  </div>
                )}

	                {activeTab === "format" && (
                    <div className="space-y-4">
	                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-4">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Horário</h2>
                            {bestHour !== null && (
                              <p className="text-xs text-emerald-700">Melhor: {bestHour}h</p>
                            )}
                            {timingBenchmarkEnabled && benchmarkPostingHoursLabel ? (
                              <p className="text-xs text-slate-500">
                                Contas parecidas costumam postar em {benchmarkPostingHoursLabel}
                                {bestBenchmarkHourByAverage !== null ? ` • melhor faixa perto de ${bestBenchmarkHourByAverage}h` : ""}
                              </p>
                            ) : timingBenchmark?.cohort?.reason ? (
                              <p className="text-xs text-slate-400">{timingBenchmark.cohort.reason}</p>
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
                            {benchmarkMetaLine ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {benchmarkMetaLine}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={chartHeightClassName}>
                          {loadingTime ? (
                            <p className="text-sm text-slate-500">Carregando horários...</p>
                          ) : hourBars.length === 0 ? (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-500">Sem dados suficientes no período selecionado.</p>
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
                                  Publique novos conteúdos para liberar recomendações de horário.
                                </p>
                              )}
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={hourBenchmarkSeries}
                                margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                                style={{ cursor: "pointer" }}
                              >
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
                                  onClick={({ payload }) => {
                                    const hour = typeof payload?.hour === "number" ? payload.hour : null;
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
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Duração</h2>
                            {bestDurationBucket ? (
                              <p className="text-xs text-emerald-700">
                                Melhor: {bestDurationBucket.label}
                              </p>
                            ) : null}
                            {lowSampleDurationBuckets > 0 ? (
                              <p className="text-xs text-amber-700">
                                {lowSampleDurationBuckets} faixa(s) com base curta.
                              </p>
                            ) : null}
                            {timingBenchmarkEnabled && benchmarkDurationPostingBucket ? (
                              <p className="text-xs text-slate-500">
                                Nesse grupo, {benchmarkDurationPostingBucket.label} aparece mais
                                {benchmarkDurationPerformanceBucket ? ` • e ${benchmarkDurationPerformanceBucket.label} costuma responder melhor` : ""}
                              </p>
                            ) : null}
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
                            {benchmarkMetaLine ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {benchmarkMetaLine}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={chartHeightClassName}>
                          {loadingDuration ? (
                            <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
                          ) : durationSummary.totalVideoPosts === 0 ? (
                            <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                          ) : durationSummary.totalPostsWithDuration === 0 ? (
                            <p className="text-sm text-slate-500">Sem duração suficiente para comparar faixas.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={durationBenchmarkSeries}
                                margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                                onClick={(state) => {
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
                                  labelFormatter={(label, payload: any[]) => {
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
                      <article className={cardBase}>
                        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-5 w-5 text-slate-700" />
                              <h2 className="text-base font-semibold text-slate-900">Criadores similares</h2>
                            </div>
                            <p className="text-xs text-slate-500">
                              Contas parecidas com a sua, em ranking por seguidores, para você abrir o mídia kit e entender quem compõe sua base comparativa.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {similarCreators?.label ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {similarCreators.label}
                              </span>
                            ) : null}
                            {totalSimilarCreatorsCount > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {similarCreatorsSummaryLabel}
                              </span>
                            ) : null}
                          </div>
                        </header>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 sm:p-3">
                          {loadingBatch && !chartsBatchData ? (
                            <p className="px-2 py-8 text-sm text-slate-500">Carregando criadores similares...</p>
                          ) : similarCreatorsEnabled ? (
                            <div className="space-y-2">
                              {similarCreators?.reason ? (
                                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
                                      className="flex items-center gap-3 rounded-[1.1rem] bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100"
                                    >
                                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
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
                                          className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                                        >
                                          Mídia kit
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      ) : (
                                        <span className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                                          Sem mídia kit
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          ) : (
                            <div className="rounded-[1.1rem] bg-white px-4 py-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
                              {similarCreators?.reason || "Ainda faltam contas parecidas suficientes para montar esse ranking."}
                            </div>
                          )}
                          {canShowAffiliateInvite ? (
                            <div className="mt-3 rounded-[1.1rem] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.92)_0%,rgba(255,255,255,1)_100%)] px-4 py-4 shadow-sm">
                              <div className="flex items-start gap-3">
                                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                  <Gift className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-semibold text-slate-900">Convide mais criadores similares</h3>
                                  <p className="mt-1 text-xs leading-5 text-slate-600">
                                    Traga mais contas parecidas para melhorar sua base de comparação. Se alguém entrar pelo seu link, você também pode ser remunerado por isso.
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={handleCopyAffiliateInvite}
                                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copiar link de convite
                                </button>
                                <a
                                  href="/dashboard/afiliados"
                                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Ver afiliados
                                  <ArrowUpRight className="h-4 w-4" />
                                </a>
                              </div>
                              <p className="mt-2 text-[11px] text-slate-500">
                                Código: <span className="font-semibold text-slate-700">{viewer.affiliateCode}</span>
                              </p>
                              {affiliateCopyStatus === "copied" ? (
                                <p className="mt-2 text-xs font-medium text-emerald-700">Link copiado. Você já pode compartilhar.</p>
                              ) : affiliateCopyStatus === "error" ? (
                                <p className="mt-2 text-xs font-medium text-amber-700">Não deu para copiar agora. Tente novamente.</p>
                              ) : (
                                <p className="mt-2 text-xs text-slate-500">Use esse link para aumentar a base com criadores do seu nicho.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </article>
                      </div>
                      <div className="space-y-4">
                    <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Semana</h2>
                            {timingBenchmarkEnabled && benchmarkPostingWindowLabel ? (
                              <p className="text-xs text-slate-500">
                                Nesse grupo, a rotina aparece mais em {benchmarkPostingWindowLabel}
                                {benchmarkPerformanceWindowLabel ? ` • e o melhor retorno vem em ${benchmarkPerformanceWindowLabel}` : ""}
                              </p>
                            ) : null}
                          </div>
                          <Clock3 className="h-5 w-5 text-indigo-500" />
                        </header>
                        {timingBenchmarkEnabled && benchmarkMetaLine ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {benchmarkMetaLine}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                              Contorno = horários que esse grupo mais usa
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-3">
                          {loadingTime ? (
                            <p className="text-sm text-slate-500">Carregando mapa de horários...</p>
                          ) : heatmap.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem dados para montar o mapa de horários.</p>
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
                          )}
                        </div>
                      </article>
                    <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Cobertura de duração</h2>
                            {durationSummary.totalVideoPosts > 0 ? (
                              <p className="text-xs text-slate-500">
                                {(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos com duração.
                              </p>
                            ) : null}
                            {timingBenchmarkEnabled && benchmarkDurationPostingBucket ? (
                              <p className="text-xs text-slate-500">
                                Nesse grupo, {benchmarkDurationPostingBucket.label} aparece mais
                                {topDurationUsageBucket && topDurationUsageBucket.label !== benchmarkDurationPostingBucket.label
                                  ? ` • no seu perfil, ${topDurationUsageBucket.label} aparece mais`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                          <Clock3 className="h-5 w-5 text-cyan-500" />
                        </header>
                            {timingBenchmarkEnabled && benchmarkMetaLine ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {benchmarkMetaLine}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700">
                              Linha pontilhada = % dos videos desse grupo
                            </span>
                          </div>
                        ) : null}
                        <div className={chartCompactHeightClassName}>
                          {loadingDuration ? (
                            <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
                          ) : durationSummary.totalVideoPosts === 0 ? (
                            <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                          ) : durationSummary.totalPostsWithDuration === 0 ? (
                            <p className="text-sm text-slate-500">
                              Ainda não conseguimos ler a duração dos vídeos deste período.
                            </p>
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
                                  labelFormatter={(label, payload: any[]) => {
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
                                  onClick={({ payload }) => {
                                    const bucketKey = payload?.key as DurationBucketKey | undefined;
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
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Formato</h2>
                            {timingBenchmarkEnabled && benchmarkTopFormatByPosts ? (
                              <p className="text-xs text-slate-500">
                                {benchmarkTopFormatByAverage && benchmarkTopFormatByAverage === benchmarkTopFormatByPosts
                                  ? `Nesse grupo, ${benchmarkTopFormatByPosts} domina em volume e resultado.`
                                  : `Nesse grupo, ${benchmarkTopFormatByPosts} aparece mais${
                                      benchmarkTopFormatByAverage ? ` • ${benchmarkTopFormatByAverage} costuma ir melhor` : ""
                                    }`}
                              </p>
                            ) : null}
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
                            {benchmarkMetaLine ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {benchmarkMetaLine}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={chartHeightClassName}>
                          {loadingFormat ? (
                            <p className="text-sm text-slate-500">Carregando formatos...</p>
                          ) : formatBars.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem dados de formato neste período.</p>
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
                                  labelFormatter={(label, payload: any[]) => {
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
                                <Bar dataKey="value" name={primaryMetricUnitLabel} fill="#f97316" radius={[6, 6, 0, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("format", val, `${primaryMetricShortLabel} por formato`); }}>
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
                  </div>
                )}

		                {activeTab === "audience" && (
		                  <div className="space-y-4">
		                    <section>
		                    <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
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
		                                    labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.label || "Post"}
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
		                                        r={5}
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
                                  <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                                    Mais resposta
                                  </div>
                                  <div className="pointer-events-none absolute bottom-0 right-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                                    Mais alcance
                                  </div>
                                </div>
		                          )}
		                        </div>
		                      </article>
		                      <div className="space-y-3">
                          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-700">{strategyMatrix.summary}</p>
                          </article>
		                      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
		                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Como usar</p>
		                        <div className="mt-3 grid gap-2 text-sm text-slate-700">
		                          <div className="rounded-xl bg-slate-50 px-3 py-2"><strong className="text-slate-900">Azul escuro:</strong> repetir.</div>
		                          <div className="rounded-xl bg-slate-50 px-3 py-2"><strong className="text-slate-900">Azul claro:</strong> atrai, mas pede ajuste de mensagem.</div>
		                          <div className="rounded-xl bg-slate-50 px-3 py-2"><strong className="text-slate-900">Verde:</strong> responde bem, mas precisa mais distribuição.</div>
		                        </div>
		                      </article>
                        </div>
                    </div>
                    </section>
                    <section>
                    <section className={cardBase}>
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
		                    <section>
		                    <section className="grid items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
		                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Evolução</h2>
                          </div>
                          <Sparkles className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className={chartHeightClassName}>
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
                                  formatter={(value: number, name: string) => [numberFormatter.format(Math.round(value)), name]}
                                />
                                <Line yAxisId="reach" type="monotone" dataKey="reach" name="Pessoas alcançadas por post" stroke="#2563eb" strokeWidth={3} dot={false} />
                                <Line yAxisId="interactions" type="monotone" dataKey="interactions" name="Interações por post" stroke="#7c3aed" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                      <article className={cardBase}>
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
                                onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Percentual de resposta")}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis dataKey="date" tickFormatter={formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                <YAxis hide />
                                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatWeekLabel(String(l))} />
                                <Line type="monotone" dataKey="avgRate" name="Resposta" stroke="#7c3aed" strokeWidth={3} dot>
                                  <LabelList dataKey="avgRate" position="top" formatter={(v: number) => `${(v * 100).toFixed(1)}%`} fill="#64748b" fontSize={11} />
                                </Line>
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </section>
                    <section className="grid gap-3 lg:grid-cols-3">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Salvamentos</h2>
                          </div>
                          <LineChartIcon className="h-5 w-5 text-rose-500" />
                        </header>
                        <div className={chartCompactHeightClassName}>
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
                          <div className={chartHeaderTextClassName}>
                            <h2 className="text-base font-semibold text-slate-900">Comentários</h2>
                          </div>
                          <LineChartIcon className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className={chartCompactHeightClassName}>
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
                      <article className={cardBase}>
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
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={deepEngagement}
                                layout="vertical"
                                margin={{ top: 6, right: 12, left: 40, bottom: 0 }}
                                style={{ cursor: "pointer" }}
                              >
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="format" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="sharesPerThousand" name="Compartilhamentos" fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.format ? String(payload.format) : null; if (val) handleCategoryClick("format", val, "Compartilhamentos por formato"); }}>
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
              <section className="grid gap-4 md:grid-cols-2">
                {[0, 1].map((index) => (
                  <article key={index} className={cardBase}>
                    <div className="h-[340px] animate-pulse rounded-xl bg-slate-100/80" />
                  </article>
                ))}
              </section>
            )}
          </div>
        </div>
      </main>
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
                    {selectedRecommendation.meaning || selectedRecommendation.strategicSynopsis || "Resumo direto para orientar a próxima ação."}
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

              <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-500" />
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Por que isso apareceu</h4>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatSampleBaseText(selectedRecommendationView?.sampleSize)}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Leitura {confidenceLabel[selectedRecommendationView?.confidenceAdjusted || selectedRecommendation.confidence]?.toLowerCase()}
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
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">O que olhamos</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecommendation.metricLabel || primaryMetricLabel}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Período</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecommendation.timeWindowLabel || periodLabel}</p>
                  </div>
                </div>
              </section>

              {selectedRecommendationView?.feedbackUpdatedAt ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Depois disso</h4>
                      <p className="text-xs font-medium text-slate-500">
                        Você marcou isso em {formatShortDateTime(selectedRecommendationView.feedbackUpdatedAt)}.
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">
                        {selectedRecommendationImpactSummary?.text || `Desde então: ${directioningSummary?.primarySignal?.text || strategicDecisionLine}`}
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

              <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">O que chamou atenção</h4>
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
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Também olhamos</p>
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
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
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
                <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Se quiser confirmar</h4>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Como saber se funcionou</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{selectedRecommendation.experimentPlan.successSignal}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Quantos posts usar</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{selectedRecommendation.experimentPlan.sampleGoal}</p>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white/95 px-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-3 backdrop-blur">
              <div className="mx-auto max-w-lg space-y-2">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">O que você quer fazer</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedRecommendationFeedbackLoading}
                    onClick={() => submitRecommendationFeedback(selectedRecommendation, "applied")}
                    className={`flex min-h-[38px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${selectedRecommendationView?.feedbackStatus === "applied"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      } ${selectedRecommendationFeedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className="mr-1.5 text-base leading-none">{selectedRecommendationView?.feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
                    Não fazer agora
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleGoToPlanner("recommendation_drawer")}
                  className="flex min-h-[36px] w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
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
