import React, { useEffect, useMemo, useState } from 'react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import {
    LayoutTemplate,
    Target,
    Compass,
    MessageCircle,
    Link as LinkIcon,
    TrendingUp,
    Plus,
    Bookmark,
    X
} from 'lucide-react';
import { ALLOWED_BLOCKS } from '@/app/lib/planner/constants';
import { fetchSlotInspirations, getCachedInspirations } from '../utils/inspirationCache';
import { idsToLabels } from '@/app/lib/classification';

interface PlannerDailyScheduleProps {
    dayIndex: number;
    slots: PlannerUISlot[];
    onOpenSlot: (slot: PlannerUISlot) => void;
    onCreateSlot: (day: number, hour: number) => void;
    userId?: string;
    publicMode?: boolean;
    locked?: boolean;
    onDeleteSlot?: (slot: PlannerUISlot) => void;
}

const toProxyUrl = (raw?: string | null) => {
    if (!raw) return '';
    if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
    if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
    return raw;
};

function getStatusColor(status: PlannerUISlot['status']) {
    if (status === 'posted') return 'bg-emerald-50 border-emerald-200 text-emerald-900';
    if (status === 'test') return 'bg-indigo-50 border-indigo-200 text-indigo-900';
    return 'bg-white border-slate-200 text-slate-900';
}

