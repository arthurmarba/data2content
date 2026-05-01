"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
    ChevronDownIcon,
    ChevronUpIcon,
    Filter,
    Play,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import DiscoverVideoModal from "@/app/discover/components/DiscoverVideoModal";
import { getMetricStrategicPresentation } from "@/app/lib/metricStrategicPresentation";

interface TopDiscoveryPost {
    id?: string;
    caption: string;
    date?: string;
    metaLabel: string;
    proposal: string[];
    context: string[];
    tone: string[];
    reference: string[];
    format: string[];
    contentIntent?: string[];
    narrativeForm?: string[];
    contentSignals?: string[];
    stance?: string[];
    proofStyle?: string[];
    commercialMode?: string[];
    nf: number | null;
    pv: number | null;
    reach: number | null;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    durationSeconds?: number | null;
    thumbnail?: string | null;
    postLink?: string | null;
    videoUrl?: string | null;
}

interface TopDiscoveryTableProps {
    posts: TopDiscoveryPost[];
    isLoading?: boolean;
    compactLayout?: boolean;
}

type SortField = "nf" | "pv" | "reach" | "likes" | "comments" | "shares" | "saves";
type SortOrder = "asc" | "desc";
type FilterKey = "format" | "intent" | "narrative" | "context" | "strategy";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
    style: "percent",
});
const sortFieldLabel: Record<SortField, string> = {
    nf: "Descoberta",
    pv: "Visitas",
    reach: "Alcance",
    likes: "Curtidas",
    comments: "Comentários",
    shares: "Compartilhamentos",
    saves: "Salvos",
};

const FILTER_LABELS: Record<FilterKey, string> = {
    format: "Formato",
    intent: "Intenção",
    narrative: "Narrativa",
    context: "Contexto",
    strategy: "Estratégia",
};

const normalizeSearch = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

const uniqueSorted = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));

const metricValue = (post: TopDiscoveryPost, field: SortField) => {
    const value = post[field];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const formatDiscovery = (value: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    return percentFormatter.format(Math.max(0, Math.min(value, 1)));
};

const formatCompactMetric = (value: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)} mi`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} mil`;
    return numberFormatter.format(Math.round(value));
};

const compactSortFields: SortField[] = ["reach", "likes", "comments", "shares", "saves", "nf"];

const getCompactPrimaryMetric = (post: TopDiscoveryPost, field: SortField) => {
    if (field === "nf") return { label: "Descoberta", value: formatDiscovery(post.nf) };
    if (field === "pv") return { label: "Visitas", value: formatCompactMetric(post.pv) };
    if (field === "likes") return { label: "Curtidas", value: formatCompactMetric(post.likes) };
    if (field === "comments") return { label: "Comentários", value: formatCompactMetric(post.comments) };
    if (field === "shares") return { label: "Compart.", value: formatCompactMetric(post.shares) };
    if (field === "saves") return { label: "Salvos", value: formatCompactMetric(post.saves) };
    return { label: "Alcance", value: formatCompactMetric(post.reach) };
};

