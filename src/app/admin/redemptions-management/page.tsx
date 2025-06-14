// src/app/admin/redemptions-management/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Removido Image pois não está sendo usado diretamente na listagem principal por enquanto
import {
  AdminRedemptionListItem,
  AdminRedemptionListParams,
  RedemptionStatus,
  REDEMPTION_STATUS_OPTIONS, // Importando de types
  AdminRedemptionUpdateStatusPayload,
} from '@/types/admin/redemptions'; // Ajuste o caminho se necessário
import TableHeader, { ColumnConfig, SortConfig } from '../components/TableHeader'; // Ajuste o caminho
// import StatusBadge from '../components/StatusBadge'; // Vamos usar uma config local por enquanto
import ModalConfirm from '../components/ModalConfirm'; // Ajuste o caminho
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  NoSymbolIcon,
  ArrowPathIcon, // Para 'processing'
  BanknotesIcon, // Para 'paid'
  ExclamationCircleIcon, // Para 'failed'
  BackspaceIcon, // Para 'cancelled'
  PencilIcon, // Para o botão de ação genérico
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Configuração de display para RedemptionStatus
const redemptionStatusDisplayConfig: Record<RedemptionStatus, { label: string, Icon: React.ElementType, colorClass: string, actions?: { to: RedemptionStatus, label: string, colorClass?: string }[] }> = {
  pending: {
    label: 'Pendente', Icon: ClockIcon, colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300',
    actions: [
        { to: 'approved', label: 'Aprovar', colorClass: 'text-green-600 hover:text-green-900' },
        { to: 'rejected', label: 'Rejeitar', colorClass: 'text-red-600 hover:text-red-900' }
    ]
  },
  approved: {
    label: 'Aprovado', Icon: CheckCircleIcon, colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300',
    actions: [
        { to: 'processing', label: 'Processar Pag.', colorClass: 'text-indigo-600 hover:text-indigo-900' },
        { to: 'paid', label: 'Marcar como Pago', colorClass: 'text-green-600 hover:text-green-900' },
        { to: 'failed', label: 'Marcar Falha Pag.', colorClass: 'text-red-600 hover:text-red-900' },
        { to: 'rejected', label: 'Rejeitar (Cancelar Apr.)', colorClass: 'text-gray-600 hover:text-gray-900' }
    ]
  },
  rejected: {
    label: 'Rejeitado', Icon: XCircleIcon, colorClass: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300',
    actions: [
        // Geralmente não há ação após rejeitar, mas pode ser reaberto para pendente se necessário
        // { to: 'pending', label: 'Reabrir', colorClass: 'text-yellow-600 hover:text-yellow-900' }
    ]
  },
  processing: {
    label: 'Processando', Icon: ArrowPathIcon, colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-700/30 dark:text-purple-300',
    actions: [
        { to: 'paid', label: 'Confirmar Pag.', colorClass: 'text-green-600 hover:text-green-900' },
        { to: 'failed', label: 'Marcar Falha Pag.', colorClass: 'text-red-600 hover:text-red-900' }
    ]
  },
  paid: {
    label: 'Pago', Icon: BanknotesIcon, colorClass: 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300',
    actions: [] // Geralmente nenhuma ação após pago
  },
  failed: {
    label: 'Falhou', Icon: ExclamationCircleIcon, colorClass: 'bg-pink-100 text-pink-700 dark:bg-pink-700/30 dark:text-pink-300',
    actions: [
        { to: 'pending', label: 'Reprocessar (Pendente)', colorClass: 'text-yellow-600 hover:text-yellow-900' },
    ]
  },
  cancelled: {
    label: 'Cancelado', Icon: BackspaceIcon, colorClass: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    actions: []
  },
};


