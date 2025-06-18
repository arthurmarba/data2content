"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CohortDefinition {
  filterBy: 'planStatus' | 'inferredExpertiseLevel';
  value: string;
  name?: string; // optional label for display
}

interface CohortComparisonChartProps {
  metric: string;
  cohorts: CohortDefinition[];
  startDate: string;
  endDate: string;
  title?: string;
}

interface CohortComparisonResult {
  cohortName: string;
  avgMetricValue: number;
  userCount: number;
}

const CohortComparisonChart: React.FC<CohortComparisonChartProps> = ({
  metric,
  cohorts,
  startDate,
  endDate,
  title = 'Comparação de Coortes'
}) => {
  const [data, setData] = useState<CohortComparisonResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/dashboard/cohorts/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric,
          cohorts: cohorts.map(c => ({ filterBy: c.filterBy, value: c.value })),
          dateRange: { startDate, endDate }
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText);
      }
      const result: CohortComparisonResult[] = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [metric, cohorts, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{title}</h2>
      <div style={{ width: '100%', height: 350 }}>
        {loading && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">Carregando dados...</p>
          </div>
        )}
        {error && (
          <div className="flex justify-center items-center h-full">
            <p className="text-red-500">Erro: {error}</p>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="cohortName" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgMetricValue" name="Valor Médio" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">Nenhum dado disponível.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CohortComparisonChart;

