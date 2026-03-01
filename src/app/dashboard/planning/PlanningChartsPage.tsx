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
import { AlertCircle, ArrowUpRight, Calendar as CalendarIcon, CheckCircle2, ChevronDown as ChevronDownIcon, Clock3, Database, Filter as FilterIcon, LineChart as LineChartIcon, Sparkles, Target, TrendingUp, Zap as ZapIcon } from "lucide-react";
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
  feedbackKey?: string | null;
  title: string;
  action: string;
  impactEstimate: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  sampleSize?: number | null;
  expectedLiftRatio?: number | null;
  opportunityScore?: number | null;
  rankingScore?: number | null;
  signalQuality?: "high_signal" | "medium_signal" | "low_signal";
  guardrailReason?: string | null;
  feedbackStatus?: RecommendationFeedbackStatus | null;
};
type RecommendationFeedbackStatus = "applied" | "not_applied";
type RecommendationActionView = PlanningRecommendationAction & {
  confidenceAdjusted: PlanningRecommendationAction["confidence"];
  sampleSize: number | null;
  hasLowSampleGuardrail: boolean;
  opportunityScore: number;
  rankingScore: number;
  feedbackStatus: RecommendationFeedbackStatus | null;
};
type BackendStrategicMetricDelta = {
  currentAvg: number | null;
  previousAvg: number | null;
  deltaRatio: number | null;
  currentPosts: number;
  previousPosts: number;
  hasMinimumSample: boolean;
};
const OBJECTIVE_OPTIONS: Array<{ value: PlanningObjectiveMode; label: string }> = [
  { value: "engagement", label: "Engajamento" },
  { value: "reach", label: "Alcance" },
  { value: "leads", label: "Leads" },
];
const confidenceLabel: Record<PlanningRecommendationAction["confidence"], string> = {
  high: "Sinal forte",
  medium: "Sinal moderado",
  low: "Sinal inicial",
};
const feedbackStatusLabel: Record<RecommendationFeedbackStatus, string> = {
  applied: "Fiz isso",
  not_applied: "Não agora",
};
const RECOMMENDATION_TITLE_OVERRIDES: Record<string, string> = {
  duration: "Duração ideal",
  time_slot: "Melhor horário",
  tone_engagement: "Tom dominante",
  proposal_engagement: "Proposta vencedora",
  format_reach: "Formato dominante",
  context_reach: "Contexto com tração",
  proposal_leads: "Proposta com intenção",
  context_leads: "Contexto para conversão",
  trend_recovery: "Recuperar tendência",
  trend_scale: "Escalar tendência",
  trend_stability: "Estabilizar tendência",
  baseline: "Criar baseline",
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
const twoLineClampStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
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
  const formatData = chartsBatchData?.formatData;
  const proposalData = chartsBatchData?.proposalData;
  const toneData = chartsBatchData?.toneData;
  const referenceData = chartsBatchData?.referenceData;
  const contextData = chartsBatchData?.contextData;
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
          if (nextStatus === "clear") {
            delete currentMap[actionKey];
          } else {
            currentMap[actionKey] = nextStatus;
          }
          return { ...(current || {}), feedbackByActionId: currentMap };
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
        await mutateRecommendationFeedback();
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

    return rawRecommendationActions
      .map((action) => {
        const normalizedActionId = String(action.id || "").trim().toLowerCase();
        const normalizedFeedbackKey = String(action.feedbackKey || "").trim().toLowerCase();
        const feedbackStatus =
          feedbackByActionId[normalizedFeedbackKey] ||
          feedbackByActionId[normalizedActionId] ||
          action.feedbackStatus ||
          null;
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
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);
  }, [
    bestDurationBucket?.postsCount,
    bestHourSample,
    contextBars,
    feedbackByActionId,
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
    () => recommendationActions.find((action) => action.feedbackStatus !== "applied") || recommendationActions[0] || null,
    [recommendationActions]
  );
  const strategicDecisionLine = useMemo(() => {
    if (!topStrategicAction) return "Sem prioridade definida nesta semana.";
    if (recommendationActions.length > 0 && appliedRecommendationCount >= recommendationActions.length) {
      return "Plano de ação concluído. Os dados estão amadurecendo para o próximo diagnóstico.";
    }

    // Injecting the new premium wording:
    // We prioritize the new `strategicSynopsis` field coming from the API.
    // As a fallback, we keep a cleaner version of the old title.
    if ((topStrategicAction as any).strategicSynopsis) {
      return (topStrategicAction as any).strategicSynopsis;
    }

    const focusTitle = RECOMMENDATION_TITLE_OVERRIDES[topStrategicAction.id] || topStrategicAction.title;
    if (topStrategicAction.hasLowSampleGuardrail) {
      return `Foco inicial: Explore hipóteses em ${focusTitle}.`;
    }
    return `Alavanca primária: Dedique atenção a ${focusTitle}.`;
  }, [appliedRecommendationCount, recommendationActions.length, topStrategicAction]);
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
              Gráficos do planejamento
            </div>
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">Leituras com dados reais</h1>
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
            {/* Sticky Filter Bar */}
            <div className="sticky top-0 z-40 -mx-4 mb-2 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:py-2.5 sm:shadow-sm">
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
                  <p className="text-xs font-semibold text-slate-600">Explorando seu <span className="text-indigo-600">{objectiveLabel}</span> no período.</p>
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
          </header>

          <div className="flex w-full items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 scrollbar-none">
            <button
              onClick={() => setActiveTab("directioning")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "directioning"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Direcionamento
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "content"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              O que postar
            </button>
            <button
              onClick={() => setActiveTab("format")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "format"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Formato & Timing
            </button>
            <button
              onClick={() => setActiveTab("audience")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "audience"
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
                      <section className="space-y-8">
                        {/* HERO BANNER ESTRATÉGICO */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-6 shadow-xl sm:p-8">
                          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"></div>
                          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl"></div>

                          <div className="relative">
                            <div className="mb-4 flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-indigo-400" />
                              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-300">Inteligência Estratégica</span>
                            </div>
                            <h2 className="text-xl font-medium leading-relaxed text-white sm:text-2xl">{strategicDecisionLine}</h2>
                          </div>
                        </div>

                        {/* PLANO DE AÇÃO */}
                        <div>
                          <div className="mb-4 flex items-center gap-2">
                            <Target className="h-4 w-4 text-slate-400" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Plano de Ação</h3>
                          </div>

                          <div className="grid gap-5 md:grid-cols-2">
                            {loadingBatch ? (
                              <p className="text-sm text-slate-500 md:col-span-2">Carregando plano de ação...</p>
                            ) : recommendationActions.length === 0 ? (
                              <p className="text-sm text-slate-500 md:col-span-2">Sem tarefas pendentes no momento. Volte após novos posts.</p>
                            ) : (
                              recommendationActions.map((item, index) => {
                                const actionFeedbackKey = String(item.feedbackKey || item.id || "").trim().toLowerCase();
                                const isFeedbackUpdating = Boolean(feedbackMutationByActionId[actionFeedbackKey]);
                                return (
                                  <article
                                    key={item.feedbackKey || item.id}
                                    className={`flex h-auto min-h-0 flex-col rounded-2xl border p-5 transition hover:border-slate-300 hover:shadow-sm sm:h-full ${index === 0
                                      ? "border-indigo-200 bg-white shadow-[0_2px_8px_rgba(79,70,229,0.08)]"
                                      : "border-slate-200 bg-white"
                                      }`}
                                  >
                                    <div className="mb-3 flex items-start gap-3">
                                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-[11px] ${index === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                                        {index + 1}
                                      </div>
                                      <div>
                                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                          {RECOMMENDATION_TITLE_OVERRIDES[item.id] || item.title}
                                        </p>
                                        <h4 className="text-[15px] font-semibold leading-relaxed text-slate-900" style={twoLineClampStyle}>
                                          {item.action}
                                        </h4>
                                      </div>
                                    </div>

                                    <div className="mt-4 pt-1 sm:mt-auto">
                                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={isFeedbackUpdating}
                                            onClick={() => submitRecommendationFeedback(item, "applied")}
                                            className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition sm:flex-none ${item.feedbackStatus === "applied"
                                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                              } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                          >
                                            <span className="mr-1.5 text-base leading-none">{item.feedbackStatus === "applied" ? "✅" : "👍"}</span>
                                            {feedbackStatusLabel.applied}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isFeedbackUpdating}
                                            onClick={() => submitRecommendationFeedback(item, "not_applied")}
                                            className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition sm:flex-none ${item.feedbackStatus === "not_applied"
                                              ? "border-amber-300 bg-amber-50 text-amber-700"
                                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                              } ${isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                                          >
                                            <span className="mr-1.5 text-base leading-none">{item.feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
                                            {feedbackStatusLabel.not_applied}
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => openRecommendationEvidence(item)}
                                          className="inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 sm:w-auto"
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
                        </div>
                      </section>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                        <p className="text-sm text-slate-500">O Direcionamento Estratégico não está disponível no momento.</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "content" && (
                  <div className="space-y-4">
                    <section className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contexto</p>
                            <h2 className="text-base font-semibold text-slate-900">Resposta por post por contexto</h2>
                            <p className={`text-xs ${deltaToneClassMap[contextExecutiveSummary.tone]}`}>{contextExecutiveSummary.text}</p>
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
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name="Respostas" fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("context", val, "Resposta por contexto"); }}>
                                  <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Intenção do Conteúdo</p>
                            <h2 className="text-base font-semibold text-slate-900">Resposta por proposta (Vender, Educar...)</h2>
                            <p className={`text-xs ${deltaToneClassMap[proposalExecutiveSummary.tone]}`}>{proposalExecutiveSummary.text}</p>
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
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name="Respostas" fill="#6366f1" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("proposal", val, "Resposta por proposta"); }}>
                                  <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
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
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tom de Voz</p>
                            <h2 className="text-base font-semibold text-slate-900">Resposta por tom da mensagem</h2>
                            <p className={`text-xs ${deltaToneClassMap[toneExecutiveSummary.tone]}`}>{toneExecutiveSummary.text}</p>
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
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name="Respostas" fill="#10b981" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("tone", val, "Resposta por tom"); }}>
                                  <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Referências</p>
                            <h2 className="text-base font-semibold text-slate-900">Resposta por post por referência</h2>
                            <p className={`text-xs ${deltaToneClassMap[referenceExecutiveSummary.tone]}`}>{referenceExecutiveSummary.text}</p>
                          </div>
                          <Sparkles className="h-5 w-5 text-amber-500" />
                        </header>
                        <div className="mt-4 h-64">
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
                                <Bar dataKey="value" name="Respostas" fill="#f59e0b" radius={[0, 6, 6, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("references", val, "Resposta por referência"); }}>
                                  <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </section>
                  </div>
                )}

                {activeTab === "format" && (
                  <div className="space-y-4">
                    <section className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mapa de horários</p>
                            <h2 className="text-base font-semibold text-slate-900">Dias e horas que mais engajam</h2>
                            <p className={`text-xs ${deltaToneClassMap[heatmapExecutiveSummary.tone]}`}>{heatmapExecutiveSummary.text}</p>
                          </div>
                          <Clock3 className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className="mt-4">
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
                                    return (
                                      <button
                                        key={hIdx}
                                        type="button"
                                        className="aspect-square rounded border border-slate-100 transition hover:border-slate-300"
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
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Horário</p>
                            <h2 className="text-base font-semibold text-slate-900">Melhor horário para postar</h2>
                            {bestHour !== null && (
                              <p className="text-xs text-emerald-700">Janela com melhor resposta: {bestHour}h</p>
                            )}
                          </div>
                          <Clock3 className="h-5 w-5 text-emerald-500" />
                        </header>
                        <div className="mt-4 h-64">
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
                              <BarChart
                                data={hourBars}
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
                                    return typeof postsCount === "number"
                                      ? `${label}h • ${formatPostsCount(postsCount)}`
                                      : `${label}h`;
                                  }}
                                  formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Respostas por post"]}
                                />
                                <Bar
                                  dataKey="average"
                                  name="Respostas por post"
                                  fill="#0ea5e9"
                                  radius={[6, 6, 0, 0]}
                                  onClick={({ payload }) => {
                                    const hour = typeof payload?.hour === "number" ? payload.hour : null;
                                    if (hour !== null) {
                                      handleHourClick(hour, "Melhor horário para postar");
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
                    </section>
                    <section className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duração dos vídeos</p>
                            <h2 className="text-base font-semibold text-slate-900">Quantos vídeos você tem em cada faixa de tempo</h2>
                            {durationSummary.totalVideoPosts > 0 ? (
                              <p className="text-xs text-slate-500">
                                Já temos duração em {(durationSummary.durationCoverageRate * 100).toFixed(0)}% dos vídeos (
                                {numberFormatter.format(durationSummary.totalPostsWithDuration)}/
                                {numberFormatter.format(durationSummary.totalVideoPosts)}).
                              </p>
                            ) : null}
                          </div>
                          <Clock3 className="h-5 w-5 text-cyan-500" />
                        </header>
                        <div className="mt-4 h-64">
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
                              <BarChart data={durationBuckets} margin={{ top: 20, right: 8, left: -6, bottom: 0 }} style={{ cursor: "pointer" }}>
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
                                    const postsCount = payload?.[0]?.payload?.postsCount ?? 0;
                                    return `${label} • ${formatPostsCount(postsCount)}`;
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
                                    if (bucketKey) handleDurationBucketClick(bucketKey, "Vídeos por faixa de duração");
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
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duração x resultado</p>
                            <h2 className="text-base font-semibold text-slate-900">Qual duração traz mais resposta</h2>
                            {bestDurationBucket ? (
                              <p className="text-xs text-emerald-700">
                                Faixa que mais respondeu: {bestDurationBucket.label} ({numberFormatter.format(Math.round(bestDurationBucket.averageInteractions))} respostas por post).
                              </p>
                            ) : null}
                            {lowSampleDurationBuckets > 0 ? (
                              <p className="text-xs text-amber-700">
                                {lowSampleDurationBuckets} faixa(s) ainda têm poucos vídeos (menos de 5).
                              </p>
                            ) : null}
                          </div>
                          <LineChartIcon className="h-5 w-5 text-indigo-500" />
                        </header>
                        <div className="mt-4 h-64">
                          {loadingDuration ? (
                            <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
                          ) : durationSummary.totalVideoPosts === 0 ? (
                            <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                          ) : durationSummary.totalPostsWithDuration === 0 ? (
                            <p className="text-sm text-slate-500">Sem duração suficiente para comparar faixas.</p>
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
                                  handleDurationBucketClick(bucket.key, "Resposta por faixa de duração");
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
                                    return `${label} • ${formatPostsCount(postsCount)}`;
                                  }}
                                  formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Respostas por post"]}
                                />
                                <Bar
                                  dataKey="averageInteractions"
                                  name="Respostas por post"
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
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Formato e Estilo</p>
                            <h2 className="text-base font-semibold text-slate-900">Resposta por formato de post</h2>
                            <p className={`text-xs ${deltaToneClassMap[formatExecutiveSummary.tone]}`}>{formatExecutiveSummary.text}</p>
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
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis hide />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name="Respostas" fill="#f97316" radius={[6, 6, 0, 0]} onClick={({ payload }) => { const val = payload?.name ? String(payload.name) : null; if (val) handleCategoryClick("format", val, "Resposta por formato"); }}>
                                  <LabelList dataKey="value" position="top" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                    </section>
                  </div>
                )}

                {activeTab === "audience" && (
                  <div className="space-y-4">
                    <section className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pessoas alcançadas x respostas</p>
                            <h2 className="text-base font-semibold text-slate-900">Evolução por semana</h2>
                            <p className={`text-xs ${deltaToneClassMap[interactionsDeltaSummary.tone]}`}>{interactionsDeltaSummary.text}</p>
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
                                <Line yAxisId="reach" type="monotone" dataKey="reach" name="Pessoas alcançadas (média)" stroke="#2563eb" strokeWidth={3} dot={false} />
                                <Line yAxisId="interactions" type="monotone" dataKey="interactions" name="Respostas por post" stroke="#7c3aed" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </article>
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Consistência</p>
                            <h2 className="text-base font-semibold text-slate-900">Força de resposta do seu conteúdo</h2>
                            <p className={`text-xs ${deltaToneClassMap[weeklyRateExecutiveSummary.tone]}`}>{weeklyRateExecutiveSummary.text}</p>
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
                    <section className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Salvamentos</p>
                            <h2 className="text-base font-semibold text-slate-900">Média de salvamentos por semana</h2>
                            <p className={`text-xs ${deltaToneClassMap[savesDeltaSummary.tone]}`}>{savesDeltaSummary.text}</p>
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
                            <p className={`text-xs ${deltaToneClassMap[commentsDeltaSummary.tone]}`}>{commentsDeltaSummary.text}</p>
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
                    <section className="grid gap-4 md:grid-cols-2">
                      <article className={cardBase}>
                        <header className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Salvos e Compartilhamentos</p>
                            <h2 className="text-base font-semibold text-slate-900">Compartilhamentos por pessoas alcançadas</h2>
                            <p className={`text-xs ${deltaToneClassMap[deepEngagementExecutiveSummary.tone]}`}>{deepEngagementExecutiveSummary.text}</p>
                          </div>
                          <Sparkles className="h-5 w-5 text-amber-500" />
                        </header>
                        <div className="mt-4 h-64">
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
                    <section className={cardBase}>
                      <header className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Descoberta</p>
                          <h3 className="text-base font-semibold text-slate-900">Posts que mais puxaram não seguidores</h3>
                          <p className={`text-xs ${deltaToneClassMap[topDiscoveryExecutiveSummary.tone]}`}>{topDiscoveryExecutiveSummary.text}</p>
                        </div>
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                      </header>
                      {loadingPosts ? (
                        <p className="mt-3 text-sm text-slate-500">Carregando lista...</p>
                      ) : (
                        <TopDiscoveryTable posts={topDiscovery} isLoading={loadingPosts} />
                      )}
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
        title="Análise Estratégica"
      >
        {selectedRecommendation ? (
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto pb-24">
              {/* Cabeçalho Premium */}
              <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-950 p-5 shadow-lg">
                <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl"></div>

                <div className="relative">
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 backdrop-blur-sm">
                    <Sparkles className="h-3 w-3" />
                    {RECOMMENDATION_TITLE_OVERRIDES[selectedRecommendation.id] || selectedRecommendation.title}
                  </div>
                  <h3 className="text-lg font-medium leading-snug text-white">
                    {selectedRecommendation.action}
                  </h3>
                </div>
              </section>

              {/* Dashboard Racional da IA */}
              <section className="grid gap-3 sm:grid-cols-2">
                <article className="flex max-w-full flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Potencial Estimado</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 break-words">{formatExpectedResult(selectedRecommendation.impactEstimate)}</p>
                </article>

                <article className="flex max-w-full flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4 text-indigo-500" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Volume de Dados</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 break-words">{formatSampleBaseText(selectedRecommendationView?.sampleSize)}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    Sinal {confidenceLabel[selectedRecommendationView?.confidenceAdjusted || selectedRecommendation.confidence]?.toLowerCase()}
                  </p>
                </article>
              </section>

              {selectedRecommendationView?.hasLowSampleGuardrail ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs font-medium leading-relaxed text-amber-800">
                      {formatGuardrailText(selectedRecommendationView.guardrailReason)}
                    </p>
                  </div>
                </section>
              ) : null}

              {/* Racional de Decisão (Evidence List) */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-400" />
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Racional da Decisão</h4>
                </div>
                <ul className="space-y-4">
                  {selectedRecommendation.evidence.map((item, index) => (
                    <li key={`${selectedRecommendation.id}-${index}`} className="flex items-start gap-3">
                      <div className="mt-0.5 flex shrink-0 justify-center">
                        <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700">{simplifyEvidenceText(item)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Sticky Footer */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="mx-auto max-w-lg space-y-3">
                <p className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Decisão</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedRecommendationFeedbackLoading}
                    onClick={() => submitRecommendationFeedback(selectedRecommendation, "applied")}
                    className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${selectedRecommendationView?.feedbackStatus === "applied"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      } ${selectedRecommendationFeedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className="mr-2 text-lg leading-none">{selectedRecommendationView?.feedbackStatus === "applied" ? "✅" : "👍"}</span>
                    Vou testar
                  </button>
                  <button
                    type="button"
                    disabled={selectedRecommendationFeedbackLoading}
                    onClick={() => submitRecommendationFeedback(selectedRecommendation, "not_applied")}
                    className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${selectedRecommendationView?.feedbackStatus === "not_applied"
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      } ${selectedRecommendationFeedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className="mr-2 text-lg leading-none">{selectedRecommendationView?.feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
                    Descartar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleGoToPlanner("recommendation_drawer")}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
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
