import React, { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { commaSeparatedIdsToLabels } from '../../../lib/classification';
import { FullDataModal } from './FullDataModal';

interface DataPoint {
  name: string;
  value: number;
  postsCount: number;
}

const DEFAULT_METRIC = 'stats.total_interactions';

interface FormatPerformanceRankingTableProps {
  apiPrefix?: string;
  dataOverride?: DataPoint[] | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}

const FormatPerformanceRankingTable: React.FC<FormatPerformanceRankingTableProps> = ({
  apiPrefix = '/api/admin',
  dataOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasOverride = Boolean(disableFetch)
    || typeof dataOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined';

  const swrKey = useMemo(() => ([
    'format-performance',
    apiPrefix,
    timePeriod,
    DEFAULT_METRIC,
  ]), [apiPrefix, timePeriod]);

  const fetcher = useCallback(async (): Promise<DataPoint[]> => {
    const apiUrl = `${apiPrefix}/dashboard/performance/average-engagement?timePeriod=${timePeriod}&groupBy=format&sortOrder=desc&engagementMetricField=${DEFAULT_METRIC}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
    const result = await res.json();
    return result.chartData.map((d: any) => ({
      name: d.name,
      value: d.value,
      postsCount: d.postsCount,
    }));
  }, [apiPrefix, timePeriod]);

  const shouldFetch = !hasOverride;
  const { data, error, isLoading } = useSWR<DataPoint[]>(
    shouldFetch ? swrKey : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const finalLoading = hasOverride ? (loadingOverride ?? false) : isLoading;
  const finalError = hasOverride ? (errorOverride ?? null) : errorMessage;
  const rawData = useMemo(
    () => (hasOverride ? (dataOverride ?? []) : (data ?? [])),
    [hasOverride, dataOverride, data]
  );
  const tableData = useMemo(() => (
    rawData.map((d) => ({
      ...d,
      name: commaSeparatedIdsToLabels(d.name, 'format') || d.name,
    }))
  ), [rawData]);
  const totalPosts = tableData.reduce((sum, d) => sum + d.postsCount, 0);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-semibold text-gray-700">Ranking de Desempenho por Formato</h3>
        <button onClick={() => setIsModalOpen(true)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          Ver Análise Completa
        </button>
      </div>
      {finalLoading && <p className="text-center py-6 text-gray-500">Carregando ranking...</p>}
      {finalError && <p className="text-center py-6 text-red-500">Erro: {finalError}</p>}
      {!finalLoading && !finalError && tableData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formato</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Engajamento Médio</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Volume (% do Total)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((item, index) => {
                const pct = totalPosts > 0 ? (item.postsCount / totalPosts) * 100 : 0;
                return (
                  <tr key={item.name} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-center font-medium text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.value.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      <div className="flex items-center gap-2 justify-end">
                        <span>{item.postsCount} ({pct.toFixed(1)}%)</span>
                        <div className="w-24 h-2 bg-gray-200 rounded">
                          <div className="h-2 bg-indigo-500 rounded" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!finalLoading && !finalError && tableData.length === 0 && (
        <p className="text-center py-6 text-gray-500">Nenhum dado disponível.</p>
      )}

      <FullDataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        groupBy="format"
        metricUsed={DEFAULT_METRIC}
        chartTitle="Ranking de Desempenho por Formato"
        apiPrefix={apiPrefix}
      />
    </div>
  );
};

export default FormatPerformanceRankingTable;
