"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Sparkles, AlertCircle, Info } from 'lucide-react'; // Ícones

interface PerformanceHighlightItem {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
}

interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlightItem | null;
  lowPerformingFormat: PerformanceHighlightItem | null;
  topPerformingContext: PerformanceHighlightItem | null;
  insightSummary: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  // Adicionar "all_time" se fizer sentido para highlights de performance
];

interface UserPerformanceHighlightsProps {
  userId: string | null;
  initialTimePeriod?: string;
  sectionTitle?: string;
}

const HighlightCard: React.FC<{
  title: string;
  highlight: PerformanceHighlightItem | null | undefined;
  icon?: React.ReactNode;
  bgColorClass?: string;
  textColorClass?: string;
}> = ({ title, highlight, icon, bgColorClass = "bg-gray-50", textColorClass="text-indigo-600" }) => {
  if (!highlight) {
    return (
      <div className={`p-4 rounded-lg shadow ${bgColorClass} min-h-[100px]`}>
        <div className="flex items-center text-gray-500">
          {icon || <Info size={18} className="mr-2"/>}
          <h4 className="text-sm font-medium">{title}</h4>
        </div>
        <p className="text-sm text-gray-400 mt-2">N/A</p>
      </div>
    );
  }
  return (
    <div className={`p-4 rounded-lg shadow ${bgColorClass} min-h-[100px]`}>
      <div className="flex items-center text-gray-600">
        {icon || <Info size={18} className="mr-2"/>}
        <h4 className="text-sm font-medium ">{title}</h4>
      </div>
      <p className={`text-xl font-bold ${textColorClass} mt-1 truncate`} title={highlight.name}>
        {highlight.name}
      </p>
      <p className="text-xs text-gray-500">
        {highlight.valueFormatted} {highlight.metricName}
        {highlight.postsCount && <span className="ml-1">({highlight.postsCount} posts)</span>}
      </p>
    </div>
  );
};


const UserPerformanceHighlights: React.FC<UserPerformanceHighlightsProps> = ({
  userId,
  initialTimePeriod = TIME_PERIOD_OPTIONS[1].value, // Default last_90_days
  sectionTitle = "Destaques de Performance do Criador"
}) => {
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<string>(initialTimePeriod);

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
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PerformanceSummaryResponse = await response.json();
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
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

  if (!userId && !loading) { // Não renderiza nada se não houver ID e não estiver carregando (para UserDetailView)
      return null;
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">{sectionTitle}</h3>
        <div>
          <label htmlFor={`timePeriodUserHighlights-${userId}`} className="sr-only">Período</label>
          <select
            id={`timePeriodUserHighlights-${userId}`}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
            disabled={loading}
          >
            {TIME_PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-center py-5"><p className="text-gray-500">Carregando destaques...</p></div>}
      {error && <div className="text-center py-5"><p className="text-red-500">Erro: {error}</p></div>}

      {!loading && !error && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HighlightCard
              title="Melhor Formato"
              highlight={summary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500"/>}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto Principal"
              highlight={summary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500"/>}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Menor Performance (Formato)"
              highlight={summary.lowPerformingFormat}
              icon={<TrendingDown size={18} className="mr-2 text-red-500"/>}
              bgColorClass="bg-red-50"
              textColorClass="text-red-600"
            />
          </div>
          {summary.insightSummary && (
            <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200">{summary.insightSummary}</p>
          )}
        </>
      )}
       {!loading && !error && !summary && (
         <div className="text-center py-5"><p className="text-gray-500">Nenhum destaque de performance encontrado.</p></div>
      )}
    </div>
  );
};

export default UserPerformanceHighlights;
```
