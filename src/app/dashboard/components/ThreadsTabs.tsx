"use client";

import React from 'react';

interface Tab {
    id: string;
    label: string;
}

interface ThreadsTabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (id: string) => void;
    className?: string;
    compact?: boolean;
    variant?: 'segmented' | 'underline';
    segmentedTheme?: 'default' | 'mono';
}

export default function ThreadsTabs({ 
    tabs, 
    activeTab, 
    onChange,
    className = "",
    compact = false,
    variant = 'segmented',
    segmentedTheme = 'default',
}: ThreadsTabsProps) {
    const layoutStyle = compact
        ? ({ gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))` } satisfies React.CSSProperties)
        : undefined;
    const isUnderline = variant === 'underline';
    const isMonoSegmented = !isUnderline && segmentedTheme === 'mono';

    return (
        <div
            className={`
                ${isUnderline
                    ? compact
                        ? 'flex items-center gap-4 overflow-x-auto no-scrollbar pb-0.5'
                        : 'flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-zinc-100/90 pb-0'
                    : compact
                        ? 'inline-grid max-w-full gap-1 rounded-full bg-zinc-100/90 p-0.5'
                        : 'dashboard-segmented flex items-center gap-1 overflow-x-auto no-scrollbar p-1'
                }
                ${className}
            `}
            style={layoutStyle}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`
                            relative transition-all duration-200
                            ${isUnderline
                                ? `dashboard-type-control whitespace-nowrap border-b-2 px-0 ${compact ? 'pb-2 pt-0.5' : 'pb-2.5 pt-1'} ${
                                    isActive
                                        ? 'border-zinc-950 text-zinc-950'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-600'
                                }`
                                : compact
                                    ? 'dashboard-type-control min-h-[2.05rem] min-w-0 rounded-full px-2 py-1.5 text-[11px] leading-none text-center whitespace-nowrap'
                                    : 'dashboard-type-control min-h-[2.5rem] whitespace-nowrap rounded-full px-4 py-2'
                            }
                            ${!isUnderline
                                ? isActive 
                                    ? isMonoSegmented
                                        ? 'bg-zinc-950 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950'
                                        : 'bg-[linear-gradient(180deg,#fff,#fff7fa)] text-zinc-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-pink-100/70'
                                    : isMonoSegmented
                                        ? 'text-zinc-500 hover:bg-white/78 hover:text-zinc-800'
                                        : 'text-zinc-500 hover:text-zinc-700'
                                : ''
                            }
                        `}
                        aria-pressed={isActive}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
