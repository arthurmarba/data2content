'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
// A interface IDashboardCreator seria importada do seu serviço.
// Para este exemplo, vamos defini-la localmente.
// import { IDashboardCreator, IFetchDashboardCreatorsListParams } from '@/app/lib/dataService/marketAnalysisService';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { UserGroupIcon, InformationCircleIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline';

// --- Definições de Componentes em Falta ---
// Para resolver os erros de importação, estou a criar versões simples
// dos componentes que estavam em falta diretamente neste arquivo.

const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '', variant = 'rectangle' }: { width?: string; height?: string; className?: string; variant?: 'rectangle' | 'circle' }) => {
  const baseClasses = "bg-gray-200 animate-pulse";
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded';
  return <div className={`${baseClasses} ${width} ${height} ${shapeClass} ${className}`}></div>;
};

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => {
  return (
    <div className="text-center py-10">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 text-gray-400">
        {icon}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
};

// Modal de Detalhes do Criador (Versão Simples)
const CreatorDetailModal = ({ isOpen, onClose, creatorId, creatorName, dateRangeFilter }: any) => {
  const [growthData, setGrowthData] = useState<IUserGrowthDataPoint[]>([]);

  useEffect(() => {
    if (isOpen && creatorId) {
      // Simular a obtenção de dados de crescimento
      const today = new Date();
      const sampleData: IUserGrowthDataPoint[] = Array.from({ length: 30 }).map((_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (29 - i)); // Dados dos últimos 30 dias
        return {
          date,
          // Simular alguma variação, mas com tendência de crescimento para seguidores
          followers: 1000 + (i * 10) + Math.floor(Math.random() * 100) - 50,
          // Simular alguma variação para a taxa de engajamento entre 0.5% e 5%
          engagementRate: parseFloat((0.005 + Math.random() * 0.045).toFixed(4)),
        };
      });
      setGrowthData(sampleData);
    }
  }, [isOpen, creatorId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Detalhes de {creatorName}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="text-gray-700 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Informações Gerais</h3>
            <p><span className="font-medium">ID do Criador:</span> {creatorId}</p>
            <p><span className="font-medium">Período de Análise:</span> {new Date(dateRangeFilter.startDate).toLocaleDateString()} - {new Date(dateRangeFilter.endDate).toLocaleDateString()}</p>
          </div>

          <hr />

          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Crescimento de Seguidores</h3>
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-500">[Follower Growth Chart Placeholder]</p>
              {/* Exemplo de como os dados poderiam ser mostrados se não houvesse gráfico:
              {growthData.length > 0 && (
                <ul className="text-xs text-left mt-2">
                  {growthData.slice(0, 5).map(d => ( // Mostrar apenas os 5 primeiros para brevidade
                    <li key={d.date.toISOString()}>{d.date.toLocaleDateString()}: {d.followers} seguidores</li>
                  ))}
                </ul>
              )}
              */}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Taxa de Engajamento ao Longo do Tempo</h3>
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-500">[Engagement Rate Chart Placeholder]</p>
            </div>
          </div>

          <p className="mt-6 text-sm text-gray-600"><i>(Aqui seriam carregados outros dados de performance detalhados...)</i></p>
        </div>
      </div>
    </div>
  );
};

// Modal de Comparação de Criadores (Versão Simples)
const CreatorComparisonModal = ({ isOpen, onClose, creatorIdsToCompare }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl m-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Comparando Criadores</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="text-gray-700">
                    <p>IDs a serem comparados:</p>
                    <ul className="list-disc list-inside">
                        {creatorIdsToCompare.map((id: string) => <li key={id}>{id}</li>)}
                    </ul>
                     <p className="mt-4"><i>(Aqui seriam carregados os gráficos e dados de comparação lado a lado...)</i></p>
                </div>
            </div>
        </div>
    );
};


// --- Definições de Tipos Locais (Substituir por importações reais) ---

interface IUserGrowthDataPoint {
  date: Date;
  followers: number;
  engagementRate: number;
}

