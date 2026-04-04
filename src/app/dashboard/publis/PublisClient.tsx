"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ExclamationTriangleIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { openPaywallModal } from '@/utils/paywallModal';
import { useDebounce } from 'use-debounce';
import { useToast } from '@/app/components/ui/ToastA11yProvider';

import PubliCard from '@/components/publis/PubliCard';
import PublisConversionSection from './components/PublisConversionSection';

const ShareModal = dynamic(() => import('@/components/publis/ShareModal'), {
    ssr: false,
    loading: () => null,
});
const CreatorQuickSearch = dynamic(
    () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
    { ssr: false, loading: () => null }
);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CampaignOption = {
    id: string;
    campaignTitle: string;
    brandName: string;
};

type AdminTargetUser = {
    id: string;
    name: string;
    profilePictureUrl?: string | null;
};

const ADMIN_PUBLIS_TARGET_STORAGE_KEY = "publis_admin_target_user";
const publiShellCard = "min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-100/90 bg-zinc-50/68";
const publiControlShell = "rounded-[1.3rem] border border-zinc-100/90 bg-zinc-50/68";

export default function PublisClient({ compactView = false }: { compactView?: boolean }) {
    const router = useRouter();
    const { data: session } = useSession();
    const { toast } = useToast();
    const billingStatus = useBillingStatus();
    const sessionUser = (session?.user as any) ?? null;
    const sessionUserId = typeof sessionUser?.id === 'string' && sessionUser.id.trim().length > 0 ? sessionUser.id.trim() : null;
    const sessionRole = typeof sessionUser?.role === 'string' ? sessionUser.role.trim().toLowerCase() : null;
    const isAdminViewer = sessionRole === 'admin';
    const billingError = billingStatus.error;
    const hasBillingResolved = Boolean(billingStatus.hasResolvedOnce);
    const hasProAccess =
        Boolean(billingStatus.hasLoadedOnce && billingStatus.hasPremiumAccess);
    const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
    const hasHydratedAdminTargetRef = useRef(false);
    const targetUserId = isAdminViewer && adminTargetUser?.id ? adminTargetUser.id : null;
    const isActingOnBehalf = Boolean(
        isAdminViewer &&
        targetUserId &&
        sessionUserId &&
        targetUserId !== sessionUserId
    );

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    const [sort, setSort] = useState('date_desc');
    const [debouncedSearch] = useDebounce(search, 300);

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPubliId, setSelectedPubliId] = useState<string | null>(null);
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [linkingPubliId, setLinkingPubliId] = useState<string | null>(null);
    const [linkedPubliIds, setLinkedPubliIds] = useState<string[]>([]);
    const linkedPubliByCampaignRef = useRef<Record<string, string[]>>({});

    const queryString = useMemo(() => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '12',
            sort,
            range: selectedPeriod,
        });

        if (targetUserId) {
            params.set('targetUserId', targetUserId);
        }

        const normalizedSearch = debouncedSearch.trim();
        if (normalizedSearch) {
            params.set('search', normalizedSearch);
        }

        if (filterCategory) {
            params.set('category', filterCategory);
        }

        return params.toString();
    }, [page, debouncedSearch, sort, selectedPeriod, filterCategory, targetUserId]);

    useEffect(() => {
        if (!isAdminViewer || hasHydratedAdminTargetRef.current || typeof window === "undefined") return;
        hasHydratedAdminTargetRef.current = true;
        try {
            const raw = window.sessionStorage.getItem(ADMIN_PUBLIS_TARGET_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<AdminTargetUser>;
            if (typeof parsed?.id !== "string" || typeof parsed?.name !== "string") return;
            const normalizedId = parsed.id.trim();
            const normalizedName = parsed.name.trim();
            if (!normalizedId || !normalizedName) return;
            setAdminTargetUser({
                id: normalizedId,
                name: normalizedName,
                profilePictureUrl: parsed.profilePictureUrl ?? null,
            });
        } catch {
            /* ignore */
        }
    }, [isAdminViewer]);

    useEffect(() => {
        if (!isAdminViewer || typeof window === "undefined") return;
        try {
            if (!adminTargetUser?.id) {
                window.sessionStorage.removeItem(ADMIN_PUBLIS_TARGET_STORAGE_KEY);
                return;
            }
            window.sessionStorage.setItem(
                ADMIN_PUBLIS_TARGET_STORAGE_KEY,
                JSON.stringify(adminTargetUser)
            );
        } catch {
            /* ignore */
        }
    }, [adminTargetUser, isAdminViewer]);

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

    const openSelectedCampaign = useCallback(() => {
        if (!selectedCampaignId) return;
        router.push(`/campaigns?proposalId=${encodeURIComponent(selectedCampaignId)}`);
    }, [router, selectedCampaignId]);

    useEffect(() => {
        setPage(prev => (prev === 1 ? prev : 1));
    }, [debouncedSearch, filterCategory, selectedPeriod, sort]);

    useEffect(() => {
        if (!isAdminViewer) return;
        setPage(1);
        setSearch('');
        setFilterCategory('');
        setSort('date_desc');
        setSelectedPeriod('all');
    }, [isAdminViewer, targetUserId]);

    useEffect(() => {
        if (!hasProAccess) {
            setCampaignOptions([]);
            setSelectedCampaignId('');
            setLinkedPubliIds([]);
            linkedPubliByCampaignRef.current = {};
            return;
        }

        let cancelled = false;

        async function loadCampaignOptions() {
            try {
                setCampaignsLoading(true);
                const response = await fetch('/api/proposals?limit=200', { cache: 'no-store' });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || 'Não foi possível carregar campanhas.');
                }

                const items = Array.isArray(payload?.items) ? payload.items : [];
                const options: CampaignOption[] = items
                    .map((item: any) => ({
                        id: String(item?.id ?? ''),
                        campaignTitle:
                            typeof item?.campaignTitle === 'string' && item.campaignTitle.trim()
                                ? item.campaignTitle.trim()
                                : 'Campanha sem título',
                        brandName:
                            typeof item?.brandName === 'string' && item.brandName.trim()
                                ? item.brandName.trim()
                                : 'Marca',
                    }))
                    .filter((item: CampaignOption) => Boolean(item.id));

                if (cancelled) return;

                setCampaignOptions(options);
                setSelectedCampaignId((current) => {
                    if (current && options.some((option) => option.id === current)) {
                        return current;
                    }
                    return options[0]?.id ?? '';
                });
            } catch (error: any) {
                if (cancelled) return;
                setCampaignOptions([]);
                setSelectedCampaignId('');
                setLinkedPubliIds([]);
                toast({
                    variant: 'error',
                    title: error?.message || 'Falha ao carregar campanhas.',
                });
            } finally {
                if (!cancelled) setCampaignsLoading(false);
            }
        }

        loadCampaignOptions();

        return () => {
            cancelled = true;
        };
    }, [hasProAccess, toast]);

    useEffect(() => {
        if (!hasProAccess || !selectedCampaignId) {
            setLinkedPubliIds([]);
            return;
        }

        const cached = linkedPubliByCampaignRef.current[selectedCampaignId];
        if (cached) {
            setLinkedPubliIds(cached);
            return;
        }

        let cancelled = false;

        async function loadLinkedPublis() {
            try {
                const response = await fetch(`/api/proposals/${selectedCampaignId}/links`, {
                    cache: 'no-store',
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || 'Não foi possível carregar vínculos da campanha.');
                }
                if (cancelled) return;

                const items = Array.isArray(payload?.items) ? payload.items : [];
                const publiIds = items
                    .filter((item: any) => item?.entityType === 'publi' && typeof item?.entityId === 'string')
                    .map((item: any) => item.entityId);
                setLinkedPubliIds(publiIds);
                linkedPubliByCampaignRef.current[selectedCampaignId] = publiIds;
            } catch {
                if (!cancelled) {
                    setLinkedPubliIds([]);
                }
            }
        }

        loadLinkedPublis();
        return () => {
            cancelled = true;
        };
    }, [hasProAccess, selectedCampaignId]);

    const handleLinkCampaign = useCallback(
        async (publiId: string) => {
            if (!selectedCampaignId) {
                toast({
                    variant: 'warning',
                    title: 'Selecione uma campanha antes de vincular.',
                });
                return;
            }

            try {
                setLinkingPubliId(publiId);
                const response = await fetch(`/api/proposals/${selectedCampaignId}/links`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entityType: 'publi',
                        entityId: publiId,
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || 'Não foi possível vincular publi à campanha.');
                }

                toast({
                    variant: 'success',
                    title: payload?.created === false ? 'Publi já estava vinculada.' : 'Publi vinculada à campanha.',
                });
                setLinkedPubliIds((prev) => {
                    const next = prev.includes(publiId) ? prev : [...prev, publiId];
                    linkedPubliByCampaignRef.current[selectedCampaignId] = next;
                    return next;
                });
            } catch (error: any) {
                toast({
                    variant: 'error',
                    title: error?.message || 'Falha ao vincular publi.',
                });
            } finally {
                setLinkingPubliId(null);
            }
        },
        [selectedCampaignId, toast]
    );

    const linkedPubliIdSet = useMemo(() => new Set(linkedPubliIds), [linkedPubliIds]);

    const instagramConnected = Boolean(billingStatus.instagram?.connected);
    const showFunnel = !hasProAccess || (hasProAccess && !instagramConnected);

    if (isInitialLoading) {
        return (
            <div className={compactView ? "px-0 py-0.5" : "py-4 md:py-6"}>
                {isAdminViewer ? (
                    <div className={`${compactView ? "mb-2 space-y-1.5" : "mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"}`}>
                        {!compactView || isActingOnBehalf || adminTargetUser ? (
                        <div className={compactView ? "w-full" : "w-full sm:max-w-md"}>
                            <CreatorQuickSearch
                                onSelect={(creator) =>
                                    setAdminTargetUser({
                                        id: creator.id,
                                        name: creator.name,
                                        profilePictureUrl: creator.profilePictureUrl,
                                    })
                                }
                                selectedCreatorName={adminTargetUser?.name || null}
                                selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                                onClear={() => setAdminTargetUser(null)}
                                apiPrefix="/api/admin"
                            />
                        </div>
                        ) : null}
                        {(!compactView || isActingOnBehalf || adminTargetUser) ? (
                        <p className="text-xs text-slate-500">
                            {isActingOnBehalf ? `Vendo publis de ${adminTargetUser?.name}.` : "Vendo suas publis."}
                        </p>
                        ) : null}
                    </div>
                ) : null}
                {compactView ? (
                    <div className="mb-2.5 space-y-2">
                        <div className="h-10 w-full animate-pulse rounded-[1.15rem] border border-zinc-100/90 bg-zinc-50/68" />
                        <div className="grid grid-cols-2 gap-2">
                            {[0, 1, 2].map((index) => (
                                <div
                                    key={index}
                                    className={`h-10 animate-pulse rounded-[1.15rem] border border-zinc-100/90 bg-zinc-50/68 ${index === 2 ? "col-span-2" : ""}`}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 md:mb-8">
                        <p className="dashboard-muted-label text-pink-500">Biblioteca de publis</p>
                        <h1 className="mt-2 text-xl font-bold text-zinc-900 md:text-2xl">Minhas Publis</h1>
                        <p className="mt-1 text-sm text-zinc-500 md:text-base">Gerencie, analise e compartilhe seus conteúdos de publicidade.</p>
                    </div>
                )}
                <div className={`grid ${compactView ? "grid-cols-1 gap-2.5" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"}`}>
                    {[...Array(compactView ? 4 : 8)].map((_, i) => (
                        <div key={i} className={`${publiShellCard} animate-pulse ${compactView ? "h-[28rem]" : "h-80"}`} />
                    ))}
                </div>
            </div>
        );
    }

    if (hasBillingResolved && billingError && !billingStatus.hasLoadedOnce) {
        return (
            <div className="py-4 md:py-6">
                <div className="mb-6 md:mb-8">
                    <p className="dashboard-muted-label text-amber-500">Assinatura</p>
                    <h1 className="mt-2 text-xl font-bold text-zinc-900 md:text-2xl">Minhas Publis</h1>
                    <p className="mt-1 text-sm text-zinc-500 md:text-base">
                        Não foi possível verificar sua assinatura agora.
                    </p>
                </div>
                <div className="rounded-[1.6rem] border border-amber-200/80 bg-amber-50/90 p-5 text-amber-900 shadow-[0_18px_38px_rgba(245,158,11,0.12)]">
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

    if (showFunnel && !isAdminViewer) {
        return <PublisConversionSection />;
    }

    return (
        <div className={compactView ? "px-0 py-0.5" : "py-2 px-4"}>
            {isAdminViewer ? (
                <div className={`${compactView ? "mb-2 space-y-1.5" : "mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"}`}>
                    {!compactView || isActingOnBehalf || adminTargetUser ? (
                    <div className={compactView ? "w-full" : "w-full sm:max-w-md"}>
                        <CreatorQuickSearch
                            onSelect={(creator) =>
                                setAdminTargetUser({
                                    id: creator.id,
                                    name: creator.name,
                                    profilePictureUrl: creator.profilePictureUrl,
                                })
                            }
                            selectedCreatorName={adminTargetUser?.name || null}
                            selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                            onClear={() => setAdminTargetUser(null)}
                            apiPrefix="/api/admin"
                        />
                    </div>
                    ) : null}
                    {(!compactView || isActingOnBehalf || adminTargetUser) ? (
                        <p className="text-xs text-slate-500">
                            {isActingOnBehalf ? `Vendo publis de ${adminTargetUser?.name}.` : "Vendo suas publis."}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {/* Compact Filters & Link Info */}
            <div className={compactView ? "mb-2.5 space-y-2" : "mb-6 space-y-4"}>
                {!compactView ? (
                <div className={`${publiControlShell} px-4 py-3`}>
                    <p className="dashboard-muted-label text-pink-500">Biblioteca de publis</p>
                    <p className="mt-1 text-sm text-zinc-500">Veja, filtre e relacione publis com campanhas ativas.</p>
                </div>
                ) : null}
                {/* Search & Period Row */}
                <div className={compactView ? "space-y-1.5" : `${publiControlShell} flex gap-2 p-3`}>
                    <div className={`relative ${compactView ? "col-span-2" : "flex-1"}`}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            {showSearchSpinner ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
                            ) : (
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                            )}
                        </div>
                        <input
                            type="text"
                            className={`dashboard-input block w-full border-zinc-100/90 bg-white/86 ${compactView ? "rounded-[1.15rem] pl-9 pr-3 py-2 text-[11px]" : "pl-9 pr-4 py-3 text-xs"}`}
                            placeholder={compactView ? "Buscar publi" : "Buscar descrição ou tema"}
                            value={search}
                            aria-busy={showSearchSpinner}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {compactView ? (
                        <div className="grid grid-cols-2 gap-1.5">
                            <select
                                className="dashboard-select w-full rounded-[1.15rem] border-zinc-100/90 bg-white/86 pl-3 pr-7 py-2 text-[10px] font-medium text-zinc-600"
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                <option value="30d">30 dias</option>
                                <option value="90d">3 meses</option>
                                <option value="year">Este Ano</option>
                                <option value="all">Tudo</option>
                            </select>

                            <select
                                className="dashboard-select w-full rounded-[1.15rem] border-zinc-100/90 bg-white/86 pl-3 pr-7 py-2 text-[10px] font-medium text-zinc-600"
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                            >
                                <option value="date_desc">Novos</option>
                                <option value="date_asc">Antigos</option>
                                <option value="performance_desc">Performance</option>
                            </select>

                            <select
                                value={selectedCampaignId}
                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                disabled={campaignsLoading || campaignOptions.length === 0}
                                className="col-span-2 rounded-[1.15rem] border border-zinc-100/90 bg-white/86 px-3 py-2 text-[10px] font-medium text-zinc-600 outline-none disabled:opacity-50"
                            >
                                {campaignsLoading ? (
                                    <option value="">Campanha</option>
                                ) : campaignOptions.length === 0 ? (
                                    <option value="">Sem campanha</option>
                                ) : (
                                    campaignOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.campaignTitle}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    ) : (
                        <>
                            <select
                                className="dashboard-select w-36 border-zinc-100/90 bg-white/86 pl-3 pr-8 py-3 text-[11px]"
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                <option value="30d">30 dias</option>
                                <option value="90d">3 meses</option>
                                <option value="year">Este Ano</option>
                                <option value="all">Tudo</option>
                            </select>

                            <select
                                className="dashboard-select w-36 border-zinc-100/90 bg-white/86 pl-3 pr-8 py-3 text-[11px]"
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                            >
                                <option value="date_desc">Novos</option>
                                <option value="date_asc">Antigos</option>
                                <option value="performance_desc">Performance</option>
                            </select>
                            <span className="dashboard-muted-label text-zinc-400">Campanha ativa</span>
                            <select
                                value={selectedCampaignId}
                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                disabled={campaignsLoading || campaignOptions.length === 0}
                                className="flex-1 rounded-xl border border-zinc-100/90 bg-white/86 px-3 py-2 text-[11px] text-zinc-700 outline-none disabled:opacity-50"
                            >
                                {campaignsLoading ? (
                                    <option value="">Carregando...</option>
                                ) : campaignOptions.length === 0 ? (
                                    <option value="">Sem campanhas</option>
                                ) : (
                                    campaignOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.campaignTitle}
                                        </option>
                                    ))
                                )}
                            </select>
                            {selectedCampaignId ? (
                                <button
                                    type="button"
                                    onClick={openSelectedCampaign}
                                    className="rounded-xl border border-zinc-100/90 bg-white/86 px-3 py-2 text-[10px] font-bold text-zinc-700 transition hover:bg-white"
                                >
                                    Abrir
                                </button>
                            ) : null}
                        </>
                    )}
                </div>
            </div>

            {/* Content Grid - Optimized for Board width */}
            {!data && isDataLoading ? (
                <div className={`grid ${compactView ? "grid-cols-1 gap-2.5" : "grid-cols-1 md:grid-cols-2 gap-4"}`}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`${publiShellCard} animate-pulse ${compactView ? "h-52" : "h-64"}`} />
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-8">
                    <p className="text-red-400 text-xs">Erro ao carregar publis.</p>
                </div>
            ) : data?.items?.length === 0 ? (
                <div className="rounded-[1.5rem] border border-zinc-100/90 bg-zinc-50/68 py-10 text-center">
                    <FunnelIcon className="mx-auto h-8 w-8 text-zinc-300" />
                    <h3 className="mt-3 text-sm font-semibold text-zinc-800">Nenhuma publi encontrada</h3>
                    <p className="mt-1 text-xs text-zinc-500">Ajuste busca, período ou ordenação para abrir outros conteúdos.</p>
                </div>
            ) : (
                <>
                    <div className={`grid ${compactView ? "grid-cols-1 gap-2.5" : "grid-cols-1 md:grid-cols-2 gap-4"} ${isRefreshing ? 'opacity-70' : ''}`}>
                        {data.items.map((publi: any) => (
                            <PubliCard
                                key={publi.id}
                                publi={publi}
                                onShare={handleShare}
                                onAnalyze={handleAnalyze}
                                onLinkCampaign={handleLinkCampaign}
                                onOpenCampaign={openSelectedCampaign}
                                linkDisabled={!selectedCampaignId || campaignsLoading}
                                isLinking={linkingPubliId === publi.id}
                                isLinkedToCampaign={linkedPubliIdSet.has(publi.id)}
                                compactView={compactView}
                            />
                        ))}
                    </div>

                    {/* Simple Pagination */}
                    <div className={`${compactView ? "mt-4" : "mt-8"} ${compactView ? "rounded-[1.3rem] border border-zinc-100/90 bg-zinc-50/68 px-3 py-2.5" : "px-2"} flex items-center justify-between`}>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className={`${compactView ? "rounded-[1rem] border border-zinc-100/90 bg-white/82 px-3 py-2 text-[10px] font-bold text-zinc-600" : "dashboard-secondary-button px-4 py-2 text-gray-700"} disabled:opacity-20`}
                        >
                            <span className="text-[11px] font-bold">Anterior</span>
                        </button>
                        <span className={`${compactView ? "bg-white/72" : "bg-zinc-50/68"} rounded-full border border-zinc-100/90 px-3 py-1 text-[10px] font-medium text-zinc-500`}>
                            {data.pagination.page} de {data.pagination.pages}
                        </span>
                        <button
                            disabled={page >= data.pagination.pages}
                            onClick={() => setPage(p => p + 1)}
                            className={`${compactView ? "rounded-[1rem] border border-zinc-100/90 bg-white/82 px-3 py-2 text-[10px] font-bold text-zinc-600" : "dashboard-secondary-button px-4 py-2 text-gray-700"} disabled:opacity-20`}
                        >
                            <span className="text-[11px] font-bold">Próxima</span>
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
