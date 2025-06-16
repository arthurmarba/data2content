"use client";

import React, { useState } from 'react';

// Filtro Global
import GlobalTimePeriodFilter from './components/filters/GlobalTimePeriodFilter';

// Componentes da Plataforma - Módulo 1 (Visão Geral)
import PlatformFollowerTrendChart from './components/PlatformFollowerTrendChart';
import PlatformReachEngagementTrendChart from './components/PlatformReachEngagementTrendChart';
import PlatformMovingAverageEngagementChart from './components/PlatformMovingAverageEngagementChart';
import TotalActiveCreatorsKpi from './components/kpis/TotalActiveCreatorsKpi';
import PlatformComparativeKpi from './components/kpis/PlatformComparativeKpi';

// Componentes da Plataforma - Módulo 2 (Análise de Conteúdo)
import PlatformAverageEngagementChart from './components/PlatformAverageEngagementChart';
import PlatformPostDistributionChart from './components/PlatformPostDistributionChart';
import PlatformVideoPerformanceMetrics from './components/PlatformVideoPerformanceMetrics';
import PlatformMonthlyEngagementStackedChart from './components/PlatformMonthlyEngagementStackedChart';
import PlatformPerformanceHighlights from './components/PlatformPerformanceHighlights';

// Componente do Módulo 3 (Scatter Plot)
import CreatorsScatterPlot from './components/CreatorsScatterPlot';

// View de Detalhe do Criador (Módulo 3 e partes do Módulo 2 para usuário)
import UserDetailView from './components/views/UserDetailView';


const AdminCreatorDashboardPage: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // const [selectedUserName, setSelectedUserName] = useState<string | null>(null);

  const MOCK_USER_ID_1 = "60c72b9f9b1d8e001f8e4f5b";
  const MOCK_USER_ID_2 = "60c72b9f9b1d8e001f8e4f5c";

  // Estado para o Filtro de Período Global
  const [globalTimePeriod, setGlobalTimePeriod] = useState<string>("last_30_days");

  // Este estado seria para um seletor de período de comparação global para KPIs, se implementado
  // const [globalComparisonPeriod, setGlobalComparisonPeriod] = useState<string>("month_vs_previous");
  // Por enquanto, PlatformComparativeKpi usa seu próprio default ou um valor fixo passado abaixo.
  const selectedComparisonPeriodForPlatformKPIs = "month_vs_previous";


  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const userDetailSection = document.getElementById("user-detail-view-container");
    if (userDetailSection) {
        userDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard Administrativo de Criadores</h1>

        {/* Filtro de Período Global */}
        <div className="mt-4 p-4 bg-white rounded-md shadow">
          <GlobalTimePeriodFilter
            selectedTimePeriod={globalTimePeriod}
            onTimePeriodChange={setGlobalTimePeriod}
            // Desabilitar o filtro global se um usuário estiver selecionado,
            // para que a UserDetailView use seus próprios filtros ou o initialTimePeriod dela.
            // Ou, permitir que o filtro global ainda afete a UserDetailView se essa for a UX desejada.
            // Por ora, vamos deixar habilitado; UserDetailView pode usar como `initialTimePeriod`.
            // disabled={!!selectedUserId}
          />
          {/* Aqui poderia ir outro seletor global para `comparisonPeriod` dos KPIs, se desejado. */}
        </div>
      </header>

      {/* Seção de Seleção de Criador (Simulada) */}
      <section id="creator-selection-simulation" className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Simular Seleção de Criador Detalhado:</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleUserSelect(MOCK_USER_ID_1)}
            className={`p-2 rounded-md text-sm ${selectedUserId === MOCK_USER_ID_1 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
          >
            Ver Detalhes Criador Alpha (ID: ...4f5b)
          </button>
          <button
            onClick={() => handleUserSelect(MOCK_USER_ID_2)}
            className={`p-2 rounded-md text-sm ${selectedUserId === MOCK_USER_ID_2 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
          >
            Ver Detalhes Criador Beta (ID: ...4f5c)
          </button>
          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId(null)}
              className="p-2 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Limpar Seleção (Ver Visão Geral da Plataforma)
            </button>
          )}
        </div>
      </section>

      {/* Conteúdo Principal: Visão da Plataforma ou Detalhe do Criador */}
      {selectedUserId ? (
        <div id="user-detail-view-container">
          <UserDetailView
            userId={selectedUserId}
            // Passar o globalTimePeriod para que os componentes dentro de UserDetailView
            // possam usá-lo como valor inicial para seus próprios seletores de período.
            // Eles ainda terão a capacidade de mudar o período localmente.
            // Ex: initialTimePeriodForCharts={globalTimePeriod} (a prop precisa ser criada em UserDetailView)
          />
        </div>
      ) : (
        <>
          <section id="platform-overview" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Visão Geral da Plataforma
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <TotalActiveCreatorsKpi />
              <PlatformComparativeKpi
                kpiName="platformFollowerGrowth"
                title="Crescimento de Seguidores"
                comparisonPeriod={selectedComparisonPeriodForPlatformKPIs}
                tooltip="Crescimento total de seguidores na plataforma comparado ao período anterior selecionado."
              />
              <PlatformComparativeKpi
                kpiName="platformTotalEngagement"
                title="Engajamento Total"
                comparisonPeriod={selectedComparisonPeriodForPlatformKPIs}
                tooltip="Soma total de interações em todos os posts da plataforma comparado ao período anterior selecionado."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformFollowerTrendChart timePeriod={globalTimePeriod} />
              <PlatformReachEngagementTrendChart timePeriod={globalTimePeriod} />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <PlatformMovingAverageEngagementChart timePeriod={globalTimePeriod} /> {/* Assumindo que aceita timePeriod para definir dataWindow */}
            </div>
          </section>

          <section id="platform-content-analysis" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Análise de Conteúdo da Plataforma
            </h2>
            <div className="mb-6 md:mb-8">
                <PlatformPerformanceHighlights timePeriod={globalTimePeriod} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformAverageEngagementChart
                initialGroupBy="format"
                chartTitle="Engajamento Médio por Formato (Plataforma)"
                timePeriod={globalTimePeriod}
              />
              <PlatformAverageEngagementChart
                initialGroupBy="context"
                chartTitle="Engajamento Médio por Contexto (Plataforma)"
                timePeriod={globalTimePeriod}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformPostDistributionChart timePeriod={globalTimePeriod} />
              <PlatformVideoPerformanceMetrics timePeriod={globalTimePeriod} />
            </div>
            <div className="grid grid-cols-1 gap-6">
                <PlatformMonthlyEngagementStackedChart timePeriod={globalTimePeriod} />
            </div>
          </section>

          <section id="creator-highlights-and-scatter-plot" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Destaques e Análise Comparativa de Criadores
            </h2>
            <p className="text-sm text-gray-500 mb-4 italic">
              (Em breve: Tabelas de Criadores com melhor performance)
            </p>
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
                 <h3 className="text-lg font-semibold text-gray-700 mb-3">Análise de Dispersão de Criadores</h3>
                 <p className="text-xs text-gray-600 mb-4">
                    Visualize a dispersão dos criadores com base em diferentes métricas.
                    O componente de gráfico de dispersão normalmente permite configurar os eixos X e Y para explorar relações entre métricas (ex: Seguidores vs. Engajamento Médio).
                </p>
                <CreatorsScatterPlot /> {/* Este componente tem seus próprios seletores internos de métricas e pode buscar sua própria lista de usuários */}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminCreatorDashboardPage;
```
