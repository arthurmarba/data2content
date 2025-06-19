"use client";

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartData,
  ChartDataset,
} from "chart.js";
import { useSession } from "next-auth/react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface HistoryEntry {
  labels: string[];
  datasets: { label: string; data: number[]; borderColor?: string; backgroundColor?: string }[];
}

interface MetricsHistoryResponse {
  history: Record<string, HistoryEntry>;
}

const AVAILABLE_METRICS = [
  { key: "engagementRate", label: "Taxa de Engajamento" },
  { key: "propagationIndex", label: "Índice de Propagação" },
  { key: "likeCommentRatio", label: "Razão Like/Comentário" },
  { key: "saveRateOnReach", label: "Taxa de Salvamento" },
  { key: "followerConversionRate", label: "Conversão de Seguidores" },
  { key: "retentionRate", label: "Taxa de Retenção" },
  { key: "engagementDeepVsReach", label: "Engajamento Profundo/Alcance" },
  { key: "engagementFastVsReach", label: "Engajamento Rápido/Alcance" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
];

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#0ea5e9",
  "#84cc16",
  "#f97316",
];

interface AdvancedMetricsHistoryChartProps {
  days?: number;
}

const AdvancedMetricsHistoryChart: React.FC<AdvancedMetricsHistoryChartProps> = ({ days = 30 }) => {
  const { data: session } = useSession();
  const [history, setHistory] = useState<Record<string, HistoryEntry>>({});
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["engagementRate"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const userId = (session?.user as { id?: string } | undefined)?.id;
      if (!userId) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/metricsHistory?userId=${userId}&days=${days}`);
        if (!res.ok) throw new Error(`Erro ao buscar histórico: ${res.status}`);
        const data: MetricsHistoryResponse = await res.json();
        setHistory(data.history || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [session?.user, days]);

  const labels = Object.values(history)[0]?.labels || [];

  const datasets: ChartDataset<"line", number[]>[] = selectedMetrics.flatMap((metricKey, idx) => {
    const entry = history[metricKey];
    if (!entry || !entry.datasets || entry.datasets.length === 0) {
        return [];
    }
    
    // CORREÇÃO: Adicionada uma verificação para garantir que 'ds' não é indefinido.
    const ds = entry.datasets[0];
    if (!ds) {
        return [];
    }

    return [
      {
        ...ds,
        borderColor: ds.borderColor || COLORS[idx % COLORS.length],
        backgroundColor: ds.backgroundColor || COLORS[idx % COLORS.length] + "33",
        fill: false,
      },
    ];
  });

  const chartData: ChartData<"line", number[], string> = { labels, datasets };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex flex-wrap gap-3 mb-4">
        {AVAILABLE_METRICS.map((m) => (
          <label key={m.key} className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              className="mr-1"
              checked={selectedMetrics.includes(m.key)}
              onChange={() => toggleMetric(m.key)}
            />
            {m.label}
          </label>
        ))}
      </div>

      <div className="relative" style={{ height: 300 }}>
        {loading && <p className="text-center text-sm text-gray-500">Carregando...</p>}
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        {!loading && !error && datasets.length > 0 && (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: true } },
            }}
          />
        )}
        {!loading && !error && datasets.length === 0 && (
          <p className="text-center text-sm text-gray-500">Nenhum dado selecionado.</p>
        )}
      </div>
    </div>
  );
};

export default AdvancedMetricsHistoryChart;
