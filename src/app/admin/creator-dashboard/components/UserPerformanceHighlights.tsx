"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import { TrendingUp, TrendingDown, Sparkles, CalendarDays } from "lucide-react";
import HighlightCard from "./HighlightCard";
import UserFormatPerformanceRankingTable from "./UserFormatPerformanceRankingTable";
import { commaSeparatedIdsToLabels } from '../../../lib/classification';

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


interface UserPerformanceHighlightsProps {
  userId: string | null;
  sectionTitle?: string;
  summaryOverride?: PerformanceSummaryResponse | null;
  formatRankingOverride?: Array<{ name: string; value: number; postsCount: number }> | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
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
  summaryOverride,
  formatRankingOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { timePeriod } = useGlobalTimePeriod();
  const hasOverride = Boolean(disableFetch)
    || typeof summaryOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined';
  const hasFormatRankingOverride = typeof formatRankingOverride !== 'undefined';

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
      if (result.topPerformingFormat) {
        result.topPerformingFormat.name =
          commaSeparatedIdsToLabels(result.topPerformingFormat.name, 'format') ||
          result.topPerformingFormat.name;
      }
      if (result.lowPerformingFormat) {
        result.lowPerformingFormat.name =
          commaSeparatedIdsToLabels(result.lowPerformingFormat.name, 'format') ||
          result.lowPerformingFormat.name;
      }
      if (result.topPerformingContext) {
        result.topPerformingContext.name =
          commaSeparatedIdsToLabels(result.topPerformingContext.name, 'context') ||
          result.topPerformingContext.name;
      }
      if (result.topPerformingProposal) {
        result.topPerformingProposal.name =
          commaSeparatedIdsToLabels(result.topPerformingProposal.name, 'proposal') ||
          result.topPerformingProposal.name;
      }
      if (result.topPerformingTone) {
        result.topPerformingTone.name =
          commaSeparatedIdsToLabels(result.topPerformingTone.name, 'tone') ||
          result.topPerformingTone.name;
      }
      if (result.topPerformingReference) {
        result.topPerformingReference.name =
          commaSeparatedIdsToLabels(result.topPerformingReference.name, 'reference') ||
          result.topPerformingReference.name;
      }
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
    if (!userId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    if (hasOverride || disableFetch) {
      return;
    }
    fetchData();
  }, [userId, fetchData, hasOverride, disableFetch]);

  const resolvedError = hasOverride ? (errorOverride ?? null) : error;
  const resolvedLoading = hasOverride ? (loadingOverride ?? false) : loading;
  const resolvedSummary = hasOverride ? (summaryOverride ?? null) : summary;
  const normalizedSummary = useMemo(() => {
    if (!resolvedSummary) return null;
    const normalize = (
      item: PerformanceHighlightItem | null,
      kind: 'format' | 'context' | 'proposal' | 'tone' | 'reference',
    ) => {
      if (!item) return null;
      return {
        ...item,
        name: commaSeparatedIdsToLabels(item.name, kind) || item.name,
      };
    };
    return {
      ...resolvedSummary,
      topPerformingFormat: normalize(resolvedSummary.topPerformingFormat, 'format'),
      lowPerformingFormat: normalize(resolvedSummary.lowPerformingFormat, 'format'),
      topPerformingContext: normalize(resolvedSummary.topPerformingContext, 'context'),
      topPerformingProposal: normalize(resolvedSummary.topPerformingProposal, 'proposal'),
      topPerformingTone: normalize(resolvedSummary.topPerformingTone, 'tone'),
      topPerformingReference: normalize(resolvedSummary.topPerformingReference, 'reference'),
    };
  }, [resolvedSummary]);
  const displaySummary = resolvedError ? null : normalizedSummary;

  if (!userId && !resolvedLoading) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm mt-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          {sectionTitle}
        </h3>
        {/* período controlado globalmente */}
      </div>

      {resolvedLoading && (
        <div className="text-center py-5">
          <p className="text-gray-500">Carregando destaques...</p>
        </div>
      )}
      {resolvedError && (
        <div className="text-center py-5">
          <p className="text-red-500">Erro: {resolvedError}</p>
        </div>
      )}

      {!resolvedLoading && !resolvedError && displaySummary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
            <HighlightCard
              title="Melhor Formato"
              highlight={displaySummary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500" />}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto Principal"
              highlight={displaySummary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500" />}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Menor Performance (Formato)"
              highlight={displaySummary.lowPerformingFormat}
              icon={<TrendingDown size={18} className="mr-2 text-red-500" />}
              bgColorClass="bg-red-50"
              textColorClass="text-red-600"
            />
            <HighlightCard
              title="Melhor Proposta"
              highlight={displaySummary.topPerformingProposal}
              icon={<Sparkles size={18} className="mr-2 text-purple-500" />}
              bgColorClass="bg-purple-50"
              textColorClass="text-purple-600"
            />
            <HighlightCard
              title="Melhor Tom"
              highlight={displaySummary.topPerformingTone}
              icon={<Sparkles size={18} className="mr-2 text-amber-500" />}
              bgColorClass="bg-amber-50"
              textColorClass="text-amber-600"
            />
            <HighlightCard
              title="Melhor Referência"
              highlight={displaySummary.topPerformingReference}
              icon={<Sparkles size={18} className="mr-2 text-teal-500" />}
              bgColorClass="bg-teal-50"
              textColorClass="text-teal-600"
            />
            <HighlightCard
              title="Melhor Dia"
              highlight={displaySummary.bestDay ? { name: `🗓️ ${getPortugueseWeekdayName(displaySummary.bestDay.dayOfWeek)}`, metricName: 'Interações (média)', value: displaySummary.bestDay.average, valueFormatted: displaySummary.bestDay.average.toFixed(1) } : null}
              icon={<CalendarDays size={18} className="mr-2 text-indigo-500" />}
              bgColorClass="bg-indigo-50"
              textColorClass="text-indigo-600"
            />
          </div>
          {displaySummary.insightSummary && (
            <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200 flex items-start">
              <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
              {displaySummary.insightSummary}
            </p>
          )}
          <div className="mt-6">
            <UserFormatPerformanceRankingTable
              userId={userId}
              dataOverride={formatRankingOverride ?? null}
              loadingOverride={resolvedLoading}
              errorOverride={resolvedError}
              disableFetch={disableFetch || hasFormatRankingOverride}
            />
          </div>
        </>
      )}
      {!resolvedLoading && !resolvedError && !displaySummary && (
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
