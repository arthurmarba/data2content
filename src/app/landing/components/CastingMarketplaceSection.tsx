"use client";

import React from "react";
import { UserAvatar } from "../../components/UserAvatar";
import { useUtmAttribution } from "@/hooks/useUtmAttribution";
import { track } from "@/lib/track";
import type { UtmContext } from "@/lib/analytics/utm";
import type { LandingCommunityMetrics, LandingCreatorHighlight } from "@/types/landing";
import { BRAND_CAMPAIGN_ROUTE } from "@/constants/routes";
import { motion, useAnimationControls } from "framer-motion";
import MobileConversionFlowSection from "./MobileConversionFlowSection";

const CASTING_API_ROUTE = "/api/landing/casting";

type CastingApiPayload = {
    creators?: LandingCreatorHighlight[];
    total?: number;
    offset?: number;
    limit?: number;
    hasMore?: boolean;
};

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
    avgContextInteractions?: number;
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

function getContextAverageInteractions(creator: LandingCreatorHighlight): number {
    if (
        typeof creator.topPerformingContextAvgInteractions === "number" &&
        Number.isFinite(creator.topPerformingContextAvgInteractions)
    ) {
        return creator.topPerformingContextAvgInteractions;
    }
    return creator.avgInteractionsPerPost ?? 0;
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

function buildNicheRails(sortedByContextAvg: LandingCreatorHighlight[]): CastingRail[] {
    const buckets = new Map<string, { label: string; creators: LandingCreatorHighlight[]; isFallback: boolean }>();

    sortedByContextAvg.forEach((creator) => {
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
            const sortedCreators = [...bucket.creators].sort((a, b) => {
                const contextAvgDiff = getContextAverageInteractions(b) - getContextAverageInteractions(a);
                if (contextAvgDiff !== 0) return contextAvgDiff;
                const avgDiff = (b.avgInteractionsPerPost ?? 0) - (a.avgInteractionsPerPost ?? 0);
                if (avgDiff !== 0) return avgDiff;
                return (b.followers ?? 0) - (a.followers ?? 0);
            });

            const avgContextInteractions =
                sortedCreators.reduce((acc, creator) => acc + getContextAverageInteractions(creator), 0) /
                Math.max(sortedCreators.length, 1);

            return {
                key: `niche_${value}`,
                title: bucket.isFallback ? "Contexto diverso" : bucket.label,
                description: bucket.isFallback ? "Criadores com narrativas diversificadas validadas pela nossa IA." : `Narrativa estratégica com forte engajamento em ${bucket.label}.`,
                creators: sortedCreators,
                isFallback: bucket.isFallback,
                avgContextInteractions,
            };
        })
        .sort((a, b) => {
            const volumeDiff = b.creators.length - a.creators.length;
            if (volumeDiff !== 0) return volumeDiff;
            const contextAvgDiff = (b.avgContextInteractions ?? 0) - (a.avgContextInteractions ?? 0);
            if (contextAvgDiff !== 0) return contextAvgDiff;
            return a.title.localeCompare(b.title);
        });
}

function buildCuratedRails(creators: LandingCreatorHighlight[]): CastingRail[] {
    if (!creators?.length) return [];

    // ORDENAÇÃO DE CRIADORES: Interações médias do contexto > Interações médias globais > Seguidores
    const sortedByContextAvg = [...creators].sort((a, b) => {
        const contextAvgDiff = getContextAverageInteractions(b) - getContextAverageInteractions(a);
        if (contextAvgDiff !== 0) return contextAvgDiff;
        const avgA = a.avgInteractionsPerPost ?? 0;
        const avgB = b.avgInteractionsPerPost ?? 0;
        if (avgB !== avgA) return avgB - avgA;
        return (b.followers ?? 0) - (a.followers ?? 0);
    });

    return buildNicheRails(sortedByContextAvg);
}

export const COMMUNITY_METRICS = [
    { value: "50", label: "Criadores", icon: "💎", color: "text-brand-primary", glow: "shadow-[0_0_20px_rgba(255,44,126,0.12)]", bg: "bg-brand-primary/10" },
    { value: "27M", label: "Alcance", icon: "🚀", color: "text-brand-accent", glow: "shadow-[0_0_20px_rgba(36,107,253,0.12)]", bg: "bg-brand-accent/10" },
    { value: "7M", label: "Seguidores", icon: "👥", color: "text-brand-sun-dark", glow: "shadow-[0_0_20px_rgba(255,179,71,0.12)]", bg: "bg-brand-sun/10" },
    { value: "12%", label: "Engajamento", icon: "⚡", color: "text-brand-primary", glow: "shadow-[0_0_20px_rgba(255,44,126,0.12)]", bg: "bg-brand-primary/10" },
    { value: "15+", label: "Nichos", icon: "🎯", color: "text-brand-accent", glow: "shadow-[0_0_20px_rgba(36,107,253,0.12)]", bg: "bg-brand-accent/10" },
    { value: "200+", label: "Marcas", icon: "💼", color: "text-brand-dark", glow: "shadow-[0_0_20px_rgba(20,28,47,0.08)]", bg: "bg-slate-100" },
];

export function CommunityMetricCard({ metric, index }: { metric: typeof COMMUNITY_METRICS[0]; index: number }) {
    return (
        <article
            className={`group relative flex w-[140px] shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-[1.6rem] border border-white/40 bg-white/60 p-4 backdrop-blur-md shadow-[0_16px_34px_rgba(20,33,61,0.04)] transition-all duration-500 hover:-translate-y-1.5 hover:bg-white/80 hover:shadow-[0_22px_44px_rgba(20,33,61,0.08)] sm:w-[195px] sm:rounded-[2rem] sm:p-7 ${metric.glow}`}
        >
            {/* Inner Reflection Edge */}
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/80 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className={`flex h-11 w-11 items-center justify-center rounded-[1.1rem] ${metric.bg} text-xl shadow-inner transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl`}>
                {metric.icon}
            </div>

            <div className="flex flex-col items-center text-center">
                <span className={`text-2xl font-black leading-none tracking-tighter transition-transform duration-500 group-hover:scale-105 sm:text-4xl ${metric.color}`}>
                    +{metric.value}
                </span>
                <span className="mt-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 sm:text-[10px]">
                    {metric.label}
                </span>
            </div>

            {/* Subtle pulsive glow */}
            <div className={`absolute -bottom-4 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full blur-md transition-all duration-500 group-hover:h-3 group-hover:w-16 ${metric.color.replace('text-', 'bg-').split(' ')[0]}`} />
        </article>
    );
}

export function CommunityMetricsRail({ speed = 0.03 }: { speed?: number }) {
    return (
        <div className="relative flex w-full overflow-hidden py-2">
            {/* Gradient Fades */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-white/95 to-white/0 sm:w-16" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white/95 to-white/0 sm:w-16" />

            <div className="flex animate-marquee gap-3 sm:gap-4">
                {[...COMMUNITY_METRICS, ...COMMUNITY_METRICS, ...COMMUNITY_METRICS].map((m, i) => (
                    <CommunityMetricCard key={`${m.label}-${i}`} metric={m} index={i} />
                ))}
            </div>
            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                .animate-marquee {
                    display: flex;
                    width: max-content;
                    animation: marquee ${20 / speed}s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
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
export default function CastingMarketplaceSection({
    initialCreators = [],
    metrics: _metrics,
    categories,
}: {
    initialCreators?: LandingCreatorHighlight[];
    metrics?: LandingCommunityMetrics | null;
    categories?: { label?: string | null }[] | null;
}) {
    const initialCreatorsAreFallback = React.useMemo(
        () => initialCreators.length > 0 && initialCreators.every((creator) => creator.id.startsWith("fallback-")),
        [initialCreators],
    );
    const [creators, setCreators] = React.useState<LandingCreatorHighlight[]>(initialCreators);
    const [loading, setLoading] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    const [minFollowers, setMinFollowers] = React.useState("");
    const [minAvgInteractions, setMinAvgInteractions] = React.useState("");
    const [isDesktopLayout, setIsDesktopLayout] = React.useState(false);
    const { appendUtm } = useUtmAttribution();
    const hasActiveFilters = Boolean(debouncedSearch || minFollowers || minAvgInteractions);

    React.useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mediaQuery = window.matchMedia("(min-width: 768px)");
        const sync = () => setIsDesktopLayout(mediaQuery.matches);
        sync();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", sync);
            return () => mediaQuery.removeEventListener("change", sync);
        }

        mediaQuery.addListener(sync);
        return () => mediaQuery.removeListener(sync);
    }, []);

    React.useEffect(() => {
        const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(handle);
    }, [search]);

    const fetchCreators = React.useCallback(async ({
        signal,
        mode = "full",
    }: {
        signal?: AbortSignal;
        mode?: "featured" | "full";
    }) => {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("mode", mode);
        params.set("offset", "0");
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (minFollowers) params.set("minFollowers", minFollowers);
        if (minAvgInteractions) params.set("minAvgInteractions", minAvgInteractions);

        try {
            const res = await fetch(`${CASTING_API_ROUTE}?${params.toString()}`, { signal });
            if (res.ok) {
                const data = (await res.json()) as CastingApiPayload;
                setCreators(data.creators ?? []);
            }
        } catch (err) {
            if (!signal?.aborted) console.error("Marketplace sort fetch error", err);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [debouncedSearch, minFollowers, minAvgInteractions]);

    React.useEffect(() => {
        if (hasActiveFilters) return;

        if (!initialCreatorsAreFallback && initialCreators.length > 0) {
            setCreators(initialCreators);
            setLoading(false);
        }

        const controller = new AbortController();
        fetchCreators({
            signal: controller.signal,
            mode: "full",
        });
        return () => controller.abort();
    }, [fetchCreators, hasActiveFilters, initialCreators, initialCreatorsAreFallback]);

    React.useEffect(() => {
        if (!hasActiveFilters) return;
        const controller = new AbortController();
        fetchCreators({
            signal: controller.signal,
            mode: "full",
        });
        return () => controller.abort();
    }, [fetchCreators, hasActiveFilters]);

    const handleBrandForm = React.useCallback(() => {
        track("marketplace_ranking_cta_click");
        const overrides: Partial<UtmContext> = { utm_content: "landing_marketplace_ranking" };
        const destination = appendUtm(BRAND_CAMPAIGN_ROUTE, overrides) ?? BRAND_CAMPAIGN_ROUTE;
        window.location.assign(destination);
    }, [appendUtm]);

    const curatedRails = React.useMemo(() => buildCuratedRails(creators), [creators]);
    const { fullRails, microRails } = React.useMemo(() => partitionRails(curatedRails), [curatedRails]);
    const railScrollerStyle = {
        "--market-card-width": "clamp(112px, calc((100% - 2.75rem) / 2.95), 126px)",
    } as React.CSSProperties;
    void _metrics;

    const renderMarketplaceContent = (options?: { embeddedMobile?: boolean }) => {
        const embeddedMobile = options?.embeddedMobile ?? false;
        const wrapperClassName = embeddedMobile ? "space-y-6" : "space-y-7 sm:space-y-8";
        const emptyStateClassName = embeddedMobile
            ? "mx-4 rounded-[1.8rem] border border-dashed border-slate-300 bg-white/80 py-16 text-center"
            : "rounded-[3rem] border border-dashed border-slate-300 bg-white py-32 text-center";

        return (
            <div className={wrapperClassName}>
                {loading && creators.length === 0 ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-96 animate-pulse rounded-[3rem] bg-white border border-slate-100" />)}
                    </div>
                ) : creators.length === 0 ? (
                    <div className={emptyStateClassName}>
                        <p className="text-xl font-black text-slate-400">Nenhum criador com esta performance no momento.</p>
                        <button onClick={() => { setSearch(""); setMinFollowers(""); setMinAvgInteractions(""); }} className="mt-4 font-black text-[#FF4080] hover:underline underline-offset-8">Limpar todos os filtros</button>
                    </div>
                ) : (
                    <>
                        {fullRails.map((rail, railIndex) => (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.6, delay: railIndex * 0.15, ease: "easeOut" }}
                                key={rail.key}
                                className={railIndex === 0
                                    ? embeddedMobile
                                        ? "space-y-4 pt-0.5"
                                        : "space-y-4 pt-0.5 sm:space-y-4 sm:pt-10"
                                    : embeddedMobile
                                        ? "space-y-4 border-t border-slate-100 pt-6"
                                        : "space-y-4 border-t border-slate-100 pt-8 sm:space-y-4 sm:pt-10"}
                            >
                                <div className={embeddedMobile ? "px-4" : "mx-auto flex max-w-7xl items-end px-1.5 sm:px-4"}>
                                    <div>
                                        <h3 className="text-[1.4rem] font-black leading-[1.05] tracking-[-0.03em] text-[#141C2F] sm:text-3xl">{rail.title}</h3>
                                    </div>
                                </div>

                                <AutoScrollRail creators={rail.creators} handleBrandForm={handleBrandForm} speed={0.04} style={railScrollerStyle} />
                            </motion.div>
                        ))}

                        {microRails.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className={embeddedMobile ? "space-y-4 border-t border-slate-100 pt-6" : "space-y-4 border-t border-slate-100 pt-8 sm:space-y-6 sm:pt-10"}
                            >
                                <div className={embeddedMobile ? "flex items-end justify-between px-4" : "mx-auto flex max-w-7xl items-end justify-between px-1.5 sm:px-4"}>
                                    <div>
                                        <h3 className="text-[1.4rem] font-black leading-[1.05] tracking-[-0.03em] text-[#141C2F] sm:text-3xl">Diversas Narrativas</h3>
                                    </div>
                                </div>

                                <AutoScrollRail creators={microRails.flatMap(r => r.creators)} handleBrandForm={handleBrandForm} speed={0.03} style={railScrollerStyle} />
                            </motion.div>
                        )}
                    </>
                )}
            </div>
        );
    };

    return (
        <section id="galeria" className="landing-section landing-section--compact-top relative overflow-hidden bg-white pt-2 scroll-mt-[calc(var(--landing-header-h,4.5rem)+10px)]" style={{ paddingTop: 0 }}>
            <div className="landing-section__inner landing-section__inner--wide">
                {!isDesktopLayout ? (
                    <div
                        data-testid="marketplace-mobile-integrated-layout"
                        className="px-4 pb-0 pt-2"
                    >
                        <MobileConversionFlowSection categories={categories as any} creators={creators} embedded />
                        <div className="pt-4">
                            {renderMarketplaceContent({ embeddedMobile: true })}
                        </div>
                    </div>
                ) : (
                    <>
                        <div
                            data-testid="marketplace-filter-bar"
                            className="sticky top-[calc(var(--landing-header-h,4.5rem)+4px)] z-30 mb-5 rounded-[1.25rem] border border-slate-100 bg-white/95 p-2 shadow-[0_18px_40px_rgba(20,33,61,0.08)] backdrop-blur-2xl md:mb-7 md:rounded-[1.75rem] md:p-4"
                        >
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
                                <div className="relative">
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Buscar por nicho ou @"
                                        className="w-full rounded-xl border border-slate-200/70 bg-slate-50/80 py-2.5 pl-9 pr-3.5 text-[12px] font-bold text-slate-700 outline-none transition focus:border-brand-primary/30 focus:bg-white focus:ring-4 focus:ring-brand-primary/5 placeholder:text-slate-400 md:py-3 md:text-[11px]"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </span>
                                </div>
                                <div className="flex gap-2 md:contents">
                                    <select
                                        value={minFollowers}
                                        onChange={(e) => setMinFollowers(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 text-[11px] font-bold text-slate-700 outline-none transition focus:border-brand-primary/30 focus:bg-white focus:ring-4 focus:ring-brand-primary/5 md:py-3"
                                    >
                                        {followerOptions.map(o => <option key={o.value} value={o.value}>{o.label === "Todos os seguidores" ? "Seguidores" : o.label}</option>)}
                                    </select>
                                    <select
                                        value={minAvgInteractions}
                                        onChange={(e) => setMinAvgInteractions(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 text-[11px] font-bold text-slate-700 outline-none transition focus:border-brand-primary/30 focus:bg-white focus:ring-4 focus:ring-brand-primary/5 md:py-3"
                                    >
                                        {interactionOptions.map(o => <option key={o.value} value={o.value}>{o.label === "Todas interações/post" ? "Performance" : o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mb-5 hidden border-t border-slate-200/80 sm:mb-6 sm:block" />
                        <div className="md:pt-1">
                            {renderMarketplaceContent()}
                        </div>
                    </>
                )}
            </div>
            <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      `}</style>
        </section>
    );
}

function AutoScrollRail({ creators, handleBrandForm, speed = 0.04, style }: { creators: LandingCreatorHighlight[]; handleBrandForm: () => void; speed?: number; style?: React.CSSProperties }) {
    const scrollerRef = React.useRef<HTMLDivElement>(null);
    const setRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const [isMobile, setIsMobile] = React.useState<boolean | null>(null);
    const [isInteraction, setIsInteraction] = React.useState(false);
    const [cycleWidth, setCycleWidth] = React.useState(0);
    const [shouldAutoScrollDesktop, setShouldAutoScrollDesktop] = React.useState(false);
    const [shouldAutoScrollMobile, setShouldAutoScrollMobile] = React.useState(false);
    const interactionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const AUTO_SCROLL_MIN_CREATORS_DESKTOP = 6; // ativa apenas quando houver mais de 5
    const AUTO_SCROLL_MIN_CREATORS_MOBILE = 4; // ativa apenas quando houver mais de 3

    const normalizedCreators = React.useMemo(() => {
        const seen = new Set<string>();
        return creators.filter((creator) => {
            const key = String(creator?.id || "").trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [creators]);

    const desktopSetCount = shouldAutoScrollDesktop ? 3 : 1;

    React.useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const sync = () => setIsMobile(mediaQuery.matches);
        sync();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", sync);
            return () => mediaQuery.removeEventListener("change", sync);
        }

        mediaQuery.addListener(sync);
        return () => mediaQuery.removeListener(sync);
    }, []);

    const handleInteractionStart = () => {
        setIsInteraction(true);
        if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
        }
    };

    const handleInteractionEnd = () => {
        interactionTimeoutRef.current = setTimeout(() => {
            setIsInteraction(false);
        }, 800);
    };

    const normalizeScrollPosition = React.useCallback((scroller: HTMLDivElement, measuredCycleWidth: number) => {
        if (measuredCycleWidth <= 0) return;

        const min = measuredCycleWidth;
        const max = measuredCycleWidth * 2;
        let next = scroller.scrollLeft;

        while (next < min) {
            next += measuredCycleWidth;
        }
        while (next >= max) {
            next -= measuredCycleWidth;
        }

        if (Math.abs(next - scroller.scrollLeft) > 0.1) {
            scroller.scrollLeft = next;
        }
    }, []);

    React.useEffect(() => {
        return () => {
            if (interactionTimeoutRef.current) {
                clearTimeout(interactionTimeoutRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        setShouldAutoScrollDesktop(false);
        setShouldAutoScrollMobile(false);
        setCycleWidth(0);
    }, [normalizedCreators.length]);

    React.useEffect(() => {
        const scroller = scrollerRef.current;
        const firstSet = setRefs.current[0];
        if (isMobile !== false || !scroller || !firstSet) return;

        const evaluateAutoScroll = () => {
            const viewportWidth = scroller.clientWidth;
            const contentWidth = firstSet.scrollWidth;
            const hasOverflow = contentWidth - viewportWidth > 24;
            const shouldEnable = normalizedCreators.length >= AUTO_SCROLL_MIN_CREATORS_DESKTOP && hasOverflow;
            setShouldAutoScrollDesktop(shouldEnable);
            if (!shouldEnable) {
                setCycleWidth(0);
                scroller.scrollLeft = 0;
            }
        };

        evaluateAutoScroll();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(evaluateAutoScroll);
            observer.observe(scroller);
            observer.observe(firstSet);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", evaluateAutoScroll);
        return () => window.removeEventListener("resize", evaluateAutoScroll);
    }, [isMobile, normalizedCreators.length]);

    React.useEffect(() => {
        const scroller = scrollerRef.current;
        const firstSet = setRefs.current[0];
        const secondSet = setRefs.current[1];
        if (isMobile !== false || !shouldAutoScrollDesktop || !scroller || !firstSet || !secondSet) return;

        const recalculateCycleWidth = () => {
            const measuredWidth = secondSet.getBoundingClientRect().left - firstSet.getBoundingClientRect().left;
            if (measuredWidth > 0) {
                setCycleWidth(measuredWidth);
            }
        };

        recalculateCycleWidth();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(recalculateCycleWidth);
            observer.observe(scroller);
            observer.observe(firstSet);
            observer.observe(secondSet);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", recalculateCycleWidth);
        return () => window.removeEventListener("resize", recalculateCycleWidth);
    }, [isMobile, normalizedCreators.length, shouldAutoScrollDesktop]);

    React.useEffect(() => {
        const scroller = scrollerRef.current;
        if (isMobile !== false || !shouldAutoScrollDesktop || !scroller || cycleWidth <= 0) return;
        scroller.scrollLeft = cycleWidth;
        normalizeScrollPosition(scroller, cycleWidth);
    }, [cycleWidth, isMobile, normalizeScrollPosition, shouldAutoScrollDesktop]);

    React.useEffect(() => {
        const scroller = scrollerRef.current;
        if (isMobile !== false || !shouldAutoScrollDesktop || !scroller || cycleWidth <= 0) return;

        let animationId: number;
        let lastTimestamp: number;

        const step = (timestamp: number) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            if (!isInteraction) {
                // native subpixel animation
                scroller.scrollLeft += deltaTime * speed;
                normalizeScrollPosition(scroller, cycleWidth);
            }
            animationId = requestAnimationFrame(step);
        };

        animationId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationId);
    }, [cycleWidth, isInteraction, isMobile, normalizeScrollPosition, shouldAutoScrollDesktop, speed]);

    React.useEffect(() => {
        const scroller = scrollerRef.current;
        if (isMobile !== true || !scroller) return;

        const evaluateAutoScroll = () => {
            const hasOverflow = scroller.scrollWidth - scroller.clientWidth > 24;
            const shouldEnable = normalizedCreators.length >= AUTO_SCROLL_MIN_CREATORS_MOBILE && hasOverflow;
            setShouldAutoScrollMobile(shouldEnable);
            if (!shouldEnable) {
                scroller.scrollLeft = 0;
            }
        };

        evaluateAutoScroll();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(evaluateAutoScroll);
            observer.observe(scroller);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", evaluateAutoScroll);
        return () => window.removeEventListener("resize", evaluateAutoScroll);
    }, [isMobile, normalizedCreators.length]);

    React.useEffect(() => {
        const scroller = scrollerRef.current;
        if (isMobile !== true || !shouldAutoScrollMobile || !scroller) return;

        let animationId: number;
        let lastTimestamp: number;

        const step = (timestamp: number) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            if (!isInteraction) {
                const maxScroll = scroller.scrollWidth - scroller.clientWidth;
                if (maxScroll > 0) {
                    const next = scroller.scrollLeft + deltaTime * speed;
                    scroller.scrollLeft = next >= maxScroll ? 0 : next;
                }
            }

            animationId = requestAnimationFrame(step);
        };

        animationId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationId);
    }, [isInteraction, isMobile, shouldAutoScrollMobile, speed, normalizedCreators.length]);

    if (isMobile !== false) {
        return (
            <div className="relative flex overflow-hidden w-full">
                <div
                    data-testid="marketplace-mobile-rail"
                    ref={scrollerRef}
                    className="flex gap-3 overflow-x-auto px-4 pb-3 pt-1.5 hide-scrollbar touch-pan-x snap-x snap-mandatory"
                    style={style}
                    onMouseEnter={handleInteractionStart}
                    onMouseLeave={handleInteractionEnd}
                    onPointerDown={handleInteractionStart}
                    onPointerUp={handleInteractionEnd}
                    onTouchStart={handleInteractionStart}
                    onTouchEnd={handleInteractionEnd}
                    onWheel={() => {
                        handleInteractionStart();
                        handleInteractionEnd();
                    }}
                >
                    {normalizedCreators.map((c) => (
                        <CastingRankCard key={c.id} creator={c} variant="railCompact" onRequestMediaKit={handleBrandForm} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex overflow-hidden group w-full" style={style}>
            {/* Gradient Fades */}
            <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-r from-white to-white/0 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-l from-white to-white/0 pointer-events-none" />

            <div
                ref={scrollerRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-1 hide-scrollbar touch-pan-x px-6"
                onMouseEnter={handleInteractionStart}
                onMouseLeave={handleInteractionEnd}
                onPointerDown={handleInteractionStart}
                onPointerUp={handleInteractionEnd}
                onTouchStart={handleInteractionStart}
                onTouchEnd={handleInteractionEnd}
                onWheel={() => {
                    handleInteractionStart();
                    handleInteractionEnd();
                }}
                onScroll={() => {
                    const scroller = scrollerRef.current;
                    if (!shouldAutoScrollDesktop || !scroller || cycleWidth <= 0) return;
                    normalizeScrollPosition(scroller, cycleWidth);
                }}
            >
                {Array.from({ length: desktopSetCount }, (_, setIndex) => (
                    <div
                        key={`set-${setIndex}`}
                        ref={(el) => {
                            setRefs.current[setIndex] = el;
                        }}
                        className="flex shrink-0 gap-2 sm:gap-4"
                    >
                        {normalizedCreators.map((c) => (
                            <div key={`${setIndex}-${c.id}`} className="shrink-0">
                                <CastingRankCard creator={c} variant="railCompact" onRequestMediaKit={handleBrandForm} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * CREATOR CARD (Strategic Optimization)
 */
function CastingRankCard({
    creator,
    variant = "rail",
    onRequestMediaKit
}: {
    creator: LandingCreatorHighlight;
    variant?: "rail" | "railCompact" | "grid";
    onRequestMediaKit?: () => void
}) {
    const followersText = compactNumber.format(creator.followers ?? 0);
    const avgReachText = creator.avgReachPerPost ? compactNumber.format(creator.avgReachPerPost) : "–";
    const engagementRate = computeEngagementRate(creator);
    const mediaKitHref = creator.mediaKitSlug ? `/mediakit/${creator.mediaKitSlug}` : null;
    const cardWidthClass =
        variant === "railCompact"
            ? "w-[var(--market-card-width)] min-w-[var(--market-card-width)] sm:w-[185px] sm:min-w-[185px] snap-start"
            : variant === "rail"
                ? "w-[160px] sm:w-[185px] snap-start"
                : "w-full";

    return (
        <article
            className={`relative flex-shrink-0 overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] shadow-[0_12px_28px_rgba(20,33,61,0.05)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_18px_36px_rgba(20,33,61,0.08)] sm:rounded-[1.5rem] ${cardWidthClass}`}
        >
            <div className="relative p-2 sm:p-3">
                <div className="flex items-center justify-between">
                    <p className="max-w-full truncate rounded-full bg-slate-100/90 px-2 py-1 text-[8px] font-bold tracking-[-0.01em] text-[#6F7890] sm:bg-transparent sm:px-0 sm:py-0 sm:text-[11px]">@{creator.username || creator.name || "Criador"}</p>
                </div>

                <div>
                    <div className="mt-2.5 overflow-hidden rounded-[1.1rem] bg-[linear-gradient(180deg,#f8f9fd_0%,#eef2f9_100%)] ring-1 ring-slate-100/80 sm:mt-3 sm:rounded-[1.15rem]">
                        <div className="relative w-full pb-[100%]">
                            <UserAvatar
                                name={creator.name || creator.username || "Criador"}
                                src={creator.avatarUrl}
                                size={96}
                                fit="contain"
                                fillContainer
                                className="absolute inset-0 h-full w-full rounded-[1.05rem] grayscale-[0.1] transition-all duration-500 hover:grayscale-0 sm:rounded-[1.15rem]"
                            />
                        </div>
                    </div>

                    <div className="mt-2.5 sm:mt-3.5">
                        <p className="line-clamp-2 min-h-[2rem] text-[12.5px] font-black leading-[1.18] tracking-[-0.02em] text-[#141C2F] sm:text-sm">{creator.name}</p>
                    </div>

                    <div className="mt-2.5 border-t border-slate-100/80 pt-2.5 sm:mt-3.5 sm:pb-1 sm:pt-3">
                        <div className="grid grid-cols-1 gap-1.5 sm:block sm:space-y-2">
                            <div className="grid grid-cols-1 gap-0.5 rounded-[0.9rem] border border-slate-100 bg-slate-50/85 px-2 py-1.5 text-[8px] font-black tracking-[0.02em] text-[#A3A9B6] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-[9px] sm:tracking-[0.16em] sm:uppercase">
                                <span className="pr-1 text-slate-400">Seguidores</span>
                                <span className="text-left text-[10px] text-brand-dark tabular-nums sm:text-right sm:text-[9px] sm:whitespace-nowrap">{followersText}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-0.5 rounded-[0.9rem] border border-brand-primary/10 bg-brand-primary/[0.04] px-2 py-1.5 text-[8px] font-black tracking-[0.02em] text-[#A3A9B6] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-[9px] sm:tracking-[0.16em] sm:uppercase">
                                <span className="pr-1 text-brand-primary/60">Taxa de Eng.</span>
                                <span className="text-left text-[10px] text-brand-primary tabular-nums sm:text-right sm:text-[9px] sm:whitespace-nowrap">{engagementRate ? `${engagementRate.toFixed(1)}%` : "–"}</span>
                            </div>
                            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-[9px] font-black tracking-[0.16em] text-[#A3A9B6] uppercase">
                                <span className="truncate pr-1">Alcance M</span>
                                <span className="text-right text-[#141C2F] whitespace-nowrap tabular-nums">{avgReachText}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-3 sm:pt-3">
                    {mediaKitHref ? (
                        <a href={mediaKitHref} className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[#141C2F] py-2.5 text-[11px] font-black leading-none text-white transition-transform hover:scale-[1.02] active:scale-[0.98] sm:rounded-2xl sm:py-2.5 sm:text-xs">
                            <span className="whitespace-nowrap sm:hidden">Conhecer</span>
                            <span className="hidden sm:inline">Ver Mídia Kit →</span>
                        </a>
                    ) : (
                        <button onClick={onRequestMediaKit} className="flex w-full items-center justify-center gap-2 rounded-[1rem] border-2 border-[#141C2F] py-2.5 text-[11px] font-black leading-none text-[#141C2F] transition-all hover:bg-[#141C2F] hover:text-white sm:rounded-2xl sm:text-[11px]">
                            <span className="whitespace-nowrap sm:hidden">Solicitar</span>
                            <span className="hidden sm:inline">Solicitar Acesso</span>
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}
