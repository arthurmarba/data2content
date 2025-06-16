"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PlatformKpiCard from '../PlatformKpiCard'; // Reutilizar o card de KPI

// Tipos de dados da API (espelhando a resposta do endpoint /users/{userId}/kpis/periodic-comparison)
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: any[]; // Para futuros mini-gráficos
}

interface UserPeriodicComparisonResponse {
  followerGrowth: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
  insightSummary?: {
    followerGrowth?: string;
    totalEngagement?: string;
    postingFrequency?: string;
  };
}

type UserKpiName = keyof Omit<UserPeriodicComparisonResponse, 'insightSummary'>; // "followerGrowth" | "totalEngagement" | "postingFrequency"


interface UserComparativeKpiProps {
  userId: string | null;
  kpiName: UserKpiName;
  title: string;
  comparisonPeriod: string; // Ex: "month_vs_previous", "last_7d_vs_previous_7d"
  tooltip?: string;
}

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
  // const [specificInsight, setSpecificInsight] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setKpiData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserPeriodicComparisonResponse = await response.json();

      if (result && result[kpiName]) {
        setKpiData(result[kpiName]);
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
  }, [userId, comparisonPeriod, kpiName]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setKpiData(null);
      setLoading(false);
    }
  }, [userId, fetchData]); // fetchData já tem comparisonPeriod e kpiName como dependências

  let changeString: string | null = null;
  let changeType: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (kpiData && kpiData.percentageChange !== null) {
    const pc = kpiData.percentageChange * 100; // API retorna decimal, ex: 0.10
    changeString = `${pc > 0 ? '+' : ''}${pc.toFixed(1)}% vs período anterior`;
    if (pc > 0.01) changeType = 'positive'; // Ligeira margem para evitar "positivo" em 0.0%
    else if (pc < -0.01) changeType = 'negative';// Ligeira margem
    else changeType = 'neutral';

  } else if (kpiData && kpiData.currentValue !== null && kpiData.previousValue !== null) {
    if (kpiData.currentValue > kpiData.previousValue) {
        changeString = "Aumento vs período anterior (anterior era 0 ou sem dados %)";
        changeType = 'positive';
    } else if (kpiData.currentValue < kpiData.previousValue) {
        changeString = "Redução vs período anterior";
        changeType = 'negative';
    } else if (kpiData.currentValue === kpiData.previousValue) {
        changeString = "Sem alteração vs período anterior";
        changeType = 'neutral';
    }
  }


  if (!userId && !loading) { // Não mostra nada se não houver ID e não estiver carregando
    return null;
  }

  return (
    <PlatformKpiCard // Reutilizando o mesmo card visual
      title={title}
      value={loading ? null : (kpiData?.currentValue ?? 0)} // Mostrar 0 se kpiData é null após carregar, ou null durante carregamento
      isLoading={loading}
      error={error}
      tooltip={tooltip}
      change={changeString}
      changeType={changeType}
      // chartData={kpiData?.chartData} // Para quando os mini-gráficos forem implementados no card
    />
  );
};

export default UserComparativeKpi;
```
