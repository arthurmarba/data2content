"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import { TrendingUp, TrendingDown, Sparkles, CalendarDays } from "lucide-react";
import HighlightCard from "./HighlightCard";
import UserFormatPerformanceRankingTable from "./UserFormatPerformanceRankingTable";

interface PerformanceHighlightItem {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
  platformAverage?: number;
  platformAverageFormatted?: string;
  changePercentage?: number;
}

interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlightItem | null;
  lowPerformingFormat: PerformanceHighlightItem | null;
  topPerformingContext: PerformanceHighlightItem | null;
  topPerformingProposal: PerformanceHighlightItem | null;
  topPerformingTone: PerformanceHighlightItem | null;
  topPerformingReference: PerformanceHighlightItem | null;
  bestDay?: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
];

interface UserPerformanceHighlightsProps {
  userId: string | null;
  sectionTitle?: string;
}

// Ícone de Informação (mantido como estava)
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || "h-4 w-4"}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const getPortugueseWeekdayName = (day: number): string => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[day - 1] || '';
};

const UserPerformanceHighlights: React.FC<UserPerformanceHighlightsProps> = ({
  userId,
  sectionTitle = "Destaques de Performance do Criador",
}) => {
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const defaultTimePeriod =
    TIME_PERIOD_OPTIONS[1]?.value ||
    TIME_PERIOD_OPTIONS[0]?.value ||
    "last_30_days";
  const [timePeriod, setTimePeriod] = useState<string>(
    globalTimePeriod || defaultTimePeriod,
  );

  useEffect(() => {
    setTimePeriod(globalTimePeriod);
  }, [globalTimePeriod]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/highlights/performance-summary?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`,
        );
      }
      const result: PerformanceSummaryResponse = await response.json();
      setSummary(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro desconhecido.",
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setSummary(null);
      setLoading(false);
    }
  }, [userId, fetchData]);

  if (!userId && !loading) {
    return null;
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">
          {sectionTitle}
        </h3>
        <div>
          <label
            htmlFor={`timePeriodUserHighlights-${userId || "default"}`}
            className="sr-only"
          >
            Período
          </label>
          <select
            id={`timePeriodUserHighlights-${userId || "default"}`}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            disabled={loading}
            className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
          >
            {TIME_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5">
          <p className="text-gray-500">Carregando destaques...</p>
        </div>
      )}
      {error && (
        <div className="text-center py-5">
          <p className="text-red-500">Erro: {error}</p>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
            <HighlightCard
              title="Melhor Formato"
              highlight={summary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500" />}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto Principal"
              highlight={summary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500" />}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Menor Performance (Formato)"
              highlight={summary.lowPerformingFormat}
              icon={<TrendingDown size={18} className="mr-2 text-red-500" />}
              bgColorClass="bg-red-50"
              textColorClass="text-red-600"
            />
            <HighlightCard
              title="Melhor Proposta"
              highlight={summary.topPerformingProposal}
              icon={<Sparkles size={18} className="mr-2 text-purple-500" />}
              bgColorClass="bg-purple-50"
              textColorClass="text-purple-600"
            />
            <HighlightCard
              title="Melhor Tom"
              highlight={summary.topPerformingTone}
              icon={<Sparkles size={18} className="mr-2 text-amber-500" />}
              bgColorClass="bg-amber-50"
              textColorClass="text-amber-600"
            />
            <HighlightCard
              title="Melhor Referência"
              highlight={summary.topPerformingReference}
              icon={<Sparkles size={18} className="mr-2 text-teal-500" />}
              bgColorClass="bg-teal-50"
              textColorClass="text-teal-600"
            />
            <HighlightCard
              title="Melhor Dia"
              highlight={summary.bestDay ? { name: `🗓️ ${getPortugueseWeekdayName(summary.bestDay.dayOfWeek)}`, metricName: 'Interações (média)', value: summary.bestDay.average, valueFormatted: summary.bestDay.average.toFixed(1) } : null}
              icon={<CalendarDays size={18} className="mr-2 text-indigo-500" />}
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
          <div className="mt-6">
            <UserFormatPerformanceRankingTable userId={userId} />
          </div>
        </>
      )}
      {!loading && !error && !summary && (
        <div className="text-center py-5">
          <p className="text-gray-500">
            Nenhum destaque de performance encontrado.
          </p>
        </div>
      )}
    </div>
  );
};

export default React.memo(UserPerformanceHighlights);
