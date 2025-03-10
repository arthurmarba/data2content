"use client";

import React, { FC } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/**
 * Se quiser permitir cores personalizadas,
 * defina abaixo ou no ChartDataSet.
 */
interface ChartDataSet {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
}

/**
 * MyLineChartData:
 * Estende ChartData<"line"> mas reforça que labels e datasets
 * sejam arrays de string e ChartDataSet, respectivamente.
 */
interface MyLineChartData extends ChartData<"line", number[], string> {
  labels: string[];
  datasets: ChartDataSet[];
}

interface IndicatorCardProps {
  title: string;
  value?: number | string;
  description?: string;
  recommendation?: string;

  /**
   * chartData pode estar ausente (undefined),
   * ou então seguir o formato MyLineChartData.
   */
  chartData?: MyLineChartData;
}

const IndicatorCard: FC<IndicatorCardProps> = ({
  title,
  value,
  description,
  recommendation,
  chartData,
}) => {
  /**
   * Verifica se chartData realmente existe
   * e tem pelo menos 1 label e 1 dataset com dados.
   */
  const hasChart = Boolean(
    chartData &&
    Array.isArray(chartData.labels) &&
    chartData.labels.length > 0 &&
    Array.isArray(chartData.datasets) &&
    chartData.datasets.length > 0 &&
    Array.isArray(chartData.datasets[0].data) &&
    chartData.datasets[0].data.length > 0
  );

  return (
    <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-col h-full">
      {/* Título */}
      <h3 className="text-sm font-semibold text-gray-800 mb-1">
        {title}
      </h3>

      {/* Valor principal */}
      {value !== undefined && (
        <div className={`${hasChart ? "text-3xl" : "text-4xl"} font-bold text-gray-900 mb-2`}>
          {value}
        </div>
      )}

      {/* Descrição */}
      {description && (
        <p className="text-xs text-gray-600 mb-2 whitespace-pre-line">
          {description}
        </p>
      )}

      {/* Gráfico (se há dados suficientes) */}
      {hasChart ? (
        <div className="my-2 h-24">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
              },
              scales: {
                x: { display: false },
                y: { display: false },
              },
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Nenhum histórico disponível
        </div>
      )}

      {/* Recomendações (se houver) */}
      {recommendation && (
        <p className="text-xs text-gray-500 italic mt-auto">
          {recommendation}
        </p>
      )}
    </div>
  );
};

export default IndicatorCard;
