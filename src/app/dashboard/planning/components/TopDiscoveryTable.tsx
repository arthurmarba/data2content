"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronUpIcon, Play } from "lucide-react";
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

export function TopDiscoveryTable({ posts, isLoading }: TopDiscoveryTableProps) {
    const [sortField, setSortField] = useState<SortField>("nf");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [activePost, setActivePost] = useState<TopDiscoveryPost | null>(null);

    const handleSort = (field: SortField) => {
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

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <div className="w-4 h-4" />; // Placeholder
        return sortOrder === "asc" ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />;
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
        <div className="mt-3 overflow-x-auto">
            <div className="w-max min-w-full rounded-xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <div className="grid grid-cols-[90px,80px,110px,140px,140px,110px,110px,75px,75px,75px,75px,75px] items-center gap-3 bg-slate-50/90 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                    <div>Data</div>
                    <div className="flex items-center gap-1">
                        <Play className="h-3 w-3 text-slate-400" aria-hidden />
                        <span>Post</span>
                    </div>
                    <div>Formato</div>
                    <div>Proposta</div>
                    <div>Contexto</div>
                    <div>Tom</div>
                    <div>Ref</div>
                    <HeaderCell field="reach" label="Alcance" />
                    <HeaderCell field="likes" label="Likes" />
                    <HeaderCell field="comments" label="Com." />
                    <HeaderCell field="shares" label="Shares" />
                    <HeaderCell field="saves" label="Salvos" />
                </div>

                {/* Body */}
                <div className="divide-y divide-slate-200">
                    {sortedPosts.map((post, idx) => (
                        <div
                            key={post.id || idx}
                            className="grid grid-cols-[90px,80px,110px,140px,140px,110px,110px,75px,75px,75px,75px,75px] items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 transition-colors odd:bg-slate-50/30"
                        >
                            {/* Date Column */}
                            <div className="text-xs font-medium text-slate-900">
                                {post.date ? new Date(post.date).toLocaleDateString("pt-BR") : "—"}
                            </div>

                            {/* Post Column */}
                            {post.videoUrl || post.postLink ? (
                                <button
                                    type="button"
                                    onClick={() => setActivePost(post)}
                                    className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                    aria-label="Assistir vídeo"
                                >
                                    {post.thumbnail ? (
                                        <Image src={post.thumbnail} alt={post.caption} fill className="object-cover" sizes="64px" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                                            Sem img
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center">
                                        <span className="inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                            ▶ Ver vídeo
                                        </span>
                                    </div>
                                </button>
                            ) : (
                                <div className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                    {post.thumbnail ? (
                                        <Image src={post.thumbnail} alt={post.caption} fill className="object-cover" sizes="64px" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                                            Sem img
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Formato */}
                            <div className="text-xs font-medium text-slate-700 truncate" title={post.format.join(", ")}>
                                {post.format.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {post.format.map((f) => (
                                            <span key={f} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic text-[10px]">—</span>
                                )}
                            </div>

                            {/* Proposta */}
                            <div className="text-xs font-medium text-slate-700 line-clamp-2" title={post.proposal.join(", ")}>
                                {post.proposal.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {post.proposal.map((p) => (
                                            <span key={p} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic text-[10px]">Sem proposta</span>
                                )}
                            </div>

                            {/* Contexto */}
                            <div className="text-xs text-slate-600 line-clamp-2" title={post.context.join(", ")}>
                                {post.context.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {post.context.map((c) => (
                                            <span key={c} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic text-[10px]">Sem contexto</span>
                                )}
                            </div>

                            {/* Tom */}
                            <div className="text-[11px] text-slate-600 truncate" title={post.tone.join(", ")}>
                                {post.tone.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {post.tone.map((t) => (
                                            <span key={t} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic text-[10px]">—</span>
                                )}
                            </div>

                            {/* Ref */}
                            <div className="text-[11px] text-slate-600 truncate" title={post.reference.join(", ")}>
                                {post.reference.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {post.reference.map((r) => (
                                            <span key={r} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic text-[10px]">—</span>
                                )}
                            </div>

                            {/* Metrics */}
                            <div className="text-right text-xs font-semibold text-slate-700 tabular-nums">
                                {post.reach !== null ? numberFormatter.format(post.reach) : "—"}
                            </div>
                            <div className="text-right text-xs font-medium text-slate-600 tabular-nums">
                                {numberFormatter.format(post.likes)}
                            </div>
                            <div className="text-right text-xs font-medium text-slate-600 tabular-nums">
                                {numberFormatter.format(post.comments)}
                            </div>
                            <div className="text-right text-xs font-medium text-slate-600 tabular-nums">
                                {numberFormatter.format(post.shares)}
                            </div>
                            <div className="text-right text-xs font-medium text-slate-600 tabular-nums">
                                {numberFormatter.format(post.saves)}
                            </div>
                        </div>
                    ))}
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
