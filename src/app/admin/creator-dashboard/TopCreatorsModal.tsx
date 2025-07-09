"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { XMarkIcon } from "@heroicons/react/24/solid";
import SkeletonBlock from "./SkeletonBlock";
import { TopCreatorMetric } from '@/app/lib/dataService/marketAnalysisService';
import { TimePeriod } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

interface TopCreatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  context?: string;
  metric?: TopCreatorMetric;
  timePeriod: TimePeriod;
  metricLabel?: string;
  compositeRanking?: boolean;
  limit?: number;
}

interface TopCreatorItem {
  creatorId: string;
  creatorName: string;
  profilePictureUrl: string | null;
  metricValue: number;
  score?: number;
}

const TopCreatorsModal: React.FC<TopCreatorsModalProps> = ({
  isOpen,
  onClose,
  title,
  context,
  metric = 'total_interactions',
  timePeriod,
  metricLabel = '',
  compositeRanking = false,
  limit = 20,
}) => {
  const [rankingData, setRankingData] = useState<TopCreatorItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const days = timePeriodToDays(timePeriod);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      days: String(days),
      limit: String(limit),
      offset: String(page * limit),
    });
    if (compositeRanking) {
      params.append('composite', 'true');
    } else {
      params.append('metric', metric);
    }
    if (context) params.append('context', context);

    try {
      const response = await fetch(`/api/admin/dashboard/rankings/top-creators?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch ${title}`);
      }
      const data: TopCreatorItem[] = await response.json();
      setRankingData(data);
    } catch (e: any) {
      setError(e.message);
      setRankingData(null);
    } finally {
      setIsLoading(false);
    }
  }, [context, metric, days, limit, page, compositeRanking, title]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  useEffect(() => {
    setPage(0);
  }, [context, metric, timePeriod]);

  const formatMetricValue = (value: number): string => {
    if (compositeRanking) {
      return `${Math.round(value)}%`;
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString('pt-BR');
    }
    return parseFloat(value.toFixed(2)).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const renderSkeleton = () => (
    <ol className="space-y-2 animate-pulse">
      {Array.from({ length: limit }).map((_, i) => (
        <li key={i} className="flex items-center space-x-3">
          <SkeletonBlock variant="circle" width="w-8" height="h-8" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock width="w-3/4" height="h-3" />
            <SkeletonBlock width="w-1/2" height="h-2.5" />
          </div>
        </li>
      ))}
    </ol>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800 truncate" title={title}>
            {title}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-4 overflow-y-auto flex-grow">
          {isLoading && renderSkeleton()}
          {!isLoading && error && (
            <div className="text-center py-4 text-red-500 text-sm">Erro: {error}</div>
          )}
          {!isLoading && !error && rankingData && rankingData.length > 0 && (
            <ol className="space-y-2 text-sm">
              {rankingData.map((item, index) => (
                <li key={item.creatorId.toString()} className="flex items-center space-x-2.5 py-1">
                  <span className="text-xs font-medium text-gray-500 w-5 text-center">{index + 1}.</span>
                  {item.profilePictureUrl ? (
                    <Image
                      src={item.profilePictureUrl}
                      alt={item.creatorName || 'Creator'}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                      {item.creatorName?.substring(0, 1).toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 truncate">
                    <p className="text-gray-800 font-medium truncate" title={item.creatorName}>
                      {item.creatorName || 'Desconhecido'}
                    </p>
                  </div>
                  <span className="text-xs text-indigo-600 font-semibold whitespace-nowrap">
                    {formatMetricValue(compositeRanking ? (item.score ?? 0) : item.metricValue)}
                    {metricLabel && !compositeRanking && ` ${metricLabel}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!isLoading && !error && (!rankingData || rankingData.length === 0) && (
            <div className="text-center py-4 text-xs text-gray-400 flex flex-col justify-center items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              Nenhum dado disponível para o período selecionado.
            </div>
          )}
        </div>
        <footer className="p-4 border-t flex items-center justify-between space-x-2">
          <div className="space-x-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="px-3 py-1 text-sm bg-gray-100 rounded-md disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={isLoading || !rankingData || rankingData.length < limit}
              className="px-3 py-1 text-sm bg-gray-100 rounded-md disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TopCreatorsModal;

