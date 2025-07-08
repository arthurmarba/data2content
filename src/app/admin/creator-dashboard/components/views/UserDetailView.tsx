"use client";

import React, { useState } from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import GlobalTimePeriodFilter from "../filters/GlobalTimePeriodFilter";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";

// User-specific charts & metrics
import UserFollowerChangeChart from "../UserFollowerChangeChart";
import UserReachEngagementTrendChart from "../UserReachEngagementTrendChart";
import UserMovingAverageEngagementChart from "../UserMovingAverageEngagementChart";
import UserVideoPerformanceMetrics from "../UserVideoPerformanceMetrics";
import UserMonthlyEngagementStackedChart from "../UserMonthlyEngagementStackedChart";
import UserMonthlyComparisonChart from "../UserMonthlyComparisonChart";
import UserPerformanceHighlights from "../UserPerformanceHighlights";
import TimePerformanceHeatmap from "../TimePerformanceHeatmap";

// User-specific components from Módulo 3 (Creator Detail)
import UserAlertsWidget from "../widgets/UserAlertsWidget";
import UserComparativeKpi from "../kpis/UserComparativeKpi";

interface UserDetailViewProps {
  userId: string | null;
  userName?: string;
}

const KPI_COMPARISON_PERIOD_OPTIONS = [
  { value: "month_vs_previous", label: "Mês vs. Anterior" },
  { value: "last_7d_vs_previous_7d", label: "7d vs. 7d Anteriores" },
  { value: "last_30d_vs_previous_30d", label: "30d vs. 30d Anteriores" },
];

const UserDetailView: React.FC<UserDetailViewProps> = ({
  userId,
  userName,
}) => {
  const [kpiComparisonPeriod, setKpiComparisonPeriod] = useState<string>(
    KPI_COMPARISON_PERIOD_OPTIONS[0]!.value,
  );
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } =
    useGlobalTimePeriod();

  if (!userId) {
    return (
      <div className="p-4 md:p-6 text-center text-gray-500">
        Selecione um criador para visualizar seus detalhes.
      </div>
    );
  }

  const displayName = userName || `Criador ID: ${userId.substring(0, 8)}...`;

  // Os gráficos internos leem o período global via contexto,
  // portanto são atualizados automaticamente quando o filtro principal muda.

  return (
    <div className="p-1 md:p-2 mt-8 border-t-2 border-indigo-500 pt-6">
      <header className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-indigo-700 flex items-center gap-2">
          Análise Detalhada: {displayName} <GlobalPeriodIndicator />
        </h2>
        <nav className="mt-4">
          <ul className="flex flex-wrap gap-4 text-sm font-medium text-indigo-600">
            <li>
              <a href={`#user-kpis-${userId}`} className="hover:underline">
                Geral
              </a>
            </li>
            <li>
              <a href={`#user-performance-highlights-${userId}`} className="hover:underline">
                Destaques
              </a>
            </li>
            <li>
              <a href={`#user-content-performance-${userId}`} className="hover:underline">
                Conteúdo
              </a>
            </li>
            <li>
              <a href={`#user-advanced-analysis-${userId}`} className="hover:underline">
                Análise & Alertas
              </a>
            </li>
            <li>
              <a href={`#user-trends-${userId}`} className="hover:underline">
                Tendências
              </a>
            </li>
          </ul>
        </nav>
        {/*
          Seletor de período local que afeta todos os gráficos abaixo.
          Os componentes usam o período global como valor inicial e respondem às mudanças deste filtro.
        */}
        <div className="mt-4">
          <GlobalTimePeriodFilter
            selectedTimePeriod={globalTimePeriod}
            onTimePeriodChange={setGlobalTimePeriod}
          />
        </div>
      </header>

      {/* Seção de KPIs Comparativos do Criador */}
      <section id={`user-kpis-${userId}`} className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-700 pb-2">
            Desempenho Comparativo Chave
          </h3>
          <div className="flex items-center gap-2">
            <label
              htmlFor={`kpiComparisonPeriod-${userId}`}
              className="text-xs font-medium text-gray-600"
            >
              Comparar:
            </label>
            <select
              id={`kpiComparisonPeriod-${userId}`}
              value={kpiComparisonPeriod}
              onChange={(e) => setKpiComparisonPeriod(e.target.value)}
              className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
            >
              {KPI_COMPARISON_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <UserComparativeKpi
            userId={userId}
            kpiName="followerGrowth"
            title="Crescimento de Seguidores"
            comparisonPeriod={kpiComparisonPeriod}
            tooltip="Variação no ganho de seguidores em relação ao período anterior equivalente."
          />
          <UserComparativeKpi
            userId={userId}
            kpiName="totalEngagement"
            title="Engajamento Total"
            comparisonPeriod={kpiComparisonPeriod}
            tooltip="Variação no total de interações em relação ao período anterior equivalente."
          />
          <UserComparativeKpi
            userId={userId}
            kpiName="postingFrequency"
            title="Frequência de Postagem"
            comparisonPeriod={kpiComparisonPeriod}
            tooltip="Variação na frequência semanal de postagens em relação ao período anterior equivalente."
          />
        </div>
      </section>

      <section id={`user-performance-highlights-${userId}`} className="mb-10">
        <UserPerformanceHighlights
          userId={userId}
          sectionTitle="Destaques de Performance"
        />
        <div className="mt-6">
          <TimePerformanceHeatmap userId={userId} />
        </div>
      </section>

      <section id={`user-content-performance-${userId}`} className="mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-300">
          Performance de Conteúdo
        </h3>
        <div className="grid grid-cols-1 gap-6 mb-6">
          <UserVideoPerformanceMetrics userId={userId} chartTitle="Performance de Vídeos" />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <UserMonthlyEngagementStackedChart userId={userId} chartTitle="Engajamento Mensal Detalhado" />
          <UserMonthlyComparisonChart userId={userId} chartTitle="Comparação Mensal" />
        </div>
      </section>

      <section id={`user-advanced-analysis-${userId}`} className="mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-300">
          Análise Avançada e Alertas
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UserAlertsWidget userId={userId} />
        </div>
      </section>

      <section id={`user-trends-${userId}`} className="mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-300">
          Tendências da Conta
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserFollowerChangeChart
            userId={userId}
            chartTitle="Variação Diária de Seguidores"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserReachEngagementTrendChart
            userId={userId}
            chartTitle="Alcance e Contas Engajadas"
          />
          <UserMovingAverageEngagementChart
            userId={userId}
            chartTitle="Média Móvel de Engajamento Diário"
          />
        </div>
      </section>

    </div>
  );
};

export default React.memo(UserDetailView);
