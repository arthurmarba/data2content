import React, { useMemo } from 'react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { CalendarHeatPoint } from './ContentPlannerCalendar';
import { Plus } from 'lucide-react';

const DAYS_FULL_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface PlannerWeekViewProps {
    slots: PlannerUISlot[];
    heatmap: CalendarHeatPoint[] | null;
    canEdit: boolean;
    onOpenSlot: (slot: PlannerUISlot) => void;
    onCreateSlot: (dayOfWeek: number, blockStartHour: number) => void;
}

function getStatusColor(status: PlannerUISlot['status'], heatScore?: number) {
    if (status === 'posted') return 'bg-emerald-50 border-l-4 border-l-emerald-500 text-emerald-900';
    if (heatScore && heatScore >= 0.75) return 'bg-white border-l-4 border-l-amber-400 text-slate-900 shadow-sm';
    if (status === 'test') return 'bg-white border-l-4 border-l-indigo-400 text-slate-900 shadow-sm';
    return 'bg-white border-l-4 border-l-slate-200 text-slate-600 shadow-sm';
}

const CompactSlotCard = ({
    slot,
    heatScore,
    onClick,
}: {
    slot: PlannerUISlot;
    heatScore?: number;
    onClick: () => void;
}) => {
    const title = slot.title?.trim() || slot.themeKeyword || slot.themes?.[0] || 'Sugestão';
    const format = slot.format || 'reel';
    const colorClass = getStatusColor(slot.status, heatScore);

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`group relative flex cursor-pointer flex-col gap-1 rounded-lg border border-slate-100 p-2 transition hover:shadow-md ${colorClass}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400">
                    {slot.blockStartHour}h
                </span>
                {slot.status === 'posted' && (
                    <span className="text-[10px] font-bold text-emerald-600">✓</span>
                )}
            </div>
            <p className="line-clamp-2 text-xs font-medium leading-snug">
                {title}
            </p>
            <div className="mt-1 flex items-center gap-1 opacity-60">
                <span className="text-[9px] uppercase tracking-wider">{format}</span>
            </div>
        </div>
    );
};

const DayColumn = ({
    dayIndex, // 1-7 (Sun-Sat)
    dayName,
    slots,
    heatmap,
    onOpenSlot,
    onCreateSlot,
    isToday,
}: {
    dayIndex: number;
    dayName: string;
    slots: PlannerUISlot[];
    heatmap: Map<string, number>;
    onOpenSlot: (slot: PlannerUISlot) => void;
    onCreateSlot: (day: number, hour: number) => void;
    isToday: boolean;
}) => {
    // Sort slots by time
    const sortedSlots = useMemo(() => {
        return [...slots].sort((a, b) => a.blockStartHour - b.blockStartHour);
    }, [slots]);

    return (
        <div className={`flex min-w-[140px] flex-1 flex-col gap-3 rounded-xl p-2 ${isToday ? 'bg-blue-50/50 ring-1 ring-blue-100' : ''}`}>
            <div className="text-center">
                <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                    {dayName}
                    {isToday && <span className="ml-1 text-[10px] font-normal text-blue-500">(Hoje)</span>}
                </span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
                {sortedSlots.map((slot) => {
                    const key = `${slot.dayOfWeek}-${slot.blockStartHour}`;
                    const heat = heatmap.get(key);
                    return (
                        <CompactSlotCard
                            key={slot.slotId || key}
                            slot={slot}
                            heatScore={heat}
                            onClick={() => onOpenSlot(slot)}
                        />
                    );
                })}

                <button
                    onClick={() => onCreateSlot(dayIndex, 9)}
                    className="flex h-8 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                    title="Adicionar pauta"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default function PlannerWeekView({
    slots,
    heatmap,
    canEdit,
    onOpenSlot,
    onCreateSlot,
}: PlannerWeekViewProps) {
    const slotsByDay = useMemo(() => {
        const map = new Map<number, PlannerUISlot[]>();
        slots.forEach((slot) => {
            const list = map.get(slot.dayOfWeek) || [];
            list.push(slot);
            map.set(slot.dayOfWeek, list);
        });
        return map;
    }, [slots]);

    const heatmapMap = useMemo(() => {
        const map = new Map<string, number>();
        (heatmap || []).forEach((h) => {
            map.set(`${h.dayOfWeek}-${h.blockStartHour}`, h.score);
        });
        return map;
    }, [heatmap]);

    const todayIndex = new Date().getDay() + 1; // 1 (Sun) - 7 (Sat)
    const days = [1, 2, 3, 4, 5, 6, 7];

    return (
        <div className="group overflow-x-auto pb-4">
            <div className="flex min-w-[800px] gap-2">
                {days.map((dayIndex) => (
                    <DayColumn
                        key={dayIndex}
                        dayIndex={dayIndex}
                        dayName={DAYS_FULL_PT[dayIndex - 1] || ''}
                        slots={slotsByDay.get(dayIndex) || []}
                        heatmap={heatmapMap}
                        onOpenSlot={onOpenSlot}
                        onCreateSlot={onCreateSlot}
                        isToday={dayIndex === todayIndex}
                    />
                ))}
            </div>
        </div>
    );
}
