'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import CreatorTimeSeriesChart, { ICreatorTimeSeriesDataPoint } from './CreatorTimeSeriesChart';
import { IFetchCreatorTimeSeriesArgs } from '@/app/lib/dataService/marketAnalysisService'; // For metric/period types

type MetricOption = IFetchCreatorTimeSeriesArgs['metric'];
type PeriodOption = IFetchCreatorTimeSeriesArgs['period'];

interface CreatorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string | null;
  creatorName: string | null;
  dateRangeFilter: { // Global date range from parent dashboard page
    startDate?: string;
    endDate?: string;
  };
}

const metricOptions: { value: MetricOption; label: string }[] = [
  { value: 'post_count', label: 'Contagem de Posts' },
  { value: 'avg_engagement_rate', label: 'Engajamento Médio' },
  { value: 'total_interactions', label: 'Interações Totais' },
  { value: 'avg_likes', label: 'Média de Likes' },
  { value: 'avg_shares', label: 'Média de Shares' },
];

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly', label: 'Semanal' },
];

export default function CreatorDetailModal({
  isOpen,
  onClose,
  creatorId,
  creatorName,
  dateRangeFilter,
}: CreatorDetailModalProps) {
  const [timeSeriesData, setTimeSeriesData] = useState<ICreatorTimeSeriesDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricOption>('post_count');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('monthly');

  const fetchTimeSeriesData = useCallback(async () => {
    if (!isOpen || !creatorId || !dateRangeFilter.startDate || !dateRangeFilter.endDate) {
      // Don't fetch if modal is not open, creatorId is null, or global date range isn't fully set
      setTimeSeriesData([]); // Clear data if conditions aren't met
      return;
    }

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      metric: selectedMetric,
      period: selectedPeriod,
      startDate: dateRangeFilter.startDate,
      endDate: dateRangeFilter.endDate,
    });

    try {
      const response = await fetch(`/api/admin/dashboard/creators/${creatorId}/time-series?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch time series data: ${response.statusText}`);
      }
      const data = await response.json();
      setTimeSeriesData(data);
    } catch (e: any) {
      setError(e.message);
      setTimeSeriesData([]);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, creatorId, selectedMetric, selectedPeriod, dateRangeFilter]);

  useEffect(() => {
    // Fetch data when modal opens or relevant filters/props change
    if (isOpen && creatorId) {
      fetchTimeSeriesData();
    } else {
      // Clear data when modal is closed or creatorId is not set
      setTimeSeriesData([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, creatorId, selectedMetric, selectedPeriod, dateRangeFilter, fetchTimeSeriesData]);


  if (!isOpen) {
    return null;
  }

  const selectedMetricFullLabel = metricOptions.find(m => m.value === selectedMetric)?.label || selectedMetric;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-gray-300 dark:border-gray-700">
        <header className="flex items-center justify-between p-4 md:p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-white">
            Detalhes de: <span className="text-indigo-600 dark:text-indigo-400">{creatorName || 'Criador'}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            title="Fechar modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 md:p-5 space-y-4 overflow-y-auto flex-grow">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-metric" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Métrica:</label>
              <select
                id="modal-metric"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricOption)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {metricOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="modal-period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período:</label>
              <select
                id="modal-period"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as PeriodOption)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {periodOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 min-h-[300px]"> {/* Container for the chart */}
            <CreatorTimeSeriesChart
              data={timeSeriesData}
              metricLabel={selectedMetricFullLabel}
              isLoading={isLoading}
              error={error}
              chartType={selectedMetric === 'post_count' || selectedMetric === 'total_interactions' ? 'bar' : 'line'}
              period={selectedPeriod}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
