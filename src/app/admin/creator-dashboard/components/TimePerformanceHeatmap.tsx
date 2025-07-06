"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import { formatCategories, proposalCategories, contextCategories } from "@/app/lib/classification";
import { getPortugueseWeekdayName } from '@/utils/weekdays';
import TimeSlotTopPostsModal from './TimeSlotTopPostsModal';
import { LightBulbIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/solid';

// --- Helper Components ---
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

const SkeletonLoader = () => (
    <div className="animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
            <div className="h-10 bg-gray-200 rounded-md"></div>
            <div className="h-10 bg-gray-200 rounded-md"></div>
            <div className="h-10 bg-gray-200 rounded-md"></div>
            <div className="h-10 bg-gray-200 rounded-md"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded-lg"></div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
    </div>
);

const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-10">
        <ChartBarIcon className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-2 text-sm font-semibold text-gray-800">Nenhum dado encontrado</h3>
        <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
);


// --- Types and Constants ---
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
  insightSummary?: string;
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

// --- Main Component ---
const TimePerformanceHeatmap: React.FC = () => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<TimePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [format, setFormat] = useState('');
  const [proposal, setProposal] = useState('');
  const [context, setContext] = useState('');
  const [metric, setMetric] = useState(metricOptions[0]!.value);
  
  const [selectedSlot, setSelectedSlot] = useState<{ dayOfWeek: number; block: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ timePeriod, metric });
      if (format) params.set('format', format);
      if (proposal) params.set('proposal', proposal);
      if (context) params.set('context', context);
      
      const res = await fetch(`/api/v1/platform/performance/time-distribution?${params.toString()}`);
      if (!res.ok) throw new Error(`Erro ao buscar dados: ${res.statusText}`);
      const json: TimePerformanceResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, format, proposal, context, metric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCell = (day: number, block: string) => {
    return data?.buckets.find(b => b.dayOfWeek === day && b.timeBlock === block);
  };

  const maxValue = data?.buckets.reduce((max, c) => Math.max(max, c.average), 0) || 0;

  return (
    <>
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-3 mb-4">
            <CalendarDaysIcon className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-800">Análise de Performance por Horário</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todos Formatos</option>
            {formatOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={proposal} onChange={(e) => setProposal(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todas Propostas</option>
            {proposalOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={context} onChange={(e) => setContext(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todos Contextos</option>
            {contextOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            {metricOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        {loading && <SkeletonLoader />}
        {error && <div className="text-center text-sm text-red-600 p-10">Erro: {error}</div>}
        {!loading && !error && data && (
          <div>
            {data.buckets.length === 0 ? (
                <EmptyState message="Tente ajustar os filtros ou o período de tempo." />
            ) : (
            <>
                <div className="overflow-x-auto">
                <table className="w-full text-center text-xs border-separate border-spacing-1 table-fixed">
                    <thead>
                    <tr>
                        <th className="p-1 w-12"></th> 
                        {BLOCKS.map(b => (
                        <th key={b} className="p-1 font-normal text-gray-500">{b}h</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {DAYS.map((d, idx) => (
                        <tr key={d}>
                        <td className="p-1 font-semibold text-gray-600 text-right">{d}</td>
                        {BLOCKS.map(b => {
                            const cell = getCell(idx, b);
                            const val = cell ? cell.average : 0;
                            const intensity = maxValue === 0 ? 0 : 0.15 + (val / maxValue) * 0.85;
                            const style = val === 0 ? { backgroundColor: '#f8fafc' } : { backgroundColor: `rgba(79, 70, 229, ${intensity})` };
                            const tooltip = cell ? `${val.toLocaleString('pt-BR', {maximumFractionDigits: 0})} de engaj. (n=${cell.count} posts)` : 'Nenhum post';
                            return (
                            <td
                                key={b}
                                className="p-3 cursor-pointer rounded-md transition-all duration-200 hover:scale-110 hover:shadow-lg hover:z-10"
                                style={style}
                                title={tooltip}
                                onClick={() => cell && cell.count > 0 && setSelectedSlot({ dayOfWeek: cell.dayOfWeek, block: cell.timeBlock })}
                            />
                            );
                        })}
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {data.bestSlots.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="font-semibold mb-2 text-green-800">✅ Melhores Horários</p>
                    <ul className="space-y-2">
                        {data.bestSlots.slice(0,3).map((s, i) => (
                        <li key={i} className="space-y-1">
                            <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-700">{getPortugueseWeekdayName(s.dayOfWeek)} • {s.timeBlock}h</span>
                            <span className="font-bold text-gray-800">{s.average.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</span>
                            </div>
                            <div className="w-full bg-green-200 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(s.average / maxValue) * 100}%` }}></div>
                            </div>
                        </li>
                        ))}
                    </ul>
                    </div>
                )}
                {data.worstSlots.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="font-semibold mb-2 text-red-800">❌ Piores Horários</p>
                    <ul className="space-y-2">
                        {data.worstSlots.slice(0,3).map((s, i) => (
                        <li key={i} className="space-y-1">
                            <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-700">{getPortugueseWeekdayName(s.dayOfWeek)} • {s.timeBlock}h</span>
                            <span className="font-bold text-gray-800">{s.average.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</span>
                            </div>
                            <div className="w-full bg-red-200 rounded-full h-1.5">
                            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${(s.average / maxValue) * 100}%` }}></div>
                            </div>
                        </li>
                        ))}
                    </ul>
                    </div>
                )}
                </div>
                {data.insightSummary && (
                    <div className="mt-4 p-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                        <LightBulbIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <span>{data.insightSummary}</span>
                    </div>
                )}
            </>
            )}
          </div>
        )}
      </div>
      <TimeSlotTopPostsModal
        isOpen={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        dayOfWeek={selectedSlot?.dayOfWeek || 0}
        timeBlock={selectedSlot?.block || '0-6'}
        filters={{ timePeriod, format: format || undefined, proposal: proposal || undefined, context: context || undefined, metric }}
      />
    </>
  );
};

export default TimePerformanceHeatmap;
