'use client';

import React, { useState, useEffect } from 'react';
import { ChartBarIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList
} from 'recharts'; // Added Recharts imports

// Interface for data points
interface IContentPerformanceDataPoint {
  type: string;
  averageInteractions: number;
}

interface ContentPerformanceByTypeChartProps {
  // dateRangeFilter could be used in a real API call
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
}

const ContentPerformanceByTypeChart: React.FC<ContentPerformanceByTypeChartProps> = ({ dateRangeFilter }) => {
  const [data, setData] = useState<IContentPerformanceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRangeFilter || !dateRangeFilter.startDate || !dateRangeFilter.endDate) {
        // Do not fetch if date range is not fully defined, or set a default behavior
        // For now, we can set data to empty and stop loading, or show a message.
        // Or, ensure parent component always provides a default valid dateRangeFilter.
        // Let's assume parent provides valid dates or this component shouldn't fetch.
        // If the dashboard always has a default date range, this check might be less critical.
        // However, if it can be undefined, this is important.
        // For this task, if filter is incomplete, show "select date range" message.
        setIsLoading(false);
        setError(null); // Clear previous errors
        setData([]); // Clear previous data
        // Optionally, set a specific message: setError("Por favor, selecione um intervalo de datas válido.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setData([]); // Clear previous data on new fetch

      const params = new URLSearchParams({
        startDate: new Date(dateRangeFilter.startDate).toISOString(),
        endDate: new Date(dateRangeFilter.endDate).toISOString(),
      });

      const apiUrl = `/api/admin/dashboard/content/performance-by-type?${params.toString()}`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
          throw new Error(errorData.message || errorData.error || `Erro HTTP: ${response.status}`);
        }
        const fetchedData: IContentPerformanceDataPoint[] = await response.json();
        setData(fetchedData);
      } catch (e: any) {
        console.error('Falha ao buscar dados de desempenho por tipo:', e);
        setError(e.message || 'Falha ao buscar dados de desempenho.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRangeFilter]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <ChartBarIcon className="w-6 h-6 mr-2 text-indigo-600" />
        Desempenho Médio por Tipo de Conteúdo
      </h3>
      {isLoading && (
        <div className="text-center py-10">
          <p className="text-gray-500">A carregar dados...</p>
        </div>
      )}
      {error && (
        <div className="text-center py-10 text-red-600 flex flex-col items-center">
          <ExclamationCircleIcon className="w-8 h-8 mb-2"/>
          <p>{error}</p>
        </div>
      )}
      {!isLoading && !error && data && data.length > 0 && (
        <div style={{ width: '100%', height: 400 }} className="mt-4">
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 70 }} // Increased bottom margin for XAxis labels
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="type"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80} // Allocate space for rotated labels
                stroke="#666"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                formatter={(value: number, name: string) => [value.toLocaleString('pt-BR'), "Interações Médias"]}
              />
              <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }} />
              <Bar dataKey="averageInteractions" name="Interações Médias" fill="#82ca9d" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="averageInteractions" position="top" formatter={(value: number) => value.toLocaleString('pt-BR')} fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!isLoading && !error && (!data || data.length === 0) && ( // Covers null or empty
        <div className="text-center py-10">
          <p className="text-gray-500">Nenhum dado de desempenho encontrado para o período selecionado.</p>
        </div>
      )}
    </div>
  );
};

export default ContentPerformanceByTypeChart;
