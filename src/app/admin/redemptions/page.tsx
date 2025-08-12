"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaFileCsv } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

// Importando hooks e componentes reutilizáveis
import { useAdminList } from '../../../hooks/useAdminList';
import { SkeletonTable } from '../../components/SkeletonTable';
import { UserAvatar } from '../../components/UserAvatar';
import { StatusBadge } from '../../components/StatusBadge';
// ===== CORREÇÃO APLICADA AQUI =====
// A importação agora inclui o SearchIcon, se necessário, e corrige o erro de módulo.
import { SearchBar, SearchIcon } from '../../components/SearchBar';
import { EmptyState } from '../../components/EmptyState';
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";

export const dynamic = 'force-dynamic';

interface UserInfo {
  _id: string;
  name?: string;
  email?: string;
  profilePictureUrl?: string;
}

interface RedemptionAdmin {
  _id: string;
  user: UserInfo;
  amount: number;
  status: "pending" | "paid" | "canceled";
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

type UpdateStatusState = {
    [key: string]: 'loading' | 'idle';
};

// --- Mapeamento de Status ---
const REDEMPTION_STATUS_MAPPINGS = {
  paid:     { label: 'Pago',      bgColor: 'bg-green-100',  textColor: 'text-green-800',  borderColor: 'border-green-200' },
  pending:  { label: 'Pendente',  bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
  canceled: { label: 'Cancelado', bgColor: 'bg-red-100',   textColor: 'text-red-800',   borderColor: 'border-red-200' },
};


interface ActionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  redemption: RedemptionAdmin | null;
  currentNotes: string;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
  actionToConfirm: 'paid' | 'canceled' | null;
  isLoadingAction: boolean;
}

const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  isOpen, onClose, redemption, currentNotes, onNotesChange, onConfirm, actionToConfirm, isLoadingAction
}) => {
  if (!isOpen || !redemption || !actionToConfirm) return null;

  const actionText = actionToConfirm === 'paid' ? 'Marcar como Pago' : 'Cancelar Resgate';
  const confirmButtonColor = actionToConfirm === 'paid' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{actionText}</h3>
        <p className="text-sm text-gray-600 mb-1">Afiliado: <span className="font-medium">{redemption.user.name || redemption.user.email}</span></p>
        <p className="text-sm text-gray-600 mb-4">Valor: <span className="font-medium">{redemption.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
        <div className="mb-4">
          <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 mb-1">Notas Administrativas (Opcional):</label>
          <textarea id="adminNotes" rows={3} className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-brand-pink focus:border-brand-pink" value={currentNotes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Ex: Pago em DD/MM/AAAA, ID Transferência XYZ..."/>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors" disabled={isLoadingAction}>Cancelar</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white ${confirmButtonColor} rounded-md transition-colors disabled:opacity-50`} disabled={isLoadingAction}>
            {isLoadingAction ? <FaSpinner className="animate-spin inline mr-2" /> : null} Confirmar {actionText.split(' ')[0]}
          </button>
        </div>
      </motion.div>
    </div>
  );
};


