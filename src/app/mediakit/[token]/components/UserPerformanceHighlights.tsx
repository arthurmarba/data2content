"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useGlobalTimePeriod } from "@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext";
import HighlightCard, { PerformanceHighlightItem } from "@/app/admin/creator-dashboard/components/HighlightCard";
import { LightBulbIcon } from "@heroicons/react/24/outline";
import { TrendingUp, Sparkles, CalendarDays } from "lucide-react";
import { commaSeparatedIdsToLabels } from "@/app/lib/classification";

interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlightItem | null;
  lowPerformingFormat: PerformanceHighlightItem | null;
  topPerformingContext: PerformanceHighlightItem | null;
  topPerformingProposal: PerformanceHighlightItem | null;
  topPerformingTone: PerformanceHighlightItem | null;
  topPerformingReference: PerformanceHighlightItem | null;
  bestDay: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}

function formatBestDay(slot: PerformanceSummaryResponse["bestDay"]): PerformanceHighlightItem | null {
  if (!slot) return null;
  const days = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  const dayName = days[Math.max(1, Math.min(7, slot.dayOfWeek)) - 1] || "Dia";
  return {
    name: `🗓️ ${dayName}`,
    metricName: "Interações (média)",
    value: slot.average,
    valueFormatted: slot.average.toFixed(1),
  };
}

interface Props { userId: string; stacked?: boolean; showTitle?: boolean; }

const UserPerformanceHighlights: React.FC<Props> = ({ userId, stacked = false, showTitle = true }) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = `/api/v1/users/${userId}/highlights/performance-summary?timePeriod=${encodeURIComponent(timePeriod)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Erro ao carregar: ${res.status}`);
      const result: PerformanceSummaryResponse = await res.json();
      // traduz nomes (ids -> rótulos) quando aplicável
      if (result.topPerformingContext) {
        result.topPerformingContext.name = commaSeparatedIdsToLabels(result.topPerformingContext.name, 'context') || result.topPerformingContext.name;
      }
      if (result.topPerformingProposal) {
        result.topPerformingProposal.name = commaSeparatedIdsToLabels(result.topPerformingProposal.name, 'proposal') || result.topPerformingProposal.name;
      }
      if (result.topPerformingTone) {
        result.topPerformingTone.name = commaSeparatedIdsToLabels(result.topPerformingTone.name, 'tone') || result.topPerformingTone.name;
      }
      if (result.topPerformingReference) {
        result.topPerformingReference.name = commaSeparatedIdsToLabels(result.topPerformingReference.name, 'reference') || result.topPerformingReference.name;
      }
      setSummary(result);
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar destaques.');
      setSummary(null);
    } finally { setLoading(false); }
  }, [userId, timePeriod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      {showTitle && (
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp size={20} className="text-green-600" />
          <h3 className="text-lg font-semibold text-gray-800">Destaques de Performance</h3>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg shadow bg-gray-50 animate-pulse min-h-[100px]">
              <div className="h-3 w-2/3 bg-gray-200 rounded mb-3"></div>
              <div className="h-5 w-1/2 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 w-1/3 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="text-sm text-red-600 py-6">{error}</div>}

      {!loading && !error && summary && (
        <>
          <div className={stacked ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 md:grid-cols-3 gap-4"}>
            <HighlightCard
              title="Melhor Formato"
              highlight={summary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500"/>}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto com Melhor Desempenho"
              highlight={summary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500"/>}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Melhor Proposta"
              highlight={summary.topPerformingProposal}
              icon={<Sparkles size={18} className="mr-2 text-purple-500"/>}
              bgColorClass="bg-purple-50"
              textColorClass="text-purple-600"
            />
            <HighlightCard
              title="Melhor Tom"
              highlight={summary.topPerformingTone}
              icon={<Sparkles size={18} className="mr-2 text-amber-500"/>}
              bgColorClass="bg-amber-50"
              textColorClass="text-amber-600"
            />
            <HighlightCard
              title="Melhor Referência"
              highlight={summary.topPerformingReference}
              icon={<Sparkles size={18} className="mr-2 text-teal-500"/>}
              bgColorClass="bg-teal-50"
              textColorClass="text-teal-600"
            />
            <HighlightCard
              title="Melhor Dia"
              highlight={formatBestDay(summary.bestDay)}
              icon={<CalendarDays size={18} className="mr-2 text-indigo-500"/>}
              bgColorClass="bg-indigo-50"
              textColorClass="text-indigo-600"
            />
          </div>
          {summary.insightSummary && (
            <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200 flex items-start">
              <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
              {summary.insightSummary}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default UserPerformanceHighlights;
