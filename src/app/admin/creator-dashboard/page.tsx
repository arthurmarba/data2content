'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { subDays, format } from 'date-fns';
import CreatorTable from './CreatorTable';
import ContentStatsWidgets from './ContentStatsWidgets';
import GlobalPostsExplorer from './GlobalPostsExplorer';
import ContentPerformanceByTypeChart from './ContentPerformanceByTypeChart'; // Import the new component
import {
  XMarkIcon,
  FunnelIcon,
  ChartBarSquareIcon,
  UserGroupIcon,
  GlobeAltIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon // Ícone para "Perguntar à IA"
} from '@heroicons/react/24/outline';
import CreatorRankingCard from './CreatorRankingCard';
import KpiCard from '../components/KpiCard';

// Tipos locais para o exemplo
interface KpiData {
    label: string;
    value: number;
}
interface AdminDashboardSummaryData {
    totalCreators?: KpiData;
    pendingCreators?: KpiData;
    activeCreators?: KpiData;
    avgEngagementRate?: KpiData;
    avgReach?: KpiData;
}

// Carregamento dinâmico para componentes pesados
const DynamicAIChatInterface = dynamic(() => import('./StandaloneChatInterface'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><p className="text-gray-500">A carregar Chat IA...</p></div>,
});

const DynamicContentSegmentComparison = dynamic(
  () => import('./ContentSegmentComparison'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[300px] flex items-center justify-center mt-8">
        <p className="text-gray-500">A carregar Comparador de Segmentos...</p>
      </div>
    ),
  }
);

const DynamicTopMoversWidget = dynamic(
  () => import('./TopMoversWidget'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px] flex items-center justify-center mt-8">
        <p className="text-gray-500">A carregar Widget Top Movers...</p>
      </div>
    ),
  }
);


export interface GlobalFiltersState {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  planStatus: string[];
  expertiseLevel: string[];
}

const PLAN_STATUS_OPTIONS = ['Free', 'Pro', 'Premium', 'Trial', 'Active', 'Inactive'];
const EXPERTISE_LEVEL_OPTIONS = ['Iniciante', 'Intermediário', 'Avançado', 'Especialista'];

// Função utilitária para formatar data para o input
const formatDateForInput = (date: Date): string => format(date, 'yyyy-MM-dd');

