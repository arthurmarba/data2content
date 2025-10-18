// src/app/dashboard/home/components/cards/CommunityMetricsCard.tsx
// Card "Big Numbers da Comunidade".

"use client";

import React from "react";
import { FaGlobeAmericas, FaChartLine, FaInfoCircle } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { CommunityMetricsCardData } from "../../types";
import QuickStat from "../QuickStat";

interface CommunityMetricsCardProps {
  data?: CommunityMetricsCardData | null;
  loading?: boolean;
  onViewInsights?: () => void;
  onChangePeriod?: (period: CommunityMetricsCardData["period"]) => void;
  className?: string;
}

const PERIOD_OPTIONS: Array<{ label: string; value: CommunityMetricsCardData["period"] }> = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
];

function formatDelta(delta?: number | null) {
  if (typeof delta !== "number") return null;
  if (Math.abs(delta) < 0.5) return "≈";
  const rounded = Math.round(delta);
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded}%`;
}

export default function CommunityMetricsCard({
  data,
  loading,
  onViewInsights,
  onChangePeriod,
  className,
}: CommunityMetricsCardProps) {
  const period = data?.period ?? "30d";
  const metrics = data?.metrics ?? [];
  const highlightPeriod = metrics[0]?.periodLabel ?? null;
  const displayedMetrics = metrics.slice(0, 3);
  const hasMoreMetrics = metrics.length > displayedMetrics.length;

  const footer = (
    <ActionButton
      label="Ver insights"
      icon={<FaChartLine />}
      variant="secondary"
      onClick={onViewInsights}
      className="px-4 py-2 text-sm"
    />
  );

  const resolveLabel = React.useCallback((label: string) => {
    if (/^ER/i.test(label)) return "Engajamento (30 dias)";
    return label;
  }, []);

  const resolveTooltip = React.useCallback((label: string) => {
    if (label.startsWith("Engajamento")) {
      return "% de pessoas que interagiram (curtidas, comentários, envios).";
    }
    return undefined;
  }, []);

  const segmentedControl = (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
      {PERIOD_OPTIONS.map((option) => {
        const isActive = option.value === period;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChangePeriod?.(option.value)}
            disabled={isActive || loading}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1 ${
              isActive
                ? "bg-brand-purple text-white"
                : "text-slate-500 hover:bg-brand-purple/10 hover:text-brand-purple"
            } ${loading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <CardShell
      className={className}
      title="Atividade da Comunidade"
      description="Veja como você está em relação aos outros criadores."
      icon={<FaGlobeAmericas />}
      loading={loading}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {segmentedControl}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            {highlightPeriod ? <span>Período: {highlightPeriod}</span> : null}
            <span
              className="inline-flex items-center gap-1"
              title="Mostramos os totais do período e a variação em relação ao período anterior."
            >
              <FaInfoCircle aria-hidden="true" />
            </span>
          </div>
        </div>

        {displayedMetrics.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {displayedMetrics.map((item) => {
              const deltaLabel = formatDelta(item.deltaPercent);
              const deltaPositive = typeof item.deltaPercent === "number" ? item.deltaPercent >= 0 : null;
              const tone: "default" | "alert" | "success" =
                deltaPositive == null ? "default" : deltaPositive ? "success" : "alert";
              const label = resolveLabel(item.label);
              const tooltip = resolveTooltip(label);
              const helper =
                deltaLabel && deltaPositive != null
                  ? `${deltaPositive ? "▲" : "▼"} ${deltaLabel.replace("+", "")} vs período anterior`
                  : "Sem variação relevante.";

              return (
                <QuickStat
                  key={item.id}
                  label={
                    tooltip ? (
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <FaInfoCircle className="text-xs text-slate-400" title={tooltip} aria-label={tooltip} />
                      </span>
                    ) : (
                      label
                    )
                  }
                  value={item.value}
                  helper={helper}
                  tone={tone}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Conecte seus dados ou aguarde novas medições para ver o panorama coletivo.</p>
        )}

        {hasMoreMetrics ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mais métricas disponíveis em “Ver insights”.
          </p>
        ) : null}
      </div>
    </CardShell>
  );
}
