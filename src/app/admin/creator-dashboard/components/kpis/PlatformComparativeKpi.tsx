"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PlatformKpiCard from '../PlatformKpiCard'; // Ajuste o caminho

// Tipos de dados da API (espelhando a resposta do endpoint)
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  // chartData?: any[]; // Para futuros mini-gráficos
}

interface PlatformPeriodicComparisonResponse {
  platformFollowerGrowth: KPIComparisonData;
  platformTotalEngagement: KPIComparisonData;
  platformPostingFrequency?: KPIComparisonData;
  insightSummary?: {
    platformFollowerGrowth?: string;
    platformTotalEngagement?: string;
    platformPostingFrequency?: string;
  };
}

type KpiName = "platformFollowerGrowth" | "platformTotalEngagement" | "platformPostingFrequency";

interface PlatformComparativeKpiProps {
  kpiName: KpiName;
  title: string; // Título para o card, ex: "Crescimento de Seguidores (Plataforma)"
  comparisonPeriod: string; // Ex: "month_vs_previous", "last_7d_vs_previous_7d"
  tooltip?: string;
}

const PlatformComparativeKpi: React.FC<PlatformComparativeKpiProps> = ({
  kpiName,
  title,
  comparisonPeriod,
  tooltip,
}) => {
  const [kpiData, setKpiData] = useState<KPIComparisonData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // const [insight, setInsight] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/platform/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformPeriodicComparisonResponse = await response.json();

      if (result && result[kpiName]) {
        setKpiData(result[kpiName]);
        // if (result.insightSummary && result.insightSummary[kpiName]) {
        //   setInsight(result.insightSummary[kpiName]);
        // }
      } else {
        throw new Error(`KPI '${kpiName}' não encontrado na resposta da API.`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setKpiData(null);
    } finally {
      setLoading(false);
    }
  }, [comparisonPeriod, kpiName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  let changeString: string | null = null;
  let changeType: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (kpiData && kpiData.percentageChange !== null) {
    const pc = kpiData.percentageChange * 100;
    changeString = `${pc.toFixed(1)}% vs período anterior`;
    if (pc > 0) changeType = 'positive';
    else if (pc < 0) changeType = 'negative';
  } else if (kpiData && kpiData.currentValue !== null && kpiData.previousValue !== null) {
    // Caso onde percentageChange é null, mas temos valores (ex: previousValue era 0)
    if (kpiData.currentValue > kpiData.previousValue) {
        changeString = "Aumento vs período anterior (anterior era 0)";
        changeType = 'positive';
    } else if (kpiData.currentValue < kpiData.previousValue) {
        changeString = "Redução vs período anterior";
        changeType = 'negative';
    } else if (kpiData.currentValue === kpiData.previousValue) {
        changeString = "Sem alteração vs período anterior";
        changeType = 'neutral';
    }
  }


  return (
    <PlatformKpiCard
      title={title}
      value={kpiData?.currentValue ?? (loading ? null : 0)} // Mostrar 0 se não estiver carregando e for null
      isLoading={loading}
      error={error}
      tooltip={tooltip}
      change={changeString}
      changeType={changeType}
      // chartData={kpiData?.chartData} // Para quando os mini-gráficos forem implementados
    />
  );
};

export default PlatformComparativeKpi;
```
