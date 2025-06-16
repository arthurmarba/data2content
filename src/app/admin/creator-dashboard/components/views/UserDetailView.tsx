"use client";

import React from 'react';

// User-specific charts from Módulo 2 (Creator Detail)
import UserFollowerTrendChart from '../UserFollowerTrendChart';
import UserReachEngagementTrendChart from '../UserReachEngagementTrendChart';
import UserMovingAverageEngagementChart from '../UserMovingAverageEngagementChart';
import UserAverageEngagementChart from '../UserAverageEngagementChart'; // For format & context
import UserEngagementDistributionChart from '../UserEngagementDistributionChart';

// User-specific components from Módulo 3 (Creator Detail)
import UserRadarChartComparison from '../UserRadarChartComparison';
import UserAlertsWidget from '../widgets/UserAlertsWidget';


interface UserDetailViewProps {
  userId: string | null;
  userName?: string;
}

const UserDetailView: React.FC<UserDetailViewProps> = ({
    userId,
    userName
}) => {
  if (!userId) {
    return (
      <div className="p-4 md:p-6 text-center text-gray-500">
        Selecione um criador para visualizar seus detalhes.
      </div>
    );
  }

  const displayName = userName || `Criador ID: ${userId.substring(0,8)}...`;

  return (
    <div className="p-1 md:p-2 mt-8 border-t border-gray-300 pt-6"> {/* Adicionado espaçamento e borda */}
      <header className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          Análise Detalhada: {displayName}
        </h2>
      </header>

      {/* Seção de Alertas e Comparação (Módulo 3) */}
      <section id={`user-advanced-analysis-${userId}`} className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
          Análise Avançada e Alertas
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Corrigido: profile1UserId para userId */}
            <UserRadarChartComparison profile1UserId={userId} chartTitle="Radar Comparativo de Performance"/>
            <UserAlertsWidget userId={userId} />
        </div>
        {/* Adicionar mais componentes da Fase 3 aqui, como KPIs de comparação periódica do usuário */}
        {/* Por exemplo, poderíamos ter instâncias de PlatformComparativeKpi adaptadas para dados de usuário */}
      </section>

      {/* Seção de Tendências do Criador */}
      <section id={`user-trends-${userId}`} className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
          Tendências da Conta
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserFollowerTrendChart userId={userId} chartTitle="Evolução de Seguidores" />
          <UserReachEngagementTrendChart userId={userId} chartTitle="Alcance e Contas Engajadas" />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <UserMovingAverageEngagementChart userId={userId} chartTitle="Média Móvel de Engajamento Diário" />
        </div>
      </section>

      {/* Seção de Performance de Conteúdo do Criador */}
      <section id={`user-content-performance-${userId}`} className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
          Performance de Conteúdo
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserAverageEngagementChart
            userId={userId}
            groupBy="format"
            chartTitle="Engajamento Médio por Formato"
          />
          <UserAverageEngagementChart
            userId={userId}
            groupBy="context"
            chartTitle="Engajamento Médio por Contexto"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UserEngagementDistributionChart userId={userId} chartTitle="Distribuição de Engajamento por Formato"/>
        </div>
      </section>

    </div>
  );
};

export default UserDetailView;
```
