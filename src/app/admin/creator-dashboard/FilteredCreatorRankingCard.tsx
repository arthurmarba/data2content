'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { ICreatorMetricRankItemWithFollowers } from '@/app/lib/dataService/marketAnalysisService';
import SkeletonBlock from './SkeletonBlock';

const METRIC_OPTIONS = [
  { value: 'avg_views', label: 'Média de Visualizações' },
  { value: 'total_interactions', label: 'Interações Totais' },
  { value: 'avg_likes', label: 'Média de Likes' },
  { value: 'avg_shares', label: 'Média de Compartilhamentos' },
];

interface FilteredCreatorRankingCardProps {
  timePeriod: string;
  limit?: number;
}

export default function FilteredCreatorRankingCard({ timePeriod, limit = 5 }: FilteredCreatorRankingCardProps) {
  const [metric, setMetric] = useState('avg_views');
  const [minFollowers, setMinFollowers] = useState('0');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [minAvgViews, setMinAvgViews] = useState('');
  const [rankingData, setRankingData] = useState<ICreatorMetricRankItemWithFollowers[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyCount, setApplyCount] = useState(0);

  const applyFilters = () => setApplyCount(c => c + 1);

  const fetchData = useCallback(async () => {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = timePeriod === 'all_time' ? new Date(0) : getStartDateFromTimePeriod(today, timePeriod);

    const params = new URLSearchParams({
      metric,
      minFollowers: minFollowers || '0',
      limit: String(limit),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    if (maxFollowers) params.append('maxFollowers', maxFollowers);
    if (minAvgViews) params.append('minAvgViews', minAvgViews);

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/dashboard/rankings/creators/filtered?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar ranking');
      }
      const data: ICreatorMetricRankItemWithFollowers[] = await response.json();
      setRankingData(data);
    } catch (e: any) {
      setError(e.message);
      setRankingData(null);
    } finally {
      setIsLoading(false);
    }
  }, [metric, minFollowers, maxFollowers, minAvgViews, limit, timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData, applyCount]);

  const formatMetricValue = (value: number): string => {
    if (Number.isInteger(value)) return value.toLocaleString('pt-BR');
    return parseFloat(value.toFixed(2)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Métrica</label>
          <select value={metric} onChange={e => setMetric(e.target.value)} className="border-gray-300 rounded-md text-sm">
            {METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mín. Seguidores</label>
          <input type="number" value={minFollowers} onChange={e => setMinFollowers(e.target.value)} className="border-gray-300 rounded-md text-sm w-24" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Máx. Seguidores</label>
          <input type="number" value={maxFollowers} onChange={e => setMaxFollowers(e.target.value)} className="border-gray-300 rounded-md text-sm w-24" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mín. Média Views</label>
          <input type="number" value={minAvgViews} onChange={e => setMinAvgViews(e.target.value)} className="border-gray-300 rounded-md text-sm w-24" />
        </div>
        <button onClick={applyFilters} className="ml-auto px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md">Aplicar</button>
      </div>

      {isLoading && (
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
      )}

      {!isLoading && error && (
        <div className="text-center py-4 text-xs text-red-500">Erro: {error}</div>
      )}

      {!isLoading && !error && rankingData && rankingData.length > 0 && (
        <ol className="space-y-2 text-sm">
          {rankingData.map((item, index) => (
            <li key={item.creatorId.toString()} className="flex items-center space-x-2.5">
              <span className="text-xs font-medium text-gray-500 w-5 text-center">{index + 1}.</span>
              {item.profilePictureUrl ? (
                <Image src={item.profilePictureUrl} alt={item.creatorName || 'Creator'} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                  {item.creatorName?.substring(0, 1).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 truncate">
                <p className="text-gray-800 font-medium truncate" title={item.creatorName}>{item.creatorName || 'Desconhecido'}</p>
                <p className="text-xs text-gray-500">{item.followersCount.toLocaleString('pt-BR')} seg.</p>
              </div>
              <span className="text-xs text-indigo-600 font-semibold whitespace-nowrap">
                {formatMetricValue(item.metricValue)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!isLoading && !error && (!rankingData || rankingData.length === 0) && (
        <div className="text-center py-4 text-xs text-gray-400">Nenhum dado disponível.</div>
      )}
    </div>
  );
}
