"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSpinner, FaSort, FaSortUp, FaSortDown, FaTimesCircle, FaAngleLeft, FaAngleRight, FaTrophy, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Importando os novos componentes reutilizáveis
import { SkeletonTable } from '../../components/SkeletonTable';
import { UserAvatar } from '../../components/UserAvatar';
import { StatusBadge } from '../../components/StatusBadge';
import { SearchBar } from '../../components/SearchBar';
import { useAdminList } from '../../../hooks/useAdminList';
import { EmptyState } from '../../components/EmptyState';
import { UserGroupIcon } from '@heroicons/react/24/outline';


export const dynamic = 'force-dynamic';

// --- Interfaces ---
interface AffiliateAdminData {
  _id: string;
  name?: string;
  email: string;
  profilePictureUrl?: string; // Adicionado para o avatar
  affiliateCode?: string;
  affiliateBalance?: number;
  affiliateInvites?: number;
  affiliateRank?: number;
  planStatus?: 'active' | 'pending_approval' | 'inactive' | 'suspended'; // Tipagem mais forte
  createdAt?: string;
}

// --- Mapeamento de Status para o novo StatusBadge ---
const AFFILIATE_STATUS_MAPPINGS = {
  active:   { label: 'Ativo',     bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200' },
  pending_approval:  { label: 'Pendente',  bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
  inactive: { label: 'Inativo',   bgColor: 'bg-gray-100',  textColor: 'text-gray-800', borderColor: 'border-gray-200' },
  suspended: { label: 'Suspenso', bgColor: 'bg-red-100',   textColor: 'text-red-800',   borderColor: 'border-red-200' },
};

type UpdateStatusState = {
    [key: string]: 'approving' | 'suspending' | 'idle';
};


// --- Componentes Auxiliares ---
const TableHeader = ({
  children,
  sortable = false,
  sortKey,
  currentSort,
  onSort,
}: {
  children: React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  currentSort: { sortBy: string; order: 'asc' | 'desc' | string }; // Corrigido para aceitar string
  onSort?: (key: string) => void;
}) => {
  const isCurrentSortKey = currentSort.sortBy === sortKey;
  const Icon = isCurrentSortKey ? (currentSort.order === 'asc' ? FaSortUp : FaSortDown) : FaSort;

  return (
    <th
      className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs cursor-pointer select-none"
      onClick={() => sortable && sortKey && onSort && onSort(sortKey)}
    >
      <div className="flex items-center gap-1">{children} {sortable && <Icon className="w-3 h-3 text-gray-400" />}</div>
    </th>
  );
};


export default function AdminAffiliatesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const {
    data, isLoading, error,
    page, setPage,
    limit, setLimit,
    filters, setFilters,
    sort, setSort,
    reload,
  } = useAdminList<AffiliateAdminData>({
    endpoint: '/api/admin/affiliates',
    initialParams: {
        filters: { status: 'all', search: '' },
        sort: { sortBy: 'createdAt', order: 'desc' }
    },
    syncWithUrl: true,
  });

  const [updateStatus, setUpdateStatus] = useState<UpdateStatusState>({});
  const isAdmin = useMemo(() => session?.user?.role === 'admin', [session]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus !== 'authenticated' || !isAdmin) {
      router.replace('/');
    }
  }, [sessionStatus, isAdmin, router]);

  const handleSearchChange = useCallback((value: string) => {
    setPage(1); 
    setFilters(prev => ({ ...prev, search: value }));
  }, [setFilters, setPage]);
  
  const handleStatusChange = (status: string) => {
    setPage(1);
    setFilters(prev => ({...prev, status: status}));
  }

  const handleSort = useCallback((key: string) => {
    setSort(current => ({
      sortBy: key,
      order: current.sortBy === key && current.order === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  }, [setSort, setPage]);

    const handleUpdateAffiliateStatus = async (affiliateId: string, newStatus: 'active' | 'suspended') => {
    setUpdateStatus(prev => ({ ...prev, [affiliateId]: newStatus === 'active' ? 'approving' : 'suspending' }));
    try {
        const response = await fetch(`/api/admin/affiliates/${affiliateId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || 'Falha ao atualizar o status do afiliado.');
        }
        toast.success(`Afiliado ${newStatus === 'active' ? 'aprovado' : 'suspenso'} com sucesso!`);
        reload(); // Recarrega a lista
    } catch (error: any) {
        toast.error(error.message || 'Ocorreu um erro.');
    } finally {
        setUpdateStatus(prev => ({ ...prev, [affiliateId]: 'idle' }));
    }
  };


  if (sessionStatus === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FaSpinner className="animate-spin w-8 h-8 text-brand-pink" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Gerir Afiliados {data?.totalItems ? `(${data.totalItems})` : ''}
      </h1>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Afiliado</label>
          <SearchBar
              initialValue={filters.search}
              onSearchChange={handleSearchChange}
              placeholder="Nome, e-mail ou código..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status do Plano</label>
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-pink focus:border-brand-pink sm:text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="pending_approval">Pendente</option>
            <option value="inactive">Inativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={limit} cols={8} />
      ) : error ? (
        <EmptyState
            icon={<FaExclamationTriangle className="w-10 h-10" />}
            title="Erro ao carregar afiliados"
            description={error}
            action={<button onClick={reload} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Tentar Novamente</button>}
        />
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <TableHeader sortable sortKey="name" currentSort={sort} onSort={handleSort}>Afiliado</TableHeader>
                  <TableHeader sortable sortKey="affiliateCode" currentSort={sort} onSort={handleSort}>Código</TableHeader>
                  <TableHeader sortable sortKey="affiliateBalance" currentSort={sort} onSort={handleSort}>Saldo (R$)</TableHeader>
                  <TableHeader sortable sortKey="affiliateInvites" currentSort={sort} onSort={handleSort}>Convites</TableHeader>
                  <TableHeader sortable sortKey="planStatus" currentSort={sort} onSort={handleSort}>Status</TableHeader>
                  <TableHeader sortable sortKey="createdAt" currentSort={sort} onSort={handleSort}>Data Cadastro</TableHeader>
                  <TableHeader currentSort={sort}>Ações</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState
                    icon={<UserGroupIcon className="w-12 h-12" />}
                    title="Nenhum afiliado encontrado"
                    description="Tente ajustar os seus filtros ou o termo de busca."
                    action={<button onClick={() => setFilters({status: 'all', search:''})} className="px-3 py-1 bg-blue-500 text-white rounded">Limpar filtros</button>}
                  /></td></tr>
                ) : (
                  data?.items.map((aff) => (
                    <tr key={aff._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-3">
                          <UserAvatar name={aff.name || aff.email} src={aff.profilePictureUrl} size={32} />
                          <div>
                              <div className="font-medium text-gray-800">{aff.name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{aff.email}</div>
                          </div>
                      </div></td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{aff.affiliateCode || 'N/A'}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">{(aff.affiliateBalance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-4 py-3 text-gray-700 text-center">{aff.affiliateInvites || 0}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={aff.planStatus} mappings={AFFILIATE_STATUS_MAPPINGS} /></td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{aff.createdAt ? new Date(aff.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {aff.planStatus === 'pending_approval' && (
                           <button
                                onClick={() => handleUpdateAffiliateStatus(aff._id, 'active')}
                                disabled={updateStatus[aff._id] === 'approving'}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition-colors"
                            >
                                {updateStatus[aff._id] === 'approving' ? <FaSpinner className="animate-spin w-3 h-3"/> : <FaCheckCircle className="w-3 h-3"/>}
                                Aprovar
                            </button>
                        )}
                        {aff.planStatus === 'active' && (
                             <button
                                onClick={() => handleUpdateAffiliateStatus(aff._id, 'suspended')}
                                disabled={updateStatus[aff._id] === 'suspending'}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition-colors"
                            >
                                {updateStatus[aff._id] === 'suspending' ? <FaSpinner className="animate-spin w-3 h-3"/> : <FaTimesCircle className="w-3 h-3"/>}
                                Suspender
                            </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalItems > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 gap-4">
              <div className="flex items-center gap-4">
                <p>Mostrando <span className="font-semibold">{(page - 1) * limit + 1}</span>-<span className="font-semibold">{Math.min(page * limit, data.totalItems)}</span> de <span className="font-semibold">{data.totalItems}</span></p>
                <div className="flex items-center gap-2">
                    <label htmlFor="itemsPerPage" className="text-gray-600">Itens/pág:</label>
                    <select id="itemsPerPage" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="block py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm">
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                    </select>
                </div>
              </div>
              <nav className="flex items-center gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"><FaAngleLeft className="w-3 h-3"/> Anterior</button>
                <span className="px-2">Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{data.totalPages}</span></span>
                <button onClick={() => setPage(page + 1)} disabled={page === data.totalPages} className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Próxima <FaAngleRight className="w-3 h-3"/></button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}
