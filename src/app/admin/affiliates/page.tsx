// src/app/admin/affiliates/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaSpinner, FaSearch, FaSort, FaSortUp, FaSortDown, FaFilter, FaTimesCircle, FaAngleLeft, FaAngleRight, FaTrophy } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// --- Adicionado para forçar renderização dinâmica ---
export const dynamic = 'force-dynamic';

// --- Interfaces ---
interface AffiliateAdminData {
  _id: string;
  name?: string;
  email: string;
  affiliateCode?: string;
  affiliateBalance?: number;
  affiliateInvites?: number;
  affiliateRank?: number;
  planStatus?: string;
  createdAt?: string;
}

interface FetchResponse {
  affiliates: AffiliateAdminData[];
  currentPage: number;
  totalPages: number;
  totalAffiliates: number;
}

// --- Componentes Auxiliares ---
const StatusBadge = ({ status }: { status?: string }) => {
  let colorClasses = 'bg-gray-100 text-gray-600 border-gray-300';
  let text = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'N/A';

  switch (status?.toLowerCase()) {
    case 'active': colorClasses = 'bg-green-100 text-green-700 border-green-300'; text = 'Ativo'; break;
    case 'pending': colorClasses = 'bg-yellow-100 text-yellow-700 border-yellow-300'; text = 'Pendente'; break;
    case 'inactive': colorClasses = 'bg-red-100 text-red-700 border-red-300'; text = 'Inativo'; break;
    case 'expired': colorClasses = 'bg-orange-100 text-orange-700 border-orange-300'; text = 'Expirado'; break;
    case 'canceled': colorClasses = 'bg-pink-100 text-pink-700 border-pink-300'; text = 'Cancelado'; break;
  }
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${colorClasses}`}>{text}</span>;
};

const TableHeader = ({
  children,
  sortable = false,
  sortKey,
  currentSortKey,
  currentSortOrder,
  onSort,
}: {
  children: React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  currentSortKey?: string;
  currentSortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}) => {
  const isCurrentSortKey = currentSortKey === sortKey;
  const Icon = isCurrentSortKey ? (currentSortOrder === 'asc' ? FaSortUp : FaSortDown) : FaSort;

  return (
    <th
      className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs cursor-pointer select-none"
      onClick={() => sortable && sortKey && onSort && onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && <Icon className="w-3 h-3 text-gray-400" />}
      </div>
    </th>
  );
};


export default function AdminAffiliatesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [affiliates, setAffiliates] = useState<AffiliateAdminData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para paginação, ordenação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAffiliates, setTotalAffiliates] = useState(0);
  const [limit, setLimit] = useState(10); // Itens por página

  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');

  const isAdmin = useMemo(() => session?.user?.role === 'admin', [session]);

  // Debounce para searchQuery
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reseta para a primeira página ao buscar
    }, 500); // 500ms de delay
    return () => clearTimeout(handler);
  }, [searchQuery]);


  // Função para buscar afiliados
  const fetchAffiliates = useCallback(async () => {
    if (!isAdmin || sessionStatus !== 'authenticated') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });
    if (debouncedSearchQuery) {
      params.append('searchQuery', debouncedSearchQuery);
    }
    if (planStatusFilter && planStatusFilter !== 'all') {
      params.append('filterByPlanStatus', planStatusFilter);
    }

    try {
      const response = await fetch(`/api/admin/affiliates?${params.toString()}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Erro ${response.status} ao buscar afiliados.`);
      }
      const data: FetchResponse = await response.json();
      setAffiliates(data.affiliates);
      setTotalPages(data.totalPages);
      setTotalAffiliates(data.totalAffiliates);
    } catch (err: any) {
      setError(err.message || "Falha ao buscar lista de afiliados.");
      setAffiliates([]);
      setTotalPages(1);
      setTotalAffiliates(0);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, sessionStatus, currentPage, limit, sortBy, sortOrder, debouncedSearchQuery, planStatusFilter]);

  // Efeito para buscar dados quando os parâmetros mudarem
  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  // Efeito para redirecionar se não for admin
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus === 'unauthenticated' || !isAdmin) {
      router.replace('/');
    }
  }, [sessionStatus, isAdmin, router]);


  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('desc'); // Padrão para desc ao mudar coluna
    }
    setCurrentPage(1); // Reseta para a primeira página ao ordenar
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };


  if (sessionStatus === 'loading' || (isLoading && affiliates.length === 0 && isAdmin)) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <FaSpinner className="animate-spin w-8 h-8 text-brand-pink" />
      </div>
    );
  }

  if (!isAdmin && sessionStatus === 'authenticated') {
     return (
        <div className="text-center py-10">
            <p className="text-red-600 font-semibold">Acesso Negado.</p>
            <p className="text-gray-500 text-sm">Você não tem permissão para acessar esta página.</p>
        </div>
     );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Afiliados ({totalAffiliates})</h1>
      </div>

      {/* Filtros e Busca */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
        {/* Campo de Busca */}
        <div className="md:col-span-2">
          <label htmlFor="searchAffiliate" className="block text-sm font-medium text-gray-700 mb-1">
            Buscar Afiliado
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              id="searchAffiliate"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-pink focus:border-brand-pink sm:text-sm"
              placeholder="Nome, e-mail ou código de afiliado..."
            />
          </div>
        </div>

        {/* Filtro de Status do Plano */}
        <div>
          <label htmlFor="planStatusFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Status do Plano
          </label>
          <select
            id="planStatusFilter"
            value={planStatusFilter}
            onChange={(e) => {
                setPlanStatusFilter(e.target.value);
                setCurrentPage(1); // Reseta para a primeira página ao filtrar
            }}
            className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-pink focus:border-brand-pink sm:text-sm"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo</option>
            <option value="pending">Pendente</option>
            <option value="inactive">Inativo</option>
            <option value="expired">Expirado</option>
            <option value="canceled">Cancelado</option>
          </select>
        </div>
      </div>


      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="my-4">
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
              <FaTimesCircle />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabela de Afiliados */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <TableHeader sortable sortKey="name" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Afiliado</TableHeader>
              <TableHeader sortable sortKey="affiliateCode" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Código</TableHeader>
              <TableHeader sortable sortKey="affiliateBalance" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Saldo (R$)</TableHeader>
              <TableHeader sortable sortKey="affiliateInvites" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Convites</TableHeader>
              <TableHeader sortable sortKey="affiliateRank" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Rank</TableHeader>
              <TableHeader sortable sortKey="planStatus" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status Plano</TableHeader>
              <TableHeader sortable sortKey="createdAt" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Data Cadastro</TableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
                 <tr><td colSpan={7} className="text-center py-10 text-gray-500"><div className="flex justify-center items-center gap-2"><FaSpinner className="animate-spin w-4 h-4" /><span>Carregando afiliados...</span></div></td></tr>
            )}
            {!isLoading && affiliates.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-500">Nenhum afiliado encontrado com os filtros atuais.</td></tr>
            )}
            {!isLoading && affiliates.map((aff) => (
              <tr key={aff._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-700">
                    <div className="font-medium text-gray-800">{aff.name || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{aff.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{aff.affiliateCode || 'N/A'}</td>
                <td className="px-4 py-3 text-green-600 font-medium">
                  {(aff.affiliateBalance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-gray-700 text-center">{aff.affiliateInvites || 0}</td>
                <td className="px-4 py-3 text-gray-700 text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-700">
                        <FaTrophy className="w-3 h-3"/>
                        {aff.affiliateRank || 1}
                    </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={aff.planStatus} /></td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {aff.createdAt ? new Date(aff.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!isLoading && totalAffiliates > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 gap-4">
          <div>
            Mostrando <span className="font-semibold">{(currentPage - 1) * limit + 1}</span>-
            <span className="font-semibold">{Math.min(currentPage * limit, totalAffiliates)}</span> de 
            <span className="font-semibold"> {totalAffiliates}</span> afiliados.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <FaAngleLeft className="w-3 h-3"/> Anterior
            </button>
            <span className="px-2">
              Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span>
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Próxima <FaAngleRight className="w-3 h-3"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
