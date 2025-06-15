/**
 * @fileoverview Componente para exibir um ranking de criadores.
 * @version 2.0.0
 * @description Adicionada a funcionalidade `onCreatorClick` para permitir o drill-down.
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { UsersIcon } from '@heroicons/react/24/outline';
import SkeletonBlock from '../components/SkeletonBlock';
import EmptyState from '../components/EmptyState';

interface RankingItem {
  creatorId: string;
  creatorName: string;
  metricValue: number;
  profilePictureUrl?: string;
}

interface CreatorRankingCardProps {
  title: string;
  apiEndpoint: string;
  dateRangeFilter?: { startDate: string; endDate: string };
  metricLabel: string;
  limit: number;
  onCreatorClick: (creator: { id: string; name: string }) => void; // Prop para interatividade
}

export default function CreatorRankingCard({ title, apiEndpoint, dateRangeFilter, metricLabel, limit, onCreatorClick }: CreatorRankingCardProps) {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (dateRangeFilter?.startDate) queryParams.append('startDate', dateRangeFilter.startDate);
    if (dateRangeFilter?.endDate) queryParams.append('endDate', dateRangeFilter.endDate);

    try {
      // Simulação da chamada à API
      await new Promise(res => setTimeout(res, 1500 * Math.random()));
      const mockData: RankingItem[] = Array.from({ length: 5 }).map((_, i) => ({
        creatorId: `user_id_${title.replace(/\s/g, '_')}_${i}`,
        creatorName: `Criador ${title} ${i + 1}`,
        metricValue: metricLabel === '%' ? (0.98 - i * 0.055) : (9876 - i * 1550),
      }));
      setRanking(mockData);
    } catch (e: any) {
      setError("Falha ao carregar ranking.");
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, dateRangeFilter, limit, title, metricLabel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <SkeletonBlock width="w-3/4" height="h-4 mb-4" />
        <ul className="space-y-3">
          {Array.from({ length: limit }).map((_, index) => (
            <li key={index} className="flex items-center">
              <SkeletonBlock variant="circle" width="w-8" height="h-8" />
              <div className="ml-3 flex-1"><SkeletonBlock width="w-full" height="h-3" /></div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button onClick={fetchData} className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">Tentar Novamente</button>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h4 className="font-semibold text-gray-800 text-md mb-2">{title}</h4>
      {ranking.length === 0 ? (
        <EmptyState icon={<UsersIcon className="w-8 h-8"/>} title="Sem Dados" message="Nenhum criador encontrado."/>
      ) : (
        <ul className="space-y-2">
          {ranking.map((creator, index) => (
            <li
              key={creator.creatorId}
              onClick={() => onCreatorClick({ id: creator.creatorId, name: creator.creatorName })}
              className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center min-w-0">
                <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                   {creator.profilePictureUrl ? (
                      <Image src={creator.profilePictureUrl} alt={creator.creatorName} width={32} height={32} className="rounded-full object-cover"/>
                   ) : (
                      creator.creatorName.substring(0, 1).toUpperCase()
                   )}
                </div>
                <span className="ml-3 text-sm font-medium text-gray-700 truncate">{creator.creatorName}</span>
              </div>
              <span className="text-sm font-bold text-indigo-600 flex-shrink-0 ml-2">
                {metricLabel === '%' ? `${(creator.metricValue * 100).toFixed(1)}%` : creator.metricValue.toLocaleString('pt-BR')}
                <span className="text-xs font-normal text-gray-500 ml-1">{metricLabel !== '%' && metricLabel}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
