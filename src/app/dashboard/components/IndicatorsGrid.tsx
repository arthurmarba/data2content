"use client";

import React from "react";
import IndicatorCard from "./IndicatorCard";
import SkeletonCard from "./SkeletonCard";
import { useDashboard } from "./DashboardContext";

/**
 * Caso não tenha um local para definir esse tipo,
 * podemos defini-lo aqui mesmo:
 */
export interface MyLineChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }[];
}

/** Interface do "Indicator" */
interface Indicator {
  id?: string;
  title: string;
  value?: number | string;
  description?: string;
  recommendation?: string; // se a IA quiser fornecer
  chartData?: unknown; // <-- antes era unknown
}

/** Props do componente IndicatorsGrid */
interface IndicatorsGridProps {
  indicators: Indicator[];
}

/**
 * Formata "value" se for percentual.
 */
function formatIndicatorValue(
  title: string,
  rawValue: number | string | undefined
): string | number | undefined {
  if (rawValue === undefined || typeof rawValue === "string") {
    return rawValue;
  }

  const value = rawValue as number;

  const isLikelyPercentTitle = /taxa|razão|ratio|pct|porcent|engajamento|%/i.test(title);
  const isWithinPercentRange = value >= 0 && value <= 1000;

  if (isLikelyPercentTitle && isWithinPercentRange) {
    return value.toFixed(2) + "%";
  }

  return value;
}

/**
 * Tenta converter "unknown" para "MyLineChartData".
 * Se não conseguir, retorna undefined.
 */
function coerceToChartData(input: unknown): MyLineChartData | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }

  const obj = input as Partial<MyLineChartData>;
  if (!Array.isArray(obj.labels) || !Array.isArray(obj.datasets)) {
    return undefined;
  }

  // Poderíamos checar se obj.datasets[i].data é array de number, etc.
  // Mas para simplificar, retornamos "obj as MyLineChartData"
  return obj as MyLineChartData;
}

const IndicatorsGrid: React.FC<IndicatorsGridProps> = ({ indicators }) => {
  const { loading } = useDashboard();

  // Se estiver carregando, exibe skeletons
  if (loading) {
    const skeletonCount = 6;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Se não está carregando e não há indicadores
  if (!indicators || indicators.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum indicador disponível.</p>;
  }

  // Formata e converte chartData
  const finalIndicators = indicators.map((ind) => ({
    ...ind,
    value: formatIndicatorValue(ind.title, ind.value),
    chartData: coerceToChartData(ind.chartData),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {finalIndicators.map((ind, idx) => (
        <IndicatorCard
          key={ind.id || idx}
          title={ind.title}
          value={ind.value}
          description={ind.description}
          recommendation={ind.recommendation}
          chartData={ind.chartData} // agora tipado
        />
      ))}
    </div>
  );
};

export default IndicatorsGrid;
