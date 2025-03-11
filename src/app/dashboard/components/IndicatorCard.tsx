"use client"; // Indica que este arquivo é um Client Component

import React from "react";
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

// Registra os componentes do chart.js que serão usados
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/**
 * Tipagem para o chartData do gráfico de linha.
 * O 'Line' exige um objeto do tipo ChartData<"line", number[], string>.
 */
type MyLineChartData = ChartData<"line", number[], string>;

interface IndicatorCardProps {
  title: string;
  value?: number | string;
  description?: string;
  recommendation?: string;

  /**
   * chartData agora é opcional, mas se vier, deve ser do tipo MyLineChartData.
   */
  chartData?: MyLineChartData;
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({
  title,
  value,
  description,
  recommendation,
  chartData,
}) => {
  /**
   * Verifica se há dados suficientes para exibir o gráfico.
   * Utilizamos nullish coalescing para fornecer arrays vazios se algum dos campos for undefined.
   */
  const hasChart =
    ((chartData?.labels ?? []).length > 0) &&
    ((chartData?.datasets ?? []).length > 0) &&
    (((chartData?.datasets ?? [])[0]?.data ?? []).length > 0);

  return (
    <div
      className="
        bg-white/90
        backdrop-blur-md
        border border-gray-200
        rounded-2xl
        shadow-sm
        p-4
        flex
        flex-col
        h-full
      "
    >
      {/* Título */}
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>

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

      {/* Gráfico (somente se hasChart for true) */}
      {hasChart ? (
        <div className="my-2 h-24">
          <Line
            data={chartData!} // usamos "!" para indicar ao TS que não é undefined
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
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
