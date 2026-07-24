"use client";

import React from 'react';

interface Tab {
    id: string;
    label: string;
    badge?: string | number | null;
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

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const count = tabs.length;
        if (count <= 1) return;
        let nextIndex: number | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % count;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + count) % count;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = count - 1;
        if (nextIndex === null) return;
        const nextTab = tabs[nextIndex];
        if (!nextTab) return;
        event.preventDefault();
        onChange(nextTab.id);
        const sibling = event.currentTarget.parentElement?.children[nextIndex] as HTMLElement | undefined;
        sibling?.focus();
    };

    return (
        <div
            role="tablist"
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
            {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        role="tab"
                        id={`threads-tab-${tab.id}`}
                        aria-selected={isActive}
                        aria-controls={`threads-tabpanel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={`
                            relative transition-all duration-200
                            ${isUnderline
                                ? `dashboard-type-control inline-flex items-center justify-center whitespace-nowrap border-b-2 px-0 ${compact ? 'pb-2 pt-0.5' : 'pb-2.5 pt-1'} ${
                                    isActive
                                        ? 'border-zinc-950 text-zinc-950'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-700'
                                }`
                                : compact
                                    ? 'dashboard-type-control inline-flex min-h-[2.05rem] min-w-0 items-center justify-center rounded-full px-2 py-1.5 text-center text-[11px] leading-none whitespace-nowrap'
                                    : 'dashboard-type-control inline-flex min-h-[2.5rem] items-center justify-center whitespace-nowrap rounded-full px-4 py-2'
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
                    >
                        <span>{tab.label}</span>
                        {tab.badge !== null && tab.badge !== undefined ? (
                            <span
                                className={`
                                    ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none
                                    ${isActive
                                        ? isMonoSegmented
                                            ? 'bg-white/16 text-white'
                                            : 'bg-rose-50 text-rose-600'
                                        : 'bg-zinc-100 text-zinc-500'
                                    }
                                `}
                                aria-label={`${tab.badge} ${
                                    Number(tab.badge) === 1 ? 'nova proposta' : 'novas propostas'
                                }`}
                            >
                                {tab.badge}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
