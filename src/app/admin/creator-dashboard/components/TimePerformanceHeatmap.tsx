"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import { formatCategories, proposalCategories, contextCategories } from "@/app/lib/classification";
import { getPortugueseWeekdayName } from '@/utils/weekdays';

const createOptionsFromCategories = (categories: any[]) => {
  const options: { value: string; label: string }[] = [];
  const traverse = (cats: any[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      options.push({ value: cat.id, label });
      if (cat.subcategories && cat.subcategories.length) {
        traverse(cat.subcategories, label);
      }
    });
  };
  traverse(categories);
  return options;
};

interface HeatmapCell {
  dayOfWeek: number;
  timeBlock: string;
  average: number;
  count: number;
}

interface TimePerformanceResponse {
  buckets: HeatmapCell[];
  bestSlots: HeatmapCell[];
  worstSlots: HeatmapCell[];
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const BLOCKS = ["0-6", "6-12", "12-18", "18-24"];

const metricOptions = [
  { value: 'stats.total_interactions', label: 'Volume de Engajamento' },
  { value: 'stats.engagement_rate_on_reach', label: 'Taxa de Engajamento' },
];

const formatOptions = createOptionsFromCategories(formatCategories);
const proposalOptions = createOptionsFromCategories(proposalCategories);
const contextOptions = createOptionsFromCategories(contextCategories);

const TimePerformanceHeatmap: React.FC = () => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<TimePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState('');
  const [proposal, setProposal] = useState('');
  const [context, setContext] = useState('');
  const [metric, setMetric] = useState(metricOptions[0]!.value);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('timePeriod', timePeriod);
      if (format) params.set('format', format);
      if (proposal) params.set('proposal', proposal);
      if (context) params.set('context', context);
      if (metric) params.set('metric', metric);
      const res = await fetch(`/api/v1/platform/performance/time-distribution?${params.toString()}`);
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const json: TimePerformanceResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [timePeriod]);

  const getCellValue = (day: number, block: string) => {
    const cell = data?.buckets.find(b => b.dayOfWeek === day + 1 && b.timeBlock === block);
    return cell ? cell.average : 0;
  };

  const maxValue = data?.buckets.reduce((max, c) => Math.max(max, c.average), 0) || 0;

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <h3 className="text-md font-semibold text-gray-700 mb-4">Análise de Performance por Horário</h3>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Formato</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-xs">
            <option value="">Todos</option>
            {formatOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Proposta</label>
          <select value={proposal} onChange={(e) => setProposal(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-xs">
            <option value="">Todas</option>
            {proposalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contexto</label>
          <select value={context} onChange={(e) => setContext(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-xs">
            <option value="">Todos</option>
            {contextOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Métrica</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-xs">
            {metricOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 text-right">
        <button onClick={fetchData} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded">Aplicar</button>
      </div>

      {loading && <p className="text-center text-sm">Carregando...</p>}
      {error && <p className="text-center text-sm text-red-600">Erro: {error}</p>}
      {!loading && !error && data && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-center text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1"></th>
                {BLOCKS.map(b => (
                  <th key={b} className="px-2 py-1">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, idx) => (
                <tr key={d}>
                  <td className="px-2 py-1 font-medium text-gray-600">{d}</td>
                  {BLOCKS.map(b => {
                    const val = getCellValue(idx, b);
                    const intensity = maxValue === 0 ? 0 : val / maxValue;
                    const style = val === 0 ? undefined : { backgroundColor: `rgba(79,70,229,${intensity})` };
                    return (
                      <td
                        key={b}
                        className="px-2 py-1"
                        style={style}
                        title={val.toFixed(1)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {(data.bestSlots.length > 0 || data.worstSlots.length > 0) && (
            <div className="mt-4 text-left text-xs space-y-2">
              {data.bestSlots.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Melhores Horários:</p>
                  <ul className="list-disc list-inside">
                    {data.bestSlots.slice(0,3).map((s, i) => (
                      <li key={i}>{getPortugueseWeekdayName(s.dayOfWeek)} {s.timeBlock} - {s.average.toFixed(1)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.worstSlots.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Piores Horários:</p>
                  <ul className="list-disc list-inside">
                    {data.worstSlots.slice(0,3).map((s, i) => (
                      <li key={i}>{getPortugueseWeekdayName(s.dayOfWeek)} {s.timeBlock} - {s.average.toFixed(1)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2">Recomendação: priorize os melhores horários e evite os piores.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimePerformanceHeatmap;
