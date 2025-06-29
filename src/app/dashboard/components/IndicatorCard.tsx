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
 */
type MyLineChartData = ChartData<"line", number[], string>;

interface IndicatorCardProps {
  title: string;
  value?: number | string;
  description?: string;
  recommendation?: string;
  chartData?: MyLineChartData;
  // CORREÇÃO: Adicionada a propriedade 'icon' como opcional.
  // O tipo React.ReactNode permite passar componentes JSX, como <FaStar />.
  icon?: React.ReactNode;
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({
  title,
  value,
  description,
  recommendation,
  chartData,
  // CORREÇÃO: Recebendo a nova prop 'icon'
  icon,
}) => {
  const hasChart =
    ((chartData?.labels ?? []).length > 0) &&
    ((chartData?.datasets ?? []).length > 0) &&
    (((chartData?.datasets ?? [])[0]?.data ?? []).length > 0);

  return (
    <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col h-full">
      {/* CORREÇÃO: Título agora é um container flex para abrigar o ícone */}
      <div className="flex items-center gap-2 text-gray-700 mb-2">
        {icon && <span className="flex-shrink-0 w-5 h-5">{icon}</span>}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      {/* Valor principal */}
      {value !== undefined && (
        <div className={`text-3xl font-bold text-gray-900 mb-2`}>
          {value}
        </div>
      )}

      {/* Descrição */}
      {description && (
        <p className="text-xs text-gray-600 mb-2 whitespace-pre-line">
          {description}
        </p>
      )}

      {/* Gráfico (se existir) */}
      {hasChart && (
        <div className="my-2 h-24">
          <Line
            data={chartData!}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { x: { display: false }, y: { display: false } },
            }}
          />
        </div>
      )}
      
      {/* Se não houver gráfico nem descrição, adiciona um espaço para manter a altura */}
      {!hasChart && !description && <div className="flex-grow"></div>}

      {/* Recomendações (se houver) */}
      {recommendation && (
        <p className="text-xs text-gray-500 italic mt-auto pt-2">
          {recommendation}
        </p>
      )}
    </div>
  );
};

export default IndicatorCard;