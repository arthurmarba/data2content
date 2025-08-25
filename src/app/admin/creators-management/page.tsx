// src/app/admin/creators-management/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  AdminCreatorListItem,
  AdminCreatorListParams,
  AdminCreatorStatus,
} from '@/types/admin/creators'; // Ajuste o caminho se necessário
import { PLAN_STATUSES, type PlanStatus } from '@/types/enums';
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
import StatusBadge from '../components/StatusBadge'; // Ajuste o caminho se necessário
import ModalConfirm from '../components/ModalConfirm'; // Ajuste o caminho se necessário
import toast from 'react-hot-toast';
import TableHeader, { ColumnConfig, SortConfig as TableSortConfig } from '../components/TableHeader'; // Verifique o caminho

// Definição de ADMIN_CREATOR_STATUS_OPTIONS se não estiver em types/admin/creators.ts
const STATUS_OPTIONS: AdminCreatorStatus[] = ['pending', 'approved', 'rejected', 'active'];

interface SortConfig {
  sortBy: keyof AdminCreatorListItem | string;
  sortOrder: 'asc' | 'desc';
}

export default function CreatorsManagementPage() {
  const [creators, setCreators] = useState<AdminCreatorListItem[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros e Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminCreatorStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<PlanStatus | ''>('');

  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'registrationDate', sortOrder: 'desc' });

  // Para o modal de mudança de status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCreatorForStatusChange, setSelectedCreatorForStatusChange] = useState<AdminCreatorListItem | null>(null);
  const [newStatusForCreator, setNewStatusForCreator] = useState<AdminCreatorStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Debounce do termo de busca
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reseta a página em nova busca
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
    if (planFilter) params.append('planStatus', planFilter.toLowerCase());

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
  
  const openChangeStatusModal = (creator: AdminCreatorListItem, newStatus: AdminCreatorStatus) => {
    setSelectedCreatorForStatusChange(creator);
    setNewStatusForCreator(newStatus);
    setIsModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedCreatorForStatusChange || !newStatusForCreator) return;
    setIsUpdatingStatus(true);
    
    const loadingToastId = toast.loading('Atualizando status...');

    try {
      const response = await fetch(`/api/admin/creators/${selectedCreatorForStatusChange._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatusForCreator }),
      });

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar status');
      }
      
      toast.success(`Status de "${selectedCreatorForStatusChange.name}" atualizado com sucesso!`);
      
      setCreators(prev => prev.map(c => 
        c._id === selectedCreatorForStatusChange._id ? { ...c, adminStatus: newStatusForCreator } : c
      ));

    } catch (e: any) {
      toast.dismiss(loadingToastId);
      toast.error(e.message || 'Ocorreu um erro ao atualizar o status.');
      setError(e.message);
    } finally {
      setIsUpdatingStatus(false);
      setIsModalOpen(false);
      setSelectedCreatorForStatusChange(null);
      setNewStatusForCreator(null);
    }
  };

  const handleGenerateMediaKit = async (creatorId: string) => {
    const loadingId = toast.loading('Gerando link...');
    try {
      const res = await fetch(`/api/admin/users/${creatorId}/generate-media-kit-token`, { method: 'POST' });
      toast.dismiss(loadingId);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao gerar link');
      }
      const data = await res.json();
      setCreators(prev => prev.map(c => c._id === creatorId ? { ...c, mediaKitSlug: data.slug } : c));
      toast.success('Link gerado!');
    } catch (e: any) {
      toast.dismiss(loadingId);
      toast.error(e.message);
    }
  };

  const handleRevokeMediaKit = async (creatorId: string) => {
    const loadingId = toast.loading('Revogando link...');
    try {
      const res = await fetch(`/api/admin/users/${creatorId}/media-kit-token`, { method: 'DELETE' });
      toast.dismiss(loadingId);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao revogar link');
      }
      setCreators(prev => prev.map(c => c._id === creatorId ? { ...c, mediaKitSlug: undefined } : c));
      toast.success('Link revogado!');
    } catch (e: any) {
      toast.dismiss(loadingId);
      toast.error(e.message);
    }
  };

  const columns: ColumnConfig<AdminCreatorListItem>[] = useMemo(() => [
    { key: 'name', label: 'Nome', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'registrationDate', label: 'Data Registro', sortable: true },
    { key: 'planStatus', label: 'Plano', sortable: true },
    { key: 'mediaKit', label: 'Mídia Kit', sortable: false },
    { key: 'adminStatus', label: 'Status Admin', sortable: true },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-right', className: 'text-right' },
  ], []);

  return (
    <div className="space-y-6">
      <ModalConfirm
        isOpen={isModalOpen}
        onClose={() => {
          if (isUpdatingStatus) return;
          setIsModalOpen(false);
        }}
        onConfirm={handleConfirmStatusChange}
        title={`Confirmar Mudança de Status`}
        message={
          selectedCreatorForStatusChange && newStatusForCreator
            ? `Você tem certeza que deseja alterar o status de "${selectedCreatorForStatusChange.name}" para "${newStatusForCreator.charAt(0).toUpperCase() + newStatusForCreator.slice(1)}"?`
            : 'Aguarde...'
        }
        confirmButtonText={isUpdatingStatus ? 'Atualizando...' : 'Confirmar Mudança'}
        confirmButtonColorClass={
          newStatusForCreator === 'approved' || newStatusForCreator === 'active'
            ? 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500'
            : 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
        }
        isConfirming={isUpdatingStatus}
      />

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Criadores</h1>
      </header>

      {/* Filtros */}
      <div className="p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 lg:col-span-2">
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
            <label htmlFor="planFilter" className="block text-sm font-medium text-gray-700">Status do Plano</label>
            <select
              id="planFilter"
              name="planFilter"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value.toLowerCase() as PlanStatus | ''); setCurrentPage(1); }}
            >
              <option value="">Todos os Status de Plano</option>
              {PLAN_STATUSES.map(status => (
                <option key={status} value={status}>
                  {status
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </option>
              ))}
            </select>
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
            <TableHeader columns={columns} sortConfig={sortConfig} onSort={handleSort} />
            <tbody className="bg-white divide-y divide-gray-200">
              {creators.map((creator) => (
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {creator.mediaKitSlug ? (
                      <div className="space-x-2">
                        <a
                          href={`/mediakit/${creator.mediaKitSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          Abrir
                        </a>
                        <button
                          onClick={() => handleRevokeMediaKit(creator._id)}
                          className="text-red-600 hover:underline"
                        >
                          Revogar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateMediaKit(creator._id)}
                        className="text-indigo-600 hover:underline"
                      >
                        Gerar
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={creator.adminStatus} size="sm" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
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
                    {/* Exemplo de botão de editar
                    <button className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100" title="Editar">
                        <PencilIcon className="w-5 h-5"/>
                    </button>
                    */}
                  </td>
                </tr>
              ))}
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
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              title="Primeira Página"
            >
              &laquo; Primeira
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              title="Página Anterior"
            >
              &lsaquo; Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              title="Próxima Página"
            >
              Próxima &rsaquo;
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || isLoading}
              className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              title="Última Página"
            >
              Última &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
