import React, { useEffect, useMemo, useState } from 'react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { Plus } from 'lucide-react';
import { ALLOWED_BLOCKS } from '@/app/lib/planner/constants';
import { fetchSlotInspirations } from '../utils/inspirationCache';

interface PlannerDailyScheduleProps {
    dayIndex: number;
    slots: PlannerUISlot[];
    onOpenSlot: (slot: PlannerUISlot) => void;
    onCreateSlot: (day: number, hour: number) => void;
    userId?: string;
    publicMode?: boolean;
    locked?: boolean;
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
}: {
    slot: PlannerUISlot;
    onClick: () => void;
    userId?: string;
    publicMode?: boolean;
    locked?: boolean;
}) => {
    const title = slot.title?.trim() || slot.themeKeyword || slot.themes?.[0] || 'Sugestão de pauta';
    const format = slot.format || 'reel';
    const colorClass = getStatusColor(slot.status);
    const rationale = Array.isArray(slot.rationale) ? slot.rationale.join(' ') : slot.rationale;
    const [selfInspiration, setSelfInspiration] = useState<{ id: string; caption: string; views?: number; thumbnailUrl?: string | null; postLink?: string | null } | null>(null);
    const [communityInspiration, setCommunityInspiration] = useState<{ id: string; caption: string; views?: number; coverUrl?: string | null; postLink?: string | null } | null>(null);
    const [inspLoading, setInspLoading] = useState(false);

    useEffect(() => {
        if (!userId || publicMode || locked) {
            setSelfInspiration(null);
            setCommunityInspiration(null);
            setInspLoading(false);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setInspLoading(true);
            try {
                const result = await fetchSlotInspirations(userId, slot);
                if (!cancelled) {
                    setSelfInspiration(result.self);
                    setCommunityInspiration(result.community);
                }
            } catch {
                if (!cancelled) {
                    setSelfInspiration(null);
                    setCommunityInspiration(null);
                }
            } finally {
                if (!cancelled) setInspLoading(false);
            }
        };

        // Small delay to prioritize UI rendering over data fetching
        const timer = setTimeout(load, 100);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [slot, userId, publicMode, locked]);

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
            // falha silenciosa para não quebrar o card
        }
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`group relative flex cursor-pointer flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${colorClass}`}
        >
            <div className="flex items-start gap-4">
                {/* Format Icon / Placeholder */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    {/* You could switch on format here to show specific icons */}
                    <span className="text-xs font-bold uppercase">{format.slice(0, 2)}</span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {format}
                            </span>
                            {slot.status === 'posted' && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    Publicado
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-brand-primary opacity-0 transition-opacity group-hover:opacity-100">
                            Editar
                        </span>
                    </div>

                    <h4 className="mt-2 text-lg font-semibold leading-snug text-slate-900">
                        {title}
                    </h4>
                </div>
            </div>

            {/* Themes */}
            {((slot.themes && slot.themes.length > 0) || slot.themeKeyword) && (
                <div className="flex flex-wrap gap-2">
                    {slot.themes && slot.themes.length > 0 ? (
                        <>
                            {slot.themes.slice(0, 4).map((theme, idx) => (
                                <span key={idx} className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                    #{theme}
                                </span>
                            ))}
                            {slot.themes.length > 4 && (
                                <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/10">
                                    +{slot.themes.length - 4}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                            #{slot.themeKeyword}
                        </span>
                    )}
                </div>
            )}

            {/* Inspirations inline with mini cards */}
            {!publicMode && !locked && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Inspirações alinhadas
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {inspLoading && (
                            <div className="col-span-2 text-[11px] text-slate-400">Buscando inspirações…</div>
                        )}
                        {!inspLoading && !selfInspiration && !communityInspiration && (
                            <div className="col-span-2 text-[11px] text-slate-400">Sem inspirações encontradas.</div>
                        )}
                        {selfInspiration && (
                            <button
                                type="button"
                                onClick={(e) => handleOpenLink(e, selfInspiration.postLink)}
                                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-left text-[11px] text-slate-600 transition hover:-translate-y-[1px] hover:shadow-sm"
                            >
                                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                    {selfInspiration.thumbnailUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={toProxyUrl(selfInspiration.thumbnailUrl)} alt="Inspiracao" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs">📁</span>
                                        <span className="font-semibold text-slate-700">Seu acervo</span>
                                    </div>
                                    <p className="line-clamp-2 text-[11px] text-slate-600">{formatCaption(selfInspiration.caption)}</p>
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
                                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-left text-[11px] text-slate-600 transition hover:-translate-y-[1px] hover:shadow-sm"
                            >
                                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                    {communityInspiration.coverUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={toProxyUrl(communityInspiration.coverUrl)} alt="Inspiracao comunidade" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs">🤝</span>
                                        <span className="font-semibold text-slate-700">Comunidade</span>
                                    </div>
                                    <p className="line-clamp-2 text-[11px] text-slate-600">{formatCaption(communityInspiration.caption)}</p>
                                    {communityInspiration.views ? (
                                        <span className="text-[10px] text-slate-500">{communityInspiration.views.toLocaleString('pt-BR')} views</span>
                                    ) : null}
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Metrics (if available) */}
            {slot.expectedMetrics && (slot.expectedMetrics.viewsP50 || slot.expectedMetrics.sharesP50) && (
                <div className="flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {slot.expectedMetrics.viewsP50 && (
                        <span className="flex items-center gap-1.5">
                            <span className="text-base">👁️</span>
                            <span>
                                <strong className="font-semibold text-slate-700">{slot.expectedMetrics.viewsP50.toLocaleString('pt-BR')}</strong> visualizações est.
                            </span>
                        </span>
                    )}
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
}: PlannerDailyScheduleProps) {
    // Define allowed time blocks (aligned with backend validation)
    const timeBlocks = [...ALLOWED_BLOCKS];

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
                                        />
                                    ))}
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
