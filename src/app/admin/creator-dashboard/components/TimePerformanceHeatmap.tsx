"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";

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

const TimePerformanceHeatmap: React.FC<Props> = ({ formatFilter }) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<TimePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("timePeriod", timePeriod);
      if (formatFilter) params.set("format", formatFilter);
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
  }, [timePeriod, formatFilter]);

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
          {data.bestSlots.length > 0 && (
            <div className="mt-4 text-left text-xs">
              <p className="font-semibold mb-1">Top Horários:</p>
              <ul className="list-disc list-inside">
                {data.bestSlots.slice(0,3).map((s, i) => (
                  <li key={i}>{DAYS[s.dayOfWeek]} {s.timeBlock} - {s.average.toFixed(1)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimePerformanceHeatmap;