export default function CreatorDashboardPage() {
  const [filters, setFilters] = useState<GlobalFiltersState>({
    dateRange: { 
        startDate: formatDateForInput(subDays(new Date(), 29)),
        endDate: formatDateForInput(new Date()) 
    },
    planStatus: [],
    expertiseLevel: [],
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);
  // OTIMIZAÇÃO: Estado para passar uma pergunta inicial para o chat de IA
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);


  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFilters(prevFilters => {
        const currentValues = prevFilters[name as keyof Pick<GlobalFiltersState, 'planStatus' | 'expertiseLevel'>] as string[];
        if (checked) {
          return { ...prevFilters, [name]: [...currentValues, value] };
        } else {
          return { ...prevFilters, [name]: currentValues.filter(item => item !== value) };
        }
      });
    } else if (name === 'startDate' || name === 'endDate') {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, [name]: value },
      }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (filters.dateRange.startDate && filters.dateRange.endDate && filters.dateRange.startDate > filters.dateRange.endDate) {
        alert("A data de início não pode ser posterior à data de término.");
        return;
    }
    setRefreshKey(prev => prev + 1);
  }, [filters.dateRange]);
  
  const handleRemoveFilter = useCallback((filterKey: 'planStatus' | 'expertiseLevel', value: string) => {
    setFilters(prev => ({
        ...prev,
        [filterKey]: prev[filterKey].filter(item => item !== value)
    }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilters(prev => ({
        ...prev,
        planStatus: [],
        expertiseLevel: []
    }));
  }, []);

  // OTIMIZAÇÃO: Função para abrir o chat de IA com um prompt contextual
  const handleAskAi = useCallback((prompt: string) => {
    setAiInitialPrompt(prompt);
    setIsAiChatVisible(true);
  }, []);

  // Limpa o prompt inicial quando o chat é fechado
  const handleCloseAiChat = useCallback(() => {
    setIsAiChatVisible(false);
    setAiInitialPrompt(undefined);
  }, []);


  const planStatusFilterString = useMemo(() => filters.planStatus.join(','), [filters.planStatus]);
  const expertiseLevelFilterString = useMemo(() => filters.expertiseLevel.join(','), [filters.expertiseLevel]);
  const dateRangeFilterProp = useMemo(() => {
    return filters.dateRange.startDate && filters.dateRange.endDate ? filters.dateRange : undefined;
  }, [filters.dateRange]);

  const [summaryKpis, setSummaryKpis] = useState<AdminDashboardSummaryData | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      setKpisLoading(true);
      setKpisError(null);
      try {
        await new Promise(res => setTimeout(res, 500));
        const data: AdminDashboardSummaryData = {
            totalCreators: { label: 'Total de Criadores', value: 1250 },
            pendingCreators: { label: 'Criadores Pendentes', value: 75 },
            activeCreators: { label: 'Criadores Ativos (Período)', value: 480 },
            avgEngagementRate: { label: 'Taxa de Engajamento Média', value: 5.75 }, // Simulated percentage
            avgReach: { label: 'Alcance Médio por Post', value: 12500 } // Simulated number
        };

        setSummaryKpis(data);
      } catch (e: any) {
        setKpisError(e.message);
      } finally {
        setKpisLoading(false);
      }
    };
    fetchKpis();
  }, [refreshKey]);



  return (
    <div className="bg-gray-50 min-h-screen relative">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Creator & Content Dashboard</h1>
          <p className="text-md text-gray-600 mt-2">Monitorize, analise e obtenha insights sobre criadores e conteúdo da plataforma.</p>
        </header>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">Resumo da Plataforma</h2>
          {kpisError && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              <ExclamationTriangleIcon className="w-5 h-5 inline mr-2"/>
              <span className="font-medium">Erro ao carregar resumo:</span> {kpisError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <KpiCard
              label={summaryKpis?.totalCreators?.label || 'Total de Criadores'}
              value={kpisLoading ? undefined : summaryKpis?.totalCreators?.value}
              icon={UsersIcon}
              isLoading={kpisLoading}
              tooltip="Número total de criadores registados na plataforma."
              onAskAi={() => handleAskAi("O que significa o KPI 'Total de Criadores' e qual a sua tendência recente?")}
            />
            <KpiCard
              label={summaryKpis?.pendingCreators?.label || 'Criadores Pendentes'}
              value={kpisLoading ? undefined : summaryKpis?.pendingCreators?.value}
              icon={UserPlusIcon}
              isLoading={kpisLoading}
              tooltip="Criadores que aguardam aprovação para entrar na plataforma."
              onAskAi={() => handleAskAi("Mostra-me uma lista dos criadores pendentes há mais tempo.")}
            />
            <KpiCard
              label={summaryKpis?.activeCreators?.label || 'Criadores Ativos'}
              value={kpisLoading ? undefined : summaryKpis?.activeCreators?.value}
              icon={BoltIcon}
              isLoading={kpisLoading}
              tooltip="Número de criadores que publicaram conteúdo no período selecionado."
              onAskAi={() => handleAskAi("Compara o número de criadores ativos este mês com o mês passado.")}
            />
            <KpiCard
              label={summaryKpis?.avgEngagementRate?.label || 'Taxa de Engajamento Média'}
              value={kpisLoading ? undefined : summaryKpis?.avgEngagementRate?.value}
              formatAs="percentage"
              icon={SparklesIcon}
              isLoading={kpisLoading}
              tooltip="Taxa de engajamento média de todos os posts no período selecionado."
              onAskAi={() => handleAskAi("Qual é a tendência da taxa de engajamento média nos últimos 3 meses?")}
            />
            <KpiCard
              label={summaryKpis?.avgReach?.label || 'Alcance Médio por Post'}
              value={kpisLoading ? undefined : summaryKpis?.avgReach?.value}
              formatAs="number"
              icon={GlobeAltIcon}
              isLoading={kpisLoading}
              tooltip="Número médio de contas únicas alcançadas por post no período selecionado."
              onAskAi={() => handleAskAi("Quais tipos de conteúdo têm maior alcance médio?")}
            />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
            <TrophyIcon className="w-7 h-7 mr-3 text-gray-500" />
            Destaques de Criadores
            {dateRangeFilterProp && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                (Período: {new Date(dateRangeFilterProp.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} - {new Date(dateRangeFilterProp.endDate + 'T00:00:00').toLocaleDateString('pt-BR')})
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <CreatorRankingCard title="Maiores Engajadores" apiEndpoint="/api/admin/dashboard/rankings/creators/top-engaging" dateRangeFilter={dateRangeFilterProp} metricLabel="%" limit={5} />
            <CreatorRankingCard title="Mais Prolíficos" apiEndpoint="/api/admin/dashboard/rankings/creators/most-prolific" dateRangeFilter={dateRangeFilterProp} metricLabel="posts" limit={5} />
            <CreatorRankingCard title="Campeões de Interação" apiEndpoint="/api/admin/dashboard/rankings/creators/top-interactions" dateRangeFilter={dateRangeFilterProp} metricLabel="interações" limit={5} />
            <CreatorRankingCard title="Mestres do Compartilhamento" apiEndpoint="/api/admin/dashboard/rankings/creators/top-sharing" dateRangeFilter={dateRangeFilterProp} metricLabel="compart." limit={5} />
          </div>
        </section>

        <section className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtros Globais</h2>
          {(filters.planStatus.length > 0 || filters.expertiseLevel.length > 0) && (
            <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Filtros Ativos:</span>
                    {filters.planStatus.map(plan => (
                        <span key={plan} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            {plan}
                            <button onClick={() => handleRemoveFilter('planStatus', plan)} className="ml-1 flex-shrink-0 text-indigo-500 hover:text-indigo-700"><XMarkIcon className="h-3 w-3" /></button>
                        </span>
                    ))}
                    {filters.expertiseLevel.map(level => (
                        <span key={level} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {level}
                            <button onClick={() => handleRemoveFilter('expertiseLevel', level)} className="ml-1 flex-shrink-0 text-blue-500 hover:text-blue-700"><XMarkIcon className="h-3 w-3" /></button>
                        </span>
                    ))}
                     <button onClick={handleClearAllFilters} className="text-xs text-gray-500 hover:text-gray-800 hover:underline">Limpar filtros</button>
                </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input type="date" name="startDate" id="startDate" value={filters.dateRange.startDate} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input type="date" name="endDate" id="endDate" value={filters.dateRange.endDate} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status do Plano</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-2 border border-gray-300 rounded-md max-h-32 overflow-y-auto">
                {PLAN_STATUS_OPTIONS.map(option => (
                  <div key={option} className="flex items-center">
                    <input id={`planStatus-${option}`} name="planStatus" type="checkbox" value={option} checked={filters.planStatus.includes(option)} onChange={handleFilterChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                    <label htmlFor={`planStatus-${option}`} className="ml-2 text-xs text-gray-700">{option}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Expertise</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-2 border border-gray-300 rounded-md max-h-32 overflow-y-auto">
                {EXPERTISE_LEVEL_OPTIONS.map(option => (
                  <div key={option} className="flex items-center">
                    <input id={`expertiseLevel-${option}`} name="expertiseLevel" type="checkbox" value={option} checked={filters.expertiseLevel.includes(option)} onChange={handleFilterChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                    <label htmlFor={`expertiseLevel-${option}`} className="ml-2 text-xs text-gray-700">{option}</label>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleApplyFilters} className="w-full lg:self-end h-[42px] flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700">
              <FunnelIcon className="w-5 h-5 mr-2" /> Aplicar Filtros
            </button>
          </div>
        </section>

        <main className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><ChartBarSquareIcon className="w-7 h-7 mr-3 text-gray-500" /> Visão Geral</h2>
            <ContentStatsWidgets key={`contentStats-${refreshKey}`} dateRangeFilter={dateRangeFilterProp} />
          </section>
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><ChartBarSquareIcon className="w-7 h-7 mr-3 text-gray-500" /> Desempenho de Conteúdo por Tipo</h2>
            <ContentPerformanceByTypeChart dateRangeFilter={dateRangeFilterProp} />
          </section>
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><UserGroupIcon className="w-7 h-7 mr-3 text-gray-500" /> Análise de Criadores</h2>
            <CreatorTable key={`creatorTable-${refreshKey}`} planStatusFilter={planStatusFilterString} expertiseLevelFilter={expertiseLevelFilterString} dateRangeFilter={dateRangeFilterProp} />
          </section>
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><GlobeAltIcon className="w-7 h-7 mr-3 text-gray-500" /> Exploração de Conteúdo Global</h2>
            <GlobalPostsExplorer dateRangeFilter={dateRangeFilterProp} />
          </section>
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><SparklesIcon className="w-7 h-7 mr-3 text-gray-500" /> Ferramentas de Análise Avançada</h2>
            <div className="space-y-8">
              <DynamicContentSegmentComparison dateRangeFilter={dateRangeFilterProp} />
              <DynamicTopMoversWidget />
            </div>
          </section>
        </main>

        <div className="fixed bottom-8 right-8 z-50">
          <button type="button" onClick={() => setIsAiChatVisible(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-full text-lg font-semibold shadow-xl hover:bg-indigo-700" title="Abrir Chat IA">
            Chat IA
          </button>
        </div>

        {isAiChatVisible && (
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) handleCloseAiChat();}}>
            <div className="bg-gray-100 w-full max-w-2xl h-[80vh] max-h-[700px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-300">
              <header className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Assistente IA</h2>
                <button onClick={handleCloseAiChat} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200" title="Fechar chat">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </header>
              <div className="flex-grow overflow-y-auto">
                <DynamicAIChatInterface initialPrompt={aiInitialPrompt} />
              </div>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Creator Platform. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
