'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { IProposalMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';
import SkeletonBlock from './SkeletonBlock';

interface ProposalRankingCardProps {
  title: string;
  apiEndpoint: string;
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
  /** Label describing the formatted date range for display */
  dateRangeLabel?: string;
  metricLabel?: string;
  limit?: number;
}

const ProposalRankingCard: React.FC<ProposalRankingCardProps> = ({
  title,
  apiEndpoint,
  dateRangeFilter,
  dateRangeLabel,
  metricLabel = '',
  limit = 5,
}) => {
  const [rankingData, setRankingData] = useState<IProposalMetricRankItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dateRangeFilter?.startDate || !dateRangeFilter?.endDate) {
      setRankingData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: String(limit) });

    if (dateRangeFilter.startDate) {
      const localStart = new Date(dateRangeFilter.startDate);
      const utcStart = new Date(Date.UTC(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), 0, 0, 0, 0));
      params.append('startDate', utcStart.toISOString());
    }
    if (dateRangeFilter.endDate) {
      const localEnd = new Date(dateRangeFilter.endDate);
      const utcEnd = new Date(Date.UTC(localEnd.getFullYear(), localEnd.getMonth(), localEnd.getDate(), 23, 59, 59, 999));
      params.append('endDate', utcEnd.toISOString());
    }

    try {
      const response = await fetch(`${apiEndpoint}?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch ${title}`);
      }
      const data: IProposalMetricRankItem[] = await response.json();
      setRankingData(data);
    } catch (e: any) {
      setError(e.message);
      setRankingData(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, dateRangeFilter, limit, title]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatMetricValue = (value: number): string => {
    if (Number.isInteger(value)) {
      return value.toLocaleString('pt-BR');
    }
    return parseFloat(value.toFixed(2)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderSkeleton = () => (
    <ul className="space-y-2.5 animate-pulse">
      {Array.from({ length: limit }).map((_, i) => (
        <li key={i} className="flex items-center space-x-3">
          <SkeletonBlock width="w-3/4" height="h-3" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 h-full flex flex-col">
      <h4 className="text-md font-semibold text-gray-700 truncate" title={title}>{title}</h4>
      {dateRangeLabel && (
        <p className="text-xs text-gray-500 mb-3">{dateRangeLabel}</p>
      )}
      {isLoading && renderSkeleton()}
      {!isLoading && error && (
        <div className="text-center py-4 flex-grow flex flex-col justify-center items-center">
          <p className="text-xs text-red-500 px-2">Erro: {error}</p>
          <button onClick={fetchData} className="mt-2 px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
            Tentar Novamente
          </button>
        </div>
      )}
      {!isLoading && !error && rankingData && rankingData.length > 0 && (
        <ol className="space-y-2 text-sm flex-grow">
          {rankingData.map((item, index) => (
            <li key={item.proposal + index} className="flex items-center justify-between py-1">
              <span className="text-xs font-medium text-gray-500 w-5 text-center">{index + 1}.</span>
              <span className="flex-1 truncate text-gray-800" title={item.proposal}>{item.proposal}</span>
              <span className="text-xs text-indigo-600 font-semibold whitespace-nowrap">
                {formatMetricValue(item.metricValue)}{metricLabel && ` ${metricLabel}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!isLoading && !error && (!rankingData || rankingData.length === 0) && (
        <div className="text-center py-4 text-xs text-gray-400 flex-grow flex flex-col justify-center items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          Nenhum dado disponível para o período selecionado.
        </div>
      )}
    </div>
  );
};

export default ProposalRankingCard;
