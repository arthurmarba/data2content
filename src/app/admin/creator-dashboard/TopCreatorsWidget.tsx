'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import SkeletonBlock from './SkeletonBlock';
import { TopCreatorMetric } from '@/app/lib/dataService/marketAnalysisService';
import { useGlobalTimePeriod } from './components/filters/GlobalTimePeriodContext';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { TimePeriod } from '@/app/lib/constants/timePeriods';
import TopCreatorsModal from './TopCreatorsModal';

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-4 w-4'}
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

interface TopCreatorsWidgetProps {
  title: string;
  context?: string;
  creatorContext?: string;
  metric?: TopCreatorMetric;
  timePeriod?: TimePeriod;
  limit?: number;
  metricLabel?: string;
  compositeRanking?: boolean;
  tooltip?: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
}

const TopCreatorsWidget: React.FC<TopCreatorsWidgetProps> = ({
  title,
  context,
  metric = 'total_interactions',
  timePeriod,
  limit = 5,
  metricLabel = '',
  compositeRanking = false,
  tooltip,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  creatorContext,
}) => {
  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const effectiveTimePeriod: TimePeriod = timePeriod || (globalTimePeriod as TimePeriod);
  const days = timePeriodToDays(effectiveTimePeriod);

  const [rankingData, setRankingData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [failedImgIds, setFailedImgIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      days: String(days),
      limit: String(limit),
    });
    if (compositeRanking) {
      params.append('composite', 'true');
    } else {
      params.append('metric', metric);
    }
    const effectiveContext = context;
    if (effectiveContext) params.append('context', effectiveContext);
    if (creatorContext) params.append('creatorContext', creatorContext);
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');

    try {
      const response = await fetch(`${apiPrefix}/dashboard/rankings/top-creators?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch rankings');
      }
      const data = await response.json();
      setRankingData(data);
    } catch (e: any) {
      setError(e.message);
      setRankingData(null);
    } finally {
      setIsLoading(false);
    }
  }, [context, creatorContext, metric, days, limit, compositeRanking, apiPrefix, onlyActiveSubscribers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-md font-semibold text-gray-700 truncate" title={title}>
          {compositeRanking ? 'Top Criadores (Score)' : title}
        </h4>
        {tooltip && (
          <div className="relative group">
            <InfoIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-1.5 text-xs text-white bg-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {isLoading && renderSkeleton()}
      {!isLoading && error && (
        <div className="text-center py-4 flex-grow flex flex-col justify-center items-center">
          <p className="text-xs text-red-500 px-2">Erro: {error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
          >
            Tentar Novamente
          </button>
        </div>
      )}
      {!isLoading && !error && rankingData && rankingData.length > 0 && (
        <ol className="space-y-2 text-sm flex-grow">
          {rankingData.map((item: any, index: number) => (
            <li key={item.creatorId.toString()} className="flex items-center space-x-2.5 py-1">
              <span className="text-xs font-medium text-gray-500 w-5 text-center">{index + 1}.</span>
              {item.profilePictureUrl && !failedImgIds.has(String(item.creatorId)) ? (
                <Image
                  src={`/api/proxy/thumbnail/${encodeURIComponent(item.profilePictureUrl as string)}`}
                  alt={item.creatorName || 'Creator'}
                  width={32}
                  height={32}
                  unoptimized
                  onError={() => setFailedImgIds(prev => new Set(prev).add(String(item.creatorId)))}
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
                {formatMetricValue(compositeRanking ? item.score : item.metricValue)}
                {metricLabel && !compositeRanking && ` ${metricLabel}`}
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
      {compositeRanking && (
        <>
          <div className="mt-3 text-right">
            <button onClick={() => setIsModalOpen(true)} className="text-xs text-indigo-600 hover:underline">
              Ver mais
            </button>
          </div>
          <TopCreatorsModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={compositeRanking ? 'Top Criadores (Score)' : title}
            context={context}
            creatorContext={creatorContext}
            metric={metric}
            timePeriod={effectiveTimePeriod}
            metricLabel={metricLabel}
            compositeRanking={compositeRanking}
            limit={20}
            apiPrefix={apiPrefix}
            onlyActiveSubscribers={onlyActiveSubscribers}
          />
        </>
      )}
    </div>
  );
};

export default TopCreatorsWidget;
