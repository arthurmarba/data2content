"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { ChevronDownIcon, ChevronUpIcon, Play } from "lucide-react";
import DiscoverVideoModal from "@/app/discover/components/DiscoverVideoModal";

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
    nf: number | null; // Non-followers ratio (0-1)
    pv: number | null; // Profile visits
    reach: number | null;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    thumbnail?: string | null;
    postLink?: string | null;
    videoUrl?: string | null;
}

interface TopDiscoveryTableProps {
    posts: TopDiscoveryPost[];
    isLoading?: boolean;
}

type SortField = "nf" | "reach" | "likes" | "comments" | "shares" | "saves";
type SortOrder = "asc" | "desc";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const sortFieldLabel: Record<Exclude<SortField, "nf">, string> = {
    reach: "Alcance",
    likes: "Likes",
    comments: "Comentários",
    shares: "Compartilhamentos",
    saves: "Salvos",
};

export function TopDiscoveryTable({ posts, isLoading }: TopDiscoveryTableProps) {
    const [sortField, setSortField] = useState<Exclude<SortField, "nf">>("reach");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [activePost, setActivePost] = useState<TopDiscoveryPost | null>(null);

    const handleSort = (field: Exclude<SortField, "nf">) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    const sortedPosts = useMemo(() => {
        return [...posts].sort((a, b) => {
            const valA = a[sortField] ?? 0;
            const valB = b[sortField] ?? 0;
            return sortOrder === "asc" ? valA - valB : valB - valA;
        });
    }, [posts, sortField, sortOrder]);

    const SortIcon = ({ field }: { field: Exclude<SortField, "nf"> }) => {
        if (sortField !== field) return <div className="w-4 h-4" />; // Placeholder
        return sortOrder === "asc" ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />;
    };

    const HeaderCell = ({
        field,
        label,
        align = "right",
    }: {
        field: Exclude<SortField, "nf">;
        label: string;
        align?: "left" | "right";
    }) => (
        <div
            className={`flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors select-none ${align === "right" ? "justify-end" : "justify-start"
                }`}
            onClick={() => handleSort(field)}
        >
            {align === "right" && <SortIcon field={field} />}
            <span>{label}</span>
            {align === "left" && <SortIcon field={field} />}
        </div>
    );

    if (isLoading) {
        return <p className="text-sm text-slate-500 mt-3">Carregando lista...</p>;
    }

    if (posts.length === 0) {
        return <p className="text-sm text-slate-500 mt-3">Sem dados de descoberta neste período.</p>;
    }

    return (
        <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:hidden">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ordenar posts</p>
                    <p className="text-xs text-slate-600">Mostrando por {sortFieldLabel[sortField].toLowerCase()}</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as Exclude<SortField, "nf">)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                    >
                        {Object.entries(sortFieldLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
                    >
                        {sortOrder === "desc" ? "Maior" : "Menor"}
                    </button>
                </div>
            </div>

            <div className="space-y-3 sm:hidden">
                {sortedPosts.map((post, idx) => {
                    const tagGroups = [
                        ...(post.format || []).slice(0, 1).map((value) => ({ value, tone: "slate" })),
                        ...(post.proposal || []).slice(0, 1).map((value) => ({ value, tone: "indigo" })),
                        ...(post.context || []).slice(0, 1).map((value) => ({ value, tone: "sky" })),
                    ];
                    const hiddenTagCount =
                        Math.max(0, (post.format || []).length - 1) +
                        Math.max(0, (post.proposal || []).length - 1) +
                        Math.max(0, (post.context || []).length - 1);
                    const canOpenVideo = Boolean(post.videoUrl || post.postLink);

                    return (
                        <article key={post.id || idx} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex gap-3">
                                {canOpenVideo ? (
                                    <button
                                        type="button"
                                        onClick={() => setActivePost(post)}
                                        className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                                        aria-label="Assistir vídeo"
                                    >
                                        {post.thumbnail ? (
                                            <Image src={post.thumbnail} alt={post.caption} fill className="object-cover" sizes="80px" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem img</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                        <div className="absolute inset-x-1 bottom-1 rounded-md bg-black/70 px-1.5 py-1 text-center text-[10px] font-semibold text-white">
                                            Ver vídeo
                                        </div>
                                    </button>
                                ) : (
                                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                        {post.thumbnail ? (
                                            <Image src={post.thumbnail} alt={post.caption} fill className="object-cover" sizes="80px" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem img</div>
                                        )}
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {post.date ? new Date(post.date).toLocaleDateString("pt-BR") : "Sem data"}
                                        </p>
                                        <p className="text-xs font-semibold text-slate-700">
                                            {post.reach !== null ? `${numberFormatter.format(post.reach)} de alcance` : "Alcance indisponível"}
                                        </p>
                                    </div>
                                    <p className="mt-1 line-clamp-3 text-sm font-semibold leading-snug text-slate-900">{post.caption || "Sem legenda"}</p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {tagGroups.map((tag) => (
                                            <span
                                                key={`${post.id || idx}-${tag.value}`}
                                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                                    tag.tone === "indigo"
                                                        ? "bg-indigo-50 text-indigo-700"
                                                        : tag.tone === "sky"
                                                            ? "bg-sky-50 text-sky-700"
                                                            : "bg-slate-100 text-slate-700"
                                                }`}
                                            >
                                                {tag.value}
                                            </span>
                                        ))}
                                        {hiddenTagCount > 0 ? (
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                                +{hiddenTagCount}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Likes</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(post.likes)}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Comentários</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(post.comments)}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Shares</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(post.shares)}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Salvos</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(post.saves)}</p>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
                <div className="w-max min-w-full rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid grid-cols-[90px,80px,110px,140px,140px,110px,110px,75px,75px,75px,75px,75px] items-center gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sticky top-0 z-10">
                        <div>Data</div>
                        <div className="flex items-center gap-1">
                            <Play className="h-3 w-3 text-slate-400" aria-hidden />
                            <span>Post</span>
                        </div>
                        <div>Formato</div>
                        <div>Intenção</div>
                        <div>Contexto</div>
                        <div>Tom</div>
                        <div>Ref</div>
                        <HeaderCell field="reach" label="Alcance" />
                        <HeaderCell field="likes" label="Likes" />
                        <HeaderCell field="comments" label="Com." />
                        <HeaderCell field="shares" label="Shares" />
                        <HeaderCell field="saves" label="Salvos" />
                    </div>

                    <div className="divide-y divide-slate-200">
                        {sortedPosts.map((post, idx) => (
                            <div
                                key={post.id || idx}
                                className="grid grid-cols-[90px,80px,110px,140px,140px,110px,110px,75px,75px,75px,75px,75px] items-center gap-3 px-4 py-2.5 transition-colors odd:bg-slate-50/30 hover:bg-slate-50/70"
                            >
                                <div className="text-xs font-medium text-slate-900">
                                    {post.date ? new Date(post.date).toLocaleDateString("pt-BR") : "—"}
                                </div>

                                {post.videoUrl || post.postLink ? (
                                    <button
                                        type="button"
                                        onClick={() => setActivePost(post)}
                                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                        aria-label="Assistir vídeo"
                                    >
                                        {post.thumbnail ? (
                                            <Image src={post.thumbnail} alt={post.caption} fill className="object-cover" sizes="64px" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">Sem img</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center">
                                            <span className="inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                                ▶ Ver vídeo
                                            </span>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                        {post.thumbnail ? (
                                            <Image src={post.thumbnail} alt={post.caption} fill className="object-cover" sizes="64px" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">Sem img</div>
                                        )}
                                    </div>
                                )}

                                <div className="truncate text-xs font-medium text-slate-700" title={post.format.join(", ")}>
                                    {post.format.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {post.format.map((f) => (
                                                <span key={f} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] italic text-slate-400">—</span>
                                    )}
                                </div>

                                <div className="line-clamp-2 text-xs font-medium text-slate-700" title={post.proposal.join(", ")}>
                                    {post.proposal.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {post.proposal.map((p) => (
                                                <span key={p} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] italic text-slate-400">Sem intenção</span>
                                    )}
                                </div>

                                <div className="line-clamp-2 text-xs text-slate-600" title={post.context.join(", ")}>
                                    {post.context.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {post.context.map((c) => (
                                                <span key={c} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] italic text-slate-400">Sem contexto</span>
                                    )}
                                </div>

                                <div className="truncate text-[11px] text-slate-600" title={post.tone.join(", ")}>
                                    {post.tone.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {post.tone.map((t) => (
                                                <span key={t} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] italic text-slate-400">—</span>
                                    )}
                                </div>

                                <div className="truncate text-[11px] text-slate-600" title={post.reference.join(", ")}>
                                    {post.reference.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {post.reference.map((r) => (
                                                <span key={r} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] italic text-slate-400">—</span>
                                    )}
                                </div>

                                <div className="text-right text-xs font-semibold tabular-nums text-slate-700">
                                    {post.reach !== null ? numberFormatter.format(post.reach) : "—"}
                                </div>
                                <div className="text-right text-xs font-medium tabular-nums text-slate-600">
                                    {numberFormatter.format(post.likes)}
                                </div>
                                <div className="text-right text-xs font-medium tabular-nums text-slate-600">
                                    {numberFormatter.format(post.comments)}
                                </div>
                                <div className="text-right text-xs font-medium tabular-nums text-slate-600">
                                    {numberFormatter.format(post.shares)}
                                </div>
                                <div className="text-right text-xs font-medium tabular-nums text-slate-600">
                                    {numberFormatter.format(post.saves)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
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
