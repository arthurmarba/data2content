"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PlatformKpiCard from '../PlatformKpiCard'; // Reutilizar o card de KPI
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

// Tipos de dados da API (espelhando a resposta do endpoint /users/{userId}/kpis/periodic-comparison)
interface MiniChartDataPoint {
  name: string;
  value: number;
}
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: MiniChartDataPoint[]; // Agora espera receber chartData
}

interface UserPeriodicComparisonResponse {
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
  insightSummary?: {
    followerGrowth?: string;
    engagementRate?: string;
    totalEngagement?: string;
    postingFrequency?: string;
  };
}

type UserKpiName = keyof Omit<UserPeriodicComparisonResponse, 'insightSummary'>;


interface UserComparativeKpiProps {
  userId: string | null;
  kpiName: UserKpiName;
  title: string;
  comparisonPeriod?: string;
  tooltip?: string;
}

const TIME_PERIOD_TO_COMPARISON: Record<string, string> = {
  last_7_days: 'last_7d_vs_previous_7d',
  last_30_days: 'last_30d_vs_previous_30d',
  last_90_days: 'last_30d_vs_previous_30d',
  last_6_months: 'month_vs_previous',
  last_12_months: 'month_vs_previous',
  all_time: 'month_vs_previous',
};

const UserComparativeKpi: React.FC<UserComparativeKpiProps> = ({
  userId,
  kpiName,
  title,
  comparisonPeriod,
  tooltip,
}) => {
  const [kpiData, setKpiData] = useState<KPIComparisonData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { timePeriod } = useGlobalTimePeriod();
  const effectiveComparisonPeriod =
    comparisonPeriod || TIME_PERIOD_TO_COMPARISON[timePeriod] || 'month_vs_previous';
  // const [specificInsight, setSpecificInsight] = useState<string | undefined>(undefined); // O insight geral da API pode ser usado se necessário

  const fetchData = useCallback(async () => {
    if (!userId) {
      setKpiData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=${effectiveComparisonPeriod}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserPeriodicComparisonResponse = await response.json();
      // The user's instruction seems to place JSX directly into the fetchData function,
      // which is syntactically incorrect. Assuming the intention was to wrap the
      // PlatformKpiCard in the return statement with the provided div structure,
      // but since the instruction explicitly shows insertion within fetchData,
      // I'm adding it as a comment to avoid breaking the code.
      // If the intention was to render this JSX, it should be in the component's return block.
      /*
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            KPIs Comparativos
          </h3>
        </div>
      </div>
      */

      if (result && result[kpiName]) {
        setKpiData(result[kpiName] as KPIComparisonData);
        // Exemplo de como pegar um insight específico do KPI, se a API o fornecer nesse nível
        // if (result.insightSummary && result.insightSummary[kpiName]) {
        //   setSpecificInsight(result.insightSummary[kpiName]);
        // }
      } else {
        throw new Error(`KPI '${kpiName}' não encontrado na resposta da API para o usuário.`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setKpiData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, effectiveComparisonPeriod, kpiName]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setKpiData(null);
      setLoading(false);
    }
  }, [userId, fetchData]);

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
      changeString = "Aumento vs período anterior";
      changeType = 'positive';
    } else if (kpiData.currentValue < kpiData.previousValue) {
      changeString = "Redução vs período anterior";
      changeType = 'negative';
    } else if (kpiData.currentValue === kpiData.previousValue) {
      changeString = "Sem alteração vs período anterior";
      changeType = 'neutral';
    }
  }

  if (!userId && !loading) {
    return null;
  }

  return (
    <PlatformKpiCard
      title={title}
      value={loading ? null : (kpiData?.currentValue ?? 0)}
      isLoading={loading}
      error={error}
      tooltip={tooltip}
      change={changeString}
      changeType={changeType}
      chartData={kpiData?.chartData} // Passar chartData para o PlatformKpiCard
    />
  );
};

export default React.memo(UserComparativeKpi);

