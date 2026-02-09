"use client";

import React from "react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { UserAvatar } from "../../components/UserAvatar";
import ButtonPrimary from "./ButtonPrimary";
import { useUtmAttribution } from "@/hooks/useUtmAttribution";
import { track } from "@/lib/track";
import type { UtmContext } from "@/lib/analytics/utm";
import type { LandingCommunityMetrics, LandingCreatorHighlight } from "@/types/landing";
import { BRAND_CAMPAIGN_ROUTE } from "@/constants/routes";

const CASTING_API_ROUTE = "/api/landing/casting";

const interactionOptions = [
    { value: "", label: "Todas interações/post" },
    { value: "500", label: "≥ 500" },
    { value: "1000", label: "≥ 1k" },
    { value: "2500", label: "≥ 2,5k" },
    { value: "5000", label: "≥ 5k" },
    { value: "10000", label: "≥ 10k" },
    { value: "20000", label: "≥ 20k" },
];
const followerOptions = [
    { value: "", label: "Todos os seguidores" },
    { value: "5000", label: "≥ 5k seguidores" },
    { value: "10000", label: "≥ 10k seguidores" },
    { value: "25000", label: "≥ 25k seguidores" },
    { value: "50000", label: "≥ 50k seguidores" },
    { value: "100000", label: "≥ 100k seguidores" },
    { value: "250000", label: "≥ 250k seguidores" },
    { value: "500000", label: "≥ 500k seguidores" },
];

const compactNumber = new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
});

type CastingRail = {
    key: string;
    title: string;
    description?: string;
    creators: LandingCreatorHighlight[];
    isFallback?: boolean;
    avgEngagement?: number;
};

type MarketplaceMetric = {
    key: string;
    label: string;
    value?: number | null;
    accent: "primary" | "accent" | "sun";
};

const marketplaceMetricStyles: Record<MarketplaceMetric["accent"], { border: string; tag: string; divider: string; iconBg: string }> = {
    primary: {
        border: "border-brand-primary/20",
        tag: "text-brand-primary",
        divider: "bg-brand-primary/20",
        iconBg: "bg-brand-primary/10",
    },
    accent: {
        border: "border-brand-accent/20",
        tag: "text-brand-accent",
        divider: "bg-brand-accent/20",
        iconBg: "bg-brand-accent/10",
    },
    sun: {
        border: "border-brand-sun/20",
        tag: "text-brand-sun-dark",
        divider: "bg-brand-sun/25",
        iconBg: "bg-brand-sun/10",
    },
};

/**
 * HELPERS (Cloned from CastingPageClient for exact matching)
 */
