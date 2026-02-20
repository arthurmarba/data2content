"use client";

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { openPaywallModal } from '@/utils/paywallModal';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useDebounce } from 'use-debounce';

import PubliCard from '@/components/publis/PubliCard';

const ShareModal = dynamic(() => import('@/components/publis/ShareModal'), {
    ssr: false,
    loading: () => null,
});

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublisPage() {
    const router = useRouter();
    const billingStatus = useBillingStatus();
    const billingError = billingStatus.error;
    const hasBillingResolved = Boolean(billingStatus.hasResolvedOnce);
    const hasProAccess =
        Boolean(billingStatus.hasLoadedOnce && billingStatus.hasPremiumAccess);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    const [sort, setSort] = useState('date_desc');
    const [debouncedSearch] = useDebounce(search, 300);

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPubliId, setSelectedPubliId] = useState<string | null>(null);

    const queryString = useMemo(() => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '12',
            sort,
            range: selectedPeriod,
        });

        const normalizedSearch = debouncedSearch.trim();
        if (normalizedSearch) {
            params.set('search', normalizedSearch);
        }

        if (filterCategory) {
            params.set('category', filterCategory);
        }

        return params.toString();
    }, [page, debouncedSearch, sort, selectedPeriod, filterCategory]);

    // Only fetch if has access
    const { data, error, isLoading: isDataLoading, isValidating } = useSWR(
        hasProAccess ? `/api/publis?${queryString}` : null,
        fetcher,
        {
            dedupingInterval: 30000,
            revalidateOnFocus: false,
            keepPreviousData: true,
        }
    );

    const isInitialLoading = !hasBillingResolved || (hasProAccess && !data && isDataLoading);
    const isRefreshing = hasProAccess && Boolean(data) && (isDataLoading || isValidating);
    const showSearchSpinner = isRefreshing;

    const handleShare = (id: string) => {
        setSelectedPubliId(id);
        setShareModalOpen(true);
    };

    const handleAnalyze = (id: string) => {
        router.push(`/dashboard/publis/${id}`);
    };

    useEffect(() => {
        setPage(prev => (prev === 1 ? prev : 1));
    }, [debouncedSearch, filterCategory, selectedPeriod, sort]);

    if (isInitialLoading) {
        return (
            <div className="dashboard-page-shell py-4 md:py-6">
                <div className="mb-6 md:mb-8">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Minhas Publis</h1>
                    <p className="text-sm md:text-base text-gray-500 mt-1">Gerencie, analise e compartilhe seus conteúdos de publicidade.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-gray-100 rounded-xl h-80 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (hasBillingResolved && billingError && !billingStatus.hasLoadedOnce) {
        return (
            <div className="dashboard-page-shell py-4 md:py-6">
                <div className="mb-6 md:mb-8">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Minhas Publis</h1>
                    <p className="text-sm md:text-base text-gray-500 mt-1">
                        Não foi possível verificar sua assinatura agora.
                    </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                    <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 mt-0.5" />
                        <div className="space-y-2">
                            <p className="text-sm font-semibold">
                                Falha ao carregar o status da assinatura.
                            </p>
                            <p className="text-sm text-amber-800">
                                Tente novamente para liberar suas publis.
                            </p>
                            <button
                                type="button"
                                onClick={() => billingStatus.refetch()}
                                className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!hasProAccess) {
        // Mock visuals for the blocked state
        const MOCK_ITEMS = Array.from({ length: 8 });

        return (
            <div className="dashboard-page-shell relative overflow-hidden py-4 md:py-6">
                {/* Header & Controls (Visible but inert) */}
                <div className="mb-6 md:mb-8 transition-opacity duration-300 opacity-50 select-none">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Minhas Publis</h1>
                    <p className="text-sm md:text-base text-gray-500 mt-1">Gerencie, analise e compartilhe seus conteúdos de publicidade.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6 md:items-center transition-opacity duration-300 opacity-50 pointer-events-none select-none">
                    <div className="relative w-full md:flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 h-10" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                        <div className="block w-full h-10 border border-gray-300 rounded-lg bg-gray-50" />
                        <div className="block w-full h-10 border border-gray-300 rounded-lg bg-gray-50" />
                    </div>
                </div>

                {/* Blurred Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 filter blur-sm select-none opacity-40 pointer-events-none">
                    {MOCK_ITEMS.map((_, i) => (
                        <div key={i} className="bg-white border rounded-xl h-80 shadow-sm flex flex-col p-4 border-gray-200">
                            <div className="w-full h-40 bg-gray-200 rounded-lg mb-4" />
                            <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
                            <div className="h-4 w-1/2 bg-gray-200 rounded mb-4" />
                            <div className="mt-auto flex gap-2">
                                <div className="flex-1 h-8 bg-gray-100 rounded" />
                                <div className="flex-1 h-8 bg-gray-100 rounded" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Overlay Card / Teaser */}
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                    <div className="max-w-lg w-full bg-white/90 backdrop-blur-md border border-white/50 shadow-2xl rounded-2xl p-8 text-center ring-1 ring-gray-900/5">
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <LockClosedIcon className="w-8 h-8 text-indigo-600" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                            Gerencie suas Campanhas
                        </h2>

                        <p className="text-gray-600 mb-8 leading-relaxed">
                            Organize todas as suas publis em um só lugar, acompanhe o desempenho em tempo real e crie links de compartilhamento profissionais para enviar às marcas.
                        </p>

                        <ul className="text-left text-sm text-gray-600 space-y-3 mb-8 mx-auto max-w-xs">
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span> Histórico completo de parcerias
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span> Compartilhamento de métricas ao vivo
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span> Filtros por desempenho e data
                            </li>
                        </ul>

                        <button
                            onClick={() => openPaywallModal({ context: 'planning', source: 'publis_locked_state' })}
                            className="w-full py-3.5 px-6 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            Desbloquear Minhas Publis
                        </button>

                        <p className="mt-4 text-xs text-gray-500">
                            Disponível no Plano Pro
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page-shell py-4 md:py-6">
            <div className="mb-6 md:mb-8">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Minhas Publis</h1>
                <p className="text-sm md:text-base text-gray-500 mt-1">Gerencie, analise e compartilhe seus conteúdos de publicidade.</p>
            </div>

            {/* Filters & Controls */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6 md:items-center">
                <div className="relative w-full md:flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {showSearchSpinner ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
                        ) : (
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        )}
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Buscar por legenda..."
                        value={search}
                        aria-busy={showSearchSpinner}
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
            {!data && isDataLoading ? (
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
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${isRefreshing ? 'opacity-80' : ''}`}>
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
            {shareModalOpen ? (
                <ShareModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    publiId={selectedPubliId}
                />
            ) : null}
        </div>
    );
}
