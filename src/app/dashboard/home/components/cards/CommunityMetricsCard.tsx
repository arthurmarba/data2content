// src/app/dashboard/home/components/cards/CommunityMetricsCard.tsx
// Card "Big Numbers da Comunidade".

"use client";

import React from "react";
import {
  FaGlobeAmericas,
  FaChartLine,
  FaInfoCircle,
  FaUsers,
  FaRegCalendarCheck,
  FaEye,
} from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { CommunityMetricsCardData } from "../../types";

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
      title="📊 Atividade da Comunidade"
      description="Desempenho coletivo da base no período selecionado."
      icon={<FaGlobeAmericas />}
      loading={loading}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {segmentedControl}
          <span
            className="flex items-center gap-2 text-xs font-semibold text-slate-500"
            title="Mostramos os totais do período e a variação em relação ao período anterior."
          >
            {highlightPeriod ? <span>{highlightPeriod}</span> : null}
            <FaInfoCircle aria-hidden="true" />
          </span>
        </div>

        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span aria-hidden="true">📊</span>
          Desempenho coletivo da comunidade
        </p>

        {displayedMetrics.length ? (
          <ul className="space-y-3">
            {displayedMetrics.map((item, index) => {
              const deltaLabel = formatDelta(item.deltaPercent);
              const deltaPositive =
                typeof item.deltaPercent === "number" ? item.deltaPercent >= 0 : null;
              const deltaText =
                deltaLabel && deltaPositive != null
                  ? `${deltaPositive ? "▲" : "▼"} ${deltaLabel.replace("+", "")} vs período anterior`
                  : "Sem variação relevante.";
              const deltaClass =
                deltaPositive == null
                  ? "text-slate-400"
                  : deltaPositive
                  ? "text-emerald-600"
                  : "text-rose-500";
              const icons = [FaUsers, FaRegCalendarCheck, FaEye];
              const Icon = icons[index] ?? FaGlobeAmericas;

              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm shadow-slate-900/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className={`text-xs font-semibold ${deltaClass}`}>{deltaText}</p>
                    </div>
                  </div>
                  <p className="text-base font-semibold text-slate-900">{item.value}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Conecte seus dados ou aguarde novas medições para ver o panorama coletivo.
          </p>
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
