'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ICreatorMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';
import SkeletonBlock from './SkeletonBlock';

interface CreatorRankingCardProps {
  title: string;
  apiEndpoint: string;
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
  metricLabel?: string;
  limit?: number;
}

const CreatorRankingCard: React.FC<CreatorRankingCardProps> = ({
  title,
  apiEndpoint,
  dateRangeFilter,
  metricLabel = '',
  limit = 5,
}) => {
  const [rankingData, setRankingData] = useState<ICreatorMetricRankItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dateRangeFilter?.startDate || !dateRangeFilter?.endDate) {
      setRankingData(null); // Clear data if date range is incomplete
      // Optionally set a specific message or do nothing if parent handles this state
      return;
    }

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      startDate: dateRangeFilter.startDate,
      endDate: dateRangeFilter.endDate,
      limit: String(limit),
    });

    try {
      const response = await fetch(`${apiEndpoint}?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch ${title}`);
      }
      const data: ICreatorMetricRankItem[] = await response.json();
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
    // Format to 2 decimal places for non-integers, unless it's a very small number that would become 0.00
    if (value !== 0 && Math.abs(value) < 0.01 && Math.abs(value) > 0.000001) { // Avoid scientific notation for very small non-zero
        return value.toFixed(Math.max(2, -Math.floor(Math.log10(Math.abs(value))) + 1)).replace('.', ',');
    }
    return parseFloat(value.toFixed(2)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  };

  const renderSkeleton = () => (
    <ul className="space-y-2.5 animate-pulse">
      {Array.from({ length: limit }).map((_, i) => (
        <li key={i} className="flex items-center space-x-3">
          <SkeletonBlock variant="circle" width="w-8" height="h-8" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock width="w-3/4" height="h-3" />
            <SkeletonBlock width="w-1/2" height="h-2.5" />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <h4 className="text-md font-semibold text-gray-700 dark:text-white mb-3 truncate" title={title}>
        {title}
      </h4>
      {isLoading && renderSkeleton()}
      {!isLoading && error && (
        <div className="text-center py-4 flex-grow flex flex-col justify-center items-center">
          <p className="text-xs text-red-500 dark:text-red-400 px-2">Erro: {error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-700 dark:text-indigo-100 rounded hover:bg-indigo-200 dark:hover:bg-indigo-600"
          >
            Tentar Novamente
          </button>
        </div>
      )}
      {!isLoading && !error && rankingData && rankingData.length > 0 && (
        <ol className="space-y-2 text-sm flex-grow">
          {rankingData.map((item, index) => (
            <li key={item.creatorId.toString()} className="flex items-center space-x-2.5 py-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-5 text-center">{index + 1}.</span>
              {item.profilePictureUrl ? (
                <Image
                  src={item.profilePictureUrl}
                  alt={item.creatorName || 'Creator'}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-300">
                  {item.creatorName?.substring(0, 1).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 truncate">
                <p className="text-gray-800 dark:text-gray-100 font-medium truncate" title={item.creatorName}>
                  {item.creatorName || 'Desconhecido'}
                </p>
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold whitespace-nowrap">
                {formatMetricValue(item.metricValue)}
                {metricLabel && ` ${metricLabel}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!isLoading && !error && (!rankingData || rankingData.length === 0) && (
         <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-500 flex-grow flex flex-col justify-center items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Nenhum dado disponível para o período selecionado.
        </div>
      )}
    </div>
  );
};

export default CreatorRankingCard;
