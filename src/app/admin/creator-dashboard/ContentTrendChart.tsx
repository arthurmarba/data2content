'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface DailySnapshot {
  date: string | Date;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyShares?: number;
}

interface PostDetailResponse {
  format?: string;
  proposal?: string;
  context?: string;
  dailySnapshots: DailySnapshot[];
}

interface ContentTrendChartProps {
  postId: string;
}

const metricOptions: { key: keyof DailySnapshot; label: string; color: string }[] = [
  { key: 'dailyViews', label: 'Visualizações', color: '#8884d8' },
  { key: 'dailyLikes', label: 'Curtidas', color: '#82ca9d' },
  { key: 'dailyShares', label: 'Compart.', color: '#ff7300' },
];

const ContentTrendChart: React.FC<ContentTrendChartProps> = ({ postId }) => {
  const [data, setData] = useState<DailySnapshot[]>([]);
  const [meta, setMeta] = useState<{ format?: string; proposal?: string; context?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<(keyof DailySnapshot)[]>(['dailyViews']);
  const [dayLimit, setDayLimit] = useState<number>(7);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard/posts/${postId}/details`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao buscar dados');
      }
      const json: PostDetailResponse = await res.json();
      setMeta({ format: json.format, proposal: json.proposal, context: json.context });
      const snapshots = (json.dailySnapshots || []).map((s, idx) => ({
        ...s,
        date: s.date ? new Date(s.date) : undefined,
        dayNumber: typeof s.dayNumber === 'number' ? s.dayNumber : idx + 1,
      }));
      setData(snapshots);
    } catch (e: any) {
      setError(e.message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMetricToggle = (metric: keyof DailySnapshot) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  const filteredData = data.slice(0, dayLimit);

  return (
    <div className="p-4 bg-white rounded-md shadow-md space-y-4">
      <div className="flex flex-col md:flex-row md:space-x-6">
        <div className="flex-1">
          <h4 className="text-md font-semibold text-gray-700 mb-2">Evolução Diária</h4>
          <p className="text-xs text-gray-500 mb-2">Dia 0 corresponde à data de publicação. Ajuste o período para analisar os primeiros dias.</p>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">Carregando...</div>
          ) : error ? (
            <div className="h-64 flex items-center justify-center text-red-500">{error}</div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={filteredData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dayNumber"
                    label={{ value: 'Dia', position: 'insideBottom', offset: -4 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                  <Legend />
                  {metricOptions
                    .filter((opt) => selectedMetrics.includes(opt.key))
                    .map((opt) => (
                      <Line
                        key={opt.key}
                        type="monotone"
                        dataKey={opt.key}
                        name={opt.label}
                        stroke={opt.color}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 items-center text-sm">
            {metricOptions.map((opt) => (
              <label key={opt.key} className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(opt.key)}
                  onChange={() => handleMetricToggle(opt.key)}
                  className="text-indigo-600"
                />
                <span>{opt.label}</span>
              </label>
            ))}
            <label className="ml-auto flex items-center space-x-1">
              <span>Período (dias):</span>
              <input
                type="number"
                min={1}
                value={dayLimit}
                onChange={(e) => setDayLimit(parseInt(e.target.value) || 1)}
                className="w-16 border border-gray-300 rounded-md px-1 text-sm"
              />
            </label>
          </div>
        </div>
        <aside className="w-full md:w-48 mt-4 md:mt-0 text-sm space-y-1">
          <h4 className="text-md font-semibold text-gray-700 mb-1">Informações</h4>
          <p><strong>Formato:</strong> {meta.format || 'N/A'}</p>
          <p><strong>Proposta:</strong> {meta.proposal || 'N/A'}</p>
          <p><strong>Contexto:</strong> {meta.context || 'N/A'}</p>
        </aside>
      </div>
    </div>
  );
};

export default ContentTrendChart;
