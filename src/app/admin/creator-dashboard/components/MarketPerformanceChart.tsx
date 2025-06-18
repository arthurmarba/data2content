"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MarketPerformanceResult {
  avgEngagementRate?: number;
  avgShares?: number;
  avgLikes?: number;
  postCount: number;
}

const PERIOD_OPTIONS = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
];

interface MarketPerformanceChartProps {
  format: string;
  proposal: string;
}

const MarketPerformanceChart: React.FC<MarketPerformanceChartProps> = ({ format, proposal }) => {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [data, setData] = useState<MarketPerformanceResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format, proposal, days: periodDays.toString() });
      const res = await fetch(`/api/admin/dashboard/market-performance?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || res.statusText);
      }
      const result: MarketPerformanceResult = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar dados.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [format, proposal, periodDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data
    ? [
        { name: 'Curtidas', value: data.avgLikes ?? 0 },
        { name: 'Compart.', value: data.avgShares ?? 0 },
      ]
    : [];

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
        Desempenho do Mercado
      </h2>
      <div className="mb-4">
        <label className="text-sm text-gray-600 mr-2" htmlFor="periodSelector">
          Período:
        </label>
        <select
          id="periodSelector"
          value={periodDays}
          onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
          className="p-2 border border-gray-300 rounded-md text-sm"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {loading && <p className="text-center text-gray-500">Carregando...</p>}
      {error && <p className="text-center text-red-500">Erro: {error}</p>}
      {!loading && !error && data && (
        <>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 12 }} />
                <YAxis stroke="#666" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                <Legend />
                <Bar dataKey="value" name="Média" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Posts analisados: {data.postCount}. Engajamento médio:{' '}
            {((data.avgEngagementRate ?? 0) * 100).toFixed(2)}%
          </p>
        </>
      )}
      {!loading && !error && !data && (
        <p className="text-center text-gray-500">Nenhum dado disponível.</p>
      )}
    </div>
  );
};

export default React.memo(MarketPerformanceChart);
