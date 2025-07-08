'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { ChevronUpIcon, ChevronDownIcon, UserGroupIcon, InformationCircleIcon, UsersIcon } from '@heroicons/react/24/outline';

// Importa os componentes centralizados
import SkeletonBlock from '../components/SkeletonBlock';
import EmptyState from '../components/EmptyState';

// Importa os tipos do serviço modularizado
import { IDashboardCreator } from '@/app/lib/dataService/marketAnalysis/types';


// --- Configurações e Tipos ---

const DEBOUNCE_DELAY = 500;
const MAX_CREATORS_TO_COMPARE = 3;

// OTIMIZAÇÃO: A interface de props foi atualizada para receber as funções de callback do pai.
interface CreatorTableProps {
  planStatusFilter?: string;
  expertiseLevelFilter?: string;
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
  onCreatorClick: (creator: { id: string; name: string }) => void;
  onCompareClick: (creatorIds: string[]) => void;
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const CreatorTable = memo(function CreatorTable({
  planStatusFilter,
  expertiseLevelFilter,
  dateRangeFilter,
  onCreatorClick,
  onCompareClick,
}: CreatorTableProps) {
  const [creators, setCreators] = useState<IDashboardCreator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'totalPosts', sortOrder: 'desc' });

  const [nameSearch, setNameSearch] = useState('');
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('');

  // OTIMIZAÇÃO: O estado do modal foi removido daqui e é gerido pela página pai.
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  const handleCompareSelectChange = useCallback((creatorId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(creatorId)) return prev.filter(id => id !== creatorId);
      if (prev.length < MAX_CREATORS_TO_COMPARE) return [...prev, creatorId];
      return prev;
    });
  }, []);

  const handleInitiateComparison = useCallback(() => {
    if (selectedForComparison.length >= 2) {
      onCompareClick(selectedForComparison);
    }
  }, [selectedForComparison, onCompareClick]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNameSearch(nameSearch);
      setCurrentPage(1);
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
    if (dateRangeFilter?.startDate) queryParams.append('startDate', new Date(dateRangeFilter.startDate).toISOString());
    if (dateRangeFilter?.endDate) {
      const end = new Date(dateRangeFilter.endDate);
      end.setUTCHours(23, 59, 59, 999);
      queryParams.append('endDate', end.toISOString());
    }

    try {
      // Simula um delay de rede
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockCreators: IDashboardCreator[] = Array.from({ length: limit }).map((_, i) => ({
        _id: { toString: () => `id_${currentPage}_${i}` } as any,
        name: `Criador da Tabela ${currentPage}-${i}`,
        totalPosts: Math.floor(Math.random() * 250),
        avgEngagementRate: Math.random() * 0.12,
        lastActivityDate: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000),
        planStatus: ['Free', 'Pro', 'Premium'][i % 3],
      }));

      setCreators(mockCreators);
      setTotalCreators(50); // Total de mocks
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, sortConfig, debouncedNameSearch, planStatusFilter, expertiseLevelFilter, dateRangeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(totalCreators / limit);

  const handleSort = useCallback((columnKey: string) => {
    setSortConfig(current => ({ sortBy: columnKey, sortOrder: current.sortBy === columnKey && current.sortOrder === 'asc' ? 'desc' : 'asc' }));
    setCurrentPage(1);
  }, []);

  const renderSortIcon = useCallback((columnKey: string) => {
    if (sortConfig.sortBy !== columnKey) return <ChevronDownIcon className="w-4 h-4 inline text-gray-400" />;
    return sortConfig.sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4 inline text-indigo-600" /> : <ChevronDownIcon className="w-4 h-4 inline text-indigo-600" />;
  }, [sortConfig]);
  
  const formatDate = (date?: Date | string) => date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';
  const formatEngagement = (rate?: number) => typeof rate === 'number' ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  const columns = [
    { key: 'select', label: '', sortable: false, className: 'w-12 text-center' },
    { key: 'name', label: 'Criador', sortable: true },
    { key: 'totalPosts', label: 'Posts', sortable: true, className: 'text-right' },
    { key: 'avgEngagementRate', label: 'Engaj. Médio', sortable: true, className: 'text-right' },
    { key: 'lastActivityDate', label: 'Última Atividade', sortable: true, className: 'text-center' },
    { key: 'planStatus', label: 'Plano', sortable: true, className: 'text-center' },
    { key: 'actions', label: 'Ações', sortable: false, className: 'text-center' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Análise de Criadores</h3>
          <p className="text-sm text-gray-500 mt-1">Explore, filtre e compare os criadores da plataforma.</p>
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>{columns.map(col => (<th key={col.key} scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${col.className || 'text-left'}`} onClick={() => col.sortable && handleSort(col.key)}>{col.label} {col.sortable && renderSortIcon(col.key)}</th>))}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: limit }).map((_, index) => (
                <tr key={`skel-${index}`}>
                  <td className="px-6 py-4 text-center"><SkeletonBlock variant="rectangle" width="w-4" height="h-4" className="mx-auto" /></td>
                  <td className="px-6 py-4"><div className="flex items-center"><SkeletonBlock variant="circle" width="w-10" height="h-10" /><div className="ml-3"><SkeletonBlock width="w-32" height="h-3" /></div></div></td>
                  <td className="px-6 py-4 text-right"><SkeletonBlock width="w-12" height="h-3" /></td>
                  <td className="px-6 py-4 text-right"><SkeletonBlock width="w-16" height="h-3" /></td>
                  <td className="px-6 py-4 text-center"><SkeletonBlock width="w-20" height="h-3" /></td>
                  <td className="px-6 py-4 text-center"><SkeletonBlock width="w-16" height="h-5" /></td>
                  <td className="px-6 py-4 text-center"><SkeletonBlock width="w-24" height="h-6" /></td>
                </tr>
              ))
            ) : error ? (
              <tr><td colSpan={columns.length} className="text-center py-10 text-red-500">Erro ao carregar criadores: {error}</td></tr>
            ) : creators.length === 0 ? (
              <tr><td colSpan={columns.length}><EmptyState icon={<UsersIcon className="w-12 h-12" />} title="Nenhum Criador Encontrado" message="Tente ajustar os filtros para encontrar criadores."/></td></tr>
            ) : (
              creators.map(creator => {
                const id = creator._id.toString();
                const isSelected = selectedForComparison.includes(id);
                const isDisabled = !isSelected && selectedForComparison.length >= MAX_CREATORS_TO_COMPARE;
                return (
                  <tr key={id} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={isSelected} onChange={() => handleCompareSelectChange(id)} disabled={isDisabled} className={`h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`} /></td>
                    <td className="px-6 py-4"><span className="text-indigo-600 hover:underline cursor-pointer font-medium" onClick={() => onCreatorClick({ id, name: creator.name })}>{creator.name}</span></td>
                    <td className="px-6 py-4 text-right">{creator.totalPosts.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 text-right">{formatEngagement(creator.avgEngagementRate)}</td>
                    <td className="px-6 py-4 text-center">{formatDate(creator.lastActivityDate)}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${creator.planStatus === 'Pro' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{creator.planStatus}</span></td>
                    <td className="px-6 py-4 text-center"><button onClick={() => onCreatorClick({ id, name: creator.name })} className="text-indigo-600 hover:text-indigo-900 text-sm">Detalhes</button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {totalCreators > 0 && !isLoading && (
        <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4">
          <p className="text-sm text-gray-700">Página {currentPage} de {totalPages} ({totalCreators} criadores)</p>
          <div>
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50">Anterior</button>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="ml-3 px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50">Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
});

export default CreatorTable;
