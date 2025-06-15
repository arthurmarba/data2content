'use client';

import React, { useState, useEffect } from 'react';
import { ChartBarIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'; // Using ChartBarIcon as a generic icon

// Interface for data points
interface IContentPerformanceDataPoint {
  type: string; // e.g., 'IMAGE', 'VIDEO', 'REEL'
  averageMetric: number; // e.g., average views or engagement score
}

interface ContentPerformanceByTypeChartProps {
  // dateRangeFilter could be used in a real API call
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
}

const CONTENT_TYPES = ['IMAGE', 'VIDEO', 'REEL', 'CAROUSEL_ALBUM', 'STORY'];

const ContentPerformanceByTypeChart: React.FC<ContentPerformanceByTypeChartProps> = ({ dateRangeFilter }) => {
  const [data, setData] = useState<IContentPerformanceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));

      try {
        // Generate sample data
        const sampleData: IContentPerformanceDataPoint[] = CONTENT_TYPES.map(type => ({
          type,
          averageMetric: Math.floor(Math.random() * 5000) + 500, // Random metric between 500 and 5500
        }));
        setData(sampleData);
      } catch (e: any) {
        setError('Falha ao buscar dados de desempenho.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Dependency on dateRangeFilter can be added here if the API call uses it
    // }, [dateRangeFilter]);
  }, []); // For now, data is independent of dateRangeFilter for simulation

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
      {!isLoading && !error && data.length > 0 && (
        <div>
          <div className="text-center py-8 px-4 bg-gray-50 rounded-md">
            <p className="text-gray-600 font-medium">[Bar Chart Placeholder: Content Performance by Type]</p>
            <p className="text-sm text-gray-500 mt-1">Um gráfico de barras seria exibido aqui.</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {data.map(item => (
              <li key={item.type} className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="font-medium">{item.type}:</span>
                <span>{item.averageMetric.toLocaleString('pt-BR')} (métrica média)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!isLoading && !error && data.length === 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500">Nenhum dado de desempenho encontrado para os tipos de conteúdo.</p>
        </div>
      )}
    </div>
  );
};

export default ContentPerformanceByTypeChart;
