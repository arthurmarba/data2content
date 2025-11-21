import React from 'react';

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAYS_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface PlannerDayPickerProps {
    selectedDay: number;
    onSelectDay: (day: number) => void;
    slotsByDay: Map<number, any[]>;
}

export default function PlannerDayPicker({
    selectedDay,
    onSelectDay,
    slotsByDay,
}: PlannerDayPickerProps) {
    const days = [1, 2, 3, 4, 5, 6, 7]; // 1=Sun, 7=Sat

    return (
        <div className="flex w-full overflow-x-auto pb-2 sm:pb-0">
            <div className="flex w-full min-w-[600px] items-center justify-between rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200">
                {days.map((dayIndex) => {
                    const isSelected = selectedDay === dayIndex;
                    const hasContent = (slotsByDay.get(dayIndex)?.length || 0) > 0;
                    const label = DAYS_PT[dayIndex - 1];
                    const shortLabel = DAYS_SHORT_PT[dayIndex - 1];

                    return (
                        <button
                            key={dayIndex}
                            onClick={() => onSelectDay(dayIndex)}
                            className={`group relative flex flex-1 flex-col items-center justify-center rounded-xl py-3 transition-all duration-200 ${isSelected
                                    ? 'bg-white shadow-sm ring-1 ring-black/5'
                                    : 'hover:bg-white/50 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'
                                        }`}
                                >
                                    <span className="hidden sm:inline">{label}</span>
                                    <span className="sm:hidden">{shortLabel}</span>
                                </span>
                                {hasContent && (
                                    <span className="flex h-2 w-2">
                                        <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                    </span>
                                )}
                            </div>
                            {isSelected && (
                                <div className="absolute -bottom-1.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-brand-primary" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