function normalizeTag(value?: string | null) {
    return (value ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function canonicalizeTag(raw?: string | null): { value: string; label: string } | null {
    const normalized = normalizeTag(raw);
    if (!normalized) return null;
    return { value: normalized, label: raw?.trim() || normalized };
}

function formatMetricValue(value?: number | null) {
    if (value === null || value === undefined) return "—";
    return compactNumber.format(value);
}

function computeEngagementRate(creator: LandingCreatorHighlight): number | null {
    if (typeof creator.engagementRate === "number" && Number.isFinite(creator.engagementRate)) {
        return creator.engagementRate;
    }

    const totalReach = creator.totalReach ?? 0;
    const totalInteractions = creator.totalInteractions ?? 0;
    if (totalReach > 0) {
        const rate = (totalInteractions / totalReach) * 100;
        return Number.isFinite(rate) ? rate : null;
    }

    const avgReach = creator.avgReachPerPost ?? 0;
    const avgInteractions = creator.avgInteractionsPerPost ?? 0;
    if (avgReach <= 0) return null;
    const rate = (avgInteractions / avgReach) * 100;
    return Number.isFinite(rate) ? rate : null;
}

function pickPrimaryNiche(creator: LandingCreatorHighlight) {
    const topContext = canonicalizeTag(creator.topPerformingContext);
    if (topContext) return topContext;

    const firstNonEmpty = (values?: string[] | null) => {
        if (!values || !values.length) return null;
        for (const entry of values) {
            const normalized = canonicalizeTag(entry);
            if (normalized) return normalized;
        }
        return null;
    };

    return firstNonEmpty(creator.niches) || firstNonEmpty(creator.brandTerritories) || firstNonEmpty(creator.contexts);
}

function buildNicheRails(sortedByEngagement: LandingCreatorHighlight[]): CastingRail[] {
    const buckets = new Map<string, { label: string; creators: LandingCreatorHighlight[]; isFallback: boolean }>();

    sortedByEngagement.forEach((creator) => {
        const primary = pickPrimaryNiche(creator);
        const value = primary?.value ?? "sem_nicho_contexto";
        const label = primary?.label ?? "Contexto diverso";
        const isFallback = !primary;
        const bucket = buckets.get(value) ?? { label, creators: [], isFallback };
        bucket.creators.push(creator);
        buckets.set(value, bucket);
    });

    return Array.from(buckets.entries())
        .map(([value, bucket]) => {
            // Ordenação final dos trilhos baseada no engajamento médio da categoria ou volume
            const avgER = bucket.creators.reduce((acc, c) => acc + (computeEngagementRate(c) ?? 0), 0) / bucket.creators.length;
            return {
                key: `niche_${value}`,
                title: bucket.isFallback ? "Contexto diverso" : bucket.label,
                description: bucket.isFallback ? "Criadores com narrativas diversificadas." : `Criadores com foco em ${bucket.label}.`,
                creators: bucket.creators,
                isFallback: bucket.isFallback,
                avgEngagement: avgER,
            };
        })
        .sort((a, b) => {
            // Ordenação de TRILHOS: prioriza trilhos com maior engajamento médio e volume
            const scoreA = (a.avgEngagement ?? 0) * (a.creators.length > 2 ? 1.5 : 1);
            const scoreB = (b.avgEngagement ?? 0) * (b.creators.length > 2 ? 1.5 : 1);
            return scoreB - scoreA;
        });
}

function buildCuratedRails(creators: LandingCreatorHighlight[]): CastingRail[] {
    if (!creators?.length) return [];

    // ORDENAÇÃO DE CRIADORES: Engajamento > Interações > Seguidores
    const sortedByEngagement = [...creators].sort((a, b) => {
        const erA = computeEngagementRate(a) ?? 0;
        const erB = computeEngagementRate(b) ?? 0;
        if (erB !== erA) return erB - erA;
        const avgA = a.avgInteractionsPerPost ?? 0;
        const avgB = b.avgInteractionsPerPost ?? 0;
        if (avgB !== avgA) return avgB - avgA;
        return (b.followers ?? 0) - (a.followers ?? 0);
    });

    return buildNicheRails(sortedByEngagement);
}

function partitionRails(rails: CastingRail[]) {
    return {
        fullRails: rails.filter(r => r.creators.length >= 2 && !r.isFallback),
        microRails: rails.filter(r => r.creators.length < 2 || r.isFallback)
    };
}

/**
 * MAIN COMPONENT
 */
export default function CastingMarketplaceSection({ initialCreators = [], metrics }: { initialCreators?: LandingCreatorHighlight[]; metrics?: LandingCommunityMetrics | null }) {
    const [creators, setCreators] = React.useState(initialCreators);
    const [loading, setLoading] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    const [minFollowers, setMinFollowers] = React.useState("");
    const [minAvgInteractions, setMinAvgInteractions] = React.useState("");
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const { appendUtm, utm } = useUtmAttribution();

    React.useEffect(() => {
        const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(handle);
    }, [search]);

    const fetchCreators = React.useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (minFollowers) params.set("minFollowers", minFollowers);
        if (minAvgInteractions) params.set("minAvgInteractions", minAvgInteractions);

        try {
            const res = await fetch(`${CASTING_API_ROUTE}?${params.toString()}`, { signal });
            if (res.ok) {
                const data = await res.json();
                setCreators(data.creators ?? []);
            }
        } catch (err) {
            if (!signal?.aborted) console.error("Marketplace sort fetch error", err);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [debouncedSearch, minFollowers, minAvgInteractions]);

    React.useEffect(() => {
        const controller = new AbortController();
        fetchCreators(controller.signal);
        return () => controller.abort();
    }, [fetchCreators]);

    const handleBrandForm = React.useCallback(() => {
        track("marketplace_ranking_cta_click");
        const overrides: Partial<UtmContext> = { utm_content: "landing_marketplace_ranking" };
        const destination = appendUtm(BRAND_CAMPAIGN_ROUTE, overrides) ?? BRAND_CAMPAIGN_ROUTE;
        window.location.assign(destination);
    }, [appendUtm]);

    const marketplaceMetrics = React.useMemo<MarketplaceMetric[]>(() => {
        if (!metrics) return [];
        return [
            {
                key: "active",
                label: "Ativos",
                value: metrics.activeCreators,
                accent: "primary",
            },
            {
                key: "reach",
                label: "Alcance",
                value: metrics.reachLast30Days,
                accent: "accent",
            },
            {
                key: "followers",
                label: "Seguidores",
                value: metrics.combinedFollowers,
                accent: "sun",
            },
        ];
    }, [metrics]);

    const curatedRails = React.useMemo(() => buildCuratedRails(creators), [creators]);
    const { fullRails, microRails } = React.useMemo(() => partitionRails(curatedRails), [curatedRails]);
    const microCreatorCount = microRails.reduce((acc, r) => acc + r.creators.length, 0);

    return (
        <section id="galeria" className="landing-section relative overflow-hidden bg-white">
            <div className="pointer-events-none absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,#0000000A,transparent_70%)]" />
            </div>
            <div className="landing-section__inner landing-section__inner--wide">
                <div className="relative mb-6 sm:mb-12">
                    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_60px_rgba(20,33,61,0.08)] backdrop-blur-2xl sm:p-8">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#FF2C7E22,transparent_45%),radial-gradient(circle_at_80%_10%,#246BFD18,transparent_50%)]" />
                        <div className="relative space-y-5 sm:space-y-6">
                            <header className="flex flex-col items-center gap-3 text-center">
                                <h2 className="text-4xl font-black text-brand-dark sm:text-5xl lg:text-6xl tracking-tight text-balance">
                                    Marketplace de Criadores
                                </h2>
                            </header>

                            {marketplaceMetrics.length > 0 && (
                                <div className="mx-auto w-full max-w-3xl sm:mx-0 sm:hidden">
                                    <div className="rounded-[1.75rem] border border-white/80 bg-white/80 px-4 py-4 shadow-[0_16px_36px_rgba(20,33,61,0.08)] backdrop-blur-xl">
                                        <div className="grid grid-cols-3">
                                            {marketplaceMetrics.map((metric) => {
                                                const isLast = metric.key === "followers";
                                                return (
                                                    <div
                                                        key={metric.key}
                                                        className={`flex flex-col items-center gap-2 px-3 text-center ${isLast ? "" : "border-r border-slate-200/60"}`}
                                                    >
                                                        <span className="text-[16px] font-black text-brand-dark">{formatMetricValue(metric.value)}</span>
                                                        <span className="text-[10px] font-semibold text-slate-500">{metric.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="sticky top-[calc(var(--landing-header-h,4.5rem)+8px)] z-30 mb-4 rounded-[1.75rem] border border-slate-100 bg-white p-2 shadow-[0_18px_40px_rgba(20,33,61,0.08)] backdrop-blur-2xl sm:mb-6 sm:p-3">
                    <div className="hidden md:grid gap-2 md:grid-cols-3">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nicho ou @"
                            className="w-full rounded-xl border border-slate-200/70 bg-slate-50/80 px-3.5 py-2.5 text-[11px] font-bold text-slate-700 outline-none transition focus:border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#FF4080]/15 placeholder:text-slate-400"
                        />
                        <select
                            value={minFollowers}
                            onChange={(e) => setMinFollowers(e.target.value)}
                            className="w-full rounded-xl border border-slate-200/70 bg-slate-50/80 px-3.5 py-2.5 text-[11px] font-bold text-slate-700 outline-none transition focus:border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#FF4080]/15"
                        >
                            {followerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select
                            value={minAvgInteractions}
                            onChange={(e) => setMinAvgInteractions(e.target.value)}
                            className="w-full rounded-xl border border-slate-200/70 bg-slate-50/80 px-3.5 py-2.5 text-[11px] font-bold text-slate-700 outline-none transition focus:border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#FF4080]/15"
                        >
                            {interactionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="md:hidden relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                            🔍
                        </span>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar"
                            className="w-full rounded-[1.25rem] border border-slate-200/70 bg-slate-50/80 pl-9 pr-14 py-3 text-[12px] font-semibold text-slate-700 shadow-inner outline-none transition focus:border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#FF4080]/15 placeholder:text-slate-400"
                        />
                        <span className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 h-4 w-px bg-slate-200/70" />
                        <button
                            type="button"
                            aria-label="Filtros"
                            onClick={() => setIsFilterOpen(true)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200/70 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                        >
                            <AdjustmentsHorizontalIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {isFilterOpen && (
                    <div className="fixed inset-0 z-[70] md:hidden">
                        <button
                            type="button"
                            aria-label="Fechar filtros"
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setIsFilterOpen(false)}
                        />
                        <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-white/70 bg-white/95 p-4 shadow-[0_-18px_40px_rgba(20,33,61,0.2)] backdrop-blur-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-brand-dark">Filtros</span>
                                <button
                                    type="button"
                                    onClick={() => setIsFilterOpen(false)}
                                    className="text-xs font-bold text-slate-500"
                                >
                                    Fechar
                                </button>
                            </div>
                            <div className="mt-4 grid gap-3">
                                <div className="grid gap-2">
                                    <span className="text-[11px] font-semibold text-slate-500">Seguidores</span>
                                    <select
                                        value={minFollowers}
                                        onChange={(e) => setMinFollowers(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
                                    >
                                        {followerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <span className="text-[11px] font-semibold text-slate-500">Interações/post</span>
                                    <select
                                        value={minAvgInteractions}
                                        onChange={(e) => setMinAvgInteractions(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
                                    >
                                        {interactionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMinFollowers("");
                                        setMinAvgInteractions("");
                                    }}
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                                >
                                    Limpar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsFilterOpen(false)}
                                    className="flex-1 rounded-xl bg-brand-primary px-3 py-2 text-xs font-bold text-white"
                                >
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONTENT */}
                <div className="space-y-10 sm:space-y-12">
                    {loading && creators.length === 0 ? (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-96 animate-pulse rounded-[3rem] bg-white border border-slate-100" />)}
                        </div>
                    ) : creators.length === 0 ? (
                        <div className="rounded-[3rem] border border-dashed border-slate-300 bg-white py-32 text-center">
                            <p className="text-xl font-black text-slate-400">Nenhum criador com esta performance no momento.</p>
                            <button onClick={() => { setSearch(""); setMinFollowers(""); setMinAvgInteractions(""); }} className="mt-4 font-black text-[#FF4080] hover:underline underline-offset-8">Limpar todos os filtros</button>
                        </div>
                    ) : (
                        <>
                            {fullRails.map((rail) => (
                                <div
                                    key={rail.key}
                                    className="space-y-4 sm:space-y-6 pt-12 border-t border-slate-100 sm:pt-16"
                                >
                                    <div className="flex items-end justify-between px-2">
                                        <div>
                                            <h3 className="text-2xl font-black text-[#141C2F] tracking-tight sm:text-3xl">{rail.title}</h3>
                                            <p className="text-xs font-semibold text-slate-500 sm:text-sm">{rail.description}</p>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/10 px-2.5 py-1 rounded-full">Top {rail.creators.length}</span>
                                    </div>
                                    <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-8 hide-scrollbar snap-x snap-proximity sm:snap-mandatory touch-pan-x overscroll-x-contain pl-2 pr-8">
                                        {rail.creators.map(c => (
                                            <CastingRankCard key={c.id} creator={c} onRequestMediaKit={handleBrandForm} />
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {microRails.length > 0 && (
                                <div className="space-y-8 pt-12 border-t border-slate-100 sm:space-y-10 sm:pt-16">
                                    <div className="flex items-end justify-between px-2">
                                        <div>
                                            <h3 className="text-2xl font-black text-[#141C2F] tracking-tight sm:text-3xl">Varias Narrativas</h3>
                                            <p className="text-xs font-semibold text-slate-500 sm:text-sm">Criadores com alto potencial de engajamento crescendo na rede.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-8 hide-scrollbar snap-x snap-proximity sm:snap-mandatory touch-pan-x overscroll-x-contain pl-2 pr-8">
                                        {microRails.flatMap(r => r.creators).map(c => (
                                            <CastingRankCard key={c.id} creator={c} onRequestMediaKit={handleBrandForm} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      `}</style>
        </section>
    );
}

/**
 * CREATOR CARD (Strategic Optimization)
 */
function CastingRankCard({ creator, variant = "rail", onRequestMediaKit }: { creator: LandingCreatorHighlight; variant?: "rail" | "grid"; onRequestMediaKit?: () => void }) {
    const followersText = compactNumber.format(creator.followers ?? 0);
    const avgReachText = creator.avgReachPerPost ? compactNumber.format(creator.avgReachPerPost) : "–";
    const engagementRate = computeEngagementRate(creator);
    const mediaKitHref = creator.mediaKitSlug ? `/mediakit/${creator.mediaKitSlug}` : null;

    return (
        <article
            className={`relative flex-shrink-0 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_14px_30px_rgba(20,33,61,0.06)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(20,33,61,0.12)] ${variant === "rail" ? "w-[160px] sm:w-[185px] snap-start" : "w-full"}`}
        >
            <div className="relative p-3">
                <div className="flex items-center justify-between">
                    <p className="truncate text-[11px] font-semibold text-[#727C8F]">@{creator.username || creator.name || "Criador"}</p>
                </div>

                <div>
                    <div className="mt-3 overflow-hidden rounded-[1.15rem] bg-[#F7F8FB] ring-1 ring-slate-100/80">
                        <div className="relative w-full pb-[100%]">
                            <UserAvatar
                                name={creator.name || creator.username || "Criador"}
                                src={creator.avatarUrl}
                                size={240}
                                className="absolute inset-0 h-full w-full rounded-none object-cover grayscale-[0.1] hover:grayscale-0 transition-all duration-500"
                            />
                        </div>
                    </div>

                    <div className="mt-3.5">
                        <p className="text-sm font-black text-[#141C2F] leading-tight truncate">{creator.name}</p>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-y-2 border-t border-slate-100/70 pt-3 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#A3A9B6]">
                        <span>Seguidores</span>
                        <span className="text-right text-[#141C2F]">{followersText}</span>
                        <span className="text-[#FF4080]">Engajamento</span>
                        <span className="text-right text-[#FF4080]">{engagementRate ? `${engagementRate.toFixed(1)}%` : "–"}</span>
                        <span>Alcance M</span>
                        <span className="text-right text-[#141C2F]">{avgReachText}</span>
                    </div>
                </div>

                <div className="pt-3">
                    {mediaKitHref ? (
                        <a href={mediaKitHref} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#141C2F] py-2.5 text-xs font-black text-white transition-transform hover:scale-[1.02] active:scale-[0.98]">
                            Ver Mídia Kit →
                        </a>
                    ) : (
                        <button onClick={onRequestMediaKit} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#141C2F] py-1.5 text-[11px] font-black text-[#141C2F] transition-all hover:bg-[#141C2F] hover:text-white">
                            Solicitar Acesso
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}