const ScheduleSlotCard = ({
    slot,
    onClick,
    userId,
    publicMode,
    locked,
    onDeleteSlot,
}: {
    slot: PlannerUISlot;
    onClick: () => void;
    userId?: string;
    publicMode?: boolean;
    locked?: boolean;
    onDeleteSlot?: (slot: PlannerUISlot) => void;
}) => {
    const colorClass = getStatusColor(slot.status);
    const [showInspirations, setShowInspirations] = useState(() => !publicMode && !locked);

    // Data fetching state for inspirations
    const [selfInspiration, setSelfInspiration] = useState<{ id: string; caption: string; views?: number; thumbnailUrl?: string | null; postLink?: string | null } | null>(null);
    const [communityInspiration, setCommunityInspiration] = useState<{ id: string; caption: string; views?: number; coverUrl?: string | null; postLink?: string | null } | null>(null);
    const [inspLoading, setInspLoading] = useState(false);
    const [inspError, setInspError] = useState<string | null>(null);

    // Labels
    const formatLabel = idsToLabels([slot.format], 'format')[0] || slot.format;
    const proposalLabel = idsToLabels(slot.categories?.proposal, 'proposal').join(', ') || '-';
    const contextLabel = idsToLabels(slot.categories?.context, 'context').join(', ') || '-';
    const toneLabel = idsToLabels(slot.categories?.tone ? [slot.categories.tone] : [], 'tone')[0] || '-';
    const referenceLabel = idsToLabels(slot.categories?.reference, 'reference').join(', ') || '-';
    const viewsLabel = slot.expectedMetrics?.viewsP50 ? slot.expectedMetrics.viewsP50.toLocaleString('pt-BR') : '-';

    useEffect(() => {
        const canShowInspirations = !publicMode && !locked;
        setShowInspirations(canShowInspirations);

        const cached = canShowInspirations ? getCachedInspirations(slot) : null;
        setSelfInspiration(cached?.self ?? null);
        setCommunityInspiration(cached?.community ?? null);
        setInspLoading(false);
        setInspError(null);
    }, [slot, publicMode, locked]);

    useEffect(() => {
        if (!showInspirations || !userId || publicMode || locked) {
            return;
        }

        let cancelled = false;
        const load = async () => {
            const cached = getCachedInspirations(slot);
            const hasCached = Boolean(cached?.self || cached?.community);

            if (cached) {
                setSelfInspiration(cached.self);
                setCommunityInspiration(cached.community);
                setInspLoading(false);
            } else {
                setInspLoading(true);
            }
            setInspError(null);
            try {
                const result = await fetchSlotInspirations(userId, slot);
                if (!cancelled) {
                    setSelfInspiration(result.self);
                    setCommunityInspiration(result.community);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setInspError(err?.message || 'Erro ao carregar inspirações');
                }
            } finally {
                if (!cancelled && !hasCached) setInspLoading(false);
            }
        };

        void load();
        return () => { cancelled = true; };
    }, [slot, userId, publicMode, locked, showInspirations]);

    const formatCaption = (caption?: string) => {
        if (!caption) return '';
        return caption.length > 70 ? `${caption.slice(0, 67)}…` : caption;
    };

    const handleOpenLink = (event: React.MouseEvent, link?: string | null) => {
        event.stopPropagation();
        if (!link) return;
        try {
            window.open(link, '_blank', 'noopener,noreferrer');
        } catch {
            // silent fail
        }
    };

    const title =
        slot.title?.trim() ||
        slot.themeKeyword ||
        (slot.themes && slot.themes.length ? slot.themes[0] : '') ||
        'Sugestão pronta do Mobi';

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`group relative flex cursor-pointer flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${colorClass}`}
        >
            {slot.isSaved && (
                <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 pl-2 pr-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                        <Bookmark className="h-3 w-3" />
                        Salvo
                        {onDeleteSlot && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSlot(slot);
                                }}
                                className="ml-1 rounded-full p-0.5 hover:bg-brand-primary/20 text-brand-primary"
                                title="Remover salvo"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </span>
                </div>
            )}

            {/* Title / tema principal */}
            <div className="space-y-2 border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tema</span>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-brand-magenta transition-colors">
                        {title}
                    </h3>
                </div>
            </div>

            {/* New Grid Layout: Format | Proposal | Context | Tone | Reference | View Projection */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4 lg:divide-x lg:divide-slate-100">
                <div className="flex flex-col gap-1.5 px-1 lg:px-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <LayoutTemplate className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Formato</span>
                    </div>
                    <span className="truncate text-sm font-semibold text-slate-800" title={formatLabel}>{formatLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5 px-1 lg:px-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <Target className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Proposta</span>
                    </div>
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800" title={proposalLabel}>{proposalLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5 px-1 lg:px-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <Compass className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Contexto</span>
                    </div>
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800" title={contextLabel}>{contextLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5 px-1 lg:px-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Tom</span>
                    </div>
                    <span className="truncate text-sm font-semibold text-slate-800" title={toneLabel}>{toneLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5 px-1 lg:px-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <LinkIcon className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Referência</span>
                    </div>
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800" title={referenceLabel}>{referenceLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5 px-1 lg:px-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Projeção</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">{viewsLabel}</span>
                </div>
            </div>

            {/* Inspirations inline with mini cards (auto-show) */}
            {!publicMode && !locked && showInspirations && (
                <div className="mt-2 space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Inspirações
                        </p>
                    </div>

                    {inspError && <p className="text-[11px] text-red-600">{inspError}</p>}

                    <div className="grid gap-3 sm:grid-cols-2">
                        {/* Loading Skeletons */}
                        {inspLoading && !selfInspiration && !communityInspiration && (
                            <div className="col-span-2 grid gap-3 sm:grid-cols-2">
                                {[0, 1].map((idx) => (
                                    <div
                                        key={`insp-skeleton-${idx}`}
                                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                                    >
                                        <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gradient-to-br from-slate-200 to-slate-100" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                                            <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />
                                            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!inspLoading && !selfInspiration && !communityInspiration && (
                            <div className="col-span-2 py-2 text-center text-[11px] text-slate-400 italic">
                                Nenhuma inspiração encontrada para este contexto.
                            </div>
                        )}

                        {selfInspiration && (
                            <button
                                type="button"
                                onClick={(e) => handleOpenLink(e, selfInspiration.postLink)}
                                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] text-slate-600 transition hover:-translate-y-[1px] hover:shadow-md hover:border-brand-primary/20"
                            >
                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200">
                                    {selfInspiration.thumbnailUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={toProxyUrl(selfInspiration.thumbnailUrl)} alt="Inspiracao" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-brand-primary">Seu Acervo</span>
                                    </div>
                                    <p className="line-clamp-2 text-[11px] font-medium text-slate-700 leading-snug">{formatCaption(selfInspiration.caption)}</p>
                                    {selfInspiration.views ? (
                                        <span className="text-[10px] text-slate-500">{selfInspiration.views.toLocaleString('pt-BR')} views</span>
                                    ) : null}
                                </div>
                            </button>
                        )}

                        {communityInspiration && (
                            <button
                                type="button"
                                onClick={(e) => handleOpenLink(e, communityInspiration.postLink)}
                                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] text-slate-600 transition hover:-translate-y-[1px] hover:shadow-md hover:border-brand-primary/20"
                            >
                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200">
                                    {communityInspiration.coverUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={toProxyUrl(communityInspiration.coverUrl)} alt="Inspiracao comunidade" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Comunidade</span>
                                    </div>
                                    <p className="line-clamp-2 text-[11px] font-medium text-slate-700 leading-snug">{formatCaption(communityInspiration.caption)}</p>
                                    {communityInspiration.views ? (
                                        <span className="text-[10px] text-slate-500">{communityInspiration.views.toLocaleString('pt-BR')} views</span>
                                    ) : null}
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function PlannerDailySchedule({
    dayIndex,
    slots,
    onOpenSlot,
    onCreateSlot,
    userId,
    publicMode,
    locked,
    onDeleteSlot,
}: PlannerDailyScheduleProps) {
    // Define allowed time blocks (aligned with backend validation)
    const timeBlocks = [...ALLOWED_BLOCKS];

    // Pre-fetch inspirations for visible slots
    useEffect(() => {
        if (!userId || publicMode || locked || !slots.length) return;

        // We use a small timeout to not block the initial render
        const timer = setTimeout(() => {
            slots.forEach(slot => {
                fetchSlotInspirations(userId, slot).catch(() => {
                    // Ignore errors in pre-fetch
                });
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [slots, userId, publicMode, locked]);

    const slotsByBlock = useMemo(() => {
        const map = new Map<number, PlannerUISlot[]>();
        slots.forEach((slot) => {
            const list = map.get(slot.blockStartHour) || [];
            list.push(slot);
            map.set(slot.blockStartHour, list);
        });
        return map;
    }, [slots]);

    return (
        <div className="relative space-y-8 py-6">
            {/* Continuous Timeline Line */}
            <div className="absolute left-[4.5rem] top-6 bottom-6 w-px bg-slate-200" />

            {timeBlocks.map((hour) => {
                const blockSlots = slotsByBlock.get(hour) || [];
                const hasSlots = blockSlots.length > 0;
                const label = `${String(hour).padStart(2, '0')}:00`;

                return (
                    <div key={hour} className="relative flex gap-6">
                        {/* Time Label */}
                        <div className="flex w-12 flex-shrink-0 flex-col items-end pt-2">
                            <span className="text-sm font-semibold text-slate-400">{label}</span>
                        </div>

                        {/* Timeline Dot */}
                        <div className="absolute left-[4.5rem] top-3.5 -ml-1.5 h-3 w-3 rounded-full border-2 border-slate-50 bg-slate-300 ring-4 ring-white" />

                        {/* Content Area */}
                        <div className="flex-1 pl-8">
                            {hasSlots ? (
                                <div className="space-y-3">
                                    {blockSlots.map((slot, idx) => (
                                        <ScheduleSlotCard
                                            key={slot.slotId || `${slot.dayOfWeek}-${slot.blockStartHour}-${idx}`}
                                            slot={slot}
                                            onClick={() => onOpenSlot(slot)}
                                            userId={userId}
                                            publicMode={publicMode}
                                            locked={locked}
                                            onDeleteSlot={onDeleteSlot}
                                        />
                                    ))}
                                    <button
                                        onClick={() => onCreateSlot(dayIndex, hour)}
                                        className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 p-3 text-left transition hover:border-brand-primary/30 hover:bg-brand-primary/5"
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-white group-hover:text-brand-primary">
                                            <Plus className="h-4 w-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-400 group-hover:text-brand-primary">
                                            Adicionar outra pauta neste horário
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onCreateSlot(dayIndex, hour)}
                                    className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 p-3 text-left transition hover:border-brand-primary/30 hover:bg-brand-primary/5"
                                >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-white group-hover:text-brand-primary">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-400 group-hover:text-brand-primary">
                                        Adicionar pauta
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
