// src/app/admin/affiliates-management/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  AdminAffiliateListItem,
  AdminAffiliateListParams,
  AdminAffiliateStatus,
  ADMIN_AFFILIATE_STATUS_OPTIONS, // Importando de types
} from '@/types/admin/affiliates'; // Ajuste o caminho se necessário
import TableHeader, { ColumnConfig, SortConfig } from '../components/TableHeader'; // Ajuste o caminho
// import StatusBadge from '../components/StatusBadge'; // Se for usar o StatusBadge genérico
import ModalConfirm from '../components/ModalConfirm'; // Ajuste o caminho
import {
    MagnifyingGlassIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    NoSymbolIcon,
    UserMinusIcon, // Para 'suspended'
    // UserPlusIcon, // Para 'pending_approval' - Usando ClockIcon de affiliateStatusDisplayConfig
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';


// Mapeamento de AdminAffiliateStatus para configuração de display
const affiliateStatusDisplayConfig: Record<AdminAffiliateStatus, { label: string, Icon: React.ElementType, colorClass: string }> = {
  pending_approval: { label: 'Pendente', Icon: ClockIcon, colorClass: 'bg-yellow-100 text-yellow-700' },
  active: { label: 'Ativo', Icon: CheckCircleIcon, colorClass: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inativo', Icon: NoSymbolIcon, colorClass: 'bg-gray-100 text-gray-700' },
  suspended: { label: 'Suspenso', Icon: UserMinusIcon, colorClass: 'bg-orange-100 text-orange-700' },
};


export default function AffiliatesManagementPage() {
  const [affiliates, setAffiliates] = useState<AdminAffiliateListItem[]>([]);
  const [totalAffiliates, setTotalAffiliates] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros e Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminAffiliateStatus | ''>('');

  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ sortBy: 'registrationDate', sortOrder: 'desc' });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAffiliateForChange, setSelectedAffiliateForChange] = useState<AdminAffiliateListItem | null>(null);
  const [newStatusForAffiliate, setNewStatusForAffiliate] = useState<AdminAffiliateStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const fetchAffiliateData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: AdminAffiliateListParams = {
      page: currentPage,
      limit: limit,
      sortBy: sortConfig?.sortBy || 'registrationDate',
      sortOrder: sortConfig?.sortOrder || 'desc',
    };

    if (debouncedSearchTerm) params.search = debouncedSearchTerm;
    if (statusFilter) params.status = statusFilter;

    const queryParams = new URLSearchParams(params as any).toString();

    try {
      const response = await fetch(`/api/admin/affiliates?${queryParams}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar afiliados');
      }
      const data = await response.json();
      setAffiliates(data.affiliates || []);
      setTotalAffiliates(data.totalAffiliates || 0);
      setTotalPages(data.totalPages || 0);
    } catch (e: any) {
      setError(e.message);
      setAffiliates([]);
      setTotalAffiliates(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, debouncedSearchTerm, statusFilter, sortConfig]);

  useEffect(() => {
    fetchAffiliateData();
  }, [fetchAffiliateData]);

  const handleSort = (columnKey: string) => {
    if (sortConfig && sortConfig.sortBy === columnKey) {
      setSortConfig({ ...sortConfig, sortOrder: sortConfig.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortConfig({ sortBy: columnKey, sortOrder: 'asc' });
    }
    setCurrentPage(1);
  };

  const openChangeStatusModal = (affiliate: AdminAffiliateListItem, newStatus: AdminAffiliateStatus) => {
    setSelectedAffiliateForChange(affiliate);
    setNewStatusForAffiliate(newStatus);
    setIsModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedAffiliateForChange || !newStatusForAffiliate) return;

    setIsUpdatingStatus(true);
    const loadingToastId = toast.loading('Atualizando status do afiliado...');

    try {
      const response = await fetch(`/api/admin/affiliates/${selectedAffiliateForChange.userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatusForAffiliate }),
      });

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar status do afiliado');
      }

      toast.success(`Status de "${selectedAffiliateForChange.name}" atualizado para "${ADMIN_AFFILIATE_STATUS_OPTIONS.find(opt => opt.value === newStatusForAffiliate)?.label || newStatusForAffiliate}"!`);

      // Atualizar a lista localmente ou re-fetch
      fetchAffiliateData(); // Re-fetch para simplicidade

    } catch (e: any) {
      toast.dismiss(loadingToastId);
      toast.error(e.message || 'Ocorreu um erro ao atualizar o status.');
    } finally {
      setIsUpdatingStatus(false);
      setIsModalOpen(false);
      setSelectedAffiliateForChange(null);
      setNewStatusForAffiliate(null);
    }
  };

  const columns: ColumnConfig<AdminAffiliateListItem>[] = useMemo(() => [
    { key: 'name', label: 'Nome', sortable: true, className: 'whitespace-nowrap' },
    { key: 'email', label: 'Email', sortable: true, className: 'whitespace-nowrap' },
    { key: 'affiliateCode', label: 'Cód. Afiliado', sortable: true },
    { key: 'affiliateStatus', label: 'Status', sortable: true },
    { key: 'totalInvites', label: 'Convites', sortable: true, className: 'text-right' },
    { key: 'currentBalance', label: 'Saldo (R$)', sortable: true, className: 'text-right' },
    { key: 'affiliateSince', label: 'Afiliado Desde', sortable: true },
    { key: 'actions', label: 'Ações', sortable: false, className: 'text-right' },
  ], []);

  const renderStatusBadge = (status: AdminAffiliateStatus) => {
    // Se StatusBadge for genérico o suficiente:
    // return <StatusBadge status={status} configMap={affiliateStatusDisplayConfig} size="sm" />;
    // Por enquanto, lógica local similar à página de criadores, mas usando affiliateStatusDisplayConfig:
    const config = affiliateStatusDisplayConfig[status] || { label: status, Icon: NoSymbolIcon, colorClass: 'bg-gray-200 text-gray-800'};
    return (
        <span className={`px-2.5 py-0.5 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${config.colorClass}`}>
            <config.Icon className="w-3.5 h-3.5 mr-1.5 -ml-0.5" />
            {config.label}
        </span>
    );
  };


  return (
    <div className="space-y-6">
       <ModalConfirm
        isOpen={isModalOpen}
        onClose={() => !isUpdatingStatus && setIsModalOpen(false)}
        onConfirm={handleConfirmStatusChange}
        title="Confirmar Mudança de Status"
        message={
          selectedAffiliateForChange && newStatusForAffiliate
            ? `Você tem certeza que deseja alterar o status de "${selectedAffiliateForChange.name}" para "${ADMIN_AFFILIATE_STATUS_OPTIONS.find(opt => opt.value === newStatusForAffiliate)?.label || newStatusForAffiliate}"?`
            : ''
        }
        confirmButtonText={isUpdatingStatus ? 'Atualizando...' : 'Confirmar'}
        confirmButtonColorClass={
            newStatusForAffiliate === 'active' ? 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500'
          : newStatusForAffiliate === 'suspended' ? 'bg-orange-600 hover:bg-orange-700 focus-visible:ring-orange-500'
          : 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' // Default para inactive ou pending_approval (se ação fosse rejeitar)
        }
        isConfirming={isUpdatingStatus}
      />

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Afiliados</h1>
      </header>

      {/* Filtros */}
      <div className="p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Buscar Afiliado</label>
             <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                type="text"
                name="search"
                id="search"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                placeholder="Nome, email ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700">Status do Afiliado</label>
            <select
              id="statusFilter"
              name="statusFilter"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AdminAffiliateStatus | ''); setCurrentPage(1);}}
            >
              <option value="">Todos os Status</option>
              {ADMIN_AFFILIATE_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p className="mt-2 text-gray-500">Carregando afiliados...</p></div>}
      {error && <p className="text-center py-4 text-red-600 bg-red-100 p-3 rounded-md">Erro ao carregar dados: {error}</p>}

      {!isLoading && !error && affiliates.length === 0 && (
        <div className="text-center py-10 text-gray-500 bg-white shadow rounded-lg p-6">
            <NoSymbolIcon className="w-12 h-12 mx-auto text-gray-400 mb-2"/>
            Nenhum afiliado encontrado com os filtros atuais.
        </div>
      )}

      {!isLoading && !error && affiliates.length > 0 && (
        <div className="bg-white shadow overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <TableHeader columns={columns} sortConfig={sortConfig} onSort={handleSort} />
            <tbody className="bg-white divide-y divide-gray-200">
              {affiliates.map((affiliate) => (
                <tr key={affiliate.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {affiliate.profilePictureUrl ? (
                          <Image className="h-10 w-10 rounded-full object-cover" src={affiliate.profilePictureUrl} alt={affiliate.name} width={40} height={40} />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
                            {affiliate.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{affiliate.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{affiliate.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{affiliate.affiliateCode || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{renderStatusBadge(affiliate.affiliateStatus)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{affiliate.totalInvites?.toLocaleString('pt-BR') ?? 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{affiliate.currentBalance?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {affiliate.affiliateSince ? new Date(affiliate.affiliateSince).toLocaleDateString('pt-BR') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {/* Ações: Ativar, Suspender, etc. */}
                    {affiliate.affiliateStatus === 'pending_approval' && (
                        <button onClick={() => openChangeStatusModal(affiliate, 'active')} className="text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-full hover:bg-green-100" disabled={isUpdatingStatus} title="Aprovar Afiliado">
                            <CheckCircleIcon className="w-5 h-5"/>
                        </button>
                    )}
                    {affiliate.affiliateStatus === 'active' && (
                        <button onClick={() => openChangeStatusModal(affiliate, 'suspended')} className="text-orange-600 hover:text-orange-900 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-full hover:bg-orange-100" disabled={isUpdatingStatus} title="Suspender Afiliado">
                            <UserMinusIcon className="w-5 h-5"/>
                        </button>
                    )}
                     {affiliate.affiliateStatus === 'suspended' && (
                        <button onClick={() => openChangeStatusModal(affiliate, 'active')} className="text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-full hover:bg-green-100" disabled={isUpdatingStatus} title="Reativar Afiliado">
                             <CheckCircleIcon className="w-5 h-5"/>
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {!isLoading && totalPages > 1 && (
        <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4">
          <p className="text-sm text-gray-700">
            Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalAffiliates} afiliados)
          </p>
          <div className="flex-1 flex justify-end space-x-2">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1 || isLoading} className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50" title="Primeira Página">&laquo; Primeira</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isLoading} className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50" title="Página Anterior">&lsaquo; Anterior</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || isLoading} className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50" title="Próxima Página">Próxima &rsaquo;</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || isLoading} className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50" title="Última Página">Última &raquo;</button>
          </div>
        </div>
      )}
    </div>
  );
}
