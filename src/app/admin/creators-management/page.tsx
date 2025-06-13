// src/app/admin/creators-management/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  AdminCreatorListItem,
  AdminCreatorListParams,
  AdminCreatorStatus,
  // ADMIN_CREATOR_STATUS_OPTIONS // Supondo que você adicionou isso em types
} from '@/types/admin/creators'; // Ajuste o caminho se necessário
import {
    MagnifyingGlassIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    PencilIcon,
    NoSymbolIcon
} from '@heroicons/react/24/outline';

// Definição de ADMIN_CREATOR_STATUS_OPTIONS se não estiver em types/admin/creators.ts
const STATUS_OPTIONS: AdminCreatorStatus[] = ['pending', 'approved', 'rejected', 'active'];


interface SortConfig {
  sortBy: keyof AdminCreatorListItem | string;
  sortOrder: 'asc' | 'desc';
}

// Simples Modal de Confirmação (pode ser extraído/melhorado)
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isLoading }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string, isLoading?: boolean }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:bg-red-400">
            {isLoading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};


export default function CreatorsManagementPage() {
  const [creators, setCreators] = useState<AdminCreatorListItem[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros e Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10); // Pode ser configurável
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminCreatorStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<string>(''); // Exemplo, pode ser mais complexo

  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'registrationDate', sortOrder: 'desc' });

  // Para o modal de mudança de status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCreatorForStatusChange, setSelectedCreatorForStatusChange] = useState<AdminCreatorListItem | null>(null);
  const [newStatusForCreator, setNewStatusForCreator] = useState<AdminCreatorStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);


  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const fetchCreatorData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
    });

    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    if (statusFilter) params.append('status', statusFilter);
    if (planFilter) params.append('planStatus', planFilter); // A API precisa suportar isso

    try {
      const response = await fetch(`/api/admin/creators?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar criadores');
      }
      const data = await response.json();
      setCreators(data.creators || []);
      setTotalCreators(data.totalCreators || 0);
      setTotalPages(data.totalPages || 0);
    } catch (e: any) {
      setError(e.message);
      setCreators([]);
      setTotalCreators(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, debouncedSearchTerm, statusFilter, planFilter, sortConfig]);

  useEffect(() => {
    fetchCreatorData();
  }, [fetchCreatorData]);

  const handleSort = (columnKey: keyof AdminCreatorListItem | string) => {
    let newSortOrder: 'asc' | 'desc' = 'asc';
    if (sortConfig.sortBy === columnKey && sortConfig.sortOrder === 'asc') {
      newSortOrder = 'desc';
    }
    setSortConfig({ sortBy: columnKey, sortOrder: newSortOrder });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: keyof AdminCreatorListItem | string) => {
    if (sortConfig.sortBy !== columnKey) {
      return <ChevronDownIcon className="w-3 h-3 inline text-gray-400 ml-1 opacity-50" />;
    }
    return sortConfig.sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 inline text-indigo-600 ml-1" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline text-indigo-600 ml-1" />
    );
  };

  const openChangeStatusModal = (creator: AdminCreatorListItem, newStatus: AdminCreatorStatus) => {
    setSelectedCreatorForStatusChange(creator);
    setNewStatusForCreator(newStatus);
    setIsModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedCreatorForStatusChange || !newStatusForCreator) return;
    setIsUpdatingStatus(true);
    setError(null); // Clear previous errors

    try {
      const response = await fetch(`/api/admin/creators/${selectedCreatorForStatusChange._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatusForCreator }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar status');
      }
      // Atualizar a lista ou o item específico
      // fetchCreatorData(); // Re-fetch a lista inteira (mais simples, mas pode perder a página atual se não for cuidadoso)
      // Ou atualizar localmente para resposta mais rápida:
      setCreators(prev => prev.map(c =>
        c._id === selectedCreatorForStatusChange._id ? { ...c, adminStatus: newStatusForCreator } : c
      ));
      // Consider adding a success notification here
    } catch (e: any) {
      setError(e.message); // Mostrar erro para o usuário
      // Consider adding an error notification here
    } finally {
      setIsUpdatingStatus(false);
      setIsModalOpen(false);
      setSelectedCreatorForStatusChange(null);
      setNewStatusForCreator(null);
    }
  };

  const getStatusColor = (status: AdminCreatorStatus) => {
    switch (status) {
      case 'approved':
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const statusIcons: Record<AdminCreatorStatus, React.ElementType> = {
    approved: CheckCircleIcon,
    active: CheckCircleIcon,
    pending: ClockIcon,
    rejected: XCircleIcon,
  };


  const columns = useMemo(() => [
    { key: 'name', label: 'Nome', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'registrationDate', label: 'Data Registro', sortable: true },
    { key: 'planStatus', label: 'Plano', sortable: true }, // Assuming planStatus is sortable on the backend
    { key: 'adminStatus', label: 'Status Admin', sortable: true },
    { key: 'actions', label: 'Ações', sortable: false },
  ], []);


  return (
    <div className="space-y-6">
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmStatusChange}
        title={`Confirmar Mudança de Status para "${newStatusForCreator}"`}
        message={`Você tem certeza que deseja alterar o status de "${selectedCreatorForStatusChange?.name}" para "${newStatusForCreator}"?`}
        isLoading={isUpdatingStatus}
      />

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Criadores</h1>
      </header>

      {/* Filtros */}
      <div className="p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end"> {/* Adjusted grid for more filters */}
          <div className="md:col-span-2 lg:col-span-2"> {/* Search input takes more space */}
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Buscar</label>
            <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                type="text"
                name="search"
                id="search"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                placeholder="Nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700">Status Admin</label>
            <select
              id="statusFilter"
              name="statusFilter"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AdminCreatorStatus | ''); setCurrentPage(1);}}
            >
              <option value="">Todos os Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="planFilter" className="block text-sm font-medium text-gray-700">Plano</label>
             <input // Placeholder for plan filter - can be a select
              type="text"
              id="planFilter"
              name="planFilter"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              placeholder="Ex: Free, Pro"
              value={planFilter}
              onChange={(e) => {setPlanFilter(e.target.value); setCurrentPage(1);}}
            />
          </div>
        </div>
      </div>

      {isLoading && <div className="text-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p className="mt-2 text-gray-500">Carregando criadores...</p></div>}
      {error && <p className="text-center py-4 text-red-600 bg-red-100 p-3 rounded-md">Erro ao carregar dados: {error}</p>}

      {!isLoading && !error && creators.length === 0 && (
        <div className="text-center py-10 text-gray-500 bg-white shadow rounded-lg p-6">
            <NoSymbolIcon className="w-12 h-12 mx-auto text-gray-400 mb-2"/>
            Nenhum criador encontrado com os filtros atuais.
        </div>
      )}

      {!isLoading && !error && creators.length > 0 && (
        <div className="bg-white shadow overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="flex items-center">
                        {col.label}
                        {col.sortable && renderSortIcon(col.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {creators.map((creator) => {
                const StatusIcon = statusIcons[creator.adminStatus] || NoSymbolIcon;
                return (
                <tr key={creator._id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {creator.profilePictureUrl ? (
                          <Image className="h-10 w-10 rounded-full object-cover" src={creator.profilePictureUrl} alt={creator.name} width={40} height={40} />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
                            {creator.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{creator.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {creator.registrationDate ? new Date(creator.registrationDate).toLocaleDateString('pt-BR') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{creator.planStatus || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${getStatusColor(creator.adminStatus)}`}>
                      <StatusIcon className="w-3.5 h-3.5 mr-1.5 -ml-0.5" />
                      {creator.adminStatus.charAt(0).toUpperCase() + creator.adminStatus.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    {/* Ações: Aprovar, Rejeitar, etc. */}
                    {['pending', 'rejected'].includes(creator.adminStatus) && (
                        <button onClick={() => openChangeStatusModal(creator, 'approved')} className="text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-full hover:bg-green-100" disabled={isUpdatingStatus} title="Aprovar">
                            <CheckCircleIcon className="w-5 h-5"/>
                        </button>
                    )}
                    {['pending', 'approved', 'active'].includes(creator.adminStatus) && (
                        <button onClick={() => openChangeStatusModal(creator, 'rejected')} className="text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-full hover:bg-red-100" disabled={isUpdatingStatus} title="Rejeitar">
                            <XCircleIcon className="w-5 h-5"/>
                        </button>
                    )}
                    {/* Adicionar botão de editar (PencilIcon) para outras edições se necessário
                    <button className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100" title="Editar">
                        <PencilIcon className="w-5 h-5"/>
                    </button>
                    */}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {!isLoading && !error && totalPages > 0 && (
        <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4">
          <p className="text-sm text-gray-700">
            Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalCreators} criadores)
          </p>
          <div className="flex-1 flex justify-end space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="ml-2 relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