// --- Componente Principal da Página ---
export default function AdminRedemptionsPage() {
  const { data: session, status: sessionStatus } = useSession();

  const {
    data, isLoading, error,
    page, setPage,
    limit, setLimit,
    filters, setFilters,
    reload,
  } = useAdminList<RedemptionAdmin>({
    endpoint: '/api/admin/redemptions',
    initialParams: {
        filters: { status: 'pending', search: '' },
        sort: { sortBy: 'createdAt', order: 'desc' }
    },
    syncWithUrl: true,
  });
  
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusState>({});
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedRedemptionForNotes, setSelectedRedemptionForNotes] = useState<RedemptionAdmin | null>(null);
  const [currentNotes, setCurrentNotes] = useState("");
  const [actionToConfirm, setActionToConfirm] = useState<'paid' | 'canceled' | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setPage(1); 
    setFilters(prev => ({ ...prev, search: value }));
  }, [setFilters, setPage]);

  const handleFilterChange = (newStatus: string) => {
    setPage(1);
    setFilters(prev => ({ ...prev, status: newStatus }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPage(1);
    setLimit(newLimit);
  };

  const openNotesModal = (redemption: RedemptionAdmin, action: 'paid' | 'canceled') => {
    setSelectedRedemptionForNotes(redemption);
    setCurrentNotes(redemption.notes || "");
    setActionToConfirm(action);
    setIsNotesModalOpen(true);
  };

  const handleUpdateStatusAndNotes = async () => {
    if (!selectedRedemptionForNotes || !actionToConfirm) return;
    const redeemId = selectedRedemptionForNotes._id;
    setUpdateStatus(prev => ({ ...prev, [redeemId]: 'loading' }));
    
    try {
      const response = await fetch('/api/affiliate/redeem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemId, newStatus: actionToConfirm, adminNotes: currentNotes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar status');
      
      toast.success('Status do resgate atualizado com sucesso!');
      reload(); // Recarrega a lista
      setIsNotesModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar o status.');
    } finally {
        setUpdateStatus(prev => ({ ...prev, [redeemId]: 'idle' }));
    }
  };

  const handleExportCSV = () => {
    window.open(`/api/admin/redemptions?status=${filters.status}&export=csv&searchQuery=${filters.search}`, '_blank');
  };

  if (sessionStatus === 'loading') {
    return ( <div className="flex justify-center items-center min-h-screen"><FaSpinner className="animate-spin w-8 h-8 text-brand-pink" /></div> );
  }

  const tableCols = (filters.status === 'pending' || filters.status === 'all') ? 6 : 5;

  return (
    <>
      <ActionConfirmationModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} redemption={selectedRedemptionForNotes} currentNotes={currentNotes} onNotesChange={setCurrentNotes} onConfirm={handleUpdateStatusAndNotes} actionToConfirm={actionToConfirm} isLoadingAction={selectedRedemptionForNotes ? updateStatus[selectedRedemptionForNotes._id] === 'loading' : false} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Gerir Resgates {data?.totalItems ? `(${data.totalItems})` : ''}</h1>
            <button onClick={handleExportCSV} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm"><FaFileCsv className="w-4 h-4"/> Exportar CSV</button>
        </div>
        
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Status</label>
            <div className="flex flex-wrap gap-2">
              {(['pending', 'paid', 'canceled', 'all'] as const).map((statusOption) => (
                <button key={statusOption} onClick={() => handleFilterChange(statusOption)} className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${filters.status === statusOption ? 'bg-pink-600 text-white border-pink-600 font-semibold shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar por Afiliado</label>
            {/* ===== CORREÇÃO APLICADA AQUI ===== */}
            <SearchBar value={filters.search} onSearchChange={handleSearchChange} placeholder="Nome ou e-mail do afiliado..." />
          </div>
        </div>
        
        {isLoading ? <SkeletonTable rows={limit} cols={tableCols} />
        : error ? <EmptyState icon={<FaExclamationTriangle className="w-10 h-10" />} title="Erro ao carregar resgates" description={error} action={<button onClick={reload} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Tentar Novamente</button>} />
        : (
          <>
            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">Data</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">Afiliado</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">Valor</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">Notas</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">Status</th>
                    {(filters.status === 'pending' || filters.status === 'all') && (<th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">Ações</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items.length === 0 ? (
                    <tr><td colSpan={tableCols}><EmptyState icon={<CurrencyDollarIcon className="w-12 h-12"/>} title="Nenhum resgate encontrado" description="Tente ajustar os seus filtros." action={<button onClick={() => setFilters({status: 'all', search: ''})} className="px-3 py-1 bg-blue-500 text-white rounded">Limpar filtros</button>} /></td></tr>
                  ) : (
                    data?.items.map((r) => (
                      <tr key={r._id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("pt-BR", { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-4 py-3"><div className="flex items-center gap-3">
                            <UserAvatar name={r.user?.name || r.user?.email || 'A'} src={r.user?.profilePictureUrl} size={32} />
                            <div>
                                <div className="font-medium text-gray-800">{r.user?.name || 'N/A'}</div>
                                <div className="text-xs text-gray-500">{r.user?.email || 'N/A'}</div>
                            </div>
                        </div></td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] whitespace-pre-wrap">{r.notes || <span className="italic text-gray-400">N/A</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} mappings={REDEMPTION_STATUS_MAPPINGS} /></td>
                        {(filters.status === 'pending' || (filters.status === 'all' && r.status === 'pending')) && (
                          <td className="px-4 py-3 whitespace-nowrap"><div className="flex gap-2">
                            <button onClick={() => openNotesModal(r, 'paid')} disabled={updateStatus[r._id] === 'loading'} className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"><FaCheckCircle className="w-3 h-3"/>Pago</button>
                            <button onClick={() => openNotesModal(r, 'canceled')} disabled={updateStatus[r._id] === 'loading'} className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"><FaTimesCircle className="w-3 h-3"/>Cancelar</button>
                          </div></td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {data && data.totalItems > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="itemsPerPage" className="text-gray-600">Itens/pág:</label>
                    <select id="itemsPerPage" value={limit} onChange={(e) => handleLimitChange(Number(e.target.value))} className="block py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm">
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                    </select>
                </div>
                <nav className="flex items-center gap-2">
                  <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 border rounded-md disabled:opacity-50">Anterior</button>
                  <span className="px-2">Página {page} de {data.totalPages}</span>
                  <button onClick={() => setPage(page + 1)} disabled={page === data.totalPages} className="px-3 py-1.5 border rounded-md disabled:opacity-50">Próxima</button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}