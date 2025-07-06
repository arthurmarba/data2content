"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import {
  formatCategories,
  proposalCategories,
  contextCategories,
} from "../../../lib/classification";

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

interface Props { formatFilter?: string; }

const createOptionsFromCategories = (categories: { id: string; label: string; subcategories?: any[] }[]) => {
  const opts: { value: string; label: string }[] = [];
  const traverse = (cats: typeof categories, prefix = '') => {
    cats.forEach(cat => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      opts.push({ value: cat.id, label });
      if (cat.subcategories && cat.subcategories.length) traverse(cat.subcategories, label);
    });
  };
  traverse(categories);
  return opts;
};

const TimePerformanceHeatmap: React.FC<Props> = ({ formatFilter }) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<TimePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [format, setFormat] = useState<string>(formatFilter || "");
  const [proposal, setProposal] = useState<string>("");
  const [context, setContext] = useState<string>("");
  const [metric, setMetric] = useState<string>("interactions");

  const formatOptions = useMemo(() => createOptionsFromCategories(formatCategories), []);
  const proposalOptions = useMemo(() => createOptionsFromCategories(proposalCategories), []);
  const contextOptions = useMemo(() => createOptionsFromCategories(contextCategories), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("timePeriod", timePeriod);
      if (format) params.set("format", format);
      if (proposal) params.set("proposal", proposal);
      if (context) params.set("context", context);
      params.set("metric", metric === "rate" ? "engagement_rate" : "interactions");
      const res = await fetch(`/api/v1/platform/performance/time-distribution?${params.toString()}`);
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const json: TimePerformanceResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, format, proposal, context, metric]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCellValue = (day: number, block: string) => {
    const cell = data?.buckets.find(b => b.dayOfWeek === day && b.timeBlock === block);
    return cell ? cell.average : 0;
  };

  const maxValue = data?.buckets.reduce((max, c) => Math.max(max, c.average), 0) || 0;

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <h3 className="text-md font-semibold text-gray-700 mb-4">Análise de Performance por Horário</h3>
      {loading && <p className="text-center text-sm">Carregando...</p>}
      {error && <p className="text-center text-sm text-red-600">Erro: {error}</p>}
      {!loading && !error && data && (
        <div className="overflow-x-auto">
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            <select value={format} onChange={e => setFormat(e.target.value)} className="p-1 border rounded">
              <option value="">Todos Formatos</option>
              {formatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={proposal} onChange={e => setProposal(e.target.value)} className="p-1 border rounded">
              <option value="">Todas Propostas</option>
              {proposalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={context} onChange={e => setContext(e.target.value)} className="p-1 border rounded">
              <option value="">Todos Contextos</option>
              {contextOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={metric} onChange={e => setMetric(e.target.value)} className="p-1 border rounded">
              <option value="interactions">Volume de Engajamento</option>
              <option value="rate">Taxa de Engajamento</option>
            </select>
            <button onClick={fetchData} className="px-2 py-1 border rounded bg-gray-50">Aplicar</button>
          </div>
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
                  <p className="font-semibold mb-1">Top Horários:</p>
                  <ul className="list-disc list-inside">
                    {data.bestSlots.slice(0,3).map((s, i) => (
                      <li key={i}>{DAYS[s.dayOfWeek]} {s.timeBlock} - {s.average.toFixed(1)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.worstSlots.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Piores Horários:</p>
                  <ul className="list-disc list-inside">
                    {data.worstSlots.slice(0,3).map((s, i) => (
                      <li key={i}>{DAYS[s.dayOfWeek]} {s.timeBlock} - {s.average.toFixed(1)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.bestSlots[0] && (
                <p className="mt-2">Recomendação: priorize postagens em {DAYS[data.bestSlots[0].dayOfWeek]} {data.bestSlots[0].timeBlock}.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimePerformanceHeatmap;
