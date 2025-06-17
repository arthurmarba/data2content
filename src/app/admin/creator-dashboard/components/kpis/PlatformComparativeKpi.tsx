"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PlatformKpiCard from '../PlatformKpiCard';

// Tipos de dados da API (espelhando a resposta do endpoint)
interface MiniChartDataPoint { // Adicionado para corresponder ao PlatformKpiCard
  name: string;
  value: number;
}

interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: MiniChartDataPoint[]; // Agora espera receber chartData
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
  title: string;
  comparisonPeriod: string;
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
  // const [insight, setInsight] = useState<string | undefined>(undefined); // Insight específico do KPI não usado por enquanto

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
        setKpiData(result[kpiName] as KPIComparisonData); // Cast para garantir que kpiData é do tipo esperado
        // if (result.insightSummary && result.insightSummary[kpiName]) {
        //   setInsight(result.insightSummary[kpiName]);
        // }
      } else {
        // Se kpiName for opcional (como platformPostingFrequency), não lançar erro se ausente
        if (kpiName === "platformPostingFrequency" && !result[kpiName]) {
            setKpiData(null); // Tratar como dados não disponíveis para este KPI opcional
            console.warn(`KPI '${kpiName}' não encontrado na resposta da API, mas é opcional.`);
        } else {
            throw new Error(`KPI '${kpiName}' não encontrado na resposta da API.`);
        }
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
    changeString = `${pc > 0 ? '+' : ''}${pc.toFixed(1)}% vs período anterior`;
    if (pc > 0.01) changeType = 'positive';
    else if (pc < -0.01) changeType = 'negative';
    else changeType = 'neutral';

  } else if (kpiData && kpiData.currentValue !== null && kpiData.previousValue !== null) {
    if (kpiData.currentValue > kpiData.previousValue) {
        changeString = "Aumento vs período anterior"; // Fallback se % não calculado
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
      value={kpiData?.currentValue ?? (loading ? null : 0)}
      isLoading={loading}
      error={error}
      tooltip={tooltip}
      change={changeString}
      changeType={changeType}
      chartData={kpiData?.chartData} // Passar chartData para o PlatformKpiCard
    />
  );
};

export default PlatformComparativeKpi;
```
