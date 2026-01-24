"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
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
  platformActiveCreators?: KPIComparisonData;
  insightSummary?: {
    platformFollowerGrowth?: string;
    platformTotalEngagement?: string;
    platformPostingFrequency?: string;
    platformActiveCreators?: string;
  };
}

type KpiName =
  | "platformFollowerGrowth"
  | "platformTotalEngagement"
  | "platformPostingFrequency"
  | "platformActiveCreators";

interface PlatformComparativeKpiProps {
  kpiName: KpiName;
  title: string;
  comparisonPeriod: string;
  tooltip?: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
  dataOverride?: KPIComparisonData | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}

const PlatformComparativeKpi: React.FC<PlatformComparativeKpiProps> = ({
  kpiName,
  title,
  comparisonPeriod,
  tooltip,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
  dataOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const [kpiData, setKpiData] = useState<KPIComparisonData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // const [insight, setInsight] = useState<string | undefined>(undefined); // Insight específico do KPI não usado por enquanto
  const hasOverride = Boolean(disableFetch)
    || typeof dataOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ comparisonPeriod });
      if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
      if (contextFilter) params.append('context', contextFilter);
      if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
      const apiUrl = `${apiPrefix}/dashboard/platform-kpis/periodic-comparison?${params.toString()}`;
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
  }, [comparisonPeriod, kpiName, apiPrefix, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  useEffect(() => {
    if (hasOverride) {
      return;
    }
    fetchData();
  }, [fetchData, hasOverride]);

  const finalData = hasOverride ? (dataOverride ?? null) : kpiData;
  const finalLoading = hasOverride ? (loadingOverride ?? false) : loading;
  const finalError = hasOverride ? (errorOverride ?? null) : error;

  let changeString: string | null = null;
  let changeType: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (finalData && finalData.percentageChange !== null) {
    const pc = finalData.percentageChange * 100;
    changeString = `${pc > 0 ? '+' : ''}${pc.toFixed(1)}% vs período anterior`;
    if (pc > 0.01) changeType = 'positive';
    else if (pc < -0.01) changeType = 'negative';
    else changeType = 'neutral';

  } else if (finalData && finalData.currentValue !== null && finalData.previousValue !== null) {
    if (finalData.currentValue > finalData.previousValue) {
        changeString = "Aumento vs período anterior"; // Fallback se % não calculado
        changeType = 'positive';
    } else if (finalData.currentValue < finalData.previousValue) {
        changeString = "Redução vs período anterior";
        changeType = 'negative';
    } else if (finalData.currentValue === finalData.previousValue) {
        changeString = "Sem alteração vs período anterior";
        changeType = 'neutral';
    }
  }


  return (
    <PlatformKpiCard
      title={title}
      value={finalData?.currentValue ?? (finalLoading ? null : 0)}
      isLoading={finalLoading}
      error={finalError}
      tooltip={tooltip}
      change={changeString}
      changeType={changeType}
      chartData={finalData?.chartData} // Passar chartData para o PlatformKpiCard
    />
  );
};

export default memo(PlatformComparativeKpi);
