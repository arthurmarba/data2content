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
        <div className="flex w-full overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            <div className="flex w-full min-w-full sm:min-w-[600px] items-center justify-between bg-transparent p-0 sm:rounded-2xl sm:bg-slate-50 sm:p-1.5 sm:ring-1 sm:ring-slate-200">
                {days.map((dayIndex) => {
                    const isSelected = selectedDay === dayIndex;
                    const hasContent = (slotsByDay.get(dayIndex)?.length || 0) > 0;
                    const label = DAYS_PT[dayIndex - 1];
                    const shortLabel = DAYS_SHORT_PT[dayIndex - 1];

                    return (
                        <button
                            key={dayIndex}
                            onClick={() => onSelectDay(dayIndex)}
                            className={`group relative flex flex-col items-center justify-center transition-all duration-200
                                h-12 w-12 rounded-2xl sm:h-auto sm:w-auto sm:flex-1 sm:rounded-xl sm:py-3
                                ${isSelected
                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 sm:ring-black/5'
                                    : 'text-slate-500 hover:bg-slate-100 sm:hover:bg-white/50 sm:hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500 sm:group-hover:text-slate-700'
                                        }`}
                                >
                                    <span className="hidden sm:inline">{label}</span>
                                    <span className="sm:hidden">{shortLabel}</span>
                                </span>
                                {hasContent && (
                                    <span className={`absolute right-1 top-1 flex h-2 w-2 sm:static sm:flex ${isSelected ? 'sm:flex' : ''}`}>
                                        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isSelected ? 'bg-emerald-400' : 'bg-emerald-400'}`}></span>
                                        <span className={`relative inline-flex h-full w-full rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-emerald-500'}`}></span>
                                    </span>
                                )}
                            </div>
                            {isSelected && (
                                <div className="hidden sm:block absolute -bottom-1.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-brand-primary" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
