"use client";

import React from "react";
import IndicatorCard from "./IndicatorCard";
import SkeletonCard from "./SkeletonCard";
import { useDashboard } from "./DashboardContext";

interface Indicator {
  id?: string;
  title: string;
  value?: number | string;
  description?: string;
  recommendation?: string; // se a IA quiser fornecer
  chartData?: any;
}

interface IndicatorsGridProps {
  indicators: Indicator[];
}

// Função auxiliar para formatar o "value" se for porcentagem
function formatIndicatorValue(title: string, rawValue: number | string | undefined): string | number | undefined {
  if (rawValue === undefined || typeof rawValue === "string") {
    // Se já for string (ex. "42.50%") ou undefined, não mexe
    return rawValue;
  }

  // Agora, rawValue é um number
  const value = rawValue as number;

  // Exemplo de detecção: se title contiver "Taxa", "Razão", "Engajamento", "Ratio", "Pct", etc.
  // E se o valor estiver entre 0 e 1000, assumimos que é percent.
  // Ajuste conforme sua realidade (ex.: <= 100 se vc NUNCA ultrapassa 100%).
  const isLikelyPercentTitle = /taxa|razão|ratio|pct|porcent|engajamento|%/i.test(title);
  const isWithinPercentRange = (value >= 0 && value <= 1000);

  if (isLikelyPercentTitle && isWithinPercentRange) {
    // Exibe com 2 casas decimais + '%'
    return value.toFixed(2) + "%";
  }

  // Senão, retorna o valor como está
  return value;
}

const IndicatorsGrid: React.FC<IndicatorsGridProps> = ({ indicators }) => {
  const { loading } = useDashboard();

  // Se estiver carregando, exibe skeletons
  if (loading) {
    const skeletonCount = 6; // ou 12, como preferir
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
    return (
      <p className="text-sm text-gray-500">
        Nenhum indicador disponível.
      </p>
    );
  }

  // Aqui, mapeamos cada indicador e formatamos o "value" se for percentual
  const finalIndicators = indicators.map((ind, idx) => {
    return {
      ...ind,
      value: formatIndicatorValue(ind.title, ind.value),
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {finalIndicators.map((ind, idx) => (
        <IndicatorCard
          key={ind.id || idx} // se a IA não enviar "id", use idx
          title={ind.title}
          value={ind.value}
          description={ind.description}
          recommendation={ind.recommendation}
          chartData={ind.chartData}
        />
      ))}
    </div>
  );
};

export default IndicatorsGrid;
