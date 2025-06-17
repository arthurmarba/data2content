"use client";

import React, { useState } from 'react';

// User-specific charts & metrics
import UserFollowerTrendChart from '../UserFollowerTrendChart';
import UserReachEngagementTrendChart from '../UserReachEngagementTrendChart';
import UserMovingAverageEngagementChart from '../UserMovingAverageEngagementChart';
import UserAverageEngagementChart from '../UserAverageEngagementChart';
import UserEngagementDistributionChart from '../UserEngagementDistributionChart';
import UserVideoPerformanceMetrics from '../UserVideoPerformanceMetrics';
import UserMonthlyEngagementStackedChart from '../UserMonthlyEngagementStackedChart';
import UserPerformanceHighlights from '../UserPerformanceHighlights';

// User-specific components from Módulo 3 (Creator Detail)
import UserRadarChartComparison from '../UserRadarChartComparison';
import UserAlertsWidget from '../widgets/UserAlertsWidget';
import UserComparativeKpi from '../kpis/UserComparativeKpi';


interface UserDetailViewProps {
  userId: string | null;
  userName?: string;
  // Nova prop para o período inicial dos gráficos/componentes internos
  initialChartsTimePeriod?: string;
}

const KPI_COMPARISON_PERIOD_OPTIONS = [
  { value: "month_vs_previous", label: "Mês vs. Anterior" },
  { value: "last_7d_vs_previous_7d", label: "7d vs. 7d Anteriores" },
  { value: "last_30d_vs_previous_30d", label: "30d vs. 30d Anteriores" },
];


const UserDetailView: React.FC<UserDetailViewProps> = ({
    userId,
    userName,
    initialChartsTimePeriod // Usar este para os componentes filhos
}) => {
  const [kpiComparisonPeriod, setKpiComparisonPeriod] = useState<string>(KPI_COMPARISON_PERIOD_OPTIONS[0].value);

  if (!userId) {
    return (
      <div className="p-4 md:p-6 text-center text-gray-500">
        Selecione um criador para visualizar seus detalhes.
      </div>
    );
  }

  const displayName = userName || `Criador ID: ${userId.substring(0,8)}...`;

  // Se initialChartsTimePeriod não for fornecido, os componentes filhos usarão seus próprios defaults.
  // Se fornecido, será usado como o valor inicial para os seletores de período dos componentes filhos.

  return (
    <div className="p-1 md:p-2 mt-8 border-t-2 border-indigo-500 pt-6">
      <header className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-indigo-700">
          Análise Detalhada: {displayName}
        </h2>
        {/*
          Aqui poderia ir um seletor de período GERAL para TODOS os componentes dentro de UserDetailView,
          similar ao GlobalTimePeriodFilter da página principal. Se implementado, ele controlaria
          o `initialChartsTimePeriod` passado para os filhos, ou diretamente uma prop `timePeriod` para eles.
          Por enquanto, cada componente filho (gráficos de tendência, etc.) tem seu próprio seletor
          e usará `initialChartsTimePeriod` para seu estado inicial.
        */}
      </header>

      {/* Seção de KPIs Comparativos do Criador */}
      <section id={`user-kpis-${userId}`} className="mb-10">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-700 pb-2">
            Desempenho Comparativo Chave
            </h3>
            <div>
                <label htmlFor={`kpiComparisonPeriod-${userId}`} className="sr-only">Período de Comparação</label>
                <select
                    id={`kpiComparisonPeriod-${userId}`}
                    value={kpiComparisonPeriod}
                    onChange={(e) => setKpiComparisonPeriod(e.target.value)}
                    className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                >
                    {KPI_COMPARISON_PERIOD_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <UserComparativeKpi userId={userId} kpiName="followerGrowth" title="Crescimento de Seguidores" comparisonPeriod={kpiComparisonPeriod} tooltip="Variação no ganho de seguidores em relação ao período anterior equivalente." />
            <UserComparativeKpi userId={userId} kpiName="totalEngagement" title="Engajamento Total" comparisonPeriod={kpiComparisonPeriod} tooltip="Variação no total de interações em relação ao período anterior equivalente."/>
            <UserComparativeKpi userId={userId} kpiName="postingFrequency" title="Frequência de Postagem" comparisonPeriod={kpiComparisonPeriod} tooltip="Variação na frequência semanal de postagens em relação ao período anterior equivalente."/>
        </div>
      </section>

      <section id={`user-performance-highlights-${userId}`} className="mb-10">
        <UserPerformanceHighlights userId={userId} sectionTitle="Destaques de Performance" initialTimePeriod={initialChartsTimePeriod} />
      </section>

      <section id={`user-advanced-analysis-${userId}`} className="mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-300">
          Análise Avançada e Alertas
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UserRadarChartComparison profile1UserId={userId} chartTitle="Radar Comparativo de Performance"/>
            <UserAlertsWidget userId={userId} />
        </div>
      </section>

      <section id={`user-trends-${userId}`} className="mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-300">
          Tendências da Conta
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserFollowerTrendChart userId={userId} chartTitle="Evolução de Seguidores" initialTimePeriod={initialChartsTimePeriod} />
          <UserReachEngagementTrendChart userId={userId} chartTitle="Alcance e Contas Engajadas" initialTimePeriod={initialChartsTimePeriod} />
        </div>
        <div className="grid grid-cols-1 gap-6">
          {/* UserMovingAverageEngagementChart precisa de initialDataWindow e initialAvgWindow */}
          <UserMovingAverageEngagementChart userId={userId} chartTitle="Média Móvel de Engajamento Diário" initialTimePeriod={initialChartsTimePeriod} />
        </div>
      </section>

      <section id={`user-content-performance-${userId}`} className="mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-300">
          Performance de Conteúdo
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserAverageEngagementChart userId={userId} groupBy="format" chartTitle="Engajamento Médio por Formato" initialTimePeriod={initialChartsTimePeriod} />
          <UserAverageEngagementChart userId={userId} groupBy="context" chartTitle="Engajamento Médio por Contexto" initialTimePeriod={initialChartsTimePeriod} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <UserEngagementDistributionChart userId={userId} chartTitle="Distribuição de Engajamento por Formato" initialTimePeriod={initialChartsTimePeriod} />
            <UserVideoPerformanceMetrics userId={userId} chartTitle="Performance de Vídeos" initialTimePeriod={initialChartsTimePeriod} />
        </div>
         <div className="grid grid-cols-1 gap-6">
            <UserMonthlyEngagementStackedChart userId={userId} chartTitle="Engajamento Mensal Detalhado" initialTimePeriod={initialChartsTimePeriod} />
        </div>
      </section>

    </div>
  );
};

export default React.memo(UserDetailView);
```
