// src/app/dashboard/home/components/cards/CommunityMetricsCard.tsx
// Card "Big Numbers da Comunidade".

"use client";

import React from "react";
import { FaGlobeAmericas, FaChartLine } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { CommunityMetricsCardData } from "../../types";

interface CommunityMetricsCardProps {
  data?: CommunityMetricsCardData | null;
  loading?: boolean;
  onViewInsights?: () => void;
  onChangePeriod?: (period: CommunityMetricsCardData["period"]) => void;
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

export default function CommunityMetricsCard({ data, loading, onViewInsights, onChangePeriod }: CommunityMetricsCardProps) {
  const period = data?.period ?? "30d";
  const metrics = data?.metrics ?? [];

  const footer = (
    <ActionButton label="Abrir insights da comunidade" icon={<FaChartLine />} variant="secondary" onClick={onViewInsights} />
  );

  return (
    <CardShell
      className="md:col-span-2 xl:col-span-1"
      title="Pulso da Comunidade"
      description="Compare seu ritmo com a média dos criadores conectados."
      icon={<FaGlobeAmericas />}
      loading={loading}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = option.value === period;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChangePeriod?.(option.value)}
                disabled={isActive || loading}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "cursor-default border-brand-purple bg-brand-purple text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-purple/40 hover:bg-brand-purple/5 hover:text-brand-purple"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {metrics.map((item) => {
            const deltaLabel = formatDelta(item.deltaPercent);
            const deltaPositive = typeof item.deltaPercent === "number" ? item.deltaPercent >= 0 : undefined;
            return (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_0_#f2f4f7]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>{item.periodLabel}</span>
                  {deltaLabel ? (
                    <span
                      className={`font-semibold ${
                        deltaPositive ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {deltaLabel}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {metrics.length === 0 ? (
          <p className="text-sm text-slate-500">Conecte mais criadores ou aguarde novas medições para ver o painel coletivo.</p>
        ) : null}
      </div>
    </CardShell>
  );
}
