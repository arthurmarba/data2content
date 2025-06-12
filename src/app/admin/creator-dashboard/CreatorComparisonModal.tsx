'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ICreatorProfile } from '@/app/lib/dataService/marketAnalysisService'; // Assuming path
import Image from 'next/image'; // For profile pictures

interface CreatorComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorIdsToCompare: string[];
}

// Helper to format numbers - can be expanded
const formatNumber = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return num.toLocaleString('pt-BR');
};

const formatPercentage = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return `${(num * 100).toFixed(1)}%`; // Example: 6.7%
};

const getSafeString = (value: any, defaultValue: string = 'N/A'): string => {
    if (value === null || typeof value === 'undefined' || value === '') return defaultValue;
    return String(value);
};


export default function CreatorComparisonModal({
  isOpen,
  onClose,
  creatorIdsToCompare,
}: CreatorComparisonModalProps) {
  const [comparisonData, setComparisonData] = useState<ICreatorProfile[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparisonData = useCallback(async () => {
    if (!isOpen || creatorIdsToCompare.length < 2) {
      setComparisonData(null); // Clear if not open or not enough IDs
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dashboard/creators/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorIds: creatorIdsToCompare }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch comparison data: ${response.statusText}`);
      }
      const data: ICreatorProfile[] = await response.json();
      // Ensure data is sorted in the same order as creatorIdsToCompare for consistent column display
      const sortedData = creatorIdsToCompare.map(id => data.find(p => p.creatorId === id)).filter(p => p) as ICreatorProfile[];
      setComparisonData(sortedData);

    } catch (e: any) {
      setError(e.message);
      setComparisonData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, creatorIdsToCompare]);

  useEffect(() => {
    if (isOpen) {
      fetchComparisonData();
    } else {
      // Clear data when modal is closed
      setComparisonData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, fetchComparisonData]); // fetchComparisonData depends on creatorIdsToCompare

  if (!isOpen) {
    return null;
  }

  const metricsToDisplay: { label: string; key: keyof ICreatorProfile | 'profilePictureUrl'; format?: (val: any) => string, isNumeric?: boolean }[] = [
    { label: 'Foto de Perfil', key: 'profilePictureUrl', format: (val) => val }, // Special handling for image
    { label: 'Nome do Criador', key: 'creatorName', format: (val) => getSafeString(val) },
    { label: 'Nº de Posts', key: 'postCount', format: formatNumber, isNumeric: true },
    { label: 'Taxa de Engaj. Média', key: 'avgEngagementRate', format: formatPercentage, isNumeric: true },
    { label: 'Likes Médios', key: 'avgLikes', format: formatNumber, isNumeric: true },
    { label: 'Compart. Médios', key: 'avgShares', format: formatNumber, isNumeric: true },
    { label: 'Nicho Principal', key: 'topPerformingContext', format: (val) => getSafeString(val) },
  ];

  // Helper to find the best value for numeric metrics
  const findBestValue = (metricKey: keyof ICreatorProfile, profiles: ICreatorProfile[]): number | undefined => {
    if (!profiles || profiles.length === 0) return undefined;
    const values = profiles.map(p => p[metricKey] as number).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return undefined;
    // For engagement rate, higher is better. For others, depends (e.g. lower bounce rate). Assuming higher is better for these.
    return Math.max(...values);
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-gray-300 dark:border-gray-700">
        <header className="flex items-center justify-between p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-white">
            Comparativo de Criadores ({creatorIdsToCompare.length})
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400" // Icon Button Style
            title="Fechar modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-1 sm:p-2 md:p-4 overflow-auto flex-grow">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 dark:text-gray-400">Carregando dados para comparação...</p>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-64 p-4">
              <p className="text-red-600 dark:text-red-400 text-center">Erro ao carregar dados: {error}</p>
            </div>
          )}
          {!isLoading && !error && (!comparisonData || comparisonData.length === 0) && (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 dark:text-gray-400">Nenhum dado de criador disponível para comparação ou IDs inválidos.</p>
            </div>
          )}
          {!isLoading && !error && comparisonData && comparisonData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse border border-gray-300 dark:border-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-50 dark:bg-gray-700/50">Métrica</th>
                    {comparisonData.map(profile => (
                      <th key={profile.creatorId} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border border-gray-300 dark:border-gray-600 whitespace-nowrap truncate max-w-[150px]" title={profile.creatorName}>
                        {profile.creatorName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {metricsToDisplay.map(metric => {
                    const bestValue = metric.isNumeric ? findBestValue(metric.key as keyof ICreatorProfile, comparisonData) : undefined;
                    return (
                      <tr key={metric.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 sticky left-0 bg-white dark:bg-gray-800 whitespace-nowrap">{metric.label}</td>
                        {comparisonData.map(profile => {
                          const rawValue = profile[metric.key as keyof ICreatorProfile];
                          const displayValue = metric.format ? metric.format(rawValue) : getSafeString(rawValue);
                          const isBest = metric.isNumeric && typeof rawValue === 'number' && rawValue === bestValue && bestValue !== 0; // Highlight non-zero bests

                          return (
                            <td key={`${profile.creatorId}-${metric.key}`}
                                className={`px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-center whitespace-nowrap ${isBest ? 'font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' : ''}`}>
                              {metric.key === 'profilePictureUrl' ? (
                                <div className="flex justify-center">
                                  {profile.profilePictureUrl ? (
                                    <Image src={profile.profilePictureUrl} alt={profile.creatorName} width={40} height={40} className="rounded-full object-cover h-10 w-10" />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
                                      {profile.creatorName?.substring(0,2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                displayValue
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