const formatDuration = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
    const totalSeconds = Math.round(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const uniqueTagGroups = (tags: Array<{ value: string; tone: "slate" | "indigo" | "violet" | "sky" | "amber" }>) => {
    const seen = new Set<string>();
    return tags.filter((tag) => {
        const key = `${tag.tone}:${tag.value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return Boolean(tag.value);
    });
};

export function TopDiscoveryTable({ posts, isLoading, compactLayout = false }: TopDiscoveryTableProps) {
    const [sortField, setSortField] = useState<SortField>("reach");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [activePost, setActivePost] = useState<TopDiscoveryPost | null>(null);
    const [query, setQuery] = useState("");
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [filters, setFilters] = useState<Record<FilterKey, string>>({
        format: "",
        intent: "",
        narrative: "",
        context: "",
        strategy: "",
    });

    const presentedPosts = useMemo(
        () =>
            posts.map((post) => ({
                post,
                presentation: getMetricStrategicPresentation({
                    format: post.format,
                    proposal: post.proposal,
                    context: post.context,
                    tone: post.tone,
                    references: post.reference,
                    contentIntent: post.contentIntent,
                    narrativeForm: post.narrativeForm,
                    contentSignals: post.contentSignals,
                    stance: post.stance,
                    proofStyle: post.proofStyle,
                    commercialMode: post.commercialMode,
                }),
            })),
        [posts]
    );

    const filterOptions = useMemo(() => {
        const buckets: Record<FilterKey, string[]> = {
            format: [],
            intent: [],
            narrative: [],
            context: [],
            strategy: [],
        };
        presentedPosts.forEach(({ presentation }) => {
            buckets.format.push(...presentation.formatLabels);
            buckets.intent.push(...presentation.intentLabels);
            buckets.narrative.push(...presentation.narrativeLabels);
            buckets.context.push(...presentation.contextLabels);
            buckets.strategy.push(
                ...presentation.proofLabels,
                ...presentation.commercialLabels,
                ...presentation.signalLabels,
                ...presentation.stanceLabels
            );
        });
        return {
            format: uniqueSorted(buckets.format),
            intent: uniqueSorted(buckets.intent),
            narrative: uniqueSorted(buckets.narrative),
            context: uniqueSorted(buckets.context),
            strategy: uniqueSorted(buckets.strategy),
        };
    }, [presentedPosts]);

    const filteredPosts = useMemo(() => {
        const normalizedQuery = normalizeSearch(query);
        const matchesFilter = (labels: string[], value: string) => !value || labels.includes(value);

        return presentedPosts
            .filter(({ post, presentation }) => {
                const strategyLabels = [
                    ...presentation.proofLabels,
                    ...presentation.commercialLabels,
                    ...presentation.signalLabels,
                    ...presentation.stanceLabels,
                ];
                if (!matchesFilter(presentation.formatLabels, filters.format)) return false;
                if (!matchesFilter(presentation.intentLabels, filters.intent)) return false;
                if (!matchesFilter(presentation.narrativeLabels, filters.narrative)) return false;
                if (!matchesFilter(presentation.contextLabels, filters.context)) return false;
                if (!matchesFilter(strategyLabels, filters.strategy)) return false;
                if (!normalizedQuery) return true;

                const searchable = normalizeSearch(
                    [
                        post.caption,
                        post.metaLabel,
                        ...presentation.formatLabels,
                        ...presentation.intentLabels,
                        ...presentation.narrativeLabels,
                        ...presentation.contextLabels,
                        ...strategyLabels,
                    ].join(" ")
                );
                return searchable.includes(normalizedQuery);
            })
            .sort((a, b) => {
                const valA = metricValue(a.post, sortField);
                const valB = metricValue(b.post, sortField);
                return sortOrder === "asc" ? valA - valB : valB - valA;
            });
    }, [filters, presentedPosts, query, sortField, sortOrder]);

    const activeFilterCount = Object.values(filters).filter(Boolean).length + (query.trim() ? 1 : 0);
    const hasActiveFilters = activeFilterCount > 0;
    const activeFilterChips = useMemo(
        () =>
            (Object.entries(filters) as Array<[FilterKey, string]>)
                .filter(([, value]) => Boolean(value))
                .map(([key, value]) => ({ key, label: FILTER_LABELS[key], value })),
        [filters]
    );
    const updateFilter = (key: FilterKey, value: string) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    const clearFilters = () => {
        setQuery("");
        setMobileFiltersOpen(false);
        setFilters({
            format: "",
            intent: "",
            narrative: "",
            context: "",
            strategy: "",
        });
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };
    const handleSortSelect = (field: SortField) => {
        if (sortField === field) return;
        setSortField(field);
        setSortOrder("desc");
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <div className="h-4 w-4" />;
        return sortOrder === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />;
    };

    const HeaderCell = ({
        field,
        label,
        align = "right",
    }: {
        field: SortField;
        label: string;
        align?: "left" | "right";
    }) => (
        <button
            type="button"
            className={`flex items-center gap-1 transition-colors hover:text-slate-700 ${
                align === "right" ? "justify-end text-right" : "justify-start text-left"
            }`}
            onClick={() => handleSort(field)}
        >
            {align === "right" && <SortIcon field={field} />}
            <span>{label}</span>
            {align === "left" && <SortIcon field={field} />}
        </button>
    );

    const FilterSelect = ({ filterKey }: { filterKey: FilterKey }) => (
        <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {FILTER_LABELS[filterKey]}
            </span>
            <select
                value={filters[filterKey]}
                onChange={(event) => updateFilter(filterKey, event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
                <option value="">Todos</option>
                {filterOptions[filterKey].map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );

    if (isLoading) {
        return <p className="mt-3 text-sm text-slate-500">Carregando lista...</p>;
    }

    if (posts.length === 0) {
        return <p className="mt-3 text-sm text-slate-500">Sem conteúdos neste período.</p>;
    }

    return (
        <div className="mt-2.5 space-y-3">
            <div className={compactLayout ? "" : "lg:hidden"}>
                <div className="space-y-2.5">
                    <label className="block">
                        <span className="sr-only">Buscar conteúdo</span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar"
                                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </label>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMobileFiltersOpen((current) => !current)}
                            className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-bold transition ${
                                mobileFiltersOpen || activeFilterChips.length > 0
                                    ? "bg-slate-900 text-white"
                                    : "border border-slate-200 bg-white text-slate-700"
                            }`}
                            aria-expanded={mobileFiltersOpen}
                        >
                            <Filter className="h-4 w-4" />
                            Filtros{activeFilterChips.length ? ` ${activeFilterChips.length}` : ""}
                        </button>
                        <label className="relative min-w-0">
                            <span className="sr-only">Ordenar conteúdos</span>
                            <select
                                value={sortField}
                                onChange={(event) => handleSortSelect(event.target.value as SortField)}
                                className="h-10 w-full appearance-none truncate rounded-2xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            >
                                {compactSortFields.map((field) => (
                                    <option key={field} value={field}>
                                        Ordenar: {sortFieldLabel[field]}
                                    </option>
                                ))}
                            </select>
                            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </label>
                        <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
                            aria-label={sortOrder === "desc" ? "Ordenar menor primeiro" : "Ordenar maior primeiro"}
                        >
                            {sortOrder === "desc" ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-0.5">
                        <p className="text-[11px] font-semibold text-slate-500">
                            {numberFormatter.format(filteredPosts.length)} de {numberFormatter.format(posts.length)}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500">
                            {sortOrder === "desc" ? "Maior primeiro" : "Menor primeiro"}
                        </p>
                    </div>
                    {mobileFiltersOpen ? (
                        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                            <FilterSelect filterKey="format" />
                            <FilterSelect filterKey="intent" />
                            <FilterSelect filterKey="narrative" />
                            <FilterSelect filterKey="context" />
                            <FilterSelect filterKey="strategy" />
                        </div>
                    ) : null}
                    {(hasActiveFilters || activeFilterChips.length > 0) ? (
                        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                            {query.trim() ? (
                                <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-700">
                                    {query.trim()}
                                </span>
                            ) : null}
                            {activeFilterChips.map((chip) => (
                                <span key={chip.key} className="inline-flex h-7 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-700">
                                    <span className="mr-1 text-slate-400">{chip.label}:</span>{chip.value}
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-slate-900 px-2.5 text-[11px] font-bold text-white"
                            >
                                <X className="h-3.5 w-3.5" />
                                Limpar
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className={compactLayout ? "hidden" : "hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:block"}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <label className="min-w-0 flex-1">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            Buscar conteúdo
                        </span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Legenda, tema, formato..."
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[520px]">
                        <FilterSelect filterKey="format" />
                        <FilterSelect filterKey="intent" />
                        <FilterSelect filterKey="narrative" />
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_170px_96px]">
                    <FilterSelect filterKey="context" />
                    <FilterSelect filterKey="strategy" />
                    <label className="min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            Ordenar por
                        </span>
                        <select
                            value={sortField}
                            onChange={(event) => setSortField(event.target.value as SortField)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        >
                            {Object.entries(sortFieldLabel).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            Direção
                        </span>
                        <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            {sortOrder === "desc" ? "Maior" : "Menor"}
                        </button>
                    </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <Filter className="h-4 w-4 text-slate-400" />
                        {numberFormatter.format(filteredPosts.length)} de {numberFormatter.format(posts.length)} conteúdos
                    </div>
                    {hasActiveFilters ? (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                            <X className="h-3.5 w-3.5" />
                            Limpar filtros
                        </button>
                    ) : null}
                </div>
            </div>

            {filteredPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum conteúdo encontrado com os filtros selecionados.
                </div>
            ) : (
                <>
                    <div className={compactLayout ? "space-y-3" : "space-y-2 lg:hidden"}>
                        {filteredPosts.map(({ post, presentation }, idx) => {
                            const strategicSupportLabels = [
                                ...presentation.proofLabels,
                                ...presentation.commercialLabels,
                                ...presentation.signalLabels,
                                ...presentation.stanceLabels,
                            ];
                            const tagGroups = uniqueTagGroups([
                                ...presentation.formatLabels.map((value) => ({ value, tone: "slate" as const })),
                                ...presentation.intentLabels.map((value) => ({ value, tone: "indigo" as const })),
                                ...presentation.narrativeLabels.map((value) => ({ value, tone: "violet" as const })),
                                ...presentation.contextLabels.map((value) => ({ value, tone: "sky" as const })),
                                ...strategicSupportLabels.map((value) => ({ value, tone: "amber" as const })),
                            ]);
                            const canOpenVideo = Boolean(post.videoUrl || post.postLink);
                            const primaryMetric = getCompactPrimaryMetric(post, sortField);
                            const hasDiscoverySignal = typeof post.nf === "number" && Number.isFinite(post.nf) && post.nf >= 0.01;

                            return (
                                <article
                                    key={post.id || idx}
	                                    className={
	                                        compactLayout
	                                            ? "rounded-[1.35rem] border border-slate-100 bg-white px-3 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.035)]"
	                                            : "rounded-[1.25rem] border border-slate-100 bg-white p-2.5 shadow-sm shadow-slate-200/35"
	                                    }
	                                >
	                                    <div className={compactLayout ? "flex gap-3.5" : "flex gap-3"}>
	                                        {canOpenVideo ? (
	                                            <button
	                                                type="button"
	                                                onClick={() => setActivePost(post)}
	                                                className={
	                                                    compactLayout
	                                                        ? "relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-[18px] border border-white bg-slate-100 shadow-sm ring-1 ring-slate-200/80"
	                                                        : "relative h-[96px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
	                                                }
	                                                aria-label="Assistir vídeo"
	                                            >
	                                                {post.thumbnail ? (
	                                                    <Image src={post.thumbnail} alt={post.caption || "Conteúdo"} fill className="object-cover" sizes={compactLayout ? "78px" : "72px"} />
	                                                ) : (
	                                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem img</div>
	                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                                <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-800 shadow-sm">
                                                    {idx + 1}
                                                </span>
                                                <span className="absolute bottom-1.5 left-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white shadow-sm">
                                                    <Play className="h-3 w-3 fill-current" />
	                                                </span>
	                                            </button>
	                                        ) : (
	                                            <div
	                                                className={
	                                                    compactLayout
	                                                        ? "relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-[18px] border border-white bg-slate-100 shadow-sm ring-1 ring-slate-200/80"
	                                                        : "relative h-[96px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
	                                                }
	                                            >
	                                                {post.thumbnail ? (
	                                                    <Image src={post.thumbnail} alt={post.caption || "Conteúdo"} fill className="object-cover" sizes={compactLayout ? "78px" : "72px"} />
	                                                ) : (
	                                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem img</div>
	                                                )}
                                                <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-800 shadow-sm">
                                                    {idx + 1}
                                                </span>
                                            </div>
                                        )}

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{primaryMetric.label}</p>
                                                    <p className="mt-0.5 text-[15px] font-black leading-none tabular-nums text-slate-950">
                                                        {primaryMetric.value}
                                                    </p>
                                                </div>
                                                {sortField !== "nf" && hasDiscoverySignal ? (
                                                    <div className={compactLayout ? "text-right" : "rounded-full bg-slate-50 px-2 py-1 text-right"}>
                                                        <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">Desc.</p>
                                                        <p className="text-[11px] font-bold tabular-nums text-slate-600">{formatDiscovery(post.nf)}</p>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-4 text-slate-600">
                                                {post.caption || post.metaLabel || "Conteúdo sem legenda"}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {tagGroups.map((tag, tagIndex) => (
                                                    <span
                                                        key={`${post.id || idx}-${tag.value}-${tagIndex}`}
                                                        className={`inline-flex max-w-full items-center rounded-full px-2 py-1 text-[10px] font-semibold leading-none ${
                                                            tag.tone === "indigo"
                                                                ? "bg-indigo-50 text-indigo-700"
                                                                : tag.tone === "violet"
                                                                    ? "bg-violet-50 text-violet-700"
                                                                : tag.tone === "sky"
                                                                    ? "bg-sky-50 text-sky-700"
                                                                    : "bg-slate-100 text-slate-700"
                                                        }`}
                                                    >
                                                        {tag.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

	                                    <div
	                                        className={
	                                            compactLayout
	                                                ? "mt-3 grid grid-cols-3 gap-y-2.5 rounded-[18px] bg-slate-50/82 px-3 py-2.5 ring-1 ring-slate-100 min-[430px]:grid-cols-5"
	                                                : "mt-2.5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-50/80 p-1"
	                                        }
                                    >
                                        <MobileMetric compactLayout={compactLayout} label="Curtidas" value={formatCompactMetric(post.likes)} />
                                        <MobileMetric compactLayout={compactLayout} label="Comentários" value={formatCompactMetric(post.comments)} />
                                        <MobileMetric compactLayout={compactLayout} label="Compart." value={formatCompactMetric(post.shares)} />
                                        <MobileMetric compactLayout={compactLayout} label="Salvos" value={formatCompactMetric(post.saves)} />
                                        <MobileMetric compactLayout={compactLayout} label="Duração" value={formatDuration(post.durationSeconds)} />
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className={compactLayout ? "hidden" : "hidden overflow-x-auto lg:block"}>
                        <div className="w-max min-w-full rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="sticky top-0 z-10 grid grid-cols-[72px,130px,150px,150px,130px,130px,92px,92px,90px,90px,90px,90px,90px] items-center gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                <div className="flex items-center gap-1">
                                    <Play className="h-3 w-3 text-slate-400" aria-hidden />
                                    <span>Mídia</span>
                                </div>
                                <div>Formato</div>
                                <div>Intenção</div>
                                <div>Narrativa</div>
                                <div>Contexto</div>
                                <div>Estratégia</div>
                                <HeaderCell field="nf" label="Desc." />
                                <HeaderCell field="pv" label="Visitas" />
                                <HeaderCell field="reach" label="Alcance" />
                                <HeaderCell field="likes" label="Likes" />
                                <HeaderCell field="comments" label="Com." />
                                <HeaderCell field="shares" label="Shares" />
                                <HeaderCell field="saves" label="Salvos" />
                            </div>

                            <div className="divide-y divide-slate-200">
                                {filteredPosts.map(({ post, presentation }, idx) => {
                                    const strategyLabels = [
                                        ...presentation.proofLabels,
                                        ...presentation.commercialLabels,
                                        ...presentation.signalLabels,
                                        ...presentation.stanceLabels,
                                    ];
                                    const canOpenVideo = Boolean(post.videoUrl || post.postLink);

                                    return (
                                        <div
                                            key={post.id || idx}
                                            className="grid grid-cols-[72px,130px,150px,150px,130px,130px,92px,92px,90px,90px,90px,90px,90px] items-center gap-3 px-4 py-2.5 transition-colors odd:bg-slate-50/30 hover:bg-slate-50/70"
                                        >
                                            {canOpenVideo ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setActivePost(post)}
                                                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                    aria-label="Assistir vídeo"
                                                >
                                                    {post.thumbnail ? (
                                                        <Image src={post.thumbnail} alt={post.caption || "Conteúdo"} fill className="object-cover" sizes="56px" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">Sem img</div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center">
                                                        <span className="inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                                            Ver
                                                        </span>
                                                    </div>
                                                </button>
                                            ) : (
                                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                                    {post.thumbnail ? (
                                                        <Image src={post.thumbnail} alt={post.caption || "Conteúdo"} fill className="object-cover" sizes="56px" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">Sem img</div>
                                                    )}
                                                </div>
                                            )}

                                            <TagCell labels={presentation.formatLabels} emptyText="-" tone="slate" />
                                            <TagCell labels={presentation.intentLabels} emptyText="Sem intenção" tone="indigo" />
                                            <TagCell labels={presentation.narrativeLabels} emptyText="Sem narrativa" tone="violet" />
                                            <TagCell labels={presentation.contextLabels} emptyText="-" tone="sky" />
                                            <TagCell labels={strategyLabels} emptyText="-" tone="amber" />

                                            <MetricText value={formatDiscovery(post.nf)} strong />
                                            <MetricText value={post.pv !== null ? numberFormatter.format(post.pv) : "-"} />
                                            <MetricText value={post.reach !== null ? numberFormatter.format(post.reach) : "-"} strong />
                                            <MetricText value={numberFormatter.format(post.likes)} />
                                            <MetricText value={numberFormatter.format(post.comments)} />
                                            <MetricText value={numberFormatter.format(post.shares)} />
                                            <MetricText value={numberFormatter.format(post.saves)} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
            <DiscoverVideoModal
                open={Boolean(activePost)}
                onClose={() => setActivePost(null)}
                postLink={activePost?.postLink || undefined}
                videoUrl={activePost?.videoUrl || undefined}
                posterUrl={activePost?.thumbnail || undefined}
            />
        </div>
    );
}

function MobileMetric({ compactLayout = false, label, value }: { compactLayout?: boolean; label: string; value: string }) {
    if (compactLayout) {
        return (
            <div className="min-w-0 text-center">
                <p className="truncate text-[8.5px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p>
                <p className="mt-0.5 text-[12px] font-black tabular-nums text-slate-900">{value}</p>
            </div>
        );
    }

    return (
        <div className="min-w-0 rounded-xl bg-white/70 px-1 py-1.5 text-center">
            <p className="truncate text-[8.5px] font-bold uppercase tracking-[0.04em] text-slate-400">{label}</p>
            <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-900">{value}</p>
        </div>
    );
}

function MetricText({ value, strong = false }: { value: string; strong?: boolean }) {
    return (
        <div className={`text-right text-xs tabular-nums ${strong ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}>
            {value}
        </div>
    );
}

function TagCell({
    labels,
    emptyText,
    tone,
}: {
    labels: string[];
    emptyText: string;
    tone: "slate" | "indigo" | "violet" | "sky" | "amber";
}) {
    const toneClassName =
        tone === "indigo"
            ? "bg-indigo-50 text-indigo-700 ring-indigo-700/10"
            : tone === "violet"
                ? "bg-violet-50 text-violet-700 ring-violet-700/10"
                : tone === "sky"
                    ? "bg-sky-50 text-sky-700 ring-sky-700/10"
                    : tone === "amber"
                        ? "bg-amber-50 text-amber-700 ring-amber-700/10"
                        : "bg-slate-100 text-slate-600 ring-slate-500/10";

    if (!labels.length) {
        return <span className="text-[10px] italic text-slate-400">{emptyText}</span>;
    }

    return (
        <div className="flex max-h-[58px] flex-wrap gap-1 overflow-hidden" title={labels.join(", ")}>
            {labels.slice(0, 3).map((label) => (
                <span
                    key={label}
                    className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium ring-1 ring-inset ${toneClassName}`}
                >
                    {label}
                </span>
            ))}
            {labels.length > 3 ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-500/10">
                    +{labels.length - 3}
                </span>
            ) : null}
        </div>
    );
}
