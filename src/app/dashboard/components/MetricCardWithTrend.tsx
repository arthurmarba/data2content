"use client";

import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

// Registra os módulos necessários
ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

export interface MetricCardWithTrendProps {
  label: string;
  value?: number | string;
  trendData?: number[];
  recommendation: string;
}

const MetricCardWithTrend: React.FC<MetricCardWithTrendProps> = ({
  label,
  value,
  trendData,
  recommendation,
}) => {
  // Se os dados de tendência não estiverem definidos, usa um array padrão
  const safeTrendData = trendData && trendData.length > 0 ? trendData : [0, 0, 0, 0, 0];
  const displayValue = value !== undefined ? value : safeTrendData[0] || "N/A";
  const safeLabel = label || "Sem Título";

  const isRising = Number(safeTrendData[safeTrendData.length - 1]) >= Number(safeTrendData[0]);
  const lineColor = isRising ? "rgba(16,185,129,1)" : "rgba(239,68,68,1)";

  const data = {
    labels: safeTrendData.map((_, i) => i.toString()),
    datasets: [
      {
        data: safeTrendData,
        borderColor: lineColor,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { display: false } },
  };

  return (
    <div className="bg-gray-50 rounded-lg shadow p-4 flex flex-col h-full cursor-pointer">
      <h3 className="text-base font-medium text-gray-800 mb-1">
        {safeLabel.replace(/([A-Z])/g, " $1")}
      </h3>
      <p className="text-3xl font-bold text-gray-700">{displayValue}</p>
      <div className="h-20 my-2">
        <Line data={data} options={options} />
      </div>
      <p className="text-sm text-gray-500">{recommendation}</p>
    </div>
  );
};

export default MetricCardWithTrend;