interface IDashboardCreator {
  _id: { toString: () => string };
  name: string;
  planStatus?: string;
  inferredExpertiseLevel?: string;
  totalPosts: number;
  lastActivityDate?: Date;
  avgEngagementRate: number;
  profilePictureUrl?: string;
  recentAlerts?: { type: string; date: Date }[];
}

interface IFetchDashboardCreatorsListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: {
    nameSearch?: string;
    planStatus?: string[];
    expertiseLevel?: string[];
    minTotalPosts?: number;
    minFollowers?: number;
    startDate?: string;
    endDate?: string;
  };
}


const DEBOUNCE_DELAY = 500;

interface CreatorTableProps {
  planStatusFilter?: string;
  expertiseLevelFilter?: string;
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const CreatorTable = memo(function CreatorTable({ planStatusFilter, expertiseLevelFilter, dateRangeFilter }: CreatorTableProps) {
  const [creators, setCreators] = useState<IDashboardCreator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Começa como true
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'totalPosts', sortOrder: 'desc' });

  const [nameSearch, setNameSearch] = useState('');
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('');

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCreatorForModal, setSelectedCreatorForModal] = useState<{ id: string; name: string; } | null>(null);

  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const MAX_CREATORS_TO_COMPARE = 3;

  const handleCloseDetailModal = useCallback(() => setIsDetailModalOpen(false), []);
  const handleCloseComparisonModal = useCallback(() => setIsComparisonModalOpen(false), []);

  const handleOpenCreatorModal = useCallback((creator: IDashboardCreator) => {
    setSelectedCreatorForModal({ id: creator._id.toString(), name: creator.name });
    setIsDetailModalOpen(true);
  }, []);

  const handleCompareSelectChange = useCallback((creatorId: string) => {
    setSelectedForComparison(prevSelected => {
      if (prevSelected.includes(creatorId)) {
        return prevSelected.filter(id => id !== creatorId);
      }
      if (prevSelected.length < MAX_CREATORS_TO_COMPARE) {
        return [...prevSelected, creatorId];
      }
      return prevSelected;
    });
  }, []);

  const handleInitiateComparison = useCallback(() => {
    if (selectedForComparison.length >= 2) {
      setIsComparisonModalOpen(true);
    }
  }, [selectedForComparison]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNameSearch(nameSearch);
      setCurrentPage(1); // Resetar página na busca
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(handler);
  }, [nameSearch]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const queryParams = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
    });

    if (debouncedNameSearch) queryParams.append('nameSearch', debouncedNameSearch);
    if (planStatusFilter) queryParams.append('planStatus', planStatusFilter);
    if (expertiseLevelFilter) queryParams.append('expertiseLevel', expertiseLevelFilter);
    
    // As datas devem ser no formato ISO string para a API
    if (dateRangeFilter?.startDate) {
        queryParams.append('startDate', new Date(dateRangeFilter.startDate).toISOString());
    }
    if (dateRangeFilter?.endDate) {
        const end = new Date(dateRangeFilter.endDate);
        end.setUTCHours(23, 59, 59, 999);
        queryParams.append('endDate', end.toISOString());
    }

    try {
      // Simulação da chamada fetch. Substitua pela sua URL real da API.
      // const response = await fetch(`/api/admin/dashboard/creators?${queryParams.toString()}`);
      // if (!response.ok) { ... }
      // const data = await response.json();

      // --- Início da Simulação de Dados ---
      console.log("A simular chamada à API com os parâmetros:", queryParams.toString());
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular atraso da rede
      const alertTypes = ['PeakShares', 'DropWatchTime', 'ForgottenFormat'];
      const mockCreators: IDashboardCreator[] = Array.from({ length: limit }).map((_, i) => {
          const id = currentPage * 100 + i;
          const numAlerts = Math.floor(Math.random() * 3) + 1; // 1 to 3 alerts
          const recentAlerts = Array.from({ length: numAlerts }).map(() => ({
            type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
            date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Alerts from the last 7 days
          }));
          return {
              _id: { toString: () => `60d5f9d4e9b9f8a2d8f9c9${id}` },
              name: `Criador ${id} ${debouncedNameSearch}`,
              totalPosts: Math.floor(Math.random() * 200),
              avgEngagementRate: Math.random() * 0.1,
              lastActivityDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
              planStatus: ['Free', 'Pro', 'Premium'][id % 3],
              recentAlerts,
          }
      });
      const data = { creators: mockCreators, totalCreators: 100 };
      // --- Fim da Simulação de Dados ---
      
      setCreators(data.creators);
      setTotalCreators(data.totalCreators);
    } catch (e: any) {
      setError(e.message);
      setCreators([]);
      setTotalCreators(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, sortConfig, debouncedNameSearch, planStatusFilter, expertiseLevelFilter, dateRangeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = useCallback((columnKey: string) => {
    setSortConfig(current => ({
      sortBy: columnKey,
      sortOrder: current.sortBy === columnKey && current.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  }, []);

  const renderSortIcon = useCallback((columnKey: string) => {
    if (sortConfig.sortBy !== columnKey) return <ChevronDownIcon className="w-4 h-4 inline text-gray-400" />;
    return sortConfig.sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4 inline text-indigo-600" /> : <ChevronDownIcon className="w-4 h-4 inline text-indigo-600" />;
  }, [sortConfig]);

  const totalPages = Math.ceil(totalCreators / limit);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  const getSafeString = (value: any): string => (value ?? 'N/A').toString();
  const formatDate = (date?: Date | string) => date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';
  const formatEngagement = (rate?: number) => typeof rate === 'number' ? `${(rate * 100).toFixed(2)}%` : 'N/A';
  const formatNumber = (num?: number) => typeof num === 'number' ? num.toLocaleString('pt-BR') : 'N/A';

  const columns = [
    { key: 'select', label: '', sortable: false, headerClassName: 'w-12 text-center' },
    { key: 'name', label: 'Criador', sortable: true, headerClassName: 'text-left' },
    { key: 'totalPosts', label: 'Posts', sortable: true, headerClassName: 'text-right' },
    { key: 'avgEngagementRate', label: 'Engaj. Médio', sortable: true, headerClassName: 'text-right' },
    { key: 'lastActivityDate', label: 'Última Atividade', sortable: true, headerClassName: 'text-center' },
    { key: 'planStatus', label: 'Plano', sortable: true, headerClassName: 'text-center' },
    { key: 'recentAlerts', label: 'Alertas Recentes', sortable: false, headerClassName: 'text-center' },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-center' }
  ];

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Lista de Criadores</h3>
            <p className="text-sm text-gray-500 mt-1">Visão geral dos criadores. Clique no nome para detalhes ou selecione para comparar.</p>
          </div>
          <input type="text" placeholder="Buscar por nome..." value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>

        <div className="mb-4 flex items-center justify-start space-x-4">
          <button onClick={handleInitiateComparison} disabled={selectedForComparison.length < 2 || selectedForComparison.length > MAX_CREATORS_TO_COMPARE} className="flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm">
            <UserGroupIcon className="w-5 h-5 mr-2" />
            Comparar ({selectedForComparison.length})
          </button>
          <p className="text-sm text-gray-600">Selecione de 2 a {MAX_CREATORS_TO_COMPARE} criadores.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${col.headerClassName || ''}`} onClick={() => col.sortable && handleSort(col.key)}>
                    {col.label} {col.sortable && renderSortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: limit }).map((_, index) => (
                  <tr key={`skel-row-${index}`}>
                    <td className="px-6 py-4 text-center"><SkeletonBlock variant="rectangle" width="w-4" height="h-4" className="mx-auto" /></td>
                    <td className="px-6 py-4"><div className="flex items-center"><SkeletonBlock variant="circle" width="w-10" height="h-10" /><div className="ml-3"><SkeletonBlock width="w-32" height="h-3" /></div></div></td>
                    <td className="px-6 py-4 text-right"><SkeletonBlock width="w-12" height="h-3" /></td>
                    <td className="px-6 py-4 text-right"><SkeletonBlock width="w-16" height="h-3" /></td>
                    <td className="px-6 py-4 text-center"><SkeletonBlock width="w-20" height="h-3" /></td>
                    <td className="px-6 py-4 text-center"><SkeletonBlock width="w-16" height="h-5" /></td>
                    <td className="px-6 py-4 text-center"><SkeletonBlock width="w-20" height="h-3" /></td> {/* Skeleton for recent alerts */}
                    <td className="px-6 py-4 text-center"><SkeletonBlock width="w-20" height="h-6" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={columns.length} className="text-center py-4 text-red-500">Erro ao carregar dados: {error}</td></tr>
              ) : creators.length === 0 ? (
                <tr><td colSpan={columns.length}><EmptyState icon={<UsersIcon className="w-12 h-12" />} title="Nenhum Criador Encontrado" message="Tente ajustar os filtros ou a busca por nome."/></td></tr>
              ) : (
                creators.map((creator) => {
                  const creatorIdStr = creator._id.toString();
                  const isSelected = selectedForComparison.includes(creatorIdStr);
                  const isDisabled = !isSelected && selectedForComparison.length >= MAX_CREATORS_TO_COMPARE;
                  const alertIcons: { [key: string]: string } = {
                    'PeakShares': '[PS]',
                    'DropWatchTime': '[DWT]',
                    'ForgottenFormat': '[FF]',
                  };
                  return (
                    <tr key={creatorIdStr} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                      <td className="px-6 py-4 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => handleCompareSelectChange(creatorIdStr)} disabled={isDisabled} className={`h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`} />
                      </td>
                      <td className="px-6 py-4"><span className="text-indigo-600 hover:underline cursor-pointer font-medium" onClick={() => handleOpenCreatorModal(creator)}>{getSafeString(creator.name)}</span></td>
                      <td className="px-6 py-4 text-right">{formatNumber(creator.totalPosts)}</td>
                      <td className="px-6 py-4 text-right">{formatEngagement(creator.avgEngagementRate)}</td>
                      <td className="px-6 py-4 text-center">{formatDate(creator.lastActivityDate)}</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${creator.planStatus === 'Pro' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{getSafeString(creator.planStatus)}</span></td>
                      <td className="px-6 py-4 text-center text-xs">
                        {creator.recentAlerts && creator.recentAlerts.length > 0 ? (
                          <div className="flex flex-col items-center">
                            <span>{creator.recentAlerts.length} Alerta(s)</span>
                            <div className="flex mt-1 space-x-1">
                              {creator.recentAlerts.map((alert, index) => (
                                <span key={index} title={`${alert.type} em ${new Date(alert.date).toLocaleDateString()}`} className="cursor-default">
                                  {alertIcons[alert.type] || '[UKN]'} {/* UKN for Unknown type */}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Nenhum</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleOpenCreatorModal(creator)} className="flex items-center justify-center w-full bg-white text-indigo-600 border border-indigo-300 py-1 px-2.5 rounded-md text-xs hover:bg-indigo-50">
                          <InformationCircleIcon className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalCreators > 0 && (
          <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4">
            <p className="text-sm text-gray-700">Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalCreators} criadores)</p>
            <div>
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 border border-gray-300 text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Anterior</button>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="ml-3 px-4 py-2 border border-gray-300 text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {isDetailModalOpen && selectedCreatorForModal && (
          <CreatorDetailModal
              isOpen={isDetailModalOpen}
              onClose={handleCloseDetailModal}
              creatorId={selectedCreatorForModal.id}
              creatorName={selectedCreatorForModal.name}
              dateRangeFilter={dateRangeFilter}
          />
      )}
      {isComparisonModalOpen && (
          <CreatorComparisonModal
              isOpen={isComparisonModalOpen}
              onClose={handleCloseComparisonModal}
              creatorIdsToCompare={selectedForComparison}
          />
      )}
    </>
  );
});

export default CreatorTable;
