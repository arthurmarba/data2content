"use client";

import React, { useState } from 'react'; // Importado useState

// Importando os componentes do Módulo 1 (Visão Geral da Plataforma)
import PlatformFollowerTrendChart from './components/PlatformFollowerTrendChart';
import PlatformReachEngagementTrendChart from './components/PlatformReachEngagementTrendChart';
import PlatformMovingAverageEngagementChart from './components/PlatformMovingAverageEngagementChart';
import TotalActiveCreatorsKpi from './components/kpis/TotalActiveCreatorsKpi';
import PlatformComparativeKpi from './components/kpis/PlatformComparativeKpi';

// Importando os componentes do Módulo 2 (Análise de Conteúdo da Plataforma)
import PlatformAverageEngagementChart from './components/PlatformAverageEngagementChart';
import PlatformPostDistributionChart from './components/PlatformPostDistributionChart';

// Importando a view de Detalhe do Criador (Módulo 3)
import UserDetailView from './components/views/UserDetailView';


const AdminCreatorDashboardPage: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // const [selectedUserName, setSelectedUserName] = useState<string | null>(null); // Opcional

  // Mock User IDs para simular seleção
  const MOCK_USER_ID_1 = "60c72b9f9b1d8e001f8e4f5b"; // Exemplo de ObjectId válido
  const MOCK_USER_ID_2 = "60c72b9f9b1d8e001f8e4f5c"; // Exemplo de ObjectId válido
  // const MOCK_USER_NAME_1 = "Criador Alpha";
  // const MOCK_USER_NAME_2 = "Criador Beta";


  // const [globalTimePeriod, setGlobalTimePeriod] = useState<string>("last_30_days");
  // const [globalComparisonPeriod, setGlobalComparisonPeriod] = useState<string>("month_vs_previous");
  const selectedComparisonPeriodForKPIs = "month_vs_previous";


  const handleUserSelect = (userId: string, userName?: string) => {
    setSelectedUserId(userId);
    // if (userName) setSelectedUserName(userName);
    // Em uma app real, rolaria para a seção UserDetailView ou focaria nela.
    const userDetailSection = document.getElementById("user-detail-view-container");
    if (userDetailSection) {
        userDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard Administrativo de Criadores</h1>
        {/* Placeholder para Filtros Globais */}
      </header>

      {/* Seção de Seleção de Criador (Simulada) */}
      <section id="creator-selection-simulation" className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Simular Seleção de Criador Detalhado:</h2>
        <div className="flex gap-4">
          <button
            onClick={() => handleUserSelect(MOCK_USER_ID_1 /*, MOCK_USER_NAME_1 */)}
            className={`p-2 rounded-md text-sm ${selectedUserId === MOCK_USER_ID_1 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
          >
            Ver Detalhes Criador Alpha (ID: ...4f5b)
          </button>
          <button
            onClick={() => handleUserSelect(MOCK_USER_ID_2 /*, MOCK_USER_NAME_2 */)}
            className={`p-2 rounded-md text-sm ${selectedUserId === MOCK_USER_ID_2 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
          >
            Ver Detalhes Criador Beta (ID: ...4f5c)
          </button>
          {selectedUserId && (
            <button
              onClick={() => {setSelectedUserId(null); /* setSelectedUserName(null); */}}
              className="p-2 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Limpar Seleção
            </button>
          )}
        </div>
      </section>


      {!selectedUserId && ( // Mostrar seções da plataforma apenas se nenhum usuário estiver selecionado para detalhe
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
                comparisonPeriod={selectedComparisonPeriodForKPIs}
                tooltip="Crescimento total de seguidores na plataforma comparado ao período anterior selecionado."
              />
              <PlatformComparativeKpi
                kpiName="platformTotalEngagement"
                title="Engajamento Total"
                comparisonPeriod={selectedComparisonPeriodForKPIs}
                tooltip="Soma total de interações em todos os posts da plataforma comparado ao período anterior selecionado."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformFollowerTrendChart />
              <PlatformReachEngagementTrendChart />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <PlatformMovingAverageEngagementChart />
            </div>
          </section>

          <section id="platform-content-analysis" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Análise de Conteúdo da Plataforma
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformAverageEngagementChart
                initialGroupBy="format"
                chartTitle="Engajamento Médio por Formato (Plataforma)"
              />
              <PlatformAverageEngagementChart
                initialGroupBy="context"
                chartTitle="Engajamento Médio por Contexto (Plataforma)"
              />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <PlatformPostDistributionChart />
            </div>
          </section>

          <section id="creator-highlights" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Destaques de Criadores
            </h2>
            <p className="text-gray-500 italic">
              (Em breve: Componentes como Tabelas de Criadores e Scatter Plot)
            </p>
          </section>
        </>
      )}

      {/* Container para a Visão Detalhada do Criador */}
      <div id="user-detail-view-container">
        {selectedUserId && (
          <UserDetailView
            userId={selectedUserId}
            // userName={selectedUserName} // Passar nome se o estado for gerenciado
          />
        )}
      </div>

    </div>
  );
};

export default AdminCreatorDashboardPage;
```
