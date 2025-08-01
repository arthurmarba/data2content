"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface EffectivenessResult {
  alertType: string;
  positiveInteractionRate: number;
  totalAlerts: number;
}

const PERIOD_OPTIONS = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
];

const RadarEffectivenessWidget: React.FC = () => {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [data, setData] = useState<EffectivenessResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ periodDays: periodDays.toString() });
      const res = await fetch(`/api/admin/dashboard/radar/effectiveness?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar dados.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
        Eficácia do Radar Mobi
      </h2>
      <div className="mb-4">
        <label htmlFor="radar-period-selector" className="text-sm text-gray-600 mr-2">
          Período:
        </label>
        <select
          id="radar-period-selector"
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
      {!loading && !error && data.length > 0 && (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
              <XAxis dataKey="alertType" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
              />
              <Tooltip formatter={(v: any) => `${(Number(v) * 100).toFixed(0)}%`} />
              <Bar dataKey="positiveInteractionRate" name="Interação" fill="var(--color-indigo-600)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="text-center text-gray-500">Nenhum dado disponível.</p>
      )}
    </div>
  );
};

export default RadarEffectivenessWidget;