export default function RedemptionsManagementPage() {
  const [redemptions, setRedemptions] = useState<AdminRedemptionListItem[]>([]);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros e Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RedemptionStatus | ''>('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');


  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ sortBy: 'requestedAt', sortOrder: 'desc' });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<AdminRedemptionListItem | null>(null);
  const [newStatusForRedemption, setNewStatusForRedemption] = useState<RedemptionStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const fetchRedemptionData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: AdminRedemptionListParams = {
      page: currentPage,
      limit: limit,
      sortBy: sortConfig?.sortBy || 'requestedAt',
      sortOrder: sortConfig?.sortOrder || 'desc',
    };

    if (debouncedSearchTerm) params.search = debouncedSearchTerm;
    if (statusFilter) params.status = statusFilter;
    if (dateFromFilter) params.dateFrom = new Date(dateFromFilter + 'T00:00:00.000Z').toISOString();
    if (dateToFilter) params.dateTo = new Date(dateToFilter + 'T23:59:59.999Z').toISOString();

    const queryParams = new URLSearchParams(params as any).toString();

    try {
      const response = await fetch(`/api/admin/redemptions?${queryParams}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar resgates');
      }
      const data = await response.json();
      setRedemptions(data.redemptions || []);
      setTotalRedemptions(data.totalRedemptions || 0);
      setTotalPages(data.totalPages || 0);
    } catch (e: any) {
      setError(e.message);
      // Reset data on error
      setRedemptions([]);
      setTotalRedemptions(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, debouncedSearchTerm, statusFilter, dateFromFilter, dateToFilter, sortConfig]);

  useEffect(() => {
    fetchRedemptionData();
  }, [fetchRedemptionData]);

  const handleSort = (columnKey: string) => {
    if (sortConfig && sortConfig.sortBy === columnKey) {
      setSortConfig({ ...sortConfig, sortOrder: sortConfig.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortConfig({ sortBy: columnKey, sortOrder: 'asc' });
    }
    setCurrentPage(1);
  };

  const openChangeStatusModal = (redemption: AdminRedemptionListItem, newStatus: RedemptionStatus) => {
    setSelectedRedemption(redemption);
    setNewStatusForRedemption(newStatus);
    setAdminNotes(redemption.adminNotes || '');
    setIsModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedRedemption || !newStatusForRedemption) return;

    setIsUpdatingStatus(true);
    const loadingToastId = toast.loading('Atualizando status do resgate...');

    const payload: AdminRedemptionUpdateStatusPayload = {
        status: newStatusForRedemption,
        adminNotes: adminNotes,
        // transactionId: // Coletar se necessário, ex: para 'paid'
    };

    try {
      const response = await fetch(`/api/admin/redemptions/${selectedRedemption._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar status do resgate');
      }

      toast.success(`Status do resgate de "${selectedRedemption.userName}" atualizado para "${redemptionStatusDisplayConfig[newStatusForRedemption]?.label || newStatusForRedemption}"!`);

      fetchRedemptionData();

    } catch (e: any) {
      toast.dismiss(loadingToastId);
      toast.error(e.message || 'Ocorreu um erro ao atualizar o status.');
    } finally {
      setIsUpdatingStatus(false);
      setIsModalOpen(false);
      setSelectedRedemption(null);
      setNewStatusForRedemption(null);
      setAdminNotes('');
    }
  };

  const columns: ColumnConfig<AdminRedemptionListItem>[] = useMemo(() => [
    { key: '_id', label: 'ID Resgate', sortable: true, className: 'text-xs', headerClassName: 'whitespace-nowrap' },
    { key: 'userName', label: 'Usuário', sortable: true, headerClassName: 'whitespace-nowrap' },
    { key: 'amount', label: 'Valor', sortable: true, className: 'text-right whitespace-nowrap', headerClassName: 'text-right whitespace-nowrap' },
    { key: 'status', label: 'Status', sortable: true, headerClassName: 'whitespace-nowrap' },
    { key: 'requestedAt', label: 'Solicitado Em', sortable: true, headerClassName: 'whitespace-nowrap' },
    { key: 'updatedAt', label: 'Atualizado Em', sortable: true, headerClassName: 'whitespace-nowrap' },
    { key: 'paymentMethod', label: 'Método Pag.', sortable: true, headerClassName: 'whitespace-nowrap' },
    { key: 'actions', label: 'Ações', sortable: false, className: 'text-center', headerClassName: 'text-center whitespace-nowrap' },
  ], []);

  const renderStatusBadge = (status: RedemptionStatus) => {
    const config = redemptionStatusDisplayConfig[status] || { label: status, Icon: NoSymbolIcon, colorClass: 'bg-gray-200 text-gray-800'};
    return (
        <span className={`px-2 py-0.5 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${config.colorClass}`}>
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
        title="Confirmar Mudança de Status do Resgate"
        message={
          selectedRedemption && newStatusForRedemption ? (
            <div>
              <p className="mb-4">
                Você tem certeza que deseja alterar o status do resgate de <span className="font-semibold">{selectedRedemption.amount.toLocaleString('pt-BR', { style: 'currency', currency: selectedRedemption.currency || 'BRL' })}</span> para <span className="font-semibold">{selectedRedemption.userName}</span> para "{redemptionStatusDisplayConfig[newStatusForRedemption]?.label || newStatusForRedemption}"?
              </p>
              <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700">Notas Administrativas (Opcional):</label>
              <textarea
                id="adminNotes"
                rows={3}
                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                disabled={isUpdatingStatus}
              />
            </div>
          ) : ''
        }
        confirmButtonText={isUpdatingStatus ? 'Atualizando...' : 'Confirmar Mudança'}
        confirmButtonColorClass={
            newStatusForRedemption === 'approved' || newStatusForRedemption === 'paid' ? 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500'
          : newStatusForRedemption === 'rejected' || newStatusForRedemption === 'failed' ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
          : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500' // Default para processing, etc.
        }
        isConfirming={isUpdatingStatus}
      />

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Resgates</h1>
      </header>

      {/* Filtros */}
      <div className="p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="searchRedemption" className="block text-sm font-medium text-gray-700">Buscar (ID, Usuário)</label>
             <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input type="text" name="searchRedemption" id="searchRedemption"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                    placeholder="ID, nome/email usuário..."
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="statusRedemptionFilter" className="block text-sm font-medium text-gray-700">Status</label>
            <select id="statusRedemptionFilter" value={statusFilter}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              onChange={(e) => { setStatusFilter(e.target.value as RedemptionStatus | ''); setCurrentPage(1);}}>
              <option value="">Todos</option>
              {REDEMPTION_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dateFromRedemption" className="block text-sm font-medium text-gray-700">De:</label>
            <input type="date" id="dateFromRedemption" value={dateFromFilter}
                onChange={(e) => {setDateFromFilter(e.target.value); setCurrentPage(1);}}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2"/>
          </div>
          <div>
            <label htmlFor="dateToRedemption" className="block text-sm font-medium text-gray-700">Até:</label>
            <input type="date" id="dateToRedemption" value={dateToFilter}
                onChange={(e) => {setDateToFilter(e.target.value); setCurrentPage(1);}}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2"/>
          </div>
          {/* Adicionar filtros de min/max Amount aqui se desejar */}
        </div>
      </div>

      {isLoading && <div className="text-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p className="mt-2 text-gray-500">Carregando resgates...</p></div>}
      {error && <p className="text-center py-4 text-red-600 bg-red-100 p-3 rounded-md">Erro ao carregar dados: {error}</p>}

      {!isLoading && !error && redemptions.length === 0 && (
        <div className="text-center py-10 text-gray-500 bg-white shadow rounded-lg p-6">
            <NoSymbolIcon className="w-12 h-12 mx-auto text-gray-400 mb-2"/>
            Nenhum resgate encontrado com os filtros atuais.
        </div>
      )}

      {!isLoading && !error && redemptions.length > 0 && (
        <div className="bg-white shadow overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <TableHeader columns={columns} sortConfig={sortConfig} onSort={handleSort} />
            <tbody className="bg-white divide-y divide-gray-200">
              {redemptions.map((redemption) => (
                <tr key={redemption._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500" title={redemption._id}>{redemption._id.slice(-8)}...</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900" title={redemption.userEmail}>{redemption.userName}</div>
                    <div className="text-xs text-gray-500">{redemption.userEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{redemption.amount.toLocaleString('pt-BR', { style: 'currency', currency: redemption.currency || 'BRL' })}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{renderStatusBadge(redemption.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(redemption.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{redemption.updatedAt ? new Date(redemption.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{redemption.paymentMethod || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Ações baseadas no status atual */}
                    <div className="flex items-center justify-center space-x-1">
                        {(redemptionStatusDisplayConfig[redemption.status]?.actions || []).map(action => (
                            <button
                                key={action.to}
                                onClick={() => openChangeStatusModal(redemption, action.to)}
                                className={`p-1 rounded hover:opacity-80 disabled:opacity-50 ${action.colorClass || 'text-gray-600 hover:text-gray-900'}`}
                                disabled={isUpdatingStatus}
                                title={action.label}
                            >
                                {/* Idealmente, usar ícones aqui também */}
                                <PencilIcon className="w-4 h-4" />
                                {/* {action.label} */}
                            </button>
                        ))}
                    </div>
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
            Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalRedemptions} resgates)
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
