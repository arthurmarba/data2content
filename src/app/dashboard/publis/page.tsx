'use client';

import React, { useState, useEffect } from 'react';
import { FunnelIcon, MagnifyingGlassIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import toast from 'react-hot-toast';

import PubliCard from '@/components/publis/PubliCard';
import ShareModal from '@/components/publis/ShareModal';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublisPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    const [sort, setSort] = useState('date_desc');

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPubliId, setSelectedPubliId] = useState<string | null>(null);

    // Calculate dates based on period
    const getPeriodDates = (period: string) => {
        const end = new Date();
        let start = new Date();

        switch (period) {
            case '30d':
                start.setDate(end.getDate() - 30);
                break;
            case '90d':
                start.setDate(end.getDate() - 90);
                break;
            case 'year':
                start = new Date(new Date().getFullYear(), 0, 1);
                break;
            case 'all':
                return { startDate: '', endDate: '' };
            default:
                return { startDate: '', endDate: '' };
        }
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    };

    const { startDate, endDate } = getPeriodDates(selectedPeriod);

    // Debounce search could be added here, for now direct
    const queryString = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        search,
        startDate,
        endDate,
        sort,
    }).toString();

    const { data, error, isLoading } = useSWR(`/api/publis?${queryString}`, fetcher);

    const handleShare = (id: string) => {
        setSelectedPubliId(id);
        setShareModalOpen(true);
    };

    const handleAnalyze = (id: string) => {
        // Navigate to internal detailed view
        // toast('Análise detalhada interna (placeholder)', { icon: '📊' });
        window.location.href = `/dashboard/publis/${id}`;
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="mb-6 md:mb-8">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Minhas Publis</h1>
                <p className="text-sm md:text-base text-gray-500 mt-1">Gerencie, analise e compartilhe seus conteúdos de publicidade.</p>
            </div>

            {/* Filters & Controls */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6 md:items-center">
                <div className="relative w-full md:flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Buscar por legenda..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                    <select
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                    >
                        <option value="30d">Últimos 30 dias</option>
                        <option value="90d">Últimos 3 meses</option>
                        <option value="year">Este Ano</option>
                        <option value="all">Todo o Período</option>
                    </select>

                    <select
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                    >
                        <option value="date_desc">Mais recentes</option>
                        <option value="date_asc">Mais antigos</option>
                        <option value="performance_desc">Maior Engajamento</option>
                        <option value="performance_asc">Menor Engajamento</option>
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-gray-100 rounded-xl h-80 animate-pulse" />
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-12">
                    <p className="text-red-500">Erro ao carregar publis.</p>
                </div>
            ) : data?.items?.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <FunnelIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma publi encontrada</h3>
                    <p className="mt-1 text-sm text-gray-500">Tente ajustar os filtros ou busque por outro termo.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {data.items.map((publi: any) => (
                            <PubliCard
                                key={publi.id}
                                publi={publi}
                                onShare={handleShare}
                                onAnalyze={handleAnalyze}
                            />
                        ))}
                    </div>

                    {/* Simple Pagination */}
                    <div className="mt-8 flex justify-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <span className="px-4 py-2 text-sm text-gray-700">
                            Página {data.pagination.page} de {data.pagination.pages}
                        </span>
                        <button
                            disabled={page >= data.pagination.pages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Próxima
                        </button>
                    </div>
                </>
            )}

            {/* Modals */}
            <ShareModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                publiId={selectedPubliId}
            />
        </div>
    );
}
