import { getNestedValue } from "./dataAccessHelpers";

export const LEAD_INTENT_PROXY_FIELD = "proxy.lead_intent" as const;

export type SupportedPerformanceMetricField =
  | "stats.total_interactions"
  | "stats.reach"
  | "stats.views"
  | "stats.likes"
  | "stats.comments"
  | "stats.shares"
  | "stats.profile_visits"
  | typeof LEAD_INTENT_PROXY_FIELD;

type MetricMeta = {
  label: string;
  shortLabel: string;
  tooltipLabel: string;
  unitLabel: string;
  isProxy: boolean;
  description: string | null;
};

const METRIC_META: Record<SupportedPerformanceMetricField, MetricMeta> = {
  "stats.total_interactions": {
    label: "Interações por post",
    shortLabel: "Engajamento",
    tooltipLabel: "Interações por post",
    unitLabel: "Interações",
    isProxy: false,
    description: null,
  },
  "stats.reach": {
    label: "Alcance por post",
    shortLabel: "Alcance",
    tooltipLabel: "Pessoas alcançadas por post",
    unitLabel: "Pessoas alcançadas",
    isProxy: false,
    description: null,
  },
  "stats.views": {
    label: "Views por post",
    shortLabel: "Views",
    tooltipLabel: "Views por post",
    unitLabel: "Views",
    isProxy: false,
    description: null,
  },
  "stats.likes": {
    label: "Curtidas por post",
    shortLabel: "Curtidas",
    tooltipLabel: "Curtidas por post",
    unitLabel: "Curtidas",
    isProxy: false,
    description: null,
  },
  "stats.comments": {
    label: "Comentários por post",
    shortLabel: "Comentários",
    tooltipLabel: "Comentários por post",
    unitLabel: "Comentários",
    isProxy: false,
    description: null,
  },
  "stats.shares": {
    label: "Compartilhamentos por post",
    shortLabel: "Compartilhamentos",
    tooltipLabel: "Compartilhamentos por post",
    unitLabel: "Compartilhamentos",
    isProxy: false,
    description: null,
  },
  "stats.profile_visits": {
    label: "Visitas ao perfil por post",
    shortLabel: "Visitas ao perfil",
    tooltipLabel: "Visitas ao perfil por post",
    unitLabel: "Visitas ao perfil",
    isProxy: false,
    description: null,
  },
  [LEAD_INTENT_PROXY_FIELD]: {
    label: "Intenção de lead por 1 mil alcançadas",
    shortLabel: "Intenção de lead",
    tooltipLabel: "Intenção de lead por 1 mil alcançadas",
    unitLabel: "Índice de intenção",
    isProxy: true,
    description:
      "Proxy baseado em visitas ao perfil, follows, compartilhamentos, salvamentos e comentários, normalizado pelo alcance quando disponível.",
  },
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getStatNumber(post: any, key: string): number {
  const value = toNumber(post?.stats?.[key]);
  return value === null ? 0 : value;
}

export function isProxyMetricField(metricField: string): boolean {
  return metricField === LEAD_INTENT_PROXY_FIELD;
}

export function getMetricMeta(metricField: string): MetricMeta {
  return (
    METRIC_META[metricField as SupportedPerformanceMetricField] || {
      label: "Métrica por post",
      shortLabel: "Métrica",
      tooltipLabel: "Métrica por post",
      unitLabel: "Métrica",
      isProxy: false,
      description: null,
    }
  );
}

export function resolvePerformanceMetricValue(
  post: any,
  metricField: string
): number | null {
  if (!post) return null;

  if (metricField === LEAD_INTENT_PROXY_FIELD) {
    const profileVisits = getStatNumber(post, "profile_visits");
    const follows = getStatNumber(post, "follows");
    const shares = getStatNumber(post, "shares");
    const saves = getStatNumber(post, "saved") || getStatNumber(post, "saves");
    const comments = getStatNumber(post, "comments");
    const reach = getStatNumber(post, "reach");

    const rawScore =
      profileVisits * 3 +
      follows * 8 +
      shares * 2 +
      saves * 1.5 +
      comments * 0.5;

    if (rawScore <= 0) return 0;
    if (reach > 0) return Number(((rawScore / reach) * 1000).toFixed(4));
    return Number(rawScore.toFixed(4));
  }

  const directValue = getNestedValue(post, metricField);
  const parsed = toNumber(directValue);
  return parsed === null ? null : parsed;
}
